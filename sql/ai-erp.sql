-- MIF Smart AI ERP. All operational records belong to a workspace.
CREATE TABLE IF NOT EXISTS erp_workspaces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 currency char(3) NOT NULL DEFAULT 'SAR',
 vat_rate numeric(5,4) NOT NULL DEFAULT 0.1500,
 owner_id uuid NOT NULL REFERENCES admins(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS erp_memberships (
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','admin','viewer')),
 PRIMARY KEY(workspace_id,admin_id)
);
CREATE TABLE IF NOT EXISTS erp_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 kind text NOT NULL DEFAULT 'customer' CHECK(kind IN ('customer','vendor','person')),
 name text NOT NULL,
 email text NOT NULL DEFAULT '',
 phone text NOT NULL DEFAULT '',
 company text NOT NULL DEFAULT '',
 tax_number text NOT NULL DEFAULT '',
 address text NOT NULL DEFAULT '',
 notes text NOT NULL DEFAULT '',
 external_source text NOT NULL DEFAULT '',
 external_id text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_contact_external_unique ON erp_contacts(workspace_id,external_source,external_id) WHERE external_source<>'' AND external_id<>'';
CREATE INDEX IF NOT EXISTS erp_contacts_workspace_kind ON erp_contacts(workspace_id,kind,created_at DESC);
CREATE TABLE IF NOT EXISTS erp_invoice_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 name text NOT NULL,
 logo_url text NOT NULL DEFAULT '',
 primary_color text NOT NULL DEFAULT '#e95814',
 header_text text NOT NULL DEFAULT '',
 footer_text text NOT NULL DEFAULT '',
 settings jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS erp_invoice_sequences (
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 year integer NOT NULL,
 last_number integer NOT NULL DEFAULT 0,
 PRIMARY KEY(workspace_id,year)
);
CREATE TABLE IF NOT EXISTS erp_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 invoice_no text NOT NULL,
 customer_id uuid NOT NULL REFERENCES erp_contacts(id),
 template_id uuid REFERENCES erp_invoice_templates(id),
 issued_on date NOT NULL DEFAULT CURRENT_DATE,
 due_on date,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','cancelled')),
 currency char(3) NOT NULL DEFAULT 'SAR',
 lines jsonb NOT NULL,
 subtotal_halalas bigint NOT NULL CHECK(subtotal_halalas>=0),
 vat_halalas bigint NOT NULL CHECK(vat_halalas>=0),
 total_halalas bigint NOT NULL CHECK(total_halalas>=0),
 notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,invoice_no)
);
CREATE INDEX IF NOT EXISTS erp_invoices_tenant ON erp_invoices(workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS erp_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 title text NOT NULL,
 description text NOT NULL DEFAULT '',
 due_at timestamptz,
 repeat text NOT NULL DEFAULT 'once' CHECK(repeat IN ('once','daily','weekly','monthly')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done','cancelled')),
 last_run_at timestamptz,
 next_run_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erp_tasks_due ON erp_tasks(next_run_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS erp_task_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 task_id uuid NOT NULL REFERENCES erp_tasks(id) ON DELETE CASCADE,
 fired_at timestamptz NOT NULL DEFAULT now(),
 message text NOT NULL
);
CREATE TABLE IF NOT EXISTS erp_knowledge (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 title text NOT NULL,
 category text NOT NULL DEFAULT 'general',
 body text NOT NULL,
 source_url text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erp_knowledge_workspace ON erp_knowledge(workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS erp_integrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN ('openai','odoo','erpnext','zoho','email')),
 label text NOT NULL,
 base_url text NOT NULL DEFAULT '',
 configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
 encrypted_secret text NOT NULL DEFAULT '',
 enabled boolean NOT NULL DEFAULT false,
 last_checked_at timestamptz,
 last_error text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,provider)
);
CREATE TABLE IF NOT EXISTS erp_ai_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('user','assistant')),
 content text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erp_ai_recent ON erp_ai_messages(workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS erp_email_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 recipient text NOT NULL,
 subject text NOT NULL,
 delivery_status text NOT NULL CHECK(delivery_status IN ('sent','failed')),
 created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO catalog(sku,kind,category,title_ar,title_en,description_ar,description_en,icon,featured,sort_order,active)
VALUES('MIF-AI-ERP','service','erp','MIF Smart AI ERP','MIF Smart AI ERP','منصة AI ERP للعملاء والفواتير والمهام والتكاملات.','AI ERP platform for contacts, invoices, tasks and integrations.','brain-circuit',true,0,true)
ON CONFLICT(sku) DO NOTHING;

CREATE TABLE IF NOT EXISTS erp_external_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN ('odoo','erpnext','zoho')),
 external_id text NOT NULL,
 invoice_number text NOT NULL,
 customer_name text NOT NULL DEFAULT '',
 total_amount numeric(18,2) NOT NULL DEFAULT 0,
 currency char(3) NOT NULL DEFAULT 'SAR',
 status text NOT NULL DEFAULT '',
 invoice_date date,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,provider,external_id)
);
CREATE INDEX IF NOT EXISTS erp_external_invoices_workspace ON erp_external_invoices(workspace_id,updated_at DESC);

ALTER TABLE erp_workspaces ADD COLUMN IF NOT EXISTS legal_name text NOT NULL DEFAULT '';
ALTER TABLE erp_workspaces ADD COLUMN IF NOT EXISTS vat_number text NOT NULL DEFAULT '';
ALTER TABLE erp_workspaces ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
ALTER TABLE erp_workspaces ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
