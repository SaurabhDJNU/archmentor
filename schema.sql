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
alter table public.profiles add column if not exists location text default '';        -- city, shown publicly for mentors
alter table public.profiles add column if not exists languages text[] not null default '{}';
alter table public.profiles add column if not exists discipline text default '';      -- e.g. Architecture, Interior Design, Urban Planning
alter table public.profiles add column if not exists phone text default '';           -- private
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'mentor', 'professional', 'staff', 'admin'));

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

alter table public.services add column if not exists price_paise int not null default 0 check (price_paise >= 0);
alter table public.services add column if not exists service_type text not null default 'consultation';   -- used for commission rules
alter table public.services add column if not exists requires_approval boolean not null default true;     -- free requests the mentor approves
update public.services set price_paise = price_inr * 100 where price_paise = 0 and price_inr > 0;

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
  status         text not null default 'pending',
  meeting_link   text default '',
  mentor_note    text default '',
  created_at     timestamptz not null default now()
);
alter table public.requests drop constraint if exists requests_service_check;
alter table public.requests add column if not exists service_id uuid references public.services (id) on delete set null;
alter table public.requests add column if not exists service_title text not null default '';
alter table public.requests add column if not exists duration_min int;
alter table public.requests add column if not exists price_inr int not null default 0;
alter table public.requests add column if not exists price_paise int not null default 0;
alter table public.requests add column if not exists service_type text not null default 'consultation';
alter table public.requests add column if not exists start_at timestamptz;          -- chosen slot (optional)
alter table public.requests add column if not exists end_at timestamptz;
alter table public.requests add column if not exists calendly_url text not null default '';   -- copied from the mentor when approved
alter table public.requests add column if not exists order_id uuid;
alter table public.requests add column if not exists updated_at timestamptz not null default now();
alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check
  check (status in ('pending', 'awaiting_payment', 'confirmed', 'approved', 'declined', 'done', 'cancelled', 'refunded'));
-- a mentor cannot be double-booked for the same start time
create unique index if not exists requests_slot_unique on public.requests (mentor_id, start_at)
  where start_at is not null and status in ('pending', 'awaiting_payment', 'confirmed', 'approved');

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
alter table public.sessions add column if not exists price_paise int not null default 0 check (price_paise >= 0);
alter table public.sessions add column if not exists service_type text not null default 'event';
alter table public.sessions add column if not exists host_mentor_id uuid references public.profiles (id) on delete set null;
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
alter table public.registrations add column if not exists status text not null default 'confirmed' check (status in ('confirmed', 'awaiting_payment', 'cancelled'));
alter table public.registrations add column if not exists order_id uuid;

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


-- #####################################################################
-- PART B — Platform: staff & permissions, audit, notifications, payments,
-- portfolio reviews, availability, support, campaigns, opportunities.
-- Everything below is additive and safe to run again.
-- #####################################################################

-- =====================================================================
-- 13. More settings (payments, policies) — secrets never live here
-- =====================================================================

alter table public.site_settings add column if not exists payments_mode text not null default 'off' check (payments_mode in ('off', 'test', 'live'));
alter table public.site_settings add column if not exists razorpay_key_id text not null default '';          -- public key id only (rzp_test_… / rzp_live_…)
alter table public.site_settings add column if not exists default_commission_bps int not null default 2000 check (default_commission_bps between 0 and 10000);
alter table public.site_settings add column if not exists gateway_fee_bps int not null default 200 check (gateway_fee_bps between 0 and 10000);   -- Razorpay standard 2%
alter table public.site_settings add column if not exists gst_bps int not null default 1800 check (gst_bps between 0 and 10000);                  -- GST on gateway fee
alter table public.site_settings add column if not exists payout_hold_days int not null default 7 check (payout_hold_days between 0 and 90);
alter table public.site_settings add column if not exists payout_two_person_paise bigint not null default 2500000;   -- payouts above ₹25,000 need the main admin to approve
alter table public.site_settings add column if not exists cancel_hours int not null default 24 check (cancel_hours between 0 and 720);
alter table public.site_settings add column if not exists slot_hold_minutes int not null default 30 check (slot_hold_minutes between 5 and 1440);
alter table public.site_settings add column if not exists support_email text not null default '';
alter table public.site_settings add column if not exists business_name text not null default '';            -- legal name shown on legal pages
alter table public.site_settings add column if not exists business_address text not null default '';
alter table public.site_settings add column if not exists daily_email_cap int not null default 280;            -- Brevo free plan: 300/day

grant select (id, site_name, site_url, payments_mode, razorpay_key_id, cancel_hours, support_email, business_name, business_address)
  on public.site_settings to anon, authenticated;

-- =====================================================================
-- 14. Public mentor directory (safe columns only) and helper checks
-- =====================================================================

create or replace function public.is_public_mentor(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and role = 'mentor' and approved);
$$;
grant execute on function public.is_public_mentor(uuid) to anon, authenticated;

-- Only these columns of a mentor are ever public. Email, phone and Calendly stay private.
drop view if exists public.public_mentors;
create view public.public_mentors as
  select id, full_name, title, organisation, bio, photo_url, linkedin_url, portfolio_url, expertise, experience,
         works_with, location, languages, discipline, created_at
  from public.profiles where role = 'mentor' and approved;
grant select on public.public_mentors to anon, authenticated;

-- Community/author names: a tiny public card for anyone who wrote something
create or replace function public.public_person(uid uuid)
returns table (id uuid, full_name text, role text, photo_url text, title text)
language sql stable security definer set search_path = public as $$
  select id, full_name, role, photo_url, title from public.profiles where id = uid;
$$;
grant execute on function public.public_person(uuid) to anon, authenticated;

-- =====================================================================
-- 15. Staff, roles and permissions (RBAC)
-- =====================================================================

create table if not exists public.permissions (
  key         text primary key,
  label       text not null,
  area        text not null default 'General',
  sensitive   boolean not null default false   -- needs two-step sign-in (MFA)
);

create table if not exists public.roles (
  key         text primary key,
  label       text not null,
  description text not null default ''
);

create table if not exists public.role_permissions (
  role_key    text not null references public.roles (key) on delete cascade,
  permission  text not null references public.permissions (key) on delete cascade,
  primary key (role_key, permission)
);

create table if not exists public.staff_members (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  email        text not null,
  full_name    text not null default '',
  status       text not null default 'active' check (status in ('active', 'suspended')),
  invited_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  suspended_at timestamptz
);

create table if not exists public.staff_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  full_name   text not null default '',
  role_keys   text[] not null default '{}',
  invited_by  uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  expires_at  timestamptz not null default now() + interval '14 days',
  created_at  timestamptz not null default now()
);

create table if not exists public.staff_role_assignments (
  user_id     uuid not null references public.staff_members (user_id) on delete cascade,
  role_key    text not null references public.roles (key) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (user_id, role_key)
);

create table if not exists public.staff_permission_overrides (
  user_id     uuid not null references public.staff_members (user_id) on delete cascade,
  permission  text not null references public.permissions (key) on delete cascade,
  allow       boolean not null,              -- true = grant extra, false = deny
  reason      text not null default '',
  actor       uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (user_id, permission)
);

insert into public.permissions (key, label, area, sensitive) values
  ('users.read',                'See user accounts',                      'People', false),
  ('mentors.approve',           'Approve or hide mentors',                'People', false),
  ('bookings.read',             'See bookings',                           'Bookings', false),
  ('bookings.manage',           'Change, cancel or reschedule bookings',  'Bookings', false),
  ('events.manage',             'Create and run live sessions',           'Bookings', false),
  ('calls.manage',              'Handle call-back requests',              'Support', false),
  ('support.manage',            'Answer support tickets',                 'Support', false),
  ('community.moderate',        'Moderate community posts and reports',   'Content', false),
  ('blog.write',                'Write and edit Journal drafts',          'Content', false),
  ('blog.publish',              'Publish and schedule Journal posts',     'Content', false),
  ('content.manage',            'Videos, resources and opportunities',    'Content', false),
  ('email.send',                'See email log and send test emails',     'Email', false),
  ('email.campaigns',           'Draft and send email campaigns',         'Email', false),
  ('portfolio.read',            'Open portfolio files and reviews',       'Portfolio', false),
  ('portfolio.assign',          'Assign portfolio reviews to mentors',    'Portfolio', false),
  ('finance.read',              'See orders, payments and ledger',        'Finance', true),
  ('finance.refund',            'Approve refunds',                        'Finance', true),
  ('finance.payout.prepare',    'Prepare mentor payouts',                 'Finance', true),
  ('finance.payout.approve',    'Approve and mark payouts paid',          'Finance', true),
  ('finance.adjust',            'Request and approve ledger adjustments', 'Finance', true),
  ('commission.manage',         'Change commission rules',                'Finance', true),
  ('analytics.read',            'See analytics',                          'Insights', false),
  ('audit.read',                'See the audit log',                      'Insights', true),
  ('settings.manage',           'Change site settings',                   'Admin', true),
  ('staff.invite',              'Invite and suspend staff',               'Admin', true),
  ('staff.permissions.manage',  'Change staff roles and permissions',     'Admin', true)
on conflict (key) do update set label = excluded.label, area = excluded.area, sensitive = excluded.sensitive;

insert into public.roles (key, label, description) values
  ('call_manager',          'Call manager',          'Calls back people who asked for a call and keeps notes.'),
  ('support',               'Support',               'Answers support tickets and helps with bookings.'),
  ('email_operator',        'Email operator',        'Drafts email campaigns and watches delivery.'),
  ('blog_editor',           'Journal editor',        'Edits, publishes and schedules Journal posts.'),
  ('content_manager',       'Content manager',       'Videos, resources, opportunities and community moderation.'),
  ('booking_coordinator',   'Booking coordinator',   'Looks after bookings and live sessions.'),
  ('finance_operator',      'Finance operator',      'Orders, refunds and payout preparation.'),
  ('portfolio_coordinator', 'Portfolio coordinator', 'Assigns portfolio reviews to mentors.'),
  ('analyst',               'Analyst',               'Read-only analytics.')
on conflict (key) do update set label = excluded.label, description = excluded.description;

insert into public.role_permissions (role_key, permission) values
  ('call_manager', 'calls.manage'), ('call_manager', 'users.read'),
  ('support', 'support.manage'), ('support', 'users.read'), ('support', 'bookings.read'), ('support', 'calls.manage'),
  ('email_operator', 'email.send'), ('email_operator', 'email.campaigns'),
  ('blog_editor', 'blog.write'), ('blog_editor', 'blog.publish'),
  ('content_manager', 'content.manage'), ('content_manager', 'community.moderate'), ('content_manager', 'blog.write'),
  ('booking_coordinator', 'bookings.read'), ('booking_coordinator', 'bookings.manage'), ('booking_coordinator', 'events.manage'), ('booking_coordinator', 'users.read'),
  ('finance_operator', 'finance.read'), ('finance_operator', 'finance.refund'), ('finance_operator', 'finance.payout.prepare'), ('finance_operator', 'bookings.read'),
  ('portfolio_coordinator', 'portfolio.read'), ('portfolio_coordinator', 'portfolio.assign'), ('portfolio_coordinator', 'users.read'),
  ('analyst', 'analytics.read')
on conflict do nothing;

-- MFA: once someone has a verified second factor, their session must be "aal2".
-- When required = true (sensitive permissions), aal2 is always needed.
create or replace function private.mfa_ok(required boolean)
returns boolean language plpgsql stable security definer set search_path = public, auth as $$
declare aal text;
begin
  begin aal := coalesce(auth.jwt() ->> 'aal', 'aal1'); exception when others then aal := 'aal1'; end;
  if aal = 'aal2' then return true; end if;
  if required then return false; end if;
  begin
    return not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
  exception when others then return true;
  end;
end;
$$;

create or replace function public.is_main_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and private.mfa_ok(false);
$$;
grant execute on function public.is_main_admin() to authenticated;

-- The single permission check used everywhere.
create or replace function public.has_perm(p text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); ok boolean; sens boolean;
begin
  if uid is null then return false; end if;
  select sensitive into sens from public.permissions where key = p;
  if sens is null then return false; end if;                                -- unknown permission: fail closed
  if exists (select 1 from public.profiles where id = uid and role = 'admin') then return private.mfa_ok(false); end if;
  if p in ('staff.invite', 'staff.permissions.manage', 'settings.manage') then return false; end if;   -- main admin only
  if not exists (select 1 from public.staff_members where user_id = uid and status = 'active') then return false; end if;
  if exists (select 1 from public.staff_permission_overrides where user_id = uid and permission = p and not allow) then return false; end if;
  ok := exists (select 1 from public.staff_permission_overrides where user_id = uid and permission = p and allow)
     or exists (select 1 from public.staff_role_assignments a join public.role_permissions rp on rp.role_key = a.role_key
                where a.user_id = uid and rp.permission = p);
  if not ok then return false; end if;
  return private.mfa_ok(sens);
end;
$$;
grant execute on function public.has_perm(text) to anon, authenticated;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.staff_members where user_id = auth.uid() and status = 'active');
$$;
grant execute on function public.is_staff() to anon, authenticated;

-- What the signed-in person may do (for the staff workspace menu)
create or replace function public.my_permissions()
returns table (permission text, needs_mfa boolean)
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); adm boolean;
begin
  if uid is null then return; end if;
  adm := exists (select 1 from public.profiles where id = uid and role = 'admin');
  if not adm and not exists (select 1 from public.staff_members where user_id = uid and status = 'active') then return; end if;
  return query
    select pm.key, not public.has_perm(pm.key)
    from public.permissions pm
    where adm
       or (pm.key not in ('staff.invite', 'staff.permissions.manage', 'settings.manage')
           and not exists (select 1 from public.staff_permission_overrides o where o.user_id = uid and o.permission = pm.key and not o.allow)
           and (exists (select 1 from public.staff_permission_overrides o where o.user_id = uid and o.permission = pm.key and o.allow)
                or exists (select 1 from public.staff_role_assignments a join public.role_permissions rp on rp.role_key = a.role_key
                           where a.user_id = uid and rp.permission = pm.key)));
end;
$$;
grant execute on function public.my_permissions() to authenticated;

-- =====================================================================
-- 16. Audit log (append-only) and notifications
-- =====================================================================

create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  actor_email text default '',
  action      text not null,
  entity      text not null default '',
  entity_id   text default '',
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_created on public.audit_logs (created_at desc);

create or replace function private.audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, details)
  values (auth.uid(), coalesce((select email from public.profiles where id = auth.uid()), case when auth.uid() is null then 'system' else '' end),
          p_action, p_entity, coalesce(p_entity_id, ''), coalesce(p_details, '{}'::jsonb));
end;
$$;

create or replace function private.no_change()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;
drop trigger if exists audit_logs_append_only on public.audit_logs;
create trigger audit_logs_append_only before update or delete on public.audit_logs for each row execute function private.no_change();

-- Row-change auditing for sensitive tables
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb; idv text;
begin
  if tg_op = 'DELETE' then d := to_jsonb(old); elsif tg_op = 'INSERT' then d := to_jsonb(new);
  else
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value)) into d
    from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o on o.key = n.key
    where n.value is distinct from o.value and n.key not in ('updated_at', 'views', 'answers_count', 'helpful_total', 'helpful');
    if d is null then return new; end if;
  end if;
  idv := coalesce(d ->> 'id', d ->> 'user_id', d ->> 'key', '');
  if tg_op = 'UPDATE' then idv := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'user_id', to_jsonb(new) ->> 'key', ''); end if;
  -- never copy long bodies or secrets into the audit log
  d := d - 'body' - 'html' - 'bio';
  perform private.audit(lower(tg_op), tg_table_name, idv, d);
  return coalesce(new, old);
end;
$$;

-- Client-side events worth recording (sign-in to the staff area, exports, MFA)
create or replace function public.log_event(p_action text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_action not in ('staff.sign_in', 'staff.sign_out', 'export', 'mfa.enrolled', 'mfa.removed', 'file.opened') then raise exception 'Unknown event'; end if;
  perform private.audit(p_action, 'client', '', coalesce(p_details, '{}'::jsonb) - 'password');
end;
$$;
grant execute on function public.log_event(text, jsonb) to authenticated;

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  body       text not null default '',
  link       text not null default '',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);

create or replace function private.notify(p_user uuid, p_title text, p_body text default '', p_link text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, title, body, link) values (p_user, left(p_title, 200), left(coalesce(p_body, ''), 500), coalesce(p_link, ''));
exception when others then null;   -- notifications never block the real action
end;
$$;

-- Tell every active staff member who holds a permission
create or replace function private.notify_perm(p_perm text, p_title text, p_body text default '', p_link text default '')
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select id from public.profiles where role = 'admin'
    union
    select s.user_id from public.staff_members s
    where s.status = 'active'
      and not exists (select 1 from public.staff_permission_overrides o where o.user_id = s.user_id and o.permission = p_perm and not o.allow)
      and (exists (select 1 from public.staff_permission_overrides o where o.user_id = s.user_id and o.permission = p_perm and o.allow)
        or exists (select 1 from public.staff_role_assignments a join public.role_permissions rp on rp.role_key = a.role_key
                   where a.user_id = s.user_id and rp.permission = p_perm))
  loop
    perform private.notify(r.id, p_title, p_body, p_link);
  end loop;
