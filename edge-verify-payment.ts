// Supabase Edge Function: verify-payment
// Called by the browser right after Razorpay Checkout succeeds. Verifies the HMAC signature,
// then asks Razorpay for the payment itself (amount, currency, status) before recording it.
// The webhook (payment-webhook) records the same payment too; whichever arrives first wins, the other is a no-op.
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const url = Deno.env.get('SUPABASE_URL')!;
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every((v) => typeof v === 'string' && v.length < 100)) {
      return json({ error: 'Bad request' }, 400);
    }
    const expected = await hmacHex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (!safeEqual(expected, razorpay_signature)) return json({ error: 'Signature check failed' }, 400);

    // The order must belong to the signed-in person
    const { data: mine } = await asUser.from('orders').select('id').eq('provider_order_id', razorpay_order_id).maybeSingle();
    if (!mine) return json({ error: 'Order not found' }, 404);

    const res = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`) },
    });
    const p = await res.json();
    if (!res.ok) return json({ error: 'Could not confirm the payment with Razorpay' }, 502);
    if (p.order_id !== razorpay_order_id) return json({ error: 'Payment does not belong to this order' }, 400);

    let status = p.status;
    if (status === 'authorized') {
      // capture if the account is not on auto-capture
      const cap = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}/capture`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`) },
        body: JSON.stringify({ amount: p.amount, currency: p.currency }),
      });
      if (cap.ok) status = 'captured';
    }
    if (status !== 'captured') return json({ result: 'pending', status });

    const { data, error } = await service.rpc('svc_record_payment', {
      p_provider_order: razorpay_order_id,
      p_payment: razorpay_payment_id,
      p_amount: p.amount,
      p_currency: p.currency,
      p_status: 'captured',
      p_event_id: `verify:${razorpay_payment_id}`,
      p_payload: { source: 'verify', method: p.method },
    });
    if (error) return json({ error: error.message }, 500);
    return json({ result: data === 'duplicate' || data === 'already_paid' ? 'paid' : data });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
