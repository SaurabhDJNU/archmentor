// One data API for the whole app, with two backends:
//  - Supabase, when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
//  - Demo mode otherwise: sample data kept in this browser's localStorage
// In Supabase mode, emails are sent by the database itself (see schema.sql).
import { createClient } from '@supabase/supabase-js';
import { seed } from './seed.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Demo mode only when explicitly allowed (local development or VITE_DEMO_MODE=true).
// A production build without Supabase settings fails closed and shows a "not configured" page.
export const CONFIGURED = !!(URL_ && KEY);
export const DEMO = !CONFIGURED && (import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.MODE === 'test');
export const MISCONFIGURED = !CONFIGURED && !DEMO;

const sb = CONFIGURED ? createClient(URL_, KEY) : null;

// ---------------------------------------------------------------- helpers
const fail = (e) => { throw new Error(e?.message || String(e)); };
const ok = ({ data, error }) => (error ? fail(error) : data);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const nowIso = () => new Date().toISOString();
const byNewest = (a, b) => (b.published_at || b.created_at || '').localeCompare(a.published_at || a.created_at || '');
const pick = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => keys.includes(k)));
const SESSION_COLS = 'id,slug,title,subtitle,description,kind,starts_at,ends_at,platform,format,capacity,host_name,featured,published,created_at,price_paise,service_type,host_mentor_id';

const TABLES = ['profiles', 'services', 'requests', 'sessions', 'registrations', 'posts', 'videos', 'forum_questions', 'forum_answers', 'submissions', 'subscribers'];

// ---------------------------------------------------------------- demo store
const KEY_DB = 'archmentor_demo_db_v3';
const KEY_SESSION = 'archmentor_demo_session_v3';
const listeners = new Set();

function loadDb() {
  try {
    const raw = localStorage.getItem(KEY_DB);
    if (raw) return { ...JSON.parse(JSON.stringify(seed)), ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return JSON.parse(JSON.stringify(seed));
}
let db = DEMO ? loadDb() : null;
function save() { try { localStorage.setItem(KEY_DB, JSON.stringify(db)); } catch { /* ignore */ } }
function demoUserId() { try { return localStorage.getItem(KEY_SESSION); } catch { return null; } }
function setDemoUser(id) {
  try { id ? localStorage.setItem(KEY_SESSION, id) : localStorage.removeItem(KEY_SESSION); } catch { /* ignore */ }
  const user = id ? { id, email: db.profiles.find((p) => p.id === id)?.email } : null;
  listeners.forEach((cb) => cb(user));
}
function me() { const id = demoUserId(); return id ? db.profiles.find((p) => p.id === id) || null : null; }
const isAdmin = () => me()?.role === 'admin';
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 100));
// Demo mode keeps a record of the emails the real site would send.
function demoMail(to, subject, kind) {
  db.email_log = db.email_log || [];
  db.email_log.unshift({ id: Date.now() + Math.random(), created_at: nowIso(), to_email: to, subject, kind, status: 'demo', note: 'Demo mode: not actually sent', http_status: null });
}
const adminEmail = () => db.settings?.admin_email || 'admin (set in Settings)';

// ---- shared with platform.js (new modules) ----
function demoNotify(user_id, title, body = '', link = '') {
  if (!user_id) return;
  db.notifications = db.notifications || [];
  db.notifications.unshift({ id: Date.now() + Math.random(), user_id, title, body, link, read_at: null, created_at: nowIso() });
}
function demoStaff(id = demoUserId()) { return (db.staff_members || []).find((s) => s.user_id === id && s.status === 'active'); }
function demoHasPerm(p) {
  const u = me(); if (!u) return false;
  if (u.role === 'admin') return true;
  const st = demoStaff(u.id); if (!st) return false;
  return !!demo.perms?.(u.id)?.has(p);
}
export const demo = {
  get db() { return db; }, save, me, uid, nowIso, demoMail, demoNotify, delay, fail, isAdmin,
  isStaff: () => !!demoStaff(), hasPerm: demoHasPerm, perms: null, userId: demoUserId,
};
export const client = () => sb;
export { ok as unwrap };

export function resetDemo() {
  db = JSON.parse(JSON.stringify(seed));
  save();
  setDemoUser(null);
}

