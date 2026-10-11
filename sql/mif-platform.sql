CREATE TABLE IF NOT EXISTS mif_platform_settings (
 name text PRIMARY KEY,
 encrypted_value text NOT NULL DEFAULT '',
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
