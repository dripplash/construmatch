CREATE TABLE IF NOT EXISTS project_uploads (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, upload_id)
);
