import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import * as api from './api.js';
import * as platform from './platform.js';
import { useAuth } from './auth.jsx';
import { STAFF_SECTIONS, PERMISSIONS, ROLES } from './permissions.js';
import { download, fmtDate, timeAgo, toCsv, useLoad, useTitle } from './util.js';
import { ErrorMsg, Loading } from './Bits.jsx';
import { Stat, Status } from './Ui.jsx';
import { AdminPanel, Collection, EmailsPanel, SettingsPanel } from './Dashboard.jsx';
import { TicketThread } from './Support.jsx';
import { AssignBox } from './Portfolio.jsx';
import { Finance, Payouts, Commission } from './StaffFinance.jsx';
import { rupees } from './money.js';

// ------------------------------------------------------------ two-step sign-in
export function MfaPanel({ onDone }) {
  const { data, loading, reload } = useLoad(platform.mfaState);
  const [enroll, setEnroll] = useState(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  if (loading) return <Loading />;
  const has = data.factors.length > 0;
  const verify = async (factorId) => {
    setMsg('');
    try { await platform.mfaVerify(factorId, code.trim()); setCode(''); setEnroll(null); await reload(); onDone?.(); setMsg('Two-step sign-in is active for this session.'); } catch (e) { setMsg(e.message); }
  };
  return (
    <div className="panel stack gap-16" style={{ maxWidth: 620 }}>
      <p className="h-m">Two-step sign-in</p>
      {has && data.aal === 'aal2' && <p>On, and verified for this session. <Status s="approved" label="secure" /></p>}
      {has && data.aal !== 'aal2' && (
        <form className="stack gap-8" onSubmit={(e) => { e.preventDefault(); verify(data.factors[0].id); }}>
          <label htmlFor="mfa-c">Enter the 6-digit code from your authenticator app</label>
          <input id="mfa-c" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }}>Verify</button>
        </form>
      )}
      {!has && !enroll && (
        <>
          <p className="muted">Finance, staff and audit tools need a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) in addition to your password.</p>
          <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={async () => { setMsg(''); try { setEnroll(await platform.mfaEnroll()); } catch (e) { setMsg(e.message); } }}>Set up two-step sign-in</button>
        </>
      )}
      {enroll && (
        <form className="stack gap-8" onSubmit={(e) => { e.preventDefault(); verify(enroll.id); }}>
          {enroll.qr ? <img src={enroll.qr} alt="QR code for your authenticator app" width="180" height="180" style={{ background: '#fff' }} /> : null}
          <p className="small">Scan the QR code, or type this key: <code>{enroll.secret}</code></p>
          <label htmlFor="mfa-n">Then enter the 6-digit code it shows</label>
          <input id="mfa-n" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }}>Turn on</button>
        </form>
      )}
      {msg && <p className="small" role="status">{msg}</p>}
    </div>
  );
}

// ------------------------------------------------------------ staff login
export function StaffLogin() {
  useTitle('Staff sign-in');
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [step, setStep] = useState('password');
  const [msg, setMsg] = useState('');
  const after = async () => {
    await platform.acceptStaffInvite();
    const perms = await platform.myPermissions();
    if (!Object.keys(perms).length) { setMsg('This account has no staff access. If you were invited, sign in with the invited email after confirming it.'); return; }
    const m = await platform.mfaState();
    if (m.factors.length && m.aal !== 'aal2') { setStep('mfa'); return; }
    await platform.logEvent('staff.sign_in');
    await refresh();
    navigate('/staff');
  };
  return (
    <div className="wrap page-top" style={{ maxWidth: 520 }}>
      <p className="label">Staff workspace</p>
      <h1 className="h-l mt-16">Sign in</h1>
      {step === 'password' && (
        <form className="stack gap-16 mt-32" onSubmit={async (e) => {
          e.preventDefault(); setMsg('');
          try { await api.signIn(f); await after(); } catch (err) { setMsg(err.message); }
        }}>
          <div className="field"><label htmlFor="sl-e">Email</label><input id="sl-e" type="email" autoComplete="username" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="sl-p">Password</label><input id="sl-p" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }}>Sign in</button>
          <p className="small muted">New team member? Create an account with the email your invitation was sent to (<Link className="ul" to="/signup?next=/staff/login">sign up</Link>), confirm it, then sign in here. <Link className="ul" to="/forgot-password">Forgot password?</Link></p>
        </form>
      )}
      {step === 'mfa' && <div className="mt-32"><MfaPanel onDone={after} /></div>}
      {msg && <p className="err mt-16" role="alert">{msg}</p>}
      {api.DEMO && <p className="small muted mt-32">Demo: staff@demo.archmentor (support, bookings, portfolio, content, email, analytics) or finance@demo.archmentor (two-step code 123456) — password demo1234. admin@demo.archmentor has everything.</p>}
    </div>
  );
}

