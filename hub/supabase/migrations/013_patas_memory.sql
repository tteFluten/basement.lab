-- Patas long-term memory: stores a Gemini-generated summary of each user's
-- conversation history with Patas. Updated periodically, not on every message.
ALTER TABLE users ADD COLUMN IF NOT EXISTS patas_memory TEXT;
