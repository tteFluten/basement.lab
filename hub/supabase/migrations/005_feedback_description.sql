-- Add description to feedback_projects and feedback_sessions
ALTER TABLE feedback_projects ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE feedback_sessions ADD COLUMN IF NOT EXISTS description text;
