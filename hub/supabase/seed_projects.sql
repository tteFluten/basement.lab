-- ============================================================
-- Seed: projects, members, and user full_name updates
-- Run once in Neon SQL Editor.
-- Safe to re-run (uses ON CONFLICT DO NOTHING).
-- ============================================================


-- ------------------------------------------------------------
-- 1. Update full_name for known users
-- ------------------------------------------------------------

UPDATE public.users SET full_name = 'Juan Lautaro Martín', updated_at = now() WHERE email = 'lautaro@basement.studio';
UPDATE public.users SET full_name = 'David Szadorski',     updated_at = now() WHERE email = 'david@basement.studio';
UPDATE public.users SET full_name = 'Delfina Mieth',       updated_at = now() WHERE email = 'delfina@basement.studio';
UPDATE public.users SET full_name = 'Kalil Fiat',          updated_at = now() WHERE email = 'kalil@basement.studio';
UPDATE public.users SET full_name = 'Carla Corrales',      updated_at = now() WHERE email = 'carlac@basement.studio';
UPDATE public.users SET full_name = 'Macarena Blanco',     updated_at = now() WHERE email = 'macarenab@basement.studio';
UPDATE public.users SET full_name = 'Malena Papanicolau',  updated_at = now() WHERE email = 'malena@basement.studio';
UPDATE public.users SET full_name = 'Ignacio Mandagaran',  updated_at = now() WHERE email = 'ignacio@basement.studio';
UPDATE public.users SET full_name = 'Stefania Adam',       updated_at = now() WHERE email = 'stefania@basement.studio';
UPDATE public.users SET full_name = 'Tomás Ferreras',      updated_at = now() WHERE email = 'tomas@basement.studio';
UPDATE public.users SET full_name = 'Wanda Hilen Arca',    updated_at = now() WHERE email = 'wanda@basement.studio';
UPDATE public.users SET full_name = 'Camila Enrique',      updated_at = now() WHERE email = 'camila@basement.studio';
UPDATE public.users SET full_name = 'Gonzalo Moreira',     updated_at = now() WHERE email = 'gonzalo.moreira@basement.studio';
UPDATE public.users SET full_name = 'Federico Álvarez',    updated_at = now() WHERE email = 'federico@basement.studio';


-- ------------------------------------------------------------
-- 2. Insert projects
-- ------------------------------------------------------------

INSERT INTO public.projects (name, client) VALUES
  ('ONYX',         'Onyx Security Inc'),
  ('Basement',     'basement.studio'),
  ('ShortA',       'Shorta Global Holdings Ltd.'),
  ('XBOW Website', 'XBOW USA Inc.'),
  ('XBOW Motion',  'XBOW USA Inc.'),
  ('Foundry',      'FoundryLabs, Inc.'),
  ('Native',       'RockSteady Cloud, Inc.'),
  ('GreyLock',     'Greylock Partners'),
  ('Profound',     'Profound')
ON CONFLICT DO NOTHING;


-- ------------------------------------------------------------
-- 3. Insert project members
--    Resolves project by name and user by email.
-- ------------------------------------------------------------

INSERT INTO public.project_members (project_id, user_id)
SELECT p.id, u.id
FROM (VALUES
  -- ONYX
  ('ONYX',         'kalil@basement.studio'),
  ('ONYX',         'delfina@basement.studio'),
  -- Basement
  ('Basement',     'lautaro@basement.studio'),
  ('Basement',     'kalil@basement.studio'),
  ('Basement',     'delfina@basement.studio'),
  ('Basement',     'carlac@basement.studio'),
  ('Basement',     'wanda@basement.studio'),
  -- ShortA
  ('ShortA',       'camila@basement.studio'),
  ('ShortA',       'kalil@basement.studio'),
  ('ShortA',       'wanda@basement.studio'),
  -- XBOW Website
  ('XBOW Website', 'federico@basement.studio'),
  ('XBOW Website', 'macarenab@basement.studio'),
  ('XBOW Website', 'malena@basement.studio'),
  ('XBOW Website', 'ignacio@basement.studio'),
  ('XBOW Website', 'tomas@basement.studio'),
  ('XBOW Website', 'wanda@basement.studio'),
  -- XBOW Motion
  ('XBOW Motion',  'david@basement.studio'),
  -- Foundry
  ('Foundry',      'stefania@basement.studio'),
  -- Native
  ('Native',       'carlac@basement.studio'),
  ('Native',       'lautaro@basement.studio'),
  -- GreyLock
  ('GreyLock',     'gonzalo.moreira@basement.studio'),
  -- Profound
  ('Profound',     'wanda@basement.studio')
) AS v(project_name, email)
JOIN public.projects p ON p.name = v.project_name
JOIN public.users   u ON u.email = v.email
ON CONFLICT DO NOTHING;
