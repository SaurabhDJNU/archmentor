import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as platform from './platform.js';
import { useAuth } from './auth.jsx';
import { rupees } from './money.js';
import { fmtDate, useLoad, useTitle } from './util.js';
import { ErrorMsg, Loading } from './Bits.jsx';
import { Status } from './Ui.jsx';
import { PayButton } from './Checkout.jsx';
import ArchArt from './ArchArt.jsx';
import * as api from './api.js';

const STEP_LABEL = {
  draft: 'Draft', submitted: 'Waiting for a mentor', awaiting_payment: 'Waiting for payment', assigned: 'Mentor assigned',
  in_review: 'In review', feedback_ready: 'Feedback ready', revision_requested: 'Follow-up requested', completed: 'Completed', cancelled: 'Cancelled',
};
const STEPS = ['draft', 'submitted', 'assigned', 'in_review', 'feedback_ready', 'completed'];

function Steps({ status }) {
  const at = STEPS.indexOf(status === 'awaiting_payment' ? 'draft' : status === 'revision_requested' ? 'in_review' : status);
  return (
    <ol className="steps" aria-label="Progress">
      {STEPS.map((s, i) => <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>{STEP_LABEL[s]}</li>)}
    </ol>
  );
}

// Public landing + the signed-in student's list
export function PortfolioHome() {
  useTitle('Portfolio reviews');
  const { user, profile } = useAuth();
  const types = useLoad(() => platform.reviewTypes());
  return (
    <div className="wrap page-top">
      <div className="hero-split">
        <div>
          <p className="label">Portfolio review studio</p>
          <h1 className="h-xl">Get your portfolio read by a practising architect.</h1>
          <p className="lead mt-24" style={{ maxWidth: '52ch' }}>Upload your PDF, tell us what it is for — internships, jobs or a master’s application — and a verified mentor sends a scored review with clear next steps. Your files stay private: only you, your mentor and our review coordinator can open them.</p>
        </div>
        <ArchArt kind="section" />
      </div>
      <section className="mt-64">
        <p className="label">Review types</p>
        {types.loading && <Loading />}
        <div className="grid-2 mt-16">
          {(types.data || []).map((t) => (
            <div key={t.id} className="panel stack gap-8">
              <p className="h-m">{t.title}</p>
              <p className="muted">{t.description}</p>
              <p className="small">{t.price_paise ? rupees(t.price_paise) : 'Free'} · reply within {t.turnaround_days} days · one follow-up round</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-64">
        {!user && <p className="lead"><Link className="ul" to="/signup?next=/portfolio">Create a free student account</Link> or <Link className="ul" to="/login?next=/portfolio">log in</Link> to start.</p>}
        {user && profile?.role === 'student' && <MyPortfolios />}
        {user && profile && profile.role !== 'student' && <p className="muted">Portfolio reviews are requested from student accounts. Mentors see their assigned reviews in the dashboard.</p>}
      </section>
    </div>
  );
}

export function MyPortfolios({ mentor }) {
  const { data, error, loading } = useLoad(platform.listPortfolios);
  const types = useLoad(() => (mentor ? [] : platform.reviewTypes()));
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ review_type_id: '', title: '', brief: '', target: 'Internship' });
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();
  if (loading) return <Loading />;
  return (
    <section className="stack gap-16">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <h2 className="h-m">{mentor ? 'Portfolios assigned to you' : 'My portfolio reviews'}</h2>
        {!mentor && !creating && <button type="button" className="btn" onClick={() => setCreating(true)}>Start a review</button>}
      </div>
      {creating && (
        <form className="panel stack gap-16" onSubmit={async (e) => {
          e.preventDefault(); setMsg('');
          try { const id = await platform.createPortfolio({ ...f, review_type_id: f.review_type_id || types.data?.[0]?.id }); navigate(`/portfolio/${id}`); } catch (err) { setMsg(err.message); }
        }}>
          <div className="field"><label htmlFor="pf-t">Review type</label>
            <select id="pf-t" value={f.review_type_id || types.data?.[0]?.id || ''} onChange={(e) => setF({ ...f, review_type_id: e.target.value })}>
              {(types.data || []).map((t) => <option key={t.id} value={t.id}>{t.title} — {t.price_paise ? rupees(t.price_paise) : 'Free'}</option>)}
            </select></div>
          <div className="form-row">
            <div className="field" style={{ flex: '2 1 280px' }}><label htmlFor="pf-title">Title</label><input id="pf-title" required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Internship portfolio 2027" /></div>
            <div className="field"><label htmlFor="pf-goal">It is for</label><select id="pf-goal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>{['Internship', 'Job', 'Master’s application', 'Competition', 'Other'].map((x) => <option key={x}>{x}</option>)}</select></div>
          </div>
          <div className="field"><label htmlFor="pf-brief">What should the mentor focus on?</label><textarea id="pf-brief" rows={3} value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} placeholder="Offices you are applying to, worries about layout, which projects to keep…" /></div>
          {msg && <p className="err" role="alert">{msg}</p>}
          <div className="actions"><button className="btn" type="submit">Create and add files</button><button type="button" className="ul" onClick={() => setCreating(false)}>Cancel</button></div>
        </form>
      )}
      <ErrorMsg error={error} />
      {!data?.length && !creating && <p className="empty">{mentor ? 'No portfolios assigned yet. Our coordinator assigns them and you get an email.' : 'No reviews yet.'}</p>}
      {(data || []).filter((p) => !mentor || p.assigned_mentor_id).map((p) => (
        <Link key={p.id} to={`/portfolio/${p.id}`} className="card-line hover-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span><span style={{ fontSize: 19 }}>{p.title}</span><br /><span className="small muted">{mentor ? p.student_name : (p.mentor_name ? `Mentor: ${p.mentor_name}` : p.target)} · {fmtDate(p.created_at)}{p.due_at ? ` · due ${fmtDate(p.due_at)}` : ''}</span></span>
          <Status s={['completed', 'feedback_ready'].includes(p.status) ? 'approved' : p.status === 'cancelled' ? 'declined' : 'pending'} label={STEP_LABEL[p.status]} />
        </Link>
      ))}
    </section>
  );
}

