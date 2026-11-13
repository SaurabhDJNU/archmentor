// Platform features: staff & permissions, notifications, availability, payments, finance,
// portfolio reviews, opportunities, resources, support, calls, campaigns, moderation, analytics.
// Same two backends as api.js: Supabase (real) or demo (this browser only).
import { DEMO, demo, client, unwrap as ok, getUser } from './api.js';
import { calcCommission, pickRule } from './money.js';
import { effectivePermissions, PERMISSIONS, ROLES as STAFF_ROLES } from './permissions.js';

const sb = () => client();
const D = () => demo.db;
const fail = (m) => { throw new Error(m); };
const nowIso = () => new Date().toISOString();
const list = (k) => { const d = D(); d[k] = d[k] || []; return d[k]; };
const byNew = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''));
const done = (v) => { demo.save(); return demo.delay(v); };
const pick = (o, keys) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => keys.includes(k)));

// ================================================================ permissions & staff
const demoAal2 = () => { try { return sessionStorage.getItem('am_demo_aal2') === '1'; } catch { return false; } };
function demoPerms(userId) {
  const p = D().profiles.find((x) => x.id === userId);
  const st = list('staff_members').find((s) => s.user_id === userId);
  return effectivePermissions({
    isAdmin: p?.role === 'admin',
    active: st?.status === 'active',
    roles: list('staff_role_assignments').filter((a) => a.user_id === userId).map((a) => a.role_key),
    overrides: list('staff_permission_overrides').filter((o) => o.user_id === userId),
    aal2: p?.role === 'admin' || demoAal2() || !list('mfa_factors').some((f) => f.user_id === userId),
  });
}
if (DEMO) demo.perms = (id) => { const m = demoPerms(id); return new Set([...m].filter(([, v]) => v).map(([k]) => k)); };

// Returns { key: true | 'mfa' } — 'mfa' means allowed after two-step sign-in
export async function myPermissions() {
  const user = await getUser(); if (!user) return {};
  if (DEMO) {
    const m = demoPerms(user.id);
    return Object.fromEntries([...m].map(([k, v]) => [k, v ? true : 'mfa']));
  }
  const rows = ok(await sb().rpc('my_permissions'));
  return Object.fromEntries((rows || []).map((r) => [r.permission, r.needs_mfa ? 'mfa' : true]));
}

export async function acceptStaffInvite() {
  if (DEMO) {
    const u = demo.me(); if (!u) return false;
    const inv = list('staff_invites').find((i) => i.email === u.email && !i.accepted_at && !i.revoked_at);
    if (!inv) return !!list('staff_members').find((s) => s.user_id === u.id && s.status === 'active') || u.role === 'admin';
    list('staff_members').push({ user_id: u.id, email: u.email, full_name: u.full_name, status: 'active', created_at: nowIso() });
    inv.role_keys.forEach((r) => list('staff_role_assignments').push({ user_id: u.id, role_key: r }));
    inv.accepted_at = nowIso(); if (u.role !== 'admin') u.role = 'staff';
    audit('staff.accept', 'staff_members', u.id);
    return done(true);
  }
  return ok(await sb().rpc('staff_accept_invite'));
}

export async function logEvent(action, details = {}) {
  if (DEMO) { audit(action, 'client', '', details); demo.save(); return; }
  try { await sb().rpc('log_event', { p_action: action, p_details: details }); } catch { /* never block */ }
}

function audit(action, entity, entity_id, details = {}) {
  if (!DEMO) return;
  const u = demo.me();
  list('audit_logs').unshift({ id: Date.now() + Math.random(), actor_id: u?.id || null, actor_email: u?.email || 'system', action, entity, entity_id: String(entity_id || ''), details, created_at: nowIso() });
}

export async function listStaff() {
  if (DEMO) {
    return demo.delay(list('staff_members').map((s) => ({
      ...s,
      roles: list('staff_role_assignments').filter((a) => a.user_id === s.user_id).map((a) => a.role_key),
      overrides: list('staff_permission_overrides').filter((o) => o.user_id === s.user_id),
    })));
  }
  const [members, roles, overrides] = await Promise.all([
    sb().from('staff_members').select('*').order('created_at'),
    sb().from('staff_role_assignments').select('*'),
    sb().from('staff_permission_overrides').select('*'),
  ]);
  return ok(members).map((s) => ({
    ...s,
    roles: ok(roles).filter((a) => a.user_id === s.user_id).map((a) => a.role_key),
    overrides: ok(overrides).filter((o) => o.user_id === s.user_id),
  }));
}
export async function listInvites() {
  if (DEMO) return demo.delay(list('staff_invites').filter((i) => !i.accepted_at && !i.revoked_at));
  return ok(await sb().from('staff_invites').select('*').is('accepted_at', null).is('revoked_at', null).order('created_at', { ascending: false }));
}
export async function inviteStaff(email, name, roles) {
  if (DEMO) {
    if (demo.me()?.role !== 'admin') fail('Only the main admin can invite staff');
    list('staff_invites').push({ id: demo.uid(), email: email.trim().toLowerCase(), full_name: name, role_keys: roles, created_at: nowIso() });
    demo.demoMail(email, 'You have been invited to the ArchMentor team', 'staff-invite');
    audit('staff.invite', 'staff_invites', email, { roles });
    return done(true);
  }
  return ok(await sb().rpc('staff_invite', { p_email: email, p_name: name, p_roles: roles }));
}
export async function revokeInvite(id) {
  if (DEMO) { const i = list('staff_invites').find((x) => x.id === id); if (i) i.revoked_at = nowIso(); return done(true); }
  return ok(await sb().rpc('staff_revoke_invite', { p_id: id }));
}
export async function setStaffRoles(userId, roles) {
  if (DEMO) {
    if (userId === demo.userId()) fail('You cannot change your own access');
    D().staff_role_assignments = list('staff_role_assignments').filter((a) => a.user_id !== userId).concat(roles.map((r) => ({ user_id: userId, role_key: r })));
    audit('staff.roles', 'staff_members', userId, { roles });
    return done(true);
  }
  return ok(await sb().rpc('staff_set_roles', { p_user: userId, p_roles: roles }));
}
export async function setOverride(userId, permission, allow, reason) {
  if (DEMO) {
    if (userId === demo.userId()) fail('You cannot change your own access');
    if (!reason?.trim()) fail('Give a reason');
    D().staff_permission_overrides = list('staff_permission_overrides').filter((o) => !(o.user_id === userId && o.permission === permission));
    if (allow !== null) list('staff_permission_overrides').push({ user_id: userId, permission, allow, reason, created_at: nowIso() });
    audit('staff.override', 'staff_members', userId, { permission, allow, reason });
    return done(true);
  }
  return ok(await sb().rpc('staff_set_override', { p_user: userId, p_perm: permission, p_allow: allow, p_reason: reason }));
}
export async function setStaffStatus(userId, status) {
  if (DEMO) {
    const s = list('staff_members').find((x) => x.user_id === userId); if (s) { s.status = status; s.suspended_at = status === 'suspended' ? nowIso() : null; }
    audit(`staff.${status}`, 'staff_members', userId);
    return done(true);
  }
  return ok(await sb().rpc('staff_set_status', { p_user: userId, p_status: status }));
}
export { PERMISSIONS, STAFF_ROLES };

// ================================================================ two-step sign-in (MFA)
export async function mfaState() {
  if (DEMO) {
    const u = demo.me();
    const factors = list('mfa_factors').filter((f) => f.user_id === u?.id);
    return { factors, aal: demoAal2() ? 'aal2' : 'aal1', next: factors.length ? 'aal2' : 'aal1' };
  }
  const { data: f } = await sb().auth.mfa.listFactors();
  const { data: a } = await sb().auth.mfa.getAuthenticatorAssuranceLevel();
  return { factors: (f?.totp || []).filter((x) => x.status === 'verified'), aal: a?.currentLevel, next: a?.nextLevel };
}
export async function mfaEnroll() {
  if (DEMO) return demo.delay({ id: 'demo-factor', qr: null, secret: 'DEMO-CODE-123456', demo: true });
  const { data, error } = await sb().auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator ' + new Date().toISOString().slice(0, 10) });
  if (error) fail(error.message);
  return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}
