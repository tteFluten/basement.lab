-- Patas shared global memory: a single-row table storing institutional knowledge
-- accumulated from admin conversations. Visible to all users via the AI chat context.
CREATE TABLE IF NOT EXISTS patas_global_memory (
  id      INTEGER PRIMARY KEY DEFAULT 1,
  content TEXT    NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed with an empty row so GET always returns something
INSERT INTO patas_global_memory (id, content) VALUES (1, '')
ON CONFLICT (id) DO NOTHING;
