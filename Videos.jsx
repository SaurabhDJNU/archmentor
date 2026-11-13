import * as api from './api.js';
import { useLoad, useTitle } from './util.js';
import { SOCIAL } from './config.js';
import { Arrow, ErrorMsg, Loading, ShortCard, VideoPlayer } from './Bits.jsx';
import { T, Img } from './Content.jsx';

export default function Videos() {
  useTitle('Videos');
  const { data, error, loading } = useLoad(api.listVideos);
  const full = (data || []).filter((v) => v.kind === 'full');
  const shorts = (data || []).filter((v) => v.kind === 'short');
  const featured = full.find((v) => v.featured) || full[0];
  const rest = full.filter((v) => v !== featured);

  return (
    <div className="wrap page-top">
      <p className="label" style={{ marginBottom: 24 }}>Videos</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
        <h1 className="h-xl" style={{ maxWidth: '16ch' }}><T k="videos.title">Talks and short studio lessons.</T></h1>
        {SOCIAL.youtube && <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="ul link row">Subscribe on YouTube <Arrow /></a>}
      </div>
      {loading && <Loading />}
      <ErrorMsg error={error} />
      {!loading && !data?.length && <p className="empty mt-48">Videos are coming soon.</p>}

      {featured && (
        <section className="mt-48">
          <VideoPlayer video={featured} />
          <p className="h-m mt-16">{featured.title}</p>
        </section>
      )}
      {rest.length > 0 && (
        <section className="section">
          <h2 className="label" style={{ marginBottom: 24 }}>Talks</h2>
          <div className="grid grid-wide">{rest.map((v) => <div key={v.id}><VideoPlayer video={v} /><p style={{ marginTop: 12, fontSize: 18 }}>{v.title}</p></div>)}</div>
        </section>
      )}
      {shorts.length > 0 && (
        <section className="section">
          <h2 className="label" style={{ marginBottom: 24 }}>Shorts</h2>
          <div className="grid grid-shorts">{shorts.map((v) => <ShortCard key={v.id} v={v} />)}</div>
        </section>
      )}
    </div>
  );
}
