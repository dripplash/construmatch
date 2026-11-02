ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'professional';

ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_previous_status verification_status;
UPDATE users SET username = CASE WHEN role = 'admin' THEN 'estructura.control' ELSE 'cm_' || left(replace(id::text, '-', ''), 12) END WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));

ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS registration_reference text;

CREATE TABLE IF NOT EXISTS moderation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES users(id),
  target_type text NOT NULL CHECK (target_type IN ('user', 'project')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id),
  resolution_reason text
);
CREATE INDEX IF NOT EXISTS moderation_reports_open_idx ON moderation_reports(created_at) WHERE status = 'open';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS moderation_previous_status project_status;
