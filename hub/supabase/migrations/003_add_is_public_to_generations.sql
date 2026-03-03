-- Visibility: public (visible to all) vs private (only owner).
alter table public.generations
  add column if not exists is_public boolean not null default false;

create index if not exists idx_generations_is_public on public.generations(is_public) where is_public = true;
