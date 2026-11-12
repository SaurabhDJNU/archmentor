# ArchMentor

A mentorship platform for architecture students: mentor profiles, session requests, free live sessions, a Journal, videos, a public Q&A and an email list, with dashboards for students, mentors and admins.

Built with React (Vite) and [Supabase](https://supabase.com) (free tier) for accounts and data. It runs as a static site, so it can be hosted free on GitHub Pages or Vercel.

## What works

| For | Features |
| --- | --- |
| Visitors | Home page, mentor list with filters, mentor profiles, live sessions with free seat registration, Journal with search and topics, story pages with share and an optional video, a Videos page (YouTube talks and Shorts), Ask a mentor, Write for the Journal, email subscribe (every story or weekly digest) |
| Students | Sign up / log in / reset password, request a session from a mentor, follow request status, see the meeting link and the mentor's note, cancel a pending request, edit their profile |
| Mentors | Apply as a mentor (shown publicly only after admin approval), edit their public profile (upload a photo, bio, what they help with), approve or decline requests, add a meeting link and a note, mark sessions as done, write Journal stories and send them for review |
| Admins | Approve mentors and manage people, see all requests, create and edit live sessions and download registrations, write and publish Journal stories in a full-page editor (paste images straight in), add YouTube videos, answer and publish student questions, review story ideas, download the subscriber list as CSV |

Security is enforced in the database with row-level security: students can't see each other's requests, nobody can make themselves an admin, mentors can't edit a student's message, and form data such as subscribers and registrations is visible only to admins.

## Try it in demo mode

With no Supabase keys, the site runs in **demo mode**: sample data is saved in your browser only, and a yellow bar shows the demo logins.

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@demo.archmentor` | `demo1234` |
| Mentor | `mentor@demo.archmentor` | `demo1234` |
| Admin | `admin@demo.archmentor` | `demo1234` |

To run it on your computer:

```bash
npm install
npm run dev
```

## Go live with Supabase (about 15 minutes)

1. **Create a project.** Sign in at [supabase.com](https://supabase.com) and create a new project (the free plan is enough).
2. **Create the database.** Open **SQL Editor → New query**, paste everything from [`schema.sql`](schema.sql) and click **Run**. Optionally run [`seed.sql`](seed.sql) too, for a starter live session and two Journal stories.
3. **Copy the keys.** In **Project Settings → API**, copy the **Project URL** and the **anon public** key.
4. **Add them to GitHub.** In this repository go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `VITE_SUPABASE_URL`: the Project URL
   - `VITE_SUPABASE_ANON_KEY`: the anon public key
5. **Turn on GitHub Pages.** In **Settings → Pages**, set **Source** to **GitHub Actions**. Then open **Actions → Deploy to GitHub Pages → Run workflow** (or push any commit). The site appears at `https://<your-username>.github.io/archmentor/`.
6. **Set the sign-in links.** In Supabase go to **Authentication → URL Configuration**. Set **Site URL** to your site address, and add `https://<your-username>.github.io/archmentor/**` under **Redirect URLs**. This makes the confirmation and password-reset emails link back to your site.
7. **Make yourself admin.** Sign up on the live site with your own email, then run this in the SQL Editor (with your email):

   ```sql
   update public.profiles set role = 'admin', approved = true where email = 'you@example.com';
   ```

   Log out and back in. You'll see **Admin** in the menu.

The anon key is meant to be public; the database rules protect the data. Never put the `service_role` key in this project.

### Hosting on Vercel instead

Import the repository at [vercel.com/new](https://vercel.com/new), add the same two environment variables, and deploy. `vercel.json` already handles page routing. Use your Vercel address in step 6.

### Custom domain

On GitHub Pages, add the domain in **Settings → Pages**, then add a repository **variable** (not a secret) named `BASE_PATH` with the value `/`, and re-run the workflow.

## Things to edit

- **Social links and contact email:** [`config.js`](config.js). Icons only show for links you fill in.
- **Studio words** (glossary on the home page) and **demo data:** [`seed.js`](seed.js).
- **Colours, fonts and spacing:** [`styles.css`](styles.css) (variables at the top).
- **Service names and descriptions:** `SERVICES` in [`util.js`](util.js).

Everything else, including mentors, sessions, stories, videos and answers, is managed from the admin dashboard on the live site.

## Good to know

- **Emails.** Supabase sends sign-up confirmation and password-reset emails. The site does **not** send newsletters or session reminders by itself: download subscribers and registrations as CSV from the admin dashboard and send them from your own email or a mailing tool. Supabase's built-in email has a low hourly limit; for real traffic, connect your own SMTP in **Authentication → Emails → SMTP settings**.
- **Images.** Upload, paste (Ctrl + V) or drag images straight in: mentor photos, story covers and pictures inside stories. Large photos are shrunk in the browser before upload and stored in Supabase Storage (bucket `images`, created by `schema.sql`; the free plan includes 1 GB).
- **Writing.** Admins and approved mentors write in a full-page editor (Dashboard → Journal / My stories → Write a new story) with headings, bold, lists, quotes, links, images and YouTube videos. Drafts save automatically. Mentors send stories for review; admins publish.
- **Updating the site later.** If a new version changes `schema.sql`, just run the whole file again in the SQL Editor. It keeps your data.
- **Videos.** Paste any YouTube link in Admin → Videos. The player loads from youtube-nocookie.com only after a visitor clicks play.

## Project structure

All files sit at the top level, so the repository can be uploaded through the GitHub website without folders. The only folder is `.github/workflows/`, which holds the deployment file.

- `main.jsx`: app entry and page routes
- `Layout.jsx`, `Bits.jsx`, `Icons.jsx`, `Markdown.jsx`, `RichText.jsx`: shared parts
- `Editor.jsx`, `RichEditor.jsx`, `ImageInput.jsx`: story editor and image upload
- `Home.jsx`, `Mentors.jsx`, `MentorProfile.jsx`, `Sessions.jsx`, `Journal.jsx`, `Post.jsx`, `Videos.jsx`, `Ask.jsx`, `Write.jsx`, `AccountPages.jsx`, `Dashboard.jsx`, `NotFound.jsx`: pages
- `api.js`: data layer (Supabase or demo mode); `auth.jsx`: login state; `util.js`: helpers
- `config.js`: social links and contact email; `seed.js`: demo content and studio words
- `schema.sql`, `seed.sql`: Supabase database setup
