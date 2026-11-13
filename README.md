# ArchMentor

Architecture mentorship platform: verified mentors with bookable services and weekly availability, slot booking with online payment (Razorpay, sandbox first), a private portfolio review studio, live sessions (free or paid), a community Q&A forum with moderation, a Journal with a full writing editor, videos, opportunities and resources, support tickets and call-backs, a staff workspace with roles and permissions, finance (commission rules, append-only ledger, refunds, two-person payouts), an audit log, in-app notifications and email for every step. Installable as an app (PWA).

**Stack (free except the domain):** React (Vite) · Supabase (database, logins, image storage, email triggers) · Brevo (sends the emails, 300 a day free) · Cloudflare Pages (hosting) · GoDaddy (domain) · the client's Gmail (admin inbox).

---

## What the website does

| Who | What they can do |
| --- | --- |
| Visitors | Browse mentors (search, expertise filter, sort by price or name), view profiles and services, see live sessions and seats left, read the community and Journal, watch videos, subscribe by email |
| Students | Sign up, book a mentor's service, get approval by email, pick a time on the mentor's Calendly, cancel, reserve seats in live sessions, ask and answer community questions, vote answers helpful |
| Mentors | Apply, complete their profile (photo, expertise, experience, firm, Calendly, portfolio), add services (title, category, duration, price or free), approve or decline requests with a note, write Journal stories for review, take part in the community |
| Professionals | Join the community and live sessions without being a mentor |
| Students (new) | Pick a free slot and pay online, move a booking, request refunds, submit a portfolio (private files) and get a scored review with one follow-up, save opportunities and resources, open support tickets, request a call-back, in-app notifications |
| Mentors (new) | Weekly hours and time off (no double booking), see what they receive after commission, assigned portfolio reviews with a rubric, earnings and payout status, payout details (no full account numbers stored) |
| Staff | Sign in at `/staff/login`. Start with **no access**; the main admin gives roles (call manager, support, email operator, Journal editor, content manager, booking coordinator, finance operator, portfolio coordinator, analyst) and individual grant/block overrides with a reason. Finance, audit and admin tools need two-step sign-in (authenticator app). Suspension signs them out everywhere. |
| Main admin | Everything above plus staff invitations and permissions, settings, commission rules, approving payouts above the limit. Every sensitive change lands in the append-only audit log. |

### Emails the website sends

