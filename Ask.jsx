import { useState } from 'react';
import * as api from './api.js';
import { fmtDate, useLoad, useTitle } from './util.js';
import Markdown from './Markdown.jsx';
import { ErrorMsg, Loading } from './Bits.jsx';

function AskForm() {
  const [f, setF] = useState({ name: '', stage: '', question: '', show_name: false });
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try { await api.askQuestion(f); setState({ status: 'done', msg: '' }); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  if (state.status === 'done') return <p className="msg" role="status">Thank you. Selected questions are answered on this page.</p>;
  return (
    <form onSubmit={submit} className="stack gap-24">
      <div className="form-row">
        <div className="field"><label htmlFor="a-name">Name</label><input id="a-name" value={f.name} onChange={set('name')} autoComplete="name" /></div>
        <div className="field"><label htmlFor="a-stage">Year or stage</label><input id="a-stage" value={f.stage} onChange={set('stage')} placeholder="e.g. 4th year B.Arch" /></div>
      </div>
      <div className="field"><label htmlFor="a-q">Your question</label><textarea id="a-q" required minLength={10} value={f.question} onChange={set('question')} /></div>
      <label className="check"><input type="checkbox" checked={f.show_name} onChange={set('show_name')} /> Show my first name with the answer</label>
      {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
      <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Sending…' : 'Send question'}</button>
    </form>
  );
}

export default function Ask() {
  useTitle('Ask a mentor');
  const { data, error, loading } = useLoad(api.listAnsweredQuestions);
  return (
    <div className="wrap page-top">
      <p className="label" style={{ marginBottom: 24 }}>Ask a mentor</p>
      <div className="split" style={{ gap: 64 }}>
        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
          <h1 className="h-xl" style={{ maxWidth: '12ch' }}>Stuck on something? Ask it here.</h1>
          <p className="lead mt-24" style={{ maxWidth: '44ch' }}>Portfolios, juries, internships, admissions. A mentor answers selected questions in public, so others learn too. Your name is only shown if you allow it.</p>
        </div>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}><AskForm /></div>
      </div>

      <section className="section">
        <h2 className="label" style={{ marginBottom: 24 }}>Answered</h2>
        {loading && <Loading />}
        <ErrorMsg error={error} />
        {!loading && !data?.length && <p className="empty">The first answers will appear here.</p>}
        {(data || []).map((q) => (
          <div key={q.id} className="card-line split" style={{ gap: 32 }}>
            <div style={{ flex: '1 1 220px' }} className="small muted">
              {[q.show_name && q.name, q.stage].filter(Boolean).join(', ') || 'Anonymous'}<br />{fmtDate(q.created_at)}
            </div>
            <div style={{ flex: '4 1 560px', minWidth: 0 }}>
              <p className="h-m">{q.question}</p>
              <div className="prose mt-16" style={{ fontSize: 16 }}><Markdown text={q.answer} /></div>
              {q.answered_by && <p className="small muted">Answered by {q.answered_by}</p>}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
