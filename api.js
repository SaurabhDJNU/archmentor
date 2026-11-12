// One data API for the whole app, with two backends:
//  - Supabase, when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
//  - Demo mode otherwise: sample data kept in this browser's localStorage
import { createClient } from '@supabase/supabase-js';
import { seed } from './seed.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const DEMO = !(URL_ && KEY);

const sb = DEMO ? null : createClient(URL_, KEY);

// ---------------------------------------------------------------- helpers
const fail = (e) => { throw new Error(e?.message || String(e)); };
const ok = ({ data, error }) => (error ? fail(error) : data);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const nowIso = () => new Date().toISOString();
const byNewest = (a, b) => (b.published_at || b.created_at || '').localeCompare(a.published_at || a.created_at || '');

const TABLES = ['profiles', 'requests', 'sessions', 'registrations', 'posts', 'videos', 'questions', 'submissions', 'subscribers'];

// ---------------------------------------------------------------- demo store
const KEY_DB = 'archmentor_demo_db_v1';
const KEY_SESSION = 'archmentor_demo_session';
const listeners = new Set();

function loadDb() {
  try {
    const raw = localStorage.getItem(KEY_DB);
    if (raw) return JSON.parse(raw);
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
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));

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

export async function signUp({ email, password, full_name, role }) {
  role = role === 'mentor' ? 'mentor' : 'student';
  if (DEMO) {
    email = email.trim().toLowerCase();
    if (db.profiles.some((p) => p.email === email)) fail('An account with this email already exists.');
    const id = uid();
    db.profiles.push({ id, email, full_name, role, approved: false, title: '', organisation: '', bio: '', photo_url: '', linkedin_url: '', specialties: [], stage: '', created_at: nowIso() });
    db.passwords[email] = password;
    save(); setDemoUser(id);
    return { needsConfirmation: false };
  }
  const redirect = window.location.origin + import.meta.env.BASE_URL + 'dashboard';
  const data = ok(await sb.auth.signUp({ email, password, options: { data: { full_name, role }, emailRedirectTo: redirect } }));
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
  ok(await sb.auth.signInWithPassword({ email, password }));
  return true;
}

export async function signOut() {
  if (DEMO) { setDemoUser(null); return; }
  await sb.auth.signOut();
}

export async function sendPasswordReset(email) {
  if (DEMO) return delay(true);
  const redirect = window.location.origin + import.meta.env.BASE_URL + 'reset-password';
  ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect }));
  return true;
}

export async function updatePassword(password) {
  if (DEMO) { const p = me(); if (p) { db.passwords[p.email] = password; save(); } return true; }
  ok(await sb.auth.updateUser({ password }));
  return true;
}

// ================================================================ PROFILES
export async function getMyProfile() {
  if (DEMO) return delay(me());
  const user = await getUser();
  if (!user) return null;
  return ok(await sb.from('profiles').select('*').eq('id', user.id).maybeSingle());
}

export async function updateMyProfile(patch) {
  const allowed = ['full_name', 'title', 'organisation', 'bio', 'photo_url', 'linkedin_url', 'specialties', 'stage'];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  if (DEMO) { Object.assign(me(), clean); save(); return delay(me()); }
  const user = await getUser();
  return ok(await sb.from('profiles').update(clean).eq('id', user.id).select().single());
}

export async function listMentors() {
  if (DEMO) return delay(db.profiles.filter((p) => p.role === 'mentor' && p.approved));
  return ok(await sb.from('profiles').select('*').eq('role', 'mentor').eq('approved', true).order('created_at'));
}

export async function getMentor(id) {
  if (DEMO) return delay(db.profiles.find((p) => p.id === id && p.role === 'mentor' && (p.approved || isAdmin() || p.id === demoUserId())) || null);
  return ok(await sb.from('profiles').select('*').eq('id', id).eq('role', 'mentor').maybeSingle());
}

// ================================================================ REQUESTS
export async function createRequest({ mentor_id, service, stage, message, preferred_time }) {
  if (DEMO) {
    const s = me(); if (!s) fail('Please log in first.');
    if (s.role !== 'student') fail('Only student accounts can request a session.');
    const m = db.profiles.find((p) => p.id === mentor_id);
    db.requests.push({ id: uid(), student_id: s.id, mentor_id, student_name: s.full_name, student_email: s.email, mentor_name: m?.full_name || '', service, stage, message, preferred_time, status: 'pending', meeting_link: '', mentor_note: '', created_at: nowIso() });
    save(); return delay(true);
  }
  const user = await getUser(); if (!user) fail('Please log in first.');
  ok(await sb.from('requests').insert({ student_id: user.id, mentor_id, service, stage, message, preferred_time }));
  return true;
}

export async function listMyRequests() {
  if (DEMO) {
    const id = demoUserId();
    return delay(db.requests.filter((r) => r.student_id === id || r.mentor_id === id).sort(byNewest));
  }
  return ok(await sb.from('requests').select('*').order('created_at', { ascending: false }));
}

