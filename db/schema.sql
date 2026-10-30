CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_role AS ENUM ('client', 'company', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected', 'suspended');
CREATE TYPE project_status AS ENUM ('open', 'contracted', 'closed', 'completed', 'suspended');
CREATE TYPE quote_status AS ENUM ('submitted', 'accepted', 'rejected', 'withdrawn');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  role account_role NOT NULL,
  password_hash text NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE TABLE verification_requests (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  document_reference text NOT NULL,
  status verification_status NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id),
  review_reason text
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_active_idx ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE login_failures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier_hash char(64) NOT NULL,
  ip inet NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_failures_limits_idx ON login_failures(ip, occurred_at DESC);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  commune text NOT NULL,
  budget_min bigint NOT NULL CHECK (budget_min > 0),
  budget_max bigint NOT NULL CHECK (budget_max >= budget_min),
  status project_status NOT NULL DEFAULT 'open',
  contracted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_open_idx ON projects(created_at DESC) WHERE status = 'open';

CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_user_id uuid NOT NULL REFERENCES users(id),
  amount bigint NOT NULL CHECK (amount > 0),
  duration_days integer NOT NULL CHECK (duration_days BETWEEN 1 AND 3650),
  scope text NOT NULL,
  status quote_status NOT NULL DEFAULT 'submitted',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, company_user_id)
);
-- RN-03 remains true under concurrent requests, not only in application code.
CREATE UNIQUE INDEX one_accepted_quote_per_project ON quotes(project_id) WHERE status = 'accepted';

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_project_time_idx ON messages(project_id, created_at);

CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  checksum char(64) NOT NULL,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
