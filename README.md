# ArchMentor

Architecture mentorship website: verified mentors with bookable services, approval-based booking with Calendly scheduling, free live sessions with seat limits, a community Q&A forum, a Journal with a full writing editor, videos, and email notifications for every step.

**Stack (free except the domain):** React (Vite) · Supabase (database, logins, image storage, email triggers) · Brevo (sends the emails, 300 a day free) · Cloudflare Pages (hosting) · GoDaddy (domain) · the client's Gmail (admin inbox).

---

## What the website does

| Who | What they can do |
| --- | --- |
| Visitors | Browse mentors (search, expertise filter, sort by price or name), view profiles and services, see live sessions and seats left, read the community and Journal, watch videos, subscribe by email |
| Students | Sign up, book a mentor's service, get approval by email, pick a time on the mentor's Calendly, cancel, reserve seats in live sessions, ask and answer community questions, vote answers helpful |
| Mentors | Apply, complete their profile (photo, expertise, experience, firm, Calendly, portfolio), add services (title, category, duration, price or free), approve or decline requests with a note, write Journal stories for review, take part in the community |
| Professionals | Join the community and live sessions without being a mentor |
| Admin | Verify mentors, edit anyone's profile and services, see all bookings, create live sessions (seats, Zoom link, featured), download registrations, publish stories, moderate the community, manage videos, story ideas and subscribers, see every email sent, change email settings |

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

Every newsletter-type email has a one-click unsubscribe link. Admin → Emails shows each email and whether Brevo accepted it.

---

## Try it first (demo mode)

Without Supabase keys the site runs in demo mode with sample data saved only in your browser (no real emails). Log in with password `demo1234` as `student@demo.archmentor`, `mentor@demo.archmentor`, `professional@demo.archmentor` or `admin@demo.archmentor`.

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
3. Log out and in. Go to **Admin → Settings**: website address `https://yourdomain`, admin email and "replies go to" = the Gmail, "send emails from" = `noreply@yourdomain`, paste the **Brevo API key**, Save.
4. **Admin → Emails → Send a test email to the admin.** It should arrive in the Gmail within a minute and show as **sent**.

### 8. Keep the free database awake
Supabase pauses free projects after a week with no activity. The workflow `.github/workflows/keepalive.yml` pings it every two days. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as in Cloudflare). Then **Actions → Keep Supabase awake → Run workflow** once to check it turns green. GitHub turns scheduled workflows off after 60 days without any commit; it emails you first, and one click re-enables it.

---

## Limits of the free plan

- **Brevo:** 300 emails a day in total. Plenty for bookings and alerts; a newsletter to a big list may need the paid plan (from about $9/month).
- **Supabase:** 500 MB database, 1 GB image storage, 50,000 monthly users; paused after a week of no activity (handled by step 8).
- **Cloudflare Pages:** free for business use; unlimited visitors.
- **Payments:** prices are shown on services, but online payment is not built in. For paid sessions, the mentor shares payment details after approving.

## Things to edit later
- Social links and contact email: `config.js`.
- Service categories, expertise list, glossary: `seed.js` (the lists at the bottom).
- Colours and fonts: top of `styles.css`.
- Everything else (mentors, services, sessions, stories, videos) is edited on the live site.

## Updating the database after a code update
If a new version changes `schema.sql`, run the whole file again in the SQL Editor. It keeps all data.

## Files
All website files sit at the top level (no folders, so the GitHub website upload works). The only folder is `.github/workflows/` for the keep-awake job.
- `main.jsx` routes · `Layout.jsx` header and footer · `api.js` all data (Supabase or demo) · `auth.jsx` login state
- Pages: `Home`, `Mentors`, `MentorProfile`, `Book`, `Sessions`, `Community`, `Journal`, `Post`, `Editor`, `Videos`, `Write`, `AccountPages`, `Dashboard`, `Unsubscribe`, `NotFound`
- `schema.sql` database, security rules and all emails · `seed.sql` optional starter content
