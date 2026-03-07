-- Link feedback projects to work/client projects
ALTER TABLE feedback_projects
  ADD COLUMN IF NOT EXISTS linked_project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

-- Direct membership table: users self-join feedback projects
CREATE TABLE IF NOT EXISTS feedback_project_members (
  feedback_project_id uuid REFERENCES feedback_projects(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
  joined_at           timestamptz DEFAULT now(),
  PRIMARY KEY (feedback_project_id, user_id)
);
