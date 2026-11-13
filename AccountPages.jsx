import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from './api.js';
import { useAuth } from './auth.jsx';
import { passwordProblems, useTitle } from './util.js';

function Shell({ label, title, children, aside }) {
  return (
    <div className="wrap page-top">
      <div className="split" style={{ gap: 64 }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <p className="label" style={{ marginBottom: 24 }}>{label}</p>
          <h1 className="h-xl" style={{ maxWidth: '12ch' }}>{title}</h1>
          {aside}
        </div>
        <div style={{ flex: '1 1 380px', minWidth: 0, maxWidth: 520 }}>{children}</div>
      </div>
    </div>
  );
}

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard');

export function Login() {
  useTitle('Log in');
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const next = safeNext(params.get('next'));
  if (user && state.status !== 'busy') return <Navigate to={next} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try { await api.signIn(f); navigate(next); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  return (
    <Shell label="Log in" title="Welcome back.">
      <form onSubmit={submit} className="stack gap-24">
        <div className="field"><label htmlFor="l-email">Email</label><input id="l-email" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label htmlFor="l-pass">Password</label><input id="l-pass" type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
        <div className="actions">
          <button type="submit" className="btn" disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Logging in…' : 'Log in'}</button>
          <Link to="/forgot-password" className="small muted">Forgot password?</Link>
        </div>
        <p className="small muted">New here? <Link to={`/signup${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="ul">Create an account</Link></p>
      </form>
    </Shell>
  );
}

const ROLE_CARDS = [
  ['student', 'Student', 'Find mentors, ask questions and join free sessions.'],
  ['mentor', 'Mentor', 'Guide architecture students through mentorship.'],
  ['professional', 'Professional', 'Join the community as an architect, educator or industry professional.'],
];

function PasswordField({ id, label, value, onChange, show, setShow, auto }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--ink)' }}>
        <input id={id} type={show ? 'text' : 'password'} required autoComplete={auto} value={value} onChange={onChange} style={{ flex: 1, borderBottom: 0 }} />
        <button type="button" className="small muted" style={{ minHeight: 44, padding: '0 4px' }} onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
      </div>
    </div>
  );
}

export function Signup() {
  useTitle('Create account');
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initial = ['mentor', 'professional'].includes(params.get('role')) ? params.get('role') : 'student';
  const [role, setRole] = useState(initial);
  const [f, setF] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const next = safeNext(params.get('next'));
  if (user && state.status === 'idle') return <Navigate to={next} replace />;

  const problems = passwordProblems(f.password);
  const mismatch = f.confirm && f.confirm !== f.password;
  const submit = async (e) => {
    e.preventDefault();
    if (problems.length) { setState({ status: 'error', msg: `Your password needs ${problems.join(', ')}.` }); return; }
    if (f.confirm !== f.password) { setState({ status: 'error', msg: 'The two passwords do not match.' }); return; }
    setState({ status: 'busy', msg: '' });
    try {
      const r = await api.signUp({ full_name: f.full_name.trim(), email: f.email.trim(), password: f.password, role });
      if (r.needsConfirmation) setState({ status: 'confirm', msg: '' });
      else navigate(role === 'mentor' ? '/dashboard' : next);
    } catch (err) { setState({ status: 'error', msg: err.message }); }
  };

  if (state.status === 'confirm') {
    return (
      <Shell label="Create account" title="Check your email.">
        <p className="lead">We sent a confirmation link to <b>{f.email}</b>. Open it to finish creating your account{role === 'mentor' ? ', then complete your mentor profile' : ''}.</p>
        <p className="mt-24 small muted">No email after a few minutes? Check your spam folder, or <button type="button" className="ul" onClick={async () => { try { await api.resendConfirmation(f.email); window.alert('Sent again.'); } catch (err) { window.alert(err.message); } }}>send it again</button>.</p>
      </Shell>
    );
  }
  const button = { student: 'Create student account', mentor: 'Create mentor account', professional: 'Create professional account' }[role];
  return (
    <Shell
      label="Get started"
      title="Join ArchMentor."
      aside={<p className="lead mt-24" style={{ maxWidth: '40ch' }}>{role === 'mentor' ? 'After you sign up, complete your profile and add your services. An admin reviews it before you appear in the mentor directory.' : 'One account for mentorship, community, live sessions and architecture resources.'}</p>}
    >
      <form onSubmit={submit} className="stack gap-24">
        <div className="field"><label htmlFor="s-name">Full name</label><input id="s-name" required autoComplete="name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="field"><label htmlFor="s-email">Email address</label><input id="s-email" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <PasswordField id="s-pass" label="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} show={show} setShow={setShow} auto="new-password" />
        <ul className="pw-rules small" aria-live="polite">
          {[['at least 8 characters', 'At least 8 characters'], ['one uppercase letter', 'One uppercase letter'], ['one number', 'One number']].map(([k, label]) => (
            <li key={k} className={f.password && !problems.includes(k) ? 'met' : ''}>{f.password && !problems.includes(k) ? '✓' : '○'} {label}</li>
          ))}
        </ul>
        <PasswordField id="s-confirm" label="Confirm password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} show={show} setShow={setShow} auto="new-password" />
        {mismatch && <p className="err">The passwords do not match yet.</p>}
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small muted" style={{ marginBottom: 10 }}>I am joining as</legend>
          <div className="role-cards">
            {ROLE_CARDS.map(([id, title, text]) => (
              <button key={id} type="button" className="role-card" aria-pressed={role === id} onClick={() => setRole(id)}>
                <span style={{ fontSize: 17 }}>{role === id ? '✓ ' : ''}{title}</span>
                <span className="small muted">{text}</span>
              </button>
            ))}
          </div>
          {role === 'professional' && <p className="small muted mt-8">Professionals take part in the community and live sessions without registering as mentors.</p>}
        </fieldset>
        {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
        <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Creating…' : button}</button>
        <p className="small muted">Already have an account? <Link to={`/login${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="ul">Log in</Link></p>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  useTitle('Reset password');
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try { await api.sendPasswordReset(email); setState({ status: 'done', msg: '' }); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  return (
    <Shell label="Reset password" title="Forgot your password?">
      {state.status === 'done' ? <p className="msg" role="status">If an account exists for {email}, a reset link is on its way.</p> : (
        <form onSubmit={submit} className="stack gap-24">
          <div className="field"><label htmlFor="f-email">Email</label><input id="f-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
          <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>Send reset link</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  useTitle('Choose a new password');
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const submit = async (e) => {
    e.preventDefault();
    const problems = passwordProblems(pw);
    if (problems.length) { setState({ status: 'error', msg: `Your password needs ${problems.join(', ')}.` }); return; }
    setState({ status: 'busy', msg: '' });
    try { await api.updatePassword(pw); navigate('/dashboard'); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  return (
    <Shell label="Reset password" title="Choose a new password.">
      <form onSubmit={submit} className="stack gap-24">
        <div className="field"><label htmlFor="r-pass">New password (8+ characters, one uppercase letter, one number)</label><input id="r-pass" type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
        <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>Save password</button>
      </form>
    </Shell>
  );
}
