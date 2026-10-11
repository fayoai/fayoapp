-- Two separate commercial applications under the MIF Smart SaaS control plane.
-- Existing plans belong to RAWI Enterprise. New Developer plans cannot be applied to Enterprise workspaces.
ALTER TABLE mif_subscription_plans
 ADD COLUMN IF NOT EXISTS application text NOT NULL DEFAULT 'enterprise'
 CHECK(application IN ('enterprise','developer'));
CREATE INDEX IF NOT EXISTS mif_subscription_plans_application ON mif_subscription_plans(application,active);
INSERT INTO mif_products(code,slug,title_ar,title_en,category,summary_ar,summary_en,description_ar,description_en,features_ar,features_en,published,sort_order)
VALUES('RAWI-DEVELOPER','rawi-developer','راوي للمطورين','RAWI Developer','developer-tools',
'بيئة مستقلة لمطوري Odoo، للربط والتشخيص وبناء الموديولات وإدارة مشروعات التنفيذ.',
'Independent Odoo developer app for secure connections, diagnostics, addon generation and implementation tracking.',
'راوي للمطورين تطبيق منفصل عن راوي Enterprise. يقدم اتصالات Odoo عبر واجهات برمجة التطبيقات المصرح بها، فحص الصلاحيات والموديولات، توليد إضافة ZIP، وتنظيم مراحل التنفيذ. التكامل الفعلي حاليًا مع Odoo فقط.',
'RAWI Developer is separate from Enterprise. It supports authorized Odoo API connections, diagnostics, read-only module inventory, basic addon ZIP generation and implementation tracking. Other systems are not enabled.',
'["اتصالات آمنة إلى Odoo","اختبار صلاحيات قواعد Odoo","إدارة وتشخيص الموديولات","توليد موديولات قابلة للتنزيل","متابعة مشاريع التنفيذ","مساعد AI متخصص في Odoo"]'::jsonb,
'["Secure Odoo connectivity","Odoo credential diagnostics","Module inventory and status","Downloadable addon ZIP generation","Implementation workflow","Odoo engineering AI assistant"]'::jsonb,
true,2)
ON CONFLICT(code) DO NOTHING;
INSERT INTO mif_subscription_plans(code,title,cycle,price_halalas,message_limit,active,application)
VALUES('rawi-developer-evaluation','RAWI Developer evaluation','monthly',0,30,true,'developer')
ON CONFLICT(code) DO NOTHING;
