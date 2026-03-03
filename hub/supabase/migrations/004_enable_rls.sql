-- Enable Row Level Security on all public tables.
-- The app uses SUPABASE_SERVICE_ROLE_KEY in API routes, which bypasses RLS.
-- With RLS enabled, direct access (e.g. anon key or SQL editor without role) is denied by default.

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.generations enable row level security;
alter table public.submitted_apps enable row level security;
alter table public.bug_reports enable row level security;
alter table public.app_ratings enable row level security;

-- No policies are added: default is deny all. Service role (used by Next.js API) bypasses RLS and keeps full access.