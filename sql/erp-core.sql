-- ERP core operational modules with workspace isolation
CREATE TABLE IF NOT EXISTS erp_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 sku text NOT NULL,
 name text NOT NULL,
 type text NOT NULL DEFAULT 'stock' CHECK(type IN('stock','service')),
 unit text NOT NULL DEFAULT 'unit',
 sale_price_halalas bigint NOT NULL DEFAULT 0 CHECK(sale_price_halalas>=0),
 cost_halalas bigint NOT NULL DEFAULT 0 CHECK(cost_halalas>=0),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,sku),
 UNIQUE(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS erp_warehouses(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 name text NOT NULL,
 location text NOT NULL DEFAULT '',
 UNIQUE(workspace_id,name),
 UNIQUE(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS erp_stock(
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 item_id uuid NOT NULL,
 warehouse_id uuid NOT NULL,
 quantity numeric(16,3) NOT NULL CHECK(quantity>=0),
 PRIMARY KEY(workspace_id,item_id,warehouse_id),
 FOREIGN KEY(workspace_id,item_id) REFERENCES erp_items(workspace_id,id),
 FOREIGN KEY(workspace_id,warehouse_id) REFERENCES erp_warehouses(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS erp_stock_movements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 item_id uuid NOT NULL,
 warehouse_id uuid NOT NULL,
 delta numeric(16,3) NOT NULL CHECK(delta<>0),
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,item_id) REFERENCES erp_items(workspace_id,id),
 FOREIGN KEY(workspace_id,warehouse_id) REFERENCES erp_warehouses(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS erp_document_sequences(
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('sale','purchase')),
 year integer NOT NULL,
 number integer NOT NULL DEFAULT 0,
 PRIMARY KEY(workspace_id,kind,year)
);
CREATE TABLE IF NOT EXISTS erp_documents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 doc_no text NOT NULL,
 kind text NOT NULL CHECK(kind IN('sale','purchase')),
 partner_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','confirmed','completed','cancelled')),
 lines jsonb NOT NULL,
 subtotal_halalas bigint NOT NULL CHECK(subtotal_halalas>=0),
 vat_halalas bigint NOT NULL CHECK(vat_halalas>=0),
 total_halalas bigint NOT NULL CHECK(total_halalas>=0),
 notes text NOT NULL DEFAULT '',
 issued_on date NOT NULL DEFAULT CURRENT_DATE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,doc_no),
 FOREIGN KEY(partner_id) REFERENCES erp_contacts(id)
);
CREATE INDEX IF NOT EXISTS erp_documents_tenant ON erp_documents(workspace_id,kind,created_at DESC);
CREATE TABLE IF NOT EXISTS erp_accounts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 code text NOT NULL,
 name text NOT NULL,
 type text NOT NULL CHECK(type IN('asset','liability','equity','income','expense')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,code)
);
CREATE TABLE IF NOT EXISTS erp_journal_entries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 reference text NOT NULL,
 memo text NOT NULL DEFAULT '',
 posted_on date NOT NULL DEFAULT CURRENT_DATE,
 lines jsonb NOT NULL,
 debit_halalas bigint NOT NULL,
 credit_halalas bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(debit_halalas=credit_halalas),
 CHECK(debit_halalas>0)
);
CREATE INDEX IF NOT EXISTS erp_journal_tenant ON erp_journal_entries(workspace_id,posted_on DESC);
CREATE TABLE IF NOT EXISTS erp_employees(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 name text NOT NULL,
 employee_number text NOT NULL,
 email text NOT NULL DEFAULT '',
 department text NOT NULL DEFAULT '',
 job_title text NOT NULL DEFAULT '',
 basic_salary_halalas bigint NOT NULL DEFAULT 0 CHECK(basic_salary_halalas>=0),
 status text NOT NULL DEFAULT 'active' CHECK(status IN('active','inactive')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,employee_number)
);
CREATE TABLE IF NOT EXISTS erp_projects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 name text NOT NULL,
 customer_id uuid REFERENCES erp_contacts(id),
 owner text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'planned' CHECK(status IN('planned','active','done','cancelled')),
 budget_halalas bigint NOT NULL DEFAULT 0 CHECK(budget_halalas>=0),
 start_on date,
 due_on date,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS erp_expenses(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 description text NOT NULL,
 amount_halalas bigint NOT NULL CHECK(amount_halalas>0),
 category text NOT NULL DEFAULT 'general',
 employee_id uuid REFERENCES erp_employees(id),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN('submitted','approved','rejected','paid')),
 occurred_on date NOT NULL DEFAULT CURRENT_DATE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erp_expenses_tenant ON erp_expenses(workspace_id,created_at DESC);
