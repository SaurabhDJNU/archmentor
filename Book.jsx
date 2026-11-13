import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from './api.js';
import { useAuth } from './auth.jsx';
import { fmtPrice, initials, useLoad, useTitle } from './util.js';
import { Arrow, ErrorMsg, Loading } from './Bits.jsx';

export default function Book() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const { data: s, error, loading } = useLoad(() => api.getService(id), [id]);
  const [f, setF] = useState({ stage: '', message: '', preferred_time: '' });
  const [state, setState] = useState({ status: 'idle', msg: '' });
  useTitle(s ? `Book: ${s.title}` : 'Book a session');

  if (loading) return <div className="wrap"><Loading /></div>;
  if (error) return <div className="wrap page-top"><ErrorMsg error={error} /></div>;
  if (!s) return <div className="wrap page-top"><p className="h-l">This service is not available.</p><Link to="/mentors" className="ul link mt-24">Find a mentor</Link></div>;

  const m = s.mentor;
  const first = m.full_name.replace(/^Dr\.?\s+/, '').split(' ')[0];
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try { await api.createRequest({ service_id: s.id, mentor_id: m.id, stage: f.stage || profile?.stage || '', message: f.message, preferred_time: f.preferred_time }); setState({ status: 'done', msg: '' }); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };

  let panel;
  if (!user) {
    panel = (
      <div className="panel">
        <p className="small muted">Student account required</p>
        <p className="h-m mt-8">Sign in to request this session</p>
        <p className="mt-8" style={{ color: 'var(--ink-2)' }}>With a free student account you can request mentorship sessions, track approvals, schedule approved sessions and manage everything from your dashboard.</p>
        <div className="actions mt-24">
          <Link to={`/login?next=/book/${s.id}`} className="btn">Sign in</Link>
          <Link to={`/signup?next=/book/${s.id}`} className="btn-ghost">Create free account</Link>
        </div>
        <p className="small muted mt-16">Your request is only sent once you sign in and confirm it.</p>
      </div>
    );
  } else if (profile && profile.role !== 'student') {
    panel = <div className="panel"><p style={{ color: 'var(--ink-2)' }}>Session requests are made from <b>student</b> accounts. You are signed in as a {profile.role}.</p></div>;
  } else if (state.status === 'done') {
    panel = (
      <div className="panel">
        <p className="h-m">Request sent.</p>
        <p className="mt-8" style={{ color: 'var(--ink-2)' }}>We emailed you a copy. {m.full_name} has been notified and you will get an email as soon as they respond.</p>
        <Link to="/dashboard" className="ul link row mt-16">Track it on your dashboard <Arrow /></Link>
      </div>
    );
  } else {
    panel = (
      <form className="stack gap-24" onSubmit={submit}>
        <div className="field"><label htmlFor="b-stage">Your year or stage</label><input id="b-stage" value={f.stage} onChange={set('stage')} placeholder={profile?.stage || 'e.g. 4th year B.Arch'} /></div>
        <div className="field"><label htmlFor="b-msg">What would you like help with?</label><textarea id="b-msg" required minLength={20} rows={5} value={f.message} onChange={set('message')} placeholder={`Tell ${first} about your goal, your work so far and any questions.`} /></div>
        <div className="field"><label htmlFor="b-time">Times that usually suit you (optional)</label><input id="b-time" value={f.preferred_time} onChange={set('preferred_time')} placeholder="e.g. weekday evenings after 6 pm" /></div>
        {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
        <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Sending…' : 'Send request for approval'}</button>
        <p className="small muted">This only sends your request. You choose the meeting time after {first} accepts.{s.price_inr ? ' For paid sessions, the mentor shares payment details after approval.' : ''}</p>
      </form>
    );
  }

  return (
    <div className="wrap page-top">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Link to={`/mentors/${m.id}`} className="muted small">← Back to {m.full_name}’s profile</Link>
        <span className="small muted">Request approval before scheduling</span>
      </div>
      <div className="split mt-32" style={{ gap: 56 }}>
        <aside style={{ flex: '1 1 300px', maxWidth: 400 }} className="booking-summary">
          <p className="small muted">Booking summary</p>
          <p className="small muted mt-16" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.category}</p>
          <h1 className="h-m mt-8">{s.title}</h1>
          {s.description && <p className="mt-8" style={{ fontSize: 15, color: 'var(--ink-2)' }}>{s.description}</p>}
          <dl className="facts" style={{ marginTop: 24 }}>
            <div><dt>Duration</dt><dd>{s.duration_min} min</dd></div>
            <div><dt>Price</dt><dd>{fmtPrice(s.price_inr)}</dd></div>
            <div><dt>Format</dt><dd>Online</dd></div>
          </dl>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
            <span className="avatar" aria-hidden="true">{m.photo_url ? <img src={m.photo_url} alt="" /> : initials(m.full_name)}</span>
            <span className="stack"><span>{m.full_name}</span><span className="small muted">{m.title}</span></span>
          </div>
        </aside>
        <div style={{ flex: '2 1 460px', minWidth: 0, maxWidth: 640 }}>
          <p className="label">Request session</p>
          <h2 className="h-l mt-8">Confirm your mentorship request</h2>
          <p className="mt-16" style={{ color: 'var(--ink-2)' }}>Add any details you’d like {first} to know.</p>
          <div className="mt-32">{panel}</div>
        </div>
      </div>
    </div>
  );
}
