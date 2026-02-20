-- Add tags to generations (descriptive tags generated on insert for search).
-- Run in Supabase SQL Editor if you already have the schema applied.

alter table public.generations
  add column if not exists tags text[] default '{}';

create index if not exists idx_generations_tags on public.generations using gin(tags);
create index if not exists idx_generations_app_id on public.generations(app_id);
