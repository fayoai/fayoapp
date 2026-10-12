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

-- Activity-led workspace setup: only supported existing sections can be prioritized.
ALTER TABLE rawi_company_profiles ADD COLUMN IF NOT EXISTS setup_plan jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE rawi_company_profiles ADD COLUMN IF NOT EXISTS setup_inputs jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE rawi_company_profiles ADD COLUMN IF NOT EXISTS setup_source text NOT NULL DEFAULT 'basic';
ALTER TABLE rawi_company_profiles ADD COLUMN IF NOT EXISTS setup_updated_at timestamptz;

-- Interactive company discovery begins in chat only after official company setup.
CREATE TABLE IF NOT EXISTS rawi_workspace_discovery(
 workspace_id uuid PRIMARY KEY REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL REFERENCES admins(id),
 stage text NOT NULL DEFAULT 'intro' CHECK(stage IN ('intro','references','processes','review','completed')),
 answers jsonb NOT NULL DEFAULT '{}'::jsonb,
 proposal jsonb NOT NULL DEFAULT '{}'::jsonb,
 research jsonb NOT NULL DEFAULT '[]'::jsonb,
 thread_id uuid,
 confirmed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rawi_workspace_discovery_owner ON rawi_workspace_discovery(owner_id,stage);
ALTER TABLE rawi_account_profiles ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';
