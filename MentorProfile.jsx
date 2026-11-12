import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from './api.js';
import { useAuth } from './auth.jsx';
import { SERVICES, initials, useLoad, useTitle } from './util.js';
import { Arrow, ErrorMsg, Loading } from './Bits.jsx';

function RequestForm({ mentor }) {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({ service: mentor.specialties?.[0] || 'portfolio', stage: profile?.stage || '', message: '', preferred_time: '' });
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (!user) {
    return (
      <div className="panel">
        <p className="h-m">Request a session with {mentor.full_name}</p>
        <p style={{ color: 'var(--ink-2)', margin: '8px 0 20px' }}>Create a free student account or log in to send a request.</p>
        <div className="actions">
          <Link to={`/signup?next=/mentors/${mentor.id}`} className="btn">Create account</Link>
          <Link to={`/login?next=/mentors/${mentor.id}`} className="ul">Log in</Link>
        </div>
      </div>
    );
  }
  if (profile?.role !== 'student') {
    return <div className="panel"><p style={{ color: 'var(--ink-2)' }}>Session requests are sent from student accounts.</p></div>;
  }
  if (state.status === 'done') {
    return (
      <div className="panel">
        <p className="h-m">Request sent.</p>
        <p style={{ color: 'var(--ink-2)', margin: '8px 0 20px' }}>{mentor.full_name} will review it. You can follow its status on your dashboard.</p>
        <Link to="/dashboard" className="ul link row">Go to dashboard <Arrow /></Link>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try { await api.createRequest({ mentor_id: mentor.id, ...form }); setState({ status: 'done', msg: '' }); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };

  return (
    <form className="panel stack gap-24" onSubmit={submit}>
      <p className="h-m">Request a session</p>
      <div className="form-row">
        <div className="field">
          <label htmlFor="rq-service">Service</label>
          <select id="rq-service" value={form.service} onChange={set('service')}>
            {Object.entries(SERVICES).map(([id, s]) => <option key={id} value={id}>{s.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rq-stage">Your year or stage</label>
          <input id="rq-stage" value={form.stage} onChange={set('stage')} placeholder="e.g. 4th year B.Arch" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="rq-msg">What would you like help with?</label>
        <textarea id="rq-msg" required minLength={20} value={form.message} onChange={set('message')} />
      </div>
      <div className="field">
        <label htmlFor="rq-time">Times that suit you</label>
        <input id="rq-time" value={form.preferred_time} onChange={set('preferred_time')} placeholder="e.g. weekday evenings after 6 pm" />
      </div>
      {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
      <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Sending…' : 'Send request'}</button>
    </form>
  );
}

export default function MentorProfile() {
  const { id } = useParams();
  const { data: m, error, loading } = useLoad(() => api.getMentor(id), [id]);
  useTitle(m?.full_name || 'Mentor');

  if (loading) return <div className="wrap"><Loading /></div>;
  if (error) return <div className="wrap page-top"><ErrorMsg error={error} /></div>;
  if (!m) return <div className="wrap page-top"><p className="h-l">Mentor not found.</p><Link to="/mentors" className="ul link mt-24">All mentors</Link></div>;

  return (
    <div className="wrap page-top">
      <Link to="/mentors" className="muted small">← All mentors</Link>
      <div className="split mt-32" style={{ gap: 48 }}>
        <div style={{ flex: '1 1 280px', maxWidth: 420 }}>
          <span className="portrait" aria-hidden="true">{m.photo_url ? <img src={m.photo_url} alt="" /> : initials(m.full_name)}</span>
        </div>
        <div style={{ flex: '2 1 480px', minWidth: 0 }}>
          <h1 className="h-xl">{m.full_name}</h1>
          <p className="lead mt-8">{[m.title, m.organisation].filter(Boolean).join(', ')}</p>
          {!m.approved && <p className="status pending" style={{ display: 'inline-block', marginTop: 16 }}>Awaiting approval</p>}
          {m.bio && <p className="prose mt-32" style={{ whiteSpace: 'pre-line' }}>{m.bio}</p>}
          {!!m.specialties?.length && (
            <dl className="facts">
              <div><dt>Helps with</dt><dd>{m.specialties.map((s) => SERVICES[s]?.title).filter(Boolean).join(', ')}</dd></div>
              {m.linkedin_url && <div><dt>Profile</dt><dd><a className="ul" href={m.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn</a></dd></div>}
            </dl>
          )}
          <div className="mt-48"><RequestForm mentor={m} /></div>
        </div>
      </div>
    </div>
  );
}
