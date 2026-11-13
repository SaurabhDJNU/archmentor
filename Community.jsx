import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as api from './api.js';
import { useAuth } from './auth.jsx';
import { ROLE_LABEL, timeAgo, useLoad, useTitle } from './util.js';
import { ErrorMsg, Loading } from './Bits.jsx';
import * as platform from './platform.js';
import { T, Img } from './Content.jsx';

function Report({ kind, id }) {
  const [state, setState] = useState('');
  if (state === 'done') return <span className="small faint"> · Reported — thank you</span>;
  return <> · <button type="button" className="small muted" onClick={async () => {
    const reason = window.prompt('What is wrong with this post? (spam, rude, off-topic…)');
    if (!reason || reason.trim().length < 3) return;
    try { await platform.reportItem(kind, id, reason.trim()); setState('done'); } catch (e) { window.alert(e.message); }
  }}>Report</button></>;
}

const TABS = [['latest', 'Latest'], ['helpful', 'Most helpful'], ['viewed', 'Most viewed'], ['unanswered', 'Unanswered']];
const roleTag = (r) => (r && r !== 'student' ? <span className={`chip role-${r}`}>{ROLE_LABEL[r] || r}</span> : null);

function QuestionRow({ q }) {
  return (
    <li className="q-row">
      <div className="q-counts" aria-hidden="true">
        <span><b>{q.answers_count}</b> answer{q.answers_count === 1 ? '' : 's'}</span>
        <span><b>{q.helpful_total}</b> helpful</span>
        <span><b>{q.views}</b> views</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontSize: 19, fontWeight: 400 }}><Link to={`/community/${q.id}`}>{q.title}</Link></h3>
        <p className="small muted mt-8">
          <span className="chip">{q.category}</span> {q.author_name || 'Member'} {roleTag(q.author_role)} · {timeAgo(q.created_at)}
          <span className="sr-only">. {q.answers_count} answers, {q.helpful_total} helpful votes, {q.views} views.</span>
        </p>
      </div>
    </li>
  );
}

