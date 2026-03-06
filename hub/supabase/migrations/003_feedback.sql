-- MonoFeedback: projects, sessions, comments

CREATE TABLE IF NOT EXISTS feedback_projects (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  owner_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_sessions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid REFERENCES feedback_projects(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  video_url   text,
  duration_s  float,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL
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