export async function mfaVerify(factorId, code) {
  if (DEMO) {
    if (code !== '123456') fail('Wrong code. In the demo the code is 123456.');
    const u = demo.me();
    if (!list('mfa_factors').some((f) => f.user_id === u.id)) list('mfa_factors').push({ id: demo.uid(), user_id: u.id, status: 'verified', created_at: nowIso() });
    try { sessionStorage.setItem('am_demo_aal2', '1'); } catch { /* ignore */ }
    audit('mfa.enrolled', 'client', u.id);
    return done(true);
  }
  const { data: ch, error: e1 } = await sb().auth.mfa.challenge({ factorId });
  if (e1) fail(e1.message);
  const { error } = await sb().auth.mfa.verify({ factorId, challengeId: ch.id, code });
  if (error) fail('Wrong or expired code. Try the newest code from your app.');
  await logEvent('mfa.enrolled');
  return true;
}
export async function mfaUnenroll(factorId) {
  if (DEMO) { D().mfa_factors = list('mfa_factors').filter((f) => f.id !== factorId); return done(true); }
  const { error } = await sb().auth.mfa.unenroll({ factorId });
  if (error) fail(error.message);
  await logEvent('mfa.removed');
  return true;
}

// ================================================================ notifications
export async function listNotifications() {
  const user = await getUser(); if (!user) return [];
  if (DEMO) return demo.delay(list('notifications').filter((n) => n.user_id === user.id).slice(0, 30));
  return ok(await sb().from('notifications').select('*').order('created_at', { ascending: false }).limit(30));
}
export async function markNotificationsRead(ids = null) {
  const user = await getUser(); if (!user) return;
  if (DEMO) { list('notifications').filter((n) => n.user_id === user.id && (!ids || ids.includes(n.id))).forEach((n) => { n.read_at = n.read_at || nowIso(); }); demo.save(); return; }
  await sb().rpc('mark_notifications_read', { ids });
}

// ================================================================ public settings (payments)
export async function publicSettings() {
  if (DEMO) return demo.delay(pick(D().settings, ['site_name', 'site_url', 'payments_mode', 'razorpay_key_id', 'cancel_hours', 'support_email', 'business_name', 'business_address']));
  return ok(await sb().from('site_settings').select('site_name,site_url,payments_mode,razorpay_key_id,cancel_hours,support_email,business_name,business_address').eq('id', 1).maybeSingle()) || {};
}

// ================================================================ availability & slots
export async function mentorAvailability(mentorId) {
  if (DEMO) return demo.delay(list('mentor_availability').filter((a) => a.mentor_id === mentorId));
  return ok(await sb().from('mentor_availability').select('*').eq('mentor_id', mentorId));
}
export async function mentorBusy(mentorId, from, to) {
  if (DEMO) {
    const busy = D().requests.filter((r) => r.mentor_id === mentorId && r.start_at && ['pending', 'awaiting_payment', 'confirmed', 'approved'].includes(r.status))
      .map((r) => ({ start_at: r.start_at, end_at: r.end_at || new Date(+new Date(r.start_at) + (r.duration_min || 60) * 60000).toISOString() }));
    return demo.delay(busy.concat(list('mentor_time_off').filter((t) => t.mentor_id === mentorId).map((t) => ({ start_at: t.starts_at, end_at: t.ends_at }))));
  }
  return ok(await sb().rpc('mentor_busy', { p_mentor: mentorId, p_from: from.toISOString(), p_to: to.toISOString() }));
}
export async function saveAvailability(rows) {
  const user = await getUser(); if (!user) fail('Please log in.');
  const clean = rows.map((r) => ({ mentor_id: user.id, weekday: Number(r.weekday), start_time: r.start_time, end_time: r.end_time, slot_minutes: Number(r.slot_minutes) || 60 }));
  clean.forEach((r) => { if (r.end_time <= r.start_time) fail('Each block must end after it starts'); });
  if (DEMO) { D().mentor_availability = list('mentor_availability').filter((a) => a.mentor_id !== user.id).concat(clean.map((r) => ({ ...r, id: demo.uid() }))); return done(true); }
  ok(await sb().from('mentor_availability').delete().eq('mentor_id', user.id));
  if (clean.length) ok(await sb().from('mentor_availability').insert(clean));
  return true;
}
export async function myTimeOff() {
  const user = await getUser(); if (!user) return [];
  if (DEMO) return demo.delay(list('mentor_time_off').filter((t) => t.mentor_id === user.id));
  return ok(await sb().from('mentor_time_off').select('*').eq('mentor_id', user.id).order('starts_at'));
}
export async function addTimeOff({ starts_at, ends_at, note }) {
  const user = await getUser();
  if (!(new Date(ends_at) > new Date(starts_at))) fail('The end must be after the start');
  const row = { mentor_id: user.id, starts_at: new Date(starts_at).toISOString(), ends_at: new Date(ends_at).toISOString(), note: note || '' };
  if (DEMO) { list('mentor_time_off').push({ ...row, id: demo.uid() }); return done(true); }
  ok(await sb().from('mentor_time_off').insert(row)); return true;
}
export async function deleteTimeOff(id) {
  if (DEMO) { D().mentor_time_off = list('mentor_time_off').filter((t) => t.id !== id); return done(true); }
  ok(await sb().from('mentor_time_off').delete().eq('id', id)); return true;
}
export async function rescheduleBooking(id, startIso) {
  if (DEMO) {
    const r = D().requests.find((x) => x.id === id); if (!r) fail('Not found');
    if (r.start_at && new Date(r.start_at) - Date.now() < (D().settings.cancel_hours || 24) * 3600000) fail(`Bookings can be moved up to ${D().settings.cancel_hours || 24} hours before the start`);
    r.start_at = startIso; r.end_at = new Date(+new Date(startIso) + (r.duration_min || 60) * 60000).toISOString();
    demo.demoMail(r.student_email, `Rescheduled: ${r.service_title}`, 'booking-rescheduled');
    return done(true);
  }
  return ok(await sb().rpc('reschedule_booking', { p_id: id, p_start: startIso }));
}

// ================================================================ payments (Razorpay Checkout)
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.head.appendChild(s);
  });
}