end;
$$;

create or replace function public.mark_notifications_read(ids bigint[] default null)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (ids is null or id = any (ids));
$$;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;

-- =====================================================================
-- 17. Staff management (only the main admin)
-- =====================================================================

create or replace function public.staff_invite(p_email text, p_name text, p_roles text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare iid uuid; em text := lower(trim(p_email)); r text;
begin
  if not public.has_perm('staff.invite') then raise exception 'Only the main admin can invite staff'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  foreach r in array coalesce(p_roles, '{}') loop
    if not exists (select 1 from public.roles where key = r) then raise exception 'Unknown role %', r; end if;
  end loop;
  update public.staff_invites set revoked_at = now() where lower(email) = em and accepted_at is null and revoked_at is null;
  insert into public.staff_invites (email, full_name, role_keys, invited_by) values (em, coalesce(p_name, ''), coalesce(p_roles, '{}'), auth.uid())
  returning id into iid;
  perform private.audit('staff.invite', 'staff_invites', iid::text, jsonb_build_object('email', em, 'roles', p_roles));
  perform private.send_email(em, p_name, 'You have been invited to the ' || (private.settings()).site_name || ' team',
    private.layout('You are invited to the staff workspace',
      '<p>Hello' || coalesce(' ' || nullif(private.esc(p_name), ''), '') || ',</p><p>You have been invited to help run ' || private.esc((private.settings()).site_name)
      || '. Sign in (or create an account) with <b>' || private.esc(em) || '</b> on the staff page to accept. The invitation is valid for 14 days.</p>'
      || '<p>You start with only the access your role needs. Finance and admin areas also need two-step sign-in.</p>',
      'Open the staff workspace', private.link('/staff/login')), 'staff-invite');
  return iid;
end;
$$;
grant execute on function public.staff_invite(text, text, text[]) to authenticated;

create or replace function public.staff_accept_invite()
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); em text; inv public.staff_invites; r text;
begin
  if uid is null then return false; end if;
  select lower(email) into em from auth.users where id = uid and email_confirmed_at is not null;
  if em is null then return false; end if;
  select * into inv from public.staff_invites
   where lower(email) = em and accepted_at is null and revoked_at is null and expires_at > now()
   order by created_at desc limit 1;
  if inv.id is null then return exists (select 1 from public.staff_members where user_id = uid and status = 'active'); end if;
  insert into public.staff_members (user_id, email, full_name, invited_by)
  values (uid, em, coalesce(nullif(inv.full_name, ''), (select full_name from public.profiles where id = uid), ''), inv.invited_by)
  on conflict (user_id) do update set status = 'active', suspended_at = null;
  foreach r in array inv.role_keys loop
    insert into public.staff_role_assignments (user_id, role_key, assigned_by) values (uid, r, inv.invited_by) on conflict do nothing;
  end loop;
  update public.staff_invites set accepted_at = now() where id = inv.id;
  -- staff accounts are staff; an admin stays admin
  perform set_config('archmentor.internal', '1', true);
  update public.profiles set role = 'staff' where id = uid and role <> 'admin';
  perform set_config('archmentor.internal', '', true);
  perform private.audit('staff.accept', 'staff_members', uid::text, jsonb_build_object('roles', inv.role_keys));
  return true;
end;
$$;
grant execute on function public.staff_accept_invite() to authenticated;

