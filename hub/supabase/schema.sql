-- Basement Lab: users, projects, project members, generations (history)
-- Run this in Supabase SQL Editor after creating a project.

-- Users (auth can be Supabase Auth or NextAuth; this table can mirror or extend)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  nickname text,
  avatar_url text,
  password_hash text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- If users already existed without status, add the column
alter table public.users
  add column if not exists status text not null default 'active';

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text,
  thumbnail_url text,
  links jsonb default '{}', -- { web, linear, figma, slack_client, slack_internal, others: [] }
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Project members (user <-> project)
create table if not exists public.project_members (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role text default 'member',
  created_at timestamptz default now(),
  primary key (project_id, user_id)
);

-- Generations (history items); image stored in Blob, we keep URL + metadata
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  app_id text not null,
  blob_url text not null,
  width int,
  height int,
  name text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- If generations already existed without tags/thumb_url, add the columns
alter table public.generations
  add column if not exists tags text[] default '{}';
alter table public.generations
  add column if not exists thumb_url text;
alter table public.generations
  add column if not exists prompt text;
alter table public.generations
  add column if not exists note text;

create index if not exists idx_generations_user_id on public.generations(user_id);
create index if not exists idx_generations_project_id on public.generations(project_id);
create index if not exists idx_generations_created_at on public.generations(created_at desc);
create index if not exists idx_generations_tags on public.generations using gin(tags);
create index if not exists idx_generations_app_id on public.generations(app_id);

-- User-submitted apps (title, description, deploy/edit links, optional thumbnail; listed separately from lab apps)
create table if not exists public.submitted_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  title text not null,
  description text,
  deploy_link text not null,
  edit_link text,
  thumbnail_url text,
  icon text,
  version text default '1.0',
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- If submitted_apps already existed without icon, add the column
alter table public.submitted_apps
  add column if not exists icon text;

create index if not exists idx_submitted_apps_user_id on public.submitted_apps(user_id);
create index if not exists idx_submitted_apps_created_at on public.submitted_apps(created_at desc);
create index if not exists idx_submitted_apps_title on public.submitted_apps(lower(title));
create index if not exists idx_submitted_apps_tags on public.submitted_apps using gin(tags);

-- Bug reports on submitted apps
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references public.submitted_apps(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'resolved', 'closed')),
  created_at timestamptz default now()
);

create index if not exists idx_bug_reports_app_id on public.bug_reports(app_id);
create index if not exists idx_bug_reports_user_id on public.bug_reports(user_id);

-- Ratings / points on submitted apps (one per user per app)
create table if not exists public.app_ratings (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references public.submitted_apps(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  score int not null check (score >= 1 and score <= 5),
  created_at timestamptz default now(),
  unique (app_id, user_id)
);

create index if not exists idx_app_ratings_app_id on public.app_ratings(app_id);
create index if not exists idx_app_ratings_user_id on public.app_ratings(user_id);

-- Optional: seed admin. Run hub/supabase/seed.sql after this schema to set lautaro@basement.studio as admin.