// ================================================================ AUTH
export async function getUser() {
  if (DEMO) { const p = me(); return p ? { id: p.id, email: p.email } : null; }
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export function onAuthChange(cb) {
  if (DEMO) { listeners.add(cb); return () => listeners.delete(cb); }
  const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

export const ROLES = ['student', 'mentor', 'professional'];

export async function signUp({ email, password, full_name, role }) {
  role = ROLES.includes(role) ? role : 'student';
  if (DEMO) {
    email = email.trim().toLowerCase();
    if (db.profiles.some((p) => p.email === email)) fail('An account with this email already exists.');
    const id = uid();
    db.profiles.push({ id, email, full_name, role, approved: false, title: '', organisation: '', bio: '', photo_url: '', linkedin_url: '', portfolio_url: '', calendly_url: '', expertise: '', experience: '', works_with: [], stage: '', created_at: nowIso() });
    db.passwords[email] = password;
    demoMail(email, role === 'mentor' ? 'Your mentor application has been received' : 'Welcome to ArchMentor', 'welcome');
    if (role === 'mentor') demoMail(adminEmail(), `New mentor application: ${full_name}`, 'admin-mentor-applied');
    save(); setDemoUser(id);
    return { needsConfirmation: false };
  }
  const redirect = window.location.origin + import.meta.env.BASE_URL + 'dashboard';
  const data = ok(await sb.auth.signUp({ email, password, options: { data: { full_name, role }, emailRedirectTo: redirect } }));
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) fail('An account with this email already exists. Please log in.');
  return { needsConfirmation: !data.session };
}

export async function signIn({ email, password }) {
  if (DEMO) {
    email = email.trim().toLowerCase();
    const p = db.profiles.find((x) => x.email === email);
    if (!p || db.passwords[email] !== password) fail('Email or password is incorrect.');
    setDemoUser(p.id);
    return delay(true);
  }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) fail('Please confirm your email first. Check your inbox for the confirmation link.');
    fail(/invalid/i.test(error.message) ? 'Email or password is incorrect.' : error.message);
  }
  return true;
}

export async function resendConfirmation(email) {
  if (DEMO) return delay(true);
  ok(await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL + 'dashboard' } }));
  return true;
}

export async function signOut() {
  if (DEMO) { setDemoUser(null); return; }
  await sb.auth.signOut();
}

export async function sendPasswordReset(email) {
  if (DEMO) { demoMail(email, 'Reset your password', 'auth-reset'); save(); return delay(true); }
  const redirect = window.location.origin + import.meta.env.BASE_URL + 'reset-password';
  ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect }));
  return true;
}

export async function updatePassword(password) {
  if (DEMO) { const p = me(); if (p) { db.passwords[p.email] = password; save(); } return true; }
  ok(await sb.auth.updateUser({ password }));
  return true;
}

// ================================================================ PROFILES & MENTORS
export async function getMyProfile() {
  if (DEMO) return delay(me() ? { ...me() } : null);
  const user = await getUser();
  if (!user) return null;
  return ok(await sb.from('profiles').select('*').eq('id', user.id).maybeSingle());
}

const PROFILE_FIELDS = ['full_name', 'title', 'organisation', 'bio', 'photo_url', 'linkedin_url', 'portfolio_url', 'calendly_url', 'expertise', 'experience', 'works_with', 'stage', 'location', 'languages', 'discipline', 'phone', 'email_opt_out'];
const PUBLIC_MENTOR = ['id', 'full_name', 'title', 'organisation', 'bio', 'photo_url', 'linkedin_url', 'portfolio_url', 'expertise', 'experience', 'works_with', 'location', 'languages', 'discipline', 'created_at', 'role', 'approved'];
const publicMentor = (m) => ({ ...pick(m, PUBLIC_MENTOR), role: 'mentor', approved: true });

export async function updateMyProfile(patch) {
  const clean = pick(patch, PROFILE_FIELDS);
  if (DEMO) { Object.assign(me(), clean); save(); return delay({ ...me() }); }
  const user = await getUser();
  return ok(await sb.from('profiles').update(clean).eq('id', user.id).select().single());
}

const withServices = (mentors, services) => mentors.map((m) => {
  const own = services.filter((s) => s.mentor_id === m.id && s.active).sort((a, b) => a.sort - b.sort || a.price_inr - b.price_inr);
  return { ...m, services: own, min_price: own.length ? Math.min(...own.map((s) => s.price_inr)) : null };
});

// The public directory reads only safe columns (no email, phone or Calendly link).
export async function listMentors() {
  if (DEMO) return delay(withServices(db.profiles.filter((p) => p.role === 'mentor' && p.approved).map(publicMentor), db.services));
  const mentors = (ok(await sb.from('public_mentors').select('*').order('created_at'))).map((m) => ({ ...m, role: 'mentor', approved: true }));
  const services = ok(await sb.from('services').select('*').eq('active', true));
  return withServices(mentors, services);
}

