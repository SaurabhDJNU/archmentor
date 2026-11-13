// Supabase Edge Function: payment-webhook   (turn OFF "Enforce JWT verification" for this one)
// Razorpay → Dashboard → Webhooks → URL: https://<project>.supabase.co/functions/v1/payment-webhook
// Events: payment.captured, payment.failed, refund.processed, refund.failed
// Secret: RAZORPAY_WEBHOOK_SECRET (the secret you typed when creating the webhook in Razorpay)
// Every event is recorded once (X-Razorpay-Event-Id is the idempotency key).
import { createClient } from 'npm:@supabase/supabase-js@2';

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  if (!secret) return new Response('not configured', { status: 503 });
  const raw = await req.text();                       // verify the exact bytes Razorpay signed
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const expected = await hmacHex(secret, raw);
  if (!safeEqual(expected, signature)) return new Response('bad signature', { status: 400 });

  const eventId = req.headers.get('x-razorpay-event-id') ?? '';
  const evt = JSON.parse(raw);
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const id = eventId || `${evt.event}:${evt.created_at}:${evt.payload?.payment?.entity?.id ?? evt.payload?.refund?.entity?.id ?? ''}`;

  try {
    if (evt.event === 'payment.captured' || evt.event === 'payment.failed') {
      const p = evt.payload.payment.entity;
      const { error } = await service.rpc('svc_record_payment', {
        p_provider_order: p.order_id,
        p_payment: p.id,
        p_amount: p.amount,
        p_currency: p.currency,
        p_status: evt.event === 'payment.captured' ? 'captured' : 'failed',
        p_event_id: `webhook:${id}`,
        p_payload: { event: evt.event, method: p.method, error_reason: p.error_reason ?? null },
      });
      if (error) throw error;
    } else if (evt.event === 'refund.processed' || evt.event === 'refund.failed') {
      const r = evt.payload.refund.entity;
      const { error } = await service.rpc('svc_refund_update', {
        p_refund: r.notes?.refund_request_id ?? null,
        p_provider_refund: r.id,
        p_status: evt.event === 'refund.processed' ? 'processed' : 'failed',
        p_event_id: `webhook:${id}`,
        p_payload: { event: evt.event, amount: r.amount },
      });
      if (error) throw error;
    }
    return new Response('ok');
  } catch (e) {
    // 500 makes Razorpay retry later; the event id keeps retries safe
    return new Response((e as Error).message ?? 'error', { status: 500 });
  }
});
