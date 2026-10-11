-- Product-specific subscription plans for independent RAWI Enterprise and RAWI Developers.
-- Existing plans and subscriptions retain their Enterprise product assignment.
ALTER TABLE mif_subscription_plans
 ADD COLUMN IF NOT EXISTS product_code text NOT NULL DEFAULT 'RAWI-AI-ERP';
UPDATE mif_subscription_plans
 SET product_code='RAWI-AI-ERP' WHERE product_code IS NULL OR product_code='';
CREATE INDEX IF NOT EXISTS mif_plans_product_active ON mif_subscription_plans(product_code,active);