export async function getMentor(id) {
  if (DEMO) {
    const m = db.profiles.find((p) => p.id === id && p.role === 'mentor' && (p.approved || isAdmin() || p.id === demoUserId()));
    return delay(m ? withServices([m.approved ? publicMentor(m) : m], db.services)[0] : null);
  }
  let m = ok(await sb.from('public_mentors').select('*').eq('id', id).maybeSingle());
  if (m) m = { ...m, role: 'mentor', approved: true };
  else m = ok(await sb.from('profiles').select('*').eq('id', id).eq('role', 'mentor').maybeSingle());   // own or staff preview
  if (!m) return null;
  const services = ok(await sb.from('services').select('*').eq('mentor_id', id));
  return withServices([m], services)[0];
}

// ================================================================ SERVICES (mentors)
export async function listMyServices() {
  const user = await getUser(); if (!user) return [];
  if (DEMO) return delay(db.services.filter((s) => s.mentor_id === user.id).sort((a, b) => a.sort - b.sort));
  return ok(await sb.from('services').select('*').eq('mentor_id', user.id).order('sort'));
}

export async function saveService(row) {
  const user = await getUser(); if (!user) fail('Please log in.');
  const clean = pick(row, ['category', 'title', 'description', 'duration_min', 'price_inr', 'active', 'sort', 'service_type', 'requires_approval']);
  clean.duration_min = Math.max(5, Number(clean.duration_min) || 30);
  clean.price_inr = Math.max(0, Math.round(Number(clean.price_inr) || 0));
  clean.price_paise = clean.price_inr * 100;
  clean.requires_approval = clean.requires_approval !== false;
  clean.sort = Number(clean.sort) || 0;
  if (DEMO) {
    if (row.id) { const s = db.services.find((x) => x.id === row.id && (x.mentor_id === user.id || isAdmin())); if (!s) fail('Not allowed.'); Object.assign(s, clean); save(); return delay(s); }
    const s = { ...clean, id: uid(), mentor_id: user.id, created_at: nowIso() }; db.services.push(s); save(); return delay(s);
  }
  if (row.id) return ok(await sb.from('services').update(clean).eq('id', row.id).select().single());
  return ok(await sb.from('services').insert({ ...clean, mentor_id: user.id }).select().single());
}

export async function deleteService(id) {
  if (DEMO) { db.services = db.services.filter((s) => s.id !== id); save(); return delay(true); }
  ok(await sb.from('services').delete().eq('id', id));
  return true;
}

export async function getService(id) {
  if (DEMO) {
    const s = db.services.find((x) => x.id === id && x.active);
    const m = s && db.profiles.find((p) => p.id === s.mentor_id && p.approved);
    return delay(s && m ? { ...s, mentor: publicMentor(m) } : null);
  }
  const s = ok(await sb.from('services').select('*').eq('id', id).maybeSingle());
  if (!s) return null;
  const m = ok(await sb.from('public_mentors').select('*').eq('id', s.mentor_id).maybeSingle());
  return m ? { ...s, mentor: m } : null;
}

// ================================================================ BOOKINGS
export async function createRequest({ service_id, mentor_id, stage, message, preferred_time, start_at }) {
  if (DEMO) {
    const s = me(); if (!s) fail('Please log in first.');
    if (s.role !== 'student') fail('Session requests are made from student accounts.');
    const sv = db.services.find((x) => x.id === service_id);
    const m = db.profiles.find((p) => p.id === mentor_id);
    const price_paise = sv ? (sv.price_paise || sv.price_inr * 100) : 0;
    const dur = sv?.duration_min || 60;
    if (start_at && db.requests.some((r) => r.mentor_id === mentor_id && r.start_at === start_at && ['pending', 'awaiting_payment', 'confirmed', 'approved'].includes(r.status))) fail('That time was just taken. Please pick another slot.');
    const paid = price_paise > 0 && db.settings.payments_mode !== 'off';
    const status = paid && sv && sv.requires_approval === false ? 'awaiting_payment' : 'pending';
    const id = uid();
    db.requests.push({ id, student_id: s.id, mentor_id, service_id, service: sv?.category || '', service_title: sv?.title || '', duration_min: dur, price_inr: price_paise / 100, price_paise, service_type: sv?.service_type || 'consultation', student_name: s.full_name, student_email: s.email, mentor_name: m?.full_name || '', stage, message, preferred_time, start_at: start_at || null, end_at: start_at ? new Date(+new Date(start_at) + dur * 60000).toISOString() : null, status, meeting_link: '', mentor_note: '', calendly_url: '', created_at: nowIso(), updated_at: nowIso() });
    demoMail(m?.email, `New session request from ${s.full_name}`, 'booking-new-mentor');
    demoMail(s.email, status === 'awaiting_payment' ? 'Complete payment to confirm your session' : `Your request was sent to ${m?.full_name}`, 'booking-new-student');
    demoNotify(mentor_id, `New request from ${s.full_name}`, sv?.title || '', '/dashboard?tab=requests');
    save(); return delay({ id, status });
  }
  const user = await getUser(); if (!user) fail('Please log in first.');
  const row = ok(await sb.from('requests').insert({ student_id: user.id, mentor_id, service_id, stage, message, preferred_time, start_at: start_at || null }).select('id,status').single());
  return row;
}