// ------------------------------------------------------------ sections
function Overview({ perms, profile }) {
  const a = useLoad(() => (perms['analytics.read'] === true ? platform.analyticsSummary(30) : null), []);
  const f = useLoad(() => (perms['finance.read'] === true ? platform.financeSummary(30) : null), []);
  const needsMfa = Object.values(perms).includes('mfa');
  return (
    <div className="stack gap-32">
      <div>
        <h1 className="h-l">Hello, {profile.full_name?.split(' ')[0] || 'there'}.</h1>
        <p className="muted mt-8">You can use {Object.values(perms).filter((v) => v === true).length} of {PERMISSIONS.length} tools{needsMfa ? ' — more unlock after two-step sign-in.' : '.'}</p>
      </div>
      {needsMfa && <MfaPanel onDone={() => window.location.reload()} />}
      {a.data && (
        <div className="stats">
          <Stat label="New people (30 days)" value={a.data.new_users} />
          <Stat label="Mentors live / waiting" value={`${a.data.mentors_live} / ${a.data.mentors_waiting}`} />
          <Stat label="Bookings (30 days)" value={Object.values(a.data.bookings || {}).reduce((x, y) => x + y, 0)} />
          <Stat label="Open tickets" value={a.data.tickets_open} />
        </div>
      )}
      {f.data && (
        <div className="stats">
          <Stat label="Collected (30 days)" value={rupees(f.data.collected)} />
          <Stat label="Commission" value={rupees(f.data.commission)} />
          <Stat label="Owed to mentors" value={rupees(f.data.owed_to_mentors)} />
          <Stat label="Open refunds" value={f.data.open_refunds} note={`Payments: ${f.data.mode}`} />
        </div>
      )}
    </div>
  );
}

