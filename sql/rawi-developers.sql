-- RAWI account types, secure Odoo developer connections, and implementation work.
CREATE TABLE IF NOT EXISTS rawi_account_profiles(
 admin_id uuid PRIMARY KEY REFERENCES admins(id) ON DELETE CASCADE,
 account_type text NOT NULL CHECK(account_type IN('enterprise','developer')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rawi_odoo_connections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 label text NOT NULL,
 base_url text NOT NULL,
 database_name text NOT NULL,
 api_version text NOT NULL CHECK(api_version IN ('json2','jsonrpc')),
 login text NOT NULL DEFAULT '',
 encrypted_credential text NOT NULL,
 odoo_version text NOT NULL DEFAULT '',
 last_status text NOT NULL DEFAULT 'not_tested' CHECK(last_status IN('not_tested','ok','failed')),
 last_tested_at timestamptz,
 last_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS rawi_odoo_connections_workspace ON rawi_odoo_connections(workspace_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS rawi_implementation_projects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 connection_id uuid,
 title text NOT NULL,
 client_name text NOT NULL DEFAULT '',
 phase text NOT NULL DEFAULT 'discovery' CHECK(phase IN('discovery','analysis','configuration','development','migration','testing','training','golive','support')),
 status text NOT NULL DEFAULT 'planned' CHECK(status IN('planned','active','blocked','done')),
 details text NOT NULL DEFAULT '',
 due_on date,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES rawi_odoo_connections(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS rawi_odoo_diagnostics(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 connection_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN('ok','warning','error')),
 checks jsonb NOT NULL DEFAULT '[]'::jsonb,
 checked_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES rawi_odoo_connections(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS rawi_odoo_diagnostics_latest ON rawi_odoo_diagnostics(connection_id,checked_at DESC);