// Requests you made (students) or received (mentors); each comes with the mentor's Calendly link.
export async function listMyRequests() {
  if (DEMO) {
    const id = demoUserId();
    return delay(db.requests.filter((r) => r.student_id === id || r.mentor_id === id).sort(byNewest).map((r) => ({ ...r })));
  }
  // The mentor's Calendly link is copied onto the booking when it is approved (never public).
  return ok(await sb.from('requests').select('*').order('created_at', { ascending: false }));
}

export async function updateRequest(id, patch) {
  if (DEMO) {
    const r = db.requests.find((x) => x.id === id); if (!r) fail('Request not found.');
    const u = demoUserId(); const before = r.status;
    if (['confirmed', 'refunded'].includes(patch.status) && patch.status !== before) fail('This status is set by the payment system');
    if (u === r.mentor_id || isAdmin() || demoHasPerm('bookings.manage')) {
      Object.assign(r, pick(patch, ['status', 'meeting_link', 'mentor_note']));
      if (r.status === 'approved' && before === 'pending') {
        r.calendly_url = db.profiles.find((p) => p.id === r.mentor_id)?.calendly_url || '';
        if ((r.price_paise || r.price_inr * 100) > 0 && db.settings.payments_mode !== 'off') r.status = 'awaiting_payment';
      }
    } else if (u === r.student_id && patch.status === 'cancelled') r.status = 'cancelled';
    else fail('Not allowed.');
    r.updated_at = nowIso();
    if (r.status !== before) {
      demoNotify(r.student_id, `Booking ${r.status.replace('_', ' ')}`, r.service_title, '/dashboard?tab=requests');
      if (r.status === 'done') { const o = (db.orders || []).find((x) => x.id === r.order_id); if (o && !o.completed_at) o.completed_at = nowIso(); }
      if (r.status === 'awaiting_payment') demoMail(r.student_email, `Approved — complete payment for your session with ${r.mentor_name}`, 'booking-approved-pay');
      if (r.status === 'cancelled' && before === 'confirmed' && r.order_id) {
        db.refund_requests = db.refund_requests || [];
        const o = db.orders.find((x) => x.id === r.order_id);
        if (o && o.status === 'paid') db.refund_requests.push({ id: uid(), order_id: o.id, requested_by: u, amount_paise: o.amount_paise, reason: 'Booking cancelled', auto: true, status: 'requested', created_at: nowIso() });
      }
    }
    if (r.status !== before || patch.meeting_link !== undefined) {
      const m = db.profiles.find((p) => p.id === r.mentor_id);
      if (r.status === 'approved') demoMail(r.student_email, `Approved: your session with ${r.mentor_name}`, 'booking-approved');
      if (r.status === 'declined') demoMail(r.student_email, `Update on your request to ${r.mentor_name}`, 'booking-declined');
      if (r.status === 'cancelled') demoMail(m?.email, `${r.student_name} cancelled their request`, 'booking-cancelled');
      if (r.status === 'done') demoMail(r.student_email, `Thank you for your session with ${r.mentor_name}`, 'booking-done');
    }
    save(); return delay(r);
  }
  ok(await sb.from('requests').update(pick(patch, ['status', 'meeting_link', 'mentor_note'])).eq('id', id));
  return true;
}

// ================================================================ LIVE SESSIONS
const sortByStart = (a, b) => (a.starts_at || '9999').localeCompare(b.starts_at || '9999');

export async function listSessions() {
  if (DEMO) return delay(db.sessions.filter((s) => s.published).sort(sortByStart).map(({ join_link, ...s }) => s));
  return ok(await sb.from('sessions').select(SESSION_COLS).eq('published', true).order('starts_at', { ascending: true }));
}

