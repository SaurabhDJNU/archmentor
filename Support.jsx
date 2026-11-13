import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as platform from './platform.js';
import { useAuth } from './auth.jsx';
import { fmtDate, timeAgo, useLoad, useTitle } from './util.js';
import { ErrorMsg, Loading } from './Bits.jsx';
import { Status } from './Ui.jsx';
import { T, Img } from './Content.jsx';

function CallForm() {
  const { profile } = useAuth();
  const [f, setF] = useState({ name: profile?.full_name || '', email: profile?.email || '', phone: '', topic: 'Choosing a mentor', preferred_time: '', message: '' });
  const [state, setState] = useState({ s: 'idle', m: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  if (state.s === 'done') return <p className="lead">Thanks — we will call you{f.preferred_time ? ` around ${f.preferred_time}` : ' soon'}. A confirmation is on its way to {f.email}.</p>;
  return (
    <form className="stack gap-16" onSubmit={async (e) => {
      e.preventDefault(); setState({ s: 'busy', m: '' });
      try { await platform.requestCall(f); setState({ s: 'done', m: '' }); } catch (err) { setState({ s: 'error', m: err.message }); }
    }}>
      <div className="form-row">
        <div className="field"><label htmlFor="c-n">Name</label><input id="c-n" required value={f.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="c-p">Phone (with country code)</label><input id="c-p" required type="tel" value={f.phone} onChange={set('phone')} placeholder="+91 98…" /></div>
      </div>
      <div className="form-row">
        <div className="field"><label htmlFor="c-e">Email</label><input id="c-e" required type="email" value={f.email} onChange={set('email')} /></div>
        <div className="field"><label htmlFor="c-t">Topic</label><select id="c-t" value={f.topic} onChange={set('topic')}>{['Choosing a mentor', 'Portfolio review', 'Payments or refund', 'Becoming a mentor', 'Something else'].map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="c-w">Best time to call</label><input id="c-w" value={f.preferred_time} onChange={set('preferred_time')} placeholder="e.g. weekdays after 6 pm" /></div>
      <div className="field"><label htmlFor="c-m">Anything we should know (optional)</label><textarea id="c-m" rows={3} value={f.message} onChange={set('message')} /></div>
      {state.s === 'error' && <p className="err" role="alert">{state.m}</p>}
      <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={state.s === 'busy'}>Request a call</button>
    </form>
  );
}

function NewTicket({ onCreated }) {
  const [f, setF] = useState({ subject: '', category: 'General', body: '' });
  const [msg, setMsg] = useState('');
  return (
    <form className="stack gap-16" onSubmit={async (e) => {
      e.preventDefault(); setMsg('');
      try { const id = await platform.createTicket(f); onCreated(id); } catch (err) { setMsg(err.message); }
    }}>
      <div className="form-row">
        <div className="field" style={{ flex: '2 1 280px' }}><label htmlFor="t-s">Subject</label><input id="t-s" required minLength={3} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
        <div className="field"><label htmlFor="t-c">About</label><select id="t-c" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{platform.TICKET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="t-b">Message</label><textarea id="t-b" required rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
      {msg && <p className="err" role="alert">{msg}</p>}
      <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }}>Send</button>
    </form>
  );
}

export function SupportPage() {
  useTitle('Support');
  const { user } = useAuth();
  const navigate = useNavigate();
  const tickets = useLoad(() => (user ? platform.listTickets() : []), [user?.id]);
  return (
    <div className="wrap page-top">
      <p className="label">Support</p>
      <h1 className="h-xl"><T k="support.title">How can we help?</T></h1>
      <div className="grid-2 mt-64" style={{ alignItems: 'start' }}>
        <section className="stack gap-24">
          <h2 className="h-m">Write to us</h2>
          {user ? <NewTicket onCreated={(id) => navigate(`/support/${id}`)} /> : <p><Link className="ul" to="/login?next=/support">Log in</Link> to open a support ticket and follow the replies here.</p>}
          {user && (
            <div className="stack gap-8 mt-24">
              <p className="label">Your tickets</p>
              {tickets.loading && <Loading />}
              {!tickets.loading && !tickets.data?.length && <p className="small muted">None yet.</p>}
              {(tickets.data || []).map((t) => (
                <Link key={t.id} to={`/support/${t.id}`} className="card-line hover-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{t.subject}<br /><span className="small muted">{t.category} · {timeAgo(t.updated_at || t.created_at)}</span></span>
                  <Status s={t.status === 'resolved' || t.status === 'closed' ? 'approved' : 'pending'} label={t.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="stack gap-24">
          <h2 className="h-m">Prefer a phone call?</h2>
          <p className="muted"><T k="support.call.text" block>Leave your number and a good time. Someone from our team calls you back.</T></p>
          <CallForm />
        </section>
      </div>
      <p className="small mt-64"><Link className="ul" to="/legal/refunds">Refund policy</Link> · <Link className="ul" to="/legal/privacy">Privacy</Link> · <Link className="ul" to="/legal/terms">Terms</Link></p>
    </div>
  );
}

export function TicketThread({ id, staff }) {
  const { data, error, loading, reload } = useLoad(() => platform.getTicket(id), [id]);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [msg, setMsg] = useState('');
  if (loading) return <Loading />;
  if (!data) return <ErrorMsg error={error || new Error('Ticket not found')} />;
  const { ticket: t, messages } = data;
  return (
    <div className="stack gap-24">
      <div>
        <h1 className={staff ? 'h-m' : 'h-l'}>{t.subject}</h1>
        <p className="small muted mt-8">{t.category} · opened {fmtDate(t.created_at)} · <Status s={['resolved', 'closed'].includes(t.status) ? 'approved' : 'pending'} label={t.status} />{staff && ` · ${t.name} <${t.email}>`}</p>
      </div>
      {staff && (
        <div className="actions">
          {['open', 'waiting', 'resolved', 'closed'].map((s) => <button key={s} type="button" className="choice" aria-pressed={t.status === s} onClick={async () => { await platform.updateTicket(t.id, { status: s }); reload(); }}>{s}</button>)}
          <select aria-label="Priority" value={t.priority} onChange={async (e) => { await platform.updateTicket(t.id, { priority: e.target.value }); reload(); }}>{['low', 'normal', 'high'].map((p) => <option key={p}>{p}</option>)}</select>
        </div>
      )}
      <div className="thread">
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.from_staff ? 'staff' : ''} ${m.internal ? 'internal' : ''}`}>
            <p className="small muted">{m.from_staff ? `${m.author_name || 'Support'} (team)` : m.author_name}{m.internal ? ' · internal note' : ''} · {timeAgo(m.created_at)}</p>
            <p style={{ whiteSpace: 'pre-line' }}>{m.body}</p>
          </div>
        ))}
      </div>
      {t.status !== 'closed' && (
        <form className="stack gap-8" onSubmit={async (e) => {
          e.preventDefault(); setMsg('');
          try { await platform.replyTicket(t.id, body, internal); setBody(''); reload(); } catch (err) { setMsg(err.message); }
        }}>
          <label htmlFor="reply" className="small">{staff ? 'Reply' : 'Add a message'}</label>
          <textarea id="reply" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
          {staff && <label className="check small"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (the user does not see it)</label>}
          {msg && <p className="err" role="alert">{msg}</p>}
          <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }}>{staff && !internal ? 'Send reply by email' : 'Send'}</button>
        </form>
      )}
    </div>
  );
}

export function TicketPage() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  useTitle('Support ticket');
  if (loading) return <div className="wrap page-top"><Loading /></div>;
  if (!user) return <div className="wrap page-top"><Link className="ul" to={`/login?next=/support/${id}`}>Log in</Link> to see this ticket.</div>;
  return <div className="wrap page-top" style={{ maxWidth: 860 }}><p className="label"><Link to="/support" className="ul">Support</Link></p><div className="mt-16"><TicketThread id={id} /></div></div>;
}
