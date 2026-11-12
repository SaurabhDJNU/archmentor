import { useState } from 'react';
import * as api from './api.js';
import { useTitle } from './util.js';
import { CONTACT_EMAIL } from './config.js';

export default function Write() {
  useTitle('Write for the Journal');
  const [f, setF] = useState({ name: '', email: '', idea: '' });
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try { await api.submitStory(f); setState({ status: 'done', msg: '' }); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };

  return (
    <div className="wrap page-top">
      <p className="label" style={{ marginBottom: 24 }}>Write for the Journal</p>
      <div className="split" style={{ gap: 64 }}>
        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
          <h1 className="h-xl" style={{ maxWidth: '14ch' }}>Share what you learned.</h1>
          <p className="lead mt-24" style={{ maxWidth: '44ch' }}>Students and architects are welcome to write for us: a lesson from a jury, an internship, a site visit or a building you keep going back to. Send a short idea first; we will reply before you write the full piece.</p>
          {CONTACT_EMAIL && <p className="mt-24" style={{ color: 'var(--ink-2)' }}>You can also email <a className="ul" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>}
        </div>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          {state.status === 'done' ? (
            <p className="msg" role="status">Thank you. We have your idea and will reply by email.</p>
          ) : (
            <form onSubmit={submit} className="stack gap-24">
              <div className="form-row">
                <div className="field"><label htmlFor="w-name">Name</label><input id="w-name" required value={f.name} onChange={set('name')} autoComplete="name" /></div>
                <div className="field"><label htmlFor="w-email">Email</label><input id="w-email" type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></div>
              </div>
              <div className="field"><label htmlFor="w-idea">Your idea, in a few lines</label><textarea id="w-idea" required minLength={20} rows={6} value={f.idea} onChange={set('idea')} /></div>
              {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
              <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Sending…' : 'Send idea'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
