-- Add optional icon (template icon name) to submitted_apps. Run if you already had submitted_apps without this column.
alter table public.submitted_apps add column if not exists icon text;
