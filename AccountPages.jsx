import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from './api.js';
import { useAuth } from './auth.jsx';
import { useTitle } from './util.js';

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

export function Signup() {
  useTitle('Create account');
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [role, setRole] = useState(params.get('role') === 'mentor' ? 'mentor' : 'student');
  const [f, setF] = useState({ full_name: '', email: '', password: '' });
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const next = safeNext(params.get('next'));
  if (user && state.status === 'idle') return <Navigate to={next} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try {
      const r = await api.signUp({ ...f, role });
      if (r.needsConfirmation) setState({ status: 'confirm', msg: '' });
      else navigate(next);
    } catch (err) { setState({ status: 'error', msg: err.message }); }
  };

  if (state.status === 'confirm') {
    return (
      <Shell label="Create account" title="Check your email.">
        <p className="lead">We sent a confirmation link to <b>{f.email}</b>. Open it to finish creating your account.</p>
      </Shell>
    );
  }
  return (
    <Shell
      label="Create account"
      title={role === 'mentor' ? 'Mentor a student.' : 'Start your journey.'}
      aside={role === 'mentor' && <p className="lead mt-24" style={{ maxWidth: '40ch' }}>After you sign up, complete your profile. An admin reviews it before you appear in the mentor list.</p>}
    >
      <div className="choice-row" role="group" aria-label="Account type" style={{ marginBottom: 32 }}>
        <button type="button" className="choice" aria-pressed={role === 'student'} onClick={() => setRole('student')}>I am a student</button>
        <button type="button" className="choice" aria-pressed={role === 'mentor'} onClick={() => setRole('mentor')}>I want to mentor</button>
      </div>
      <form onSubmit={submit} className="stack gap-24">
        <div className="field"><label htmlFor="s-name">Full name</label><input id="s-name" required autoComplete="name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="field"><label htmlFor="s-email">Email</label><input id="s-email" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label htmlFor="s-pass">Password (at least 8 characters)</label><input id="s-pass" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
        <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Creating…' : role === 'mentor' ? 'Apply as a mentor' : 'Create student account'}</button>
        <p className="small muted">Already have an account? <Link to="/login" className="ul">Log in</Link></p>
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
    setState({ status: 'busy', msg: '' });
    try { await api.updatePassword(pw); navigate('/dashboard'); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  return (
    <Shell label="Reset password" title="Choose a new password.">
      <form onSubmit={submit} className="stack gap-24">
        <div className="field"><label htmlFor="r-pass">New password (at least 8 characters)</label><input id="r-pass" type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
        <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>Save password</button>
      </form>
    </Shell>
  );
}
