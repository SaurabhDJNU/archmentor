import { useMemo, useState } from 'react';
import * as platform from './platform.js';
import * as api from './api.js';
import { bpsToPct, calcCommission, rupees, toPaise } from './money.js';
import { download, fmtDate, toCsv, useLoad } from './util.js';
import { ErrorMsg, Loading } from './Bits.jsx';
import { Stat, Status, Tabs } from './Ui.jsx';

const csv = (name, rows) => { download(name, toCsv(rows)); platform.logEvent('export', { table: name, rows: rows.length }); };

function RefundRow({ r, can, reload }) {
  const [amt, setAmt] = useState(((r.amount_paise || 0) / 100).toFixed(2));
  const [note, setNote] = useState('');
  const [ref, setRef] = useState('');
  const [msg, setMsg] = useState('');
  const go = async (fn) => { setMsg(''); try { await fn(); reload(); } catch (e) { setMsg(e.message); } };
  return (
    <div className="card-line stack gap-8">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p>{r.order?.description || r.order_id} <span className="small muted">· paid {rupees(r.order?.amount_paise)}{r.auto ? ' · from a cancellation' : ''}</span></p>
        <Status s={r.status === 'refunded' ? 'approved' : r.status === 'rejected' ? 'declined' : 'pending'} label={r.status} />
      </div>
      <p className="small muted">Requested {rupees(r.amount_paise)} · {fmtDate(r.created_at, true)} · “{r.reason}”{r.decision_note ? ` · note: ${r.decision_note}` : ''}</p>
      {can('finance.refund') && ['requested', 'failed'].includes(r.status) && (
        <div className="form-row" style={{ alignItems: 'end' }}>
          <div className="field"><label htmlFor={`ra-${r.id}`}>Refund ₹</label><input id={`ra-${r.id}`} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} /></div>
          <div className="field"><label htmlFor={`rn-${r.id}`}>Note to the student</label><input id={`rn-${r.id}`} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <button type="button" className="btn" onClick={() => go(() => platform.decideRefund(r.id, true, toPaise(amt), note))}>Approve</button>
          <button type="button" className="ul" onClick={() => go(() => platform.decideRefund(r.id, false, null, note))}>Decline</button>
        </div>
      )}
      {can('finance.refund') && ['approved', 'processing', 'failed'].includes(r.status) && (
        <div className="form-row" style={{ alignItems: 'end' }}>
          {r.status === 'approved' && <button type="button" className="btn" onClick={() => window.confirm(`Send a refund of ${rupees(r.amount_paise)} through Razorpay?`) && go(() => platform.sendRefundToGateway(r.id))}>Send refund via Razorpay</button>}
          <div className="field"><label htmlFor={`rr-${r.id}`}>…or record a refund made elsewhere (reference)</label><input id={`rr-${r.id}`} value={ref} onChange={(e) => setRef(e.target.value)} /></div>
          <button type="button" className="ul" onClick={() => go(() => platform.recordManualRefund(r.id, ref))}>Record</button>
        </div>
      )}
      {msg && <p className="err" role="alert">{msg}</p>}
    </div>
  );
}