export default function Community() {
  useTitle('Community');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'latest';
  const category = params.get('category') || '';
  const [q, setQ] = useState(params.get('q') || '');
  const { data, error, loading } = useLoad(api.listQuestions);
  const all = data || [];
  const set = (k, v) => { const p = Object.fromEntries(params); if (v) p[k] = v; else delete p[k]; setParams(p); };

  const needle = q.trim().toLowerCase();
  let list = all.filter((x) => (!category || x.category === category) && (!needle || `${x.title} ${x.body} ${x.author_name}`.toLowerCase().includes(needle)));
  if (tab === 'unanswered') list = list.filter((x) => !x.answers_count);
  list = [...list].sort((a, b) => (tab === 'helpful' ? b.helpful_total - a.helpful_total : tab === 'viewed' ? b.views - a.views : 0) || b.created_at.localeCompare(a.created_at));
  const counts = all.reduce((acc, x) => ({ ...acc, [x.category]: (acc[x.category] || 0) + 1 }), {});
  const popular = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);

  return (
    <div className="wrap page-top">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
        <div>
          <p className="label" style={{ marginBottom: 24 }}>Community</p>
          <h1 className="h-xl"><T k="community.title">Ask. Share. Learn together.</T></h1>
          <p className="lead mt-16" style={{ maxWidth: '52ch' }}><T k="community.lead" block>Real questions and practical advice from architecture students, mentors and professionals.</T></p>
        </div>
        <Link to="/community/ask" className="btn">+ Ask a question</Link>
      </div>

      <div className="split mt-48" style={{ gap: 48 }}>
        <div style={{ flex: '3 1 560px', minWidth: 0 }}>
          <form className="filters" role="search" onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }}>
            <div className="field" style={{ flex: '2 1 240px' }}><label htmlFor="c-q">Search questions or people</label><input id="c-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="c-cat">Category</label>
              <select id="c-cat" value={category} onChange={(e) => set('category', e.target.value)}><option value="">All categories</option>{api.FORUM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
          </form>
          <div className="tabs mt-24" role="tablist" aria-label="Sort questions">
            {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => set('tab', id === 'latest' ? '' : id)}>{label}</button>)}
          </div>
          {loading && <Loading />}
          <ErrorMsg error={error} />
          {data && !list.length && <p className="empty">{all.length ? 'No questions match.' : 'No questions yet. Be the first to ask.'}</p>}
          <ul className="q-list">{list.map((x) => <QuestionRow key={x.id} q={x} />)}</ul>
        </div>
        <aside style={{ flex: '1 1 260px', minWidth: 0 }} className="stack gap-24">
          <div className="panel" style={{ padding: 24 }}>
            <h2 className="small muted" style={{ fontWeight: 400 }}>Community stats</h2>
            <dl className="mini-stats">
              <div><dt>Questions</dt><dd>{all.length}</dd></div>
              <div><dt>Answers</dt><dd>{all.reduce((n, x) => n + x.answers_count, 0)}</dd></div>
              <div><dt>Views</dt><dd>{all.reduce((n, x) => n + x.views, 0)}</dd></div>
            </dl>
          </div>
          <div>
            <h2 className="small muted" style={{ fontWeight: 400, marginBottom: 10 }}>Popular topics</h2>
            <div className="tags">{(popular.length ? popular : ['Portfolio', 'Career', 'Software', 'Internships', 'Design Studio']).map((c) => <button key={c} type="button" className="chip chip-btn" onClick={() => set('category', c)}>{c}</button>)}</div>
          </div>
          <div className="panel" style={{ padding: 24 }}>
            <p>Have a question?</p>
            <p className="small muted mt-8">Get practical advice from students, mentors and professionals. You get an email when someone answers.</p>
            <Link to="/community/ask" className="ul link">Ask the community →</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AskCommunity() {
  useTitle('Ask the community');
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ title: '', body: '', category: 'Design Studio' });
  const [state, setState] = useState({ status: 'idle', msg: '' });
  if (loading) return <div className="wrap"><Loading /></div>;
  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try { const q = await api.askForumQuestion(f); navigate(`/community/${q.id}`); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  return (
    <div className="wrap page-top" style={{ maxWidth: 860 }}>
      <Link to="/community" className="muted small">← Community</Link>
      <h1 className="h-l mt-24">Ask a question</h1>
      <p className="mt-8" style={{ color: 'var(--ink-2)' }}>Be specific: say what you tried and where you are stuck. You will get an email when someone answers.</p>
      {!user ? (
        <div className="panel mt-32"><p>Please sign in to ask a question.</p><div className="actions mt-16"><Link to="/login?next=/community/ask" className="btn">Sign in</Link><Link to="/signup?next=/community/ask" className="btn-ghost">Create free account</Link></div></div>
      ) : (
        <form onSubmit={submit} className="stack gap-24 mt-32">
          <div className="field"><label htmlFor="cq-title">Question title</label><input id="cq-title" required minLength={8} maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. How do I choose a thesis site?" /></div>
          <div className="field"><label htmlFor="cq-cat">Category</label><select id="cq-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{api.FORUM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label htmlFor="cq-body">Details</label><textarea id="cq-body" rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Add context: your year, the brief, what you have tried." /></div>
          {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
          <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Posting…' : 'Post question'}</button>
        </form>
      )}
    </div>
  );
}

export function QuestionPage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { data: q, error, loading, reload } = useLoad(() => api.getQuestion(id), [id, user?.id]);
  const [body, setBody] = useState('');
  const [state, setState] = useState({ status: 'idle', msg: '' });
  useTitle(q?.title || 'Community');
  useEffect(() => { api.countView(id); }, [id]);

  if (loading && !q) return <div className="wrap"><Loading /></div>;
  if (error) return <div className="wrap page-top"><ErrorMsg error={error} /></div>;
  if (!q) return <div className="wrap page-top"><p className="h-l">Question not found.</p><Link to="/community" className="ul link mt-24">Community</Link></div>;

  const canDelete = (item) => user && (item.author_id === user.id || profile?.role === 'admin');
  const answers = [...q.answers].sort((a, b) => b.helpful - a.helpful || a.created_at.localeCompare(b.created_at));
  const post = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try { await api.answerQuestion({ question_id: q.id, body }); setBody(''); setState({ status: 'idle', msg: '' }); reload(); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  const vote = async (a) => {
    if (!user) { navigate(`/login?next=/community/${q.id}`); return; }
    try { await api.setHelpful(a.id, !a.voted); reload(); } catch (err) { window.alert(err.message); }
  };
  const del = async (table, itemId) => {
    if (!window.confirm('Delete this permanently? This cannot be undone.')) return;
    await api.deleteForumItem(table, itemId);
    if (table === 'forum_questions') navigate('/community'); else reload();
  };

  return (
    <div className="wrap page-top" style={{ maxWidth: 920 }}>
      <Link to="/community" className="muted small">← Community</Link>
      <article className="mt-24">
        <span className="chip">{q.category}</span>
        <h1 className="h-l mt-16">{q.title}</h1>
        <p className="small muted mt-8">Asked by {q.author_name || 'Member'} {roleTag(q.author_role)} · {timeAgo(q.created_at)} · {q.views} views</p>
        {q.body && <p className="mt-24" style={{ fontSize: 18, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{q.body}</p>}
        {canDelete(q) && <button type="button" className="small" style={{ color: 'var(--bad)', minHeight: 44, marginTop: 8 }} onClick={() => del('forum_questions', q.id)}>Delete question</button>}
        {user && q.author_id !== user.id && <p className="small muted"><Report kind="question" id={q.id} /></p>}
      </article>

      <section className="mt-48">
        <h2 className="h-m" style={{ borderBottom: '1px solid var(--ink)', paddingBottom: 12 }}>{answers.length} answer{answers.length === 1 ? '' : 's'}</h2>
        {!answers.length && <p className="empty">No answers yet. Share what you know.</p>}
        {answers.map((a) => (
          <div key={a.id} className="answer">
            <div className="vote">
              <button type="button" aria-pressed={a.voted ? 'true' : 'false'} onClick={() => vote(a)} disabled={user && a.author_id === user.id} title={user && a.author_id === user.id ? 'You cannot vote for your own answer' : 'Mark as helpful'}>▲ Helpful</button>
              <span className="small">{a.helpful}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 17, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{a.body}</p>
              <p className="small muted mt-8">{a.author_name || 'Member'} {roleTag(a.author_role)} · {timeAgo(a.created_at)}
                {canDelete(a) && <> · <button type="button" className="small" style={{ color: 'var(--bad)' }} onClick={() => del('forum_answers', a.id)}>Delete</button></>}
                {user && a.author_id !== user.id && <Report kind="answer" id={a.id} />}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-48">
        <h2 className="h-m">Your answer</h2>
        {!user ? (
          <p className="mt-16"><Link to={`/login?next=/community/${q.id}`} className="ul">Sign in</Link> to answer this question.</p>
        ) : (
          <form onSubmit={post} className="stack gap-16 mt-16">
            <div className="field"><label htmlFor="ans" className="sr-only">Your answer</label><textarea id="ans" required minLength={2} rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share practical advice or your experience." /></div>
            {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
            <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Posting…' : 'Post answer'}</button>
          </form>
        )}
      </section>
    </div>
  );
}
