-- ============================================================
-- Basement Lab — Full schema for Neon (fresh database setup)
-- Run this once in the Neon SQL Editor.
-- ============================================================

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  full_name     text,
  nickname      text,
  avatar_url    text,
  password_hash text,
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  client        text,
  thumbnail_url text,
  links         jsonb DEFAULT '{}',
  start_date    date,
  end_date      date,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- PROJECT MEMBERS
CREATE TABLE IF NOT EXISTS project_members (
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  role        text DEFAULT 'member',
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- GENERATIONS (image history — image URL in R2, not base64)
CREATE TABLE IF NOT EXISTS generations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  app_id     text NOT NULL,
  image_url  text NOT NULL,
  thumb_url  text,
  width      int,
  height     int,
  name       text,
  prompt     text,
  note       text,
  tags       text[] DEFAULT '{}',
  is_public  boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generations_user_id    ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_project_id ON generations(project_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_tags       ON generations USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_generations_app_id     ON generations(app_id);
CREATE INDEX IF NOT EXISTS idx_generations_is_public  ON generations(is_public) WHERE is_public = true;

-- SUBMITTED APPS
CREATE TABLE IF NOT EXISTS submitted_apps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  title         text NOT NULL,
  description   text,
  deploy_link   text NOT NULL,
  edit_link     text,
  thumbnail_url text,
  icon          text,
  version       text DEFAULT '1.0',
  tags          text[] DEFAULT '{}',
  external      boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submitted_apps_user_id    ON submitted_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_submitted_apps_created_at ON submitted_apps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submitted_apps_title      ON submitted_apps(lower(title));
CREATE INDEX IF NOT EXISTS idx_submitted_apps_tags       ON submitted_apps USING gin(tags);

-- BUG REPORTS
CREATE TABLE IF NOT EXISTS bug_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      uuid REFERENCES submitted_apps(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_app_id  ON bug_reports(app_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON bug_reports(user_id);

-- APP RATINGS
CREATE TABLE IF NOT EXISTS app_ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id     uuid REFERENCES submitted_apps(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  score      int NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at timestamptz DEFAULT now(),
  UNIQUE (app_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_ratings_app_id  ON app_ratings(app_id);
CREATE INDEX IF NOT EXISTS idx_app_ratings_user_id ON app_ratings(user_id);

-- FEEDBACK PROJECTS
CREATE TABLE IF NOT EXISTS feedback_projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  name              text NOT NULL,
  description       text,
  owner_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  linked_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now()
);

-- FEEDBACK PROJECT MEMBERS (self-join)
CREATE TABLE IF NOT EXISTS feedback_project_members (
  feedback_project_id uuid REFERENCES feedback_projects(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
  joined_at           timestamptz DEFAULT now(),
  PRIMARY KEY (feedback_project_id, user_id)
);

-- FEEDBACK SESSIONS
CREATE TABLE IF NOT EXISTS feedback_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES feedback_projects(id) ON DELETE CASCADE NOT NULL,
  title        text NOT NULL,
  description  text,
  version      varchar(32),
  session_type text NOT NULL DEFAULT 'video',
  video_url    text,
  source_url   text,
  thumbnail_url text,
  duration_s   float,
  created_at   timestamptz DEFAULT now(),
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_sessions_project_id ON feedback_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_created_at ON feedback_sessions(created_at DESC);

-- FEEDBACK COMMENTS
CREATE TABLE IF NOT EXISTS feedback_comments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid REFERENCES feedback_sessions(id) ON DELETE CASCADE NOT NULL,
  timestamp_s    float NOT NULL DEFAULT 0,
  text           text NOT NULL DEFAULT '',
  drawing        jsonb,
  x_pct          float8,
  y_pct          float8,
  screenshot_url text,
  author_name    text NOT NULL DEFAULT 'Anonymous',
  author_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  anon_token     text,
  completed      boolean NOT NULL DEFAULT false,
  priority       text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_comments_session_id ON feedback_comments(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_created_at ON feedback_comments(created_at);
