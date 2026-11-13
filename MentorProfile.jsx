import { Link, useParams } from 'react-router-dom';
import * as api from './api.js';
import { fmtPrice, initials, useLoad, useTitle } from './util.js';
import { Arrow, ErrorMsg, Loading } from './Bits.jsx';

export function ServiceCard({ s, compact }) {
  return (
    <article className="service-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.category}</span>
        <span className="chip">{fmtPrice(s.price_inr)}</span>
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 400, margin: '10px 0 6px' }}>{s.title}</h3>
      {!compact && s.description && <p style={{ fontSize: 15, color: 'var(--ink-2)' }}>{s.description}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        <span className="small muted">{s.duration_min} minutes · Online</span>
        <Link to={`/book/${s.id}`} className="btn" style={{ minHeight: 40, padding: '8px 16px' }}>{s.price_inr ? 'Request' : 'Book free call'}</Link>
      </div>
    </article>
  );
}

export default function MentorProfile() {
  const { id } = useParams();
  const { data: m, error, loading } = useLoad(() => api.getMentor(id), [id]);
  useTitle(m?.full_name || 'Mentor');

  if (loading) return <div className="wrap"><Loading /></div>;
  if (error) return <div className="wrap page-top"><ErrorMsg error={error} /></div>;
  if (!m) return <div className="wrap page-top"><p className="h-l">Mentor not found.</p><Link to="/mentors" className="ul link mt-24">All mentors</Link></div>;

  const services = m.services || [];
  const areas = [...new Set(services.map((s) => s.category))];
  return (
    <div className="wrap page-top">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Link to="/mentors" className="muted small">← Back to mentors</Link>
        {m.expertise && <span className="small muted">Mentor · {m.expertise}</span>}
      </div>
      <div className="split mt-32" style={{ gap: 56 }}>
        <div style={{ flex: '1 1 300px', maxWidth: 380 }}>
          <span className="portrait" aria-hidden="true">{m.photo_url ? <img src={m.photo_url} alt="" /> : initials(m.full_name)}</span>
          <h1 className="h-l mt-24">{m.full_name}</h1>
          <p className="mt-8">{m.title}</p>
          {m.organisation && <p className="muted" style={{ fontSize: 15 }}>{m.organisation}</p>}
          <div className="tags mt-16">
            {m.approved ? <span className="verified">✓ Verified</span> : <span className="status pending">Awaiting approval</span>}
            {m.expertise && <span className="chip">{m.expertise}</span>}
            {m.experience && <span className="chip">{m.experience}</span>}
          </div>
          <div className="actions mt-24">
            {services.length > 0 && <a href="#services" className="btn">View services</a>}
            {m.portfolio_url && <a href={m.portfolio_url} target="_blank" rel="noopener noreferrer" className="btn-ghost">Portfolio ↗</a>}
            {m.linkedin_url && <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer" className="ul">LinkedIn</a>}
          </div>
        </div>

        <div style={{ flex: '2 1 520px', minWidth: 0 }}>
          <p className="label">About this mentor</p>
          {m.bio ? <p className="mt-16" style={{ fontSize: 19, lineHeight: 1.7, whiteSpace: 'pre-line', maxWidth: '62ch' }}>{m.bio}</p> : <p className="muted mt-16">Profile details coming soon.</p>}
          <dl className="facts">
            {m.expertise && <div><dt>Main expertise</dt><dd>{m.expertise}</dd></div>}
            {m.experience && <div><dt>Experience</dt><dd>{m.experience}</dd></div>}
            <div><dt>Format</dt><dd>Online{services.some((s) => !s.price_inr) ? ', free intro' : ''}</dd></div>
            {m.organisation && <div><dt>Firm or institution</dt><dd>{m.organisation}</dd></div>}
          </dl>
          {(m.works_with || []).length > 0 && (
            <div className="mt-32"><p className="small muted" style={{ marginBottom: 8 }}>Works with</p><div className="tags">{m.works_with.map((w) => <span key={w} className="chip">{w}</span>)}</div></div>
          )}
          {areas.length > 0 && (
            <div className="mt-32"><p className="small muted" style={{ marginBottom: 8 }}>Areas you can explore with {m.full_name.split(' ')[0]}</p><div className="tags">{areas.map((a) => <span key={a} className="chip">{a}</span>)}</div></div>
          )}

          <section id="services" className="mt-48" style={{ scrollMarginTop: 24 }}>
            <h2 className="h-m">Book a session with {m.full_name.replace(/^Dr\.?\s+/, '').split(' ')[0]}</h2>
            <p className="mt-8" style={{ color: 'var(--ink-2)', maxWidth: '60ch' }}>Choose the service that matches your goal. Your request goes to the mentor for approval; once accepted, you pick a time from your dashboard.</p>
            {!services.length && <p className="empty mt-24">This mentor has not listed any services yet.</p>}
            <div className="service-grid mt-24">{services.map((s) => <ServiceCard key={s.id} s={s} />)}</div>
            <ol className="steps mt-48">
              <li><span className="faint small">01</span><p className="t">Request</p><p className="d">Choose a service and send your request.</p></li>
              <li><span className="faint small">02</span><p className="t">Approval</p><p className="d">The mentor accepts or declines. You get an email either way.</p></li>
              <li><span className="faint small">03</span><p className="t">Schedule</p><p className="d">Pick a time on the mentor’s calendar from your dashboard.</p></li>
            </ol>
          </section>
        </div>
      </div>
      <div className="mt-48" style={{ marginTop: 'var(--gap-section)' }}>
        <Link to="/mentors" className="ul link row">Browse all mentors <Arrow /></Link>
      </div>
    </div>
  );
}
