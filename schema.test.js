// Static checks on schema.sql: the browser-facing rules that must never regress.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PERMISSIONS, ROLES } from './permissions.js';

const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

describe('schema.sql', () => {
  it('has no destructive statements', () => {
    expect(sql).not.toMatch(/\bdrop\s+table\b/i);
    expect(sql).not.toMatch(/\bdrop\s+column\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/rename\s+column/i);
  });
  it('keeps the ledger and audit log append-only', () => {
    expect(sql).toMatch(/create trigger ledger_append_only before update or delete on public\.financial_ledger/);
    expect(sql).toMatch(/create trigger audit_logs_append_only before update or delete on public\.audit_logs/);
  });
  it('server-only payment functions are not callable from the website', () => {
    for (const f of ['svc_attach_provider_order', 'svc_record_payment', 'svc_refund_update']) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon, authenticated`));
    }
  });
  it('permission keys and roles match the frontend', () => {
    for (const p of PERMISSIONS) expect(sql).toContain(`('${p.key}',`);
    for (const r of Object.keys(ROLES)) expect(sql).toContain(`('${r}',`);
  });
  it('money columns are integer paise', () => {
    expect(sql).not.toMatch(/_paise\s+(numeric|real|double|float)/i);
  });
  it('the public mentor view does not expose private fields', () => {
    const view = sql.match(/create view public\.public_mentors as([\s\S]*?);/)[1];
    for (const f of ['email', 'phone', 'calendly_url']) expect(view).not.toMatch(new RegExp(`\\b${f}\\b`));
  });
});