// Demo: the same rules as the database, run in the browser
function demoCreateOrder(kind, ref) {
  const d = D(); const u = demo.me(); if (!u) fail('Please sign in');
  if (d.settings.payments_mode === 'off') fail('Online payments are not switched on yet');
  let price; let stype; let mentor; let descr;
  if (kind === 'booking') {
    const r = d.requests.find((x) => x.id === ref && x.student_id === u.id && x.status === 'awaiting_payment'); if (!r) fail('Nothing to pay for here (it may have expired)');
    price = r.price_paise || r.price_inr * 100; stype = r.service_type || 'consultation'; mentor = r.mentor_id; descr = `${r.service_title} with ${r.mentor_name}`;
  } else if (kind === 'event') {
    const g = d.registrations.find((x) => x.id === ref && x.user_id === u.id && x.status === 'awaiting_payment'); if (!g) fail('Nothing to pay for here');
    const s = d.sessions.find((x) => x.id === g.session_id); price = s.price_paise; stype = 'event'; mentor = s.host_mentor_id || null; descr = `Live session: ${s.title}`;
  } else {
    const p = list('portfolio_projects').find((x) => x.id === ref && x.student_id === u.id && x.status === 'awaiting_payment'); if (!p) fail('Nothing to pay for here');
    price = p.price_paise; stype = 'portfolio_review'; mentor = p.assigned_mentor_id || null; descr = `Portfolio review: ${p.title}`;
  }
  const rule = pickRule(list('commission_rules'), { serviceType: stype, mentorId: mentor });
  const c = calcCommission(price, rule, d.settings);
  const o = { id: demo.uid(), kind, ref_id: ref, buyer_id: u.id, mentor_id: mentor, description: descr, price_paise: price, amount_paise: c.customer_total_paise,
    currency: 'INR', platform_fee_paise: c.platform_fee_paise, gateway_est_paise: c.gateway_est_paise, mentor_net_paise: c.mentor_net_paise,
    commission_snapshot: { ...c, rule_id: rule?.id || null, rule_name: rule?.name || 'Default' }, status: 'created', mode: 'test',
    provider_order_id: 'order_demo_' + Date.now(), refunded_paise: 0, mentor_reversed_paise: 0, payout_status: 'none', created_at: nowIso() };
  list('orders').push(o);
  return o;
}
function demoCapture(o) {
  o.status = 'paid'; o.paid_at = nowIso(); o.provider_payment_id = 'pay_demo_' + Date.now();
  const L = list('financial_ledger'); const ref = o.provider_payment_id;
  [['payment_received', o.amount_paise, null], ['gateway_fee', o.gateway_est_paise, null], ['platform_fee', o.platform_fee_paise, null], ['mentor_payable', o.mentor_net_paise, o.mentor_id]]
    .forEach(([entry_type, amount_paise, mentor_id]) => L.push({ id: L.length + 1, order_id: o.id, mentor_id, entry_type, amount_paise, reference: ref, note: o.description, created_at: nowIso() }));
  const d = D();
  if (o.kind === 'booking') {
    const r = d.requests.find((x) => x.id === o.ref_id); r.status = 'confirmed'; r.order_id = o.id;
    demo.demoMail(r.student_email, `Confirmed: your session with ${r.mentor_name}`, 'booking-confirmed');
    demo.demoMail(d.profiles.find((p) => p.id === r.mentor_id)?.email, `Confirmed and paid: ${r.student_name}`, 'booking-confirmed-mentor');
    demo.demoNotify(r.mentor_id, 'Booking confirmed', r.service_title, '/dashboard?tab=requests');
  } else if (o.kind === 'event') {
    const g = d.registrations.find((x) => x.id === o.ref_id); g.status = 'confirmed'; g.order_id = o.id;
    demo.demoMail(g.email, 'Your seat is reserved', 'session-registered');
  } else {
    const p = list('portfolio_projects').find((x) => x.id === o.ref_id); p.status = 'submitted'; p.order_id = o.id; p.submitted_at = nowIso();
  }
  demo.demoNotify(o.buyer_id, 'Payment received', o.description, '/dashboard');
  audit('payment.captured', 'orders', o.id, { amount_paise: o.amount_paise });
}

// Pay for a booking, event seat or portfolio review. Resolves 'paid' or throws.
export async function payFor(kind, ref, { name, email, onDemoConfirm } = {}) {
  if (DEMO) {
    const o = demoCreateOrder(kind, ref);
    const okToPay = onDemoConfirm ? await onDemoConfirm(o) : window.confirm(`Demo payment of ₹${(o.amount_paise / 100).toFixed(2)} — no real money moves. Continue?`);
    if (!okToPay) { o.status = 'created'; demo.save(); fail('Payment cancelled'); }
    demoCapture(o);
    return done('paid');
  }
  const { data: order, error } = await sb().functions.invoke('create-checkout-order', { body: { kind, ref } });
  if (error || order?.error) fail(order?.error || (await error?.context?.json?.().catch(() => null))?.error || error.message);
  const Razorpay = await loadRazorpay();
  const result = await new Promise((resolve, reject) => {
    const rz = new Razorpay({
      key: order.key_id,
      amount: order.amount_paise,
      currency: order.currency,
      order_id: order.provider_order_id,
      name: 'ArchMentor',
      description: order.description,
      prefill: { name: name || '', email: email || '' },
      theme: { color: '#111111' },
      modal: { ondismiss: () => reject(new Error('Payment window closed. Nothing was charged.')) },
      handler: (resp) => resolve(resp),
    });
    rz.on('payment.failed', (e) => reject(new Error(e?.error?.description || 'Payment failed. Nothing was charged.')));
    rz.open();
  });
  const { data: v, error: e2 } = await sb().functions.invoke('verify-payment', { body: result });
  if (e2 || v?.error) fail((v?.error || e2.message) + ' — if money left your account, it will be confirmed automatically within a few minutes.');
  return v.result === 'paid' ? 'paid' : v.result;
}

export async function myOrders() {
  const user = await getUser(); if (!user) return [];
  if (DEMO) return demo.delay(list('orders').filter((o) => o.buyer_id === user.id && o.status !== 'created').sort(byNew));
  return ok(await sb().from('orders').select('*').eq('buyer_id', user.id).neq('status', 'created').order('created_at', { ascending: false }));
}
export async function requestRefund(orderId, reason) {
  if (DEMO) {
    const o = list('orders').find((x) => x.id === orderId && x.buyer_id === demo.userId()); if (!o || !['paid', 'partially_refunded'].includes(o.status)) fail('This payment cannot be refunded');
    if (list('refund_requests').some((r) => r.order_id === orderId && ['requested', 'approved', 'processing'].includes(r.status))) fail('A refund request is already open');
    list('refund_requests').push({ id: demo.uid(), order_id: orderId, requested_by: demo.userId(), amount_paise: o.amount_paise - o.refunded_paise, reason, status: 'requested', created_at: nowIso() });
    return done(true);
  }
  return ok(await sb().rpc('request_refund', { p_order: orderId, p_reason: reason }));
}

