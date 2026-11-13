# Implementation report — ArchMentor blueprint

Date: 13 Nov 2026. Everything below is in this repository; the timeline in the blueprint was not followed (built in one pass).

## What was built

| Blueprint area | Where | Status |
| --- | --- | --- |
| Security baseline: no secrets in the browser, fail closed without Supabase, private fields off the public directory | `api.js` (`MISCONFIGURED`), `Layout.jsx` (`NotConfigured`), `schema.sql` §14 (`public_mentors` view), §28 RLS | Done |
| RBAC: 26 permission keys, 9 roles, per-person grant/block overrides with reason, main-admin-only keys, no self-escalation, suspension signs out | `schema.sql` §15–17, `permissions.js`, `Staff.jsx` → Staff | Done |
| Staff workspace `/staff/login`, `/staff/:section`, menu filtered by permission | `Staff.jsx` | Done |
| Two-step sign-in (TOTP, Supabase MFA); sensitive permissions require aal2 | `schema.sql` `private.mfa_ok`, `Staff.jsx` `MfaPanel` | Done |
| Audit log, append-only, row-level triggers on sensitive tables, client events (sign-in, exports, file opens) | `schema.sql` §16, §28; Workspace → Audit (CSV) | Done |
| In-app notifications + bell | `schema.sql` `notifications`, `Notifications.jsx` | Done |
| Mentor availability, time off, slot picking, no double booking (unique index + server slot check), rescheduling within policy, unpaid hold expiry | §18–19, `slots.js`, `MentorTools.jsx`, `Book.jsx` | Done |
| Calendly link private, copied onto the booking on approval | §19 `guard_request` | Done |
| Payments (Razorpay): server-priced orders, checkout, HMAC verification, webhook with idempotent event ids, amount/currency check, mismatch → review | §20, `edge-*.ts`, `platform.payFor`, `Checkout.jsx` | Done — **test mode**; live after KYC + legal review |
| Commission rules (bps + paise, min/max/fixed, fee inside/on top, gateway bearer, effective dates, versioned, snapshot per order) + preview calculator | §20 `calc_commission`, `money.js`, Workspace → Commission, mentor service form | Done |
| Append-only financial ledger, refunds (request → decide by another person → gateway or recorded manual refund → automatic reversals), adjustments (two people) | §20, `StaffFinance.jsx` | Done |
| Payouts: hold period after completion, prepare → approve by someone else → mark paid with UTR, threshold needs main admin, ledger balance cap | §20, Workspace → Payouts, mentor Earnings | Done — **manual transfers**; Razorpay Route deliberately off |
| Portfolio review studio: private bucket, short-lived signed URLs, coordinator assignment only, rubric, one follow-up round, status machine, paid or free review types | §21, `Portfolio.jsx` | Done |
| Paid live sessions (seat held until paid), capacity counts only active seats | §19 registrations | Done |
| Opportunities, resources (+ public file bucket), saved items | §22, `Explore.jsx` | Done |
| Call-back requests with notes, support tickets with internal notes and email replies | §23, `Support.jsx`, Workspace → Calls / Support | Done |
| Email campaigns: draft → approved by another person → sent in daily batches within the Brevo cap, unsubscribe for subscribers and members | §24, Workspace → Email campaigns | Done |
| Community moderation: reports, hide, rate limits | §25, `Community.jsx`, Workspace → Community | Done |
| Scheduled Journal publishing, live-session completion for payouts | §26 + cron | Done |
| Analytics (counts only) | §27, Workspace → Analytics | Done |
| Legal pages (privacy, terms, cancellation/refund) | `Legal.jsx` | **Drafts** — need a lawyer before live payments |
| PWA: manifest, service worker (never caches API/payments/private files), offline page, install prompt + iPhone steps, original icons | root PWA files, `InstallApp.jsx`, `vite.config.js` | Done |
| Design: monochrome palette #111111 / #FFFFFF / #F5F4F0 / #555555 / #D9D9D5, original line-art drawings, route fade 240 ms, skeletons, `prefers-reduced-motion` respected | `styles.css`, `ArchArt.jsx` | Done |
| Security headers | `_headers` (Cloudflare Pages) | Done |
| Tests + CI | `*.test.js` (28 unit tests), `.github/workflows/ci.yml` (lint → test → build) | Done |

## How it was verified
- `schema.sql` loaded twice into PostgreSQL 16 with Supabase stand-ins (auth, storage, vault, pg_net, pg_cron) — re-runnable without errors.
- SQL scenario tests as real roles: staff invite/accept, MFA gating, self-escalation blocked, anonymous users cannot read profiles, slot validation, students cannot set prices or statuses, payment idempotency (same event → `duplicate`), ledger update blocked, two-person payout, refund reversals, portfolio access limited to student / assigned mentor / coordinator, support internal notes.
- Browser run (demo mode, Chrome): booking a paid slot and paying, mentor marks done, earnings, portfolio upload → assign → review → feedback, support ticket and staff reply, finance login with two-step code, prepare payout → approve → paid, commission preview, audit log, staff invite, notifications, mobile layouts without horizontal scroll, no console errors.
- `npm run lint`, `npm test`, `npm run build` all pass.

## Not verified here (needs the real accounts)
- The live Supabase project, Brevo delivery and Razorpay test payments end-to-end: first real checks are the admin test email (README step 7) and a test payment (README step 8).
- Edge Functions were written against Supabase's Deno runtime and Razorpay's documented API but not executed in this environment.

## Intentionally left off (needs outside approval)
- Live payments and automatic payouts (Razorpay KYC, marketplace approval, legal review).
- Storing bank account numbers (only a masked label and PAN last-4 are kept).
