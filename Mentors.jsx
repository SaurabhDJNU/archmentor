import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from './api.js';
import { fmtPrice, initials, useLoad, useTitle } from './util.js';
import { ErrorMsg, Loading } from './Bits.jsx';
import { T, Img } from './Content.jsx';

function MentorRow({ m }) {
  const intro = m.services.find((s) => !s.price_inr) || m.services[0];
  return (
    <article className="mentor-card">
      <Link to={`/mentors/${m.id}`} className="portrait" aria-hidden="true" tabIndex={-1}>
        {m.photo_url ? <img src={m.photo_url} alt="" loading="lazy" /> : initials(m.full_name)}
      </Link>
      <div className="stack gap-8" style={{ minWidth: 0 }}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 400 }}><Link to={`/mentors/${m.id}`}>{m.full_name}</Link> <span className="verified" title="Verified by ArchMentor">✓ Verified</span></h3>
          <p className="muted" style={{ fontSize: 15 }}>{[m.title, m.organisation].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="tags">{m.expertise && <span className="chip">{m.expertise}</span>}{m.experience && <span className="chip">{m.experience}</span>}</div>
        {m.bio && <p className="clamp-3" style={{ fontSize: 15, color: 'var(--ink-2)' }}>{m.bio}</p>}
        <p className="small muted">
          {m.services.length} service{m.services.length === 1 ? '' : 's'}
          {m.services.some((s) => !s.price_inr) ? ' · Free intro available' : m.min_price ? ` · From ${fmtPrice(m.min_price)}` : ''}
        </p>
        <div className="actions">
          <Link to={`/mentors/${m.id}`} className="btn-ghost">View profile</Link>
          {intro && <Link to={`/book/${intro.id}`} className="ul">{intro.price_inr ? 'Book a session' : 'Free intro'}</Link>}
        </div>
      </div>
    </article>
  );
}

export default function Mentors() {
  useTitle('Mentors');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const expertise = params.get('expertise') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'recommended';
  const { data, error, loading } = useLoad(api.listMentors);
  const all = data || [];

  const set = (k, v) => { const p = Object.fromEntries(params); if (v) p[k] = v; else delete p[k]; setParams(p); };
  const expertiseOptions = [...new Set(all.map((m) => m.expertise).filter(Boolean))].sort();
  const needle = q.trim().toLowerCase();
  let list = all.filter((m) =>
    (!expertise || m.expertise === expertise)
    && (!category || m.services.some((s) => s.category.toLowerCase() === category.toLowerCase()))
    && (!needle || [m.full_name, m.title, m.organisation, m.expertise, m.bio, ...m.services.map((s) => `${s.title} ${s.category}`)].join(' ').toLowerCase().includes(needle)));
  list = [...list].sort((a, b) => {
    if (sort === 'newest') return (b.created_at || '').localeCompare(a.created_at || '');
    if (sort === 'name') return a.full_name.localeCompare(b.full_name);
    if (sort === 'price') return (a.min_price ?? 1e9) - (b.min_price ?? 1e9);
    return b.services.length - a.services.length || a.full_name.localeCompare(b.full_name);
  });

  return (
    <div className="wrap page-top">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32 }}>
        <div>
          <p className="label" style={{ marginBottom: 24 }}>Mentors</p>
          <h1 className="h-xl" style={{ maxWidth: '18ch' }}><T k="mentors.title">Find a mentor for your architecture journey.</T></h1>
          <p className="lead mt-24" style={{ maxWidth: '58ch' }}><T k="mentors.lead" block>Verified architects and educators for portfolio feedback, career guidance, admissions advice, research support and industry insight.</T></p>
        </div>
        {data && (
          <dl className="stats">
            <div><dt>Verified mentors</dt><dd>{all.length}</dd></div>
            <div><dt>Bookable</dt><dd>{all.filter((m) => m.services.length).length}</dd></div>
            <div><dt>Free intro</dt><dd>{all.filter((m) => m.services.some((s) => !s.price_inr)).length}</dd></div>
          </dl>
        )}
      </div>

      <form className="filters mt-48" onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }} role="search">
        <div className="field" style={{ flex: '2 1 260px' }}><label htmlFor="m-q">Search</label><input id="m-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, firm, expertise…" /></div>
        <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor="m-exp">Expertise</label>
          <select id="m-exp" value={expertise} onChange={(e) => set('expertise', e.target.value)}><option value="">All expertise</option>{expertiseOptions.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor="m-sort">Sort</label>
          <select id="m-sort" value={sort} onChange={(e) => set('sort', e.target.value === 'recommended' ? '' : e.target.value)}>
            <option value="recommended">Recommended</option><option value="newest">Newest</option><option value="name">Name</option><option value="price">Price: low to high</option>
          </select>
        </div>
        <button type="submit" className="btn" style={{ alignSelf: 'flex-end' }}>Find mentors</button>
      </form>
      {category && <p className="small mt-16">Showing mentors offering <b>{category}</b> sessions. <button type="button" className="ul" onClick={() => set('category', '')}>Show all</button></p>}

      <div className="mt-48">
        {loading && <Loading />}
        <ErrorMsg error={error} />
        {data && <p className="small muted" style={{ marginBottom: 16 }}>Showing {list.length} mentor{list.length === 1 ? '' : 's'}</p>}
        {!loading && !list.length && <p className="empty">No mentors match. <button type="button" className="ul" onClick={() => { setQ(''); setParams({}); }}>Clear filters</button></p>}
        <div className="mentor-grid">{list.map((m) => <MentorRow key={m.id} m={m} />)}</div>
      </div>

      <section className="section">
        <h2 className="label" style={{ marginBottom: 24 }}>How mentorship works</h2>
        <ol className="steps">
          <li><span className="faint small">01</span><p className="t">Explore mentors</p><p className="d">Search verified professionals by your goals, their expertise and the guidance you need.</p></li>
          <li><span className="faint small">02</span><p className="t">Request a session</p><p className="d">Choose a mentorship service and tell the mentor what you would like help with.</p></li>
          <li><span className="faint small">03</span><p className="t">Schedule after approval</p><p className="d">Once approved, pick a time on the mentor’s calendar from your dashboard. You get an email at every step.</p></li>
        </ol>
      </section>

      <div className="panel" style={{ marginTop: 'var(--gap-section)', display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="h-m">Help the next generation of architects.</p>
          <p style={{ color: 'var(--ink-2)', marginTop: 6 }}>Share your experience and support students. Apply and we will review your profile.</p>
        </div>
        <Link to="/signup?role=mentor" className="btn">Become a mentor</Link>
      </div>
    </div>
  );
}
