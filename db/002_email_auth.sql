ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

-- Accounts created before email confirmation existed remain usable.
UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_tokens_active_idx ON auth_tokens(user_id, purpose, expires_at DESC) WHERE used_at IS NULL;
