-- =====================================================================
-- ArchMentor database for Supabase
--
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- It is safe to run again (also after updating the site): it keeps your
-- data, adds anything new and recreates the security rules and emails.
-- =====================================================================

create extension if not exists pg_net with schema extensions;   -- lets the database send emails (HTTPS calls)
create extension if not exists pg_cron with schema pg_catalog;    -- reminders and weekly digest
create schema if not exists private;                             -- internal functions, not reachable from the website
revoke all on schema private from public;

-- =====================================================================
-- 1. Tables
-- =====================================================================

-- People ---------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  full_name     text not null default '',
  role          text not null default 'student',
  approved      boolean not null default false,   -- mentors: verified by admin and shown publicly
  title         text default '',                   -- e.g. "Practising Architect"
  organisation  text default '',                   -- firm, school or university
  bio           text default '',
  photo_url     text default '',
  linkedin_url  text default '',
  portfolio_url text default '',
  calendly_url  text default '',                   -- mentors: where approved students pick a time
  expertise     text default '',                   -- mentors: main area, e.g. "Urban Design"
  experience    text default '',                   -- e.g. "20+ years"
  works_with    text[] not null default '{}',      -- e.g. {Architecture students, Recent graduates}
  specialties   text[] not null default '{}',      -- legacy, unused
  stage         text default '',                   -- students: year or stage
  created_at    timestamptz not null default now()
);
alter table public.profiles add column if not exists portfolio_url text default '';
alter table public.profiles add column if not exists calendly_url text default '';
alter table public.profiles add column if not exists expertise text default '';
alter table public.profiles add column if not exists experience text default '';
alter table public.profiles add column if not exists works_with text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'mentor', 'professional', 'admin'));

-- Mentor services (what students can book) ----------------------------
create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null references public.profiles (id) on delete cascade,
  category     text not null default 'Career',
  title        text not null,
  description  text default '',
  duration_min int not null default 30,
  price_inr    int not null default 0 check (price_inr >= 0),   -- 0 = free
  active       boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

-- Bookings (a student requests a mentor's service) ----------------------
create table if not exists public.requests (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles (id) on delete cascade,
  mentor_id      uuid not null references public.profiles (id) on delete cascade,
  student_name   text not null default '',
  student_email  text not null default '',
  mentor_name    text not null default '',
  service        text not null default '',   -- category of the booked service
  stage          text default '',
  message        text not null default '',
  preferred_time text default '',
  status         text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'done', 'cancelled')),
  meeting_link   text default '',
  mentor_note    text default '',
  created_at     timestamptz not null default now()
);
alter table public.requests drop constraint if exists requests_service_check;
alter table public.requests add column if not exists service_id uuid references public.services (id) on delete set null;
alter table public.requests add column if not exists service_title text not null default '';
alter table public.requests add column if not exists duration_min int;
alter table public.requests add column if not exists price_inr int not null default 0;

-- Live sessions ---------------------------------------------------------
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text default '',
  kind        text default 'Career talk',     -- category label, e.g. "Thesis Guidance"
  starts_at   timestamptz,
  format      text default 'Online, interactive',
  join_link   text default '',                -- emailed to registrants, never shown publicly
  featured    boolean not null default false,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.sessions add column if not exists slug text;
alter table public.sessions add column if not exists subtitle text default '';
alter table public.sessions add column if not exists ends_at timestamptz;
alter table public.sessions add column if not exists platform text default 'Zoom';
alter table public.sessions add column if not exists capacity int;            -- empty = unlimited
alter table public.sessions add column if not exists host_name text default '';
alter table public.sessions add column if not exists reminder_sent boolean not null default false;
alter table public.sessions add column if not exists announced boolean not null default false;
create unique index if not exists sessions_slug_key on public.sessions (slug) where slug is not null;

create table if not exists public.registrations (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  name        text not null,
  email       text not null,
  created_at  timestamptz not null default now(),
  unique (session_id, email)
);
alter table public.registrations add column if not exists user_id uuid references public.profiles (id) on delete cascade;

-- Journal ---------------------------------------------------------------
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  dek          text default '',
  body         text default '',
  tag          text default '',
  author_name  text default '',
  cover_url    text default '',
  youtube_id   text default '',
  published    boolean not null default false,
  published_at timestamptz default now(),
  created_at   timestamptz not null default now()
);
alter table public.posts add column if not exists author_id uuid references public.profiles (id) on delete set null;
alter table public.posts add column if not exists submitted boolean not null default false;   -- mentor sent it for review
alter table public.posts add column if not exists announced boolean not null default false;   -- subscribers emailed

create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  youtube_id  text not null,
  title       text not null,
  kind        text not null default 'full' check (kind in ('full', 'short')),
  featured    boolean not null default false,
  sort        int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Community -------------------------------------------------------------
