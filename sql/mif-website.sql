-- MIF Smart corporate website and product control plane. RAWI is first product.
CREATE TABLE IF NOT EXISTS mif_site_settings(
 key text PRIMARY KEY,
 value jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mif_products(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE CHECK(code ~ '^[A-Z0-9-]{3,50}$'),
 slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9-]{2,80}$'),
 title_ar text NOT NULL,
 title_en text NOT NULL,
 category text NOT NULL DEFAULT 'software',
 summary_ar text NOT NULL DEFAULT '',
 summary_en text NOT NULL DEFAULT '',
 description_ar text NOT NULL DEFAULT '',
 description_en text NOT NULL DEFAULT '',
 features_ar jsonb NOT NULL DEFAULT '[]'::jsonb,
 features_en jsonb NOT NULL DEFAULT '[]'::jsonb,
 price_halalas bigint CHECK(price_halalas>=0),
 currency text NOT NULL DEFAULT 'SAR',
 published boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 100,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mif_products_published ON mif_products(published,sort_order);
CREATE TABLE IF NOT EXISTS mif_site_pages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9-]{2,80}$'),
 title_ar text NOT NULL,
 title_en text NOT NULL,
 body_ar text NOT NULL DEFAULT '',
 body_en text NOT NULL DEFAULT '',
 seo_description_ar text NOT NULL DEFAULT '',
 seo_description_en text NOT NULL DEFAULT '',
 published boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mif_site_inquiries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 email text NOT NULL,
 phone text NOT NULL DEFAULT '',
 company text NOT NULL DEFAULT '',
 product_code text NOT NULL DEFAULT '',
 message text NOT NULL,
 status text NOT NULL DEFAULT 'new' CHECK(status IN('new','contacted','qualified','closed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mif_site_inquiries_status ON mif_site_inquiries(status,created_at DESC);
CREATE TABLE IF NOT EXISTS mif_site_rate_limits(
 client_key text NOT NULL,
 bucket text NOT NULL,
 count integer NOT NULL DEFAULT 0,
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(client_key,bucket)
);
INSERT INTO mif_products(code,slug,title_ar,title_en,category,summary_ar,summary_en,description_ar,description_en,features_ar,features_en,published,sort_order)
VALUES('RAWI-AI-ERP','rawi','راوي | RAWI','RAWI | AI ERP','ai-erp',
'نظام ERP مدعوم بالذكاء الاصطناعي لإدارة عمليات الأعمال من واجهة واحدة.','AI-powered ERP for business operations in a single workspace.',
'راوي منصة مستقلة لإدارة المبيعات والمشتريات والمخزون والمحاسبة والمشاريع والموظفين والمواعيد، مع إمكانيات ذكاء اصطناعي عبر مزوّدين خارجيين معتمدين.',
'RAWI combines sales, purchasing, inventory, accounting, projects, HR, calendar and AI assistance through authorized external model providers.',
'["إدارة المبيعات والمشتريات","المخزون والمستودعات","الفواتير والحسابات","الموارد البشرية والمشاريع","المواعيد والمحادثات الذكية","التكاملات مع الأنظمة"]'::jsonb,
'["Sales and purchasing","Inventory and warehouses","Invoicing and accounting","Human resources and projects","Calendar and intelligent conversations","Business integrations"]'::jsonb,
true,1)
ON CONFLICT(code) DO NOTHING;
INSERT INTO mif_site_settings(key,value) VALUES
('identity','{"company_ar":"MIF Smart","company_en":"MIF Smart","tagline_ar":"تقنيات ذكية لأعمال أكثر كفاءة","tagline_en":"Connected intelligence for better business","hero_title_ar":"نطوّر منتجات تفهم أعمالك.","hero_title_en":"Business software, reimagined.","hero_description_ar":"منصة MIF Smart لتطوير وإدارة البرمجيات المتصلة والاشتراكات، وراوي هو أول منتجاتنا.","hero_description_en":"MIF Smart builds connected software products. RAWI AI ERP is our first product."}'::jsonb),
('contact','{"email":"","phone":"","whatsapp":"","address":""}'::jsonb),
('seo','{"title_ar":"MIF Smart | حلول البرمجيات والذكاء الاصطناعي","title_en":"MIF Smart | Intelligent business software","description_ar":"MIF Smart منصة لإدارة منتجات البرمجيات المتصلة. اكتشف RAWI ERP المدعوم بالذكاء الاصطناعي.","description_en":"MIF Smart software products. Discover RAWI AI-powered business ERP."}'::jsonb)
ON CONFLICT(key) DO NOTHING;
INSERT INTO mif_site_pages(slug,title_ar,title_en,body_ar,body_en,seo_description_ar,seo_description_en,published) VALUES
('about','عن MIF Smart','About MIF Smart','MIF Smart تطور وتدير أنظمة أعمال متصلة. راوي RAWI هو أول منتج في منظومتنا، ويجمع وظائف ERP مع المساعدة الذكية.','MIF Smart develops and operates connected business software. RAWI is the first product, combining ERP workflows with intelligent assistance.','تعرف على MIF Smart ومنتجها الأول RAWI','Learn about MIF Smart and RAWI',true),
('privacy','سياسة الخصوصية','Privacy policy','نحرص على حماية معلومات العملاء وعدم إظهار بيانات المؤسسات دون تصريح. سيتم نشر التفاصيل القانونية المعتمدة قبل فتح التسجيل التجاري.','We restrict unauthorized access to business records. Approved legal privacy terms must be published before commercial sign-up.', 'خصوصية البيانات في MIF Smart','MIF Smart data privacy',false)
ON CONFLICT(slug) DO NOTHING;

-- Explicitly requested product: enhanced Odoo Community, never renamed MIF ERP.
-- No invented prices or unsupported Enterprise license claims.
INSERT INTO mif_products(code,slug,title_ar,title_en,category,summary_ar,summary_en,description_ar,description_en,features_ar,features_en,published,sort_order)
VALUES('ODOO-COMMUNITY-ENHANCED','odoo-community-enhanced','Odoo Community المطوّر','Enhanced Odoo Community','erp-platform',
'نقدّم Odoo Community مع تطويرات وتخصيصات يتم تحديدها حسب متطلبات المشروع.',
'Original Odoo Community with extensions agreed for each implementation.',
'تطوير وتهيئة نظام Odoo Community باسمه الأصلي. تشمل الخدمات الموديولات والتعديلات المتفق عليها مع العميل ضمن نطاق تنفيذ واضح. لا تشمل تلقائيًا خصائص Enterprise أو ترخيصها.',
'Customize and implement Odoo Community under its original name, with scoped modules and agreed extensions. No Enterprise license or features are implied.',
'["Odoo Community باسمه الأصلي","تخصيصات وموديولات حسب الاتفاق","تهيئة وتنفيذ حسب نطاق المشروع"]'::jsonb,
'["Original Odoo Community","Agreed custom modules and extensions","Project-scoped implementation"]'::jsonb,
true,3)
ON CONFLICT(code) DO NOTHING;
