-- ============================================================
-- Basement Lab — run all pending migrations (safe / idempotent)
-- Paste this in the Neon SQL Editor and run it all at once.
-- Every statement uses IF NOT EXISTS or DO $$ guards so it's
-- safe to run even if some migrations were already applied.
-- ============================================================

-- 001: tags + indexes on generations
ALTER TABLE generations ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_generations_tags   ON generations USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_generations_app_id ON generations(app_id);

-- 001: thumb_url + prompt + note (added in schema.sql alters, repeated here for safety)
ALTER TABLE generations ADD COLUMN IF NOT EXISTS thumb_url text;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS prompt    text;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS note      text;

-- 002: icon on submitted_apps
ALTER TABLE submitted_apps ADD COLUMN IF NOT EXISTS icon     text;
ALTER TABLE submitted_apps ADD COLUMN IF NOT EXISTS external boolean NOT NULL DEFAULT false;

-- 003a: is_public on generations
ALTER TABLE generations ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_generations_is_public ON generations(is_public) WHERE is_public = true;

-- 003b: feedback tables
CREATE TABLE IF NOT EXISTS feedback_projects (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  owner_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_sessions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES feedback_projects(id) ON DELETE CASCADE NOT NULL,
  title      text NOT NULL,
  video_url  text,
  duration_s float,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS feedback_comments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  uuid REFERENCES feedback_sessions(id) ON DELETE CASCADE NOT NULL,
  timestamp_s float NOT NULL DEFAULT 0,
  text        text NOT NULL DEFAULT '',
  drawing     jsonb,
  author_name text NOT NULL DEFAULT 'Anonymous',
  author_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  anon_token  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 005: description on feedback tables
ALTER TABLE feedback_projects ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE feedback_sessions  ADD COLUMN IF NOT EXISTS description text;

-- 006: feedback project membership
ALTER TABLE feedback_projects
  ADD COLUMN IF NOT EXISTS linked_project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS feedback_project_members (
  feedback_project_id uuid REFERENCES feedback_projects(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
  joined_at           timestamptz DEFAULT now(),
  PRIMARY KEY (feedback_project_id, user_id)
);

-- 007: version on feedback sessions
ALTER TABLE feedback_sessions ADD COLUMN IF NOT EXISTS version varchar(32);

-- 008: thumbnail on feedback sessions
ALTER TABLE feedback_sessions ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- 009: session type + positional annotations
ALTER TABLE feedback_sessions  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'video';
ALTER TABLE feedback_sessions  ADD COLUMN IF NOT EXISTS source_url   text;
ALTER TABLE feedback_comments  ADD COLUMN IF NOT EXISTS x_pct        float8;
ALTER TABLE feedback_comments  ADD COLUMN IF NOT EXISTS y_pct        float8;
ALTER TABLE feedback_comments  ADD COLUMN IF NOT EXISTS screenshot_url text;

-- 010: completed flag on comments
ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;

-- 011: priority on comments
ALTER TABLE feedback_comments
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
-- Add CHECK constraint only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'feedback_comments' AND constraint_name = 'feedback_comments_priority_check'
  ) THEN
    ALTER TABLE feedback_comments
      ADD CONSTRAINT feedback_comments_priority_check
      CHECK (priority IN ('high', 'medium', 'low'));
  END IF;
END $$;

-- 012: rename blob_url → image_url (guarded — safe if already renamed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'blob_url'
  ) THEN
    ALTER TABLE generations RENAME COLUMN blob_url TO image_url;
  END IF;
END $$;

-- Ensure image_url exists (in case DB was created fresh without blob_url)
ALTER TABLE generations ADD COLUMN IF NOT EXISTS image_url text;

-- Final indexes (safe to re-run)
CREATE INDEX IF NOT EXISTS idx_generations_user_id    ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_project_id ON generations(project_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
