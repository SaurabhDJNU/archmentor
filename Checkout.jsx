import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as platform from './platform.js';
import { useAuth } from './auth.jsx';
import { DEMO } from './api.js';
import { rupees } from './money.js';
import { fmtDate, useLoad } from './util.js';
import { ErrorMsg, Loading } from './Bits.jsx';
import { Status } from './Ui.jsx';

// One button for every payment. The amount is decided by the database; the browser never sends a price.
export function PayButton({ kind, refId, label = 'Pay now', onPaid }) {
  const { profile } = useAuth();
  const [state, setState] = useState({ busy: false, msg: '', ok: false });
  const pay = async () => {
    setState({ busy: true, msg: '', ok: false });
    try {
      await platform.payFor(kind, refId, { name: profile?.full_name, email: profile?.email });
      setState({ busy: false, msg: 'Payment received. Confirmation is on its way by email.', ok: true });
      onPaid?.();
    } catch (e) {
      setState({ busy: false, msg: e.message, ok: false });
    }
  };
  return (
    <div className="stack gap-8">
      <div className="actions">
        <button type="button" className="btn" onClick={pay} disabled={state.busy}>{state.busy ? 'Opening secure payment…' : label}</button>
        <Link to="/legal/refunds" className="small ul">Refund policy</Link>
      </div>
      <p className="small faint">{DEMO ? 'Demo: payment is simulated — no money moves.' : 'Secure payment by Razorpay (UPI, cards, net banking). We never see your card details.'}</p>
      {state.msg && <p className={state.ok ? 'small ok' : 'err'} role={state.ok ? 'status' : 'alert'}>{state.msg}</p>}
    </div>
  );
}

export function MyPayments() {
  const { data, error, loading, reload } = useLoad(platform.myOrders);
  const refunds = useLoad(async () => (await platform.listRefunds().catch(() => [])));
  const [asking, setAsking] = useState(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  if (loading) return <Loading />;
  const openRefund = (o) => (refunds.data || []).find((r) => r.order_id === o.id && ['requested', 'approved', 'processing'].includes(r.status));
  return (
    <section>
      <h2 className="h-m" style={{ marginBottom: 16 }}>Payments</h2>
      <ErrorMsg error={error} />
      {!data?.length && <p className="empty">No payments yet.</p>}
      {(data || []).map((o) => (
        <div key={o.id} className="card-line">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ fontSize: 18 }}>{o.description}</p>
            <Status s={o.status === 'paid' ? 'approved' : o.status} label={o.status.replace('_', ' ')} />
          </div>
          <p className="small muted">{rupees(o.amount_paise)} · {fmtDate(o.paid_at || o.created_at)}{o.refunded_paise ? ` · refunded ${rupees(o.refunded_paise)}` : ''} · ref {o.provider_payment_id || o.id.slice(0, 8)}</p>
          {['paid', 'partially_refunded'].includes(o.status) && (openRefund(o)
            ? <p className="small mt-8">Refund request: <Status s="pending" label={openRefund(o).status} /></p>
            : asking === o.id ? (
              <form className="stack gap-8 mt-16" style={{ maxWidth: 520 }} onSubmit={async (e) => {
                e.preventDefault(); setMsg('');
                try { await platform.requestRefund(o.id, reason); setAsking(null); setReason(''); refunds.reload(); reload(); setMsg('Refund requested. Our team will reply by email.'); } catch (err) { setMsg(err.message); }
              }}>
                <label htmlFor={`rr-${o.id}`} className="small">Why do you need a refund?</label>
                <textarea id={`rr-${o.id}`} rows={2} required value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="actions"><button className="btn" type="submit">Request refund</button><button type="button" className="ul" onClick={() => setAsking(null)}>Cancel</button></div>
              </form>
            ) : <button type="button" className="ul small mt-8" onClick={() => setAsking(o.id)}>Ask for a refund</button>)}
        </div>
      ))}
      {msg && <p className="small mt-16" role="status">{msg}</p>}
    </section>
  );
}
