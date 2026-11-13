import { useMemo, useState } from 'react';
import * as platform from './platform.js';
import { useAuth } from './auth.jsx';
import { fmtDate, useLoad, useTitle } from './util.js';
import { ErrorMsg, Loading } from './Bits.jsx';
import ArchArt from './ArchArt.jsx';

function SaveToggle({ kind, id, saved, onChange }) {
  const { user } = useAuth();
  if (!user) return null;
  const on = saved.some((s) => s.kind === kind && s.item_id === id);
  return <button type="button" className="ul small" aria-pressed={on} onClick={async () => { await platform.toggleSaved(kind, id, !on); onChange(); }}>{on ? 'Saved' : 'Save'}</button>;
}

export function Opportunities() {
  useTitle('Opportunities');
  const { data, error, loading } = useLoad(platform.listOpportunities);
  const saved = useLoad(platform.mySaved);
  const [kind, setKind] = useState('All');
  const [q, setQ] = useState('');
  const [onlySaved, setOnlySaved] = useState(false);
  const kinds = ['All', 'Internship', 'Job', 'Competition', 'Scholarship', 'Workshop', 'Fellowship'];
  const rows = useMemo(() => (data || []).filter((o) => (kind === 'All' || o.kind === kind)
    && (!q || `${o.title} ${o.organisation} ${o.location}`.toLowerCase().includes(q.toLowerCase()))
    && (!onlySaved || (saved.data || []).some((s) => s.kind === 'opportunity' && s.item_id === o.id))), [data, kind, q, onlySaved, saved.data]);
  return (
    <div className="wrap page-top">
      <div className="hero-split">
        <div>
          <p className="label">Opportunities</p>
          <h1 className="h-xl">Internships, jobs and competitions.</h1>
          <p className="lead mt-24">Collected by our team and mentors. Always apply on the organiser’s own page.</p>
        </div>
        <ArchArt kind="plan" />
      </div>
      <div className="filters mt-48">
        <input type="search" aria-label="Search opportunities" placeholder="Search title, office or city" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="choice-row" role="group" aria-label="Type">{kinds.map((k) => <button key={k} type="button" className="choice" aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}</div>
        <label className="check small"><input type="checkbox" checked={onlySaved} onChange={(e) => setOnlySaved(e.target.checked)} /> Saved only</label>
      </div>
      {loading && <Loading />}<ErrorMsg error={error} />
      {!loading && !rows.length && <p className="empty">Nothing matches right now.</p>}
      <div className="mt-24">
        {rows.map((o) => (
          <article key={o.id} className="card-line">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p className="small muted">{o.kind} · {o.organisation}{o.location ? ` · ${o.location}` : ''}{o.remote ? ' · remote' : ''}</p>
              <SaveToggle kind="opportunity" id={o.id} saved={saved.data || []} onChange={saved.reload} />
            </div>
            <h2 className="h-m mt-8">{o.title}</h2>
            {o.description && <p className="mt-8" style={{ color: 'var(--ink-2)', maxWidth: '70ch' }}>{o.description}</p>}
            <p className="small mt-8">{o.deadline ? `Apply by ${fmtDate(o.deadline)}` : 'Rolling deadline'}{o.url && <> · <a className="ul" href={o.url} target="_blank" rel="noopener noreferrer">Details ↗</a></>}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function Resources() {
  useTitle('Resources');
  const { data, error, loading } = useLoad(platform.listResources);
  const saved = useLoad(platform.mySaved);
  const [kind, setKind] = useState('All');
  const kinds = ['All', 'Guide', 'Template', 'Checklist', 'Reading list', 'Tool'];
  const rows = (data || []).filter((r) => kind === 'All' || r.kind === kind);
  return (
    <div className="wrap page-top">
      <div className="hero-split">
        <div>
          <p className="label">Resources</p>
          <h1 className="h-xl">Guides, templates and reading lists.</h1>
          <p className="lead mt-24">Short, practical material from mentors — free to use.</p>
        </div>
        <ArchArt kind="axon" />
      </div>
      <div className="choice-row small-choices mt-48" role="group" aria-label="Type">{kinds.map((k) => <button key={k} type="button" className="choice" aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}</div>
      {loading && <Loading />}<ErrorMsg error={error} />
      <div className="grid-3 mt-24">
        {rows.map((r) => (
          <article key={r.id} className="panel stack gap-8">
            {r.cover_url && <img src={r.cover_url} alt="" loading="lazy" style={{ aspectRatio: '4/3', objectFit: 'cover' }} />}
            <p className="small muted">{r.kind}</p>
            <h2 className="h-m">{r.title}</h2>
            <p className="muted">{r.description}</p>
            <div className="actions mt-8">
              {r.url ? <a className="ul" href={r.url} target="_blank" rel="noopener noreferrer">Open ↗</a> : <span className="small faint">Coming soon</span>}
              <SaveToggle kind="resource" id={r.id} saved={saved.data || []} onChange={saved.reload} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
