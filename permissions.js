// Mirrors the permissions and roles seeded in schema.sql (section 15). The database decides; this file only
// shapes the staff workspace menu and the demo.
export const PERMISSIONS = [
  ['users.read', 'See user accounts', 'People', false],
  ['mentors.approve', 'Approve or hide mentors', 'People', false],
  ['bookings.read', 'See bookings', 'Bookings', false],
  ['bookings.manage', 'Change, cancel or reschedule bookings', 'Bookings', false],
  ['events.manage', 'Create and run live sessions', 'Bookings', false],
  ['calls.manage', 'Handle call-back requests', 'Support', false],
  ['support.manage', 'Answer support tickets', 'Support', false],
  ['community.moderate', 'Moderate community posts and reports', 'Content', false],
  ['blog.write', 'Write and edit Journal drafts', 'Content', false],
  ['blog.publish', 'Publish and schedule Journal posts', 'Content', false],
  ['content.manage', 'Videos, resources and opportunities', 'Content', false],
  ['email.send', 'See email log and send test emails', 'Email', false],
  ['email.campaigns', 'Draft and send email campaigns', 'Email', false],
  ['portfolio.read', 'Open portfolio files and reviews', 'Portfolio', false],
  ['portfolio.assign', 'Assign portfolio reviews to mentors', 'Portfolio', false],
  ['finance.read', 'See orders, payments and ledger', 'Finance', true],
  ['finance.refund', 'Approve refunds', 'Finance', true],
  ['finance.payout.prepare', 'Prepare mentor payouts', 'Finance', true],
  ['finance.payout.approve', 'Approve and mark payouts paid', 'Finance', true],
  ['finance.adjust', 'Request and approve ledger adjustments', 'Finance', true],
  ['commission.manage', 'Change commission rules', 'Finance', true],
  ['analytics.read', 'See analytics', 'Insights', false],
  ['audit.read', 'See the audit log', 'Insights', true],
  ['settings.manage', 'Change site settings', 'Admin', true],
  ['staff.invite', 'Invite and suspend staff', 'Admin', true],
  ['staff.permissions.manage', 'Change staff roles and permissions', 'Admin', true],
].map(([key, label, area, sensitive]) => ({ key, label, area, sensitive }));

export const MAIN_ADMIN_ONLY = ['staff.invite', 'staff.permissions.manage', 'settings.manage'];

export const ROLES = {
  call_manager: { label: 'Call manager', perms: ['calls.manage', 'users.read'] },
  support: { label: 'Support', perms: ['support.manage', 'users.read', 'bookings.read', 'calls.manage'] },
  email_operator: { label: 'Email operator', perms: ['email.send', 'email.campaigns'] },
  blog_editor: { label: 'Journal editor', perms: ['blog.write', 'blog.publish'] },
  content_manager: { label: 'Content manager', perms: ['content.manage', 'community.moderate', 'blog.write'] },
  booking_coordinator: { label: 'Booking coordinator', perms: ['bookings.read', 'bookings.manage', 'events.manage', 'users.read'] },
  finance_operator: { label: 'Finance operator', perms: ['finance.read', 'finance.refund', 'finance.payout.prepare', 'bookings.read'] },
  portfolio_coordinator: { label: 'Portfolio coordinator', perms: ['portfolio.read', 'portfolio.assign', 'users.read'] },
  analyst: { label: 'Analyst', perms: ['analytics.read'] },
};

// Same rule as public.has_perm: admin → everything; staff → roles + allow overrides − deny overrides,
// never the main-admin-only keys; sensitive keys need two-step sign-in (aal2).
export function effectivePermissions({ isAdmin, active = true, roles = [], overrides = [], aal2 = false }) {
  const sensitive = new Set(PERMISSIONS.filter((p) => p.sensitive).map((p) => p.key));
  const out = new Map();
  if (isAdmin) { PERMISSIONS.forEach((p) => out.set(p.key, true)); return out; }
  if (!active) return out;
  const granted = new Set(roles.flatMap((r) => ROLES[r]?.perms || []));
  overrides.filter((o) => o.allow).forEach((o) => granted.add(o.permission));
  overrides.filter((o) => !o.allow).forEach((o) => granted.delete(o.permission));
  MAIN_ADMIN_ONLY.forEach((k) => granted.delete(k));
  granted.forEach((k) => out.set(k, !sensitive.has(k) || aal2));   // value false = needs two-step sign-in first
  return out;
}

// Staff workspace sections and what they need
export const STAFF_SECTIONS = [
  { id: 'overview', label: 'Overview', any: [] },
  { id: 'people', label: 'People', any: ['users.read', 'mentors.approve'] },
  { id: 'bookings', label: 'Bookings', any: ['bookings.read'] },
  { id: 'sessions', label: 'Live sessions', any: ['events.manage'] },
  { id: 'calls', label: 'Calls', any: ['calls.manage'] },
  { id: 'support', label: 'Support', any: ['support.manage'] },
  { id: 'portfolio', label: 'Portfolio reviews', any: ['portfolio.assign', 'portfolio.read'] },
  { id: 'journal', label: 'Journal', any: ['blog.write', 'blog.publish'] },
  { id: 'content', label: 'Videos & resources', any: ['content.manage'] },
  { id: 'community', label: 'Community', any: ['community.moderate'] },
  { id: 'campaigns', label: 'Email campaigns', any: ['email.campaigns'] },
  { id: 'emails', label: 'Email log', any: ['email.send'] },
  { id: 'finance', label: 'Finance', any: ['finance.read', 'finance.refund'] },
  { id: 'payouts', label: 'Payouts', any: ['finance.payout.prepare', 'finance.payout.approve'] },
  { id: 'commission', label: 'Commission', any: ['commission.manage'] },
  { id: 'analytics', label: 'Analytics', any: ['analytics.read'] },
  { id: 'audit', label: 'Audit log', any: ['audit.read'] },
  { id: 'staff', label: 'Staff', any: ['staff.invite', 'staff.permissions.manage'] },
  { id: 'settings', label: 'Settings', any: ['settings.manage'] },
];
