// Supabase Edge Function: create-checkout-order
// Creates (or reuses) an order in the database and a matching Razorpay order.
// The price ALWAYS comes from the database (public.create_order) — never from the browser.
// Secrets (Supabase → Edge Functions → Secrets): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) return json({ error: 'Payments are not configured yet' }, 503);

    const auth = req.headers.get('Authorization') ?? '';
    const url = Deno.env.get('SUPABASE_URL')!;
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { kind, ref } = await req.json();
    if (!['booking', 'event', 'portfolio'].includes(kind) || typeof ref !== 'string') return json({ error: 'Bad request' }, 400);

    // Runs as the signed-in student: checks ownership and status, computes the price server-side.
    const { data: order, error } = await asUser.rpc('create_order', { p_kind: kind, p_ref: ref });
    if (error) return json({ error: error.message }, 400);
    if (order.key_id && order.key_id !== keyId) return json({ error: 'Key mismatch: check Settings → Payments' }, 500);

    let providerOrderId = order.provider_order_id as string | null;
    if (!providerOrderId) {
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`) },
        body: JSON.stringify({
          amount: order.amount_paise,
          currency: order.currency,
          receipt: String(order.order_id).slice(0, 40),
          notes: { order_id: order.order_id, kind },
        }),
      });
      const rp = await res.json();
      if (!res.ok) return json({ error: rp?.error?.description ?? 'Could not start payment' }, 502);
      providerOrderId = rp.id;
      const { error: e2 } = await service.rpc('svc_attach_provider_order', { p_order: order.order_id, p_provider_order: providerOrderId });
      if (e2) return json({ error: e2.message }, 500);
    }
    return json({
      key_id: keyId,
      order_id: order.order_id,
      provider_order_id: providerOrderId,
      amount_paise: order.amount_paise,
      currency: order.currency,
      description: order.description,
      mode: order.mode,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
