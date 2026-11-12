-- ArchMentor database schema for Supabase
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to run again: it drops and recreates policies and triggers.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  full_name     text not null default '',
  role          text not null default 'student' check (role in ('student', 'mentor', 'admin')),
  approved      boolean not null default false,          -- mentors appear publicly only once approved
  title         text default '',                          -- e.g. "Practising Architect"
  organisation  text default '',
  bio           text default '',
  photo_url     text default '',
  linkedin_url  text default '',
  specialties   text[] not null default '{}',             -- any of: portfolio, career, admissions
  stage         text default '',                          -- students: year or stage
  created_at    timestamptz not null default now()
);

create table if not exists public.requests (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles (id) on delete cascade,
  mentor_id      uuid not null references public.profiles (id) on delete cascade,
  student_name   text not null default '',
  student_email  text not null default '',
  mentor_name    text not null default '',
  service        text not null check (service in ('portfolio', 'career', 'admissions')),
  stage          text default '',
  message        text not null default '',
  preferred_time text default '',
  status         text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'done', 'cancelled')),
  meeting_link   text default '',
  mentor_note    text default '',
  created_at     timestamptz not null default now()
);

create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text default '',
  kind        text default 'Career talk',
  starts_at   timestamptz,
  format      text default 'Online, interactive',
  join_link   text default '',          -- shared with registrants by email; not shown publicly
  featured    boolean not null default false,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.registrations (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  name        text not null,
  email       text not null,
  created_at  timestamptz not null default now(),
  unique (session_id, email)
);

create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  dek          text default '',
  body         text default '',          -- simple markdown: ## headings, - lists, > quotes, **bold**, [links](url)
  tag          text default '',
  author_name  text default '',
  cover_url    text default '',
  youtube_id   text default '',          -- optional video shown with the story
  published    boolean not null default false,
  published_at timestamptz default now(),
  created_at   timestamptz not null default now()
);

create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  youtube_id  text not null,             -- the part after v= or /shorts/
  title       text not null,
  kind        text not null default 'full' check (kind in ('full', 'short')),
  featured    boolean not null default false,
  sort        int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  name        text default '',
  stage       text default '',
  question    text not null,
  show_name   boolean not null default false,
  answer      text default '',
  answered_by text default '',
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

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

-- ============================================================
-- Helpers
-- ============================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- New sign-up → profile row. Role comes from sign-up metadata, limited to student/mentor.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'role' = 'mentor' then 'mentor' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change role, approval or email on a profile.
-- (auth.uid() is null when you run SQL yourself in the Supabase SQL editor; that is allowed.)
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
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- Requests: students may only cancel; mentors may change status, link and note. Fill names server-side.
create or replace function public.guard_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select full_name, email into new.student_name, new.student_email from public.profiles where id = new.student_id;
    select full_name into new.mentor_name from public.profiles where id = new.mentor_id;
    new.status := 'pending';
    new.meeting_link := '';
    new.mentor_note := '';
    return new;
  end if;
  if auth.uid() is null or public.is_admin() then return new; end if;
  if auth.uid() = old.mentor_id then
    new.student_id := old.student_id; new.mentor_id := old.mentor_id;
    new.student_name := old.student_name; new.student_email := old.student_email; new.mentor_name := old.mentor_name;
    new.service := old.service; new.stage := old.stage; new.message := old.message; new.preferred_time := old.preferred_time;
    return new;
  end if;
  if auth.uid() = old.student_id then
    if new.status <> 'cancelled' then raise exception 'Students can only cancel a request'; end if;
    new := old;
    new.status := 'cancelled';
    return new;
  end if;
  raise exception 'Not allowed';
end;
$$;

drop trigger if exists guard_request on public.requests;
create trigger guard_request before insert or update on public.requests
  for each row execute function public.guard_request();

-- ============================================================
-- Row level security
-- ============================================================

alter table public.profiles      enable row level security;
alter table public.requests      enable row level security;
alter table public.sessions      enable row level security;
alter table public.registrations enable row level security;
alter table public.posts         enable row level security;
alter table public.videos        enable row level security;
alter table public.questions     enable row level security;
alter table public.submissions   enable row level security;
alter table public.subscribers   enable row level security;

-- profiles
drop policy if exists "profiles: public approved mentors" on public.profiles;
create policy "profiles: public approved mentors" on public.profiles for select
  using ((role = 'mentor' and approved) or id = auth.uid() or public.is_admin());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: admin delete" on public.profiles;
create policy "profiles: admin delete" on public.profiles for delete using (public.is_admin());

-- requests
drop policy if exists "requests: students create" on public.requests;
create policy "requests: students create" on public.requests for insert
  with check (
    student_id = auth.uid()
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

-- published content: sessions, posts, videos
drop policy if exists "sessions: read published" on public.sessions;
create policy "sessions: read published" on public.sessions for select using (published or public.is_admin());
drop policy if exists "sessions: admin write" on public.sessions;
create policy "sessions: admin write" on public.sessions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "posts: read published" on public.posts;
create policy "posts: read published" on public.posts for select using (published or public.is_admin());
drop policy if exists "posts: admin write" on public.posts;
create policy "posts: admin write" on public.posts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "videos: read published" on public.videos;
create policy "videos: read published" on public.videos for select using (published or public.is_admin());
drop policy if exists "videos: admin write" on public.videos;
create policy "videos: admin write" on public.videos for all using (public.is_admin()) with check (public.is_admin());

-- questions: anyone asks; published answers are public
drop policy if exists "questions: anyone asks" on public.questions;
create policy "questions: anyone asks" on public.questions for insert
  with check (published = false and coalesce(answer, '') = '');
drop policy if exists "questions: read published" on public.questions;
create policy "questions: read published" on public.questions for select using (published or public.is_admin());
drop policy if exists "questions: admin write" on public.questions;
create policy "questions: admin write" on public.questions for update using (public.is_admin());
drop policy if exists "questions: admin delete" on public.questions;
create policy "questions: admin delete" on public.questions for delete using (public.is_admin());

-- write-only forms: registrations, submissions, subscribers
drop policy if exists "registrations: anyone registers" on public.registrations;
create policy "registrations: anyone registers" on public.registrations for insert
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.published));
drop policy if exists "registrations: admin" on public.registrations;
create policy "registrations: admin" on public.registrations for select using (public.is_admin());
drop policy if exists "registrations: admin delete" on public.registrations;
create policy "registrations: admin delete" on public.registrations for delete using (public.is_admin());

drop policy if exists "submissions: anyone submits" on public.submissions;
create policy "submissions: anyone submits" on public.submissions for insert with check (status = 'new');
drop policy if exists "submissions: admin" on public.submissions;
create policy "submissions: admin" on public.submissions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "subscribers: anyone subscribes" on public.subscribers;
create policy "subscribers: anyone subscribes" on public.subscribers for insert with check (true);
drop policy if exists "subscribers: admin" on public.subscribers;
create policy "subscribers: admin" on public.subscribers for all using (public.is_admin()) with check (public.is_admin());

-- Public count of registrations per session (without exposing names or emails)
create or replace function public.session_seat_count(sid uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.registrations where session_id = sid;
$$;
grant execute on function public.session_seat_count(uuid) to anon, authenticated;