// ================================================================ finance (staff)
export async function financeSummary(days = 30) {
  if (DEMO) {
    const since = Date.now() - days * 86400000; const L = list('financial_ledger');
    const sum = (t, all) => L.filter((e) => e.entry_type === t && (all || +new Date(e.created_at) > since)).reduce((a, e) => a + e.amount_paise, 0);
    const owed = L.filter((e) => e.mentor_id).reduce((a, e) => a + ({ mentor_payable: 1, adjustment: 1, mentor_payable_reversal: -1, payout: -1 }[e.entry_type] || 0) * e.amount_paise, 0);
    return demo.delay({ collected: sum('payment_received'), commission: sum('platform_fee') - sum('platform_fee_reversal'), gateway: sum('gateway_fee'), refunded: sum('refund'), owed_to_mentors: owed,
      open_refunds: list('refund_requests').filter((r) => ['requested', 'approved', 'failed'].includes(r.status)).length, in_review: list('orders').filter((o) => o.status === 'review').length, mode: D().settings.payments_mode });
  }
  return ok(await sb().rpc('finance_summary', { p_days: days }));
}
export async function listOrders() {
  if (DEMO) return demo.delay([...list('orders')].filter((o) => o.status !== 'created').sort(byNew));
  return ok(await sb().from('orders').select('*').neq('status', 'created').order('created_at', { ascending: false }).limit(500));
}
export async function listLedger() {
  if (DEMO) return demo.delay([...list('financial_ledger')].reverse().slice(0, 500));
  return ok(await sb().from('financial_ledger').select('*').order('id', { ascending: false }).limit(500));
}
export async function listRefunds() {
  if (DEMO) return demo.delay([...list('refund_requests')].sort(byNew).map((r) => ({ ...r, order: list('orders').find((o) => o.id === r.order_id) })));
  const rows = ok(await sb().from('refund_requests').select('*').order('created_at', { ascending: false }).limit(300));
  const ids = [...new Set(rows.map((r) => r.order_id))];
  const orders = ids.length ? ok(await sb().from('orders').select('*').in('id', ids)) : [];
  return rows.map((r) => ({ ...r, order: orders.find((o) => o.id === r.order_id) }));
}
function demoRefundProcessed(rr, reference) {
  const o = list('orders').find((x) => x.id === rr.order_id);
  rr.status = 'refunded'; rr.provider_refund_id = reference;
  const mrev = Math.min(Math.round(o.mentor_net_paise * rr.amount_paise / Math.max(o.amount_paise, 1)), o.mentor_net_paise - o.mentor_reversed_paise);
  const frev = Math.min(Math.round(o.platform_fee_paise * rr.amount_paise / Math.max(o.amount_paise, 1)), o.platform_fee_paise);
  const L = list('financial_ledger');
  [['refund', rr.amount_paise, null], ['platform_fee_reversal', frev, null], ['mentor_payable_reversal', mrev, o.mentor_id]]
    .forEach(([entry_type, amount_paise, mentor_id]) => L.push({ id: L.length + 1, order_id: o.id, mentor_id, entry_type, amount_paise, reference, created_at: nowIso() }));
  o.refunded_paise += rr.amount_paise; o.mentor_reversed_paise += mrev;
  o.status = o.refunded_paise >= o.amount_paise ? 'refunded' : 'partially_refunded';
  if (o.kind === 'booking' && o.status === 'refunded') { const r = D().requests.find((x) => x.id === o.ref_id); if (r) r.status = 'refunded'; }
  demo.demoNotify(o.buyer_id, 'Refund processed', o.description, '/dashboard');
  demo.demoMail(D().profiles.find((p) => p.id === o.buyer_id)?.email, 'Your refund has been processed', 'refund-processed');
  audit('refund.processed', 'refund_requests', rr.id, { amount_paise: rr.amount_paise });
}
export async function decideRefund(id, approve, amountPaise, note) {
  if (DEMO) {
    const rr = list('refund_requests').find((x) => x.id === id); if (!rr || !['requested', 'failed'].includes(rr.status)) fail('This refund is not waiting for a decision');
    if (rr.requested_by === demo.userId()) fail('Someone else must decide on a refund you requested');
    const o = list('orders').find((x) => x.id === rr.order_id);
    if (approve && (!(amountPaise > 0) || amountPaise > o.amount_paise - o.refunded_paise)) fail('Refund amount must be between ₹0.01 and the amount paid');
    Object.assign(rr, { status: approve ? 'approved' : 'rejected', amount_paise: approve ? amountPaise : rr.amount_paise, decided_by: demo.userId(), decided_at: nowIso(), decision_note: note || '' });
    audit(approve ? 'refund.approved' : 'refund.rejected', 'refund_requests', id, { amount_paise: amountPaise });
    return done(true);
  }
  return ok(await sb().rpc('decide_refund', { p_id: id, p_approve: approve, p_amount: amountPaise, p_note: note }));
}
export async function sendRefundToGateway(id) {
  if (DEMO) { const rr = list('refund_requests').find((x) => x.id === id); if (rr?.status !== 'approved') fail('Approve the refund first'); demoRefundProcessed(rr, 'rfnd_demo_' + Date.now()); return done('refunded'); }
  const { data, error } = await sb().functions.invoke('request-refund', { body: { refund_id: id } });
  if (error || data?.error) fail(data?.error || error.message);
  return data.result;
}
export async function recordManualRefund(id, reference) {
  if (DEMO) { const rr = list('refund_requests').find((x) => x.id === id); if (!rr || !['approved', 'processing', 'failed'].includes(rr.status)) fail('Approve the refund first'); if (!reference?.trim()) fail('Enter the refund reference'); demoRefundProcessed(rr, reference); return done('refunded'); }
  return ok(await sb().rpc('record_manual_refund', { p_id: id, p_reference: reference }));
}

export async function payoutCandidates() {
  if (DEMO) {
    const hold = (D().settings.payout_hold_days ?? 7) * 86400000;
    const ready = list('orders').filter((o) => ['paid', 'partially_refunded'].includes(o.status) && o.payout_status === 'none' && o.completed_at && Date.now() - +new Date(o.completed_at) >= hold);
    const by = {};
    ready.forEach((o) => { const m = D().profiles.find((p) => p.id === o.mentor_id); const f = list('mentor_finance').find((x) => x.mentor_id === o.mentor_id) || {};
      by[o.mentor_id] = by[o.mentor_id] || { mentor_id: o.mentor_id, full_name: m?.full_name, email: m?.email, ready_paise: 0, orders: 0, payout_method: f.payout_method || '', payout_display: f.payout_display || '', kyc_status: f.kyc_status || 'not_started' };
      by[o.mentor_id].ready_paise += o.mentor_net_paise - o.mentor_reversed_paise; by[o.mentor_id].orders += 1; });
    return demo.delay(Object.values(by));
  }
  return ok(await sb().rpc('payout_candidates'));
}
export async function preparePayout(mentorId) {
  if (DEMO) {
    if (list('mentor_payouts').some((p) => p.mentor_id === mentorId && ['prepared', 'approved'].includes(p.status))) fail('This mentor already has a payout waiting');
    const c = (await payoutCandidates()).find((x) => x.mentor_id === mentorId); if (!c || c.ready_paise <= 0) fail('Nothing is ready to pay this mentor yet');
    const id = demo.uid();
    list('mentor_payouts').push({ id, mentor_id: mentorId, amount_paise: c.ready_paise, status: 'prepared', prepared_by: demo.userId(), created_at: nowIso() });
    const hold = (D().settings.payout_hold_days ?? 7) * 86400000;
    list('orders').filter((o) => o.mentor_id === mentorId && o.payout_status === 'none' && o.completed_at && Date.now() - +new Date(o.completed_at) >= hold).forEach((o) => { o.payout_status = 'in_payout'; o.payout_id = id; });
    audit('payout.prepared', 'mentor_payouts', id, { amount_paise: c.ready_paise });
    return done(id);
  }
  return ok(await sb().rpc('prepare_payout', { p_mentor: mentorId }));
}
export async function listPayouts() {
  if (DEMO) return demo.delay([...list('mentor_payouts')].sort(byNew).map((p) => ({ ...p, mentor_name: D().profiles.find((x) => x.id === p.mentor_id)?.full_name })));
  const rows = ok(await sb().from('mentor_payouts').select('*').order('created_at', { ascending: false }).limit(300));
  const ids = [...new Set(rows.map((r) => r.mentor_id))];
  const people = ids.length ? ok(await sb().from('profiles').select('id,full_name').in('id', ids)) : [];
  return rows.map((p) => ({ ...p, mentor_name: people.find((x) => x.id === p.mentor_id)?.full_name || '' }));
}
export async function approvePayout(id) {
  if (DEMO) {
    const p = list('mentor_payouts').find((x) => x.id === id); if (!p || p.status !== 'prepared') fail('Only prepared payouts can be approved');
    if (p.prepared_by === demo.userId()) fail('A different person must approve a payout you prepared');
    if (p.amount_paise > (D().settings.payout_two_person_paise ?? 2500000) && demo.me()?.role !== 'admin') fail('Payouts above the limit must be approved by the main admin');
    Object.assign(p, { status: 'approved', approved_by: demo.userId(), approved_at: nowIso() }); audit('payout.approved', 'mentor_payouts', id);
    return done(true);
  }
  return ok(await sb().rpc('approve_payout', { p_id: id }));
}
export async function markPayoutPaid(id, reference) {
  if (DEMO) {
    const p = list('mentor_payouts').find((x) => x.id === id); if (!p || p.status !== 'approved') fail('Approve the payout first'); if (!reference?.trim()) fail('Enter the bank/UPI transfer reference');
    Object.assign(p, { status: 'paid', paid_at: nowIso(), reference });
    list('orders').filter((o) => o.payout_id === id).forEach((o) => { o.payout_status = 'paid'; });
    const L = list('financial_ledger'); L.push({ id: L.length + 1, mentor_id: p.mentor_id, entry_type: 'payout', amount_paise: p.amount_paise, reference, created_at: nowIso() });
    demo.demoNotify(p.mentor_id, 'Payout sent', reference, '/dashboard?tab=earnings'); audit('payout.paid', 'mentor_payouts', id, { reference });
    return done(true);
  }
  return ok(await sb().rpc('mark_payout_paid', { p_id: id, p_reference: reference }));
}
export async function cancelPayout(id, reason) {
  if (DEMO) { const p = list('mentor_payouts').find((x) => x.id === id); if (!p || !['prepared', 'approved'].includes(p.status)) fail('Only open payouts can be cancelled'); p.status = 'cancelled'; p.note = reason; list('orders').filter((o) => o.payout_id === id).forEach((o) => { o.payout_status = 'none'; o.payout_id = null; }); return done(true); }
  return ok(await sb().rpc('cancel_payout', { p_id: id, p_reason: reason }));
}
export async function listAdjustments() {
  if (DEMO) return demo.delay([...list('ledger_adjustments')].sort(byNew));
  return ok(await sb().from('ledger_adjustments').select('*').order('created_at', { ascending: false }));
}
export async function requestAdjustment(mentorId, orderId, amountPaise, reason) {
  if (DEMO) { if (!amountPaise) fail('Amount cannot be zero'); if ((reason || '').length < 5) fail('Explain the reason'); list('ledger_adjustments').push({ id: demo.uid(), mentor_id: mentorId, order_id: orderId || null, amount_paise: amountPaise, reason, status: 'requested', requested_by: demo.userId(), created_at: nowIso() }); return done(true); }
  return ok(await sb().rpc('request_adjustment', { p_mentor: mentorId, p_order: orderId || null, p_amount: amountPaise, p_reason: reason }));
}
export async function decideAdjustment(id, approve) {
  if (DEMO) {
    const a = list('ledger_adjustments').find((x) => x.id === id); if (!a || a.status !== 'requested') fail('Already decided');
    if (a.requested_by === demo.userId()) fail('A different person must approve an adjustment you requested');
    a.status = approve ? 'approved' : 'rejected'; a.decided_by = demo.userId();
    if (approve) { const L = list('financial_ledger'); L.push({ id: L.length + 1, order_id: a.order_id, mentor_id: a.mentor_id, entry_type: 'adjustment', amount_paise: a.amount_paise, note: a.reason, created_at: nowIso() }); }
    return done(true);
  }
  return ok(await sb().rpc('decide_adjustment', { p_id: id, p_approve: approve }));
}