create table if not exists public.forum_questions (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid references public.profiles (id) on delete set null,
  author_name    text not null default '',
  author_role    text not null default '',
  title          text not null check (char_length(title) between 8 and 200),
  body           text not null default '',
  category       text not null default 'Other',
  views          int not null default 0,
  answers_count  int not null default 0,
  helpful_total  int not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists public.forum_answers (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.forum_questions (id) on delete cascade,
  author_id    uuid references public.profiles (id) on delete set null,
  author_name  text not null default '',
  author_role  text not null default '',
  body         text not null check (char_length(body) >= 2),
  helpful      int not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.forum_votes (
  answer_id  uuid not null references public.forum_answers (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);

-- Forms -----------------------------------------------------------------
create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  idea        text not null,
  status      text not null default 'new' check (status in ('new', 'accepted', 'declined')),
  created_at  timestamptz not null default now()
);

create table if not exists public.subscribers (
  id          uuid primary key default gen_random_uuid(),
  name        text default '',
  email       text not null unique,
  frequency   text not null default 'each' check (frequency in ('each', 'weekly')),
  created_at  timestamptz not null default now()
);
alter table public.subscribers add column if not exists token uuid not null default gen_random_uuid();

-- Site settings (one row) and email log --------------------------------
create table if not exists public.site_settings (
  id            int primary key default 1 check (id = 1),
  site_name     text not null default 'ArchMentor',
  site_url      text not null default 'https://example.com',   -- your live address, used in email links
  admin_email   text not null default '',                       -- receives admin alerts (the client's Gmail)
  sender_email  text not null default '',                       -- e.g. noreply@yourdomain.com (verified in Brevo)
  sender_name   text not null default 'ArchMentor',
  reply_to      text not null default '',                       -- where replies go (the client's Gmail)
  emails_on     boolean not null default true
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.email_log (
  id          bigint generated always as identity primary key,
  to_email    text not null,
  subject     text not null,
  kind        text not null default '',
  status      text not null default 'queued',   -- queued, skipped, error
  request_id  bigint,
  note        text default '',
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- 2. Helpers
-- =====================================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_approved_mentor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'mentor' and approved);
$$;

-- =====================================================================
-- 3. Email engine (Brevo, called from the database with pg_net)
-- =====================================================================

create or replace function private.esc(t text)
returns text language sql immutable as $$
  select replace(replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

-- Plain text from users → safe HTML paragraphs
create or replace function private.para(t text)
returns text language sql immutable as $$
  select replace(private.esc(t), E'\n', '<br>');
$$;

create or replace function private.settings()
returns public.site_settings language sql stable security definer set search_path = public as $$
  select * from public.site_settings where id = 1;
$$;

create or replace function private.link(path text)
returns text language sql stable security definer set search_path = public as $$
  select rtrim((select site_url from public.site_settings where id = 1), '/') || path;
$$;

create or replace function private.fmt_time(ts timestamptz)
returns text language sql stable as $$
  select to_char(ts at time zone 'Asia/Kolkata', 'FMDay, FMDD FMMonth YYYY, FMHH12:MI AM') || ' IST';
$$;

create or replace function private.layout(heading text, body_html text, cta_label text default null, cta_url text default null, footer_html text default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare s public.site_settings := private.settings();
begin
  return '<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f2;">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:32px 12px;"><tr><td align="center">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#111111;">'
    || '<tr><td style="padding:28px 32px 0;font-size:18px;"><b>Arch</b>Mentor</td></tr>'
    || '<tr><td style="padding:24px 32px 8px;font-size:24px;line-height:1.25;font-weight:400;">' || private.esc(heading) || '</td></tr>'
    || '<tr><td style="padding:8px 32px 8px;font-size:15px;line-height:1.6;color:#3a3a3a;">' || body_html || '</td></tr>'
    || case when cta_url is not null and cta_url <> '' then
         '<tr><td style="padding:16px 32px 8px;"><a href="' || private.esc(cta_url) || '" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 20px;font-size:15px;">' || private.esc(coalesce(cta_label, 'Open')) || '</a></td></tr>'
       else '' end
    || '<tr><td style="padding:28px 32px 28px;font-size:12px;line-height:1.5;color:#8a8a8a;border-top:1px solid #eeeeee;">'
    || coalesce(footer_html, 'You received this email because you have an account on ' || private.esc(s.site_name) || '.')
    || '<br><a href="' || private.esc(s.site_url) || '" style="color:#8a8a8a;">' || private.esc(s.site_url) || '</a></td></tr>'
    || '</table></td></tr></table></body></html>';
end;
$$;

-- The one function that sends email. Never callable from the website.
create or replace function private.send_email(p_to text, p_name text, p_subject text, p_html text, p_kind text default '', p_unsubscribe text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.site_settings := private.settings();
  k text;
  req bigint;
  hdrs jsonb := '{}'::jsonb;
begin
  if p_to is null or p_to = '' then return; end if;
  if not s.emails_on then
    insert into public.email_log (to_email, subject, kind, status, note) values (p_to, p_subject, p_kind, 'skipped', 'Emails are switched off in Settings');
    return;
  end if;
  begin
    select decrypted_secret into k from vault.decrypted_secrets where name = 'brevo_api_key' limit 1;
  exception when others then k := null;
  end;
  if k is null or s.sender_email = '' then
    insert into public.email_log (to_email, subject, kind, status, note) values (p_to, p_subject, p_kind, 'skipped', 'Brevo key or sender email not set yet');
    return;
  end if;
  if p_unsubscribe is not null then
    hdrs := jsonb_build_object('List-Unsubscribe', '<' || p_unsubscribe || '>');
  end if;
  select net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', k, 'content-type', 'application/json', 'accept', 'application/json'),
    body := jsonb_build_object(
      'sender', jsonb_build_object('name', s.sender_name, 'email', s.sender_email),
      'to', jsonb_build_array(jsonb_build_object('email', p_to, 'name', coalesce(nullif(p_name, ''), p_to))),
      'replyTo', jsonb_build_object('email', coalesce(nullif(s.reply_to, ''), nullif(s.admin_email, ''), s.sender_email)),
      'subject', p_subject,
      'htmlContent', p_html,
      'headers', hdrs
    ),
    timeout_milliseconds := 10000
  ) into req;
  insert into public.email_log (to_email, subject, kind, status, request_id) values (p_to, p_subject, p_kind, 'queued', req);
exception when others then
  insert into public.email_log (to_email, subject, kind, status, note) values (p_to, p_subject, p_kind, 'error', sqlerrm);
end;
$$;

create or replace function private.email_admin(p_subject text, p_heading text, p_body text, p_cta text, p_url text, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.site_settings := private.settings();
begin
  if s.admin_email <> '' then
    perform private.send_email(s.admin_email, 'Admin', p_subject, private.layout(p_heading, p_body, p_cta, p_url, 'Admin alert from ' || private.esc(s.site_name) || '.'), p_kind);
  end if;
end;
$$;

-- =====================================================================
-- 4. Triggers: accounts
-- =====================================================================

create or replace function private.welcome(p public.profiles)
returns void language plpgsql security definer set search_path = public as $$
declare body text;
begin
  if p.role = 'mentor' then
    body := '<p>Hello ' || private.esc(p.full_name) || ',</p><p>Thank you for applying to mentor on ' || private.esc((private.settings()).site_name) || '. Please complete your mentor profile and add the services students can book. Our team will review it and email you once it is approved.</p>';
    perform private.send_email(p.email, p.full_name, 'Your mentor application has been received', private.layout('Welcome, future mentor', body, 'Complete your profile', private.link('/dashboard')), 'welcome-mentor');
    perform private.email_admin('New mentor application: ' || p.full_name, 'New mentor application',
      '<p><b>' || private.esc(p.full_name) || '</b> (' || private.esc(p.email) || ') has applied to be a mentor.</p><p>Review and approve them under Admin → People.</p>', 'Review applications', private.link('/dashboard'), 'admin-mentor-applied');
  else
    body := '<p>Hello ' || private.esc(p.full_name) || ',</p><p>Your account is ready. You can now '
      || case when p.role = 'student' then 'find a mentor and request a session, reserve seats in free live sessions, and ask questions in the community.'
              else 'join the community, answer students'' questions and reserve seats in live sessions.' end
      || '</p>';
    perform private.send_email(p.email, p.full_name, 'Welcome to ' || (private.settings()).site_name, private.layout('Welcome to ' || (private.settings()).site_name, body, 'Go to your dashboard', private.link('/dashboard')), 'welcome');
  end if;
end;
$$;

-- New sign-up → profile row (role from sign-up form: student, mentor or professional).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case new.raw_user_meta_data ->> 'role' when 'mentor' then 'mentor' when 'professional' then 'professional' else 'student' end
  )
  on conflict (id) do nothing
  returning * into p;
  if p.id is not null and new.email_confirmed_at is not null then perform private.welcome(p); end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Welcome email once the person confirms their email address
create or replace function public.handle_user_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    select * into p from public.profiles where id = new.id;
    if p.id is not null then perform private.welcome(p); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update on auth.users for each row execute function public.handle_user_confirmed();

-- Only admins may change role, approval or email on a profile.
create or replace function public.guard_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.approved := old.approved;
    new.email := old.email;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile();

create or replace function private.on_profile_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'mentor' and new.approved and not old.approved then
    perform private.send_email(new.email, new.full_name, 'You are now a verified mentor',
      private.layout('Your mentor profile is live',
        '<p>Hello ' || private.esc(new.full_name) || ',</p><p>Your profile has been approved and now appears in the mentor directory with a verified badge. Students can request your services, and you will get an email for every new request.</p><p>Tip: add your Calendly link in your profile so approved students can pick a time straight away.</p>',
        'View your public profile', private.link('/mentors/' || new.id)), 'mentor-approved');
  end if;
  return new;
end;
$$;
drop trigger if exists profile_changed on public.profiles;
create trigger profile_changed after update on public.profiles for each row execute function private.on_profile_changed();

-- =====================================================================
-- 5. Triggers: bookings
-- =====================================================================

create or replace function public.guard_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare sv public.services;
begin
  if tg_op = 'INSERT' then
    select full_name, email into new.student_name, new.student_email from public.profiles where id = new.student_id;
    select full_name into new.mentor_name from public.profiles where id = new.mentor_id;
    if new.service_id is not null then
      select * into sv from public.services where id = new.service_id;
      if sv.id is null or sv.mentor_id <> new.mentor_id or not sv.active then raise exception 'This service is not available'; end if;
      new.service := sv.category; new.service_title := sv.title; new.duration_min := sv.duration_min; new.price_inr := sv.price_inr;
    end if;
    new.status := 'pending'; new.meeting_link := ''; new.mentor_note := '';
    return new;
  end if;
  if auth.uid() is null or public.is_admin() then return new; end if;
  if auth.uid() = old.mentor_id then
    new.student_id := old.student_id; new.mentor_id := old.mentor_id; new.service_id := old.service_id;
    new.student_name := old.student_name; new.student_email := old.student_email; new.mentor_name := old.mentor_name;
    new.service := old.service; new.service_title := old.service_title; new.duration_min := old.duration_min; new.price_inr := old.price_inr;
    new.stage := old.stage; new.message := old.message; new.preferred_time := old.preferred_time;
    return new;
  end if;
  if auth.uid() = old.student_id then
    if new.status <> 'cancelled' or old.status not in ('pending', 'approved') then raise exception 'You can only cancel a pending or approved request'; end if;
    new := old; new.status := 'cancelled';
    return new;
  end if;
  raise exception 'Not allowed';
end;
$$;
drop trigger if exists guard_request on public.requests;
create trigger guard_request before insert or update on public.requests for each row execute function public.guard_request();

create or replace function private.on_request_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare m public.profiles; what text; price text; body text;
begin
  select * into m from public.profiles where id = new.mentor_id;
  what := coalesce(nullif(new.service_title, ''), new.service, 'Mentorship session');
  price := case when coalesce(new.price_inr, 0) = 0 then 'Free' else '₹' || new.price_inr end;
  if tg_op = 'INSERT' then
    perform private.send_email(m.email, m.full_name, 'New session request from ' || new.student_name,
      private.layout('New session request',
        '<p><b>' || private.esc(new.student_name) || '</b> has requested <b>' || private.esc(what) || '</b>'
        || coalesce(' (' || new.duration_min || ' min, ' || price || ')', '') || '.</p>'
        || case when new.stage <> '' then '<p>Stage: ' || private.esc(new.stage) || '</p>' else '' end
        || '<p style="padding:12px 16px;background:#f4f4f2;">' || private.para(new.message) || '</p>'
        || case when new.preferred_time <> '' then '<p>Times that suit them: ' || private.esc(new.preferred_time) || '</p>' else '' end
        || '<p>Approve or decline it from your dashboard.</p>',
        'Review the request', private.link('/dashboard')), 'booking-new-mentor');
    perform private.send_email(new.student_email, new.student_name, 'Your request was sent to ' || m.full_name,
      private.layout('Request sent',
        '<p>Hello ' || private.esc(new.student_name) || ',</p><p>Your request for <b>' || private.esc(what) || '</b> with ' || private.esc(m.full_name)
        || ' has been sent. You will get an email as soon as the mentor responds.</p>',
        'Track your request', private.link('/dashboard')), 'booking-new-student');
    return new;
  end if;
  if new.status = old.status and new.meeting_link = old.meeting_link and new.mentor_note = old.mentor_note then return new; end if;
  if new.status = 'approved' then
    body := '<p>Hello ' || private.esc(new.student_name) || ',</p><p>' || private.esc(m.full_name) || ' has accepted your request for <b>' || private.esc(what) || '</b>.</p>'
      || case when coalesce(m.calendly_url, '') <> '' then '<p>Next step: choose a time that suits you on the mentor''s calendar.</p>' else '' end
      || case when new.meeting_link <> '' then '<p>Meeting link: <a href="' || private.esc(new.meeting_link) || '">' || private.esc(new.meeting_link) || '</a></p>' else '' end
      || case when new.mentor_note <> '' then '<p style="padding:12px 16px;background:#f4f4f2;">' || private.para(new.mentor_note) || '</p>' else '' end
      || case when coalesce(new.price_inr, 0) > 0 then '<p>This is a paid session (₹' || new.price_inr || '). The mentor will share payment details.</p>' else '' end;
    perform private.send_email(new.student_email, new.student_name,
      case when old.status = 'approved' then 'Updated details for your session with ' else 'Approved: your session with ' end || m.full_name,
      private.layout(case when old.status = 'approved' then 'Session details updated' else 'Your request was approved' end, body,
        case when coalesce(m.calendly_url, '') <> '' then 'Pick a time' else 'Open your dashboard' end,
        coalesce(nullif(m.calendly_url, ''), private.link('/dashboard'))), 'booking-approved');
  elsif new.status = 'declined' and old.status <> 'declined' then
    perform private.send_email(new.student_email, new.student_name, 'Update on your request to ' || m.full_name,
      private.layout('Your request was not accepted',
        '<p>Hello ' || private.esc(new.student_name) || ',</p><p>' || private.esc(m.full_name) || ' is not able to take your request for <b>' || private.esc(what) || '</b> this time.</p>'
        || case when new.mentor_note <> '' then '<p style="padding:12px 16px;background:#f4f4f2;">' || private.para(new.mentor_note) || '</p>' else '' end
        || '<p>You can request another mentor from the directory.</p>',
        'Find another mentor', private.link('/mentors')), 'booking-declined');
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    perform private.send_email(m.email, m.full_name, new.student_name || ' cancelled their request',
      private.layout('Request cancelled', '<p>' || private.esc(new.student_name) || ' has cancelled their request for <b>' || private.esc(what) || '</b>. No action is needed.</p>',
        'Open your dashboard', private.link('/dashboard')), 'booking-cancelled');
  elsif new.status = 'done' and old.status <> 'done' then
    perform private.send_email(new.student_email, new.student_name, 'Thank you for your session with ' || m.full_name,
      private.layout('Session completed', '<p>Hello ' || private.esc(new.student_name) || ',</p><p>We hope your session with ' || private.esc(m.full_name)
        || ' was useful. Book a follow-up or another mentor any time.</p>', 'Find a mentor', private.link('/mentors')), 'booking-done');
  end if;
  return new;
end;
$$;
drop trigger if exists request_event on public.requests;
create trigger request_event after insert or update on public.requests for each row execute function private.on_request_event();

-- =====================================================================
-- 6. Triggers: live sessions
-- =====================================================================

create or replace function public.guard_registration()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap int; taken int; ok boolean;
begin
  select capacity, published and (starts_at is null or starts_at > now()) into cap, ok from public.sessions where id = new.session_id;
  if not coalesce(ok, false) then raise exception 'Registration for this session is closed'; end if;
  if cap is not null then
    select count(*) into taken from public.registrations where session_id = new.session_id;
    if taken >= cap then raise exception 'Sorry, this session is full'; end if;
  end if;
  new.email := lower(trim(new.email));
  return new;
end;
$$;
drop trigger if exists guard_registration on public.registrations;
create trigger guard_registration before insert on public.registrations for each row execute function public.guard_registration();

create or replace function private.session_block(s public.sessions)
returns text language sql stable security definer set search_path = public as $$
  select '<p style="padding:12px 16px;background:#f4f4f2;"><b>' || private.esc(s.title) || '</b><br>'
    || coalesce(private.fmt_time(s.starts_at), 'Date to be announced')
    || case when s.ends_at is not null then ' to ' || to_char(s.ends_at at time zone 'Asia/Kolkata', 'FMHH12:MI AM') else '' end
    || '<br>' || private.esc(coalesce(nullif(s.platform, ''), 'Online')) || ' · Free</p>';
$$;

create or replace function private.on_registration()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = new.session_id;
  perform private.send_email(new.email, new.name, 'Your seat is reserved: ' || s.title,
    private.layout('Your seat is reserved',
      '<p>Hello ' || private.esc(new.name) || ',</p><p>You are registered for:</p>' || private.session_block(s)
      || case when s.join_link <> '' then '<p>Join link: <a href="' || private.esc(s.join_link) || '">' || private.esc(s.join_link) || '</a></p>'
              else '<p>We will email you the joining link before the session starts.</p>' end
      || '<p>We will also send you a reminder the day before.</p>',
      case when s.join_link <> '' then 'Join link' else 'Session details' end,
      coalesce(nullif(s.join_link, ''), private.link('/sessions/' || coalesce(s.slug, s.id::text)))), 'session-registered');
  return new;
end;
$$;
drop trigger if exists registration_event on public.registrations;
create trigger registration_event after insert on public.registrations for each row execute function private.on_registration();

-- New session published → tell subscribers once
create or replace function private.on_session_published()
returns trigger language plpgsql security definer set search_path = public as $$
declare sub record;
begin
  if new.published and not new.announced and (new.starts_at is null or new.starts_at > now()) then
    update public.sessions set announced = true where id = new.id;
    for sub in select * from public.subscribers loop
      perform private.send_email(sub.email, sub.name, 'Free live session: ' || new.title,
        private.layout('New free live session',
          coalesce('<p>' || private.esc(nullif(new.subtitle, '')) || '</p>', '') || private.session_block(new)
          || '<p>' || private.para(left(new.description, 600)) || '</p>',
          'Reserve your seat', private.link('/sessions/' || coalesce(new.slug, new.id::text)),
          'You subscribed to ' || private.esc((private.settings()).site_name) || ' updates. <a href="' || private.link('/unsubscribe?t=' || sub.token) || '" style="color:#8a8a8a;">Unsubscribe</a>.'),
        'session-announce', private.link('/unsubscribe?t=' || sub.token));
    end loop;
  end if;
  return null;
end;
$$;
drop trigger if exists session_published on public.sessions;
create trigger session_published after insert or update of published on public.sessions for each row execute function private.on_session_published();

-- Reminder emails (runs every hour): sessions starting within 24 hours
create or replace function private.send_session_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare s public.sessions; r record;
begin
  for s in select * from public.sessions where published and not reminder_sent and starts_at between now() and now() + interval '24 hours' loop
    update public.sessions set reminder_sent = true where id = s.id;
    for r in select * from public.registrations where session_id = s.id loop
      perform private.send_email(r.email, r.name, 'Reminder: ' || s.title || ' starts soon',
        private.layout('See you soon', '<p>Hello ' || private.esc(r.name) || ',</p><p>This is a reminder for your session:</p>' || private.session_block(s)
          || case when s.join_link <> '' then '<p>Join link: <a href="' || private.esc(s.join_link) || '">' || private.esc(s.join_link) || '</a></p>' else '' end,
          case when s.join_link <> '' then 'Join the session' else 'Session details' end,
          coalesce(nullif(s.join_link, ''), private.link('/sessions/' || coalesce(s.slug, s.id::text)))), 'session-reminder');
    end loop;
  end loop;
end;
$$;

-- =====================================================================
-- 7. Triggers: community
-- =====================================================================

create or replace function public.guard_forum()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if tg_op = 'INSERT' then
    select * into p from public.profiles where id = new.author_id;
    new.author_name := coalesce(p.full_name, ''); new.author_role := coalesce(p.role, '');
    if tg_table_name = 'forum_questions' then new.views := 0; new.answers_count := 0; new.helpful_total := 0; else new.helpful := 0; end if;
  elsif pg_trigger_depth() = 1 and current_setting('archmentor.internal', true) is distinct from '1'
        and not public.is_admin() and auth.uid() is not null then
    -- direct edits by users: counters and authorship cannot be changed
    new.author_id := old.author_id; new.author_name := old.author_name; new.author_role := old.author_role; new.created_at := old.created_at;
    if tg_table_name = 'forum_questions' then new.views := old.views; new.answers_count := old.answers_count; new.helpful_total := old.helpful_total;
    else new.helpful := old.helpful; new.question_id := old.question_id; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_forum_q on public.forum_questions;
create trigger guard_forum_q before insert or update on public.forum_questions for each row execute function public.guard_forum();
drop trigger if exists guard_forum_a on public.forum_answers;
create trigger guard_forum_a before insert or update on public.forum_answers for each row execute function public.guard_forum();

create or replace function private.on_answer()
returns trigger language plpgsql security definer set search_path = public as $$
declare q public.forum_questions; asker public.profiles;
begin
  if tg_op = 'DELETE' then
    update public.forum_questions set answers_count = greatest(answers_count - 1, 0), helpful_total = greatest(helpful_total - old.helpful, 0) where id = old.question_id;
    return old;
  end if;
  update public.forum_questions set answers_count = answers_count + 1 where id = new.question_id returning * into q;
  if q.author_id is not null and q.author_id is distinct from new.author_id then
    select * into asker from public.profiles where id = q.author_id;
    perform private.send_email(asker.email, asker.full_name, 'New answer to your question',
      private.layout('Someone answered your question',
        '<p><b>' || private.esc(q.title) || '</b></p><p>' || private.esc(new.author_name) || ' wrote:</p><p style="padding:12px 16px;background:#f4f4f2;">'
        || private.para(left(new.body, 800)) || case when length(new.body) > 800 then '…' else '' end || '</p>',
        'Read the answer', private.link('/community/' || q.id)), 'forum-answer');
  end if;
  return new;
end;
$$;
drop trigger if exists answer_event on public.forum_answers;
create trigger answer_event after insert or delete on public.forum_answers for each row execute function private.on_answer();

create or replace function private.on_vote()
returns trigger language plpgsql security definer set search_path = public as $$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end; aid uuid := coalesce(new.answer_id, old.answer_id); qid uuid;
begin
  update public.forum_answers set helpful = greatest(helpful + d, 0) where id = aid returning question_id into qid;
  update public.forum_questions set helpful_total = greatest(helpful_total + d, 0) where id = qid;
  return null;
end;
$$;
drop trigger if exists vote_event on public.forum_votes;
create trigger vote_event after insert or delete on public.forum_votes for each row execute function private.on_vote();

create or replace function public.forum_view(qid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('archmentor.internal', '1', true);
  update public.forum_questions set views = views + 1 where id = qid;
  perform set_config('archmentor.internal', '', true);
end;
$$;
grant execute on function public.forum_view(uuid) to anon, authenticated;

-- =====================================================================
-- 8. Triggers: Journal, forms, subscribers
-- =====================================================================

create or replace function private.on_post_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.profiles; sub record; url text;
begin
  url := private.link('/journal/' || new.slug);
  if new.submitted and not new.published and (tg_op = 'INSERT' or not old.submitted) then
    perform private.email_admin('Story for review: ' || new.title, 'A story is waiting for review',
      '<p><b>' || private.esc(new.title) || '</b> by ' || private.esc(new.author_name) || ' was sent for review.</p>', 'Review it', private.link('/editor/' || new.id), 'admin-story-review');
  end if;
  if new.published and (tg_op = 'INSERT' or not old.published) then
    if new.author_id is not null and new.author_id is distinct from auth.uid() then
      select * into a from public.profiles where id = new.author_id;
      perform private.send_email(a.email, a.full_name, 'Your story is published: ' || new.title,
        private.layout('Your story is live', '<p>Hello ' || private.esc(a.full_name) || ',</p><p><b>' || private.esc(new.title) || '</b> is now published in the Journal. Thank you for writing it.</p>', 'Read it', url), 'story-published');
    end if;
    if not new.announced then
      update public.posts set announced = true where id = new.id;
      for sub in select * from public.subscribers where frequency = 'each' loop
        perform private.send_email(sub.email, sub.name, new.title,
          private.layout(new.title, '<p>' || private.esc(new.dek) || '</p>', 'Read the story', url,
            'You subscribed to new stories from ' || private.esc((private.settings()).site_name) || '. <a href="' || private.link('/unsubscribe?t=' || sub.token) || '" style="color:#8a8a8a;">Unsubscribe</a>.'),
          'story-subscribers', private.link('/unsubscribe?t=' || sub.token));
      end loop;
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists post_changed on public.posts;
create trigger post_changed after insert or update of published, submitted on public.posts for each row execute function private.on_post_changed();

-- Weekly digest (Sundays) for subscribers who chose "weekly"
create or replace function private.send_weekly_digest()
returns void language plpgsql security definer set search_path = public as $$
declare items text := ''; p record; sub record; n int := 0;
begin
  for p in select * from public.posts where published and published_at > now() - interval '7 days' order by published_at desc loop
    items := items || '<p><a href="' || private.link('/journal/' || p.slug) || '" style="color:#111111;font-size:17px;">' || private.esc(p.title) || '</a><br>' || private.esc(p.dek) || '</p>';
    n := n + 1;
  end loop;
  if n = 0 then return; end if;
  for sub in select * from public.subscribers where frequency = 'weekly' loop
    perform private.send_email(sub.email, sub.name, 'This week on ' || (private.settings()).site_name,
      private.layout('This week in the Journal', items, 'Visit the Journal', private.link('/journal'),
        'You chose the weekly digest. <a href="' || private.link('/unsubscribe?t=' || sub.token) || '" style="color:#8a8a8a;">Unsubscribe</a>.'),
      'weekly-digest', private.link('/unsubscribe?t=' || sub.token));
  end loop;
end;
$$;

create or replace function private.on_submission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform private.send_email(new.email, new.name, 'We received your story idea',
    private.layout('Thank you for your idea', '<p>Hello ' || private.esc(new.name) || ',</p><p>We have your story idea and will reply by email soon.</p><p style="padding:12px 16px;background:#f4f4f2;">' || private.para(new.idea) || '</p>', null, null,
      'You sent this from the Write for the Journal page.'), 'submission-ack');
  perform private.email_admin('New story idea from ' || new.name, 'New story idea',
    '<p><b>' || private.esc(new.name) || '</b> (' || private.esc(new.email) || ') wrote:</p><p style="padding:12px 16px;background:#f4f4f2;">' || private.para(new.idea) || '</p><p>Reply to this person directly at ' || private.esc(new.email) || '.</p>',
    'Open story ideas', private.link('/dashboard'), 'admin-submission');
  return new;
end;
$$;
drop trigger if exists submission_event on public.submissions;
create trigger submission_event after insert on public.submissions for each row execute function private.on_submission();

create or replace function private.on_subscribe()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform private.send_email(new.email, new.name, 'You are subscribed to ' || (private.settings()).site_name,
    private.layout('You are on the list', '<p>Thank you for subscribing. You will get '
      || case when new.frequency = 'weekly' then 'a short digest every Sunday' else 'an email for each new Journal story' end
      || ' and news of free live sessions.</p>', 'Visit the Journal', private.link('/journal'),
      '<a href="' || private.link('/unsubscribe?t=' || new.token) || '" style="color:#8a8a8a;">Unsubscribe</a> at any time.'),
    'subscribed', private.link('/unsubscribe?t=' || new.token));
  return new;
end;
$$;
drop trigger if exists subscribe_event on public.subscribers;
create trigger subscribe_event after insert on public.subscribers for each row execute function private.on_subscribe();

create or replace function public.unsubscribe(t uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.subscribers where token = t;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
grant execute on function public.unsubscribe(uuid) to anon, authenticated;

-- =====================================================================
-- 9. Admin tools: email key, test email, email log
-- =====================================================================

create or replace function public.admin_set_brevo_key(k text)
returns void language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select id into sid from vault.secrets where name = 'brevo_api_key';
  if sid is null then perform vault.create_secret(k, 'brevo_api_key', 'Brevo API key for ArchMentor emails');
  else perform vault.update_secret(sid, k, 'brevo_api_key', 'Brevo API key for ArchMentor emails'); end if;
end;
$$;
grant execute on function public.admin_set_brevo_key(text) to authenticated;

create or replace function public.admin_email_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare has_key boolean;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  begin
    select exists (select 1 from vault.secrets where name = 'brevo_api_key') into has_key;
  exception when others then has_key := false;
  end;
  return jsonb_build_object('has_key', has_key);
end;
$$;
grant execute on function public.admin_email_status() to authenticated;

create or replace function public.admin_send_test_email()
returns void language plpgsql security definer set search_path = public as $$
declare s public.site_settings := private.settings();
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if s.admin_email = '' then raise exception 'Add the admin email in Settings first'; end if;
  perform private.send_email(s.admin_email, 'Admin', 'Test email from ' || s.site_name,
    private.layout('Emails are working', '<p>If you can read this, your website can send emails.</p>', 'Open the website', s.site_url), 'test');
end;
$$;
grant execute on function public.admin_send_test_email() to authenticated;

-- Email log with delivery result from Brevo (admins only)
create or replace function public.admin_email_log(lim int default 100)
returns table (id bigint, created_at timestamptz, to_email text, subject text, kind text, status text, note text, http_status int)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select l.id, l.created_at, l.to_email, l.subject, l.kind,
      case when l.status = 'queued' and r.status_code between 200 and 299 then 'sent'
           when l.status = 'queued' and r.status_code is not null then 'failed'
           when l.status = 'queued' and r.error_msg is not null then 'failed'
           else l.status end,
      coalesce(nullif(l.note, ''), left(r.content::text, 300), r.error_msg, ''),
      r.status_code
    from public.email_log l
    left join net._http_response r on r.id = l.request_id
    order by l.id desc limit lim;
end;
$$;
grant execute on function public.admin_email_log(int) to authenticated;

-- =====================================================================
-- 10. Row level security
-- =====================================================================

alter table public.profiles        enable row level security;
alter table public.services        enable row level security;
alter table public.requests        enable row level security;
alter table public.sessions        enable row level security;
alter table public.registrations   enable row level security;
alter table public.posts           enable row level security;
alter table public.videos          enable row level security;
alter table public.forum_questions enable row level security;
alter table public.forum_answers   enable row level security;
alter table public.forum_votes     enable row level security;
alter table public.submissions     enable row level security;
alter table public.subscribers     enable row level security;
alter table public.site_settings   enable row level security;
alter table public.email_log       enable row level security;

-- profiles: approved mentors and community authors are public; you see yourself; admins see all
drop policy if exists "profiles: public approved mentors" on public.profiles;
create policy "profiles: public approved mentors" on public.profiles for select
  using ((role = 'mentor' and approved) or id = auth.uid() or public.is_admin());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: admin delete" on public.profiles;
create policy "profiles: admin delete" on public.profiles for delete using (public.is_admin());

-- services: public for approved mentors; mentors manage their own
drop policy if exists "services: read" on public.services;
create policy "services: read" on public.services for select
  using ((active and exists (select 1 from public.profiles m where m.id = mentor_id and m.role = 'mentor' and m.approved))
         or mentor_id = auth.uid() or public.is_admin());
drop policy if exists "services: write own" on public.services;
create policy "services: write own" on public.services for all
  using (mentor_id = auth.uid() or public.is_admin())
  with check ((mentor_id = auth.uid() and exists (select 1 from public.profiles m where m.id = auth.uid() and m.role = 'mentor')) or public.is_admin());

-- requests
drop policy if exists "requests: students create" on public.requests;
create policy "requests: students create" on public.requests for insert
  with check (
    student_id = auth.uid()
    and exists (select 1 from public.profiles s where s.id = auth.uid() and s.role = 'student')
    and exists (select 1 from public.profiles m where m.id = mentor_id and m.role = 'mentor' and m.approved)
  );
drop policy if exists "requests: parties read" on public.requests;
create policy "requests: parties read" on public.requests for select
  using (student_id = auth.uid() or mentor_id = auth.uid() or public.is_admin());
drop policy if exists "requests: parties update" on public.requests;
create policy "requests: parties update" on public.requests for update
  using (student_id = auth.uid() or mentor_id = auth.uid() or public.is_admin());
drop policy if exists "requests: admin delete" on public.requests;
create policy "requests: admin delete" on public.requests for delete using (public.is_admin());

-- sessions
drop policy if exists "sessions: read published" on public.sessions;
create policy "sessions: read published" on public.sessions for select using (published or public.is_admin());
drop policy if exists "sessions: admin write" on public.sessions;
create policy "sessions: admin write" on public.sessions for all using (public.is_admin()) with check (public.is_admin());
-- join links stay private: the website reads sessions through a column list without join_link
revoke select on public.sessions from anon, authenticated;
grant select (id, slug, title, subtitle, description, kind, starts_at, ends_at, platform, format, capacity, host_name, featured, published, created_at) on public.sessions to anon, authenticated;
grant insert, update, delete on public.sessions to authenticated;

create or replace function public.admin_sessions()
returns setof public.sessions language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select * from public.sessions order by starts_at desc nulls first;
end;
$$;
grant execute on function public.admin_sessions() to authenticated;

-- registrations: signed-in people register themselves; they see their own
drop policy if exists "registrations: anyone registers" on public.registrations;
drop policy if exists "registrations: register self" on public.registrations;
create policy "registrations: register self" on public.registrations for insert
  with check (user_id = auth.uid());
drop policy if exists "registrations: admin" on public.registrations;
drop policy if exists "registrations: read own" on public.registrations;
create policy "registrations: read own" on public.registrations for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "registrations: delete own" on public.registrations;
drop policy if exists "registrations: admin delete" on public.registrations;
create policy "registrations: delete own" on public.registrations for delete using (user_id = auth.uid() or public.is_admin());

create or replace function public.session_seat_count(sid uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.registrations where session_id = sid;
$$;
grant execute on function public.session_seat_count(uuid) to anon, authenticated;

-- posts
drop policy if exists "posts: read published" on public.posts;
create policy "posts: read published" on public.posts for select using (published or public.is_admin() or author_id = auth.uid());
drop policy if exists "posts: admin write" on public.posts;
drop policy if exists "posts: write" on public.posts;
create policy "posts: write" on public.posts for insert
  with check (public.is_admin() or (author_id = auth.uid() and not published and public.is_approved_mentor()));
drop policy if exists "posts: edit" on public.posts;
create policy "posts: edit" on public.posts for update
  using (public.is_admin() or (author_id = auth.uid() and not published))
  with check (public.is_admin() or (author_id = auth.uid() and not published));
drop policy if exists "posts: delete" on public.posts;
create policy "posts: delete" on public.posts for delete using (public.is_admin() or (author_id = auth.uid() and not published));

-- videos
drop policy if exists "videos: read published" on public.videos;
create policy "videos: read published" on public.videos for select using (published or public.is_admin());
drop policy if exists "videos: admin write" on public.videos;
create policy "videos: admin write" on public.videos for all using (public.is_admin()) with check (public.is_admin());

-- community: everyone reads; signed-in people post as themselves; authors edit/delete their own; admins moderate
drop policy if exists "forum q: read" on public.forum_questions;
create policy "forum q: read" on public.forum_questions for select using (true);
drop policy if exists "forum q: create" on public.forum_questions;
create policy "forum q: create" on public.forum_questions for insert with check (author_id = auth.uid());
drop policy if exists "forum q: edit" on public.forum_questions;
create policy "forum q: edit" on public.forum_questions for update using (author_id = auth.uid() or public.is_admin());
drop policy if exists "forum q: delete" on public.forum_questions;
create policy "forum q: delete" on public.forum_questions for delete using (author_id = auth.uid() or public.is_admin());

drop policy if exists "forum a: read" on public.forum_answers;
create policy "forum a: read" on public.forum_answers for select using (true);
drop policy if exists "forum a: create" on public.forum_answers;
create policy "forum a: create" on public.forum_answers for insert with check (author_id = auth.uid());
drop policy if exists "forum a: edit" on public.forum_answers;
create policy "forum a: edit" on public.forum_answers for update using (author_id = auth.uid() or public.is_admin());
drop policy if exists "forum a: delete" on public.forum_answers;
create policy "forum a: delete" on public.forum_answers for delete using (author_id = auth.uid() or public.is_admin());

drop policy if exists "forum votes: read own" on public.forum_votes;
create policy "forum votes: read own" on public.forum_votes for select using (user_id = auth.uid());
drop policy if exists "forum votes: vote" on public.forum_votes;
create policy "forum votes: vote" on public.forum_votes for insert
  with check (user_id = auth.uid() and not exists (select 1 from public.forum_answers a where a.id = answer_id and a.author_id = auth.uid()));
drop policy if exists "forum votes: unvote" on public.forum_votes;
create policy "forum votes: unvote" on public.forum_votes for delete using (user_id = auth.uid());

-- write-only forms
drop policy if exists "submissions: anyone submits" on public.submissions;
create policy "submissions: anyone submits" on public.submissions for insert with check (status = 'new');
drop policy if exists "submissions: admin" on public.submissions;
create policy "submissions: admin" on public.submissions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "subscribers: anyone subscribes" on public.subscribers;
create policy "subscribers: anyone subscribes" on public.subscribers for insert with check (true);
drop policy if exists "subscribers: admin" on public.subscribers;
create policy "subscribers: admin" on public.subscribers for all using (public.is_admin()) with check (public.is_admin());

-- settings: anyone can read the public parts; admins edit
drop policy if exists "settings: read" on public.site_settings;
create policy "settings: read" on public.site_settings for select using (true);
drop policy if exists "settings: admin" on public.site_settings;
create policy "settings: admin" on public.site_settings for update using (public.is_admin()) with check (public.is_admin());
revoke select on public.site_settings from anon, authenticated;
grant select (id, site_name, site_url) on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;

create or replace function public.admin_settings()
returns public.site_settings language plpgsql security definer set search_path = public as $$
declare s public.site_settings;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into s from public.site_settings where id = 1;
  return s;
end;
$$;
grant execute on function public.admin_settings() to authenticated;

-- email log: admins only (via admin_email_log)
drop policy if exists "email log: admin" on public.email_log;
create policy "email log: admin" on public.email_log for select using (public.is_admin());

-- =====================================================================
-- 11. Image uploads (Supabase Storage): public bucket "images"
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images: public read" on storage.objects;
create policy "images: public read" on storage.objects for select using (bucket_id = 'images');
drop policy if exists "images: upload own folder" on storage.objects;
create policy "images: upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "images: delete own or admin" on storage.objects;
create policy "images: delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- =====================================================================
-- 12. Scheduled jobs
-- =====================================================================

select cron.schedule('archmentor-session-reminders', '5 * * * *', 'select private.send_session_reminders()');
select cron.schedule('archmentor-weekly-digest', '30 3 * * 0', 'select private.send_weekly_digest()');   -- Sundays 9:00 IST

-- Internal functions stay private
revoke all on all functions in schema private from public, anon, authenticated;
