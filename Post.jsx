import { Link, useParams } from 'react-router-dom';
import * as api from './api.js';
import { fmtDate, useLoad, useTitle } from './util.js';
import RichText, { plainText } from './RichText.jsx';
import { ErrorMsg, Loading, ShareButton, SubscribeForm, VideoPlayer } from './Bits.jsx';

export default function Post() {
  const { slug } = useParams();
  const { data: p, error, loading } = useLoad(() => api.getPost(slug), [slug]);
  useTitle(p?.title || 'Journal');

  if (loading) return <div className="wrap"><Loading /></div>;
  if (error) return <div className="wrap page-top"><ErrorMsg error={error} /></div>;
  if (!p) return <div className="wrap page-top"><p className="h-l">Story not found.</p><Link to="/journal" className="ul link mt-24">All stories</Link></div>;

  const words = plainText(p.body || '').split(/\s+/).filter(Boolean).length;
  return (
    <article className="wrap page-top">
      <Link to="/journal" className="muted small">← Journal</Link>
      {!p.published && <p className="panel mt-16" style={{ padding: 16 }} role="note">Preview: this story is not published yet. <Link to={`/editor/${p.id}`} className="ul">Back to editing</Link></p>}
      <header style={{ maxWidth: 900, marginTop: 32 }}>
        {p.tag && <p className="small muted">{p.tag}</p>}
        <h1 className="h-xl mt-16">{p.title}</h1>
        {p.dek && <p className="lead mt-24" style={{ maxWidth: '56ch' }}>{p.dek}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 32, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <span className="small muted">{[p.author_name, fmtDate(p.published_at), `${Math.max(1, Math.round(words / 220))} min read`].filter(Boolean).join(' · ')}</span>
          <ShareButton title={p.title} path={`/journal/${p.slug}`} />
        </div>
      </header>
      {p.cover_url && <img src={p.cover_url} alt="" style={{ width: '100%', maxHeight: 640, objectFit: 'cover', marginTop: 48 }} />}
      <div className="split" style={{ marginTop: 48 }}>
        <div className="side" />
        <div className="main">
          {p.youtube_id && <div style={{ maxWidth: 680, marginBottom: 40 }}><VideoPlayer video={{ youtube_id: p.youtube_id, title: p.title }} /></div>}
          <RichText text={p.body} />
          <div className="panel mt-48" style={{ maxWidth: 680 }}>
            <p className="h-m" style={{ marginBottom: 16 }}>Get new stories by email</p>
            <SubscribeForm compact />
          </div>
        </div>
      </div>
    </article>
  );
}