export async function listCommissionRules() {
  if (DEMO) return demo.delay([...list('commission_rules')].sort(byNew));
  return ok(await sb().from('commission_rules').select('*').order('created_at', { ascending: false }));
}
export async function saveCommissionRule(r) {
  if (!r.reason?.trim()) fail('Give a reason for the change');
  if (DEMO) {
    if (r.replaces) { const old = list('commission_rules').find((x) => x.id === r.replaces); if (old && !old.effective_to) old.effective_to = nowIso(); }
    list('commission_rules').push({ id: demo.uid(), name: r.name || '', service_type: r.service_type || null, mentor_id: r.mentor_id || null, percentage_bps: Number(r.percentage_bps), fixed_fee_paise: Number(r.fixed_fee_paise) || 0,
      min_fee_paise: Number(r.min_fee_paise) || 0, max_fee_paise: r.max_fee_paise === '' || r.max_fee_paise == null ? null : Number(r.max_fee_paise), gateway_fee_bearer: r.gateway_fee_bearer || 'platform',
      fee_included: r.fee_included !== false, effective_from: nowIso(), effective_to: null, reason: r.reason, created_by: demo.userId(), created_at: nowIso() });
    audit('insert', 'commission_rules', '', { reason: r.reason });
    return done(true);
  }
  return ok(await sb().rpc('save_commission_rule', { r }));
}
export async function endCommissionRule(id, reason) {
  if (DEMO) { const x = list('commission_rules').find((c) => c.id === id); if (x) { x.effective_to = nowIso(); x.reason += ` · ended: ${reason}`; } return done(true); }
  return ok(await sb().rpc('end_commission_rule', { p_id: id, p_reason: reason }));
}
export async function previewCommission(pricePaise, serviceType = 'consultation', mentorId = null) {
  if (DEMO) return demo.delay(calcCommission(pricePaise, pickRule(list('commission_rules'), { serviceType, mentorId: mentorId || demo.userId() }), D().settings));
  return ok(await sb().rpc('preview_commission', { p_price_paise: pricePaise, p_type: serviceType, p_mentor: mentorId }));
}

// ---- mentor money ----
export async function myEarnings() {
  const user = await getUser(); if (!user) return null;
  if (DEMO) {
    const hold = (D().settings.payout_hold_days ?? 7) * 86400000;
    const mine = list('orders').filter((o) => o.mentor_id === user.id && !['created', 'expired'].includes(o.status));
    const net = (o) => o.mentor_net_paise - o.mentor_reversed_paise;
    const live = mine.filter((o) => ['paid', 'partially_refunded'].includes(o.status));
    const pays = list('mentor_payouts').filter((p) => p.mentor_id === user.id);
    return demo.delay({
      pending_completion: live.filter((o) => !o.completed_at).reduce((a, o) => a + net(o), 0),
      on_hold: live.filter((o) => o.payout_status === 'none' && o.completed_at && Date.now() - +new Date(o.completed_at) < hold).reduce((a, o) => a + net(o), 0),
      ready: live.filter((o) => o.payout_status === 'none' && o.completed_at && Date.now() - +new Date(o.completed_at) >= hold).reduce((a, o) => a + net(o), 0),
      in_payout: pays.filter((p) => ['prepared', 'approved'].includes(p.status)).reduce((a, p) => a + p.amount_paise, 0),
      paid_total: pays.filter((p) => p.status === 'paid').reduce((a, p) => a + p.amount_paise, 0),
      hold_days: D().settings.payout_hold_days ?? 7,
      orders: mine.map((o) => ({ ...pick(o, ['id', 'description', 'price_paise', 'status', 'payout_status', 'paid_at', 'completed_at']), mentor_net_paise: net(o) })),
      payouts: pays,
    });
  }
  return ok(await sb().rpc('my_earnings'));
}
export async function myFinance() {
  const user = await getUser(); if (!user) return null;
  if (DEMO) return demo.delay(list('mentor_finance').find((f) => f.mentor_id === user.id) || { mentor_id: user.id, payout_method: '', payout_display: '', kyc_status: 'not_started', pan_last4: '' });
  return ok(await sb().from('mentor_finance').select('*').eq('mentor_id', user.id).maybeSingle()) || { payout_method: '', payout_display: '', kyc_status: 'not_started', pan_last4: '' };
}
export async function saveMyFinance(f) {
  const user = await getUser();
  const clean = { mentor_id: user.id, payout_method: f.payout_method || '', payout_display: (f.payout_display || '').trim(), pan_last4: (f.pan_last4 || '').toUpperCase().slice(-4) };
  if (/[0-9]{7,}/.test(clean.payout_display)) fail('Do not enter full account numbers — show only the last 4 digits (e.g. “HDFC ••1234”) or your UPI id.');
  if (DEMO) { D().mentor_finance = list('mentor_finance').filter((x) => x.mentor_id !== user.id).concat({ ...clean, kyc_status: 'submitted' }); return done(true); }
  ok(await sb().from('mentor_finance').upsert(clean));
  return true;
}

