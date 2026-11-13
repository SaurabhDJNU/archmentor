import { useEffect, useMemo, useState } from 'react';
import * as platform from './platform.js';
import { buildSlots, fmtDay, fmtSlot } from './slots.js';
import { rupees } from './money.js';
import { fmtDate, useLoad } from './util.js';
import { ErrorMsg, Loading } from './Bits.jsx';
import { Stat, Status } from './Ui.jsx';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Free slots for the next two weeks (India time)
export function SlotPicker({ mentorId, durationMin = 60, value, onPick }) {
  const [state, setState] = useState({ loading: true, days: [], error: null });
  useEffect(() => {
    let live = true;
    const from = new Date(); const to = new Date(Date.now() + 15 * 86400000);
    Promise.all([platform.mentorAvailability(mentorId), platform.mentorBusy(mentorId, from, to)])
      .then(([availability, busy]) => live && setState({ loading: false, days: buildSlots({ availability, busy, durationMin, from }), hasHours: availability.length > 0 }))
      .catch((error) => live && setState({ loading: false, days: [], error }));
    return () => { live = false; };
  }, [mentorId, durationMin]);
  const [day, setDay] = useState(0);
  if (state.loading) return <Loading />;
  if (state.error) return <ErrorMsg error={state.error} />;
  if (!state.days.length) return <p className="small muted">{state.hasHours ? 'No free slots in the next two weeks.' : 'This mentor has not published bookable hours yet — send a request with times that suit you.'}</p>;
  const d = state.days[Math.min(day, state.days.length - 1)];
  return (
    <div className="stack gap-16">
      <p className="small muted">Times are India Standard Time.</p>
      <div className="slot-days" role="group" aria-label="Day">
        {state.days.map((x, i) => <button key={i} type="button" className="choice" aria-pressed={i === day} onClick={() => setDay(i)}>{fmtDay(x.date)}</button>)}
      </div>
      <div className="slot-grid" role="group" aria-label="Time">
        {d.slots.map((t) => <button key={+t} type="button" className="choice" aria-pressed={value === t.toISOString()} onClick={() => onPick(t.toISOString())}>{fmtSlot(t)}</button>)}
      </div>
    </div>
  );
}

