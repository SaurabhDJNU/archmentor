import { useEffect, useState } from 'react';
import * as api from './api.js';
import { useAuth } from './auth.jsx';
import { fmtDate, useLoad, useTitle } from './util.js';
import { ErrorMsg, Loading, SessionCard } from './Bits.jsx';

function Register({ s }) {
  const { profile, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [seats, setSeats] = useState(null);
  const [state, setState] = useState({ status: 'idle', msg: '' });

  useEffect(() => { if (profile) { setName(profile.full_name || ''); setEmail(user?.email || profile.email || ''); } }, [profile, user]);
  useEffect(() => { api.seatCount(s.id).then(setSeats).catch(() => {}); }, [s.id, state.status]);

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try {
      const r = await api.registerForSession({ session_id: s.id, name, email });
      setState({ status: 'done', msg: r.already ? 'You were already registered with this email.' : 'Your seat is reserved. Joining details will be sent to your email before the session.' });
    } catch (err) { setState({ status: 'error', msg: err.message }); }
  };

  if (state.status === 'done') return <p className="msg mt-32" role="status">{state.msg}</p>;
  return (
    <form onSubmit={submit} className="stack gap-24 mt-32" style={{ maxWidth: 640 }}>
      <div className="form-row">
        <div className="field"><label htmlFor={`n-${s.id}`}>Name</label><input id={`n-${s.id}`} required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
        <div className="field"><label htmlFor={`e-${s.id}`}>Email</label><input id={`e-${s.id}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
      </div>
      {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
      <div className="actions">
        <button type="submit" className="btn" disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Reserving…' : 'Reserve my seat'}</button>
        {seats > 0 && <span className="small muted">{seats} registered so far</span>}
      </div>
    </form>
  );
}

export default function Sessions() {
  useTitle('Live sessions');
  const { data, error, loading } = useLoad(api.listSessions);
  const now = new Date();
  const upcoming = (data || []).filter((s) => !s.starts_at || new Date(s.starts_at) > now);
  const past = (data || []).filter((s) => s.starts_at && new Date(s.starts_at) <= now).reverse();

  return (
    <div className="wrap page-top">
      <p className="label" style={{ marginBottom: 24 }}>Live sessions</p>
      <h1 className="h-xl" style={{ maxWidth: '18ch' }}>Free talks and open discussions, online.</h1>
      {loading && <Loading />}
      <ErrorMsg error={error} />
      {!loading && !upcoming.length && <p className="empty mt-48">No upcoming sessions right now. Subscribe on the home page to hear about the next one.</p>}
      {upcoming.map((s) => (
        <section key={s.id} className="section" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 64 }}>
          <SessionCard s={s} />
          <Register s={s} />
        </section>
      ))}
      {past.length > 0 && (
        <section className="section">
          <h2 className="label" style={{ marginBottom: 16 }}>Past sessions</h2>
          <ul className="list-lines">{past.map((s) => <li key={s.id}>{s.title} <span className="muted">· {fmtDate(s.starts_at)}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
