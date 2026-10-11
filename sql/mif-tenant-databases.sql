-- Central MIF SaaS registry for independently allocated Neon databases.
-- A 'created' database is NOT ready until the tenant schema and routing are verified.
CREATE TABLE IF NOT EXISTS mif_tenant_databases(
 workspace_id uuid PRIMARY KEY REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 application text NOT NULL CHECK(application IN ('enterprise','developer')),
 neon_project_id text NOT NULL,
 neon_branch_id text NOT NULL,
 database_name text NOT NULL UNIQUE CHECK(database_name ~ '^rawi_[ed]_[0-9a-f]{32}$'),
 status text NOT NULL DEFAULT 'allocating' CHECK(status IN ('allocating','created','migrating','ready','failed')),
 migration_version integer NOT NULL DEFAULT 0,
 last_error text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mif_tenant_databases_status ON mif_tenant_databases(status,created_at);