export function AvailabilityEditor() {
  const { data: profileAvail, loading, reload } = useLoad(async () => {
    const p = await platform.myTimeOff();
    return p;
  });
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState('');
  const [off, setOff] = useState({ starts_at: '', ends_at: '', note: '' });
  useEffect(() => {
    (async () => {
      const { getUser } = await import('./api.js');
      const u = await getUser();
      setRows((await platform.mentorAvailability(u.id)).map((r) => ({ ...r, start_time: String(r.start_time).slice(0, 5), end_time: String(r.end_time).slice(0, 5) })));
    })();
  }, []);
  if (!rows || loading) return <Loading />;
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <section className="stack gap-32">
      <form className="stack gap-16" onSubmit={async (e) => {
        e.preventDefault(); setMsg('');
        try { await platform.saveAvailability(rows); setMsg('Saved. Students now see these hours on your booking page.'); } catch (err) { setMsg(err.message); }
      }}>
        <h2 className="h-m">Weekly hours</h2>
        <p className="small muted">Students pick a slot inside these hours (India time). Booked slots and time off are hidden automatically, and nobody can book the same slot twice.</p>
        {!rows.length && <p className="empty">No hours yet. Add a block, for example Monday 6–9 pm.</p>}
        {rows.map((r, i) => (
          <div key={i} className="form-row" style={{ alignItems: 'end' }}>
            <div className="field"><label htmlFor={`av-d-${i}`}>Day</label><select id={`av-d-${i}`} value={r.weekday} onChange={(e) => set(i, 'weekday', Number(e.target.value))}>{DAYS.map((d, k) => <option key={d} value={k}>{d}</option>)}</select></div>
            <div className="field"><label htmlFor={`av-s-${i}`}>From</label><input id={`av-s-${i}`} type="time" value={r.start_time} onChange={(e) => set(i, 'start_time', e.target.value)} required /></div>
            <div className="field"><label htmlFor={`av-e-${i}`}>To</label><input id={`av-e-${i}`} type="time" value={r.end_time} onChange={(e) => set(i, 'end_time', e.target.value)} required /></div>
            <div className="field"><label htmlFor={`av-m-${i}`}>Slots every</label><select id={`av-m-${i}`} value={r.slot_minutes} onChange={(e) => set(i, 'slot_minutes', Number(e.target.value))}>{[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</select></div>
            <button type="button" className="ul" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <div className="actions">
          <button type="button" className="ul" onClick={() => setRows([...rows, { weekday: 1, start_time: '18:00', end_time: '21:00', slot_minutes: 60 }])}>Add a block</button>
          <button type="submit" className="btn">Save hours</button>
          {msg && <span className="small" role="status">{msg}</span>}
        </div>
      </form>

      <div className="stack gap-16">
        <h2 className="h-m">Time off</h2>
        <form className="form-row" style={{ alignItems: 'end' }} onSubmit={async (e) => {
          e.preventDefault(); setMsg('');
          try { await platform.addTimeOff(off); setOff({ starts_at: '', ends_at: '', note: '' }); reload(); } catch (err) { setMsg(err.message); }
        }}>
          <div className="field"><label htmlFor="to-s">From</label><input id="to-s" type="datetime-local" required value={off.starts_at} onChange={(e) => setOff({ ...off, starts_at: e.target.value })} /></div>
          <div className="field"><label htmlFor="to-e">To</label><input id="to-e" type="datetime-local" required value={off.ends_at} onChange={(e) => setOff({ ...off, ends_at: e.target.value })} /></div>
          <div className="field"><label htmlFor="to-n">Note (private)</label><input id="to-n" value={off.note} onChange={(e) => setOff({ ...off, note: e.target.value })} /></div>
          <button type="submit" className="btn">Add</button>
        </form>
        {(profileAvail || []).map((t) => (
          <div key={t.id} className="card-line" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>{fmtDate(t.starts_at, true)} → {fmtDate(t.ends_at, true)} {t.note && <span className="muted">· {t.note}</span>}</span>
            <button type="button" className="ul" onClick={async () => { await platform.deleteTimeOff(t.id); reload(); }}>Remove</button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Earnings() {
  const { data, error, loading } = useLoad(platform.myEarnings);
  const rows = useMemo(() => data?.orders || [], [data]);
  if (loading) return <Loading />;
  if (error) return <ErrorMsg error={error} />;
  return (
    <section className="stack gap-24">
      <h2 className="h-m">Earnings</h2>
      <div className="stats">
        <Stat label="Waiting for session" value={rupees(data.pending_completion)} note="Paid sessions not yet marked done" />
        <Stat label="On hold" value={rupees(data.on_hold)} note={`${data.hold_days}-day safety hold after the session`} />
        <Stat label="Ready for payout" value={rupees(data.ready)} />
        <Stat label="In payout" value={rupees(data.in_payout)} />
        <Stat label="Paid to you" value={rupees(data.paid_total)} />
      </div>
      <p className="small muted">Amounts are after the platform fee. Payouts are prepared and approved by two people on our team and sent by bank/UPI transfer; you get an email with the reference.</p>
      {rows.length > 0 && (
        <div className="table-box"><table className="data">
          <thead><tr><th>Booking</th><th>Price</th><th>You receive</th><th>Status</th><th>Payout</th></tr></thead>
          <tbody>{rows.map((o) => (
            <tr key={o.id}><td>{o.description}<br /><span className="small muted">{fmtDate(o.paid_at)}</span></td><td>{rupees(o.price_paise)}</td><td>{rupees(o.mentor_net_paise)}</td>
              <td><Status s={o.completed_at ? 'done' : 'pending'} label={o.completed_at ? 'done' : o.status} /></td><td>{o.payout_status.replace('_', ' ')}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      {(data.payouts || []).length > 0 && (
        <div className="stack gap-8"><p className="label">Payouts</p>
          {data.payouts.map((p) => <p key={p.id} className="small">{rupees(p.amount_paise)} · <Status s={p.status === 'paid' ? 'approved' : 'pending'} label={p.status} /> {p.reference && `· ref ${p.reference}`} {p.paid_at && `· ${fmtDate(p.paid_at)}`}</p>)}
        </div>
      )}
    </section>
  );
}

export function PayoutDetails() {
  const { data, loading, reload } = useLoad(platform.myFinance);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (data) setF(data); }, [data]);
  if (loading || !f) return null;
  return (
    <form className="panel stack gap-16 mt-48" style={{ maxWidth: 680 }} onSubmit={async (e) => {
      e.preventDefault(); setMsg('');
      try { await platform.saveMyFinance(f); setMsg('Saved. Our finance team will verify it before your first payout.'); reload(); } catch (err) { setMsg(err.message); }
    }}>
      <p className="h-m">Payout details</p>
      <p className="small muted">For safety we never store full account numbers here. Send your bank details through the secure form our finance team emails you; here, keep a label you will recognise.</p>
      <div className="form-row">
        <div className="field"><label htmlFor="pf-m">Method</label><select id="pf-m" value={f.payout_method || ''} onChange={(e) => setF({ ...f, payout_method: e.target.value })}><option value="">Choose…</option><option value="upi">UPI</option><option value="bank">Bank transfer</option></select></div>
        <div className="field"><label htmlFor="pf-d">Label (e.g. “HDFC ••1234” or your UPI id)</label><input id="pf-d" value={f.payout_display || ''} onChange={(e) => setF({ ...f, payout_display: e.target.value })} /></div>
        <div className="field"><label htmlFor="pf-p">PAN — last 4 characters</label><input id="pf-p" maxLength={4} value={f.pan_last4 || ''} onChange={(e) => setF({ ...f, pan_last4: e.target.value.toUpperCase() })} /></div>
      </div>
      <p className="small">Verification: <Status s={f.kyc_status === 'verified' ? 'approved' : 'pending'} label={f.kyc_status?.replace('_', ' ')} /></p>
      <div className="actions"><button type="submit" className="btn">Save</button>{msg && <span className="small" role="status">{msg}</span>}</div>
    </form>
  );
}
