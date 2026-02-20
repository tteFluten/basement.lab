-- Seed admin user. Run in Supabase SQL Editor after schema.sql.
-- Uses upsert so you can run multiple times.

insert into public.users (email, full_name, role)
values ('lautaro@basement.studio', 'Lautaro', 'admin')
on conflict (email) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  updated_at = now();
