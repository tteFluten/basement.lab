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

create index if not exists idx_generations_user_id on public.generations(user_id);
create index if not exists idx_generations_project_id on public.generations(project_id);
create index if not exists idx_generations_created_at on public.generations(created_at desc);
create index if not exists idx_generations_tags on public.generations using gin(tags);
create index if not exists idx_generations_app_id on public.generations(app_id);

-- Optional: seed admin. Run hub/supabase/seed.sql after this schema to set lautaro@basement.studio as admin.
