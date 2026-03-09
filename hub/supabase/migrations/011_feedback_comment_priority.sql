-- Priority for review items: high, medium, low (default medium)
ALTER TABLE feedback_comments
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('high', 'medium', 'low'));
