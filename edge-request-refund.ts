// Supabase Edge Function: request-refund
// Sends an APPROVED refund to Razorpay. Only staff with the finance.refund permission can call it
// (checked in the database). Approval itself happens in the staff workspace (public.decide_refund).
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
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
  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const url = Deno.env.get('SUPABASE_URL')!;
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: allowed } = await asUser.rpc('has_perm', { p: 'finance.refund' });
    if (allowed !== true) return json({ error: 'Not allowed (needs finance.refund and two-step sign-in)' }, 403);

    const { refund_id } = await req.json();
    const { data: rr } = await service.from('refund_requests').select('id, status, amount_paise, order_id, decided_by').eq('id', refund_id).maybeSingle();
    if (!rr || !['approved', 'failed'].includes(rr.status)) return json({ error: 'Approve the refund first' }, 400);
    const { data: order } = await service.from('orders').select('provider_payment_id, status').eq('id', rr.order_id).single();
    if (!order?.provider_payment_id) return json({ error: 'No captured payment on this order' }, 400);

    const res = await fetch(`https://api.razorpay.com/v1/payments/${order.provider_payment_id}/refund`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`) },
      body: JSON.stringify({ amount: rr.amount_paise, speed: 'normal', notes: { refund_request_id: rr.id }, receipt: String(rr.id).slice(0, 40) }),
    });
    const r = await res.json();
    if (!res.ok) {
      await service.rpc('svc_refund_update', { p_refund: rr.id, p_provider_refund: null, p_status: 'failed', p_event_id: `api-fail:${rr.id}:${Date.now()}`, p_payload: r });
      return json({ error: r?.error?.description ?? 'Razorpay refused the refund' }, 502);
    }
    const status = r.status === 'processed' ? 'processed' : 'processing';
    const { data, error } = await service.rpc('svc_refund_update', {
      p_refund: rr.id, p_provider_refund: r.id, p_status: status, p_event_id: `api:${r.id}:${status}`, p_payload: { amount: r.amount },
    });
    if (error) return json({ error: error.message }, 500);
    return json({ result: data, provider_refund_id: r.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