function Calls() {
  const { data, error, loading, reload } = useLoad(() => platform.staffList('call_requests'));
  const [open, setOpen] = useState(null);
  const notes = useLoad(() => (open ? platform.listCallNotes(open) : []), [open]);
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState('new');
  if (loading) return <Loading />;
  const rows = (data || []).filter((c) => filter === 'all' || (filter === 'new' ? ['new', 'scheduled', 'no_answer'].includes(c.status) : c.status === filter));
  return (
    <section className="stack gap-16">
      <h2 className="h-m">Call-back requests</h2>
      <div className="choice-row">{[['new', 'To do'], ['done', 'Done'], ['all', 'All']].map(([k, l]) => <button key={k} type="button" className="choice" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <ErrorMsg error={error} />
      {!rows.length && <p className="empty">Nothing here.</p>}
      {rows.map((c) => (
        <div key={c.id} className="card-line stack gap-8">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 18 }}>{c.name} · <a className="ul" href={`tel:${c.phone}`}>{c.phone}</a> · <a className="ul" href={`mailto:${c.email}`}>{c.email}</a></p>
            <Status s={c.status === 'done' ? 'approved' : 'pending'} label={c.status} />
          </div>
          <p className="small muted">{c.topic} · best time: {c.preferred_time || '—'} · {timeAgo(c.created_at)}</p>
          {c.message && <p style={{ whiteSpace: 'pre-line' }}>{c.message}</p>}
          <div className="actions">
            {['scheduled', 'done', 'no_answer', 'closed'].map((s) => <button key={s} type="button" className="ul small" onClick={async () => {
              const patch = { id: c.id, status: s };
              if (s === 'scheduled') { const t = window.prompt('Call time (YYYY-MM-DD HH:MM, India time)'); if (!t) return; patch.scheduled_at = new Date(`${t.replace(' ', 'T')}:00+05:30`).toISOString(); }
              await platform.staffSave('call_requests', patch); reload();
            }}>{s.replace('_', ' ')}</button>)}
            <button type="button" className="ul small" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide notes' : 'Notes'}</button>
          </div>
          {open === c.id && (
            <div className="stack gap-8">
              {(notes.data || []).map((n) => <p key={n.id} className="small"><span className="muted">{fmtDate(n.created_at, true)}:</span> {n.body}</p>)}
              <form className="form-row" onSubmit={async (e) => { e.preventDefault(); await platform.addCallNote(c.id, note); setNote(''); notes.reload(); }}>
                <input aria-label="Add a note" value={note} onChange={(e) => setNote(e.target.value)} required placeholder="What was discussed / next step" />
                <button className="btn" type="submit">Add note</button>
              </form>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function SupportQueue() {
  const { data, loading, reload } = useLoad(platform.listTickets);
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('open');
  if (loading) return <Loading />;
  const rows = (data || []).filter((t) => filter === 'all' || (filter === 'open' ? ['open', 'waiting'].includes(t.status) : t.status === filter));
  if (open) return <div className="stack gap-16"><button type="button" className="ul" style={{ alignSelf: 'flex-start' }} onClick={() => { setOpen(null); reload(); }}>← All tickets</button><TicketThread id={open} staff /></div>;
  return (
    <section className="stack gap-16">
      <h2 className="h-m">Support tickets</h2>
      <div className="choice-row">{[['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => <button key={k} type="button" className="choice" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
      {!rows.length && <p className="empty">No tickets.</p>}
      {rows.map((t) => (
        <button key={t.id} type="button" className="card-line hover-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left' }} onClick={() => setOpen(t.id)}>
          <span>{t.priority === 'high' && <b style={{ color: 'var(--bad)', fontWeight: 500 }}>High · </b>}{t.subject}<br /><span className="small muted">{t.name} · {t.category} · {timeAgo(t.updated_at)}</span></span>
          <Status s={t.status === 'open' ? 'pending' : 'approved'} label={t.status} />
        </button>
      ))}
    </section>
  );
}

function PortfolioQueue({ perms }) {
  const { data, loading, reload } = useLoad(platform.listPortfolios);
  const [filter, setFilter] = useState('submitted');
  if (loading) return <Loading />;
  const rows = (data || []).filter((p) => filter === 'all' || p.status === filter || (filter === 'active' && ['assigned', 'in_review', 'revision_requested', 'feedback_ready'].includes(p.status)));
  return (
    <section className="stack gap-24">
      <h2 className="h-m">Portfolio reviews</h2>
      <div className="choice-row">{[['submitted', 'To assign'], ['active', 'In progress'], ['completed', 'Completed'], ['all', 'All']].map(([k, l]) => <button key={k} type="button" className="choice" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
      {!rows.length && <p className="empty">Nothing here.</p>}
      {rows.map((p) => (
        <div key={p.id} className="card-line stack gap-8">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <Link className="ul" to={`/portfolio/${p.id}`} style={{ fontSize: 18 }}>{p.title}</Link>
            <Status s="pending" label={p.status} />
          </div>
          <p className="small muted">{p.student_name} · {p.target} · {p.mentor_name ? `mentor ${p.mentor_name}` : 'not assigned'}{p.due_at ? ` · due ${fmtDate(p.due_at)}` : ''}</p>
          {perms['portfolio.assign'] === true && ['submitted', 'assigned', 'in_review', 'revision_requested'].includes(p.status) && <AssignBox project={p} onDone={reload} />}
        </div>
      ))}
      {perms['portfolio.assign'] === true && (
        <Collection table="portfolio_review_types" title="Review types" noDelete
          source={{ list: () => platform.reviewTypes(true), save: (r) => platform.staffSave('portfolio_review_types', r), del: (id) => platform.staffDelete('portfolio_review_types', id) }}
          columns={[['title', 'Title'], ['price_paise', 'Price', (r) => (r.price_paise ? rupees(r.price_paise) : 'Free')], ['turnaround_days', 'Days'], ['active', 'Active', (r) => (r.active ? 'yes' : 'no')]]}
          blank={{ title: '', description: '', price_paise: 0, turnaround_days: 7, active: true, sort: 0 }}
          prepare={(r) => ({ ...r, price_paise: Math.round(Number(r.price_paise) || 0), turnaround_days: Number(r.turnaround_days) || 7, sort: Number(r.sort) || 0 })}
          fields={[{ key: 'title', label: 'Title', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'price_paise', label: 'Price in paise (₹1 = 100; 0 = free)', type: 'number' }, { key: 'turnaround_days', label: 'Reply within (days)', type: 'number' }, { key: 'sort', label: 'Order', type: 'number' }, { key: 'active', label: 'Students can choose it', type: 'checkbox' }]} />
      )}
    </section>
  );
}

function ContentSection() {
  return (
    <div className="stack gap-64">
      <AdminPanel tab="videos" />
      <Collection table="opportunities" title="Opportunities"
        source={{ list: () => platform.staffList('opportunities'), save: (r) => platform.staffSave('opportunities', r), del: (id) => platform.staffDelete('opportunities', id) }}
        columns={[['title', 'Title', (r) => <>{r.title}<br /><span className="small muted">{r.organisation}</span></>], ['kind', 'Type'], ['deadline', 'Deadline', (r) => (r.deadline ? fmtDate(r.deadline) : 'rolling')], ['published', 'Live', (r) => (r.published ? 'yes' : 'no')]]}
        blank={{ title: '', organisation: '', kind: 'Internship', location: '', remote: false, url: '', description: '', deadline: '', published: true }}
        prepare={(r) => ({ ...r, deadline: r.deadline || null })}
        fields={[{ key: 'title', label: 'Title', required: true }, { key: 'organisation', label: 'Office / organiser' }, { key: 'kind', label: 'Type', type: 'select', options: ['Internship', 'Job', 'Competition', 'Scholarship', 'Workshop', 'Fellowship'].map((x) => [x, x]) },
          { key: 'location', label: 'Location' }, { key: 'remote', label: 'Remote', type: 'checkbox' }, { key: 'url', label: 'Link to apply', type: 'url' }, { key: 'deadline', label: 'Deadline', type: 'date' }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'published', label: 'Show on the site', type: 'checkbox' }]} />
      <Collection table="resources" title="Resources"
        source={{ list: () => platform.staffList('resources'), save: (r) => platform.staffSave('resources', r), del: (id) => platform.staffDelete('resources', id) }}
        columns={[['title', 'Title'], ['kind', 'Type'], ['published', 'Live', (r) => (r.published ? 'yes' : 'no')]]}
        blank={{ title: '', kind: 'Guide', description: '', url: '', cover_url: '', published: true, sort: 0 }}
        prepare={(r) => ({ ...r, sort: Number(r.sort) || 0 })}
        fields={[{ key: 'title', label: 'Title', required: true }, { key: 'kind', label: 'Type', type: 'select', options: ['Guide', 'Template', 'Checklist', 'Reading list', 'Tool'].map((x) => [x, x]) },
          { key: 'description', label: 'Description', type: 'textarea' }, { key: 'url', label: 'Link (or upload below and paste the address)', type: 'url' }, { key: 'cover_url', label: 'Cover image', type: 'image' }, { key: 'sort', label: 'Order', type: 'number' }, { key: 'published', label: 'Show on the site', type: 'checkbox' }]} />
      <ResourceUpload />
    </div>
  );
}

function ResourceUpload() {
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <div className="panel stack gap-8" style={{ maxWidth: 620 }}>
      <p className="label">Upload a file for a resource</p>
      <input type="file" accept="application/pdf,image/*,.docx,.zip" aria-label="Resource file" onChange={async (e) => { setMsg(''); try { setUrl(await platform.uploadResourceFile(e.target.files[0])); } catch (err) { setMsg(err.message); } }} />
      {url && <p className="small">Paste this address into the resource’s link: <code style={{ wordBreak: 'break-all' }}>{url}</code></p>}
      {msg && <p className="err">{msg}</p>}
    </div>
  );
}

function Reports() {
  const { data, loading, reload } = useLoad(() => platform.staffList('forum_reports'));
  if (loading) return <Loading />;
  const open = (data || []).filter((r) => r.status === 'open');
  return (
    <section className="stack gap-16 mt-48">
      <h2 className="h-m">Reports from members ({open.length})</h2>
      {!open.length && <p className="empty">No open reports.</p>}
      {open.map((r) => (
        <div key={r.id} className="card-line" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>{r.item_kind === 'question' ? <Link className="ul" to={`/community/${r.item_id}`}>Question</Link> : 'Answer'} — “{r.reason}” <span className="small muted">· {timeAgo(r.created_at)}</span></span>
          <span className="actions"><button type="button" className="ul" onClick={async () => { await platform.moderateReport(r.id, true); reload(); }}>Hide it</button><button type="button" className="ul" onClick={async () => { await platform.moderateReport(r.id, false); reload(); }}>Keep it</button></span>
        </div>
      ))}
    </section>
  );
}

function Campaigns() {
  const { profile } = useAuth();
  const [msg, setMsg] = useState('');
  return (
    <div className="stack gap-24">
      <p className="small muted">Campaigns go to people who have not unsubscribed. Another team member must approve a campaign before it is sent (the main admin may approve their own). Big lists are sent in daily batches to stay within the email plan.</p>
      <Collection table="email_campaigns" title="Email campaigns"
        source={{ list: () => platform.staffList('email_campaigns'), save: (r) => platform.staffSave('email_campaigns', r), del: (id) => platform.staffDelete('email_campaigns', id) }}
        columns={[['subject', 'Subject'], ['audience', 'To'], ['status', 'Status', (r) => <Status s={r.status === 'sent' ? 'approved' : 'pending'} label={r.status} />], ['sent_count', 'Sent', (r) => `${r.sent_count || 0}${r.total ? ` / ${r.total}` : ''}`]]}
        extra={(r, reload) => (
          <>
            {r.status === 'draft' && <button type="button" className="ul" onClick={async () => { setMsg(''); try { await platform.setCampaignStatus(r.id, 'approved'); reload(); } catch (e) { setMsg(e.message); } }}>Approve</button>}
            {['approved', 'sending'].includes(r.status) && <button type="button" className="ul" onClick={async () => {
              if (!window.confirm(`Send “${r.subject}” to ${r.audience} now?`)) return; setMsg('');
              try { const res = await platform.sendCampaign(r.id); setMsg(`Sent ${res.sent_now}.${res.remaining ? ` ${res.remaining} more go out automatically tomorrow.` : ''}`); reload(); } catch (e) { setMsg(e.message); }
            }}>Send</button>}
          </>
        )}
        blank={{ subject: '', heading: '', body: '', cta_label: '', cta_url: '', audience: 'subscribers', created_by: profile?.id }}
        prepare={({ status, approved_by, sent_count, total, sent_at, ...r }) => r}
        fields={[{ key: 'subject', label: 'Subject', required: true }, { key: 'heading', label: 'Heading inside the email' }, { key: 'body', label: 'Message (plain text; blank line = new paragraph)', type: 'textarea', rows: 8, required: true },
          { key: 'cta_label', label: 'Button text (optional)' }, { key: 'cta_url', label: 'Button link', type: 'url' },
          { key: 'audience', label: 'Send to', type: 'select', options: [['subscribers', 'Newsletter subscribers'], ['students', 'Students'], ['mentors', 'Verified mentors'], ['everyone', 'Everyone (subscribers + members)']] }]} />
      {msg && <p className="small" role="status">{msg}</p>}
    </div>
  );
}

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="bars" role="list">
      {rows.map((r) => <div key={r.label} className="bar-row" role="listitem"><span className="small">{r.label}</span><span className="bar"><i style={{ width: `${(r.n / max) * 100}%` }} /></span><span className="num small">{r.n}</span></div>)}
    </div>
  );
}

function Analytics() {
  const [days, setDays] = useState(30);
  const { data, error, loading } = useLoad(() => platform.analyticsSummary(days), [days]);
  if (loading) return <Loading />;
  if (error) return <ErrorMsg error={error} />;
  return (
    <section className="stack gap-32">
      <div className="choice-row">{[7, 30, 90, 365].map((d) => <button key={d} type="button" className="choice" aria-pressed={days === d} onClick={() => setDays(d)}>{d} days</button>)}</div>
      <div className="stats">
        <Stat label="New people" value={data.new_users} />
        <Stat label="Live-session seats" value={data.registrations} />
        <Stat label="Questions / answers" value={`${data.questions} / ${data.answers}`} />
        <Stat label="Subscribers" value={data.subscribers} />
        <Stat label="Portfolio reviews" value={data.portfolios} />
        <Stat label="Payments" value={rupees(data.revenue_paise)} />
        <Stat label="Emails sent" value={data.emails_sent} />
      </div>
      <div className="grid-2">
        <div><p className="label">People by role</p><Bars rows={Object.entries(data.users || {}).map(([label, n]) => ({ label, n }))} /></div>
        <div><p className="label">Bookings by status</p><Bars rows={Object.entries(data.bookings || {}).map(([label, n]) => ({ label: label.replace('_', ' '), n }))} /></div>
        <div><p className="label">Sign-ups per week</p><Bars rows={(data.signups_by_week || []).map((w) => ({ label: w.week, n: w.n }))} /></div>
        <div><p className="label">Most-booked mentors</p><Bars rows={(data.top_mentors || []).map((m) => ({ label: m.name, n: m.n }))} /></div>
      </div>
    </section>
  );
}

function Audit() {
  const { data, error, loading } = useLoad(platform.listAudit);
  const [q, setQ] = useState('');
  if (loading) return <Loading />;
  const rows = (data || []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="stack gap-16">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="h-m">Audit log</h2>
        <div className="actions"><input type="search" aria-label="Filter" placeholder="Filter" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="ul" onClick={() => { download('audit-log.csv', toCsv(rows.map((r) => ({ ...r, details: JSON.stringify(r.details) })))); platform.logEvent('export', { table: 'audit_logs', rows: rows.length }); }}>Download CSV</button></div>
      </div>
      <p className="small muted">Every sensitive change is recorded here and cannot be edited or deleted — not even by the main admin.</p>
      <ErrorMsg error={error} />
      <div className="table-box"><table className="data">
        <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td className="small">{fmtDate(r.created_at, true)}</td><td className="small">{r.actor_email || 'system'}</td><td>{r.action}<br /><span className="small muted">{r.entity} {String(r.entity_id || '').slice(0, 8)}</span></td><td className="small"><code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(r.details).slice(0, 300)}</code></td></tr>)}</tbody>
      </table></div>
    </section>
  );
}

function StaffAdmin() {
  const { user } = useAuth();
  const members = useLoad(platform.listStaff);
  const invites = useLoad(platform.listInvites);
  const [inv, setInv] = useState({ email: '', name: '', roles: [] });
  const [msg, setMsg] = useState('');
  const [over, setOver] = useState({});
  const run = async (fn, ok) => { setMsg(''); try { await fn(); setMsg(ok); members.reload(); invites.reload(); } catch (e) { setMsg(e.message); } };
  const toggle = (arr, k) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  return (
    <section className="stack gap-48">
      <form className="panel stack gap-16" onSubmit={(e) => { e.preventDefault(); run(() => platform.inviteStaff(inv.email, inv.name, inv.roles), `Invitation emailed to ${inv.email}.`).then(() => setInv({ email: '', name: '', roles: [] })); }}>
        <p className="h-m">Invite a team member</p>
        <div className="form-row">
          <div className="field"><label htmlFor="iv-e">Email</label><input id="iv-e" type="email" required value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="iv-n">Name</label><input id="iv-n" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} /></div>
        </div>
        <fieldset className="role-grid"><legend className="small">Roles (start small — you can add more later)</legend>
          {Object.entries(ROLES).map(([k, r]) => <label key={k} className="check small"><input type="checkbox" checked={inv.roles.includes(k)} onChange={() => setInv({ ...inv, roles: toggle(inv.roles, k) })} /> {r.label}</label>)}
        </fieldset>
        <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }}>Send invitation</button>
      </form>
      {msg && <p className="small" role="status">{msg}</p>}
      {(invites.data || []).length > 0 && (
        <div className="stack gap-8"><p className="label">Waiting to accept</p>
          {invites.data.map((i) => <p key={i.id} className="small">{i.email} · {i.role_keys.map((r) => ROLES[r]?.label || r).join(', ')} · <button type="button" className="ul" onClick={() => run(() => platform.revokeInvite(i.id), 'Invitation revoked.')}>Revoke</button></p>)}
        </div>
      )}
      <div className="stack gap-16">
        <p className="label">Team</p>
        {members.loading && <Loading />}
        {(members.data || []).map((m) => (
          <div key={m.user_id} className="card-line stack gap-16">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 18 }}>{m.full_name || m.email} <span className="small muted">{m.email}</span></p>
              <span className="actions"><Status s={m.status === 'active' ? 'approved' : 'declined'} label={m.status} />
                {m.user_id !== user.id && <button type="button" className="ul small" onClick={() => window.confirm(m.status === 'active' ? `Suspend ${m.email}? They are signed out everywhere.` : 'Reactivate?') && run(() => platform.setStaffStatus(m.user_id, m.status === 'active' ? 'suspended' : 'active'), 'Updated.')}>{m.status === 'active' ? 'Suspend' : 'Reactivate'}</button>}</span>
            </div>
            <fieldset className="role-grid" disabled={m.user_id === user.id}><legend className="small">Roles</legend>
              {Object.entries(ROLES).map(([k, r]) => <label key={k} className="check small" title={r.perms.join(', ')}><input type="checkbox" checked={m.roles.includes(k)} onChange={() => run(() => platform.setStaffRoles(m.user_id, toggle(m.roles, k)), 'Roles updated.')} /> {r.label}</label>)}
            </fieldset>
            <details>
              <summary className="small">Individual permissions ({m.overrides.length} changed)</summary>
              <div className="stack gap-8 mt-16">
                {PERMISSIONS.filter((p) => !['staff.invite', 'staff.permissions.manage', 'settings.manage'].includes(p.key)).map((p) => {
                  const o = m.overrides.find((x) => x.permission === p.key);
                  const fromRole = m.roles.some((r) => ROLES[r]?.perms.includes(p.key));
                  const key = `${m.user_id}:${p.key}`;
                  return (
                    <div key={p.key} className="perm-row">
                      <span className="small">{p.label} <span className="faint">({p.key}{p.sensitive ? ', needs two-step' : ''})</span></span>
                      <span className="small muted">{o ? (o.allow ? 'granted' : 'blocked') : fromRole ? 'from role' : '—'}</span>
                      <input aria-label={`Reason for ${p.key}`} placeholder="Reason" value={over[key] || ''} onChange={(e) => setOver({ ...over, [key]: e.target.value })} />
                      <span className="actions">
                        <button type="button" className="ul small" onClick={() => run(() => platform.setOverride(m.user_id, p.key, true, over[key]), 'Granted.')}>Grant</button>
                        <button type="button" className="ul small" onClick={() => run(() => platform.setOverride(m.user_id, p.key, false, over[key]), 'Blocked.')}>Block</button>
                        {o && <button type="button" className="ul small" onClick={() => run(() => platform.setOverride(m.user_id, p.key, null, over[key] || 'reset'), 'Reset.')}>Reset</button>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------ workspace shell
export default function StaffWorkspace() {
  const { section = 'overview' } = useParams();
  const { user, profile, loading } = useAuth();
  const [perms, setPerms] = useState(null);
  useTitle('Staff workspace');
  useEffect(() => { if (user) platform.myPermissions().then(setPerms).catch(() => setPerms({})); }, [user?.id]);
  if (loading || (user && !perms)) return <div className="wrap page-top"><Loading /></div>;
  if (!user) return <Navigate to="/staff/login" replace />;
  if (!Object.keys(perms).length) return <div className="wrap page-top"><p className="lead">This account does not have staff access.</p><p className="mt-16"><Link className="ul" to="/dashboard">Go to your dashboard</Link></p></div>;
  const visible = STAFF_SECTIONS.filter((s) => !s.any.length || s.any.some((k) => perms[k]));
  const sec = visible.find((s) => s.id === section) || visible[0];
  const locked = sec.any.length && !sec.any.some((k) => perms[k] === true);
  const can = (k) => perms[k] === true;
  return (
    <div className="staff">
      <aside className="staff-nav" aria-label="Staff sections">
        <p className="label" style={{ padding: '0 16px 12px' }}>{profile?.role === 'admin' ? 'Main admin' : 'Staff'}</p>
        {visible.map((s) => {
          const needs = s.any.length && !s.any.some((k) => perms[k] === true);
          return <NavLink key={s.id} to={`/staff/${s.id}`} className={({ isActive }) => (isActive || (s.id === 'overview' && section === 'overview') ? 'active' : '')}>{s.label}{needs ? ' 🔒' : ''}</NavLink>;
        })}
      </aside>
      <main className="staff-main" id="staff-main">
        {locked ? <MfaPanel onDone={() => platform.myPermissions().then(setPerms)} /> : (
          <>
            {sec.id === 'overview' && <Overview perms={perms} profile={profile} />}
            {sec.id === 'people' && <AdminPanel tab="people" />}
            {sec.id === 'bookings' && <AdminPanel tab="requests" />}
            {sec.id === 'sessions' && <AdminPanel tab="sessions" />}
            {sec.id === 'calls' && <Calls />}
            {sec.id === 'support' && <SupportQueue />}
            {sec.id === 'portfolio' && <PortfolioQueue perms={perms} />}
            {sec.id === 'journal' && <div className="stack gap-64"><AdminPanel tab="posts" /><AdminPanel tab="submissions" /></div>}
            {sec.id === 'content' && <ContentSection />}
            {sec.id === 'community' && <><AdminPanel tab="community" /><Reports /></>}
            {sec.id === 'campaigns' && <div className="stack gap-64"><Campaigns /><AdminPanel tab="subscribers" /></div>}
            {sec.id === 'emails' && <EmailsPanel />}
            {sec.id === 'finance' && <Finance can={can} />}
            {sec.id === 'payouts' && <Payouts can={can} />}
            {sec.id === 'commission' && <Commission />}
            {sec.id === 'analytics' && <Analytics />}
            {sec.id === 'audit' && <Audit />}
            {sec.id === 'staff' && <StaffAdmin />}
            {sec.id === 'settings' && <div className="stack gap-48"><SettingsPanel /><MfaPanel /></div>}
          </>
        )}
      </main>
    </div>
  );
}
