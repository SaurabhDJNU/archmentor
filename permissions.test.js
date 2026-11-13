import { describe, expect, it } from 'vitest';
import { effectivePermissions, MAIN_ADMIN_ONLY, PERMISSIONS, ROLES } from './permissions.js';

describe('effectivePermissions (mirrors public.has_perm)', () => {
  it('main admin has everything', () => {
    expect(effectivePermissions({ isAdmin: true }).size).toBe(PERMISSIONS.length);
  });
  it('new staff start with nothing', () => {
    expect(effectivePermissions({ isAdmin: false, roles: [] }).size).toBe(0);
  });
  it('suspended staff lose everything', () => {
    expect(effectivePermissions({ isAdmin: false, active: false, roles: ['support'] }).size).toBe(0);
  });
  it('roles grant only their permissions', () => {
    const p = effectivePermissions({ roles: ['support'] });
    expect([...p.keys()].sort()).toEqual([...ROLES.support.perms].sort());
  });
  it('sensitive permissions need two-step sign-in', () => {
    expect(effectivePermissions({ roles: ['finance_operator'] }).get('finance.read')).toBe(false);
    expect(effectivePermissions({ roles: ['finance_operator'], aal2: true }).get('finance.read')).toBe(true);
    expect(effectivePermissions({ roles: ['finance_operator'] }).get('bookings.read')).toBe(true);
  });
  it('deny beats grant; main-admin-only keys can never be granted', () => {
    const p = effectivePermissions({ roles: ['support'], overrides: [{ permission: 'support.manage', allow: false }, ...MAIN_ADMIN_ONLY.map((k) => ({ permission: k, allow: true }))], aal2: true });
    expect(p.has('support.manage')).toBe(false);
    MAIN_ADMIN_ONLY.forEach((k) => expect(p.has(k)).toBe(false));
  });
  it('every role permission exists', () => {
    const keys = new Set(PERMISSIONS.map((p) => p.key));
    Object.values(ROLES).forEach((r) => r.perms.forEach((k) => expect(keys.has(k)).toBe(true)));
  });
});