// ================================================================ portfolio reviews
export async function reviewTypes(all = false) {
  if (DEMO) return demo.delay(list('portfolio_review_types').filter((t) => all || t.active).sort((a, b) => a.sort - b.sort));
  let q = sb().from('portfolio_review_types').select('*').order('sort');
  if (!all) q = q.eq('active', true);
  return ok(await q);
}
export async function listPortfolios() {
  const user = await getUser(); if (!user) return [];
  if (DEMO) {
    const staff = demo.hasPerm('portfolio.assign') || demo.hasPerm('portfolio.read');
    return demo.delay(list('portfolio_projects').filter((p) => staff || p.student_id === user.id || p.assigned_mentor_id === user.id).sort(byNew)
      .map((p) => ({ ...p, student_name: D().profiles.find((x) => x.id === p.student_id)?.full_name, mentor_name: D().profiles.find((x) => x.id === p.assigned_mentor_id)?.full_name })));
  }
  const rows = ok(await sb().from('portfolio_projects').select('*').order('created_at', { ascending: false }));
  const ids = [...new Set(rows.flatMap((r) => [r.student_id, r.assigned_mentor_id]).filter(Boolean))];
  const people = ids.length ? (await sb().from('profiles').select('id,full_name').in('id', ids)).data || [] : [];
  const mentors = ids.length ? (await sb().from('public_mentors').select('id,full_name').in('id', ids)).data || [] : [];
  const name = (id) => people.find((x) => x.id === id)?.full_name || mentors.find((x) => x.id === id)?.full_name || '';
  return rows.map((p) => ({ ...p, student_name: name(p.student_id), mentor_name: name(p.assigned_mentor_id) }));
}
export async function getPortfolio(id) {
  if (DEMO) {
    const p = (await listPortfolios()).find((x) => x.id === id); if (!p) return null;
    const uidv = demo.userId();
    return { project: p, files: list('portfolio_files').filter((f) => f.project_id === id),
      reviews: list('portfolio_reviews').filter((r) => r.project_id === id && (r.status === 'submitted' || r.mentor_id === uidv || demo.hasPerm('portfolio.read'))) };
  }
  const project = ok(await sb().from('portfolio_projects').select('*').eq('id', id).maybeSingle());
  if (!project) return null;
  const [files, reviews] = await Promise.all([
    sb().from('portfolio_files').select('*').eq('project_id', id).order('created_at'),
    sb().from('portfolio_reviews').select('*').eq('project_id', id).order('round'),
  ]);
  const names = (await listPortfolios()).find((x) => x.id === id) || {};
  return { project: { ...project, student_name: names.student_name, mentor_name: names.mentor_name }, files: ok(files), reviews: ok(reviews) };
}
export async function createPortfolio({ review_type_id, title, brief, target }) {
  const user = await getUser(); if (!user) fail('Please log in');
  if ((title || '').trim().length < 3) fail('Give your portfolio a title');
  if (DEMO) {
    const t = list('portfolio_review_types').find((x) => x.id === review_type_id && x.active); if (!t) fail('Choose a review type');
    const id = demo.uid();
    list('portfolio_projects').push({ id, student_id: user.id, review_type_id, title, brief, target, status: 'draft', price_paise: t.price_paise, revisions_used: 0, created_at: nowIso(), updated_at: nowIso() });
    return done(id);
  }
  return ok(await sb().from('portfolio_projects').insert({ review_type_id, title, brief, target, student_id: user.id }).select('id').single()).id;
}
const PF_NEXT = {
  student: { draft: ['submitted', 'cancelled'], awaiting_payment: ['cancelled'], feedback_ready: ['revision_requested', 'completed'] },
  mentor: { assigned: ['in_review'], revision_requested: ['in_review'] },
};
export async function setPortfolioStatus(id, status) {
  if (DEMO) {
    const p = list('portfolio_projects').find((x) => x.id === id); const u = demo.userId();
    const as = p.student_id === u ? 'student' : p.assigned_mentor_id === u ? 'mentor' : null;
    if (!as || !(PF_NEXT[as][p.status] || []).includes(status)) fail('This step is not allowed');
    if (status === 'submitted' && !list('portfolio_files').some((f) => f.project_id === id)) fail('Upload at least one file first');
    if (status === 'revision_requested') { if (p.revisions_used >= 1) fail('One follow-up round is included'); p.revisions_used += 1; }
    const paid = status === 'submitted' && p.price_paise > 0 && D().settings.payments_mode !== 'off';
    p.status = paid ? 'awaiting_payment' : status; p.updated_at = nowIso();
    if (status === 'submitted') p.submitted_at = nowIso();
    if (status === 'completed') { p.completed_at = nowIso(); const o = list('orders').find((x) => x.id === p.order_id); if (o) o.completed_at = nowIso(); }
    if (p.status === 'revision_requested' && p.assigned_mentor_id) demo.demoNotify(p.assigned_mentor_id, 'Follow-up requested', p.title, `/portfolio/${p.id}`);
    return done(p.status);
  }
  ok(await sb().from('portfolio_projects').update({ status }).eq('id', id));
  return (ok(await sb().from('portfolio_projects').select('status').eq('id', id).single())).status;
}
export async function updatePortfolioDraft(id, patch) {
  const clean = pick(patch, ['title', 'brief', 'target']);
  if (DEMO) { Object.assign(list('portfolio_projects').find((x) => x.id === id), clean); return done(true); }
  ok(await sb().from('portfolio_projects').update(clean).eq('id', id)); return true;
}
export async function assignPortfolio(id, mentorId) {
  if (DEMO) {
    const p = list('portfolio_projects').find((x) => x.id === id);
    if (!['submitted', 'assigned', 'in_review', 'revision_requested'].includes(p.status)) fail('Only submitted portfolios can be assigned');
    const t = list('portfolio_review_types').find((x) => x.id === p.review_type_id);
    Object.assign(p, { assigned_mentor_id: mentorId, assigned_by: demo.userId(), assigned_at: nowIso(), status: p.status === 'revision_requested' ? p.status : 'assigned', due_at: new Date(Date.now() + (t?.turnaround_days || 7) * 86400000).toISOString() });
    demo.demoNotify(mentorId, 'New portfolio to review', p.title, `/portfolio/${p.id}`);
    demo.demoMail(D().profiles.find((x) => x.id === mentorId)?.email, `New portfolio to review: ${p.title}`, 'portfolio-assigned');
    audit('portfolio.assign', 'portfolio_projects', id, { mentor: mentorId });
    return done(true);
  }
  ok(await sb().from('portfolio_projects').update({ assigned_mentor_id: mentorId }).eq('id', id)); return true;
}
const MAX_PF_BYTES = 25 * 1024 * 1024;
export async function uploadPortfolioFile(project, file) {
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) fail('Upload PDF, JPG, PNG or WebP files');
  if (file.size > MAX_PF_BYTES) fail('Each file can be up to 25 MB. Compress the PDF and try again.');
  const safe = file.name.replace(/[^\w.-]+/g, '-').slice(-80);
  const path = `${project.student_id}/${project.id}/${Date.now()}-${safe}`;
  if (DEMO) {
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
    list('portfolio_files').push({ id: demo.uid(), project_id: project.id, path, name: file.name, size_bytes: file.size, mime: file.type, kind: project.student_id === demo.userId() ? 'submission' : 'feedback', uploaded_by: demo.userId(), created_at: nowIso(), _demo_url: file.size < 1_500_000 ? url : null });
    return done(true);
  }
  const { error } = await sb().storage.from('portfolios').upload(path, file, { contentType: file.type, upsert: false });
  if (error) fail(error.message);
  const { error: e2 } = await sb().from('portfolio_files').insert({ project_id: project.id, path, name: file.name, size_bytes: file.size, mime: file.type });
  if (e2) { await sb().storage.from('portfolios').remove([path]); fail(e2.message); }
  return true;
}
// Private files open through a link that expires after 2 minutes
export async function portfolioFileUrl(f) {
  if (DEMO) { if (!f._demo_url) fail('Demo mode keeps only small files. In the real site every file opens here.'); return f._demo_url; }
  const { data, error } = await sb().storage.from('portfolios').createSignedUrl(f.path, 120);
  if (error) fail(error.message);
  logEvent('file.opened', { path: f.path });
  return data.signedUrl;
}
export async function deletePortfolioFile(f) {
  if (DEMO) { D().portfolio_files = list('portfolio_files').filter((x) => x.id !== f.id); return done(true); }
  await sb().storage.from('portfolios').remove([f.path]);
  ok(await sb().from('portfolio_files').delete().eq('id', f.id)); return true;
}
export const RUBRIC = ['Storytelling & structure', 'Design thinking', 'Drawings & representation', 'Technical resolution', 'Layout & graphics', 'Fit for the goal'];
export async function saveReview(project, review, submit) {
  const row = { project_id: project.id, round: 1 + (project.revisions_used || 0), rubric: review.rubric || {}, summary: review.summary || '', strengths: review.strengths || '', improvements: review.improvements || '', status: submit ? 'submitted' : 'draft' };
  if (submit && (!row.summary.trim() || Object.keys(row.rubric).length < RUBRIC.length)) fail('Score every rubric line and write a summary before sending');
  if (DEMO) {
    const u = demo.userId(); const p = list('portfolio_projects').find((x) => x.id === project.id);
    if (p.assigned_mentor_id !== u) fail('Only the assigned mentor can write this review');
    const ex = list('portfolio_reviews').find((r) => r.project_id === project.id && r.round === row.round);
    if (ex?.status === 'submitted') fail('This review was already sent');
    if (ex) Object.assign(ex, row); else list('portfolio_reviews').push({ ...row, id: demo.uid(), mentor_id: u, created_at: nowIso() });
    if (submit) { p.status = 'feedback_ready'; demo.demoNotify(p.student_id, 'Feedback is ready', p.title, `/portfolio/${p.id}`); demo.demoMail(D().profiles.find((x) => x.id === p.student_id)?.email, 'Your portfolio feedback is ready', 'portfolio-feedback'); }
    return done(true);
  }
  const user = await getUser();
  const existing = ok(await sb().from('portfolio_reviews').select('id').eq('project_id', project.id).eq('round', row.round).maybeSingle());
  if (existing) ok(await sb().from('portfolio_reviews').update(row).eq('id', existing.id));
  else ok(await sb().from('portfolio_reviews').insert({ ...row, mentor_id: user.id }));
  return true;
}