function FileList({ files, project, canDelete, onChange }) {
  const [err, setErr] = useState('');
  const open = async (f) => {
    setErr('');
    try { const url = await platform.portfolioFileUrl(f); window.open(url, '_blank', 'noopener'); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="stack gap-8">
      {!files.length && <p className="small muted">No files yet.</p>}
      {files.map((f) => (
        <div key={f.id} className="file-row">
          <button type="button" className="ul" onClick={() => open(f)}>{f.name}</button>
          <span className="small muted">{(f.size_bytes / 1048576).toFixed(1)} MB · {f.kind === 'feedback' ? 'from mentor' : 'submitted'} · {fmtDate(f.created_at)}</span>
          {canDelete && f.kind === 'submission' && project.status === 'draft' && <button type="button" className="ul small" onClick={async () => { await platform.deletePortfolioFile(f); onChange(); }}>Remove</button>}
        </div>
      ))}
      <p className="small faint">Files open through a private link that expires after two minutes.</p>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}

function Uploader({ project, onDone, label }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const add = async (list) => {
    setErr(''); setBusy(true);
    try { for (const f of list) await platform.uploadPortfolioFile(project, f); onDone(); } catch (e) { setErr(e.message); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  return (
    <div className="pf-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add([...e.dataTransfer.files]); }}>
      <p>{label || 'Drop PDF or images here'}</p>
      <p className="small muted">PDF, JPG, PNG or WebP · up to 25 MB each</p>
      <button type="button" className="btn mt-8" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : 'Choose files'}</button>
      <input ref={input} type="file" hidden multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => add([...e.target.files])} />
      {err && <p className="err mt-8" role="alert">{err}</p>}
    </div>
  );
}

function ReviewForm({ project, existing, onDone }) {
  const [r, setR] = useState({ rubric: existing?.rubric || {}, summary: existing?.summary || '', strengths: existing?.strengths || '', improvements: existing?.improvements || '' });
  const [msg, setMsg] = useState('');
  const save = async (submit) => {
    setMsg('');
    if (submit && !window.confirm('Send this review to the student? You cannot edit it afterwards.')) return;
    try { await platform.saveReview(project, r, submit); setMsg(submit ? 'Sent.' : 'Draft saved.'); onDone(); } catch (e) { setMsg(e.message); }
  };
  return (
    <form className="panel stack gap-16" onSubmit={(e) => { e.preventDefault(); save(true); }}>
      <p className="h-m">Your review {project.revisions_used ? `(follow-up round)` : ''}</p>
      <div className="rubric">
        {platform.RUBRIC.map((k) => (
          <div key={k} className="rubric-row" role="radiogroup" aria-label={k}>
            <span>{k}</span>
            <span className="rubric-scores">{[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} className="choice" aria-pressed={r.rubric[k] === n} onClick={() => setR({ ...r, rubric: { ...r.rubric, [k]: n } })}>{n}</button>
            ))}</span>
          </div>
        ))}
        <p className="small faint">1 = needs a lot of work · 5 = ready to send</p>
      </div>
      <div className="field"><label htmlFor="rv-s">Summary</label><textarea id="rv-s" rows={4} value={r.summary} onChange={(e) => setR({ ...r, summary: e.target.value })} /></div>
      <div className="form-row">
        <div className="field"><label htmlFor="rv-st">What works</label><textarea id="rv-st" rows={4} value={r.strengths} onChange={(e) => setR({ ...r, strengths: e.target.value })} /></div>
        <div className="field"><label htmlFor="rv-im">What to change first</label><textarea id="rv-im" rows={4} value={r.improvements} onChange={(e) => setR({ ...r, improvements: e.target.value })} /></div>
      </div>
      <div className="actions"><button type="button" className="ul" onClick={() => save(false)}>Save draft</button><button type="submit" className="btn">Send to student</button>{msg && <span className="small" role="status">{msg}</span>}</div>
    </form>
  );
}