export function Finance({ can }) {
  const [tab, setTab] = useState('refunds');
  const sum = useLoad(() => platform.financeSummary(30));
  const refunds = useLoad(platform.listRefunds);
  const orders = useLoad(() => (tab === 'orders' ? platform.listOrders() : null), [tab]);
  const ledger = useLoad(() => (tab === 'ledger' ? platform.listLedger() : null), [tab]);
  const [rf, setRf] = useState('open');
  const rrows = (refunds.data || []).filter((r) => rf === 'all' || ['requested', 'approved', 'processing', 'failed'].includes(r.status));
  return (
    <section className="stack gap-32">
      <h2 className="h-m">Finance</h2>
      {sum.data && (
        <>
          {sum.data.mode !== 'live' && <p className="notice-box">Payments are in <b>{sum.data.mode}</b> mode{sum.data.mode === 'test' ? ' — Razorpay test keys, no real money.' : ' — paid services are arranged by mentors directly.'} Switch to live only after Razorpay KYC and legal review (Settings).</p>}
          <div className="stats">
            <Stat label="Collected · 30 days" value={rupees(sum.data.collected)} />
            <Stat label="Commission · 30 days" value={rupees(sum.data.commission)} />
            <Stat label="Gateway fees (est.)" value={rupees(sum.data.gateway)} />
            <Stat label="Refunded · 30 days" value={rupees(sum.data.refunded)} />
            <Stat label="Owed to mentors" value={rupees(sum.data.owed_to_mentors)} note="All time, from the ledger" />
            <Stat label="Needs review" value={sum.data.in_review} note="Amount or currency mismatch" />
          </div>
        </>
      )}
      <ErrorMsg error={sum.error} />
      <Tabs tabs={[['refunds', `Refunds (${sum.data?.open_refunds ?? 0} open)`], ['orders', 'Orders'], ['ledger', 'Ledger']]} active={tab} setActive={setTab} />
      {tab === 'refunds' && (
        <div className="stack gap-16">
          <div className="choice-row">{[['open', 'Open'], ['all', 'All']].map(([k, l]) => <button key={k} type="button" className="choice" aria-pressed={rf === k} onClick={() => setRf(k)}>{l}</button>)}</div>
          {refunds.loading && <Loading />}
          {!refunds.loading && !rrows.length && <p className="empty">No refund requests.</p>}
          {rrows.map((r) => <RefundRow key={r.id} r={r} can={can} reload={() => { refunds.reload(); sum.reload(); }} />)}
          <p className="small muted">The person who requested a refund cannot approve it. Approved refunds go back to the original payment method; the mentor’s share is reversed in the ledger automatically.</p>
        </div>
      )}
      {tab === 'orders' && (orders.loading ? <Loading /> : (
        <div className="stack gap-16">
          <button type="button" className="ul" style={{ alignSelf: 'flex-end' }} onClick={() => csv('orders.csv', (orders.data || []).map(({ commission_snapshot, ...o }) => ({ ...o, rule: commission_snapshot?.rule_name, commission_bps: commission_snapshot?.percentage_bps })))}>Download CSV</button>
          <div className="table-box"><table className="data">
            <thead><tr><th>Order</th><th>Paid</th><th>Fee</th><th>Mentor</th><th>Status</th><th>Payout</th></tr></thead>
            <tbody>{(orders.data || []).map((o) => (
              <tr key={o.id}>
                <td>{o.description}<br /><span className="small muted">{fmtDate(o.paid_at || o.created_at, true)} · {o.kind} · {o.provider_payment_id || o.provider_order_id || o.id.slice(0, 8)} · rule {o.commission_snapshot?.rule_name} {bpsToPct(o.commission_snapshot?.percentage_bps)}</span></td>
                <td>{rupees(o.amount_paise)}{o.refunded_paise ? <><br /><span className="small muted">−{rupees(o.refunded_paise)}</span></> : null}</td>
                <td>{rupees(o.platform_fee_paise)}</td><td>{rupees(o.mentor_net_paise - (o.mentor_reversed_paise || 0))}</td>
                <td><Status s={o.status === 'paid' ? 'approved' : o.status === 'review' ? 'declined' : 'pending'} label={o.status} /></td><td className="small">{o.completed_at ? 'done' : 'not done'} · {o.payout_status.replace('_', ' ')}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      ))}
      {tab === 'ledger' && (ledger.loading ? <Loading /> : (
        <div className="stack gap-16">
          <p className="small muted">The ledger is append-only: entries are never changed or deleted. Corrections are new “adjustment” entries approved by a second person.</p>
          <button type="button" className="ul" style={{ alignSelf: 'flex-end' }} onClick={() => csv('ledger.csv', ledger.data || [])}>Download CSV</button>
          <div className="table-box"><table className="data">
            <thead><tr><th>#</th><th>When</th><th>Type</th><th>Amount</th><th>Order / mentor</th><th>Reference</th></tr></thead>
            <tbody>{(ledger.data || []).map((e) => <tr key={e.id}><td className="small">{e.id}</td><td className="small">{fmtDate(e.created_at, true)}</td><td>{e.entry_type.replace(/_/g, ' ')}</td><td className="num">{rupees(e.amount_paise)}</td><td className="small">{String(e.order_id || '').slice(0, 8)} {e.mentor_id ? `· mentor ${String(e.mentor_id).slice(0, 8)}` : ''}</td><td className="small">{e.reference}</td></tr>)}</tbody>
          </table></div>
        </div>
      ))}
    </section>
  );
}

export function Payouts({ can }) {
  const cands = useLoad(platform.payoutCandidates);
  const pays = useLoad(platform.listPayouts);
  const adj = useLoad(() => (can('finance.adjust') ? platform.listAdjustments() : []));
  const mentors = useLoad(api.listMentors);
  const [refs, setRefs] = useState({});
  const [msg, setMsg] = useState('');
  const [a, setA] = useState({ mentor_id: '', amount: '', reason: '' });
  const go = async (fn, ok) => { setMsg(''); try { await fn(); setMsg(ok || 'Done.'); cands.reload(); pays.reload(); adj.reload(); } catch (e) { setMsg(e.message); } };
  const name = (id) => (mentors.data || []).find((m) => m.id === id)?.full_name || String(id).slice(0, 8);
  return (
    <section className="stack gap-48">
      <div className="notice-box">Payouts are sent manually by bank/UPI transfer and recorded here with the transfer reference. Automatic transfers (Razorpay Route) stay off until the provider and a legal review approve them.</div>
      {msg && <p className="small" role="status">{msg}</p>}
      <div className="stack gap-16">
        <h2 className="h-m">Ready to pay</h2>
        {cands.loading && <Loading />}<ErrorMsg error={cands.error} />
        {!cands.loading && !(cands.data || []).length && <p className="empty">No completed, paid sessions past the hold period.</p>}
        {(cands.data || []).map((c) => (
          <div key={c.mentor_id} className="card-line" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span>{c.full_name} <span className="small muted">· {c.orders} sessions · {c.payout_method ? `${c.payout_method}: ${c.payout_display}` : 'no payout details yet'} · KYC {c.kyc_status}</span></span>
            <span className="actions"><b className="num" style={{ fontWeight: 500 }}>{rupees(c.ready_paise)}</b>{can('finance.payout.prepare') && <button type="button" className="btn" onClick={() => go(() => platform.preparePayout(c.mentor_id), 'Payout prepared — a second person must approve it.')}>Prepare payout</button>}</span>
          </div>
        ))}
      </div>
      <div className="stack gap-16">
        <h2 className="h-m">Payouts</h2>
        {(pays.data || []).map((p) => (
          <div key={p.id} className="card-line stack gap-8">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>{p.mentor_name} · <b className="num" style={{ fontWeight: 500 }}>{rupees(p.amount_paise)}</b> <span className="small muted">· prepared {fmtDate(p.created_at)}</span></span>
              <Status s={p.status === 'paid' ? 'approved' : p.status === 'cancelled' ? 'declined' : 'pending'} label={p.status} />
            </div>
            {p.reference && <p className="small muted">Reference {p.reference} · paid {fmtDate(p.paid_at)}</p>}
            {can('finance.payout.approve') && p.status === 'prepared' && <div className="actions"><button type="button" className="btn" onClick={() => go(() => platform.approvePayout(p.id), 'Approved.')}>Approve</button><button type="button" className="ul" onClick={() => go(() => platform.cancelPayout(p.id, window.prompt('Reason?') || ''), 'Cancelled.')}>Cancel</button></div>}
            {can('finance.payout.approve') && p.status === 'approved' && (
              <form className="form-row" style={{ alignItems: 'end' }} onSubmit={(e) => { e.preventDefault(); go(() => platform.markPayoutPaid(p.id, refs[p.id]), 'Marked paid. The mentor got an email.'); }}>
                <div className="field"><label htmlFor={`pr-${p.id}`}>Bank / UPI transfer reference (UTR)</label><input id={`pr-${p.id}`} required value={refs[p.id] || ''} onChange={(e) => setRefs({ ...refs, [p.id]: e.target.value })} /></div>
                <button className="btn" type="submit">Mark as paid</button>
              </form>
            )}
          </div>
        ))}
        {!pays.loading && !(pays.data || []).length && <p className="empty">No payouts yet.</p>}
      </div>
      {can('finance.adjust') && (
        <div className="stack gap-16">
          <h2 className="h-m">Adjustments</h2>
          <form className="form-row" style={{ alignItems: 'end' }} onSubmit={(e) => { e.preventDefault(); go(() => platform.requestAdjustment(a.mentor_id, null, Math.sign(Number(a.amount)) * toPaise(Math.abs(Number(a.amount))), a.reason), 'Requested — a second person must approve it.').then(() => setA({ mentor_id: '', amount: '', reason: '' })); }}>
            <div className="field"><label htmlFor="aj-m">Mentor</label><select id="aj-m" required value={a.mentor_id} onChange={(e) => setA({ ...a, mentor_id: e.target.value })}><option value="">Choose…</option>{(mentors.data || []).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></div>
            <div className="field"><label htmlFor="aj-a">Amount ₹ (negative = mentor owes)</label><input id="aj-a" required inputMode="decimal" value={a.amount} onChange={(e) => setA({ ...a, amount: e.target.value })} /></div>
            <div className="field" style={{ flex: '2 1 240px' }}><label htmlFor="aj-r">Reason</label><input id="aj-r" required minLength={5} value={a.reason} onChange={(e) => setA({ ...a, reason: e.target.value })} /></div>
            <button className="btn" type="submit">Request</button>
          </form>
          {(adj.data || []).map((x) => (
            <div key={x.id} className="card-line" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>{name(x.mentor_id)} · <span className="num">{rupees(x.amount_paise)}</span> <span className="small muted">· {x.reason}</span></span>
              <span className="actions"><Status s={x.status === 'approved' ? 'approved' : x.status === 'rejected' ? 'declined' : 'pending'} label={x.status} />
                {x.status === 'requested' && <><button type="button" className="ul small" onClick={() => go(() => platform.decideAdjustment(x.id, true))}>Approve</button><button type="button" className="ul small" onClick={() => go(() => platform.decideAdjustment(x.id, false))}>Reject</button></>}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const BLANK_RULE = { name: '', service_type: '', mentor_id: '', percentage: '20', fixed: '0', min: '0', max: '', gateway_fee_bearer: 'platform', fee_included: true, reason: '' };

export function Commission() {
  const rules = useLoad(platform.listCommissionRules);
  const mentors = useLoad(api.listMentors);
  const settings = useLoad(api.getSettings);
  const [f, setF] = useState(null);
  const [price, setPrice] = useState('1000');
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const ruleFromForm = (x) => ({
    name: x.name, service_type: x.service_type || null, mentor_id: x.mentor_id || null,
    percentage_bps: Math.round(Number(x.percentage) * 100), fixed_fee_paise: toPaise(x.fixed || '0') || 0, min_fee_paise: toPaise(x.min || '0') || 0,
    max_fee_paise: x.max === '' ? null : toPaise(x.max), gateway_fee_bearer: x.gateway_fee_bearer, fee_included: x.fee_included, reason: x.reason, replaces: x.replaces || null,
  });
  const preview = useMemo(() => (f ? calcCommission(toPaise(price) || 0, ruleFromForm(f), settings.data || undefined) : null), [f, price, settings.data]);
  const active = (rules.data || []).filter((r) => !r.effective_to || new Date(r.effective_to) > new Date());
  const past = (rules.data || []).filter((r) => r.effective_to && new Date(r.effective_to) <= new Date());
  const name = (id) => (mentors.data || []).find((m) => m.id === id)?.full_name || id;
  return (
    <section className="stack gap-32">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="h-m">Commission rules</h2>
        {!f && <button type="button" className="btn" onClick={() => setF({ ...BLANK_RULE })}>New rule</button>}
      </div>
      <p className="small muted">The most specific active rule wins: a rule for one mentor beats a rule for a service type, which beats the general rule. Changing a rule never changes past orders — each order keeps a copy of the rule it was sold under. Default when no rule matches: {bpsToPct(settings.data?.default_commission_bps ?? 2000)}.</p>
      {f && (
        <form className="panel stack gap-16" onSubmit={async (e) => { e.preventDefault(); setMsg(''); try { await platform.saveCommissionRule(ruleFromForm(f)); setF(null); rules.reload(); } catch (err) { setMsg(err.message); } }}>
          <p className="h-m">{f.replaces ? 'Replace rule' : 'New rule'}</p>
          <div className="form-row">
            <div className="field"><label htmlFor="cr-n">Name</label><input id="cr-n" value={f.name} onChange={set('name')} placeholder="e.g. Launch offer" /></div>
            <div className="field"><label htmlFor="cr-t">Applies to service type</label><select id="cr-t" value={f.service_type} onChange={set('service_type')}><option value="">All types</option>{['consultation', 'portfolio_review', 'thesis', 'career', 'event'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
            <div className="field"><label htmlFor="cr-m">Applies to mentor</label><select id="cr-m" value={f.mentor_id} onChange={set('mentor_id')}><option value="">All mentors</option>{(mentors.data || []).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="cr-p">Commission %</label><input id="cr-p" type="number" step="0.01" min="0" max="100" required value={f.percentage} onChange={set('percentage')} /></div>
            <div className="field"><label htmlFor="cr-f">+ fixed fee ₹</label><input id="cr-f" inputMode="decimal" value={f.fixed} onChange={set('fixed')} /></div>
            <div className="field"><label htmlFor="cr-min">Minimum fee ₹</label><input id="cr-min" inputMode="decimal" value={f.min} onChange={set('min')} /></div>
            <div className="field"><label htmlFor="cr-max">Maximum fee ₹ (blank = none)</label><input id="cr-max" inputMode="decimal" value={f.max} onChange={set('max')} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="cr-b">Who pays the gateway fee</label><select id="cr-b" value={f.gateway_fee_bearer} onChange={set('gateway_fee_bearer')}><option value="platform">Platform</option><option value="mentor">Mentor</option><option value="student">Student (added at checkout)</option></select></div>
            <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.fee_included} onChange={set('fee_included')} /> Fee is taken out of the listed price (untick to add it on top for the student)</label>
          </div>
          <div className="field"><label htmlFor="cr-r">Reason for this change (kept in the audit log)</label><input id="cr-r" required value={f.reason} onChange={set('reason')} /></div>
          {preview && (
            <div className="preview-box">
              <div className="field" style={{ maxWidth: 220 }}><label htmlFor="cr-x">Try a price ₹</label><input id="cr-x" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
              <div className="stats">
                <Stat label="Student pays" value={rupees(preview.customer_total_paise)} />
                <Stat label="Platform fee" value={rupees(preview.platform_fee_paise)} />
                <Stat label="Gateway (est.)" value={rupees(preview.gateway_est_paise)} />
                <Stat label="Mentor receives" value={rupees(preview.mentor_net_paise)} />
                <Stat label="Platform keeps" value={rupees(preview.platform_net_paise)} />
              </div>
            </div>
          )}
          {msg && <p className="err" role="alert">{msg}</p>}
          <div className="actions"><button className="btn" type="submit">Save rule (starts now)</button><button type="button" className="ul" onClick={() => setF(null)}>Cancel</button></div>
        </form>
      )}
      {rules.loading && <Loading />}
      <div className="table-box"><table className="data">
        <thead><tr><th>Rule</th><th>Applies to</th><th>Fee</th><th>Gateway fee</th><th>Since</th><th /></tr></thead>
        <tbody>{active.map((r) => (
          <tr key={r.id}>
            <td>{r.name || '—'}<br /><span className="small muted">{r.reason}</span></td>
            <td className="small">{r.mentor_id ? name(r.mentor_id) : 'All mentors'} · {r.service_type || 'all types'}</td>
            <td className="small">{bpsToPct(r.percentage_bps)}{r.fixed_fee_paise ? ` + ${rupees(r.fixed_fee_paise)}` : ''}{r.min_fee_paise ? ` · min ${rupees(r.min_fee_paise)}` : ''}{r.max_fee_paise != null ? ` · max ${rupees(r.max_fee_paise)}` : ''} · {r.fee_included ? 'inside price' : 'added on top'}</td>
            <td className="small">{r.gateway_fee_bearer}</td><td className="small">{fmtDate(r.effective_from)}</td>
            <td><span className="actions" style={{ flexWrap: 'nowrap' }}>
              <button type="button" className="ul small" onClick={() => setF({ ...BLANK_RULE, name: r.name, service_type: r.service_type || '', mentor_id: r.mentor_id || '', percentage: String(r.percentage_bps / 100), fixed: String((r.fixed_fee_paise || 0) / 100), min: String((r.min_fee_paise || 0) / 100), max: r.max_fee_paise == null ? '' : String(r.max_fee_paise / 100), gateway_fee_bearer: r.gateway_fee_bearer, fee_included: r.fee_included, replaces: r.id })}>Replace</button>
              <button type="button" className="ul small" onClick={async () => { const why = window.prompt('Why end this rule?'); if (why) { await platform.endCommissionRule(r.id, why); rules.reload(); } }}>End</button>
            </span></td>
          </tr>
        ))}</tbody>
      </table></div>
      {past.length > 0 && <details><summary className="small">Past rules ({past.length})</summary>{past.map((r) => <p key={r.id} className="small muted mt-8">{r.name || '—'} · {bpsToPct(r.percentage_bps)} · {fmtDate(r.effective_from)} → {fmtDate(r.effective_to)} · {r.reason}</p>)}</details>}
    </section>
  );
}
