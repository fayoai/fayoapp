-- MIF Smart: track follow-up progress on incoming website product requests.
ALTER TABLE mif_site_inquiries ADD COLUMN IF NOT EXISTS internal_note text NOT NULL DEFAULT '';
ALTER TABLE mif_site_inquiries ADD COLUMN IF NOT EXISTS next_action_on date;
ALTER TABLE mif_site_inquiries ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS mif_site_inquiry_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 inquiry_id uuid NOT NULL REFERENCES mif_site_inquiries(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
 event_kind text NOT NULL CHECK(event_kind IN ('status','followup','note')),
 old_value text NOT NULL DEFAULT '',
 new_value text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mif_site_inquiry_events_by_lead ON mif_site_inquiry_events(inquiry_id,created_at DESC);
CREATE INDEX IF NOT EXISTS mif_site_inquiries_followup ON mif_site_inquiries(next_action_on) WHERE status<>'closed';
ALTER TABLE mif_site_inquiries ADD COLUMN IF NOT EXISTS notification_status text NOT NULL DEFAULT 'not_configured' CHECK(notification_status IN('not_configured','sent','failed'));
ALTER TABLE mif_site_inquiries ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- Shared enterprise account identity is required inside isolated tenant databases.
-- Appended to preserve all existing tenant migration checkpoint indexes.
CREATE TABLE IF NOT EXISTS rawi_account_profiles(
 admin_id uuid PRIMARY KEY REFERENCES admins(id) ON DELETE CASCADE,
 account_type text NOT NULL CHECK(account_type IN ('enterprise','developer')),
 created_at timestamptz NOT NULL DEFAULT now()
);

-- AI-authored workspace repositories: tenant-owned typed record values.
-- Append only, preserving migration checkpoint ordering for live customer databases.
CREATE TABLE IF NOT EXISTS rawi_dynamic_records(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 repository_key text NOT NULL,
 values_json jsonb NOT NULL DEFAULT '{}'::jsonb,
 stage text NOT NULL DEFAULT '',
 source_thread_id uuid REFERENCES mif_chat_threads(id) ON DELETE SET NULL,
 created_by uuid NOT NULL REFERENCES admins(id),
 updated_by uuid NOT NULL REFERENCES admins(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(jsonb_typeof(values_json)='object')
);
CREATE INDEX IF NOT EXISTS rawi_dynamic_records_workspace_repository ON rawi_dynamic_records(workspace_id,repository_key,updated_at DESC);