function ReviewView({ rv }) {
  const avg = Object.values(rv.rubric || {}).reduce((a, b) => a + b, 0) / Math.max(Object.keys(rv.rubric || {}).length, 1);
  return (
    <div className="panel stack gap-16">
      <p className="label">Review · round {rv.round} {rv.submitted_at && `· ${fmtDate(rv.submitted_at)}`}</p>
      <div className="rubric">
        {Object.entries(rv.rubric || {}).map(([k, v]) => <div key={k} className="rubric-row"><span>{k}</span><span className="bar" aria-label={`${v} out of 5`}><i style={{ width: `${v * 20}%` }} /></span><span className="num">{v}/5</span></div>)}
        <p className="small muted">Average {avg.toFixed(1)} / 5</p>
      </div>
      {rv.summary && <p style={{ whiteSpace: 'pre-line' }}>{rv.summary}</p>}
      {rv.strengths && <><p className="label">What works</p><p style={{ whiteSpace: 'pre-line' }}>{rv.strengths}</p></>}
      {rv.improvements && <><p className="label">What to change first</p><p style={{ whiteSpace: 'pre-line' }}>{rv.improvements}</p></>}
    </div>
  );
}

export function AssignBox({ project, onDone }) {
  const mentors = useLoad(api.listMentors);
  const [m, setM] = useState(project.assigned_mentor_id || '');
  const [msg, setMsg] = useState('');
  return (
    <div className="form-row" style={{ alignItems: 'end' }}>
      <div className="field"><label htmlFor={`as-${project.id}`}>Assign to mentor</label>
        <select id={`as-${project.id}`} value={m} onChange={(e) => setM(e.target.value)}><option value="">Choose…</option>{(mentors.data || []).map((x) => <option key={x.id} value={x.id}>{x.full_name}{x.expertise ? ` — ${x.expertise}` : ''}</option>)}</select></div>
      <button type="button" className="btn" disabled={!m} onClick={async () => { setMsg(''); try { await platform.assignPortfolio(project.id, m); onDone(); } catch (e) { setMsg(e.message); } }}>Assign</button>
      {msg && <p className="err" role="alert">{msg}</p>}
    </div>
  );
}

