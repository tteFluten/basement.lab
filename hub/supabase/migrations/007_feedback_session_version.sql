-- Add version label to feedback sessions (e.g. "v1", "v2.3", "MVP")
ALTER TABLE feedback_sessions ADD COLUMN IF NOT EXISTS version varchar(32);
