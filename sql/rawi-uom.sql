-- RAWI configurable units of measure, isolated by company and linked to product stock.
CREATE TABLE IF NOT EXISTS erp_units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 code text NOT NULL,
 name text NOT NULL,
 category text NOT NULL DEFAULT 'count' CHECK(category IN ('count','weight','volume','length','area','time','other')),
 precision_digits integer NOT NULL DEFAULT 3 CHECK(precision_digits BETWEEN 0 AND 6),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,code),
 UNIQUE(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS erp_item_units (
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 item_id uuid NOT NULL,
 unit_id uuid NOT NULL,
 factor numeric(18,6) NOT NULL CHECK(factor>0 AND factor<=1000000000),
 is_base boolean NOT NULL DEFAULT false,
 barcode text NOT NULL DEFAULT '',
 sale_price_halalas bigint CHECK(sale_price_halalas IS NULL OR sale_price_halalas>=0),
 purchase_price_halalas bigint CHECK(purchase_price_halalas IS NULL OR purchase_price_halalas>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,item_id,unit_id),
 FOREIGN KEY(workspace_id,item_id) REFERENCES erp_items(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,unit_id) REFERENCES erp_units(workspace_id,id) ON DELETE RESTRICT,
 CHECK(NOT is_base OR factor=1)
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_item_units_base_unique ON erp_item_units(workspace_id,item_id) WHERE is_base=true;
CREATE INDEX IF NOT EXISTS erp_item_units_unit_index ON erp_item_units(workspace_id,unit_id);
-- Existing products retain their legacy unit and inventory quantities unchanged.
INSERT INTO erp_units(workspace_id,code,name,category)
SELECT DISTINCT workspace_id,unit,CASE WHEN unit='unit' THEN 'وحدة' ELSE unit END,
CASE WHEN unit IN('kg','g') THEN 'weight' WHEN unit IN('l','ml') THEN 'volume' WHEN unit IN('m','cm') THEN 'length' ELSE 'count' END
FROM erp_items WHERE unit<>'' ON CONFLICT(workspace_id,code) DO NOTHING;
INSERT INTO erp_item_units(workspace_id,item_id,unit_id,factor,is_base)
SELECT i.workspace_id,i.id,u.id,1,true FROM erp_items i
JOIN erp_units u ON u.workspace_id=i.workspace_id AND u.code=i.unit
ON CONFLICT(workspace_id,item_id,unit_id) DO NOTHING;
-- Default choices for newly registered and existing company workspaces.
INSERT INTO erp_units(workspace_id,code,name,category,precision_digits)
SELECT w.id,units.code,units.name,units.category,units.digits
FROM erp_workspaces w
CROSS JOIN (VALUES
 ('unit','وحدة','count',3),('pcs','قطعة','count',0),('box','كرتون','count',0),
 ('dozen','دستة','count',0),('kg','كيلوجرام','weight',3),
 ('g','جرام','weight',3),('m','متر','length',3),('l','لتر','volume',3)
) AS units(code,name,category,digits)
ON CONFLICT(workspace_id,code) DO NOTHING;
-- The historic sequence constraint accepted only purchase and sales orders.
-- General purpose document drafts need their own namespaced counters.
ALTER TABLE erp_document_sequences DROP CONSTRAINT IF EXISTS erp_document_sequences_kind_check;
ALTER TABLE erp_document_sequences ADD CONSTRAINT erp_document_sequences_kind_check
CHECK(kind ~ '^(sale|purchase|std_[a-z_]{2,55})$');