create or replace function public.staff_set_roles(p_user uuid, p_roles text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('staff.permissions.manage') then raise exception 'Only the main admin can change staff roles'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own access'; end if;
  delete from public.staff_role_assignments where user_id = p_user and role_key <> all (coalesce(p_roles, '{}'));
  insert into public.staff_role_assignments (user_id, role_key, assigned_by)
  select p_user, r, auth.uid() from unnest(coalesce(p_roles, '{}')) r on conflict do nothing;
  perform private.audit('staff.roles', 'staff_members', p_user::text, jsonb_build_object('roles', p_roles));
end;
$$;
grant execute on function public.staff_set_roles(uuid, text[]) to authenticated;

create or replace function public.staff_set_override(p_user uuid, p_perm text, p_allow boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('staff.permissions.manage') then raise exception 'Only the main admin can change permissions'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own access'; end if;
  if p_perm in ('staff.invite', 'staff.permissions.manage', 'settings.manage') then raise exception 'This permission belongs to the main admin only'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason'; end if;
  if p_allow is null then
    delete from public.staff_permission_overrides where user_id = p_user and permission = p_perm;
  else
    insert into public.staff_permission_overrides (user_id, permission, allow, reason, actor) values (p_user, p_perm, p_allow, p_reason, auth.uid())
    on conflict (user_id, permission) do update set allow = excluded.allow, reason = excluded.reason, actor = excluded.actor, created_at = now();
  end if;
  perform private.audit('staff.override', 'staff_members', p_user::text, jsonb_build_object('permission', p_perm, 'allow', p_allow, 'reason', p_reason));
end;
$$;
grant execute on function public.staff_set_override(uuid, text, boolean, text) to authenticated;

create or replace function public.staff_set_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.has_perm('staff.invite') then raise exception 'Only the main admin can suspend staff'; end if;
  if p_user = auth.uid() then raise exception 'You cannot suspend yourself'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'Unknown status'; end if;
  update public.staff_members set status = p_status, suspended_at = case when p_status = 'suspended' then now() end where user_id = p_user;
  if p_status = 'suspended' then
    begin delete from auth.sessions where user_id = p_user; exception when others then null; end;   -- signs them out everywhere
  end if;
  perform private.audit('staff.' || p_status, 'staff_members', p_user::text, '{}'::jsonb);
end;
$$;
grant execute on function public.staff_set_status(uuid, text) to authenticated;

create or replace function public.staff_revoke_invite(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('staff.invite') then raise exception 'Only the main admin can revoke invites'; end if;
  update public.staff_invites set revoked_at = now() where id = p_id and accepted_at is null;
  perform private.audit('staff.invite_revoked', 'staff_invites', p_id::text, '{}'::jsonb);
end;
$$;
grant execute on function public.staff_revoke_invite(uuid) to authenticated;

-- Profile guard v2: role changes only by the main admin; approval also by mentors.approve
create or replace function public.guard_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_setting('archmentor.internal', true) = '1' then return new; end if;
  if not public.is_admin() then
    new.role := old.role;
    new.email := old.email;
    new.email_token := old.email_token;
    if not public.has_perm('mentors.approve') then new.approved := old.approved; end if;
  end if;
  if new.role is distinct from old.role or new.approved is distinct from old.approved then
    perform private.audit('profile.access', 'profiles', new.id::text,
      jsonb_build_object('role', jsonb_build_object('from', old.role, 'to', new.role), 'approved', jsonb_build_object('from', old.approved, 'to', new.approved)));
  end if;
  return new;
end;
$$;

-- =====================================================================
-- 18. Mentor availability, slots and rescheduling
-- =====================================================================

create table if not exists public.mentor_availability (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null references public.profiles (id) on delete cascade,
  weekday      int not null check (weekday between 0 and 6),        -- 0 = Sunday, India time
  start_time   time not null,
  end_time     time not null,
  slot_minutes int not null default 60 check (slot_minutes between 15 and 240),
  created_at   timestamptz not null default now(),
  check (end_time > start_time)
);
create table if not exists public.mentor_time_off (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references public.profiles (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  note       text not null default '',
  check (ends_at > starts_at)
);

-- Busy times for a mentor (no names, just times) so the booking page can grey out taken slots
create or replace function public.mentor_busy(p_mentor uuid, p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.start_at, coalesce(r.end_at, r.start_at + make_interval(mins => coalesce(r.duration_min, 60)))
    from public.requests r
   where r.mentor_id = p_mentor and r.start_at is not null and r.start_at < p_to and r.start_at >= p_from - interval '1 day'
     and r.status in ('pending', 'awaiting_payment', 'confirmed', 'approved')
  union all
  select t.starts_at, t.ends_at from public.mentor_time_off t where t.mentor_id = p_mentor and t.starts_at < p_to and t.ends_at > p_from;
$$;
grant execute on function public.mentor_busy(uuid, timestamptz, timestamptz) to anon, authenticated;

create or replace function private.slot_ok(p_mentor uuid, p_start timestamptz, p_minutes int)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare loc timestamp := p_start at time zone 'Asia/Kolkata'; has_rules boolean;
begin
  if p_start <= now() + interval '2 hours' then return false; end if;
  select exists (select 1 from public.mentor_availability where mentor_id = p_mentor) into has_rules;
  if not has_rules then return false; end if;
  if not exists (
    select 1 from public.mentor_availability a
     where a.mentor_id = p_mentor and a.weekday = extract(dow from loc)::int
       and loc::time >= a.start_time and (loc::time + make_interval(mins => p_minutes)) <= a.end_time
       and (extract(epoch from (loc::time - a.start_time))::int / 60) % a.slot_minutes = 0) then
    return false;
  end if;
  if exists (select 1 from public.mentor_time_off t where t.mentor_id = p_mentor and t.starts_at < p_start + make_interval(mins => p_minutes) and t.ends_at > p_start) then
    return false;
  end if;
  return true;
end;
$$;

-- =====================================================================
-- 19. Bookings v2: snapshot price/Calendly, slots, payment states
-- =====================================================================

create or replace function public.guard_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare sv public.services; s public.site_settings := private.settings(); paid boolean; mins int;
begin
  if tg_op = 'INSERT' then
    select full_name, email into new.student_name, new.student_email from public.profiles where id = new.student_id;
    select full_name into new.mentor_name from public.profiles where id = new.mentor_id;
    if new.service_id is not null then
      select * into sv from public.services where id = new.service_id;
      if sv.id is null or sv.mentor_id <> new.mentor_id or not sv.active then raise exception 'This service is not available'; end if;
      new.service := sv.category; new.service_title := sv.title; new.duration_min := sv.duration_min;
      new.price_paise := coalesce(nullif(sv.price_paise, 0), sv.price_inr * 100); new.price_inr := new.price_paise / 100;
      new.service_type := coalesce(nullif(sv.service_type, ''), 'consultation');
    else
      new.price_paise := 0; new.price_inr := 0;
    end if;
    if new.start_at is not null then
      mins := coalesce(new.duration_min, 60);
      if not private.slot_ok(new.mentor_id, new.start_at, mins) then raise exception 'That time is not available. Please pick another slot.'; end if;
      new.end_at := new.start_at + make_interval(mins => mins);
    else
      new.end_at := null;
    end if;
    paid := new.price_paise > 0 and s.payments_mode <> 'off';
    new.status := case when paid and sv.id is not null and not sv.requires_approval then 'awaiting_payment' else 'pending' end;
    new.meeting_link := ''; new.mentor_note := ''; new.calendly_url := ''; new.order_id := null; new.updated_at := now();
    return new;
  end if;

  new.updated_at := now();
  if current_setting('archmentor.internal', true) = '1' then return new; end if;   -- payment and system updates
  paid := old.price_paise > 0 and s.payments_mode <> 'off';
  -- money fields can never be edited from the website
  new.price_paise := old.price_paise; new.price_inr := old.price_inr; new.order_id := old.order_id; new.service_type := old.service_type;
  if new.status in ('confirmed', 'refunded') and new.status is distinct from old.status then
    raise exception 'This status is set by the payment system';
  end if;

  if auth.uid() is null or public.is_admin() or public.has_perm('bookings.manage') then
    if new.status = 'approved' and paid and old.status = 'pending' then new.status := 'awaiting_payment'; end if;
    if new.status in ('approved', 'awaiting_payment') and old.status = 'pending' then
      new.calendly_url := coalesce((select calendly_url from public.profiles where id = old.mentor_id), '');
    end if;
    if auth.uid() is not null and new.status is distinct from old.status then
      perform private.audit('booking.status', 'requests', old.id::text, jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    return new;
  end if;

  if auth.uid() = old.mentor_id then
    new.student_id := old.student_id; new.mentor_id := old.mentor_id; new.service_id := old.service_id;
    new.student_name := old.student_name; new.student_email := old.student_email; new.mentor_name := old.mentor_name;
    new.service := old.service; new.service_title := old.service_title; new.duration_min := old.duration_min;
    new.stage := old.stage; new.message := old.message; new.preferred_time := old.preferred_time;
    new.start_at := old.start_at; new.end_at := old.end_at;
    if new.status is distinct from old.status then
      if not ((old.status = 'pending' and new.status in ('approved', 'declined'))
           or (old.status in ('approved', 'confirmed') and new.status in ('done', 'cancelled'))
           or (old.status = 'awaiting_payment' and new.status = 'cancelled')) then
        raise exception 'You cannot move this booking from % to %', old.status, new.status;
      end if;
    end if;
    if new.status = 'approved' and old.status = 'pending' then
      if paid then new.status := 'awaiting_payment'; end if;
      new.calendly_url := coalesce((select calendly_url from public.profiles where id = old.mentor_id), '');
    else
      new.calendly_url := old.calendly_url;
    end if;
    return new;
  end if;

  if auth.uid() = old.student_id then
    if new.status <> 'cancelled' or old.status not in ('pending', 'approved', 'awaiting_payment', 'confirmed') then
      raise exception 'You can only cancel an open booking';
    end if;
    new := old; new.status := 'cancelled'; new.updated_at := now();
    return new;
  end if;
  raise exception 'Not allowed';
end;
$$;

-- Emails + in-app notifications for the new booking states
create or replace function private.on_request_event2()
returns trigger language plpgsql security definer set search_path = public as $$
declare m public.profiles; what text; when_txt text; ord record;
begin
  what := coalesce(nullif(new.service_title, ''), new.service, 'Mentorship session');
  when_txt := coalesce(' on ' || private.fmt_time(new.start_at), '');
  select * into m from public.profiles where id = new.mentor_id;
  if tg_op = 'INSERT' then
    perform private.notify(new.mentor_id, 'New request from ' || new.student_name, what || when_txt, '/dashboard?tab=requests');
    perform private.notify(new.student_id, 'Request sent to ' || m.full_name, what || when_txt, '/dashboard?tab=requests');
    if new.status = 'awaiting_payment' then
      perform private.send_email(new.student_email, new.student_name, 'Complete payment to confirm your session',
        private.layout('One step left: payment',
          '<p>Hello ' || private.esc(new.student_name) || ',</p><p>Your slot for <b>' || private.esc(what) || '</b> with ' || private.esc(m.full_name) || private.esc(when_txt)
          || ' is held for ' || (private.settings()).slot_hold_minutes || ' minutes. Pay from your dashboard to confirm it.</p>',
          'Pay and confirm', private.link('/dashboard?tab=requests')), 'booking-pay');
    end if;
    return new;
  end if;
  if new.status is not distinct from old.status and new.start_at is not distinct from old.start_at then return new; end if;

  if new.start_at is distinct from old.start_at and new.status = old.status then
    perform private.notify(new.mentor_id, 'Booking rescheduled', what || when_txt, '/dashboard?tab=requests');
    perform private.notify(new.student_id, 'Booking rescheduled', what || when_txt, '/dashboard?tab=requests');
    perform private.send_email(m.email, m.full_name, 'Rescheduled: ' || what, private.layout('A booking was rescheduled',
      '<p>' || private.esc(new.student_name) || '’s booking for <b>' || private.esc(what) || '</b> is now' || private.esc(when_txt) || '.</p>', 'Open your dashboard', private.link('/dashboard')), 'booking-rescheduled');
    perform private.send_email(new.student_email, new.student_name, 'Rescheduled: ' || what, private.layout('Your booking was rescheduled',
      '<p>Your booking for <b>' || private.esc(what) || '</b> with ' || private.esc(m.full_name) || ' is now' || private.esc(when_txt) || '.</p>', 'Open your dashboard', private.link('/dashboard')), 'booking-rescheduled');
    return new;
  end if;

  perform private.notify(new.student_id, 'Booking ' || replace(new.status, '_', ' '), what || ' with ' || m.full_name, '/dashboard?tab=requests');
  if new.status in ('cancelled', 'confirmed', 'refunded') then
    perform private.notify(new.mentor_id, 'Booking ' || replace(new.status, '_', ' '), what || ' with ' || new.student_name, '/dashboard?tab=requests');
  end if;

  if new.status = 'awaiting_payment' and old.status = 'pending' then
    perform private.send_email(new.student_email, new.student_name, 'Approved — complete payment for your session with ' || m.full_name,
      private.layout('Your request was approved',
        '<p>Hello ' || private.esc(new.student_name) || ',</p><p>' || private.esc(m.full_name) || ' accepted your request for <b>' || private.esc(what) || '</b>' || private.esc(when_txt) || '.</p>'
        || '<p>Pay securely from your dashboard to confirm the session. Amount: <b>₹' || to_char(new.price_paise / 100.0, 'FM999,999,990.00') || '</b> plus any fees shown at checkout.</p>'
        || case when new.mentor_note <> '' then '<p style="padding:12px 16px;background:#f4f4f2;">' || private.para(new.mentor_note) || '</p>' else '' end,
        'Pay and confirm', private.link('/dashboard?tab=requests')), 'booking-approved-pay');
  elsif new.status = 'confirmed' and old.status <> 'confirmed' then
    perform private.send_email(new.student_email, new.student_name, 'Confirmed: your session with ' || m.full_name,
      private.layout('Payment received — session confirmed',
        '<p>Hello ' || private.esc(new.student_name) || ',</p><p>We received your payment. Your session <b>' || private.esc(what) || '</b> with ' || private.esc(m.full_name) || private.esc(when_txt) || ' is confirmed.</p>'
        || case when new.calendly_url <> '' and new.start_at is null then '<p>Next step: choose a time on the mentor''s calendar.</p>' else '' end
        || case when new.meeting_link <> '' then '<p>Meeting link: <a href="' || private.esc(new.meeting_link) || '">' || private.esc(new.meeting_link) || '</a></p>' else '<p>The mentor will add the meeting link before the session.</p>' end,
        case when new.calendly_url <> '' and new.start_at is null then 'Pick a time' else 'Open your dashboard' end,
        case when new.calendly_url <> '' and new.start_at is null then new.calendly_url else private.link('/dashboard?tab=requests') end), 'booking-confirmed');
    perform private.send_email(m.email, m.full_name, 'Confirmed and paid: ' || new.student_name,
      private.layout('A paid booking is confirmed',
        '<p><b>' || private.esc(new.student_name) || '</b> has paid for <b>' || private.esc(what) || '</b>' || private.esc(when_txt) || '.</p><p>Add the meeting link from your dashboard. Your earnings appear under Earnings once the session is marked done.</p>',
        'Open your dashboard', private.link('/dashboard?tab=requests')), 'booking-confirmed-mentor');
  elsif new.status = 'done' and old.status <> 'done' then
    update public.orders set completed_at = coalesce(completed_at, now()) where id = new.order_id;
  elsif new.status = 'cancelled' and old.status = 'confirmed' and new.order_id is not null then
    -- paid booking cancelled: open a refund request for finance (policy: full refund if cancelled in time)
    select * into ord from public.orders where id = new.order_id;
    if ord.status = 'paid' then
      insert into public.refund_requests (order_id, requested_by, amount_paise, reason, auto)
      values (ord.id, coalesce(auth.uid(), new.student_id),
              case when new.start_at is null or new.start_at > now() + make_interval(hours => (private.settings()).cancel_hours) then ord.amount_paise else 0 end,
              'Booking cancelled by ' || case when auth.uid() = new.mentor_id then 'mentor' when auth.uid() = new.student_id then 'student' else 'team' end, true)
      on conflict do nothing;
    end if;
  elsif new.status = 'cancelled' and old.status = 'awaiting_payment' then
    perform private.send_email(new.student_email, new.student_name, 'Your booking hold has ended',
      private.layout('Booking not confirmed', '<p>Your booking for <b>' || private.esc(what) || '</b> with ' || private.esc(m.full_name) || ' was released because payment was not completed. You can book again any time.</p>',
        'Book again', private.link('/mentors/' || new.mentor_id)), 'booking-expired');
  end if;
  return new;
end;
$$;

-- Student or mentor moves a booking to another free slot (before the cancellation window)
create or replace function public.reschedule_booking(p_id uuid, p_start timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare r public.requests; s public.site_settings := private.settings();
begin
  select * into r from public.requests where id = p_id;
  if r.id is null or auth.uid() not in (r.student_id, r.mentor_id) and not public.has_perm('bookings.manage') then raise exception 'Not allowed'; end if;
  if r.status not in ('pending', 'approved', 'awaiting_payment', 'confirmed') then raise exception 'This booking cannot be moved'; end if;
  if r.start_at is not null and r.start_at < now() + make_interval(hours => s.cancel_hours) and not public.has_perm('bookings.manage') then
    raise exception 'Bookings can be moved up to % hours before the start', s.cancel_hours;
  end if;
  if not private.slot_ok(r.mentor_id, p_start, coalesce(r.duration_min, 60)) then raise exception 'That time is not available'; end if;
  perform set_config('archmentor.internal', '1', true);
  update public.requests set start_at = p_start, end_at = p_start + make_interval(mins => coalesce(duration_min, 60)) where id = p_id;
  perform set_config('archmentor.internal', '', true);
  perform private.audit('booking.reschedule', 'requests', p_id::text, jsonb_build_object('from', r.start_at, 'to', p_start));
end;
$$;
grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated;

-- Release unpaid holds (runs every 10 minutes)
create or replace function private.expire_holds()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('archmentor.internal', '1', true);
  update public.requests set status = 'cancelled'
   where status = 'awaiting_payment'
     and ((start_at is not null and updated_at < now() - make_interval(mins => (private.settings()).slot_hold_minutes))
       or (start_at is null and updated_at < now() - interval '7 days'));
  update public.registrations set status = 'cancelled'
   where status = 'awaiting_payment' and created_at < now() - make_interval(mins => (private.settings()).slot_hold_minutes);
  update public.portfolio_projects set status = 'draft'
   where status = 'awaiting_payment' and updated_at < now() - interval '2 days';
  update public.orders set status = 'expired' where status = 'created' and created_at < now() - interval '2 days';
  perform set_config('archmentor.internal', '', true);
end;
$$;

-- Live sessions v2: paid events and price in emails
create or replace function private.session_block(s public.sessions)
returns text language sql stable security definer set search_path = public as $$
  select '<p style="padding:12px 16px;background:#f4f4f2;"><b>' || private.esc(s.title) || '</b><br>'
    || coalesce(private.fmt_time(s.starts_at), 'Date to be announced')
    || case when s.ends_at is not null then ' to ' || to_char(s.ends_at at time zone 'Asia/Kolkata', 'FMHH12:MI AM') else '' end
    || '<br>' || private.esc(coalesce(nullif(s.platform, ''), 'Online')) || ' · '
    || case when coalesce(s.price_paise, 0) > 0 then '₹' || to_char(s.price_paise / 100.0, 'FM999,999,990.##') else 'Free' end || '</p>';
$$;

create or replace function public.guard_registration()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap int; taken int; ok boolean; price int;
begin
  if tg_op = 'UPDATE' then
    if current_setting('archmentor.internal', true) = '1' or public.is_admin() or public.has_perm('events.manage') then return new; end if;
    if new.status = 'cancelled' and old.status in ('awaiting_payment', 'confirmed') and auth.uid() = old.user_id then
      new := old; new.status := 'cancelled'; return new;
    end if;
    raise exception 'Not allowed';
  end if;
  select capacity, published and (starts_at is null or starts_at > now()), price_paise into cap, ok, price from public.sessions where id = new.session_id;
  if not coalesce(ok, false) then raise exception 'Registration for this session is closed'; end if;
  if cap is not null then
    select count(*) into taken from public.registrations where session_id = new.session_id and status <> 'cancelled';
    if taken >= cap then raise exception 'Sorry, this session is full'; end if;
  end if;
  new.email := lower(trim(new.email));
  new.order_id := null;
  new.status := case when coalesce(price, 0) > 0 and (private.settings()).payments_mode <> 'off' then 'awaiting_payment' else 'confirmed' end;
  return new;
end;
$$;
drop trigger if exists guard_registration on public.registrations;
create trigger guard_registration before insert or update on public.registrations for each row execute function public.guard_registration();

create or replace function private.on_registration()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = new.session_id;
  if new.status <> 'confirmed' then
    if tg_op = 'INSERT' and new.status = 'awaiting_payment' then
      perform private.send_email(new.email, new.name, 'Complete payment to reserve your seat: ' || s.title,
        private.layout('One step left', '<p>Hello ' || private.esc(new.name) || ',</p><p>Your seat is held for ' || (private.settings()).slot_hold_minutes || ' minutes:</p>' || private.session_block(s)
          || '<p>Pay from your dashboard to confirm it.</p>', 'Pay and confirm', private.link('/dashboard?tab=sessions')), 'session-pay');
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' then return new; end if;
  perform private.notify(new.user_id, 'Seat reserved: ' || s.title, coalesce(private.fmt_time(s.starts_at), ''), '/dashboard?tab=sessions');
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
create trigger registration_event after insert or update of status on public.registrations for each row execute function private.on_registration();

create or replace function public.session_seat_count(sid uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.registrations where session_id = sid and status <> 'cancelled';
$$;

-- =====================================================================
-- 20. Finance: commission rules, orders, payments, ledger, refunds, payouts
--      All money is integer paise. Percentages are basis points (1% = 100).
-- =====================================================================

create table if not exists public.commission_rules (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null default '',
  service_type       text,                                  -- null = any type
  mentor_id          uuid references public.profiles (id) on delete cascade,   -- null = all mentors
  percentage_bps     int not null default 2000 check (percentage_bps between 0 and 10000),
  fixed_fee_paise    int not null default 0 check (fixed_fee_paise >= 0),
  min_fee_paise      int not null default 0 check (min_fee_paise >= 0),
  max_fee_paise      int check (max_fee_paise is null or max_fee_paise >= 0),
  gateway_fee_bearer text not null default 'platform' check (gateway_fee_bearer in ('platform', 'mentor', 'student')),
  fee_included       boolean not null default true,        -- true: fee comes out of the listed price; false: added on top for the student
  effective_from     timestamptz not null default now(),
  effective_to       timestamptz,
  reason             text not null default '',
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);

create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in ('booking', 'event', 'portfolio')),
  ref_id              uuid not null,
  buyer_id            uuid not null references public.profiles (id) on delete restrict,
  mentor_id           uuid references public.profiles (id) on delete set null,
  description         text not null default '',
  price_paise         bigint not null check (price_paise >= 0),          -- listed price
  amount_paise        bigint not null check (amount_paise >= 0),         -- what the student pays
  currency            text not null default 'INR',
  platform_fee_paise  bigint not null default 0,
  gateway_est_paise   bigint not null default 0,
  mentor_net_paise    bigint not null default 0,
  commission_snapshot jsonb not null default '{}'::jsonb,                -- the rule as it was when the order was made
  status              text not null default 'created' check (status in ('created', 'paid', 'failed', 'review', 'refunded', 'partially_refunded', 'expired', 'cancelled')),
  mode                text not null default 'test' check (mode in ('test', 'live')),
  provider            text not null default 'razorpay',
  provider_order_id   text unique,
  provider_payment_id text,
  refunded_paise      bigint not null default 0,
  mentor_reversed_paise bigint not null default 0,
  paid_at             timestamptz,
  completed_at        timestamptz,                                       -- service delivered → payout clock starts
  payout_status       text not null default 'none' check (payout_status in ('none', 'in_payout', 'paid')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists orders_ref on public.orders (kind, ref_id);
create index if not exists orders_mentor on public.orders (mentor_id, status);

create table if not exists public.payment_transactions (
  id                  bigint generated always as identity primary key,
  event_id            text not null unique,                 -- idempotency key (webhook event id or "verify:<payment id>")
  order_id            uuid references public.orders (id) on delete set null,
  provider_order_id   text,
  provider_payment_id text,
  kind                text not null,                        -- captured, failed, refund.processed, refund.failed, dispute
  amount_paise        bigint,
  currency            text,
  result              text not null default '',
  payload             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create table if not exists public.financial_ledger (
  id           bigint generated always as identity primary key,
  order_id     uuid references public.orders (id) on delete restrict,
  mentor_id    uuid references public.profiles (id) on delete restrict,
  entry_type   text not null check (entry_type in ('payment_received', 'platform_fee', 'mentor_payable', 'gateway_fee',
                 'refund', 'platform_fee_reversal', 'mentor_payable_reversal', 'adjustment', 'payout')),
  amount_paise bigint not null,
  currency     text not null default 'INR',
  reference    text not null default '',
  note         text not null default '',
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists ledger_mentor on public.financial_ledger (mentor_id, created_at);
drop trigger if exists ledger_append_only on public.financial_ledger;
create trigger ledger_append_only before update or delete on public.financial_ledger for each row execute function private.no_change();

create table if not exists public.refund_requests (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete restrict,
  requested_by       uuid references public.profiles (id) on delete set null,
  amount_paise       bigint not null default 0 check (amount_paise >= 0),
  reason             text not null default '',
  auto               boolean not null default false,
  status             text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'processing', 'refunded', 'failed')),
  decided_by         uuid references public.profiles (id) on delete set null,
  decided_at         timestamptz,
  decision_note      text not null default '',
  provider_refund_id text,
  created_at         timestamptz not null default now()
);
create unique index if not exists refund_one_open on public.refund_requests (order_id) where status in ('requested', 'approved', 'processing');

create table if not exists public.mentor_finance (
  mentor_id           uuid primary key references public.profiles (id) on delete cascade,
  payout_method       text not null default '' check (payout_method in ('', 'bank', 'upi', 'razorpay_route')),
  payout_display      text not null default '',   -- e.g. "HDFC ••1234" or "name@upi" — never full account numbers
  provider_account_id text not null default '',   -- Razorpay Route linked account (acc_…), once approved
  kyc_status          text not null default 'not_started' check (kyc_status in ('not_started', 'submitted', 'verified', 'rejected')),
  pan_last4           text not null default '' check (pan_last4 ~ '^[A-Z0-9]{0,4}$'),
  updated_at          timestamptz not null default now()
);

create table if not exists public.mentor_payouts (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null references public.profiles (id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  status       text not null default 'prepared' check (status in ('prepared', 'approved', 'paid', 'cancelled')),
  prepared_by  uuid references public.profiles (id) on delete set null,
  approved_by  uuid references public.profiles (id) on delete set null,
  approved_at  timestamptz,
  paid_at      timestamptz,
  reference    text not null default '',          -- bank / UPI / provider transfer reference
  note         text not null default '',
  created_at   timestamptz not null default now()
);
create table if not exists public.payout_items (
  payout_id    uuid not null references public.mentor_payouts (id) on delete cascade,
  order_id     uuid references public.orders (id) on delete restrict,
  adjustment_id uuid,
  amount_paise bigint not null,
  primary key (payout_id, order_id)
);

create table if not exists public.ledger_adjustments (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null references public.profiles (id) on delete restrict,
  order_id     uuid references public.orders (id) on delete restrict,
  amount_paise bigint not null check (amount_paise <> 0),     -- + owed to mentor, − owed by mentor
  reason       text not null check (char_length(reason) >= 5),
  status       text not null default 'requested' check (status in ('requested', 'approved', 'rejected')),
  requested_by uuid references public.profiles (id) on delete set null,
  decided_by   uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- The one commission formula (documented in README → Money)
create or replace function private.calc_commission(p_price bigint, p_type text, p_mentor uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.site_settings := private.settings();
  r public.commission_rules;
  bps int; fixed bigint; mn bigint; mx bigint; bearer text; incl boolean;
  fee bigint; base bigint; gw bigint; total bigint; net bigint;
begin
  select * into r from public.commission_rules c
   where c.effective_from <= now() and (c.effective_to is null or c.effective_to > now())
     and (c.mentor_id is null or c.mentor_id = p_mentor)
     and (c.service_type is null or c.service_type = p_type)
   order by (c.mentor_id is not null) desc, (c.service_type is not null) desc, c.effective_from desc
   limit 1;
  bps := coalesce(r.percentage_bps, s.default_commission_bps);
  fixed := coalesce(r.fixed_fee_paise, 0); mn := coalesce(r.min_fee_paise, 0); mx := r.max_fee_paise;
  bearer := coalesce(r.gateway_fee_bearer, 'platform'); incl := coalesce(r.fee_included, true);
  fee := round(p_price * bps / 10000.0) + fixed;
  fee := greatest(fee, mn);
  if mx is not null then fee := least(fee, mx); end if;
  if incl then fee := least(fee, p_price); end if;
  if p_price = 0 then fee := 0; end if;
  base := p_price + case when incl then 0 else fee end;
  gw := round(base * s.gateway_fee_bps / 10000.0 * (1 + s.gst_bps / 10000.0));
  if p_price = 0 then gw := 0; end if;
  total := base + case when bearer = 'student' then gw else 0 end;
  net := (case when incl then p_price - fee else p_price end) - case when bearer = 'mentor' then gw else 0 end;
  return jsonb_build_object(
    'rule_id', r.id, 'rule_name', coalesce(r.name, 'Default'), 'percentage_bps', bps, 'fixed_fee_paise', fixed,
    'min_fee_paise', mn, 'max_fee_paise', mx, 'gateway_fee_bearer', bearer, 'fee_included', incl,
    'gateway_fee_bps', s.gateway_fee_bps, 'gst_bps', s.gst_bps,
    'price_paise', p_price, 'platform_fee_paise', fee, 'gateway_est_paise', gw,
    'customer_total_paise', total, 'mentor_net_paise', greatest(net, 0),
    'platform_net_paise', total - greatest(net, 0) - gw,
    'computed_at', now());
end;
$$;

create or replace function public.preview_commission(p_price_paise bigint, p_type text default 'consultation', p_mentor uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_price_paise < 0 or p_price_paise > 100000000 then raise exception 'Price out of range'; end if;
  if not (public.has_perm('commission.manage') or public.has_perm('finance.read') or auth.uid() = p_mentor
          or (p_mentor is null and public.is_approved_mentor())) then
    raise exception 'Not allowed';
  end if;
  return private.calc_commission(p_price_paise, p_type, coalesce(p_mentor, auth.uid()));
end;
$$;
grant execute on function public.preview_commission(bigint, text, uuid) to authenticated;

-- Commission rules are versioned: saving ends the old rule and starts a new one
create or replace function public.save_commission_rule(r jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare nid uuid; old_id uuid := nullif(r ->> 'replaces', '')::uuid;
begin
  if not public.has_perm('commission.manage') then raise exception 'Not allowed'; end if;
  if coalesce(trim(r ->> 'reason'), '') = '' then raise exception 'Give a reason for the change'; end if;
  if old_id is not null then update public.commission_rules set effective_to = now() where id = old_id and (effective_to is null or effective_to > now()); end if;
  insert into public.commission_rules (name, service_type, mentor_id, percentage_bps, fixed_fee_paise, min_fee_paise, max_fee_paise,
                                       gateway_fee_bearer, fee_included, effective_from, reason, created_by)
  values (coalesce(r ->> 'name', ''), nullif(r ->> 'service_type', ''), nullif(r ->> 'mentor_id', '')::uuid,
          (r ->> 'percentage_bps')::int, coalesce((r ->> 'fixed_fee_paise')::int, 0), coalesce((r ->> 'min_fee_paise')::int, 0),
          nullif(r ->> 'max_fee_paise', '')::int, coalesce(r ->> 'gateway_fee_bearer', 'platform'), coalesce((r ->> 'fee_included')::boolean, true),
          greatest(coalesce(nullif(r ->> 'effective_from', '')::timestamptz, now()), now()), r ->> 'reason', auth.uid())
  returning id into nid;
  return nid;
end;
$$;
grant execute on function public.save_commission_rule(jsonb) to authenticated;

create or replace function public.end_commission_rule(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('commission.manage') then raise exception 'Not allowed'; end if;
  update public.commission_rules set effective_to = now(), reason = reason || ' · ended: ' || coalesce(p_reason, '') where id = p_id;
end;
$$;
grant execute on function public.end_commission_rule(uuid, text) to authenticated;

-- Student creates an order for something they are allowed to pay for. Prices come from the database only.
create or replace function public.create_order(p_kind text, p_ref uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.site_settings := private.settings();
  uid uuid := auth.uid(); price bigint; stype text; mentor uuid; descr text; snap jsonb; o public.orders;
begin
  if uid is null then raise exception 'Please sign in'; end if;
  if s.payments_mode = 'off' then raise exception 'Online payments are not switched on yet'; end if;
  if p_kind = 'booking' then
    select r.price_paise, r.service_type, r.mentor_id, coalesce(nullif(r.service_title, ''), r.service) || ' with ' || r.mentor_name
      into price, stype, mentor, descr
      from public.requests r where r.id = p_ref and r.student_id = uid and r.status = 'awaiting_payment';
  elsif p_kind = 'event' then
    select se.price_paise, se.service_type, se.host_mentor_id, 'Live session: ' || se.title into price, stype, mentor, descr
      from public.registrations g join public.sessions se on se.id = g.session_id
     where g.id = p_ref and g.user_id = uid and g.status = 'awaiting_payment';
  elsif p_kind = 'portfolio' then
    select p.price_paise, 'portfolio_review', p.assigned_mentor_id, 'Portfolio review: ' || p.title into price, stype, mentor, descr
      from public.portfolio_projects p where p.id = p_ref and p.student_id = uid and p.status = 'awaiting_payment';
  else
    raise exception 'Unknown order type';
  end if;
  if price is null then raise exception 'Nothing to pay for here (it may have expired)'; end if;
  if price <= 0 then raise exception 'This item is free'; end if;
  snap := private.calc_commission(price, stype, mentor);
  select * into o from public.orders
   where kind = p_kind and ref_id = p_ref and buyer_id = uid and status = 'created' and amount_paise = (snap ->> 'customer_total_paise')::bigint
   order by created_at desc limit 1;
  if o.id is null then
    insert into public.orders (kind, ref_id, buyer_id, mentor_id, description, price_paise, amount_paise, platform_fee_paise, gateway_est_paise,
                               mentor_net_paise, commission_snapshot, mode)
    values (p_kind, p_ref, uid, mentor, left(descr, 200), price, (snap ->> 'customer_total_paise')::bigint, (snap ->> 'platform_fee_paise')::bigint,
            (snap ->> 'gateway_est_paise')::bigint, (snap ->> 'mentor_net_paise')::bigint, snap, s.payments_mode)
    returning * into o;
  end if;
  return jsonb_build_object('order_id', o.id, 'amount_paise', o.amount_paise, 'currency', o.currency, 'description', o.description,
                            'provider_order_id', o.provider_order_id, 'key_id', s.razorpay_key_id, 'mode', o.mode,
                            'breakdown', jsonb_build_object('price_paise', o.price_paise, 'fee_added_paise', o.amount_paise - o.price_paise));
end;
$$;
grant execute on function public.create_order(text, uuid) to authenticated;

-- ---- Server-only functions (Edge Functions with the service role key) ----

create or replace function public.svc_attach_provider_order(p_order uuid, p_provider_order text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set provider_order_id = p_provider_order, updated_at = now()
   where id = p_order and status = 'created' and (provider_order_id is null or provider_order_id = p_provider_order);
  if not found then raise exception 'Order is not open'; end if;
end;
$$;

create or replace function private.fulfil_order(o public.orders)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('archmentor.internal', '1', true);
  if o.kind = 'booking' then
    update public.requests set status = 'confirmed', order_id = o.id where id = o.ref_id and status in ('awaiting_payment', 'cancelled');
  elsif o.kind = 'event' then
    update public.registrations set status = 'confirmed', order_id = o.id where id = o.ref_id;
  elsif o.kind = 'portfolio' then
    update public.portfolio_projects set status = 'submitted', order_id = o.id where id = o.ref_id and status in ('awaiting_payment', 'draft');
  end if;
  perform set_config('archmentor.internal', '', true);
end;
$$;

-- Idempotent: the same event id is processed once. Amount and currency must match the order.
create or replace function public.svc_record_payment(p_provider_order text, p_payment text, p_amount bigint, p_currency text,
                                                     p_status text, p_event_id text, p_payload jsonb default '{}'::jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare o public.orders; inserted bigint; res text;
begin
  insert into public.payment_transactions (event_id, provider_order_id, provider_payment_id, kind, amount_paise, currency, payload)
  values (p_event_id, p_provider_order, p_payment, p_status, p_amount, p_currency, coalesce(p_payload, '{}'::jsonb))
  on conflict (event_id) do nothing returning id into inserted;
  if inserted is null then return 'duplicate'; end if;
  select * into o from public.orders where provider_order_id = p_provider_order for update;
  if o.id is null then res := 'unknown_order';
  elsif p_status = 'failed' then
    res := 'failed_recorded';
    if o.status = 'created' then perform private.notify(o.buyer_id, 'Payment failed', 'Your payment for ' || o.description || ' did not go through. You can try again.', '/dashboard'); end if;
  elsif p_status <> 'captured' then res := 'ignored';
  elsif o.status in ('paid', 'refunded', 'partially_refunded') then res := 'already_paid';
  elsif p_amount <> o.amount_paise or upper(p_currency) <> o.currency then
    update public.orders set status = 'review', provider_payment_id = p_payment, updated_at = now() where id = o.id;
    perform private.notify_perm('finance.read', 'Payment needs review', 'Amount or currency did not match for order ' || o.id, '/staff/finance');
    res := 'mismatch';
  else
    update public.orders set status = 'paid', paid_at = now(), provider_payment_id = p_payment, updated_at = now() where id = o.id;
    insert into public.financial_ledger (order_id, mentor_id, entry_type, amount_paise, reference, note) values
      (o.id, null, 'payment_received', o.amount_paise, p_payment, o.description),
      (o.id, null, 'gateway_fee', o.gateway_est_paise, p_payment, 'Estimated gateway fee incl. GST'),
      (o.id, null, 'platform_fee', o.platform_fee_paise, p_payment, 'Commission'),
      (o.id, o.mentor_id, 'mentor_payable', o.mentor_net_paise, p_payment, 'Owed to mentor after completion');
    select * into o from public.orders where id = o.id;
    perform private.fulfil_order(o);
    perform private.audit('payment.captured', 'orders', o.id::text, jsonb_build_object('amount_paise', o.amount_paise, 'payment', p_payment));
    res := 'paid';
  end if;
  update public.payment_transactions set order_id = o.id, result = res where id = inserted;
  return res;
end;
$$;

-- Refund progress from the provider (refund.processed / refund.failed or the refund API response)
create or replace function public.svc_refund_update(p_refund uuid, p_provider_refund text, p_status text, p_event_id text, p_payload jsonb default '{}'::jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare rr public.refund_requests; o public.orders; inserted bigint; mrev bigint; frev bigint;
begin
  insert into public.payment_transactions (event_id, kind, payload) values (p_event_id, 'refund.' || p_status, coalesce(p_payload, '{}'::jsonb))
  on conflict (event_id) do nothing returning id into inserted;
  if inserted is null then return 'duplicate'; end if;
  if p_refund is null then select * into rr from public.refund_requests where provider_refund_id = p_provider_refund;
  else select * into rr from public.refund_requests where id = p_refund; end if;
  if rr.id is null then return 'unknown_refund'; end if;
  select * into o from public.orders where id = rr.order_id for update;
  update public.payment_transactions set order_id = o.id where id = inserted;
  if p_status = 'processing' then
    update public.refund_requests set status = 'processing', provider_refund_id = coalesce(p_provider_refund, provider_refund_id) where id = rr.id and status in ('approved', 'processing');
    return 'processing';
  elsif p_status = 'failed' then
    update public.refund_requests set status = 'failed' where id = rr.id and status in ('approved', 'processing');
    perform private.notify_perm('finance.refund', 'Refund failed', o.description, '/staff/finance');
    return 'failed';
  elsif p_status <> 'processed' or rr.status = 'refunded' then
    return 'ignored';
  end if;
  update public.refund_requests set status = 'refunded', provider_refund_id = coalesce(p_provider_refund, provider_refund_id) where id = rr.id;
  mrev := least(round(o.mentor_net_paise * rr.amount_paise / greatest(o.amount_paise, 1)::numeric), o.mentor_net_paise - o.mentor_reversed_paise);
  frev := least(round(o.platform_fee_paise * rr.amount_paise / greatest(o.amount_paise, 1)::numeric), o.platform_fee_paise);
  insert into public.financial_ledger (order_id, mentor_id, entry_type, amount_paise, reference, note) values
    (o.id, null, 'refund', rr.amount_paise, coalesce(p_provider_refund, ''), rr.reason),
    (o.id, null, 'platform_fee_reversal', frev, coalesce(p_provider_refund, ''), 'Commission returned with refund'),
    (o.id, o.mentor_id, 'mentor_payable_reversal', mrev, coalesce(p_provider_refund, ''), 'Mentor share reversed');
  update public.orders set refunded_paise = refunded_paise + rr.amount_paise, mentor_reversed_paise = mentor_reversed_paise + mrev,
         status = case when refunded_paise + rr.amount_paise >= amount_paise then 'refunded' else 'partially_refunded' end, updated_at = now()
   where id = o.id;
  perform set_config('archmentor.internal', '1', true);
  if o.kind = 'booking' and o.refunded_paise + rr.amount_paise >= o.amount_paise then
    update public.requests set status = 'refunded' where id = o.ref_id;
  elsif o.kind = 'event' then
    update public.registrations set status = 'cancelled' where id = o.ref_id;
  elsif o.kind = 'portfolio' then
    update public.portfolio_projects set status = 'cancelled' where id = o.ref_id and status not in ('completed');
  end if;
  perform set_config('archmentor.internal', '', true);
  perform private.notify(o.buyer_id, 'Refund processed', '₹' || to_char(rr.amount_paise / 100.0, 'FM999,999,990.00') || ' for ' || o.description, '/dashboard');
  perform private.send_email((select email from public.profiles where id = o.buyer_id), '', 'Your refund has been processed',
    private.layout('Refund processed', '<p>We have refunded <b>₹' || to_char(rr.amount_paise / 100.0, 'FM999,999,990.00') || '</b> for ' || private.esc(o.description)
      || '. Banks usually show it within 5–7 working days.</p>', 'Open your dashboard', private.link('/dashboard')), 'refund-processed');
  perform private.audit('refund.processed', 'refund_requests', rr.id::text, jsonb_build_object('amount_paise', rr.amount_paise));
  return 'refunded';
end;
$$;

revoke all on function public.svc_attach_provider_order(uuid, text) from public, anon, authenticated;
revoke all on function public.svc_record_payment(text, text, bigint, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.svc_refund_update(uuid, text, text, text, jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.svc_attach_provider_order(uuid, text) to service_role;
    grant execute on function public.svc_record_payment(text, text, bigint, text, text, text, jsonb) to service_role;
    grant execute on function public.svc_refund_update(uuid, text, text, text, jsonb) to service_role;
  end if;
end $$;

-- ---- Refunds (people) ----

create or replace function public.request_refund(p_order uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.orders; rid uuid;
begin
  select * into o from public.orders where id = p_order and buyer_id = auth.uid();
  if o.id is null or o.status not in ('paid', 'partially_refunded') then raise exception 'This payment cannot be refunded'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Tell us why'; end if;
  insert into public.refund_requests (order_id, requested_by, amount_paise, reason)
  values (o.id, auth.uid(), o.amount_paise - o.refunded_paise, p_reason) returning id into rid;
  return rid;
end;
$$;
grant execute on function public.request_refund(uuid, text) to authenticated;

create or replace function private.on_refund_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = new.order_id;
  if tg_op = 'INSERT' then
    perform private.notify_perm('finance.refund', 'Refund requested', o.description || ' · ₹' || to_char(new.amount_paise / 100.0, 'FM999,999,990.00'), '/staff/finance');
    perform private.email_admin('Refund requested: ' || o.description, 'A refund was requested',
      '<p>' || private.esc(o.description) || '</p><p>Reason: ' || private.esc(new.reason) || '</p>', 'Open finance', private.link('/staff/finance'), 'refund-requested');
  elsif new.status = 'rejected' and old.status <> 'rejected' then
    perform private.notify(o.buyer_id, 'Refund request declined', coalesce(nullif(new.decision_note, ''), o.description), '/dashboard');
  end if;
  return new;
end;
$$;
drop trigger if exists refund_request_event on public.refund_requests;
create trigger refund_request_event after insert or update of status on public.refund_requests for each row execute function private.on_refund_request();

-- Finance decides. Approve → the Edge Function "request-refund" sends it to Razorpay.
create or replace function public.decide_refund(p_id uuid, p_approve boolean, p_amount bigint, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare rr public.refund_requests; o public.orders;
begin
  if not public.has_perm('finance.refund') then raise exception 'Not allowed'; end if;
  select * into rr from public.refund_requests where id = p_id for update;
  if rr.id is null or rr.status not in ('requested', 'failed') then raise exception 'This refund is not waiting for a decision'; end if;
  if rr.requested_by = auth.uid() then raise exception 'Someone else must decide on a refund you requested'; end if;
  select * into o from public.orders where id = rr.order_id;
  if p_approve then
    if p_amount is null or p_amount <= 0 or p_amount > o.amount_paise - o.refunded_paise then raise exception 'Refund amount must be between ₹0.01 and the amount paid'; end if;
    update public.refund_requests set status = 'approved', amount_paise = p_amount, decided_by = auth.uid(), decided_at = now(), decision_note = coalesce(p_note, '') where id = p_id;
  else
    update public.refund_requests set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = coalesce(p_note, '') where id = p_id;
  end if;
  perform private.audit(case when p_approve then 'refund.approved' else 'refund.rejected' end, 'refund_requests', p_id::text, jsonb_build_object('amount_paise', p_amount, 'note', p_note));
end;
$$;
grant execute on function public.decide_refund(uuid, boolean, bigint, text) to authenticated;

-- A refund made outside the website (for example in the Razorpay dashboard) recorded by finance
create or replace function public.record_manual_refund(p_id uuid, p_reference text)
returns text language plpgsql security definer set search_path = public as $$
declare rr public.refund_requests;
begin
  if not public.has_perm('finance.refund') then raise exception 'Not allowed'; end if;
  select * into rr from public.refund_requests where id = p_id;
  if rr.id is null or rr.status not in ('approved', 'processing', 'failed') then raise exception 'Approve the refund first'; end if;
  if coalesce(trim(p_reference), '') = '' then raise exception 'Enter the refund reference'; end if;
  return public.svc_refund_update(p_id, p_reference, 'processed', 'manual:' || p_id, jsonb_build_object('by', auth.uid()));
end;
$$;
grant execute on function public.record_manual_refund(uuid, text) to authenticated;

-- ---- Payouts (prepare → approve by someone else → mark paid with reference) ----

create or replace function public.prepare_payout(p_mentor uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.site_settings := private.settings(); pid uuid; total bigint;
begin
  if not public.has_perm('finance.payout.prepare') then raise exception 'Not allowed'; end if;
  if exists (select 1 from public.mentor_payouts where mentor_id = p_mentor and status in ('prepared', 'approved')) then
    raise exception 'This mentor already has a payout waiting';
  end if;
  select coalesce(sum(o.mentor_net_paise - o.mentor_reversed_paise), 0) into total
    from public.orders o
   where o.mentor_id = p_mentor and o.status in ('paid', 'partially_refunded') and o.payout_status = 'none'
     and o.completed_at is not null and o.completed_at <= now() - make_interval(days => s.payout_hold_days)
     and not exists (select 1 from public.refund_requests r where r.order_id = o.id and r.status in ('requested', 'approved', 'processing'));
  total := total + coalesce((select sum(amount_paise) from public.ledger_adjustments a where a.mentor_id = p_mentor and a.status = 'approved'
                            and not exists (select 1 from public.payout_items i join public.mentor_payouts p on p.id = i.payout_id
                                            where i.adjustment_id = a.id and p.status <> 'cancelled')), 0);
  -- never pay more than the mentor's ledger balance (refunds after an earlier payout are recovered here)
  total := least(total, coalesce((select sum(case entry_type when 'mentor_payable' then amount_paise when 'mentor_payable_reversal' then -amount_paise
                                                  when 'payout' then -amount_paise when 'adjustment' then amount_paise else 0 end)
                                  from public.financial_ledger where mentor_id = p_mentor), 0)
                        - coalesce((select sum(mentor_net_paise - mentor_reversed_paise) from public.orders where mentor_id = p_mentor
                                    and status in ('paid', 'partially_refunded') and payout_status = 'none'
                                    and (completed_at is null or completed_at > now() - make_interval(days => s.payout_hold_days))), 0));
  if total <= 0 then raise exception 'Nothing is ready to pay this mentor yet'; end if;
  insert into public.mentor_payouts (mentor_id, amount_paise, prepared_by) values (p_mentor, total, auth.uid()) returning id into pid;
  insert into public.payout_items (payout_id, order_id, amount_paise)
  select pid, o.id, o.mentor_net_paise - o.mentor_reversed_paise from public.orders o
   where o.mentor_id = p_mentor and o.status in ('paid', 'partially_refunded') and o.payout_status = 'none'
     and o.completed_at is not null and o.completed_at <= now() - make_interval(days => s.payout_hold_days)
     and not exists (select 1 from public.refund_requests r where r.order_id = o.id and r.status in ('requested', 'approved', 'processing'));
  insert into public.payout_items (payout_id, order_id, adjustment_id, amount_paise)
  select pid, null, a.id, a.amount_paise from public.ledger_adjustments a where a.mentor_id = p_mentor and a.status = 'approved'
     and not exists (select 1 from public.payout_items i join public.mentor_payouts p on p.id = i.payout_id where i.adjustment_id = a.id and p.status <> 'cancelled');
  update public.orders set payout_status = 'in_payout' where id in (select order_id from public.payout_items where payout_id = pid and order_id is not null);
  perform private.audit('payout.prepared', 'mentor_payouts', pid::text, jsonb_build_object('mentor', p_mentor, 'amount_paise', total));
  perform private.notify_perm('finance.payout.approve', 'Payout waiting for approval', '₹' || to_char(total / 100.0, 'FM999,999,990.00'), '/staff/payouts');
  return pid;
end;
$$;
grant execute on function public.prepare_payout(uuid) to authenticated;

create or replace function public.approve_payout(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.mentor_payouts;
begin
  if not public.has_perm('finance.payout.approve') then raise exception 'Not allowed'; end if;
  select * into p from public.mentor_payouts where id = p_id for update;
  if p.id is null or p.status <> 'prepared' then raise exception 'Only prepared payouts can be approved'; end if;
  if p.prepared_by = auth.uid() then raise exception 'A different person must approve a payout you prepared'; end if;
  if p.amount_paise > (private.settings()).payout_two_person_paise and not public.is_main_admin() then
    raise exception 'Payouts above the limit must be approved by the main admin';
  end if;
  update public.mentor_payouts set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_id;
  perform private.audit('payout.approved', 'mentor_payouts', p_id::text, jsonb_build_object('amount_paise', p.amount_paise));
end;
$$;
grant execute on function public.approve_payout(uuid) to authenticated;

create or replace function public.mark_payout_paid(p_id uuid, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.mentor_payouts; m public.profiles;
begin
  if not public.has_perm('finance.payout.approve') then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_reference), '') = '' then raise exception 'Enter the bank/UPI transfer reference'; end if;
  select * into p from public.mentor_payouts where id = p_id for update;
  if p.id is null or p.status <> 'approved' then raise exception 'Approve the payout first'; end if;
  update public.mentor_payouts set status = 'paid', paid_at = now(), reference = p_reference where id = p_id;
  update public.orders set payout_status = 'paid' where id in (select order_id from public.payout_items where payout_id = p_id and order_id is not null);
  insert into public.financial_ledger (mentor_id, entry_type, amount_paise, reference, note, created_by)
  values (p.mentor_id, 'payout', p.amount_paise, p_reference, 'Payout ' || p_id, auth.uid());
  select * into m from public.profiles where id = p.mentor_id;
  perform private.notify(p.mentor_id, 'Payout sent', '₹' || to_char(p.amount_paise / 100.0, 'FM999,999,990.00') || ' · ref ' || p_reference, '/dashboard?tab=earnings');
  perform private.send_email(m.email, m.full_name, 'Payout sent: ₹' || to_char(p.amount_paise / 100.0, 'FM999,999,990.00'),
    private.layout('Your payout is on its way', '<p>Hello ' || private.esc(m.full_name) || ',</p><p>We have sent <b>₹' || to_char(p.amount_paise / 100.0, 'FM999,999,990.00')
      || '</b>. Reference: ' || private.esc(p_reference) || '.</p>', 'See your earnings', private.link('/dashboard?tab=earnings')), 'payout-paid');
  perform private.audit('payout.paid', 'mentor_payouts', p_id::text, jsonb_build_object('reference', p_reference));
end;
$$;
grant execute on function public.mark_payout_paid(uuid, text) to authenticated;

create or replace function public.cancel_payout(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_perm('finance.payout.prepare') or public.has_perm('finance.payout.approve')) then raise exception 'Not allowed'; end if;
  update public.mentor_payouts set status = 'cancelled', note = coalesce(p_reason, '') where id = p_id and status in ('prepared', 'approved');
  if not found then raise exception 'Only open payouts can be cancelled'; end if;
  update public.orders set payout_status = 'none' where id in (select order_id from public.payout_items where payout_id = p_id and order_id is not null);
  perform private.audit('payout.cancelled', 'mentor_payouts', p_id::text, jsonb_build_object('reason', p_reason));
end;
$$;
grant execute on function public.cancel_payout(uuid, text) to authenticated;

-- ---- Adjustments (two people) ----
create or replace function public.request_adjustment(p_mentor uuid, p_order uuid, p_amount bigint, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare aid uuid;
begin
  if not public.has_perm('finance.adjust') then raise exception 'Not allowed'; end if;
  insert into public.ledger_adjustments (mentor_id, order_id, amount_paise, reason, requested_by) values (p_mentor, p_order, p_amount, p_reason, auth.uid()) returning id into aid;
  perform private.audit('adjustment.requested', 'ledger_adjustments', aid::text, jsonb_build_object('amount_paise', p_amount, 'reason', p_reason));
  return aid;
end;
$$;
grant execute on function public.request_adjustment(uuid, uuid, bigint, text) to authenticated;

create or replace function public.decide_adjustment(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a public.ledger_adjustments;
begin
  if not public.has_perm('finance.adjust') then raise exception 'Not allowed'; end if;
  select * into a from public.ledger_adjustments where id = p_id for update;
  if a.id is null or a.status <> 'requested' then raise exception 'Already decided'; end if;
  if a.requested_by = auth.uid() then raise exception 'A different person must approve an adjustment you requested'; end if;
  update public.ledger_adjustments set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now() where id = p_id;
  if p_approve then
    insert into public.financial_ledger (order_id, mentor_id, entry_type, amount_paise, note, created_by) values (a.order_id, a.mentor_id, 'adjustment', a.amount_paise, a.reason, auth.uid());
  end if;
  perform private.audit(case when p_approve then 'adjustment.approved' else 'adjustment.rejected' end, 'ledger_adjustments', p_id::text, '{}'::jsonb);
end;
$$;
grant execute on function public.decide_adjustment(uuid, boolean) to authenticated;

-- Mentor's own earnings
create or replace function public.my_earnings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.site_settings := private.settings();
begin
  return jsonb_build_object(
    'pending_completion', coalesce((select sum(mentor_net_paise - mentor_reversed_paise) from public.orders where mentor_id = uid and status in ('paid', 'partially_refunded') and completed_at is null), 0),
    'on_hold', coalesce((select sum(mentor_net_paise - mentor_reversed_paise) from public.orders where mentor_id = uid and status in ('paid', 'partially_refunded') and payout_status = 'none'
                         and completed_at is not null and completed_at > now() - make_interval(days => s.payout_hold_days)), 0),
    'ready', coalesce((select sum(mentor_net_paise - mentor_reversed_paise) from public.orders where mentor_id = uid and status in ('paid', 'partially_refunded') and payout_status = 'none'
                       and completed_at is not null and completed_at <= now() - make_interval(days => s.payout_hold_days)), 0),
    'in_payout', coalesce((select sum(amount_paise) from public.mentor_payouts where mentor_id = uid and status in ('prepared', 'approved')), 0),
    'paid_total', coalesce((select sum(amount_paise) from public.mentor_payouts where mentor_id = uid and status = 'paid'), 0),
    'hold_days', s.payout_hold_days,
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'description', description, 'price_paise', price_paise, 'mentor_net_paise', mentor_net_paise - mentor_reversed_paise,
                          'status', status, 'payout_status', payout_status, 'paid_at', paid_at, 'completed_at', completed_at) order by created_at desc)
                        from (select * from public.orders where mentor_id = uid and status <> 'created' and status <> 'expired' order by created_at desc limit 50) x), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'amount_paise', amount_paise, 'status', status, 'paid_at', paid_at, 'reference', reference) order by created_at desc)
                        from public.mentor_payouts where mentor_id = uid), '[]'::jsonb));
end;
$$;
grant execute on function public.my_earnings() to authenticated;

-- Finance summary for the staff workspace
create or replace function public.finance_summary(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('finance.read') then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'collected', coalesce((select sum(amount_paise) from public.financial_ledger where entry_type = 'payment_received' and created_at > now() - make_interval(days => p_days)), 0),
    'commission', coalesce((select sum(amount_paise) from public.financial_ledger where entry_type = 'platform_fee' and created_at > now() - make_interval(days => p_days)), 0)
                - coalesce((select sum(amount_paise) from public.financial_ledger where entry_type = 'platform_fee_reversal' and created_at > now() - make_interval(days => p_days)), 0),
    'gateway', coalesce((select sum(amount_paise) from public.financial_ledger where entry_type = 'gateway_fee' and created_at > now() - make_interval(days => p_days)), 0),
    'refunded', coalesce((select sum(amount_paise) from public.financial_ledger where entry_type = 'refund' and created_at > now() - make_interval(days => p_days)), 0),
    'owed_to_mentors', coalesce((select sum(case entry_type when 'mentor_payable' then amount_paise when 'mentor_payable_reversal' then -amount_paise
                                                  when 'payout' then -amount_paise when 'adjustment' then amount_paise else 0 end)
                                 from public.financial_ledger where mentor_id is not null), 0),
    'open_refunds', (select count(*) from public.refund_requests where status in ('requested', 'approved', 'failed')),
    'in_review', (select count(*) from public.orders where status = 'review'),
    'mode', (private.settings()).payments_mode);
end;
$$;
grant execute on function public.finance_summary(int) to authenticated;

-- Mentors with money ready for payout
create or replace function public.payout_candidates()
returns table (mentor_id uuid, full_name text, email text, ready_paise bigint, orders int, payout_method text, payout_display text, kyc_status text)
language plpgsql stable security definer set search_path = public as $$
declare s public.site_settings := private.settings();
begin
  if not (public.has_perm('finance.payout.prepare') or public.has_perm('finance.read')) then raise exception 'Not allowed'; end if;
  return query
    select p.id, p.full_name, p.email, sum(o.mentor_net_paise - o.mentor_reversed_paise)::bigint, count(*)::int,
           coalesce(f.payout_method, ''), coalesce(f.payout_display, ''), coalesce(f.kyc_status, 'not_started')
      from public.orders o join public.profiles p on p.id = o.mentor_id left join public.mentor_finance f on f.mentor_id = p.id
     where o.status in ('paid', 'partially_refunded') and o.payout_status = 'none' and o.completed_at is not null
       and o.completed_at <= now() - make_interval(days => s.payout_hold_days)
     group by p.id, p.full_name, p.email, f.payout_method, f.payout_display, f.kyc_status;
end;
$$;
grant execute on function public.payout_candidates() to authenticated;

drop trigger if exists request_event2 on public.requests;
create trigger request_event2 after insert or update on public.requests for each row execute function private.on_request_event2();

-- =====================================================================
-- 21. Portfolio review studio (private files, assigned by coordinators)
-- =====================================================================

create table if not exists public.portfolio_review_types (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text not null default '',
  price_paise     int not null default 0 check (price_paise >= 0),
  turnaround_days int not null default 7 check (turnaround_days between 1 and 60),
  active          boolean not null default true,
  sort            int not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists public.portfolio_projects (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.profiles (id) on delete cascade,
  review_type_id     uuid references public.portfolio_review_types (id) on delete set null,
  title              text not null check (char_length(title) between 3 and 160),
  brief              text not null default '',      -- goals: jobs, masters, competition…
  target             text not null default '',
  status             text not null default 'draft' check (status in ('draft', 'submitted', 'awaiting_payment', 'assigned', 'in_review',
                       'feedback_ready', 'revision_requested', 'completed', 'cancelled')),
  price_paise        int not null default 0,
  order_id           uuid,
  assigned_mentor_id uuid references public.profiles (id) on delete set null,
  assigned_by        uuid references public.profiles (id) on delete set null,
  assigned_at        timestamptz,
  due_at             timestamptz,
  revisions_used     int not null default 0,
  submitted_at       timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.portfolio_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.portfolio_projects (id) on delete cascade,
  path        text not null unique,                 -- portfolios/<student>/<project>/<file>
  name        text not null,
  size_bytes  bigint not null default 0,
  mime        text not null default '',
  kind        text not null default 'submission' check (kind in ('submission', 'feedback')),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.portfolio_reviews (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.portfolio_projects (id) on delete cascade,
  mentor_id    uuid not null references public.profiles (id) on delete cascade,
  round        int not null default 1,
  rubric       jsonb not null default '{}'::jsonb,  -- {"Storytelling": 4, "Drawings": 3, …} scores 1–5
  summary      text not null default '',
  strengths    text not null default '',
  improvements text not null default '',
  status       text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (project_id, round)
);

create or replace function public.guard_portfolio()
returns trigger language plpgsql security definer set search_path = public as $$
declare rt public.portfolio_review_types; paid boolean;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.student_id := auth.uid(); new.status := 'draft'; new.assigned_mentor_id := null; new.assigned_by := null; new.order_id := null;
    select * into rt from public.portfolio_review_types where id = new.review_type_id and active;
    if rt.id is null then raise exception 'Choose a review type'; end if;
    new.price_paise := rt.price_paise; new.revisions_used := 0;
    return new;
  end if;
  if current_setting('archmentor.internal', true) = '1' or auth.uid() is null then return new; end if;
  new.price_paise := old.price_paise; new.order_id := old.order_id; new.student_id := old.student_id;
  paid := old.price_paise > 0 and (private.settings()).payments_mode <> 'off';
  if public.is_admin() or public.has_perm('portfolio.assign') then
    if new.assigned_mentor_id is distinct from old.assigned_mentor_id then
      if not public.is_public_mentor(new.assigned_mentor_id) then raise exception 'Assign an approved mentor'; end if;
      if old.status not in ('submitted', 'assigned', 'in_review', 'revision_requested') then raise exception 'Only submitted portfolios can be assigned'; end if;
      new.assigned_by := auth.uid(); new.assigned_at := now();
      new.status := case when old.status = 'revision_requested' then 'revision_requested' else 'assigned' end;
      new.due_at := now() + make_interval(days => coalesce((select turnaround_days from public.portfolio_review_types where id = old.review_type_id), 7));
      perform private.audit('portfolio.assign', 'portfolio_projects', old.id::text, jsonb_build_object('mentor', new.assigned_mentor_id));
    end if;
    return new;
  end if;
  if auth.uid() = old.assigned_mentor_id then
    new.title := old.title; new.brief := old.brief; new.target := old.target; new.review_type_id := old.review_type_id;
    new.assigned_mentor_id := old.assigned_mentor_id; new.assigned_by := old.assigned_by; new.due_at := old.due_at; new.revisions_used := old.revisions_used;
    if new.status is distinct from old.status and not (
         (old.status in ('assigned', 'revision_requested') and new.status = 'in_review')
      or (old.status = 'in_review' and new.status = 'feedback_ready')) then
      raise exception 'Mentors can start a review and send feedback';
    end if;
    return new;
  end if;
  if auth.uid() = old.student_id then
    new.assigned_mentor_id := old.assigned_mentor_id; new.assigned_by := old.assigned_by; new.due_at := old.due_at; new.review_type_id := old.review_type_id;
    if new.status is distinct from old.status then
      if old.status = 'draft' and new.status = 'submitted' then
        if not exists (select 1 from public.portfolio_files where project_id = old.id and kind = 'submission') then raise exception 'Upload at least one file first'; end if;
        if paid then new.status := 'awaiting_payment'; end if;
        new.submitted_at := now();
      elsif old.status = 'feedback_ready' and new.status = 'revision_requested' then
        if old.revisions_used >= 1 then raise exception 'One follow-up round is included'; end if;
        new.revisions_used := old.revisions_used + 1;
      elsif old.status = 'feedback_ready' and new.status = 'completed' then
        new.completed_at := now();
      elsif old.status in ('draft', 'awaiting_payment') and new.status = 'cancelled' then
        null;
      else
        raise exception 'This step is not allowed';
      end if;
    end if;
    if old.status <> 'draft' then new.title := old.title; new.brief := old.brief; new.target := old.target; end if;
    return new;
  end if;
  raise exception 'Not allowed';
end;
$$;
drop trigger if exists guard_portfolio on public.portfolio_projects;
create trigger guard_portfolio before insert or update on public.portfolio_projects for each row execute function public.guard_portfolio();

create or replace function private.on_portfolio_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare st public.profiles; me public.profiles;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status and new.assigned_mentor_id is not distinct from old.assigned_mentor_id then return new; end if;
  select * into st from public.profiles where id = new.student_id;
  select * into me from public.profiles where id = new.assigned_mentor_id;
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
    perform private.notify_perm('portfolio.assign', 'Portfolio ready to assign', new.title || ' · ' || st.full_name, '/staff/portfolio');
    perform private.notify(new.student_id, 'Portfolio submitted', new.title, '/portfolio/' || new.id);
    perform private.send_email(st.email, st.full_name, 'We received your portfolio',
      private.layout('Portfolio received', '<p>Hello ' || private.esc(st.full_name) || ',</p><p>Thanks — <b>' || private.esc(new.title)
        || '</b> is in. We will match it with a mentor and email you when the review starts.</p>', 'Open your portfolio', private.link('/portfolio/' || new.id)), 'portfolio-submitted');
  elsif new.status = 'awaiting_payment' and (tg_op = 'INSERT' or old.status <> 'awaiting_payment') then
    perform private.notify(new.student_id, 'Pay to submit your portfolio', new.title, '/portfolio/' || new.id);
  elsif new.status in ('assigned', 'revision_requested') and new.assigned_mentor_id is not null
        and (old.assigned_mentor_id is distinct from new.assigned_mentor_id or old.status is distinct from new.status) then
    perform private.notify(new.assigned_mentor_id, case when new.status = 'revision_requested' then 'Follow-up requested' else 'New portfolio to review' end, new.title, '/portfolio/' || new.id);
    perform private.send_email(me.email, me.full_name, case when new.status = 'revision_requested' then 'Follow-up requested: ' else 'New portfolio to review: ' end || new.title,
      private.layout('Portfolio review', '<p>Hello ' || private.esc(me.full_name) || ',</p><p>' || case when new.status = 'revision_requested' then 'The student asked for a follow-up on ' else 'You have been assigned ' end
        || '<b>' || private.esc(new.title) || '</b>. Please reply by ' || coalesce(private.fmt_time(new.due_at), 'the due date') || '.</p><p>Files open from the review page with short-lived private links.</p>',
        'Open the review', private.link('/portfolio/' || new.id)), 'portfolio-assigned');
    if new.status = 'assigned' then
      perform private.notify(new.student_id, 'A mentor is reviewing your portfolio', new.title, '/portfolio/' || new.id);
      perform private.send_email(st.email, st.full_name, 'Your portfolio has a mentor', private.layout('Your portfolio has a mentor',
        '<p>' || private.esc(me.full_name) || ' will review <b>' || private.esc(new.title) || '</b>. Expected by ' || coalesce(private.fmt_time(new.due_at), 'the due date') || '.</p>',
        'Open your portfolio', private.link('/portfolio/' || new.id)), 'portfolio-assigned-student');
    end if;
  elsif new.status = 'feedback_ready' and old.status <> 'feedback_ready' then
    perform private.notify(new.student_id, 'Feedback is ready', new.title, '/portfolio/' || new.id);
    perform private.send_email(st.email, st.full_name, 'Your portfolio feedback is ready', private.layout('Feedback is ready',
      '<p>Hello ' || private.esc(st.full_name) || ',</p><p>' || private.esc(coalesce(me.full_name, 'Your mentor')) || ' has finished reviewing <b>' || private.esc(new.title) || '</b>.</p>',
      'Read the feedback', private.link('/portfolio/' || new.id)), 'portfolio-feedback');
  elsif new.status = 'completed' and old.status <> 'completed' then
    update public.orders set completed_at = coalesce(completed_at, now()) where id = new.order_id;
    perform private.notify(new.assigned_mentor_id, 'Portfolio review completed', new.title, '/portfolio/' || new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists portfolio_event on public.portfolio_projects;
create trigger portfolio_event after insert or update on public.portfolio_projects for each row execute function private.on_portfolio_event();

create or replace function public.can_see_portfolio(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.portfolio_projects p where p.id = p_project
                 and (p.student_id = auth.uid() or p.assigned_mentor_id = auth.uid() or public.has_perm('portfolio.read') or public.has_perm('portfolio.assign')));
$$;

create or replace function public.guard_portfolio_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.portfolio_projects;
begin
  select * into p from public.portfolio_projects where id = new.project_id;
  if p.assigned_mentor_id is distinct from auth.uid() then raise exception 'Only the assigned mentor can write this review'; end if;
  if tg_op = 'UPDATE' and old.status = 'submitted' then raise exception 'This review was already sent'; end if;
  new.mentor_id := auth.uid();
  if new.status = 'submitted' then
    new.submitted_at := now();
    perform set_config('archmentor.internal', '1', true);
    update public.portfolio_projects set status = 'feedback_ready' where id = p.id;
    perform set_config('archmentor.internal', '', true);
  end if;
  return new;
end;
$$;
drop trigger if exists guard_portfolio_review on public.portfolio_reviews;
create trigger guard_portfolio_review before insert or update on public.portfolio_reviews for each row execute function public.guard_portfolio_review();

-- Files: metadata row must match a path inside the student's own project folder
create or replace function public.guard_portfolio_file()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.portfolio_projects;
begin
  select * into p from public.portfolio_projects where id = new.project_id;
  if p.id is null then raise exception 'Unknown project'; end if;
  new.uploaded_by := auth.uid();
  if auth.uid() = p.student_id and p.status in ('draft', 'revision_requested', 'feedback_ready') then
    new.kind := 'submission';
  elsif auth.uid() = p.assigned_mentor_id and p.status in ('assigned', 'in_review', 'revision_requested') then
    new.kind := 'feedback';
  else
    raise exception 'You cannot add files to this portfolio now';
  end if;
  if split_part(new.path, '/', 1) <> p.student_id::text or split_part(new.path, '/', 2) <> p.id::text then raise exception 'Bad file path'; end if;
  return new;
end;
$$;
drop trigger if exists guard_portfolio_file on public.portfolio_files;
create trigger guard_portfolio_file before insert on public.portfolio_files for each row execute function public.guard_portfolio_file();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolios', 'portfolios', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "portfolios: read if allowed" on storage.objects;
create policy "portfolios: read if allowed" on storage.objects for select to authenticated
  using (bucket_id = 'portfolios' and public.can_see_portfolio(((storage.foldername(name))[2])::uuid));
drop policy if exists "portfolios: upload by owner or mentor" on storage.objects;
create policy "portfolios: upload by owner or mentor" on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolios' and exists (
    select 1 from public.portfolio_projects p where p.id::text = (storage.foldername(name))[2] and p.student_id::text = (storage.foldername(name))[1]
      and ((p.student_id = auth.uid() and p.status in ('draft', 'revision_requested', 'feedback_ready'))
        or (p.assigned_mentor_id = auth.uid() and p.status in ('assigned', 'in_review', 'revision_requested')))));
drop policy if exists "portfolios: delete own drafts" on storage.objects;
create policy "portfolios: delete own drafts" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolios' and exists (
    select 1 from public.portfolio_projects p where p.id::text = (storage.foldername(name))[2] and p.student_id = auth.uid() and p.status = 'draft'));

-- =====================================================================
-- 22. Opportunities, resources, saved items
-- =====================================================================

create table if not exists public.opportunities (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  organisation text not null default '',
  kind        text not null default 'Job' check (kind in ('Job', 'Internship', 'Competition', 'Scholarship', 'Workshop', 'Fellowship')),
  location    text not null default '',
  remote      boolean not null default false,
  url         text not null default '',
  description text not null default '',
  deadline    date,
  published   boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  kind        text not null default 'Guide' check (kind in ('Guide', 'Template', 'Reading list', 'Tool', 'Checklist')),
  description text not null default '',
  url         text not null default '',        -- link or uploaded file (public "resources" bucket)
  cover_url   text not null default '',
  published   boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.saved_items (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('opportunity', 'resource', 'post', 'mentor', 'session')),
  item_id    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resources', 'resources', true, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "resources: public read" on storage.objects;
create policy "resources: public read" on storage.objects for select using (bucket_id = 'resources');
drop policy if exists "resources: content team" on storage.objects;
create policy "resources: content team" on storage.objects for insert to authenticated with check (bucket_id = 'resources' and public.has_perm('content.manage'));
drop policy if exists "resources: content team delete" on storage.objects;
create policy "resources: content team delete" on storage.objects for delete to authenticated using (bucket_id = 'resources' and public.has_perm('content.manage'));

-- =====================================================================
-- 23. Calls, support tickets
-- =====================================================================

create table if not exists public.call_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles (id) on delete set null,
  name           text not null check (char_length(name) between 2 and 120),
  email          text not null,
  phone          text not null check (char_length(phone) between 6 and 20),
  topic          text not null default 'General',
  preferred_time text not null default '',
  message        text not null default '',
  status         text not null default 'new' check (status in ('new', 'scheduled', 'done', 'no_answer', 'closed')),
  assigned_to    uuid references public.profiles (id) on delete set null,
  scheduled_at   timestamptz,
  created_at     timestamptz not null default now()
);
create table if not exists public.call_notes (
  id         uuid primary key default gen_random_uuid(),
  call_id    uuid not null references public.call_requests (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null check (char_length(body) >= 1),
  created_at timestamptz not null default now()
);

create or replace function public.guard_call()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid(); new.status := 'new'; new.assigned_to := null; new.scheduled_at := null; new.email := lower(trim(new.email));
    if (select count(*) from public.call_requests where lower(email) = new.email and created_at > now() - interval '1 day') >= 3 then
      raise exception 'You already asked for a call today — we will be in touch';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_call on public.call_requests;
create trigger guard_call before insert on public.call_requests for each row execute function public.guard_call();

create or replace function private.on_call()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify_perm('calls.manage', 'Call-back request: ' || new.name, new.topic || coalesce(' · ' || nullif(new.preferred_time, ''), ''), '/staff/calls');
    perform private.email_admin('Call-back request from ' || new.name, 'Someone asked for a call',
      '<p><b>' || private.esc(new.name) || '</b> · ' || private.esc(new.email) || ' · ' || private.esc(new.phone) || '</p><p>Topic: ' || private.esc(new.topic)
      || '</p><p>Best time: ' || private.esc(new.preferred_time) || '</p><p>' || private.para(new.message) || '</p>', 'Open calls', private.link('/staff/calls'), 'call-request');
    perform private.send_email(new.email, new.name, 'We will call you back', private.layout('Thanks — we will call you',
      '<p>Hello ' || private.esc(new.name) || ',</p><p>Our team will call you' || coalesce(' around ' || private.esc(nullif(new.preferred_time, '')), ' soon') || '.</p>', 'Visit the site', private.link('/')), 'call-ack');
  elsif new.status = 'scheduled' and old.status <> 'scheduled' and new.scheduled_at is not null then
    perform private.send_email(new.email, new.name, 'Your call is scheduled', private.layout('Your call is scheduled',
      '<p>Hello ' || private.esc(new.name) || ',</p><p>We will call you on ' || private.fmt_time(new.scheduled_at) || '.</p>', 'Visit the site', private.link('/')), 'call-scheduled');
  end if;
  return new;
end;
$$;
drop trigger if exists call_event on public.call_requests;
create trigger call_event after insert or update of status on public.call_requests for each row execute function private.on_call();

create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  name        text not null default '',
  email       text not null,
  subject     text not null check (char_length(subject) between 3 and 200),
  category    text not null default 'General' check (category in ('General', 'Booking', 'Payment', 'Refund', 'Account', 'Portfolio', 'Mentor', 'Technical')),
  status      text not null default 'open' check (status in ('open', 'waiting', 'resolved', 'closed')),
  priority    text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  author_name text not null default '',
  from_staff  boolean not null default false,
  internal    boolean not null default false,     -- staff-only note
  body        text not null check (char_length(body) >= 1),
  created_at  timestamptz not null default now()
);

create or replace function public.guard_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    select * into p from public.profiles where id = auth.uid();
    if p.id is null then raise exception 'Please sign in'; end if;
    new.user_id := p.id; new.email := p.email; new.name := p.full_name; new.status := 'open'; new.assigned_to := null; new.priority := 'normal';
    if (select count(*) from public.support_tickets where user_id = p.id and created_at > now() - interval '1 hour') >= 5 then raise exception 'Too many tickets — please wait a little'; end if;
    return new;
  end if;
  if public.has_perm('support.manage') or current_setting('archmentor.internal', true) = '1' then return new; end if;
  raise exception 'Not allowed';
end;
$$;
drop trigger if exists guard_ticket on public.support_tickets;
create trigger guard_ticket before insert or update on public.support_tickets for each row execute function public.guard_ticket();

create or replace function public.guard_ticket_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.support_tickets; staff boolean := public.has_perm('support.manage');
begin
  select * into t from public.support_tickets where id = new.ticket_id;
  if t.id is null or not (staff or t.user_id = auth.uid()) then raise exception 'Not allowed'; end if;
  new.author_id := auth.uid(); new.author_name := coalesce((select full_name from public.profiles where id = auth.uid()), '');
  new.from_staff := staff and t.user_id is distinct from auth.uid();
  if not new.from_staff then new.internal := false; end if;
  return new;
end;
$$;
drop trigger if exists guard_ticket_message on public.ticket_messages;
create trigger guard_ticket_message before insert on public.ticket_messages for each row execute function public.guard_ticket_message();

create or replace function private.on_ticket_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.support_tickets; first boolean;
begin
  select * into t from public.support_tickets where id = new.ticket_id;
  first := (select count(*) from public.ticket_messages where ticket_id = t.id) = 1;
  perform set_config('archmentor.internal', '1', true);
  if new.from_staff and not new.internal then
    update public.support_tickets set status = 'waiting' where id = t.id and status = 'open';
    perform private.notify(t.user_id, 'Reply from support', t.subject, '/support/' || t.id);
    perform private.send_email(t.email, t.name, 'Re: ' || t.subject, private.layout('Reply from our team',
      '<p style="padding:12px 16px;background:#f4f4f2;">' || private.para(left(new.body, 4000)) || '</p>', 'Reply', private.link('/support/' || t.id)), 'ticket-reply');
  elsif not new.from_staff then
    update public.support_tickets set status = 'open' where id = t.id and status in ('waiting', 'resolved');
    perform private.notify_perm('support.manage', case when first then 'New ticket: ' else 'Ticket reply: ' end || t.subject, t.name || ' · ' || t.category, '/staff/support');
    if first then
      perform private.email_admin('New support ticket: ' || t.subject, 'New support ticket',
        '<p><b>' || private.esc(t.name) || '</b> · ' || private.esc(t.email) || ' · ' || t.category || '</p><p>' || private.para(left(new.body, 2000)) || '</p>', 'Open support', private.link('/staff/support'), 'ticket-new');
      perform private.send_email(t.email, t.name, 'We got your message: ' || t.subject, private.layout('We got your message',
        '<p>Hello ' || private.esc(t.name) || ',</p><p>Thanks for writing. We usually reply within one working day.</p>', 'View your ticket', private.link('/support/' || t.id)), 'ticket-ack');
    end if;
  end if;
  perform set_config('archmentor.internal', '', true);
  return new;
end;
$$;
drop trigger if exists ticket_message_event on public.ticket_messages;
create trigger ticket_message_event after insert on public.ticket_messages for each row execute function private.on_ticket_message();

-- =====================================================================
-- 24. Email campaigns (draft → approved by someone else → sent in daily batches)
-- =====================================================================

create table if not exists public.email_campaigns (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null check (char_length(subject) between 3 and 200),
  heading     text not null default '',
  body        text not null default '',     -- plain text, paragraphs
  cta_label   text not null default '',
  cta_url     text not null default '',
  audience    text not null default 'subscribers' check (audience in ('subscribers', 'students', 'mentors', 'everyone')),
  status      text not null default 'draft' check (status in ('draft', 'approved', 'sending', 'sent', 'cancelled')),
  created_by  uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  sent_count  int not null default 0,
  total       int not null default 0,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create table if not exists public.campaign_recipients (
  campaign_id uuid not null references public.email_campaigns (id) on delete cascade,
  email       text not null,
  sent_at     timestamptz,
  primary key (campaign_id, email)
);
alter table public.profiles add column if not exists email_opt_out boolean not null default false;   -- news emails only; account emails always go
alter table public.profiles add column if not exists email_token uuid not null default gen_random_uuid();

create or replace function public.guard_campaign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('archmentor.internal', true) = '1' then return new; end if;
  if not public.has_perm('email.campaigns') then raise exception 'Not allowed'; end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); new.status := 'draft'; new.approved_by := null; new.sent_count := 0; return new; end if;
  if old.status in ('sending', 'sent') then raise exception 'This campaign was already sent'; end if;
  new.sent_count := old.sent_count; new.created_by := old.created_by;
  if new.status = 'approved' and old.status = 'draft' then
    if old.created_by = auth.uid() and not public.is_admin() then raise exception 'Someone else must approve a campaign you wrote'; end if;
    new.approved_by := auth.uid();
  elsif new.status not in ('draft', 'cancelled') and new.status is distinct from old.status then
    raise exception 'Use Send to send an approved campaign';
  end if;
  if old.status = 'approved' and (new.subject, new.body, new.heading, new.audience) is distinct from (old.subject, old.body, old.heading, old.audience) then
    new.status := 'draft'; new.approved_by := null;   -- edits need a fresh approval
  end if;
  return new;
end;
$$;
drop trigger if exists guard_campaign on public.email_campaigns;
create trigger guard_campaign before insert or update on public.email_campaigns for each row execute function public.guard_campaign();

-- Queues recipients once, then sends up to today's remaining allowance. Run again tomorrow (or the cron does) for the rest.
create or replace function public.send_campaign(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.email_campaigns; r record; n int := 0; cap int; used int; s public.site_settings := private.settings(); unsub text;
begin
  if auth.uid() is not null and not public.has_perm('email.campaigns') then raise exception 'Not allowed'; end if;
  select * into c from public.email_campaigns where id = p_id for update;
  if c.status not in ('approved', 'sending') then raise exception 'Approve the campaign first'; end if;
  if c.status = 'approved' then
    insert into public.campaign_recipients (campaign_id, email)
    select p_id, lower(e) from (
      select email e from public.subscribers where c.audience in ('subscribers', 'everyone')
      union select email from public.profiles where not email_opt_out and email is not null and
        ((c.audience = 'students' and role = 'student') or (c.audience = 'mentors' and role = 'mentor' and approved) or (c.audience = 'everyone' and role in ('student', 'mentor', 'professional')))
    ) x where e is not null and e <> '' on conflict do nothing;
    perform set_config('archmentor.internal', '1', true);
    update public.email_campaigns set status = 'sending', total = (select count(*) from public.campaign_recipients where campaign_id = p_id) where id = p_id;
    perform set_config('archmentor.internal', '', true);
    perform private.audit('campaign.send', 'email_campaigns', p_id::text, jsonb_build_object('audience', c.audience));
  end if;
  select count(*) into used from public.email_log where created_at > date_trunc('day', now()) and status = 'queued';
  cap := greatest(s.daily_email_cap - used, 0);
  for r in select cr.email, sb.token as sub_token, pr.email_token, coalesce(sb.name, pr.full_name, '') as nm
             from public.campaign_recipients cr
             left join public.subscribers sb on lower(sb.email) = cr.email
             left join public.profiles pr on lower(pr.email) = cr.email
            where cr.campaign_id = p_id and cr.sent_at is null limit cap loop
    unsub := case when r.sub_token is not null then private.link('/unsubscribe?t=' || r.sub_token) else private.link('/unsubscribe?u=' || r.email_token) end;
    perform private.send_email(r.email, r.nm, c.subject,
      private.layout(coalesce(nullif(c.heading, ''), c.subject), '<p>' || private.para(c.body) || '</p>', nullif(c.cta_label, ''), nullif(c.cta_url, ''),
        'You get these emails from ' || private.esc(s.site_name) || '. <a href="' || unsub || '" style="color:#8a8a8a;">Unsubscribe</a>.'),
      'campaign', unsub);
    update public.campaign_recipients set sent_at = now() where campaign_id = p_id and email = r.email;
    n := n + 1;
  end loop;
  perform set_config('archmentor.internal', '1', true);
  update public.email_campaigns set sent_count = sent_count + n,
         status = case when not exists (select 1 from public.campaign_recipients where campaign_id = p_id and sent_at is null) then 'sent' else 'sending' end,
         sent_at = case when not exists (select 1 from public.campaign_recipients where campaign_id = p_id and sent_at is null) then now() else sent_at end
   where id = p_id;
  perform set_config('archmentor.internal', '', true);
  return jsonb_build_object('sent_now', n, 'remaining', (select count(*) from public.campaign_recipients where campaign_id = p_id and sent_at is null));
end;
$$;
grant execute on function public.send_campaign(uuid) to authenticated;

create or replace function private.continue_campaigns()
returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  for c in select id from public.email_campaigns where status = 'sending' order by created_at loop
    perform public.send_campaign(c.id);
  end loop;
end;
$$;

-- Unsubscribe for account holders (news only)
create or replace function public.unsubscribe_user(t uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform set_config('archmentor.internal', '1', true);
  update public.profiles set email_opt_out = true where email_token = t;
  perform set_config('archmentor.internal', '', true);
  return found;
end;
$$;
grant execute on function public.unsubscribe_user(uuid) to anon, authenticated;

-- =====================================================================
-- 25. Community moderation and rate limits
-- =====================================================================

create table if not exists public.forum_reports (
  id          uuid primary key default gen_random_uuid(),
  item_kind   text not null check (item_kind in ('question', 'answer')),
  item_id     uuid not null,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason      text not null check (char_length(reason) between 3 and 500),
  status      text not null default 'open' check (status in ('open', 'removed', 'dismissed')),
  handled_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (item_kind, item_id, reporter_id)
);
alter table public.forum_questions add column if not exists hidden boolean not null default false;
alter table public.forum_answers add column if not exists hidden boolean not null default false;

create or replace function private.on_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.reporter_id := auth.uid(); new.status := 'open';
  perform private.notify_perm('community.moderate', 'Community report', new.reason, '/staff/community');
  return new;
end;
$$;
drop trigger if exists report_event on public.forum_reports;
create trigger report_event before insert on public.forum_reports for each row execute function private.on_report();

create or replace function public.moderate_report(p_id uuid, p_remove boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r public.forum_reports;
begin
  if not public.has_perm('community.moderate') then raise exception 'Not allowed'; end if;
  select * into r from public.forum_reports where id = p_id;
  perform set_config('archmentor.internal', '1', true);
  if p_remove then
    if r.item_kind = 'question' then update public.forum_questions set hidden = true where id = r.item_id;
    else update public.forum_answers set hidden = true where id = r.item_id; end if;
  end if;
  perform set_config('archmentor.internal', '', true);
  update public.forum_reports set status = case when p_remove then 'removed' else 'dismissed' end, handled_by = auth.uid()
   where item_kind = r.item_kind and item_id = r.item_id and status = 'open';
  perform private.audit('community.' || case when p_remove then 'hide' else 'dismiss' end, 'forum_' || r.item_kind || 's', r.item_id::text, jsonb_build_object('reason', r.reason));
end;
$$;
grant execute on function public.moderate_report(uuid, boolean) to authenticated;

create or replace function private.rate_limit_forum()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if public.is_staff() then return new; end if;
  if tg_table_name = 'forum_questions' then
    select count(*) into n from public.forum_questions where author_id = auth.uid() and created_at > now() - interval '1 hour';
    if n >= 5 then raise exception 'You have asked a lot in the last hour — please wait a little'; end if;
  else
    select count(*) into n from public.forum_answers where author_id = auth.uid() and created_at > now() - interval '1 hour';
    if n >= 20 then raise exception 'You have answered a lot in the last hour — please wait a little'; end if;
  end if;
  return new;
end;
$$;
create or replace function private.protect_hidden()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('archmentor.internal', true) is distinct from '1' and auth.uid() is not null and not public.has_perm('community.moderate') then
    new.hidden := old.hidden;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_hidden_q on public.forum_questions;
create trigger protect_hidden_q before update on public.forum_questions for each row execute function private.protect_hidden();
drop trigger if exists protect_hidden_a on public.forum_answers;
create trigger protect_hidden_a before update on public.forum_answers for each row execute function private.protect_hidden();

drop trigger if exists rate_limit_q on public.forum_questions;
create trigger rate_limit_q before insert on public.forum_questions for each row execute function private.rate_limit_forum();
drop trigger if exists rate_limit_a on public.forum_answers;
create trigger rate_limit_a before insert on public.forum_answers for each row execute function private.rate_limit_forum();

-- =====================================================================
-- 26. Scheduled Journal publishing and live-session completion
-- =====================================================================

alter table public.posts add column if not exists publish_at timestamptz;   -- set a future time to schedule

create or replace function private.publish_scheduled()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.posts set published = true, published_at = publish_at, publish_at = null
   where not published and publish_at is not null and publish_at <= now();
  -- live sessions that have ended count as delivered (starts the payout clock for paid events)
  update public.orders o set completed_at = now()
    from public.registrations g join public.sessions s on s.id = g.session_id
   where o.kind = 'event' and o.ref_id = g.id and o.completed_at is null and o.status in ('paid', 'partially_refunded')
     and coalesce(s.ends_at, s.starts_at + interval '2 hours') < now();
end;
$$;

-- =====================================================================
-- 27. Analytics (counts only; no personal data)
-- =====================================================================

create or replace function public.analytics_summary(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => p_days);
begin
  if not public.has_perm('analytics.read') then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'users', (select jsonb_object_agg(role, n) from (select role, count(*) n from public.profiles group by role) x),
    'new_users', (select count(*) from public.profiles where created_at > since),
    'mentors_live', (select count(*) from public.profiles where role = 'mentor' and approved),
    'mentors_waiting', (select count(*) from public.profiles where role = 'mentor' and not approved),
    'bookings', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from public.requests where created_at > since group by status) x),
    'registrations', (select count(*) from public.registrations where created_at > since and status <> 'cancelled'),
    'questions', (select count(*) from public.forum_questions where created_at > since),
    'answers', (select count(*) from public.forum_answers where created_at > since),
    'subscribers', (select count(*) from public.subscribers),
    'portfolios', (select count(*) from public.portfolio_projects where created_at > since),
    'tickets_open', (select count(*) from public.support_tickets where status in ('open', 'waiting')),
    'emails_sent', (select count(*) from public.email_log where created_at > since and status = 'queued'),
    'revenue_paise', coalesce((select sum(amount_paise) from public.financial_ledger where entry_type = 'payment_received' and created_at > since), 0),
    'signups_by_week', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'n', n) order by w), '[]'::jsonb) from (
        select to_char(date_trunc('week', created_at), 'YYYY-MM-DD') w, count(*) n from public.profiles where created_at > now() - interval '12 weeks' group by 1) x),
    'top_mentors', (select coalesce(jsonb_agg(jsonb_build_object('name', mentor_name, 'n', n) order by n desc), '[]'::jsonb) from (
        select mentor_name, count(*) n from public.requests where created_at > since group by mentor_name order by n desc limit 5) x));
end;
$$;
grant execute on function public.analytics_summary(int) to authenticated;
grant execute on function public.can_see_portfolio(uuid) to authenticated;

-- Admin tools now also open to staff with the right permission
create or replace function public.admin_sessions()
returns setof public.sessions language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.has_perm('events.manage')) then raise exception 'Not allowed'; end if;
  return query select * from public.sessions order by starts_at desc nulls last;
end;
$$;

-- =====================================================================
-- 28. Row level security for everything new + staff access to old tables
-- =====================================================================

do $$ declare t text; begin
  foreach t in array array['permissions', 'roles', 'role_permissions', 'staff_members', 'staff_invites', 'staff_role_assignments',
    'staff_permission_overrides', 'audit_logs', 'notifications', 'mentor_availability', 'mentor_time_off', 'commission_rules', 'orders',
    'payment_transactions', 'financial_ledger', 'refund_requests', 'mentor_finance', 'mentor_payouts', 'payout_items', 'ledger_adjustments',
    'portfolio_review_types', 'portfolio_projects', 'portfolio_files', 'portfolio_reviews', 'opportunities', 'resources', 'saved_items',
    'call_requests', 'call_notes', 'support_tickets', 'ticket_messages', 'email_campaigns', 'campaign_recipients', 'forum_reports'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- helper: (re)create a policy in one line
create or replace function private.pol(p_table text, p_name text, p_cmd text, p_using text, p_check text default null)
returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on public.%I', p_name, p_table);
  execute format('create policy %I on public.%I for %s %s %s', p_name, p_table, p_cmd,
    case when p_using is not null then 'using (' || p_using || ')' else '' end,
    case when p_check is not null then 'with check (' || p_check || ')' else '' end);
end;
$$;

select private.pol('permissions', 'read', 'select', 'true');
select private.pol('roles', 'read', 'select', 'true');
select private.pol('role_permissions', 'read', 'select', 'true');
select private.pol('staff_members', 'read', 'select', 'user_id = auth.uid() or public.has_perm(''staff.invite'') or public.has_perm(''staff.permissions.manage'')');
select private.pol('staff_invites', 'read', 'select', 'public.has_perm(''staff.invite'')');
select private.pol('staff_role_assignments', 'read', 'select', 'user_id = auth.uid() or public.has_perm(''staff.permissions.manage'')');
select private.pol('staff_permission_overrides', 'read', 'select', 'user_id = auth.uid() or public.has_perm(''staff.permissions.manage'')');
select private.pol('audit_logs', 'read', 'select', 'public.has_perm(''audit.read'')');
select private.pol('notifications', 'read own', 'select', 'user_id = auth.uid()');

-- profiles: you, and staff who may see users. The public directory uses the public_mentors view.
drop policy if exists "profiles: public approved mentors" on public.profiles;
select private.pol('profiles', 'profiles: read', 'select', 'id = auth.uid() or public.is_admin() or public.has_perm(''users.read'') or public.has_perm(''mentors.approve'')');
select private.pol('profiles', 'profiles: update own', 'update', 'id = auth.uid() or public.is_admin() or public.has_perm(''mentors.approve'')');

select private.pol('services', 'services: read', 'select', '(active and public.is_public_mentor(mentor_id)) or mentor_id = auth.uid() or public.is_admin()');
select private.pol('requests', 'requests: students create', 'insert', null,
  'student_id = auth.uid() and exists (select 1 from public.profiles s where s.id = auth.uid() and s.role = ''student'') and public.is_public_mentor(mentor_id)');
select private.pol('requests', 'requests: parties read', 'select', 'student_id = auth.uid() or mentor_id = auth.uid() or public.is_admin() or public.has_perm(''bookings.read'')');
select private.pol('requests', 'requests: parties update', 'update', 'student_id = auth.uid() or mentor_id = auth.uid() or public.is_admin() or public.has_perm(''bookings.manage'')');

select private.pol('mentor_availability', 'read', 'select', 'true');
select private.pol('mentor_availability', 'write own', 'all', 'mentor_id = auth.uid() or public.is_admin()', 'mentor_id = auth.uid() and public.is_approved_mentor() or public.is_admin()');
select private.pol('mentor_time_off', 'read own', 'select', 'mentor_id = auth.uid() or public.is_admin() or public.has_perm(''bookings.read'')');
select private.pol('mentor_time_off', 'write own', 'all', 'mentor_id = auth.uid() or public.is_admin()', 'mentor_id = auth.uid() or public.is_admin()');

select private.pol('sessions', 'sessions: staff write', 'all', 'public.has_perm(''events.manage'')', 'public.has_perm(''events.manage'')');
select private.pol('registrations', 'registrations: staff', 'select', 'public.has_perm(''events.manage'')');
select private.pol('registrations', 'registrations: cancel own', 'update', 'user_id = auth.uid() or public.has_perm(''events.manage'')');
select private.pol('posts', 'posts: staff read', 'select', 'public.has_perm(''blog.write'') or public.has_perm(''blog.publish'')');
select private.pol('posts', 'posts: staff write', 'all', 'public.has_perm(''blog.write'') or public.has_perm(''blog.publish'')', 'public.has_perm(''blog.publish'') or (public.has_perm(''blog.write'') and not published)');
select private.pol('videos', 'videos: content team', 'all', 'public.has_perm(''content.manage'')', 'public.has_perm(''content.manage'')');
select private.pol('forum_questions', 'forum q: moderators', 'all', 'public.has_perm(''community.moderate'')', 'public.has_perm(''community.moderate'')');
select private.pol('forum_answers', 'forum a: moderators', 'all', 'public.has_perm(''community.moderate'')', 'public.has_perm(''community.moderate'')');
select private.pol('submissions', 'submissions: content team', 'all', 'public.has_perm(''blog.write'')', 'public.has_perm(''blog.write'')');
select private.pol('subscribers', 'subscribers: email team', 'select', 'public.has_perm(''email.campaigns'')');
select private.pol('email_log', 'email log: email team', 'select', 'public.has_perm(''email.send'')');

-- finance (read-only from the website; writes go through the functions above)
select private.pol('commission_rules', 'read', 'select', 'public.has_perm(''commission.manage'') or public.has_perm(''finance.read'')');
select private.pol('orders', 'read', 'select', 'buyer_id = auth.uid() or public.has_perm(''finance.read'')');
select private.pol('payment_transactions', 'read', 'select', 'public.has_perm(''finance.read'')');
select private.pol('financial_ledger', 'read', 'select', 'public.has_perm(''finance.read'')');
select private.pol('refund_requests', 'read', 'select', 'requested_by = auth.uid() or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()) or public.has_perm(''finance.read'') or public.has_perm(''finance.refund'')');
select private.pol('mentor_finance', 'read', 'select', 'mentor_id = auth.uid() or public.has_perm(''finance.read'')');
select private.pol('mentor_finance', 'insert own', 'insert', null, 'mentor_id = auth.uid()');
select private.pol('mentor_finance', 'update own', 'update', 'mentor_id = auth.uid()', 'mentor_id = auth.uid()');
create or replace function public.guard_mentor_finance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.has_perm('finance.payout.approve') or current_setting('archmentor.internal', true) = '1' then return new; end if;
  if tg_op = 'INSERT' then new.provider_account_id := ''; new.kyc_status := 'not_started';
  else new.provider_account_id := old.provider_account_id; new.kyc_status := case when old.kyc_status in ('verified', 'rejected') and new.payout_display = old.payout_display then old.kyc_status else 'submitted' end; end if;
  if new.payout_display ~ '[0-9]{7,}' then raise exception 'Do not enter full account numbers — show only the last 4 digits'; end if;
  return new;
end;
$$;
drop trigger if exists guard_mentor_finance on public.mentor_finance;
create trigger guard_mentor_finance before insert or update on public.mentor_finance for each row execute function public.guard_mentor_finance();
select private.pol('mentor_payouts', 'read', 'select', 'mentor_id = auth.uid() or public.has_perm(''finance.read'')');
select private.pol('payout_items', 'read', 'select', 'public.has_perm(''finance.read'')');
select private.pol('ledger_adjustments', 'read', 'select', 'public.has_perm(''finance.adjust'') or public.has_perm(''finance.read'')');

-- portfolio
select private.pol('portfolio_review_types', 'read', 'select', 'active or public.has_perm(''portfolio.assign'')');
select private.pol('portfolio_review_types', 'write', 'all', 'public.has_perm(''portfolio.assign'')', 'public.has_perm(''portfolio.assign'')');
select private.pol('portfolio_projects', 'read', 'select', 'public.can_see_portfolio(id)');
select private.pol('portfolio_projects', 'create own', 'insert', null, 'auth.uid() is not null');
select private.pol('portfolio_projects', 'update', 'update', 'public.can_see_portfolio(id)');
select private.pol('portfolio_projects', 'delete own draft', 'delete', 'student_id = auth.uid() and status = ''draft''');
select private.pol('portfolio_files', 'read', 'select', 'public.can_see_portfolio(project_id)');
select private.pol('portfolio_files', 'add', 'insert', null, 'public.can_see_portfolio(project_id)');
select private.pol('portfolio_files', 'delete own draft', 'delete', 'uploaded_by = auth.uid() and exists (select 1 from public.portfolio_projects p where p.id = project_id and p.status = ''draft'')');
select private.pol('portfolio_reviews', 'read', 'select', 'public.can_see_portfolio(project_id) and (status = ''submitted'' or mentor_id = auth.uid() or public.has_perm(''portfolio.read''))');
select private.pol('portfolio_reviews', 'write', 'insert', null, 'mentor_id = auth.uid()');
select private.pol('portfolio_reviews', 'update', 'update', 'mentor_id = auth.uid() and status = ''draft''');

-- content
select private.pol('opportunities', 'read', 'select', 'published or public.has_perm(''content.manage'')');
select private.pol('opportunities', 'write', 'all', 'public.has_perm(''content.manage'')', 'public.has_perm(''content.manage'')');
select private.pol('resources', 'read', 'select', 'published or public.has_perm(''content.manage'')');
select private.pol('resources', 'write', 'all', 'public.has_perm(''content.manage'')', 'public.has_perm(''content.manage'')');
select private.pol('saved_items', 'own', 'all', 'user_id = auth.uid()', 'user_id = auth.uid()');

-- calls & support
select private.pol('call_requests', 'create', 'insert', null, 'true');
select private.pol('call_requests', 'staff', 'select', 'public.has_perm(''calls.manage'')');
select private.pol('call_requests', 'staff update', 'update', 'public.has_perm(''calls.manage'')', 'public.has_perm(''calls.manage'')');
select private.pol('call_notes', 'staff', 'all', 'public.has_perm(''calls.manage'')', 'public.has_perm(''calls.manage'') and author_id = auth.uid()');
select private.pol('support_tickets', 'create', 'insert', null, 'auth.uid() is not null');
select private.pol('support_tickets', 'read', 'select', 'user_id = auth.uid() or public.has_perm(''support.manage'')');
select private.pol('support_tickets', 'update', 'update', 'public.has_perm(''support.manage'')', 'public.has_perm(''support.manage'')');
select private.pol('ticket_messages', 'read', 'select', 'public.has_perm(''support.manage'') or (not internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()))');
select private.pol('ticket_messages', 'write', 'insert', null, 'auth.uid() is not null');

-- campaigns & moderation
select private.pol('email_campaigns', 'team', 'select', 'public.has_perm(''email.campaigns'')');
select private.pol('email_campaigns', 'team write', 'insert', null, 'public.has_perm(''email.campaigns'')');
select private.pol('email_campaigns', 'team update', 'update', 'public.has_perm(''email.campaigns'')', 'public.has_perm(''email.campaigns'')');
select private.pol('email_campaigns', 'team delete', 'delete', 'public.has_perm(''email.campaigns'') and status = ''draft''');
select private.pol('campaign_recipients', 'team', 'select', 'public.has_perm(''email.campaigns'')');
select private.pol('forum_reports', 'create', 'insert', null, 'auth.uid() is not null');
select private.pol('forum_reports', 'moderators', 'select', 'reporter_id = auth.uid() or public.has_perm(''community.moderate'')');

-- hidden community posts disappear for everyone except moderators and the author
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('forum_questions', 'forum_answers') and cmd = 'SELECT'
                                                              and policyname not like 'forum _: moderators' loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
select private.pol('forum_questions', 'forum q: read', 'select', 'not hidden or author_id = auth.uid() or public.has_perm(''community.moderate'')');
select private.pol('forum_answers', 'forum a: read', 'select', 'not hidden or author_id = auth.uid() or public.has_perm(''community.moderate'')');

-- Audit triggers on sensitive tables
do $$ declare t text; begin
  foreach t in array array['staff_members', 'staff_role_assignments', 'staff_permission_overrides', 'commission_rules', 'site_settings',
                           'mentor_finance', 'portfolio_review_types', 'role_permissions'] loop
    execute format('drop trigger if exists audit_row on public.%I', t);
    execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function private.audit_row()', t);
  end loop;
end $$;

-- =====================================================================
-- 29. Default content for new features (only if empty)
-- =====================================================================

insert into public.portfolio_review_types (title, description, price_paise, turnaround_days, sort)
select * from (values
  ('Portfolio review — written', 'A practising architect reads your portfolio and sends written feedback with a scored rubric and one follow-up round.', 0, 7, 1),
  ('Portfolio review + call', 'Written feedback plus a 30-minute call to walk through the changes.', 149900, 10, 2)
) v where not exists (select 1 from public.portfolio_review_types);

-- =====================================================================
-- 30. Scheduled jobs (added)
-- =====================================================================

select cron.schedule('archmentor-expire-holds', '*/10 * * * *', 'select private.expire_holds()');
select cron.schedule('archmentor-scheduled-publish', '*/15 * * * *', 'select private.publish_scheduled()');
select cron.schedule('archmentor-campaigns', '15 4 * * *', 'select private.continue_campaigns()');   -- 9:45 IST, continues big campaigns daily

-- =====================================================================
-- 31. Editable site text and images (staff with content.manage)
-- =====================================================================

create table if not exists public.site_content (
  key        text primary key check (key ~ '^[a-z0-9_.-]{2,120}$'),
  text_value text,
  image_url  text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
select private.pol('site_content', 'read', 'select', 'true');
select private.pol('site_content', 'write', 'insert', null, 'public.has_perm(''content.manage'')');
select private.pol('site_content', 'update', 'update', 'public.has_perm(''content.manage'')', 'public.has_perm(''content.manage'')');
select private.pol('site_content', 'delete', 'delete', 'public.has_perm(''content.manage'')');

create or replace function public.guard_site_content()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := auth.uid(); new.updated_at := now();
  if new.image_url is not null and new.image_url <> '' and new.image_url !~ '^https://' then raise exception 'Images must be https links'; end if;
  return new;
end;
$$;
drop trigger if exists guard_site_content on public.site_content;
create trigger guard_site_content before insert or update on public.site_content for each row execute function public.guard_site_content();
drop trigger if exists audit_row on public.site_content;
create trigger audit_row after insert or update or delete on public.site_content for each row execute function private.audit_row();

-- =====================================================================
-- 32. Opportunities posted by verified mentors and firms
--     Verified = approved mentor, or a professional/firm account the team has verified.
--     Their posts go live at once; other professionals' posts wait for review.
-- =====================================================================

alter table public.profiles add column if not exists firm_name text default '';     -- professionals posting for a practice
alter table public.opportunities add column if not exists posted_by uuid references public.profiles (id) on delete set null;
alter table public.opportunities add column if not exists poster_name text not null default '';
alter table public.opportunities add column if not exists status text not null default 'published';
alter table public.opportunities drop constraint if exists opportunities_status_check;
alter table public.opportunities add constraint opportunities_status_check check (status in ('pending', 'published', 'rejected', 'closed'));
alter table public.opportunities add column if not exists review_note text not null default '';
alter table public.opportunities add column if not exists contact_email text not null default '';

create or replace function public.is_verified_poster()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and approved and role in ('mentor', 'professional'));
$$;
grant execute on function public.is_verified_poster() to authenticated;

create or replace function public.guard_opportunity()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles; staff boolean := public.has_perm('content.manage');
begin
  if current_setting('archmentor.internal', true) = '1' then return new; end if;
  if new.url <> '' and new.url !~ '^https?://' then raise exception 'The link must start with https://'; end if;
  if tg_op = 'INSERT' then
    if staff then new.created_by := auth.uid(); return new; end if;
    select * into p from public.profiles where id = auth.uid();
    if p.id is null or p.role not in ('mentor', 'professional') then raise exception 'Only mentors and professionals can post opportunities'; end if;
    if (select count(*) from public.opportunities where posted_by = p.id and created_at > now() - interval '1 day') >= 5 then raise exception 'You can post up to 5 opportunities a day'; end if;
    new.posted_by := p.id; new.created_by := p.id;
    new.poster_name := coalesce(nullif(p.firm_name, ''), nullif(p.organisation, ''), p.full_name);
    new.status := case when p.approved then 'published' else 'pending' end;
    new.published := p.approved; new.review_note := '';
    return new;
  end if;
  if staff then
    new.published := new.status = 'published';
    return new;
  end if;
  if auth.uid() is distinct from old.posted_by then raise exception 'Not allowed'; end if;
  new.posted_by := old.posted_by; new.poster_name := old.poster_name; new.created_by := old.created_by; new.review_note := old.review_note;
  -- owners can close their post or edit it; edits by unverified posters go back to review
  if new.status not in ('closed', old.status) then new.status := old.status; end if;
  if new.status <> 'closed' then
    new.status := case when public.is_verified_poster() then 'published' when old.status = 'rejected' then 'pending' else 'pending' end;
  end if;
  new.published := new.status = 'published';
  return new;
end;
$$;
drop trigger if exists guard_opportunity on public.opportunities;
create trigger guard_opportunity before insert or update on public.opportunities for each row execute function public.guard_opportunity();

create or replace function private.on_opportunity()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if new.posted_by is null then return new; end if;
  select * into p from public.profiles where id = new.posted_by;
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    perform private.notify_perm('content.manage', 'Opportunity to review', new.title || ' · ' || new.poster_name, '/staff/content');
  elsif tg_op = 'UPDATE' and new.status = 'published' and old.status = 'pending' and auth.uid() is distinct from new.posted_by then
    perform private.notify(p.id, 'Your opportunity is live', new.title, '/opportunities');
    perform private.send_email(p.email, p.full_name, 'Your opportunity is live: ' || new.title,
      private.layout('Your post is live', '<p>Hello ' || private.esc(p.full_name) || ',</p><p><b>' || private.esc(new.title) || '</b> is now on the Opportunities page.</p>',
        'See it', private.link('/opportunities')), 'opportunity-live');
  elsif tg_op = 'UPDATE' and new.status = 'rejected' and old.status <> 'rejected' then
    perform private.notify(p.id, 'Opportunity not published', coalesce(nullif(new.review_note, ''), new.title), '/dashboard?tab=opportunities');
    perform private.send_email(p.email, p.full_name, 'About your opportunity: ' || new.title,
      private.layout('Your post was not published', '<p>Hello ' || private.esc(p.full_name) || ',</p><p>We could not publish <b>' || private.esc(new.title) || '</b>.</p>'
        || case when new.review_note <> '' then '<p style="padding:12px 16px;background:#f4f4f2;">' || private.para(new.review_note) || '</p>' else '' end
        || '<p>You can edit it and send it again from your dashboard.</p>', 'Open your dashboard', private.link('/dashboard?tab=opportunities')), 'opportunity-rejected');
  end if;
  return new;
end;
$$;
drop trigger if exists opportunity_event on public.opportunities;
create trigger opportunity_event after insert or update of status on public.opportunities for each row execute function private.on_opportunity();

select private.pol('opportunities', 'read', 'select', 'published or posted_by = auth.uid() or public.has_perm(''content.manage'')');
select private.pol('opportunities', 'post own', 'insert', null, 'auth.uid() is not null');
select private.pol('opportunities', 'edit own', 'update', 'posted_by = auth.uid()', 'posted_by = auth.uid()');
select private.pol('opportunities', 'delete own', 'delete', 'posted_by = auth.uid()');

-- Firms: professionals can be verified by staff with mentors.approve, same switch as mentors
create or replace function private.on_professional_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'professional' and new.approved and not old.approved then
    perform private.notify(new.id, 'Your account is verified', 'You can now post opportunities that go live straight away.', '/dashboard?tab=opportunities');
    perform private.send_email(new.email, new.full_name, 'Your account is verified',
      private.layout('You are verified', '<p>Hello ' || private.esc(new.full_name) || ',</p><p>Your professional account' || coalesce(' for <b>' || private.esc(nullif(new.firm_name, '')) || '</b>', '')
        || ' is verified. Opportunities you post now go live straight away.</p>', 'Post an opportunity', private.link('/dashboard?tab=opportunities')), 'firm-verified');
  end if;
  return new;
end;
$$;
drop trigger if exists professional_verified on public.profiles;
create trigger professional_verified after update of approved on public.profiles for each row execute function private.on_professional_verified();

-- Internal functions stay private
revoke all on all functions in schema private from public, anon, authenticated;
