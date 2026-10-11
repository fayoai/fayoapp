-- RAWI tenant-scoped CRM, payroll snapshots and receipt/expense registers.
CREATE TABLE IF NOT EXISTS rawi_crm_stages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 name text NOT NULL,
 sort_order integer NOT NULL DEFAULT 100,
 UNIQUE(workspace_id,name),
 UNIQUE(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS rawi_opportunities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 title text NOT NULL,
 contact_id uuid REFERENCES erp_contacts(id),
 stage_id uuid,
 expected_halalas bigint NOT NULL DEFAULT 0 CHECK(expected_halalas>=0),
 probability integer NOT NULL DEFAULT 0 CHECK(probability BETWEEN 0 AND 100),
 deadline date,
 status text NOT NULL DEFAULT 'open' CHECK(status IN('open','won','lost')),
 notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,stage_id) REFERENCES rawi_crm_stages(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS rawi_opportunities_tenant ON rawi_opportunities(workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS rawi_payroll_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 period date NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved')),
 employees jsonb NOT NULL DEFAULT '[]'::jsonb,
 gross_halalas bigint NOT NULL CHECK(gross_halalas>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz,
 UNIQUE(workspace_id,period),
 CHECK(EXTRACT(DAY FROM period)=1)
);
CREATE TABLE IF NOT EXISTS rawi_payments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 direction text NOT NULL CHECK(direction IN('incoming','outgoing')),
 method text NOT NULL CHECK(method IN('bank','cash')),
 amount_halalas bigint NOT NULL CHECK(amount_halalas>0),
 reference text NOT NULL,
 details text NOT NULL DEFAULT '',
 invoice_id uuid REFERENCES erp_invoices(id),
 recorded_at date NOT NULL DEFAULT CURRENT_DATE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rawi_payments_tenant ON rawi_payments(workspace_id,created_at DESC);
