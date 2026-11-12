import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from './api.js';
import { useLoad, useTitle } from './util.js';
import { ErrorMsg, Loading, PostCard } from './Bits.jsx';

export default function Journal() {
  useTitle('Journal');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const tag = params.get('tag') || '';
  const input = useRef(null);
  const { data, error, loading } = useLoad(api.listPosts);

  useEffect(() => { if (params.get('search')) input.current?.focus(); }, [params]);

  const tags = [...new Set((data || []).flatMap((p) => (p.tag || '').split(',').map((t) => t.trim()).filter(Boolean)))];
  const needle = q.trim().toLowerCase();
  const list = (data || []).filter((p) =>
    (!tag || (p.tag || '').toLowerCase().includes(tag.toLowerCase())) &&
    (!needle || `${p.title} ${p.dek} ${p.tag} ${p.author_name}`.toLowerCase().includes(needle)));

  return (
    <div className="wrap page-top">
      <p className="label" style={{ marginBottom: 24 }}>Journal</p>
      <h1 className="h-xl" style={{ maxWidth: '18ch' }}>Practical guidance for your architecture journey.</h1>

      <div className="split mt-48" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '1 1 320px', maxWidth: 480 }}>
          <label htmlFor="j-search">Search stories</label>
          <input id="j-search" ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="portfolio, jury, internship…" />
        </div>
        {tags.length > 0 && (
          <div className="tags" style={{ flex: '2 1 320px' }} role="group" aria-label="Filter by topic">
            <button type="button" className={!tag ? 'ul' : ''} style={{ minHeight: 44 }} onClick={() => setParams({})}>All</button>
            {tags.map((t) => <button key={t} type="button" className={tag === t ? 'ul' : ''} style={{ minHeight: 44 }} onClick={() => setParams({ tag: t })}>{t}</button>)}
          </div>
        )}
      </div>

      <div className="mt-48">
        {loading && <Loading />}
        <ErrorMsg error={error} />
        {!loading && !list.length && <p className="empty">No stories match. Try another word.</p>}
        <div className="grid grid-wide">{list.map((p) => <PostCard key={p.id} p={p} />)}</div>
      </div>
    </div>
  );
}
