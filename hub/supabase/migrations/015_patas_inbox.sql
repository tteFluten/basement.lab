-- Patas inbox: suggestions, bugs, and feature requests submitted by any user via Patas
CREATE TABLE IF NOT EXISTS patas_inbox (
  id         SERIAL PRIMARY KEY,
  message    TEXT        NOT NULL,
  user_email TEXT,
  user_name  TEXT,
  resolved   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
