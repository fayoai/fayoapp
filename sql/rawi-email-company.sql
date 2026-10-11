-- Verify identity before allocating a customer tenant. Codes and passwords are never stored as plaintext.
CREATE TABLE IF NOT EXISTS rawi_pending_signups(
 email text PRIMARY KEY,
 full_name text NOT NULL,
 password_hash text NOT NULL,
 salt text NOT NULL,
 code_hash text NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 sent_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rawi_pending_signups_expires ON rawi_pending_signups(expires_at);
CREATE TABLE IF NOT EXISTS rawi_company_profiles(
 workspace_id uuid PRIMARY KEY REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 logo_data text NOT NULL DEFAULT '',
 name text NOT NULL DEFAULT '',
 address text NOT NULL DEFAULT '',
 commercial_registration text NOT NULL DEFAULT '',
 tax_number text NOT NULL DEFAULT '',
 phone text NOT NULL DEFAULT '',
 mobile text NOT NULL DEFAULT '',
 website text NOT NULL DEFAULT '',
 emails text NOT NULL DEFAULT '',
 activity text NOT NULL DEFAULT '',
 description text NOT NULL DEFAULT '',
 completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS rawi_company_profiles_pending ON rawi_company_profiles(workspace_id) WHERE completed_at IS NULL;