export async function updateRequest(id, patch) {
  if (DEMO) {
    const r = db.requests.find((x) => x.id === id); if (!r) fail('Request not found.');
    const u = demoUserId();
    if (u === r.mentor_id || isAdmin()) Object.assign(r, pick(patch, ['status', 'meeting_link', 'mentor_note']));
    else if (u === r.student_id && patch.status === 'cancelled') r.status = 'cancelled';
    else fail('Not allowed.');
    save(); return delay(r);
  }
  return ok(await sb.from('requests').update(patch).eq('id', id).select().single());
}
const pick = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => keys.includes(k)));

// ================================================================ SESSIONS
export async function listSessions() {
  if (DEMO) return delay(db.sessions.filter((s) => s.published).sort((a, b) => (a.starts_at || '').localeCompare(b.starts_at || '')));
  return ok(await sb.from('sessions').select('id,title,description,kind,starts_at,format,featured,published,created_at').eq('published', true).order('starts_at', { ascending: true }));
}

export async function seatCount(session_id) {
  if (DEMO) return db.registrations.filter((r) => r.session_id === session_id).length;
  const { data } = await sb.rpc('session_seat_count', { sid: session_id });
  return data ?? 0;
}

export async function registerForSession({ session_id, name, email }) {
  email = email.trim().toLowerCase();
  if (DEMO) {
    if (db.registrations.some((r) => r.session_id === session_id && r.email === email)) return { already: true };
    db.registrations.push({ id: uid(), session_id, name, email, created_at: nowIso() });
    save(); return delay({ already: false });
  }
  const { error } = await sb.from('registrations').insert({ session_id, name, email });
  if (error?.code === '23505') return { already: true };
  if (error) fail(error);
  return { already: false };
}

// ================================================================ JOURNAL, VIDEOS, Q&A
export async function listPosts() {
  if (DEMO) return delay(db.posts.filter((p) => p.published).sort(byNewest));
  return ok(await sb.from('posts').select('id,slug,title,dek,tag,author_name,cover_url,published_at').eq('published', true).order('published_at', { ascending: false }));
}

export async function getPost(slug) {
  if (DEMO) return delay(db.posts.find((p) => p.slug === slug && (p.published || isAdmin())) || null);
  return ok(await sb.from('posts').select('*').eq('slug', slug).maybeSingle());
}

export async function listVideos() {
  if (DEMO) return delay(db.videos.filter((v) => v.published).sort((a, b) => a.sort - b.sort));
  return ok(await sb.from('videos').select('*').eq('published', true).order('sort'));
}

export async function listAnsweredQuestions() {
  if (DEMO) return delay(db.questions.filter((q) => q.published).sort(byNewest));
  return ok(await sb.from('questions').select('*').eq('published', true).order('created_at', { ascending: false }));
}

export async function askQuestion({ name, stage, question, show_name }) {
  const row = { name, stage, question, show_name: !!show_name };
  if (DEMO) { db.questions.push({ id: uid(), ...row, answer: '', answered_by: '', published: false, created_at: nowIso() }); save(); return delay(true); }
  ok(await sb.from('questions').insert(row));
  return true;
}

export async function submitStory({ name, email, idea }) {
  if (DEMO) { db.submissions.push({ id: uid(), name, email, idea, status: 'new', created_at: nowIso() }); save(); return delay(true); }
  ok(await sb.from('submissions').insert({ name, email, idea }));
  return true;
}

export async function subscribe({ name = '', email, frequency = 'each' }) {
  email = email.trim().toLowerCase();
  if (DEMO) {
    if (db.subscribers.some((s) => s.email === email)) return { already: true };
    db.subscribers.push({ id: uid(), name, email, frequency, created_at: nowIso() }); save();
    return delay({ already: false });
  }
  const { error } = await sb.from('subscribers').insert({ name, email, frequency });
  if (error?.code === '23505') return { already: true };
  if (error) fail(error);
  return { already: false };
}

// ================================================================ ADMIN
export async function adminList(table) {
  if (!TABLES.includes(table)) fail('Unknown table');
  if (DEMO) { if (!isAdmin()) fail('Admins only.'); return delay([...db[table]].sort(byNewest)); }
  const order = table === 'posts' ? 'published_at' : 'created_at';
  return ok(await sb.from(table).select('*').order(order, { ascending: false }));
}

export async function adminSave(table, row) {
  if (!TABLES.includes(table)) fail('Unknown table');
  if (DEMO) {
    if (!isAdmin()) fail('Admins only.');
    if (row.id) { const r = db[table].find((x) => x.id === row.id); Object.assign(r, row); save(); return delay(r); }
    const r = { ...row, id: uid(), created_at: nowIso() };
    db[table].push(r); save(); return delay(r);
  }
  if (row.id) {
    const { id, created_at, ...rest } = row;
    return ok(await sb.from(table).update(rest).eq('id', id).select().single());
  }
  return ok(await sb.from(table).insert(row).select().single());
}

export async function adminDelete(table, id) {
  if (!TABLES.includes(table)) fail('Unknown table');
  if (DEMO) { if (!isAdmin()) fail('Admins only.'); db[table] = db[table].filter((x) => x.id !== id); save(); return delay(true); }
  ok(await sb.from(table).delete().eq('id', id));
  return true;
}
