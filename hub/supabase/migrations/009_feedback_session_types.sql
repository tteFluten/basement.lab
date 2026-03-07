-- Add session type support (video | image | url)
ALTER TABLE feedback_sessions
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS source_url text;

-- Add positional annotation fields to comments
ALTER TABLE feedback_comments
  ADD COLUMN IF NOT EXISTS x_pct float8,
  ADD COLUMN IF NOT EXISTS y_pct float8,
  ADD COLUMN IF NOT EXISTS screenshot_url text;
