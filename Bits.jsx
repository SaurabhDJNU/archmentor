import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from './api.js';
import { fmtDate, initials, share, ytThumb, ytUrl } from './util.js';
import { Play, Share } from './Icons.jsx';

export const Arrow = () => <span className="arrow" aria-hidden="true">→</span>;

export function Split({ id, label, aside, children, className = '' }) {
  return (
    <section id={id} className={`wrap section split ${className}`}>
      <div className="side">
        <h2 className="label">{label}</h2>
        {aside}
      </div>
      <div className="main">{children}</div>
    </section>
  );
}

export function Loading() { return <p className="spinner">Loading…</p>; }
export function ErrorMsg({ error }) { return error ? <p className="err" role="alert">{error.message || String(error)}</p> : null; }

export function MentorCard({ m }) {
  return (
    <Link to={`/mentors/${m.id}`} className="stack" style={{ gap: 14 }}>
      <span className="portrait" aria-hidden="true">
        {m.photo_url ? <img src={m.photo_url} alt="" loading="lazy" /> : initials(m.full_name)}
      </span>
      <span className="stack">
        <span style={{ fontSize: 18 }}>{m.full_name}</span>
        <span className="muted" style={{ fontSize: 15 }}>{m.title}</span>
      </span>
    </Link>
  );
}

export function ShareButton({ title, path }) {
  const [msg, setMsg] = useState('');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {msg && <span className="small muted" role="status">{msg}</span>}
      <button
        type="button"
        className="icon-btn"
        style={{ justifyContent: 'flex-end' }}
        aria-label={`Share: ${title}`}
        onClick={async () => {
          const url = window.location.origin + import.meta.env.BASE_URL + path.replace(/^\//, '');
          const r = await share({ title, url });
          if (r === 'copied') { setMsg('Link copied'); setTimeout(() => setMsg(''), 2000); }
        }}
      ><Share /></button>
    </span>
  );
}

export function PostCard({ p }) {
  return (
    <article>
      <Link to={`/journal/${p.slug}`} style={{ display: 'block' }}>
        <span className="cover" style={{ display: 'block' }} aria-hidden="true">{p.cover_url && <img src={p.cover_url} alt="" loading="lazy" />}</span>
        <p className="small muted" style={{ margin: '16px 0 6px' }}>{p.tag}</p>
        <h3 className="h-m">{p.title}</h3>
      </Link>
      <p style={{ marginTop: 10, fontSize: 15, color: 'var(--ink-2)' }}>{p.dek}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, borderTop: '1px solid var(--line)', fontSize: 13 }} className="muted">
        <span>{[p.author_name, fmtDate(p.published_at)].filter(Boolean).join(' · ')}</span>
        <ShareButton title={p.title} path={`/journal/${p.slug}`} />
      </div>
    </article>
  );
}

// Click-to-load YouTube player (privacy-enhanced; loads nothing from YouTube until played).
export function VideoPlayer({ video }) {
  const [playing, setPlaying] = useState(false);
  const id = video.youtube_id;
  if (playing && id) {
    return (
      <div className="video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <button type="button" className="video row" style={{ width: '100%' }} onClick={() => id && setPlaying(true)} disabled={!id} aria-label={id ? `Play video: ${video.title}` : `${video.title} (video coming soon)`}>
      {id && <img src={ytThumb(id)} alt="" />}
      <span className="play" aria-hidden="true"><Play /></span>
      {!id && <span className="small muted" style={{ position: 'absolute', left: 20, bottom: 16 }}>Video coming soon</span>}
    </button>
  );
}

export function ShortCard({ v }) {
  const href = ytUrl(v.youtube_id, true);
  const inner = (
    <>
      <span className="short">
        {v.youtube_id && <img src={ytThumb(v.youtube_id)} alt="" loading="lazy" />}
        <span aria-hidden="true" style={{ position: 'absolute', top: 12, right: 12 }}><Play size={18} /></span>
        <span className="cap">{v.title}</span>
      </span>
      {!v.youtube_id && <span className="small muted">Coming soon</span>}
    </>
  );
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="stack gap-8" aria-label={`Watch on YouTube: ${v.title}`}>{inner}</a>
    : <div className="stack gap-8">{inner}</div>;
}

export function SubscribeForm({ compact }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [freq, setFreq] = useState('each');
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try {
      const r = await api.subscribe({ name, email, frequency: freq });
      setState({ status: 'done', msg: r.already ? 'You are already on the list.' : 'Thank you. You are on the list.' });
    } catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  if (state.status === 'done') return <p className="msg" role="status">{state.msg}</p>;
  return (
    <form onSubmit={submit}>
      {!compact && (
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="sub-name">Name (optional)</label>
          <input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
      )}
      <label htmlFor="sub-email" className="small muted" style={{ display: 'block', marginBottom: 6 }}>New Journal stories and free sessions, by email</label>
      <div className="inline-sub">
        <input id="sub-email" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <button type="submit" style={{ minHeight: 44 }} disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Saving…' : 'Subscribe'}</button>
      </div>
      <fieldset style={{ border: 0, margin: '12px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
        <legend className="sr-only">How often</legend>
        <label className="check"><input type="radio" name="freq" checked={freq === 'each'} onChange={() => setFreq('each')} /> Every new story</label>
        <label className="check"><input type="radio" name="freq" checked={freq === 'weekly'} onChange={() => setFreq('weekly')} /> Weekly digest (Sundays)</label>
      </fieldset>
      {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
    </form>
  );
}

export function SessionCard({ s, big }) {
  return (
    <div id={s.id}>
      <p className={big ? 'h-xl' : 'h-l'} style={{ maxWidth: '16ch' }}>{s.title}</p>
      {s.description && <p className="lead" style={{ marginTop: 24, maxWidth: '56ch' }}>{s.description}</p>}
      <dl className="facts">
        <div><dt>Date</dt><dd>{s.starts_at ? fmtDate(s.starts_at, true) : 'To be announced'}</dd></div>
        <div><dt>Format</dt><dd>{s.format || 'Online'}</dd></div>
        <div><dt>Registration</dt><dd>Free</dd></div>
        <div><dt>Type</dt><dd>{s.kind || 'Live session'}</dd></div>
      </dl>
    </div>
  );
}
