-- RAWI ERP is the only active customer application.
-- Keep the account application column for correct ERP authorization and existing registry compatibility.
ALTER TABLE mif_subscription_plans
 ADD COLUMN IF NOT EXISTS application text NOT NULL DEFAULT 'enterprise'
 CHECK(application IN ('enterprise','developer'));
CREATE INDEX IF NOT EXISTS mif_subscription_plans_application ON mif_subscription_plans(application,active);