// ================================================================ opportunities, resources, saved
export async function listOpportunities() {
  if (DEMO) return demo.delay(list('opportunities').filter((o) => o.published).sort((a, b) => String(a.deadline || '9').localeCompare(String(b.deadline || '9'))));
  return ok(await sb().from('opportunities').select('*').eq('published', true).order('deadline', { ascending: true, nullsFirst: false }));
}
export async function listResources() {
  if (DEMO) return demo.delay(list('resources').filter((o) => o.published).sort((a, b) => a.sort - b.sort));
  return ok(await sb().from('resources').select('*').eq('published', true).order('sort'));
}
export async function mySaved() {
  const user = await getUser(); if (!user) return [];
  if (DEMO) return demo.delay(list('saved_items').filter((s) => s.user_id === user.id));
  return ok(await sb().from('saved_items').select('*').eq('user_id', user.id));
}
export async function toggleSaved(kind, itemId, on) {
  const user = await getUser(); if (!user) fail('Log in to save items');
  if (DEMO) { D().saved_items = list('saved_items').filter((s) => !(s.user_id === user.id && s.kind === kind && s.item_id === itemId)); if (on) list('saved_items').push({ user_id: user.id, kind, item_id: itemId, created_at: nowIso() }); return done(true); }
  if (on) ok(await sb().from('saved_items').upsert({ user_id: user.id, kind, item_id: itemId }));
  else ok(await sb().from('saved_items').delete().match({ user_id: user.id, kind, item_id: itemId }));
  return true;
}

// ================================================================ calls & support
export async function requestCall(form) {
  const row = pick(form, ['name', 'email', 'phone', 'topic', 'preferred_time', 'message']);
  if (!/^[+\d][\d\s-]{5,18}$/.test(row.phone || '')) fail('Enter a phone number we can call');
  if (DEMO) {
    list('call_requests').push({ ...row, id: demo.uid(), user_id: demo.userId(), status: 'new', created_at: nowIso() });
    demo.demoMail(row.email, 'We will call you back', 'call-ack'); demo.demoMail(D().settings.admin_email || 'admin', `Call-back request from ${row.name}`, 'call-request');
    return done(true);
  }
  ok(await sb().from('call_requests').insert(row)); return true;
}
export async function listCallNotes(callId) {
  if (DEMO) return demo.delay(list('call_notes').filter((n) => n.call_id === callId));
  return ok(await sb().from('call_notes').select('*').eq('call_id', callId).order('created_at'));
}
export async function addCallNote(callId, body) {
  if (DEMO) { list('call_notes').push({ id: demo.uid(), call_id: callId, author_id: demo.userId(), body, created_at: nowIso() }); return done(true); }
  const user = await getUser();
  ok(await sb().from('call_notes').insert({ call_id: callId, body, author_id: user.id })); return true;
}

export const TICKET_CATEGORIES = ['General', 'Booking', 'Payment', 'Refund', 'Account', 'Portfolio', 'Mentor', 'Technical'];
export async function createTicket({ subject, category, body }) {
  const user = await getUser(); if (!user) fail('Please log in');
  if ((body || '').trim().length < 5) fail('Tell us a little more');
  if (DEMO) {
    const p = demo.me(); const id = demo.uid();
    list('support_tickets').push({ id, user_id: p.id, email: p.email, name: p.full_name, subject, category, status: 'open', priority: 'normal', created_at: nowIso(), updated_at: nowIso() });
    list('ticket_messages').push({ id: demo.uid(), ticket_id: id, author_id: p.id, author_name: p.full_name, from_staff: false, internal: false, body, created_at: nowIso() });
    demo.demoMail(p.email, `We got your message: ${subject}`, 'ticket-ack');
    return done(id);
  }
  const t = ok(await sb().from('support_tickets').insert({ subject, category, email: user.email }).select('id').single());
  ok(await sb().from('ticket_messages').insert({ ticket_id: t.id, body }));
  return t.id;
}
export async function listTickets() {
  const user = await getUser(); if (!user) return [];
  if (DEMO) return demo.delay(list('support_tickets').filter((t) => t.user_id === user.id || demo.hasPerm('support.manage')).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))));
  return ok(await sb().from('support_tickets').select('*').order('updated_at', { ascending: false }));
}
export async function getTicket(id) {
  if (DEMO) {
    const t = (await listTickets()).find((x) => x.id === id); if (!t) return null;
    const staff = demo.hasPerm('support.manage');
    return { ticket: t, messages: list('ticket_messages').filter((m) => m.ticket_id === id && (staff || !m.internal)) };
  }
  const t = ok(await sb().from('support_tickets').select('*').eq('id', id).maybeSingle()); if (!t) return null;
  return { ticket: t, messages: ok(await sb().from('ticket_messages').select('*').eq('ticket_id', id).order('created_at')) };
}
export async function replyTicket(id, body, internal = false) {
  if (!body.trim()) fail('Write a message');
  if (DEMO) {
    const t = list('support_tickets').find((x) => x.id === id); const p = demo.me(); const staff = demo.hasPerm('support.manage') && t.user_id !== p.id;
    list('ticket_messages').push({ id: demo.uid(), ticket_id: id, author_id: p.id, author_name: p.full_name, from_staff: staff, internal: staff && internal, body, created_at: nowIso() });
    if (staff && !internal) { t.status = t.status === 'open' ? 'waiting' : t.status; demo.demoMail(t.email, `Re: ${t.subject}`, 'ticket-reply'); demo.demoNotify(t.user_id, 'Reply from support', t.subject, `/support/${t.id}`); }
    if (!staff) t.status = 'open';
    t.updated_at = nowIso();
    return done(true);
  }
  ok(await sb().from('ticket_messages').insert({ ticket_id: id, body, internal })); return true;
}
export async function updateTicket(id, patch) {
  const clean = pick(patch, ['status', 'priority', 'assigned_to', 'category']);
  if (DEMO) { Object.assign(list('support_tickets').find((x) => x.id === id), clean, { updated_at: nowIso() }); return done(true); }
  ok(await sb().from('support_tickets').update(clean).eq('id', id)); return true;
}

