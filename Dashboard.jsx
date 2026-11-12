import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import * as api from './api.js';
import { useAuth } from './auth.jsx';
import { SERVICES, download, fmtDate, slugify, toCsv, useLoad, useTitle, youtubeId } from './util.js';
import { ErrorMsg, Loading } from './Bits.jsx';

const Status = ({ s }) => <span className={`status ${s}`}>{s}</span>;

// ------------------------------------------------------------ profile editor
function ProfileForm({ profile, mentor }) {
  const { refresh } = useAuth();
  const [f, setF] = useState(() => ({
    full_name: profile.full_name || '', stage: profile.stage || '', title: profile.title || '', organisation: profile.organisation || '',
    bio: profile.bio || '', photo_url: profile.photo_url || '', linkedin_url: profile.linkedin_url || '', specialties: profile.specialties || [],
  }));
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (s) => setF({ ...f, specialties: f.specialties.includes(s) ? f.specialties.filter((x) => x !== s) : [...f.specialties, s] });
  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'busy', msg: '' });
    try { await api.updateMyProfile(f); await refresh(); setState({ status: 'saved', msg: 'Saved.' }); }
    catch (err) { setState({ status: 'error', msg: err.message }); }
  };
  return (
    <form onSubmit={submit} className="stack gap-24" style={{ maxWidth: 720 }}>
      <div className="form-row">
        <div className="field"><label htmlFor="p-name">Full name</label><input id="p-name" required value={f.full_name} onChange={set('full_name')} /></div>
        {!mentor && <div className="field"><label htmlFor="p-stage">Year or stage</label><input id="p-stage" value={f.stage} onChange={set('stage')} placeholder="e.g. 4th year B.Arch" /></div>}
        {mentor && <div className="field"><label htmlFor="p-title">Title</label><input id="p-title" value={f.title} onChange={set('title')} placeholder="e.g. Practising Architect" /></div>}
      </div>
      {mentor && (
        <>
          <div className="form-row">
            <div className="field"><label htmlFor="p-org">Practice or institution</label><input id="p-org" value={f.organisation} onChange={set('organisation')} /></div>
            <div className="field"><label htmlFor="p-li">LinkedIn URL</label><input id="p-li" type="url" value={f.linkedin_url} onChange={set('linkedin_url')} /></div>
          </div>
          <div className="field"><label htmlFor="p-photo">Photo URL (a square or portrait image link)</label><input id="p-photo" type="url" value={f.photo_url} onChange={set('photo_url')} /></div>
          <div className="field"><label htmlFor="p-bio">Short bio</label><textarea id="p-bio" rows={5} value={f.bio} onChange={set('bio')} /></div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small muted" style={{ marginBottom: 4 }}>I can help with</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 24px' }}>
              {Object.entries(SERVICES).map(([id, s]) => (
                <label key={id} className="check"><input type="checkbox" checked={f.specialties.includes(id)} onChange={() => toggle(id)} /> {s.title}</label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <div className="actions">
        <button type="submit" className="btn" disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Saving…' : 'Save profile'}</button>
        {state.status === 'saved' && <span className="small muted" role="status">{state.msg}</span>}
        {state.status === 'error' && <span className="err" role="alert">{state.msg}</span>}
        {mentor && <Link to={`/mentors/${profile.id}`} className="ul small">View public profile</Link>}
      </div>
    </form>
  );
}

// ------------------------------------------------------------ requests
function RequestRow({ r, as, onChange }) {
  const [link, setLink] = useState(r.meeting_link || '');
  const [note, setNote] = useState(r.mentor_note || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const act = async (patch) => {
    setBusy(true); setErr('');
    try { await api.updateRequest(r.id, patch); onChange(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const who = as === 'mentor' ? r.student_name : r.mentor_name;
  return (
    <div className="card-line">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ fontSize: 20 }}>{SERVICES[r.service]?.title} · <span className="muted">{as === 'mentor' ? 'from' : 'with'} {who}</span></p>
        <Status s={r.status} />
      </div>
      <p className="small muted mt-8">{[r.stage, r.preferred_time && `Prefers: ${r.preferred_time}`, `Sent ${fmtDate(r.created_at)}`].filter(Boolean).join(' · ')}</p>
      {as === 'mentor' && r.student_email && <p className="small mt-8">Student email: <a className="ul" href={`mailto:${r.student_email}`}>{r.student_email}</a></p>}
      <p className="mt-16" style={{ whiteSpace: 'pre-line', color: 'var(--ink-2)', maxWidth: '70ch' }}>{r.message}</p>

      {as === 'student' && (r.meeting_link || r.mentor_note) && (
        <div className="panel mt-16" style={{ padding: 20 }}>
          {r.mentor_note && <p style={{ whiteSpace: 'pre-line' }}>{r.mentor_note}</p>}
          {r.meeting_link && <p className="mt-8">Meeting: <a className="ul" href={r.meeting_link} target="_blank" rel="noopener noreferrer">{r.meeting_link}</a></p>}
        </div>
      )}
      {as === 'student' && r.status === 'pending' && (
        <div className="actions mt-16"><button type="button" className="ul" disabled={busy} onClick={() => act({ status: 'cancelled' })}>Cancel request</button></div>
      )}

      {as === 'mentor' && ['pending', 'approved'].includes(r.status) && (
        <div className="stack gap-16 mt-24" style={{ maxWidth: 640 }}>
          <div className="field"><label htmlFor={`ml-${r.id}`}>Meeting link (Google Meet, Zoom…)</label><input id={`ml-${r.id}`} type="url" value={link} onChange={(e) => setLink(e.target.value)} /></div>
          <div className="field"><label htmlFor={`mn-${r.id}`}>Note to the student (time, what to bring)</label><textarea id={`mn-${r.id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="actions">
            <button type="button" className="btn" disabled={busy} onClick={() => act({ status: 'approved', meeting_link: link, mentor_note: note })}>{r.status === 'approved' ? 'Update details' : 'Approve'}</button>
            {r.status === 'pending' && <button type="button" className="ul" disabled={busy} onClick={() => act({ status: 'declined', mentor_note: note })}>Decline</button>}
            {r.status === 'approved' && <button type="button" className="ul" disabled={busy} onClick={() => act({ status: 'done' })}>Mark as done</button>}
          </div>
        </div>
      )}
      {err && <p className="err mt-8" role="alert">{err}</p>}
    </div>
  );
}

function MyRequests({ as }) {
  const { data, error, loading, reload } = useLoad(api.listMyRequests);
  if (loading) return <Loading />;
  const mine = data || [];
  return (
    <>
      <ErrorMsg error={error} />
      {!mine.length && (
        <p className="empty">
          {as === 'mentor' ? 'No requests yet. They will appear here when students reach out.' : <>No requests yet. <Link to="/mentors" className="ul">Find a mentor</Link></>}
        </p>
      )}
      {mine.map((r) => <RequestRow key={r.id} r={r} as={as} onChange={reload} />)}
    </>
  );
}

function Tabs({ tabs, active, setActive }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => setActive(id)}>{label}</button>)}
    </div>
  );
}

function StudentDash({ profile }) {
  const [tab, setTab] = useState('requests');
  return (
    <>
      <Tabs tabs={[['requests', 'My requests'], ['profile', 'Profile']]} active={tab} setActive={setTab} />
      {tab === 'requests' && <MyRequests as="student" />}
      {tab === 'profile' && <ProfileForm profile={profile} />}
    </>
  );
}

function MentorDash({ profile }) {
  const [tab, setTab] = useState('requests');
  return (
    <>
      {!profile.approved && (
        <div className="panel" style={{ marginBottom: 32, padding: 24 }}>
          <p><b style={{ fontWeight: 500 }}>Your mentor profile is awaiting approval.</b> Complete it below; an admin will review it before it appears in the mentor list.</p>
        </div>
      )}
      <Tabs tabs={[['requests', 'Requests'], ['profile', 'My profile']]} active={tab} setActive={setTab} />
      {tab === 'requests' && <MyRequests as="mentor" />}
      {tab === 'profile' && <ProfileForm profile={profile} mentor />}
    </>
  );
}

// ------------------------------------------------------------ admin
const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

// Generic list + editor for one table.
function Collection({ table, title, columns, fields, blank, prepare, csv, extra }) {
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
          {fields && !editing && <button type="button" className="btn" onClick={() => setEditing({ ...blank })}>Add new</button>}
        </div>
      </div>

      {editing && fields && (
        <form onSubmit={save} className="panel stack gap-24" style={{ marginBottom: 32 }}>
          <p className="h-m">{editing.id ? 'Edit' : 'New'}</p>
          {fields.map((fd) => {
            const id = `${table}-${fd.key}`;
            const v = editing[fd.key];
            const set = (val) => setEditing({ ...editing, [fd.key]: val });
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

function Registrations() {
  const sessions = useLoad(() => api.adminList('sessions'));
  const regs = useLoad(() => api.adminList('registrations'));
  const titles = Object.fromEntries((sessions.data || []).map((s) => [s.id, s.title]));
  const rows = (regs.data || []).map((r) => ({ session: titles[r.session_id] || r.session_id, name: r.name, email: r.email, registered: fmtDate(r.created_at) }));
  return (
    <section className="mt-48">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <h2 className="h-m">Registrations <span className="faint small">({rows.length})</span></h2>
        {rows.length > 0 && <button type="button" className="ul" onClick={() => download('registrations.csv', toCsv(rows))}>Download CSV</button>}
      </div>
      {!rows.length && <p className="empty">No registrations yet.</p>}
      {rows.length > 0 && (
        <div className="table-box"><table className="data"><thead><tr><th>Session</th><th>Name</th><th>Email</th><th>Registered</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.session}</td><td>{r.name}</td><td>{r.email}</td><td>{r.registered}</td></tr>)}</tbody></table></div>
      )}
    </section>
  );
}

function AdminDash() {
  const [tab, setTab] = useState('people');
  const tabs = [['people', 'People'], ['requests', 'Requests'], ['sessions', 'Sessions'], ['posts', 'Journal'], ['videos', 'Videos'], ['questions', 'Questions'], ['submissions', 'Story ideas'], ['subscribers', 'Subscribers']];
  return (
    <>
      <Tabs tabs={tabs} active={tab} setActive={setTab} />

      {tab === 'people' && (
        <Collection
          table="profiles" title="People" csv
          columns={[
            ['full_name', 'Name', (r) => <><span>{r.full_name || '—'}</span><br /><span className="small muted">{r.email}</span></>],
            ['role', 'Role'],
            ['approved', 'Status', (r) => (r.role === 'mentor' ? <Status s={r.approved ? 'approved' : 'pending'} /> : '')],
            ['title', 'Title'],
            ['created_at', 'Joined', (r) => fmtDate(r.created_at)],
          ]}
          extra={(r, reload) => (r.role === 'mentor' ? quick('profiles', (x) => ({ approved: !x.approved }), (x) => (x.approved ? 'Hide' : 'Approve'))(r, reload) : null)}
          fields={[
            { key: 'full_name', label: 'Full name', required: true },
            { key: 'role', label: 'Role', type: 'select', options: [['student', 'Student'], ['mentor', 'Mentor'], ['admin', 'Admin']] },
            { key: 'approved', label: 'Approved mentor (shown publicly)', type: 'checkbox' },
            { key: 'title', label: 'Title' },
            { key: 'organisation', label: 'Practice or institution' },
            { key: 'photo_url', label: 'Photo URL', type: 'url' },
            { key: 'bio', label: 'Bio', type: 'textarea' },
          ]}
          prepare={({ id, full_name, role, approved, title, organisation, photo_url, bio }) => ({ id, full_name, role, approved, title, organisation, photo_url, bio })}
        />
      )}

      {tab === 'requests' && (
        <Collection
          table="requests" title="Session requests" csv
          columns={[
            ['student_name', 'Student', (r) => <><span>{r.student_name}</span><br /><span className="small muted">{r.student_email}</span></>],
            ['mentor_name', 'Mentor'],
            ['service', 'Service', (r) => SERVICES[r.service]?.title],
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
              ['title', 'Title'],
              ['starts_at', 'Starts', (r) => (r.starts_at ? fmtDate(r.starts_at, true) : 'TBA')],
              ['published', 'Status', (r) => <Status s={r.published ? 'published' : 'pending'} />],
              ['featured', 'Featured', (r) => (r.featured ? 'Yes' : '')],
            ]}
            blank={{ title: '', description: '', kind: 'Career talk', starts_at: '', format: 'Online, interactive', join_link: '', featured: false, published: true }}
            fields={[
              { key: 'title', label: 'Title', required: true },
              { key: 'description', label: 'Description', type: 'textarea' },
              { key: 'kind', label: 'Type (e.g. Career talk, Workshop)' },
              { key: 'starts_at', label: 'Date and time', type: 'datetime-local' },
              { key: 'format', label: 'Format' },
              { key: 'join_link', label: 'Join link (private; send it to registrants)', type: 'url' },
              { key: 'featured', label: 'Feature on home page and in the top notice', type: 'checkbox' },
              { key: 'published', label: 'Published', type: 'checkbox' },
            ]}
            prepare={(r) => ({ ...r, starts_at: r.starts_at ? new Date(r.starts_at).toISOString() : null })}
          />
          <Registrations />
        </>
      )}

      {tab === 'posts' && (
        <Collection
          table="posts" title="Journal stories"
          columns={[
            ['title', 'Title', (r) => <Link to={`/journal/${r.slug}`} className="ul">{r.title}</Link>],
            ['author_name', 'Author'],
            ['published_at', 'Date', (r) => fmtDate(r.published_at)],
            ['published', 'Status', (r) => <Status s={r.published ? 'published' : 'pending'} />],
          ]}
          blank={{ title: '', slug: '', dek: '', body: '', tag: '', author_name: '', cover_url: '', youtube_id: '', published: false, published_at: new Date().toISOString() }}
          fields={[
            { key: 'title', label: 'Title', required: true },
            { key: 'slug', label: 'Web address (leave empty to make one from the title)', placeholder: 'how-to-present-to-a-jury' },
            { key: 'dek', label: 'Summary (one or two sentences)', type: 'textarea', rows: 2 },
            { key: 'tag', label: 'Topics, comma separated', placeholder: 'Portfolio, Internships' },
            { key: 'author_name', label: 'Author' },
            { key: 'cover_url', label: 'Cover image URL', type: 'url' },
            { key: 'youtube_id', label: 'YouTube video (link or ID, optional)' },
            { key: 'body', label: 'Story text. Use ## for headings, - for lists, > for quotes, **bold**, [text](https://link)', type: 'textarea', rows: 16 },
            { key: 'published', label: 'Published', type: 'checkbox' },
          ]}
          prepare={(r) => ({ ...r, slug: r.slug ? slugify(r.slug) : slugify(r.title), youtube_id: youtubeId(r.youtube_id), published_at: r.published_at || new Date().toISOString() })}
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

      {tab === 'questions' && (
        <Collection
          table="questions" title="Questions from students"
          columns={[
            ['question', 'Question', (r) => <><span>{r.question}</span><br /><span className="small muted">{[r.name, r.stage, r.show_name ? 'name may be shown' : 'keep anonymous'].filter(Boolean).join(' · ')}</span></>],
            ['answer', 'Answered', (r) => (r.answer ? 'Yes' : <span className="muted">No</span>)],
            ['published', 'Status', (r) => <Status s={r.published ? 'published' : 'pending'} />],
          ]}
          fields={[
            { key: 'question', label: 'Question', type: 'textarea', rows: 3, required: true },
            { key: 'answer', label: 'Answer (same formatting as Journal stories)', type: 'textarea', rows: 8 },
            { key: 'answered_by', label: 'Answered by' },
            { key: 'show_name', label: 'Show the student’s first name', type: 'checkbox' },
            { key: 'published', label: 'Publish on the Ask page', type: 'checkbox' },
          ]}
        />
      )}

      {tab === 'submissions' && (
        <Collection
          table="submissions" title="Story ideas" csv
          columns={[
            ['name', 'From', (r) => <><span>{r.name}</span><br /><a className="small ul" href={`mailto:${r.email}`}>{r.email}</a></>],
            ['idea', 'Idea', (r) => <span style={{ whiteSpace: 'pre-line' }}>{r.idea}</span>],
            ['status', 'Status', (r) => <Status s={r.status === 'accepted' ? 'approved' : r.status === 'declined' ? 'declined' : 'pending'} />],
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

  const heading = profile.role === 'admin' ? 'Admin' : profile.role === 'mentor' ? 'Mentor dashboard' : 'Your dashboard';
  return (
    <div className="wrap page-top">
      <p className="label" style={{ marginBottom: 16 }}>{heading}</p>
      <h1 className="h-l" style={{ marginBottom: 48 }}>Hello, {profile.full_name?.split(' ')[0] || 'there'}.</h1>
      {profile.role === 'admin' && <AdminDash />}
      {profile.role === 'mentor' && <MentorDash profile={profile} />}
      {profile.role === 'student' && <StudentDash profile={profile} />}
    </div>
  );
}