| Event | Who gets it |
| --- | --- |
| Sign-up confirmation, password reset | The person (sent by Supabase through Brevo) |
| Welcome after confirming | New student, professional or mentor |
| New mentor application | Mentor (received) and admin (please review) |
| Mentor verified | Mentor |
| New booking request | Mentor (with the student's message) and student (copy) |
| Booking approved | Student, with the Calendly link and the mentor's note |
| Booking declined / cancelled / done | Student / mentor / student |
| Seat reserved | Registrant, with the joining link |
| Reminder within 24 hours of a session | Every registrant (checked every hour) |
| New live session published | All subscribers (once) |
| New answer to your question | The person who asked |
| Story sent for review / published | Admin / the mentor who wrote it |
| New Journal story | Subscribers who chose "every story" |
| Weekly digest (Sundays, 9:00 IST) | Subscribers who chose "weekly" |
| Story idea submitted | The writer (copy) and admin |
| Subscribed | The subscriber, with an unsubscribe link |
| Test email | Admin (button in Admin → Emails) |
| Slot held / pay to confirm, payment confirmed, booking rescheduled, unpaid hold released | Student (and mentor where relevant) |
| Refund processed, payout sent | Student / mentor |
| Portfolio received, mentor assigned, feedback ready | Student; the assigned mentor gets the assignment |
| Support ticket received / reply, call-back requested / scheduled | User; staff with the permission get an in-app alert, admin an email |
| Staff invitation | The invited person |
| Email campaigns (approved by a second person) | Chosen audience, with unsubscribe link; sent in daily batches within the Brevo limit |

Every newsletter-type email has a one-click unsubscribe link. Admin → Emails shows each email and whether Brevo accepted it.

---

## Try it first (demo mode)

`npm run dev` without Supabase keys runs demo mode with sample data saved only in your browser (no real emails or payments). Log in with password `demo1234` as `student@`, `mentor@`, `professional@`, `staff@`, `finance@` (two-step code `123456`) or `admin@demo.archmentor`.

A **production build without Supabase keys shows a "not connected" page** (fails closed). For a public demo preview set `VITE_DEMO_MODE=true` in the hosting settings.

```bash
npm install
npm run dev
```

---

## Going live: step by step (about 1–2 hours, once)

Do the steps in this order. Write down each key or password as you go.

### 1. Gmail (2 min)
Create the client's Gmail, e.g. `archmentor.team@gmail.com`. It receives admin alerts and replies from users, and is used to sign up for the other services.

### 2. Domain on GoDaddy, DNS on Cloudflare (15 min + waiting)
1. Buy the domain on GoDaddy, e.g. `archmentor.in`.
2. Create a free account at **cloudflare.com** with the Gmail. Click **Add a domain**, type your domain, choose the **Free** plan.
3. Cloudflare shows two **nameservers** (like `xxx.ns.cloudflare.com`). In GoDaddy: **My Products → your domain → DNS → Nameservers → Change → "I'll use my own nameservers"**, paste both, save.
4. Wait until Cloudflare emails you that the domain is active (minutes to a few hours). From now on, all DNS records are added in **Cloudflare → your domain → DNS**, not in GoDaddy.

### 3. Supabase: database and logins (20 min)
1. Sign up at **supabase.com** with the Gmail. **New project**: name `archmentor`, a strong database password (save it), region **Mumbai** (or closest), Free plan.
2. **SQL Editor → New query**: paste all of `schema.sql`, click **Run**. It should finish with "Success". Optionally run `seed.sql` for a starter session and two Journal stories.
3. **Project Settings → API Keys**: copy the **Project URL** and the **Publishable key** (or the legacy **anon** key). Never use the secret / service_role key in the website.

### 4. Cloudflare Pages: put the website online (10 min)
1. In Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, pick the GitHub repository.
2. Build settings: **Framework preset:** Vite · **Build command:** `npm run build` · **Build output directory:** `dist`.
3. **Environment variables** (Production): `VITE_SUPABASE_URL` = Project URL, `VITE_SUPABASE_ANON_KEY` = Publishable key. Also add `NODE_VERSION` = `20`.
4. **Save and Deploy.** You get an address like `archmentor.pages.dev`.
5. In the Pages project: **Custom domains → Set up a domain**, enter `archmentor.in`, then add `www.archmentor.in` too. Cloudflare creates the DNS records.
6. If you used GitHub Pages before: in GitHub **Settings → Pages**, set Source to **None**, and delete `.github/workflows/deploy.yml`.

### 5. Brevo: the email sender (20 min + waiting)
1. Sign up at **brevo.com** with the Gmail (free plan). Fill in the company profile if asked; Brevo may review a new account before it can send.
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain**: your domain. Choose to authenticate it yourself; Brevo lists 3–4 DNS records (a `brevo-code` TXT, DKIM records, and a DMARC TXT). Add each one in **Cloudflare → DNS → Add record** exactly as shown (for CNAME records, switch the orange cloud to **DNS only**). Click **Authenticate** in Brevo when done.
3. **Senders → Add a sender**: name `ArchMentor`, email `noreply@yourdomain` (it does not need a mailbox).
4. **SMTP & API → API Keys → Generate a new API key**. Copy it (starts with `xkeysib-`). This is for the website's notification emails.
5. **SMTP & API → SMTP**: note the **SMTP server** (`smtp-relay.brevo.com`), **port** `587`, **login** (looks like `xxxx@smtp-brevo.com`) and **generate an SMTP key**. These are for Supabase's login emails.

### 6. Connect Supabase logins to Brevo (10 min)
In Supabase:
1. **Authentication → Emails → SMTP Settings → Enable custom SMTP**: Sender email `noreply@yourdomain`, Sender name `ArchMentor`, Host `smtp-relay.brevo.com`, Port `587`, Username = Brevo SMTP login, Password = Brevo SMTP key. Save.
2. **Authentication → Rate Limits**: set "emails sent per hour" to `100`.
3. **Authentication → Sign In / Providers → Email**: keep **Confirm email** on; set minimum password length to `8`.
4. **Authentication → URL Configuration**: Site URL = `https://yourdomain`; Redirect URLs: add `https://yourdomain/**`, `https://www.yourdomain/**` and `https://archmentor.pages.dev/**`.
5. Optional: **Authentication → Emails → Templates** to reword the confirmation and reset emails.

### 7. Make yourself admin and switch on the website's emails (5 min)
1. Open the live site, **Get started**, sign up with the client's Gmail, confirm the email.
2. Supabase **SQL Editor**, run (with that email):
   ```sql
   update public.profiles set role = 'admin', approved = true where email = 'archmentor.team@gmail.com';
   ```
3. Log out and in — you land in the **Workspace**. Go to **Workspace → Settings**: website address `https://yourdomain`, admin email and "replies go to" = the Gmail, "send emails from" = `noreply@yourdomain`, paste the **Brevo API key**, Save.
4. **Workspace → Email log → Send a test email to the admin.** It should arrive in the Gmail within a minute and show as **sent**.

### 8. Online payments with Razorpay — test mode first (30 min, optional)
Until you do this, **Settings → Online payments = Off** and paid services work as before (the mentor arranges payment).
1. Create a Razorpay account (free; you pay a fee only per payment). Stay in **Test mode**. **Account & Settings → API Keys → Generate test key**: you get a Key Id (`rzp_test_…`) and a Key Secret.
2. Supabase → **Edge Functions → Deploy a new function → Via editor**, four times. Name each exactly as below and paste the matching file from this repository:
   | Function name | File | "Enforce JWT verification" |
   | --- | --- | --- |
   | `create-checkout-order` | `edge-create-checkout-order.ts` | on |
   | `verify-payment` | `edge-verify-payment.ts` | on |
   | `request-refund` | `edge-request-refund.ts` | on |
   | `payment-webhook` | `edge-payment-webhook.ts` | **off** (Razorpay calls it; it checks Razorpay's signature instead) |
3. Supabase → **Edge Functions → Secrets**: add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` (make up a long random string). **Secrets never go in Cloudflare, GitHub or any `VITE_` variable.**
4. Razorpay → **Webhooks → Add new webhook**: URL `https://<your-project>.supabase.co/functions/v1/payment-webhook`, the same secret, events `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`.
5. On the site: **Workspace → Settings → Online payments = Test mode**, paste the **Key Id** (public part only). Save.
6. Test: as a student book a paid service and pay with Razorpay's test UPI/card. The booking turns **confirmed**, both people get emails, and **Workspace → Finance** shows the order and ledger entries.
7. **Live mode only after** Razorpay KYC is approved and a lawyer has reviewed the Terms, Privacy and Refund pages (`/legal/…`, drafts in `Legal.jsx`) and the business/GST set-up. Then generate live keys, update the three secrets and the Key Id, and switch Settings to Live.

Payouts to mentors are **manual** (bank/UPI transfer by the client, recorded with its UTR): one person prepares, another approves, payouts above ₹25,000 (changeable) need the main admin. Automatic split payments (Razorpay Route) stay off until Razorpay and a legal review approve the marketplace model.

### 9. Staff and two-step sign-in (10 min)
1. Main admin: **Workspace → Settings → Two-step sign-in → Set up** (scan the QR code in Google Authenticator or similar). Needed for Finance, Commission, Payouts, Audit and Staff tools.
2. **Workspace → Staff → Invite**: email + roles. The person creates an account with that email at `/signup`, confirms it, then signs in at `/staff/login`.
3. Supabase → **Authentication → Multi-Factor** — make sure TOTP is enabled (it is by default).

### 10. Keep the free database awake
Supabase pauses free projects after a week with no activity. The workflow `.github/workflows/keepalive.yml` pings it every two days. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as in Cloudflare). Then **Actions → Keep Supabase awake → Run workflow** once to check it turns green. GitHub turns scheduled workflows off after 60 days without any commit; it emails you first, and one click re-enables it.

---

## Limits of the free plan

- **Brevo:** 300 emails a day in total. Plenty for bookings and alerts; a newsletter to a big list may need the paid plan (from about $9/month).
- **Supabase:** 500 MB database, 1 GB image storage, 50,000 monthly users; paused after a week of no activity (handled by step 8).
- **Cloudflare Pages:** free for business use; unlimited visitors.
- **Supabase Edge Functions:** 500,000 calls a month free — far more than payments need.
- **Razorpay:** no monthly fee; about 2% (+18% GST on the fee) per payment. Commission rules decide whether the platform, mentor or student carries it.

## Things to edit later
- Social links and contact email: `config.js`.
- Service categories, expertise list, glossary: `seed.js` (the lists at the bottom).
- Colours and fonts: top of `styles.css`.
- Everything else (mentors, services, sessions, stories, videos) is edited on the live site.

## Updating the database after a code update
If a new version changes `schema.sql`, run the whole file again in the SQL Editor. It keeps all data (it never drops tables or columns). This version adds Part B (sections 13–30): staff and permissions, audit log, notifications, availability, payments and finance, portfolio reviews, support, campaigns, opportunities and resources.

## Changing text and pictures on the site
Staff with the **content manager** role (and the main admin) see an **Edit text & images** button in the bottom-right corner of every public page. Click it, then click any outlined heading or paragraph and type; it saves when you click away (Esc cancels, clearing a text brings back the original). Pictures get a **Change picture** button (paste, drop, upload or link). Every change is saved in the database and listed in the audit log. Mentors, sessions, Journal stories, videos, resources and opportunities are edited in the Workspace as before.

## Opportunities from mentors and firms
Approved mentors and **verified firms** (professional accounts the team verifies under Workspace → People → *Verify firm*) can post internships, jobs and competitions from their dashboard; their posts go live at once. Other professional accounts can post too, but their posts wait in **Workspace → Videos & resources → Opportunities waiting for review**. Posters get an email when a post is published or declined, can close a post once the position is filled, and are limited to 5 posts a day.

## Motion
Pages rise in, sections fade up as you scroll, lines draw, links underline from the left. If the device has "reduce motion" switched on (Windows: Settings → Accessibility → Visual effects → *Animation effects*; Mac/iPhone: Accessibility → Motion → *Reduce motion*), nothing moves and content only fades — this is deliberate, for visitors who get dizzy from motion.

## Money rules (how commission works)
All amounts are whole **paise**; percentages are **basis points** (1% = 100). For a listed price *P* and the matching rule:
- fee = round(P × bps / 10000) + fixed, at least the minimum, at most the maximum (and never above *P* when the fee is inside the price)
- gateway estimate = round((P + fee if added on top) × gateway bps / 10000 × (1 + GST bps / 10000))
- student pays = P (+ fee if added on top) (+ gateway if the student bears it)
- mentor receives = P (− fee if inside the price) (− gateway if the mentor bears it)

The most specific active rule wins (mentor → service type → general → Settings default). Every order keeps a snapshot of its rule, so changing a rule never changes past orders. The browser never sends a price: the database computes it (`public.create_order`) and the payment is only accepted if Razorpay reports exactly that amount in INR. Every payment event is processed once (idempotent), the ledger is append-only, and refunds reverse the mentor's share automatically.

## Checks
`npm run lint` · `npm test` (commission maths, slots, permissions, schema safety) · `npm run build`. GitHub runs all three on every push (`.github/workflows/ci.yml`).

## Files
All website files sit at the top level (no folders, so the GitHub website upload works). The only folder is `.github/workflows/` (`keepalive.yml`, `ci.yml`). Delete `Ask.jsx` and `.github/workflows/deploy.yml` from the repository if they are still there — they are no longer used.
- `main.jsx` routes · `Layout.jsx` header and footer · `api.js` all data (Supabase or demo) · `auth.jsx` login state
- Pages: `Home`, `Mentors`, `MentorProfile`, `Book`, `Sessions`, `Community`, `Journal`, `Post`, `Editor`, `Videos`, `Write`, `AccountPages`, `Dashboard`, `Unsubscribe`, `NotFound`
- New: `Book` (slots + pay), `Portfolio`, `Explore` (opportunities, resources), `Support`, `Legal`, `Staff` + `StaffFinance` (workspace), `MentorTools` (availability, earnings), `Checkout`, `Notifications`, `InstallApp`, `ArchArt` (original line drawings), `Ui`
- `platform.js` data for the new modules · `money.js`, `slots.js`, `permissions.js` shared rules (+ `*.test.js`)
- `edge-*.ts` the four Supabase Edge Functions for Razorpay
- PWA: `manifest.webmanifest`, `sw.js`, `offline.html`, `icon-*.png`, `apple-touch-icon.png` · `_headers` security headers for Cloudflare
- `schema.sql` database, security rules and all emails · `seed.sql` optional starter content
