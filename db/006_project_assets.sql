ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_mime_type_check;
ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_size_bytes_check;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS original_name text;
UPDATE uploads SET original_name = 'archivo' WHERE original_name IS NULL;
ALTER TABLE uploads ALTER COLUMN original_name SET NOT NULL;
ALTER TABLE uploads ADD CONSTRAINT uploads_mime_type_check
  CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'model/gltf-binary'));
ALTER TABLE uploads ADD CONSTRAINT uploads_size_bytes_check
  CHECK (size_bytes BETWEEN 1 AND 15728640);