export async function getSession(key) {
  if (DEMO) {
    const s = db.sessions.find((x) => (x.slug === key || x.id === key) && (x.published || isAdmin()));
    if (!s) return delay(null);
    const { join_link, ...rest } = s; return delay(rest);
  }
  const isId = /^[0-9a-f-]{36}$/i.test(key);
  return ok(await sb.from('sessions').select(SESSION_COLS).eq(isId ? 'id' : 'slug', key).maybeSingle());
}

export async function seatCount(session_id) {
  if (DEMO) return db.registrations.filter((r) => r.session_id === session_id && r.status !== 'cancelled').length;
  const { data } = await sb.rpc('session_seat_count', { sid: session_id });
  return data ?? 0;
}

export async function registerForSession({ session_id, name, email }) {
  const user = await getUser(); if (!user) fail('Please log in to reserve a seat.');
  email = email.trim().toLowerCase();
  if (DEMO) {
    const s = db.sessions.find((x) => x.id === session_id);
    if (db.registrations.some((r) => r.session_id === session_id && (r.email === email || r.user_id === user.id))) return { already: true };
    if (s.capacity && db.registrations.filter((r) => r.session_id === session_id && r.status !== 'cancelled').length >= s.capacity) fail('Sorry, this session is full.');
    const status = (s.price_paise || 0) > 0 && db.settings.payments_mode !== 'off' ? 'awaiting_payment' : 'confirmed';
    const id = uid();
    db.registrations.push({ id, session_id, user_id: user.id, name, email, status, created_at: nowIso() });
    demoMail(email, status === 'confirmed' ? `Your seat is reserved: ${s.title}` : `Complete payment to reserve your seat: ${s.title}`, 'session-registered');
    save(); return delay({ already: false, id, status });
  }
  const { data, error } = await sb.from('registrations').insert({ session_id, user_id: user.id, name, email }).select('id,status').single();
  if (error?.code === '23505') return { already: true };
  if (error) fail(error);
  return { already: false, id: data.id, status: data.status };
}

