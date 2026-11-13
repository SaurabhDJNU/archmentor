import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import * as api from './api.js';
import { useAuth } from './auth.jsx';
import { ROLE_LABEL, download, fmtDate, fmtPrice, fmtSessionTime, slugify, timeAgo, toCsv, useLoad, useTitle, youtubeId } from './util.js';
import { EXPERTISE, SERVICE_CATEGORIES, WORKS_WITH } from './seed.js';
import { ErrorMsg, Loading } from './Bits.jsx';
import ImageInput from './ImageInput.jsx';

const Status = ({ s, label }) => <span className={`status ${s}`}>{label || s}</span>;

function Tabs({ tabs, active, setActive }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => setActive(id)}>{label}</button>)}
    </div>
  );
}

// Tab kept in the address (?tab=…) so links from emails and reloads land in the right place
function useTab(first) {
  const [params, setParams] = useSearchParams();
  return [params.get('tab') || first, (t) => setParams(t === first ? {} : { tab: t }, { replace: true })];
}

// ------------------------------------------------------------ profile editor
function ProfileForm({ profile }) {
  const { refresh } = useAuth();
  const role = profile.role;
  const isMentor = role === 'mentor';
  const [f, setF] = useState(() => ({
    full_name: profile.full_name || '', stage: profile.stage || '', title: profile.title || '', organisation: profile.organisation || '',
    bio: profile.bio || '', photo_url: profile.photo_url || '', linkedin_url: profile.linkedin_url || '', portfolio_url: profile.portfolio_url || '',
    calendly_url: profile.calendly_url || '', expertise: profile.expertise || '', experience: profile.experience || '', works_with: profile.works_with || [],
  }));
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (w) => setF({ ...f, works_with: f.works_with.includes(w) ? f.works_with.filter((x) => x !== w) : [...f.works_with, w] });
  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try { await api.updateMyProfile(f); await refresh(); setState({ status: 'saved', msg: 'Saved.' }); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  return (
    <form onSubmit={submit} className="stack gap-24" style={{ maxWidth: 760 }}>
      <div className="form-row">
        <div className="field"><label htmlFor="p-name">Full name</label><input id="p-name" required value={f.full_name} onChange={set('full_name')} /></div>
        {role === 'student' && <div className="field"><label htmlFor="p-stage">Year or stage</label><input id="p-stage" value={f.stage} onChange={set('stage')} placeholder="e.g. 4th year B.Arch" /></div>}
        {role !== 'student' && <div className="field"><label htmlFor="p-title">Title</label><input id="p-title" value={f.title} onChange={set('title')} placeholder="e.g. Practising Architect" /></div>}
      </div>
      {role !== 'student' && (
        <div className="form-row">
          <div className="field"><label htmlFor="p-org">Firm, school or university</label><input id="p-org" value={f.organisation} onChange={set('organisation')} /></div>
          <div className="field"><label htmlFor="p-li">LinkedIn link</label><input id="p-li" type="url" value={f.linkedin_url} onChange={set('linkedin_url')} placeholder="https://www.linkedin.com/in/…" /></div>
        </div>
      )}
      {isMentor && (
        <>
          <div className="form-row">
            <div className="field"><label htmlFor="p-exp">Main expertise</label><select id="p-exp" value={f.expertise} onChange={set('expertise')}><option value="">Choose…</option>{EXPERTISE.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="field"><label htmlFor="p-years">Experience</label><input id="p-years" value={f.experience} onChange={set('experience')} placeholder="e.g. 20+ years" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="p-cal">Calendly link (approved students book a time here)</label><input id="p-cal" type="url" value={f.calendly_url} onChange={set('calendly_url')} placeholder="https://calendly.com/your-name" /></div>
            <div className="field"><label htmlFor="p-port">Portfolio or website</label><input id="p-port" type="url" value={f.portfolio_url} onChange={set('portfolio_url')} placeholder="https://…" /></div>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small muted" style={{ marginBottom: 4 }}>I work with</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 24px' }}>
              {WORKS_WITH.map((w) => <label key={w} className="check"><input type="checkbox" checked={f.works_with.includes(w)} onChange={() => toggle(w)} /> {w}</label>)}
            </div>
          </fieldset>
        </>
      )}
      {role !== 'student' && <div className="field"><label htmlFor="p-bio">{isMentor ? 'About you (shown on your profile)' : 'Short bio'}</label><textarea id="p-bio" rows={5} value={f.bio} onChange={set('bio')} /></div>}
      <ImageInput id="p-photo" label="Profile photo" shape="portrait" value={f.photo_url} onChange={(url) => setF({ ...f, photo_url: url })} />
      <div className="actions">
        <button type="submit" className="btn" disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Saving…' : 'Save profile'}</button>
        {state.status === 'saved' && <span className="small muted" role="status">{state.msg}</span>}
        {state.status === 'error' && <span className="err" role="alert">{state.msg}</span>}
        {isMentor && <Link to={`/mentors/${profile.id}`} className="ul small">View public profile</Link>}
      </div>
    </form>
  );
}

// ------------------------------------------------------------ bookings
function RequestRow({ r, as, onChange }) {
  const [link, setLink] = useState(r.meeting_link || '');
  const [note, setNote] = useState(r.mentor_note || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const act = async (patch, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setErr('');
    try { await api.updateRequest(r.id, patch); onChange(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const who = as === 'mentor' ? r.student_name : r.mentor_name;
  const what = r.service_title || r.service || 'Mentorship session';
  return (
    <div className="card-line">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ fontSize: 20 }}>{what} · <span className="muted">{as === 'mentor' ? 'from' : 'with'} {who}</span></p>
        <Status s={r.status} />
      </div>
      <p className="small muted mt-8">{[r.duration_min && `${r.duration_min} min`, fmtPrice(r.price_inr), r.stage, r.preferred_time && `Prefers: ${r.preferred_time}`, `Sent ${fmtDate(r.created_at)}`].filter(Boolean).join(' · ')}</p>
      {as === 'mentor' && r.student_email && <p className="small mt-8">Student email: <a className="ul" href={`mailto:${r.student_email}`}>{r.student_email}</a></p>}
      <p className="mt-16" style={{ whiteSpace: 'pre-line', color: 'var(--ink-2)', maxWidth: '70ch' }}>{r.message}</p>

      {as === 'student' && r.status === 'approved' && (
        <div className="panel mt-16 stack gap-8" style={{ padding: 20 }}>
          <p><b style={{ fontWeight: 500 }}>Approved.</b> {r.calendly_url ? 'Pick a time that suits you on the mentor’s calendar.' : 'The mentor will confirm the time with you.'}</p>
          {r.mentor_note && <p style={{ whiteSpace: 'pre-line' }}>{r.mentor_note}</p>}
          {r.meeting_link && <p>Meeting link: <a className="ul" href={r.meeting_link} target="_blank" rel="noopener noreferrer">{r.meeting_link}</a></p>}
          {r.calendly_url && <a className="btn" style={{ alignSelf: 'flex-start' }} href={r.calendly_url} target="_blank" rel="noopener noreferrer">Schedule on Calendly ↗</a>}
        </div>
      )}
      {as === 'student' && r.status === 'declined' && r.mentor_note && <p className="panel mt-16" style={{ padding: 16, whiteSpace: 'pre-line' }}>{r.mentor_note}</p>}
      {as === 'student' && ['pending', 'approved'].includes(r.status) && (
        <div className="actions mt-16"><button type="button" className="ul" disabled={busy} onClick={() => act({ status: 'cancelled' }, 'Cancel this request? The mentor will be told by email.')}>Cancel request</button></div>
      )}

      {as === 'mentor' && ['pending', 'approved'].includes(r.status) && (
        <div className="stack gap-16 mt-24" style={{ maxWidth: 640 }}>
          <div className="field"><label htmlFor={`ml-${r.id}`}>Meeting link (optional: Google Meet, Zoom…)</label><input id={`ml-${r.id}`} type="url" value={link} onChange={(e) => setLink(e.target.value)} /></div>
          <div className="field"><label htmlFor={`mn-${r.id}`}>Note to the student (sent by email)</label><textarea id={`mn-${r.id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please book a slot this week and bring your portfolio PDF." /></div>
          <div className="actions">
            <button type="button" className="btn" disabled={busy} onClick={() => act({ status: 'approved', meeting_link: link, mentor_note: note })}>{r.status === 'approved' ? 'Update and email the student' : 'Approve and email the student'}</button>
            {r.status === 'pending' && <button type="button" className="ul" disabled={busy} onClick={() => act({ status: 'declined', mentor_note: note }, 'Decline this request? The student will be told by email.')}>Decline</button>}
            {r.status === 'approved' && <button type="button" className="ul" disabled={busy} onClick={() => act({ status: 'done' })}>Mark as done</button>}
          </div>
        </div>
      )}
      {err && <p className="err mt-8" role="alert">{err}</p>}
    </div>
  );
}

function MyRequests({ as, userId }) {
  const { data, error, loading, reload } = useLoad(api.listMyRequests);
  const [filter, setFilter] = useState('open');
  if (loading) return <Loading />;
  const all = (data || []).filter((r) => (as === 'mentor' ? r.mentor_id : r.student_id) === userId);
  const open = all.filter((r) => ['pending', 'approved'].includes(r.status));
  const list = filter === 'open' ? open : all;
  return (
    <>
      <ErrorMsg error={error} />
      <div className="choice-row" style={{ marginBottom: 8 }} role="group" aria-label="Show">
        <button type="button" className="choice" style={{ fontSize: 16 }} aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>Open ({open.length})</button>
        <button type="button" className="choice" style={{ fontSize: 16 }} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All ({all.length})</button>
      </div>
      {!list.length && (
        <p className="empty">
          {as === 'mentor' ? 'No requests here. You get an email whenever a student sends one.' : <>No requests here. <Link to="/mentors" className="ul">Find a mentor</Link></>}
        </p>
      )}
      {list.map((r) => <RequestRow key={r.id} r={r} as={as} onChange={reload} />)}
    </>
  );
}

// ------------------------------------------------------------ mentor services
const BLANK_SERVICE = { category: 'Career', title: '', description: '', duration_min: 30, price_inr: 0, active: true, sort: 0 };

function ServicesManager() {
  const { data, error, loading, reload } = useLoad(api.listMyServices);
  const [editing, setEditing] = useState(null);
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try { await api.saveService(editing); setEditing(null); setState({ status: 'idle', msg: '' }); reload(); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  return (
    <section>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <h2 className="h-m">My services</h2>
        {!editing && <button type="button" className="btn" onClick={() => setEditing({ ...BLANK_SERVICE, title: (data || []).length ? '' : 'Free Intro Call', duration_min: (data || []).length ? 30 : 20 })}>Add a service</button>}
      </div>
      <p className="small muted" style={{ marginBottom: 24 }}>Services are what students can book with you, such as a free 20-minute intro call or a portfolio review. A free intro call helps students take the first step.</p>
      {editing && (
        <form onSubmit={save} className="panel stack gap-24" style={{ marginBottom: 32 }}>
          <p className="h-m">{editing.id ? 'Edit service' : 'New service'}</p>
          <div className="form-row">
            <div className="field" style={{ flex: '2 1 280px' }}><label htmlFor="sv-title">Title</label><input id="sv-title" required value={editing.title} onChange={set('title')} placeholder="e.g. Portfolio Review" /></div>
            <div className="field"><label htmlFor="sv-cat">Category</label><select id="sv-cat" value={editing.category} onChange={set('category')}>{SERVICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="field"><label htmlFor="sv-desc">What the student gets</label><textarea id="sv-desc" rows={3} value={editing.description} onChange={set('description')} /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="sv-dur">Duration (minutes)</label><input id="sv-dur" type="number" min="5" step="5" value={editing.duration_min} onChange={set('duration_min')} /></div>
            <div className="field"><label htmlFor="sv-price">Price in ₹ (0 = free)</label><input id="sv-price" type="number" min="0" step="50" value={editing.price_inr} onChange={set('price_inr')} /></div>
            <div className="field"><label htmlFor="sv-sort">Order (lower shows first)</label><input id="sv-sort" type="number" value={editing.sort} onChange={set('sort')} /></div>
          </div>
          <label className="check"><input type="checkbox" checked={!!editing.active} onChange={set('active')} /> Students can book this service</label>
          {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
          <div className="actions">
            <button type="submit" className="btn" disabled={state.status === 'busy'}>Save service</button>
            <button type="button" className="ul" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}
      {loading && <Loading />}
      <ErrorMsg error={error} />
      {data && !data.length && !editing && <p className="empty">No services yet. Add at least one so students can book you.</p>}
      {(data || []).map((s) => (
        <div key={s.id} className="card-line" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: '1 1 320px' }}>
            <p style={{ fontSize: 19 }}>{s.title} {!s.active && <Status s="pending" label="hidden" />}</p>
            <p className="small muted">{s.category} · {s.duration_min} min · {fmtPrice(s.price_inr)}</p>
          </div>
          <div className="actions">
            <button type="button" className="ul" onClick={() => setEditing({ ...s })}>Edit</button>
            <button type="button" className="ul" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={async () => { if (window.confirm(`Delete “${s.title}”?`)) { await api.deleteService(s.id); reload(); } }}>Delete</button>
          </div>
        </div>
      ))}
    </section>
  );
}

// ------------------------------------------------------------ sessions and questions for everyone
function MySessions() {
  const { data, error, loading, reload } = useLoad(api.myRegistrations);
  if (loading) return <Loading />;
  const list = [...(data || [])].sort((a, b) => (a.session.starts_at || '').localeCompare(b.session.starts_at || ''));
  return (
    <>
      <ErrorMsg error={error} />
      {!list.length && <p className="empty">You have not reserved any seats. <Link to="/sessions" className="ul">See live sessions</Link></p>}
      {list.map((r) => {
        const s = r.session; const upcoming = !s.starts_at || new Date(s.starts_at) > new Date();
        return (
          <div key={r.id} className="card-line" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: '1 1 320px' }}>
              <Link to={`/sessions/${s.slug || s.id}`} style={{ fontSize: 19 }}>{s.title}</Link>
              <p className="small muted">{fmtSessionTime(s.starts_at, s.ends_at)} · {s.platform || 'Online'}</p>
              {upcoming && <p className="small mt-8">The joining link is in your confirmation email; we send a reminder the day before.</p>}
            </div>
            {upcoming ? <button type="button" className="ul" onClick={async () => { if (window.confirm('Give up your seat?')) { await api.cancelRegistration(r.id); reload(); } }}>Cancel seat</button> : <Status s="done" label="attended" />}
          </div>
        );
      })}
    </>
  );
}

function MyQuestions() {
  const { data, error, loading } = useLoad(api.myForumQuestions);
  if (loading) return <Loading />;
  return (
    <>
      <ErrorMsg error={error} />
      <p className="small muted" style={{ marginBottom: 16 }}>You get an email when someone answers your question.</p>
      {!(data || []).length && <p className="empty">No questions yet. <Link to="/community/ask" className="ul">Ask the community</Link></p>}
      {(data || []).map((q) => (
        <div key={q.id} className="card-line">
          <Link to={`/community/${q.id}`} style={{ fontSize: 19 }}>{q.title}</Link>
          <p className="small muted">{q.category} · {q.answers_count} answer{q.answers_count === 1 ? '' : 's'} · {q.views} views · {timeAgo(q.created_at)}</p>
        </div>
      ))}
    </>
  );
}

function Stories({ admin }) {
  const { data, error, loading, reload } = useLoad(() => (admin ? api.adminList('posts') : api.listMyStories()), [admin]);
  const rows = [...(data || [])].sort((x, y) => (y.submitted && !y.published) - (x.submitted && !x.published));
  const label = (p) => (p.published ? 'published' : p.submitted ? 'review' : 'draft');
  return (
    <section>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <h2 className="h-m">{admin ? 'Journal stories' : 'My stories'} {data && <span className="faint small">({data.length})</span>}</h2>
        <Link to="/editor/new" className="btn">Write a new story</Link>
      </div>
      {!admin && <p className="small muted" style={{ marginBottom: 16 }}>Write a draft, then send it for review. An admin publishes it.</p>}
      {loading && <Loading />}
      <ErrorMsg error={error} />
      {data && !data.length && <p className="empty">No stories yet. Start with “Write a new story”.</p>}
      {rows.map((p) => (
        <div key={p.id} className="card-line" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 360px', minWidth: 0 }}>
            <Link to={`/editor/${p.id}`} style={{ fontSize: 20 }}>{p.title || 'Untitled'}</Link>
            <p className="small muted">{[p.author_name, p.published ? `Published ${fmtDate(p.published_at)}` : `Last saved ${fmtDate(p.created_at)}`].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="actions">
            <span className={`status ${p.published ? 'published' : 'pending'}`}>{label(p) === 'review' ? 'Sent for review' : label(p) === 'draft' ? 'Draft' : 'Published'}</span>
            <Link to={`/editor/${p.id}`} className="ul">{admin || !p.published ? 'Edit' : 'Open'}</Link>
            {p.published && <Link to={`/journal/${p.slug}`} className="ul">View</Link>}
            {(admin || !p.published) && <button type="button" className="ul" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={async () => {
              if (!window.confirm(`Delete “${p.title}” permanently? This cannot be undone.`)) return;
              await api.deleteStory(p.id); reload();
            }}>Delete</button>}
          </div>
        </div>
      ))}
    </section>
  );
}

// ------------------------------------------------------------ admin
const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

// Generic list + editor for one table.
function Collection({ table, title, columns, fields, blank, prepare, csv, extra, editOnly }) {
  const { data, error, loading, reload } = useLoad(() => api.adminList(table), [table]);
  const [editing, setEditing] = useState(null);
  const [state, setState] = useState({ status: 'idle', msg: '' });

  const save = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try {
      const row = prepare ? prepare(editing) : editing;
      await api.adminSave(table, row);
      setEditing(null); setState({ status: 'idle', msg: '' }); reload();
    } catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  const remove = async (row) => {
    if (!window.confirm('Delete this permanently? This cannot be undone.')) return;
    try { await api.adminDelete(table, row.id); reload(); } catch (err) { setState({ status: 'error', msg: err.message }); }
  };

  return (
    <section>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <h2 className="h-m">{title} {data && <span className="faint small">({data.length})</span>}</h2>
        <div className="actions">
          {csv && data?.length > 0 && <button type="button" className="ul" onClick={() => download(`${table}.csv`, toCsv(data))}>Download CSV</button>}
          {fields && !editing && !editOnly && <button type="button" className="btn" onClick={() => setEditing({ ...blank })}>Add new</button>}
        </div>
      </div>

      {editing && fields && (
        <form onSubmit={save} className="panel stack gap-24" style={{ marginBottom: 32 }}>
          <p className="h-m">{editing.id ? 'Edit' : 'New'}</p>
          {fields.map((fd) => {
            const id = `${table}-${fd.key}`;
            const v = editing[fd.key];
            const set = (val) => setEditing({ ...editing, [fd.key]: val });
            if (fd.type === 'image') return <ImageInput key={fd.key} id={id} label={fd.label} shape={fd.shape} value={v || ''} onChange={set} />;
            if (fd.type === 'checkbox') return <label key={fd.key} className="check"><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} /> {fd.label}</label>;
            if (fd.type === 'select') return <div key={fd.key} className="field"><label htmlFor={id}>{fd.label}</label><select id={id} value={v ?? ''} onChange={(e) => set(e.target.value)}>{fd.options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}</select></div>;
            if (fd.type === 'textarea') return <div key={fd.key} className="field"><label htmlFor={id}>{fd.label}</label><textarea id={id} rows={fd.rows || 4} value={v ?? ''} onChange={(e) => set(e.target.value)} required={fd.required} /></div>;
            const shown = fd.type === 'datetime-local' && v && v.length > 16 ? toLocalInput(v) : v;
            return <div key={fd.key} className="field"><label htmlFor={id}>{fd.label}</label><input id={id} type={fd.type || 'text'} value={shown ?? ''} onChange={(e) => set(e.target.value)} required={fd.required} placeholder={fd.placeholder} /></div>;
          })}
          {state.status === 'error' && <p className="err" role="alert">{state.msg}</p>}
          <div className="actions">
            <button type="submit" className="btn" disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Saving…' : 'Save'}</button>
            <button type="button" className="ul" onClick={() => { setEditing(null); setState({ status: 'idle', msg: '' }); }}>Cancel</button>
          </div>
        </form>
      )}

      {loading && <Loading />}
      <ErrorMsg error={error} />
      {state.status === 'error' && !editing && <p className="err" role="alert">{state.msg}</p>}
      {data && !data.length && <p className="empty">Nothing here yet.</p>}
      {data?.length > 0 && (
        <div className="table-box">
          <table className="data">
            <thead><tr>{columns.map(([k, l]) => <th key={k}>{l}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  {columns.map(([k, , render]) => <td key={k}>{render ? render(row, reload) : String(row[k] ?? '')}</td>)}
                  <td>
                    <div className="actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      {extra && extra(row, reload)}
                      {fields && <button type="button" className="ul" onClick={() => setEditing({ ...row })}>Edit</button>}
                      <button type="button" className="ul" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={() => remove(row)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const quick = (table, patch, label) => (row, reload) => (
  <button type="button" className="ul" onClick={async () => { await api.adminSave(table, { id: row.id, ...patch(row) }); reload(); }}>{label(row)}</button>
);


// ------------------------------------------------------------ role dashboards
function StudentDash({ profile }) {
  const [tab, setTab] = useTab('requests');
  return (
    <>
      <Tabs tabs={[['requests', 'My bookings'], ['sessions', 'My live sessions'], ['questions', 'My questions'], ['profile', 'Profile']]} active={tab} setActive={setTab} />
      {tab === 'requests' && <MyRequests as="student" userId={profile.id} />}
      {tab === 'sessions' && <MySessions />}
      {tab === 'questions' && <MyQuestions />}
      {tab === 'profile' && <ProfileForm profile={profile} />}
    </>
  );
}

function ProfessionalDash({ profile }) {
  const [tab, setTab] = useTab('sessions');
  return (
    <>
      <div className="panel" style={{ marginBottom: 32, padding: 24 }}>
        <p>Thank you for joining as a professional. Answer students’ questions in the <Link to="/community" className="ul">community</Link> and join live sessions. Want to offer one-to-one sessions? Ask the ArchMentor team to make your account a mentor account.</p>
      </div>
      <Tabs tabs={[['sessions', 'My live sessions'], ['questions', 'My questions'], ['profile', 'Profile']]} active={tab} setActive={setTab} />
      {tab === 'sessions' && <MySessions />}
      {tab === 'questions' && <MyQuestions />}
      {tab === 'profile' && <ProfileForm profile={profile} />}
    </>
  );
}

function MentorChecklist({ profile }) {
  const services = useLoad(api.listMyServices);
  const items = [
    ['Profile photo', !!profile.photo_url],
    ['Title and firm or institution', !!(profile.title && profile.organisation)],
    ['About you', (profile.bio || '').length > 40],
    ['Main expertise', !!profile.expertise],
    ['At least one service', (services.data || []).some((s) => s.active)],
    ['Calendly link for scheduling', !!profile.calendly_url],
  ];
  const done = items.filter(([, d]) => d).length;
  return (
    <div className="panel" style={{ marginBottom: 32, padding: 24 }}>
      {profile.approved
        ? <p><b style={{ fontWeight: 500 }}>Your profile is live and verified.</b> {done < items.length ? 'Finish the items below so students can book you easily.' : 'Everything is set up.'}</p>
        : <p><b style={{ fontWeight: 500 }}>Your mentor application is awaiting approval.</b> Complete your profile and add your services; an admin reviews it and you get an email once it is approved.</p>}
      {done < items.length && (
        <ul className="checklist mt-16">{items.map(([label, d]) => <li key={label} className={d ? 'met' : ''}>{d ? '✓' : '○'} {label}</li>)}</ul>
      )}
    </div>
  );
}

function MentorDash({ profile }) {
  const [tab, setTab] = useTab('requests');
  return (
    <>
      <MentorChecklist profile={profile} />
      <Tabs tabs={[['requests', 'Requests'], ['services', 'My services'], ['profile', 'My profile'], ['stories', 'My stories'], ['sessions', 'Live sessions'], ['questions', 'My questions']]} active={tab} setActive={setTab} />
      {tab === 'requests' && <MyRequests as="mentor" userId={profile.id} />}
      {tab === 'services' && <ServicesManager />}
      {tab === 'profile' && <ProfileForm profile={profile} />}
      {tab === 'stories' && (profile.approved ? <Stories /> : <p className="empty">You can write for the Journal once your profile is approved.</p>)}
      {tab === 'sessions' && <MySessions />}
      {tab === 'questions' && <MyQuestions />}
    </>
  );
}

// ------------------------------------------------------------ admin: registrations, community, emails, settings
function Registrations() {
  const sessions = useLoad(() => api.adminList('sessions'));
  const regs = useLoad(() => api.adminList('registrations'));
  const [only, setOnly] = useState('');
  const titles = Object.fromEntries((sessions.data || []).map((s) => [s.id, s.title]));
  const rows = (regs.data || []).filter((r) => !only || r.session_id === only)
    .map((r) => ({ session: titles[r.session_id] || r.session_id, name: r.name, email: r.email, registered: fmtDate(r.created_at) }));
  return (
    <section className="mt-48">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 16 }}>
        <h2 className="h-m">Registrations <span className="faint small">({rows.length})</span></h2>
        <div className="actions">
          <div className="field" style={{ minWidth: 240 }}><label htmlFor="reg-filter">Session</label>
            <select id="reg-filter" value={only} onChange={(e) => setOnly(e.target.value)}><option value="">All sessions</option>{(sessions.data || []).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
          </div>
          {rows.length > 0 && <button type="button" className="ul" onClick={() => download('registrations.csv', toCsv(rows))}>Download CSV</button>}
        </div>
      </div>
      {!rows.length && <p className="empty">No registrations yet.</p>}
      {rows.length > 0 && (
        <div className="table-box"><table className="data"><thead><tr><th>Session</th><th>Name</th><th>Email</th><th>Registered</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.session}</td><td>{r.name}</td><td>{r.email}</td><td>{r.registered}</td></tr>)}</tbody></table></div>
      )}
    </section>
  );
}

function EmailsPanel() {
  const log = useLoad(api.emailLog);
  const [msg, setMsg] = useState('');
  const test = async () => {
    setMsg('');
    try { await api.sendTestEmail(); setMsg('Test email queued. Check the admin inbox (and spam) in a minute, then refresh this list.'); log.reload(); }
    catch (e) { setMsg(e.message); }
  };
  return (
    <section>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <h2 className="h-m">Emails sent by the website</h2>
        <div className="actions">
          <button type="button" className="ul" onClick={log.reload}>Refresh</button>
          <button type="button" className="btn" onClick={test}>Send a test email to the admin</button>
        </div>
      </div>
      {msg && <p className="msg" role="status" style={{ marginBottom: 16 }}>{msg}</p>}
      <p className="small muted" style={{ marginBottom: 16 }}>Sign-up confirmation and password-reset emails are sent by Supabase and do not appear here. Everything else does. “Skipped” means the email settings are not complete yet.</p>
      {log.loading && <Loading />}
      <ErrorMsg error={log.error} />
      {log.data && !log.data.length && <p className="empty">No emails yet.</p>}
      {log.data?.length > 0 && (
        <div className="table-box"><table className="data">
          <thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
          <tbody>{log.data.map((e) => (
            <tr key={e.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{timeAgo(e.created_at)}</td>
              <td>{e.to_email}</td>
              <td>{e.subject}<br /><span className="small muted">{e.kind}</span></td>
              <td><Status s={e.status === 'sent' ? 'done' : e.status === 'queued' || e.status === 'demo' ? 'pending' : 'declined'} label={e.status} />{e.status !== 'sent' && e.note ? <><br /><span className="small muted">{e.note}</span></> : null}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}

function SettingsPanel() {
  const { data, error, loading, reload } = useLoad(api.getSettings);
  const status = useLoad(api.emailStatus);
  const [f, setF] = useState(null);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { if (data) setF(data); }, [data]);
  if (loading || !f) return <><Loading /><ErrorMsg error={error} /></>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault(); setMsg('');
    try {
      await api.saveSettings({ ...f, site_url: f.site_url.trim().replace(/\/$/, '') });
      if (key.trim()) { await api.setBrevoKey(key.trim()); setKey(''); status.reload(); }
      setMsg('Saved.'); reload();
    } catch (err) { setMsg(err.message); }
  };
  return (
    <form onSubmit={save} className="stack gap-24" style={{ maxWidth: 760 }}>
      <h2 className="h-m">Website and email settings</h2>
      <div className="form-row">
        <div className="field"><label htmlFor="st-name">Website name</label><input id="st-name" value={f.site_name} onChange={set('site_name')} /></div>
        <div className="field"><label htmlFor="st-url">Website address (used in email links)</label><input id="st-url" type="url" required value={f.site_url} onChange={set('site_url')} placeholder="https://www.yourdomain.com" /></div>
      </div>
      <div className="form-row">
        <div className="field"><label htmlFor="st-admin">Admin email (receives alerts)</label><input id="st-admin" type="email" value={f.admin_email} onChange={set('admin_email')} placeholder="yourname@gmail.com" /></div>
        <div className="field"><label htmlFor="st-reply">Replies go to</label><input id="st-reply" type="email" value={f.reply_to} onChange={set('reply_to')} placeholder="yourname@gmail.com" /></div>
      </div>
      <div className="form-row">
        <div className="field"><label htmlFor="st-from">Send emails from (verified in Brevo)</label><input id="st-from" type="email" value={f.sender_email} onChange={set('sender_email')} placeholder="noreply@yourdomain.com" /></div>
        <div className="field"><label htmlFor="st-fromname">Sender name</label><input id="st-fromname" value={f.sender_name} onChange={set('sender_name')} /></div>
      </div>
      <div className="field">
        <label htmlFor="st-key">Brevo API key {status.data?.has_key ? '(saved; paste a new one to replace it)' : '(not set yet)'}</label>
        <input id="st-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={status.data?.has_key ? '••••••••••••' : 'xkeysib-…'} />
      </div>
      <label className="check"><input type="checkbox" checked={!!f.emails_on} onChange={set('emails_on')} /> Send emails (untick to pause all website emails)</label>
      <div className="actions">
        <button type="submit" className="btn">Save settings</button>
        {msg && <span className="small" role="status">{msg}</span>}
      </div>
      <p className="small muted">The Brevo key is stored encrypted in the database and is never shown again. After saving, use “Send a test email” on the Emails tab.</p>
    </form>
  );
}

function AdminDash() {
  const [tab, setTab] = useTab('people');
  const tabs = [['people', 'People'], ['services', 'Services'], ['requests', 'Bookings'], ['sessions', 'Live sessions'], ['posts', 'Journal'], ['community', 'Community'], ['videos', 'Videos'], ['submissions', 'Story ideas'], ['subscribers', 'Subscribers'], ['emails', 'Emails'], ['settings', 'Settings']];
  const people = useLoad(() => (tab === 'services' ? api.adminList('profiles') : []), [tab]);
  const names = Object.fromEntries((people.data || []).map((p) => [p.id, p.full_name]));
  return (
    <>
      <Tabs tabs={tabs} active={tab} setActive={setTab} />

      {tab === 'people' && (
        <Collection
          table="profiles" title="People" csv
          columns={[
            ['full_name', 'Name', (r) => <><span>{r.full_name || '—'}</span><br /><span className="small muted">{r.email}</span></>],
            ['role', 'Role', (r) => ROLE_LABEL[r.role] || r.role],
            ['approved', 'Mentor status', (r) => (r.role === 'mentor' ? <Status s={r.approved ? 'approved' : 'pending'} label={r.approved ? 'verified' : 'awaiting approval'} /> : '')],
            ['title', 'Title', (r) => [r.title, r.organisation].filter(Boolean).join(', ')],
            ['created_at', 'Joined', (r) => fmtDate(r.created_at)],
          ]}
          extra={(r, reload) => (r.role === 'mentor' ? (
            <>
              <Link to={`/mentors/${r.id}`} className="ul">Preview</Link>
              {quick('profiles', (x) => ({ approved: !x.approved }), (x) => (x.approved ? 'Unverify' : 'Approve'))(r, reload)}
            </>
          ) : null)}
          fields={[
            { key: 'full_name', label: 'Full name', required: true },
            { key: 'role', label: 'Role', type: 'select', options: [['student', 'Student'], ['mentor', 'Mentor'], ['professional', 'Professional'], ['admin', 'Admin']] },
            { key: 'approved', label: 'Verified mentor (shown publicly)', type: 'checkbox' },
            { key: 'title', label: 'Title' },
            { key: 'organisation', label: 'Firm, school or university' },
            { key: 'expertise', label: 'Main expertise', type: 'select', options: [['', '—'], ...EXPERTISE.map((x) => [x, x])] },
            { key: 'experience', label: 'Experience', placeholder: 'e.g. 20+ years' },
            { key: 'calendly_url', label: 'Calendly link', type: 'url' },
            { key: 'portfolio_url', label: 'Portfolio link', type: 'url' },
            { key: 'photo_url', label: 'Photo', type: 'image', shape: 'portrait' },
            { key: 'bio', label: 'Bio', type: 'textarea' },
          ]}
          prepare={(r) => ({ id: r.id, full_name: r.full_name, role: r.role, approved: r.approved, title: r.title, organisation: r.organisation, expertise: r.expertise, experience: r.experience, calendly_url: r.calendly_url, portfolio_url: r.portfolio_url, photo_url: r.photo_url, bio: r.bio })}
        />
      )}

      {tab === 'services' && (
        <Collection
          table="services" title="Mentor services"
          columns={[
            ['title', 'Service', (r) => <><span>{r.title}</span><br /><span className="small muted">{r.category}</span></>],
            ['mentor_id', 'Mentor', (r) => names[r.mentor_id] || '…'],
            ['duration_min', 'Length', (r) => `${r.duration_min} min`],
            ['price_inr', 'Price', (r) => fmtPrice(r.price_inr)],
            ['active', 'Bookable', (r) => (r.active ? 'Yes' : 'Hidden')],
          ]}
          fields={[
            { key: 'title', label: 'Title', required: true },
            { key: 'category', label: 'Category', type: 'select', options: SERVICE_CATEGORIES.map((c) => [c, c]) },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'duration_min', label: 'Duration (minutes)', type: 'number' },
            { key: 'price_inr', label: 'Price in ₹ (0 = free)', type: 'number' },
            { key: 'active', label: 'Bookable', type: 'checkbox' },
          ]}
          editOnly
          prepare={(r) => ({ id: r.id, title: r.title, category: r.category, description: r.description, duration_min: Number(r.duration_min) || 30, price_inr: Number(r.price_inr) || 0, active: r.active })}
        />
      )}

      {tab === 'requests' && (
        <Collection
          table="requests" title="Session bookings" csv
          columns={[
            ['student_name', 'Student', (r) => <><span>{r.student_name}</span><br /><span className="small muted">{r.student_email}</span></>],
            ['mentor_name', 'Mentor'],
            ['service_title', 'Service', (r) => r.service_title || r.service],
            ['status', 'Status', (r) => <Status s={r.status} />],
            ['created_at', 'Sent', (r) => fmtDate(r.created_at)],
          ]}
        />
      )}

      {tab === 'sessions' && (
        <>
          <Collection
            table="sessions" title="Live sessions"
            columns={[
              ['title', 'Title', (r) => <><span>{r.title}</span>{r.slug && <><br /><Link to={`/sessions/${r.slug}`} className="small ul">/sessions/{r.slug}</Link></>}</>],
              ['starts_at', 'When', (r) => fmtSessionTime(r.starts_at, r.ends_at)],
              ['capacity', 'Seats', (r) => r.capacity || 'Unlimited'],
              ['published', 'Status', (r) => <Status s={r.published ? 'published' : 'pending'} label={r.published ? 'published' : 'draft'} />],
            ]}
            blank={{ title: '', slug: '', subtitle: '', description: '', kind: 'Career Talk', starts_at: '', ends_at: '', platform: 'Zoom', format: 'Online, interactive', capacity: 50, host_name: '', join_link: '', featured: true, published: true }}
            fields={[
              { key: 'title', label: 'Title', required: true },
              { key: 'subtitle', label: 'Subtitle (one line)' },
              { key: 'kind', label: 'Category label (e.g. Thesis Guidance, Career Talk)' },
              { key: 'description', label: 'Description', type: 'textarea' },
              { key: 'starts_at', label: 'Starts (your local time)', type: 'datetime-local' },
              { key: 'ends_at', label: 'Ends', type: 'datetime-local' },
              { key: 'platform', label: 'Platform (e.g. Zoom, Google Meet)' },
              { key: 'capacity', label: 'Seats (leave empty for unlimited)', type: 'number' },
              { key: 'host_name', label: 'Host or speaker (optional)' },
              { key: 'join_link', label: 'Join link (emailed to registrants, never shown publicly)', type: 'url' },
              { key: 'slug', label: 'Web address (leave empty to make one from the title)' },
              { key: 'featured', label: 'Feature on the home page and in the top notice', type: 'checkbox' },
              { key: 'published', label: 'Published (subscribers are emailed once when it is first published)', type: 'checkbox' },
            ]}
            prepare={(r) => {
              const { reminder_sent, announced, ...rest } = r;
              return { ...rest, slug: slugify(r.slug || r.title), starts_at: r.starts_at ? new Date(r.starts_at).toISOString() : null, ends_at: r.ends_at ? new Date(r.ends_at).toISOString() : null, capacity: r.capacity === '' || r.capacity === null ? null : Number(r.capacity) };
            }}
          />
          <Registrations />
        </>
      )}

      {tab === 'posts' && <Stories admin />}

      {tab === 'community' && (
        <Collection
          table="forum_questions" title="Community questions"
          columns={[
            ['title', 'Question', (r) => <><Link to={`/community/${r.id}`} className="ul">{r.title}</Link><br /><span className="small muted">{r.category} · {r.author_name}</span></>],
            ['answers_count', 'Answers'],
            ['views', 'Views'],
            ['created_at', 'Asked', (r) => fmtDate(r.created_at)],
          ]}
        />
      )}

      {tab === 'videos' && (
        <Collection
          table="videos" title="Videos"
          columns={[
            ['title', 'Title'],
            ['kind', 'Type', (r) => (r.kind === 'short' ? 'Short' : 'Full video')],
            ['youtube_id', 'YouTube', (r) => (r.youtube_id ? <a className="ul" href={`https://youtu.be/${r.youtube_id}`} target="_blank" rel="noopener noreferrer">{r.youtube_id}</a> : <span className="muted">missing</span>)],
            ['sort', 'Order'],
            ['published', 'Status', (r) => <Status s={r.published ? 'published' : 'pending'} />],
          ]}
          blank={{ title: '', youtube_id: '', kind: 'full', featured: false, sort: 0, published: true }}
          fields={[
            { key: 'title', label: 'Title', required: true },
            { key: 'youtube_id', label: 'YouTube link or video ID', placeholder: 'https://www.youtube.com/watch?v=…' },
            { key: 'kind', label: 'Type', type: 'select', options: [['full', 'Full video'], ['short', 'Short (vertical)']] },
            { key: 'sort', label: 'Order (lower shows first)', type: 'number' },
            { key: 'featured', label: 'Featured (large player on home page)', type: 'checkbox' },
            { key: 'published', label: 'Published', type: 'checkbox' },
          ]}
          prepare={(r) => ({ ...r, youtube_id: youtubeId(r.youtube_id), sort: Number(r.sort) || 0 })}
        />
      )}

      {tab === 'submissions' && (
        <Collection
          table="submissions" title="Story ideas" csv
          columns={[
            ['name', 'From', (r) => <><span>{r.name}</span><br /><a className="small ul" href={`mailto:${r.email}`}>{r.email}</a></>],
            ['idea', 'Idea', (r) => <span style={{ whiteSpace: 'pre-line' }}>{r.idea}</span>],
            ['status', 'Status', (r) => <Status s={r.status === 'accepted' ? 'approved' : r.status === 'declined' ? 'declined' : 'pending'} label={r.status} />],
            ['created_at', 'Sent', (r) => fmtDate(r.created_at)],
          ]}
          extra={(r, reload) => (r.status === 'new' ? (
            <>
              {quick('submissions', () => ({ status: 'accepted' }), () => 'Accept')(r, reload)}
              {quick('submissions', () => ({ status: 'declined' }), () => 'Decline')(r, reload)}
            </>
          ) : null)}
        />
      )}

      {tab === 'subscribers' && (
        <Collection
          table="subscribers" title="Email subscribers" csv
          columns={[
            ['email', 'Email'],
            ['name', 'Name'],
            ['frequency', 'Wants', (r) => (r.frequency === 'weekly' ? 'Weekly digest' : 'Every story')],
            ['created_at', 'Since', (r) => fmtDate(r.created_at)],
          ]}
        />
      )}

      {tab === 'emails' && <EmailsPanel />}
      {tab === 'settings' && <SettingsPanel />}
    </>
  );
}

export default function Dashboard() {
  useTitle('Dashboard');
  const { user, profile, loading, refresh } = useAuth();
  useEffect(() => { refresh(); }, [refresh]);
  if (loading) return <div className="wrap"><Loading /></div>;
  if (!user) return <Navigate to="/login?next=/dashboard" replace />;
  if (!profile) return <div className="wrap page-top"><p className="lead">Setting up your account… If this stays, log out and back in.</p></div>;

  const heading = { admin: 'Admin', mentor: 'Mentor dashboard', professional: 'Professional dashboard', student: 'Student dashboard' }[profile.role] || 'Dashboard';
  return (
    <div className="wrap page-top">
      <p className="label" style={{ marginBottom: 16 }}>{heading}</p>
      <h1 className="h-l" style={{ marginBottom: 48 }}>Hello, {profile.full_name?.replace(/^Dr\.?\s+/, '').split(' ')[0] || 'there'}.</h1>
      {profile.role === 'admin' && <AdminDash />}
      {profile.role === 'mentor' && <MentorDash profile={profile} />}
      {profile.role === 'student' && <StudentDash profile={profile} />}
      {profile.role === 'professional' && <ProfessionalDash profile={profile} />}
    </div>
  );
}
