-- MIF Smart v3: active storefront is exclusively Odoo ERP, Odoo Control,
-- Odoo Partner SaaS, Marketing SaaS, Odoo add-ons and hosting infrastructure.
-- Preserve old records for audit / admin history instead of deleting them.
UPDATE catalog SET active=false
 WHERE sku IN ('MIF-SAAS','MIF-AI','MIF-INFRA','MIF-SMART','MIF-CONTRACT','MIF-GROW','SKU-SERVER','SKU-MAIL','SKU-AI-TEAM','SKU-HOME','SKU-SAAS','SKU-CLOUD');
INSERT INTO catalog(sku,kind,category,title_ar,title_en,description_ar,description_en,icon,featured,sort_order,active) VALUES
('MIF-ERP','service','erp','MIF ERP | أودو كوميونيتي المطوّر','MIF ERP | Enhanced Odoo Community','منصة إدارة الأعمال المبنية على Odoo Community، وفق نطاق موديولات التنفيذ والترخيص.','Enhanced Odoo Community ERP within the agreed licensed module scope.','boxes',true,1,true),
('MIF-CONTROL','service','odoo-manager','MIF Odoo Control | إدارة الاستضافات','MIF Odoo Control | Hosting Management','إدارة نسخ Odoo والاستضافة والدومينات والصيانة والنسخ الاحتياطي.','Odoo environments, hosting, domains, maintenance and backups.','server',true,2,true),
('MIF-PARTNERS','service','partners','Partner Cloud | SaaS لشركاء Odoo','Partner Cloud | Odoo Partner SaaS','إدارة العملاء والفرص والمشاريع والاشتراكات والدعم والاستضافات.','Partners CRM, pipeline, projects, subscriptions, support and hosting.','network',true,3,true),
('MIF-MARKETING','service','marketing','MIF Marketing | منصة التسويق','MIF Marketing | Marketing SaaS','موقع ومحتوى وعروض وفرص ومحادثات وتذاكر وإحصاءات.','Marketing sites, content, offers, leads, chats, tickets and analytics.','message-circle',true,4,true),
('MIF-HOSTING','service','infrastructure','استضافة وسيرفرات الأعمال','Business Hosting & Servers','كوّن السيرفر حسب الموقع والموارد والإدارة والنسخ الاحتياطية.','Configure hosting by region, resources, management and backups.','server',true,5,true),
('MIF-MODULES','service','modules','متجر موديولات Odoo','Odoo Modules Marketplace','موديولات مع توافق الإصدارات والترخيص وملفات التسليم.','Odoo modules with compatibility, licensing and download fulfilment.','puzzle',true,6,true)
ON CONFLICT(sku) DO NOTHING;
