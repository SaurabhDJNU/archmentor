import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from './api.js';
import { useAuth } from './auth.jsx';
import { dateParts, fmtDate, fmtSessionTime, useLoad, useTitle } from './util.js';
import { ErrorMsg, Loading } from './Bits.jsx';

const isUpcoming = (s) => !s.starts_at || new Date(s.starts_at) > new Date();
const sessionPath = (s) => `/sessions/${s.slug || s.id}`;

function useSeats(s, tick) {
  const [taken, setTaken] = useState(null);
  useEffect(() => { api.seatCount(s.id).then(setTaken).catch(() => {}); }, [s.id, tick]);
  return taken;
}

function SeatMeter({ s, taken }) {
  if (!s.capacity || taken === null) return null;
  const left = Math.max(0, s.capacity - taken);
  return (
    <div style={{ minWidth: 180 }}>
      <p className="small" style={{ textAlign: 'right' }}>{left ? `${left} of ${s.capacity} seats available` : 'Fully booked'}</p>
      <div className="meter" role="img" aria-label={`${taken} of ${s.capacity} seats taken`}><span style={{ width: `${Math.min(100, (taken / s.capacity) * 100)}%` }} /></div>
    </div>
  );
}

function SessionRow({ s }) {
  const taken = useSeats(s, 0);
  const d = dateParts(s.starts_at);
  const full = s.capacity && taken !== null && taken >= s.capacity;
  return (
    <article className="session-row">
      <div className="date"><p className="small" style={{ letterSpacing: '.08em' }}>{d.month}</p><p className="day">{d.day}</p><p className="small muted">{fmtSessionTime(s.starts_at, s.ends_at).split(' · ')[1] || ''}</p></div>
      <div style={{ minWidth: 0 }}>
        {s.kind && <span className="chip">{s.kind}</span>}
        <h3 className="mt-8" style={{ fontSize: 22, fontWeight: 400 }}><Link to={sessionPath(s)}>{s.title}</Link></h3>
        {s.subtitle && <p className="mt-8" style={{ color: 'var(--ink-2)' }}>{s.subtitle}</p>}
        <p className="small muted mt-8">{[s.platform || 'Online', 'Free', s.host_name && `with ${s.host_name}`].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="stack gap-8" style={{ alignItems: 'flex-end' }}>
        <SeatMeter s={s} taken={taken} />
        <Link to={sessionPath(s)} className={full ? 'btn-ghost' : 'btn'}>{full ? 'View details' : 'Reserve my seat'}</Link>
        <span className="small muted">Free registration{s.capacity ? ' · Limited seats' : ''}</span>
      </div>
    </article>
  );
}

export default function Sessions() {
  useTitle('Live sessions');
  const { data, error, loading } = useLoad(api.listSessions);
  const upcoming = (data || []).filter(isUpcoming);
  const past = (data || []).filter((s) => !isUpcoming(s)).reverse();

  return (
    <div className="wrap page-top">
      <p className="label" style={{ marginBottom: 24 }}>Live sessions</p>
      <h1 className="h-xl" style={{ maxWidth: '18ch' }}>Learn the practice, not just the theory.</h1>
      <p className="lead mt-24" style={{ maxWidth: '56ch' }}>Live talks, workshops and guidance sessions led by experienced architects, educators and mentors.</p>
      {loading && <Loading />}
      <ErrorMsg error={error} />
      <section className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink)', paddingBottom: 12 }}>
          <h2 className="h-m">Upcoming</h2><span className="small muted">{upcoming.length} session{upcoming.length === 1 ? '' : 's'}</span>
        </div>
        {!loading && !upcoming.length && <p className="empty">No upcoming sessions right now. Subscribe on the home page to hear about the next one.</p>}
        {upcoming.map((s) => <SessionRow key={s.id} s={s} />)}
      </section>
      {past.length > 0 && (
        <section className="section">
          <h2 className="label" style={{ marginBottom: 16 }}>Past sessions</h2>
          <ul className="list-lines">{past.map((s) => <li key={s.id}><Link to={sessionPath(s)}>{s.title}</Link> <span className="muted">· {fmtDate(s.starts_at)}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}

export function SessionDetail() {
  const { key } = useParams();
  const { user, profile } = useAuth();
  const { data: s, error, loading } = useLoad(() => api.getSession(key), [key]);
  const [tick, setTick] = useState(0);
  const taken = useSeats(s || { id: '' }, tick);
  const [f, setF] = useState({ name: '', email: '' });
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const mine = useLoad(() => (user ? api.myRegistrations() : []), [user?.id, tick]);
  useTitle(s?.title || 'Live session');

  useEffect(() => { if (profile) setF({ name: profile.full_name || '', email: user?.email || profile.email || '' }); }, [profile, user]);

  if (loading) return <div className="wrap"><Loading /></div>;
  if (error) return <div className="wrap page-top"><ErrorMsg error={error} /></div>;
  if (!s) return <div className="wrap page-top"><p className="h-l">Session not found.</p><Link to="/sessions" className="ul link mt-24">All sessions</Link></div>;

  const upcoming = isUpcoming(s);
  const full = s.capacity && taken !== null && taken >= s.capacity;
  const reg = (mine.data || []).find((r) => r.session_id === s.id);
  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try {
      const r = await api.registerForSession({ session_id: s.id, ...f });
      setState({ status: 'done', msg: r.already ? 'You were already registered.' : 'Your seat is reserved. We emailed you the details, and we will send a reminder the day before.' });
      setTick((t) => t + 1);
    } catch (err) { setState({ status: 'error', msg: err.message }); }
  };

  let panel;
  if (!upcoming) panel = <p className="muted">This session has ended.</p>;
  else if (reg || state.status === 'done') panel = (
    <div className="stack gap-16">
      <p className="msg" role="status">{state.msg || 'You have a seat in this session. The joining link is in your confirmation email.'}</p>
      {reg && <button type="button" className="ul" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={async () => { if (window.confirm('Give up your seat?')) { await api.cancelRegistration(reg.id); setState({ status: 'idle', msg: '' }); setTick((t) => t + 1); } }}>Cancel my seat</button>}
    </div>
  );
  else if (full) panel = <p className="msg">This session is fully booked.</p>;
  else if (!user) panel = (
    <div className="stack gap-16">
      <p style={{ color: 'var(--ink-2)' }}>Sign in or create a free account to reserve your seat.</p>
      <div className="actions"><Link to={`/login?next=${sessionPath(s)}`} className="btn">Sign in</Link><Link to={`/signup?next=${sessionPath(s)}`} className="btn-ghost">Create free account</Link></div>
    </div>
  );
  else panel = (
    <form onSubmit={submit} className="stack gap-24">
      <div className="form-row">
        <div className="field"><label htmlFor="r-name">Name</label><input id="r-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></div>
        <div className="field"><label htmlFor="r-email">Email for the joining link</label><input id="r-email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></div>
      </div>
      {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
      <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Reserving…' : 'Reserve my seat'}</button>
    </form>
  );

  return (
    <div className="wrap page-top">
      <Link to="/sessions" className="muted small">← All sessions</Link>
      <div className="split mt-32" style={{ gap: 56 }}>
        <div style={{ flex: '2 1 520px', minWidth: 0 }}>
          {s.kind && <span className="chip">{s.kind}</span>}
          <h1 className="h-xl mt-16" style={{ maxWidth: '18ch' }}>{s.title}</h1>
          {s.subtitle && <p className="lead mt-16">{s.subtitle}</p>}
          <dl className="facts">
            <div><dt>When</dt><dd>{fmtSessionTime(s.starts_at, s.ends_at)}</dd></div>
            <div><dt>Where</dt><dd>{s.platform || 'Online'}</dd></div>
            <div><dt>Registration</dt><dd>Free</dd></div>
            {s.host_name && <div><dt>Host</dt><dd>{s.host_name}</dd></div>}
          </dl>
          {s.description && <p className="mt-32" style={{ fontSize: 18, lineHeight: 1.7, whiteSpace: 'pre-line', maxWidth: '62ch' }}>{s.description}</p>}
        </div>
        <aside style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="panel stack gap-16">
            <SeatMeter s={s} taken={taken} />
            <p className="h-m">Reserve your seat</p>
            {panel}
          </div>
        </aside>
      </div>
    </div>
  );
}
