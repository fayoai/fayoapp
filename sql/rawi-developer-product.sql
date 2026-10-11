-- RAWI Developers is a distinct MIF Smart product; prices remain owner-controlled.
INSERT INTO mif_products(
 code,slug,title_ar,title_en,category,summary_ar,summary_en,
 description_ar,description_en,features_ar,features_en,price_halalas,published,sort_order
) VALUES(
 'RAWI-DEVELOPERS','rawi-developers','راوي للمطورين | RAWI Developers',
 'RAWI Developers','developer-tools',
 'برنامج مستقل لتطوير أنظمة Odoo وربط قواعدها وفحصها بمساعدة الذكاء الاصطناعي.',
 'A standalone Odoo developer engineering app with secure connectors and AI assistance.',
 'تطبيق منفصل عن راوي للمؤسسات، يتيح ربط قواعد Odoo المصرح بها، اختبار الاتصال، قراءة الموديولات، توليد إضافات أولية، إدارة مشروعات التنفيذ وتشخيص الأعطال بصلاحيات مقيدة. مصمم لقبول موصلات أنظمة إضافية مستقبلًا دون ادعاء دعمها اليوم.',
 'Independent from RAWI Enterprise, with authorized Odoo database API integrations, connection tests, module inventory, basic addon generation, implementation projects and read-only diagnostics. Designed for future connector expansion.',
 '["ربط قواعد Odoo عبر API","اختبارات اتصال وصلاحيات","توليد ملفات موديولات Odoo","إدارة مشاريع التنفيذ","مساعد AI متخصص في Odoo","فصل الصلاحيات عن ERP المؤسسات"]'::jsonb,
 '["Odoo API connections","Connection and permissions tests","Odoo addon ZIP generation","Implementation projects","Odoo-specialist AI assistance","Separate Enterprise ERP permissions"]'::jsonb,
 NULL,true,2
) ON CONFLICT(code) DO NOTHING;