export function PortfolioPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { data, error, loading, reload } = useLoad(() => (user ? platform.getPortfolio(id) : null), [id, user?.id]);
  const perms = useLoad(() => (user ? platform.myPermissions() : {}), [user?.id]);
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState(null);
  useTitle(data?.project?.title || 'Portfolio');
  useEffect(() => { if (data?.project) setEdit({ title: data.project.title, brief: data.project.brief, target: data.project.target }); }, [data?.project?.id]);
  if (authLoading || loading) return <div className="wrap page-top"><Loading /></div>;
  if (!user) return <div className="wrap page-top"><p className="lead"><Link className="ul" to={`/login?next=/portfolio/${id}`}>Log in</Link> to open this portfolio.</p></div>;
  if (!data) return <div className="wrap page-top"><ErrorMsg error={error} /><p className="lead">This portfolio is not available to you.</p></div>;
  const { project: p, files, reviews } = data;
  const isStudent = p.student_id === user.id;
  const isMentor = p.assigned_mentor_id === user.id;
  const canAssign = perms.data?.['portfolio.assign'] === true;
  const go = async (status, q) => {
    if (q && !window.confirm(q)) return;
    setMsg('');
    try { await platform.setPortfolioStatus(p.id, status); reload(); } catch (e) { setMsg(e.message); }
  };
  const currentRound = 1 + (p.revisions_used || 0);
  const myDraft = reviews.find((r) => r.round === currentRound && r.mentor_id === user.id);
  return (
    <div className="wrap page-top stack gap-32" style={{ maxWidth: 980 }}>
      <div>
        <p className="label"><Link to={isMentor ? '/dashboard?tab=portfolio' : '/portfolio'} className="ul">Portfolio reviews</Link></p>
        <h1 className="h-l mt-16">{p.title}</h1>
        <p className="muted mt-8">{[p.target, p.student_name && !isStudent && `by ${p.student_name}`, p.mentor_name && `mentor: ${p.mentor_name}`, p.due_at && `reply by ${fmtDate(p.due_at)}`].filter(Boolean).join(' · ')}</p>
      </div>
      <Steps status={p.status} />
      <p><Status s={p.status === 'cancelled' ? 'declined' : 'pending'} label={STEP_LABEL[p.status]} /></p>

      {isStudent && p.status === 'draft' && edit && (
        <form className="stack gap-16" onSubmit={async (e) => { e.preventDefault(); await platform.updatePortfolioDraft(p.id, edit); reload(); }}>
          <div className="field"><label htmlFor="ed-t">Title</label><input id="ed-t" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
          <div className="field"><label htmlFor="ed-b">What should the mentor focus on?</label><textarea id="ed-b" rows={3} value={edit.brief} onChange={(e) => setEdit({ ...edit, brief: e.target.value })} /></div>
          <button type="submit" className="ul" style={{ alignSelf: 'flex-start' }}>Save changes</button>
        </form>
      )}
      {!(isStudent && p.status === 'draft') && p.brief && <div className="panel"><p className="label">Brief</p><p className="mt-8" style={{ whiteSpace: 'pre-line' }}>{p.brief}</p></div>}

      <section className="stack gap-16">
        <p className="label">Files</p>
        <FileList files={files} project={p} canDelete={isStudent} onChange={reload} />
        {isStudent && ['draft', 'revision_requested', 'feedback_ready'].includes(p.status) && <Uploader project={p} onDone={reload} />}
        {isMentor && ['assigned', 'in_review', 'revision_requested'].includes(p.status) && <Uploader project={p} onDone={reload} label="Add marked-up pages (optional)" />}
      </section>

      {isStudent && p.status === 'draft' && (
        <div className="actions">
          <button type="button" className="btn" onClick={() => go('submitted', p.price_paise ? `Submit for review? You will pay ${rupees(p.price_paise)} next.` : 'Submit for review?')}>Submit for review</button>
          <button type="button" className="ul" onClick={() => go('cancelled', 'Cancel this review?')}>Cancel</button>
        </div>
      )}
      {isStudent && p.status === 'awaiting_payment' && <div className="panel"><p style={{ marginBottom: 12 }}>Pay {rupees(p.price_paise)} to send your portfolio to our review coordinator.</p><PayButton kind="portfolio" refId={p.id} label="Pay and submit" onPaid={reload} /></div>}

      {canAssign && ['submitted', 'assigned', 'in_review', 'revision_requested'].includes(p.status) && <div className="panel"><AssignBox project={p} onDone={reload} /></div>}

      {isMentor && ['assigned', 'revision_requested'].includes(p.status) && <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => go('in_review')}>Start the review</button>}
      {isMentor && p.status === 'in_review' && <ReviewForm project={p} existing={myDraft} onDone={reload} />}

      {reviews.filter((r) => r.status === 'submitted').map((rv) => <ReviewView key={rv.id} rv={rv} />)}

      {isStudent && p.status === 'feedback_ready' && (
        <div className="actions">
          <button type="button" className="btn" onClick={() => go('completed')}>Mark as complete</button>
          {(p.revisions_used || 0) < 1 && <button type="button" className="ul" onClick={() => go('revision_requested', 'Ask the mentor for one follow-up round? Upload your revised files first.')}>Ask for a follow-up</button>}
        </div>
      )}
      {msg && <p className="err" role="alert">{msg}</p>}
    </div>
  );
}