// ================================================================ campaigns, moderation, analytics, audit
export async function sendCampaign(id) {
  if (DEMO) {
    const c = list('email_campaigns').find((x) => x.id === id); if (!['approved', 'sending'].includes(c.status)) fail('Approve the campaign first');
    const people = D().profiles.filter((p) => !p.email_opt_out && ((c.audience === 'students' && p.role === 'student') || (c.audience === 'mentors' && p.role === 'mentor' && p.approved) || (c.audience === 'everyone' && ['student', 'mentor', 'professional'].includes(p.role))));
    const emails = [...new Set([...(['subscribers', 'everyone'].includes(c.audience) ? D().subscribers.map((s) => s.email) : []), ...people.map((p) => p.email)])];
    emails.forEach((e) => demo.demoMail(e, c.subject, 'campaign'));
    Object.assign(c, { status: 'sent', sent_count: emails.length, total: emails.length, sent_at: nowIso() });
    return done({ sent_now: emails.length, remaining: 0 });
  }
  return ok(await sb().rpc('send_campaign', { p_id: id }));
}
export async function setCampaignStatus(id, status) {
  if (DEMO) {
    const c = list('email_campaigns').find((x) => x.id === id);
    if (status === 'approved' && c.created_by === demo.userId() && demo.me()?.role !== 'admin') fail('Someone else must approve a campaign you wrote');
    c.status = status; c.approved_by = status === 'approved' ? demo.userId() : null; return done(true);
  }
  ok(await sb().from('email_campaigns').update({ status }).eq('id', id)); return true;
}
export async function reportItem(kind, itemId, reason) {
  const user = await getUser(); if (!user) fail('Log in to report');
  if (DEMO) { if (list('forum_reports').some((r) => r.item_id === itemId && r.reporter_id === user.id)) fail('You already reported this'); list('forum_reports').push({ id: demo.uid(), item_kind: kind, item_id: itemId, reporter_id: user.id, reason, status: 'open', created_at: nowIso() }); return done(true); }
  const { error } = await sb().from('forum_reports').insert({ item_kind: kind, item_id: itemId, reason });
  if (error?.code === '23505') fail('You already reported this');
  if (error) fail(error.message);
  return true;
}
export async function moderateReport(id, remove) {
  if (DEMO) {
    const r = list('forum_reports').find((x) => x.id === id);
    if (remove) { const t = r.item_kind === 'question' ? D().forum_questions : D().forum_answers; const it = t.find((x) => x.id === r.item_id); if (it) it.hidden = true; }
    list('forum_reports').filter((x) => x.item_id === r.item_id && x.status === 'open').forEach((x) => { x.status = remove ? 'removed' : 'dismissed'; });
    return done(true);
  }
  return ok(await sb().rpc('moderate_report', { p_id: id, p_remove: remove }));
}
export async function analyticsSummary(days = 30) {
  if (DEMO) {
    const d = D(); const since = Date.now() - days * 86400000; const after = (x) => +new Date(x.created_at) > since;
    const count = (arr, f = () => true) => arr.filter(f).length;
    const users = {}; d.profiles.forEach((p) => { users[p.role] = (users[p.role] || 0) + 1; });
    const bookings = {}; d.requests.filter(after).forEach((r) => { bookings[r.status] = (bookings[r.status] || 0) + 1; });
    const weeks = {}; d.profiles.forEach((p) => { const w = new Date(p.created_at); w.setUTCDate(w.getUTCDate() - ((w.getUTCDay() + 6) % 7)); const k = w.toISOString().slice(0, 10); weeks[k] = (weeks[k] || 0) + 1; });
    const top = {}; d.requests.filter(after).forEach((r) => { top[r.mentor_name] = (top[r.mentor_name] || 0) + 1; });
    return demo.delay({ users, new_users: count(d.profiles, after), mentors_live: count(d.profiles, (p) => p.role === 'mentor' && p.approved), mentors_waiting: count(d.profiles, (p) => p.role === 'mentor' && !p.approved),
      bookings, registrations: count(d.registrations, after), questions: count(d.forum_questions, after), answers: count(d.forum_answers, after), subscribers: d.subscribers.length,
      portfolios: count(list('portfolio_projects'), after), tickets_open: count(list('support_tickets'), (t) => ['open', 'waiting'].includes(t.status)), emails_sent: count(d.email_log || [], after),
      revenue_paise: list('financial_ledger').filter((e) => e.entry_type === 'payment_received' && after(e)).reduce((a, e) => a + e.amount_paise, 0),
      signups_by_week: Object.entries(weeks).sort().slice(-12).map(([week, n]) => ({ week, n })),
      top_mentors: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, n })) });
  }
  return ok(await sb().rpc('analytics_summary', { p_days: days }));
}
export async function listAudit() {
  if (DEMO) return demo.delay(list('audit_logs').slice(0, 300));
  return ok(await sb().from('audit_logs').select('*').order('id', { ascending: false }).limit(300));
}

// Generic staff list/save/delete for simple tables (permissions are enforced by the database)
const STAFF_TABLES = ['opportunities', 'resources', 'portfolio_review_types', 'call_requests', 'support_tickets', 'email_campaigns', 'forum_reports', 'orders'];
export async function staffList(table) {
  if (!STAFF_TABLES.includes(table)) fail('Unknown table');
  if (DEMO) return demo.delay([...list(table)].sort(byNew));
  return ok(await sb().from(table).select('*').order('created_at', { ascending: false }).limit(500));
}
export async function staffSave(table, row) {
  if (!STAFF_TABLES.includes(table)) fail('Unknown table');
  const { id, created_at, ...rest } = row;
  if (DEMO) {
    if (id) Object.assign(list(table).find((x) => x.id === id), rest);
    else list(table).push({ ...rest, id: demo.uid(), created_at: nowIso(), ...(table === 'email_campaigns' ? { status: 'draft', created_by: demo.userId(), sent_count: 0 } : {}) });
    return done(true);
  }
  if (id) ok(await sb().from(table).update(rest).eq('id', id));
  else ok(await sb().from(table).insert(rest));
  return true;
}
export async function staffDelete(table, id) {
  if (!STAFF_TABLES.includes(table)) fail('Unknown table');
  if (DEMO) { D()[table] = list(table).filter((x) => x.id !== id); return done(true); }
  ok(await sb().from(table).delete().eq('id', id)); return true;
}

// Upload a downloadable resource file (PDF/template) to the public "resources" bucket
export async function uploadResourceFile(file) {
  if (file.size > 25 * 1024 * 1024) fail('Files can be up to 25 MB');
  if (DEMO) return demo.delay('#demo-file-' + encodeURIComponent(file.name));
  const path = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, '-')}`;
  const { error } = await sb().storage.from('resources').upload(path, file, { contentType: file.type });
  if (error) fail(error.message);
  return sb().storage.from('resources').getPublicUrl(path).data.publicUrl;
}
