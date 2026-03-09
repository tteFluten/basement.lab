-- Optional completed flag for review checklist view
ALTER TABLE feedback_comments
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
