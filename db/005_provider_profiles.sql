CREATE TABLE IF NOT EXISTS provider_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone text,
  public_email text,
  commune text,
  specialties text,
  description text,
  website text,
  logo_upload_id uuid REFERENCES uploads(id) ON DELETE SET NULL,
  show_contact boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO provider_profiles (user_id)
SELECT id FROM users WHERE role IN ('company', 'professional')
ON CONFLICT (user_id) DO NOTHING;