export async function myRegistrations() {
  const user = await getUser(); if (!user) return [];
  if (DEMO) {
    return delay(db.registrations.filter((r) => r.user_id === user.id).map((r) => {
      const { join_link, ...session } = db.sessions.find((s) => s.id === r.session_id) || {};
      return { ...r, session };
    }));
  }
  const regs = ok(await sb.from('registrations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }));
  const ids = regs.map((r) => r.session_id);
  const sessions = ids.length ? ok(await sb.from('sessions').select(SESSION_COLS).in('id', ids)) : [];
  return regs.map((r) => ({ ...r, session: sessions.find((s) => s.id === r.session_id) || {} }));
}

export async function cancelRegistration(id) {
  if (DEMO) { const r = db.registrations.find((x) => x.id === id); if (r) r.status = 'cancelled'; save(); return delay(true); }
  ok(await sb.from('registrations').update({ status: 'cancelled' }).eq('id', id));
  return true;
}

// ================================================================ COMMUNITY
export const FORUM_CATEGORIES = ['Design Studio', 'Building Materials & Construction', 'Structures', 'Building Services', 'Sustainability', 'History & Theory', 'Urban Design & Planning', 'Portfolio', 'Software', 'Career', 'Internships', 'Academics & Exams', 'Other'];

export async function listQuestions() {
  if (DEMO) return delay([...db.forum_questions].filter((q) => !q.hidden).sort(byNewest));
  return ok(await sb.from('forum_questions').select('*').order('created_at', { ascending: false }).limit(500));
}

export async function getQuestion(id) {
  if (DEMO) {
    const q = db.forum_questions.find((x) => x.id === id);
    if (!q) return delay(null);
    const answers = db.forum_answers.filter((a) => a.question_id === id);
    const mine = new Set(db.forum_votes.filter((v) => v.user_id === demoUserId()).map((v) => v.answer_id));
    return delay({ ...q, answers: answers.map((a) => ({ ...a, voted: mine.has(a.id) })) });
  }
  const q = ok(await sb.from('forum_questions').select('*').eq('id', id).maybeSingle());
  if (!q) return null;
  const answers = ok(await sb.from('forum_answers').select('*').eq('question_id', id).order('created_at'));
  const user = await getUser();
  const votes = user && answers.length ? ok(await sb.from('forum_votes').select('answer_id').eq('user_id', user.id).in('answer_id', answers.map((a) => a.id))) : [];
  const mine = new Set(votes.map((v) => v.answer_id));
  return { ...q, answers: answers.map((a) => ({ ...a, voted: mine.has(a.id) })) };
}

export async function countView(id) {
  let seen = false;
  try { seen = sessionStorage.getItem(`viewed-${id}`) === '1'; sessionStorage.setItem(`viewed-${id}`, '1'); } catch { /* ignore */ }
  if (seen) return;
  if (DEMO) { const q = db.forum_questions.find((x) => x.id === id); if (q) { q.views += 1; save(); } return; }
  await sb.rpc('forum_view', { qid: id });
}

export async function askForumQuestion({ title, body, category }) {
  const user = await getUser(); if (!user) fail('Please log in to ask a question.');
  if (DEMO) {
    const p = me();
    const q = { id: uid(), author_id: user.id, author_name: p.full_name, author_role: p.role, title, body, category, views: 0, answers_count: 0, helpful_total: 0, created_at: nowIso() };
    db.forum_questions.push(q); save(); return delay(q);
  }
  return ok(await sb.from('forum_questions').insert({ author_id: user.id, title, body, category }).select().single());
}

export async function answerQuestion({ question_id, body }) {
  const user = await getUser(); if (!user) fail('Please log in to answer.');
  if (DEMO) {
    const p = me(); const q = db.forum_questions.find((x) => x.id === question_id);
    db.forum_answers.push({ id: uid(), question_id, author_id: user.id, author_name: p.full_name, author_role: p.role, body, helpful: 0, created_at: nowIso() });
    q.answers_count += 1;
    if (q.author_id && q.author_id !== user.id) demoMail(db.profiles.find((x) => x.id === q.author_id)?.email, 'New answer to your question', 'forum-answer');
    save(); return delay(true);
  }
  ok(await sb.from('forum_answers').insert({ question_id, author_id: user.id, body }));
  return true;
}

export async function setHelpful(answer_id, on) {
  const user = await getUser(); if (!user) fail('Please log in to vote.');
  if (DEMO) {
    const a = db.forum_answers.find((x) => x.id === answer_id); const q = db.forum_questions.find((x) => x.id === a.question_id);
    if (a.author_id === user.id) fail('You cannot vote for your own answer.');
    const has = db.forum_votes.some((v) => v.answer_id === answer_id && v.user_id === user.id);
    if (on && !has) { db.forum_votes.push({ answer_id, user_id: user.id }); a.helpful += 1; q.helpful_total += 1; }
    if (!on && has) { db.forum_votes = db.forum_votes.filter((v) => !(v.answer_id === answer_id && v.user_id === user.id)); a.helpful -= 1; q.helpful_total -= 1; }
    save(); return delay(true);
  }
  if (on) {
    const { error } = await sb.from('forum_votes').insert({ answer_id, user_id: user.id });
    if (error && error.code !== '23505') fail(/row-level/.test(error.message) ? 'You cannot vote for your own answer.' : error);
  } else ok(await sb.from('forum_votes').delete().eq('answer_id', answer_id).eq('user_id', user.id));
  return true;
}

export async function deleteForumItem(table, id) {
  if (!['forum_questions', 'forum_answers'].includes(table)) fail('Unknown item');
  if (DEMO) {
    const item = db[table].find((x) => x.id === id);
    if (!item || !(isAdmin() || item.author_id === demoUserId())) fail('Not allowed.');
    db[table] = db[table].filter((x) => x.id !== id);
    if (table === 'forum_answers') { const q = db.forum_questions.find((x) => x.id === item.question_id); if (q) { q.answers_count -= 1; q.helpful_total -= item.helpful; } }
    else db.forum_answers = db.forum_answers.filter((a) => a.question_id !== id);
    save(); return delay(true);
  }
  ok(await sb.from(table).delete().eq('id', id));
  return true;
}

export async function myForumQuestions() {
  const user = await getUser(); if (!user) return [];
  if (DEMO) return delay(db.forum_questions.filter((q) => q.author_id === user.id).sort(byNewest));
  return ok(await sb.from('forum_questions').select('*').eq('author_id', user.id).order('created_at', { ascending: false }));
}

// ================================================================ JOURNAL, VIDEOS, FORMS
export async function listPosts() {
  if (DEMO) return delay(db.posts.filter((p) => p.published).sort(byNewest));
  return ok(await sb.from('posts').select('id,slug,title,dek,tag,author_name,cover_url,published_at').eq('published', true).order('published_at', { ascending: false }));
}

export async function getPost(slug) {
  if (DEMO) return delay(db.posts.find((p) => p.slug === slug && (p.published || isAdmin() || (p.author_id && p.author_id === demoUserId()))) || null);
  return ok(await sb.from('posts').select('*').eq('slug', slug).maybeSingle());
}

export async function listVideos() {
  if (DEMO) return delay(db.videos.filter((v) => v.published).sort((a, b) => a.sort - b.sort));
  return ok(await sb.from('videos').select('*').eq('published', true).order('sort'));
}

export async function submitStory({ name, email, idea }) {
  if (DEMO) {
    db.submissions.push({ id: uid(), name, email, idea, status: 'new', created_at: nowIso() });
    demoMail(email, 'We received your story idea', 'submission-ack'); demoMail(adminEmail(), `New story idea from ${name}`, 'admin-submission');
    save(); return delay(true);
  }
  ok(await sb.from('submissions').insert({ name, email, idea }));
  return true;
}

export async function subscribe({ name = '', email, frequency = 'each' }) {
  email = email.trim().toLowerCase();
  if (DEMO) {
    if (db.subscribers.some((s) => s.email === email)) return { already: true };
    db.subscribers.push({ id: uid(), token: uid(), name, email, frequency, created_at: nowIso() });
    demoMail(email, 'You are subscribed to ArchMentor', 'subscribed');
    save(); return delay({ already: false });
  }
  const { error } = await sb.from('subscribers').insert({ name, email, frequency });
  if (error?.code === '23505') return { already: true };
  if (error) fail(error);
  return { already: false };
}

export async function unsubscribe(token) {
  if (DEMO) { const n = db.subscribers.length; db.subscribers = db.subscribers.filter((s) => s.token !== token); save(); return delay(db.subscribers.length < n); }
  return ok(await sb.rpc('unsubscribe', { t: token }));
}

// ================================================================ ADMIN
export async function adminList(table) {
  if (!TABLES.includes(table)) fail('Unknown table');
  if (DEMO) { if (!isAdmin() && !demo.isStaff()) fail('Admins only.'); return delay([...db[table]].sort(byNewest)); }
  if (table === 'sessions') return ok(await sb.rpc('admin_sessions'));
  const order = table === 'posts' ? 'published_at' : 'created_at';
  return ok(await sb.from(table).select('*').order(order, { ascending: false }));
}

export async function adminSave(table, row) {
  if (!TABLES.includes(table)) fail('Unknown table');
  if (DEMO) {
    if (!isAdmin() && !demo.isStaff()) fail('Admins only.');
    if (row.id) {
      const r = db[table].find((x) => x.id === row.id);
      const wasApproved = r.approved; Object.assign(r, row);
      if (table === 'profiles' && r.role === 'mentor' && r.approved && !wasApproved) demoMail(r.email, 'You are now a verified mentor', 'mentor-approved');
      save(); return delay(r);
    }
    const r = { ...row, id: uid(), created_at: nowIso() };
    db[table].push(r);
    if (table === 'sessions' && r.published) db.subscribers.forEach((s) => demoMail(s.email, `Free live session: ${r.title}`, 'session-announce'));
    save(); return delay(r);
  }
  const { id, created_at, ...rest } = row;
  // Sessions hold a private join link, so they are saved without reading the row back.
  if (table === 'sessions') {
    if (id) ok(await sb.from('sessions').update(rest).eq('id', id));
    else ok(await sb.from('sessions').insert(rest));
    return true;
  }
  if (id) return ok(await sb.from(table).update(rest).eq('id', id).select().single());
  return ok(await sb.from(table).insert(rest).select().single());
}

export async function adminDelete(table, id) {
  if (!TABLES.includes(table)) fail('Unknown table');
  if (DEMO) { if (!isAdmin() && !demo.isStaff()) fail('Admins only.'); db[table] = db[table].filter((x) => x.id !== id); save(); return delay(true); }
  ok(await sb.from(table).delete().eq('id', id));
  return true;
}

// Settings and emails
export async function getSettings() {
  if (DEMO) return delay({ ...db.settings });
  return ok(await sb.rpc('admin_settings'));
}

export async function saveSettings(s) {
  const clean = pick(s, ['site_name', 'site_url', 'admin_email', 'sender_email', 'sender_name', 'reply_to', 'emails_on', 'payments_mode', 'razorpay_key_id',
    'default_commission_bps', 'gateway_fee_bps', 'gst_bps', 'payout_hold_days', 'payout_two_person_paise', 'cancel_hours', 'slot_hold_minutes',
    'support_email', 'business_name', 'business_address', 'daily_email_cap']);
  ['default_commission_bps', 'gateway_fee_bps', 'gst_bps', 'payout_hold_days', 'payout_two_person_paise', 'cancel_hours', 'slot_hold_minutes', 'daily_email_cap']
    .forEach((k) => { if (k in clean) clean[k] = Math.round(Number(clean[k]) || 0); });
  if (DEMO) { Object.assign(db.settings, clean); save(); return delay(true); }
  ok(await sb.from('site_settings').update(clean).eq('id', 1));
  return true;
}

export async function emailStatus() {
  if (DEMO) return delay({ has_key: !!db.settings.brevo_key });
  return ok(await sb.rpc('admin_email_status'));
}

export async function setBrevoKey(k) {
  if (DEMO) { db.settings.brevo_key = 'set'; save(); return delay(true); }
  ok(await sb.rpc('admin_set_brevo_key', { k }));
  return true;
}

export async function sendTestEmail() {
  if (DEMO) { if (!db.settings.admin_email) fail('Add the admin email in Settings first'); demoMail(db.settings.admin_email, 'Test email from ArchMentor', 'test'); save(); return delay(true); }
  ok(await sb.rpc('admin_send_test_email'));
  return true;
}

export async function emailLog() {
  if (DEMO) return delay((db.email_log || []).slice(0, 200));
  return ok(await sb.rpc('admin_email_log', { lim: 200 }));
}

// ================================================================ IMAGES
// Shrinks big photos in the browser before upload (max 1600 px, WebP), so pages stay fast.
export async function prepareImage(file, maxSize = 1600) {
  if (!file || !file.type.startsWith('image/')) fail('Please choose an image file.');
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.85));
  return blob && blob.size < file.size ? blob : file;
}

