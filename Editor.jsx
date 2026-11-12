import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import * as api from './api.js';
import { useAuth } from './auth.jsx';
import { fmtDate, slugify, useTitle } from './util.js';
import RichEditor, { wordCount } from './RichEditor.jsx';
import ImageInput from './ImageInput.jsx';
import { Loading } from './Bits.jsx';

const BLANK = { title: '', dek: '', body: '', tag: '', author_name: '', cover_url: '', slug: '', published: false, submitted: false };

function AutoGrow({ id, value, onChange, placeholder, className, label }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }, [value]);
  return (
    <>
      <label htmlFor={id} className="sr-only">{label}</label>
      <textarea id={id} ref={ref} rows={1} className={`grow ${className}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))} />
    </>
  );
}

export default function Editor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState({ kind: 'idle', msg: '' });
  const [dirty, setDirty] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const timer = useRef(null);
  const latest = useRef(null);
  useTitle(post?.title ? `Editing: ${post.title}` : 'Write a story');

  const isAdmin = profile?.role === 'admin';
  const canWrite = isAdmin || (profile?.role === 'mentor' && profile?.approved);

  // load
  useEffect(() => {
    if (!profile) return;
    if (isNew) { setPost({ ...BLANK, author_name: profile.full_name || '' }); return; }
    if (latest.current?.id === id) return; // just saved a new story; keep what is on screen
    api.getStoryForEdit(id).then((p) => setPost(p || false)).catch(() => setPost(false));
  }, [id, isNew, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  latest.current = post;

  const save = useCallback(async (extra = {}, quiet = false) => {
    const p = { ...latest.current, ...extra };
    if (!p.title.trim()) { if (!quiet) setStatus({ kind: 'error', msg: 'Add a title first.' }); return null; }
    setStatus({ kind: 'saving', msg: 'Saving…' });
    try {
      const row = { ...p, slug: p.slug || slugify(p.title), published_at: p.published_at || new Date().toISOString() };
      const saved = await api.saveStory(row);
      setPost((cur) => ({ ...cur, ...saved }));
      setDirty(false);
      setStatus({ kind: 'saved', msg: `Saved ${new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` });
      if (!p.id && saved.id) navigate(`/editor/${saved.id}`, { replace: true });
      return saved;
    } catch (e) { setStatus({ kind: 'error', msg: e.message }); return null; }
  }, [navigate]);

  const update = (patch) => {
    setPost((p) => ({ ...p, ...patch }));
    setDirty(true);
    setStatus((s) => (s.kind === 'error' ? s : { kind: 'idle', msg: 'Unsaved changes' }));
  };

  // autosave drafts 3 s after typing stops
  useEffect(() => {
    if (!dirty || !post || post.published) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (latest.current?.title?.trim()) save({}, true); }, 3000);
    return () => clearTimeout(timer.current);
  }, [post, dirty, save]);

  // warn before leaving with unsaved changes
  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // Ctrl/Cmd + S
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [save]);

  if (loading) return <div className="wrap"><Loading /></div>;
  if (!user) return <Navigate to={`/login?next=/editor/${id}`} replace />;
  if (!canWrite) {
    return (
      <div className="wrap page-top">
        <h1 className="h-l">Writing is open to admins and approved mentors.</h1>
        <p className="lead mt-16">Have an idea? <Link to="/write" className="ul">Send it to us</Link>.</p>
      </div>
    );
  }
  if (post === null) return <div className="wrap"><Loading /></div>;
  if (post === false) return <div className="wrap page-top"><p className="h-l">Story not found.</p><Link to="/dashboard" className="ul link mt-24">Back to dashboard</Link></div>;

  const words = wordCount(post.body);
  const state = post.published ? 'Published' : post.submitted ? 'Sent for review' : 'Draft';
  const locked = post.published && !isAdmin;

  return (
    <div className="editor-page">
      <div className="editor-bar">
        <div className="wrap">
          <Link to="/dashboard" className="small muted">← Dashboard</Link>
          <span className="small muted" role="status" aria-live="polite">
            <span className={`status ${post.published ? 'published' : 'pending'}`}>{state}</span>
            {' '}{status.kind === 'error' ? <span className="err">{status.msg}</span> : status.msg}
          </span>
          <div className="actions">
            <button type="button" className="ul" onClick={() => setShowSettings(!showSettings)} aria-expanded={showSettings}>Story settings</button>
            {post.id && post.slug && <Link to={`/journal/${post.slug}`} target="_blank" className="ul">Preview</Link>}
            {!post.published && <button type="button" className="btn-ghost" onClick={() => save()} disabled={locked}>Save draft</button>}
            {isAdmin && !post.published && <button type="button" className="btn" onClick={() => save({ published: true, submitted: false, published_at: new Date().toISOString() })}>Publish</button>}
            {isAdmin && post.published && (
              <>
                <button type="button" className="ul" onClick={() => save({ published: false })}>Unpublish</button>
                <button type="button" className="btn" onClick={() => save()}>{dirty ? 'Update' : 'Saved'}</button>
              </>
            )}
            {!isAdmin && !post.published && (
              <button type="button" className="btn" onClick={() => save({ submitted: true })} disabled={post.submitted && !dirty}>
                {post.submitted ? (dirty ? 'Resubmit' : 'Sent for review') : 'Send for review'}
              </button>
            )}
          </div>
        </div>
      </div>

      {locked && <div className="wrap"><p className="panel mt-24" style={{ padding: 20 }}>This story is published. Ask an admin if it needs changes.</p></div>}

      {showSettings && (
        <div className="wrap">
          <div className="panel mt-24 stack gap-24" style={{ padding: 28 }}>
            <div className="form-row">
              <div className="field"><label htmlFor="ed-tag">Topics, comma separated</label><input id="ed-tag" value={post.tag || ''} onChange={(e) => update({ tag: e.target.value })} placeholder="Portfolio, Internships" /></div>
              <div className="field"><label htmlFor="ed-author">Author name shown</label><input id="ed-author" value={post.author_name || ''} onChange={(e) => update({ author_name: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="field"><label htmlFor="ed-slug">Web address</label><input id="ed-slug" value={post.slug || ''} onChange={(e) => update({ slug: slugify(e.target.value) })} placeholder={slugify(post.title) || 'made-from-the-title'} /></div>
              {isAdmin && <div className="field"><label htmlFor="ed-date">Publish date</label><input id="ed-date" type="date" value={(post.published_at || '').slice(0, 10)} onChange={(e) => update({ published_at: e.target.value ? new Date(e.target.value).toISOString() : '' })} /></div>}
            </div>
            <p className="small muted">Full address: …/journal/{post.slug || slugify(post.title) || 'your-title'}{post.created_at ? ` · Created ${fmtDate(post.created_at)}` : ''}</p>
          </div>
        </div>
      )}

      <article className="wrap editor-body">
        <AutoGrow id="ed-title" label="Title" className="ed-title" value={post.title} onChange={(v) => update({ title: v })} placeholder="Title" />
        <AutoGrow id="ed-dek" label="Summary" className="ed-dek" value={post.dek || ''} onChange={(v) => update({ dek: v })} placeholder="A one or two sentence summary that appears under the title and on cards" />
        <div className="mt-24">
          <ImageInput id="ed-cover" label="Cover image (optional)" value={post.cover_url} onChange={(url) => update({ cover_url: url })} />
        </div>
        <div className="mt-32">
          <RichEditor
            value={post.body}
            onChange={(html) => update({ body: html })}
            placeholder="Start writing. Paste or drag images straight into the text."
            label="Story text"
          />
        </div>
        <p className="small muted mt-16">{words} words · about {Math.max(1, Math.round(words / 220))} min read · Ctrl + S saves · drafts save automatically</p>
        {post.id && !post.published && (
          <button type="button" className="small" style={{ color: 'var(--bad)', minHeight: 44, marginTop: 24 }} onClick={async () => {
            if (!window.confirm('Delete this draft permanently? This cannot be undone.')) return;
            await api.deleteStory(post.id); setDirty(false); navigate('/dashboard');
          }}>Delete draft</button>
        )}
      </article>
    </div>
  );
}
