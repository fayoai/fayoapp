-- Sector-aware operational work orders. Generic workflows extend ERP without making unsupported vertical compliance claims.
CREATE TABLE IF NOT EXISTS rawi_activity_cases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 sector text NOT NULL CHECK(length(sector) BETWEEN 2 AND 64),
 title text NOT NULL CHECK(length(title) BETWEEN 2 AND 240),
 customer_id uuid REFERENCES erp_contacts(id),
 assigned_to text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','done','cancelled')),
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
 due_on date,
 description text NOT NULL DEFAULT '',
 reference text NOT NULL DEFAULT '',
 estimated_halalas bigint NOT NULL DEFAULT 0 CHECK(estimated_halalas BETWEEN 0 AND 1000000000000),
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rawi_cases_tenant_sector ON rawi_activity_cases(workspace_id,sector,status,created_at DESC);
CREATE INDEX IF NOT EXISTS rawi_cases_due ON rawi_activity_cases(workspace_id,due_on) WHERE status IN ('planned','in_progress');