const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob);
});

// Upload an image and return its public URL.
export async function uploadImage(file) {
  const user = await getUser();
  if (!user) fail('Please log in to upload images.');
  if (file.size > 15 * 1024 * 1024) fail('That image is larger than 15 MB. Please choose a smaller one.');
  const blob = await prepareImage(file, DEMO ? 1000 : 1600);
  if (DEMO) return readAsDataUrl(blob); // demo: kept inside this browser only
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : 'jpg';
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  ok(await sb.storage.from('images').upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000' }));
  return sb.storage.from('images').getPublicUrl(path).data.publicUrl;
}

// ================================================================ STORIES (editor)
// Admins can write and publish. Approved mentors can write drafts and submit them for review.
export async function listMyStories() {
  const user = await getUser(); if (!user) return [];
  if (DEMO) return delay(db.posts.filter((p) => p.author_id === user.id).sort(byNewest));
  return ok(await sb.from('posts').select('*').eq('author_id', user.id).order('created_at', { ascending: false }));
}

export async function getStoryForEdit(id) {
  if (DEMO) {
    const p = db.posts.find((x) => x.id === id);
    if (!p || !(isAdmin() || p.author_id === demoUserId())) return delay(null);
    return delay({ ...p });
  }
  return ok(await sb.from('posts').select('*').eq('id', id).maybeSingle());
}

export async function saveStory(row) {
  const user = await getUser(); if (!user) fail('Please log in.');
  const fields = ['title', 'slug', 'dek', 'body', 'tag', 'author_name', 'cover_url', 'youtube_id', 'published', 'published_at', 'submitted'];
  const clean = Object.fromEntries(Object.entries(row).filter(([k]) => fields.includes(k)));
  if (DEMO) {
    const admin = isAdmin();
    if (!admin) { if (me()?.role !== 'mentor') fail('Not allowed.'); clean.published = false; }
    if (db.posts.some((p) => p.slug === clean.slug && p.id !== row.id)) clean.slug = `${clean.slug}-${Math.random().toString(36).slice(2, 6)}`;
    if (row.id) {
      const p = db.posts.find((x) => x.id === row.id);
      if (!p || !(admin || (p.author_id === user.id && !p.published))) fail('Not allowed.');
      Object.assign(p, clean); save(); return delay({ ...p });
    }
    const p = { ...clean, id: uid(), author_id: user.id, created_at: nowIso() };
    db.posts.push(p); save(); return delay({ ...p });
  }
  const attempt = async (data) => (row.id
    ? sb.from('posts').update(data).eq('id', row.id).select().single()
    : sb.from('posts').insert({ ...data, author_id: user.id }).select().single());
  let res = await attempt(clean);
  if (res.error?.code === '23505') res = await attempt({ ...clean, slug: `${clean.slug}-${Math.random().toString(36).slice(2, 6)}` });
  return ok(res);
}

export async function deleteStory(id) {
  if (DEMO) {
    const p = db.posts.find((x) => x.id === id);
    if (!p || !(isAdmin() || (p.author_id === demoUserId() && !p.published))) fail('Not allowed.');
    db.posts = db.posts.filter((x) => x.id !== id); save(); return delay(true);
  }
  ok(await sb.from('posts').delete().eq('id', id));
  return true;
}
