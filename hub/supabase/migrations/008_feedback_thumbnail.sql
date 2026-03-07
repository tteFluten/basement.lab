-- Add thumbnail URL to feedback sessions
ALTER TABLE feedback_sessions ADD COLUMN IF NOT EXISTS thumbnail_url text;
