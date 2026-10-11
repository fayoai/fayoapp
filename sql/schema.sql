CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('service','product')),
  category text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  description_ar text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'layers',
  price numeric(12,2) CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  service text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'website',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  company text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  subtotal numeric(12,2),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','quoted','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  catalog_id uuid NOT NULL REFERENCES catalog(id),
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
  unit_price numeric(12,2),
  title_snapshot text NOT NULL
);
CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  excerpt_ar text NOT NULL DEFAULT '',
  excerpt_en text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catalog_listing_idx ON catalog(kind, active, sort_order);
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
-- Only the products explicitly included in the MIF Smart catalog are seeded.
-- Keep pricing unset: no product is represented as paid-ready without approved prices.
INSERT INTO catalog (sku,kind,category,title_ar,title_en,description_ar,description_en,icon,featured,sort_order) VALUES
('MIF-ERP','service','erp','Odoo Community المطوّر','Enhanced Odoo Community','Odoo Community مطوّر مع وحدات الأعمال حسب نطاق التنفيذ والترخيص.','Enhanced Odoo Community with licensed, scoped business modules.','boxes',true,1),
('MIF-CONTROL','service','odoo-manager','MIF Odoo Control | إدارة الاستضافات','MIF Odoo Control | Odoo Hosting Management','إدارة استضافات ونسخ أودو والدومينات والنسخ الاحتياطية والصيانة.','Odoo hosting, instances, domains, backups and maintenance.','server',true,2),
('MIF-PARTNERS','service','partners','Partner Cloud | SaaS لشركاء Odoo','Partner Cloud | Odoo Partner SaaS','إدارة الفرص والعملاء والمشاريع والاشتراكات والدعم لشركاء أودو.','CRM, projects, subscriptions and support for Odoo partners.','network',true,3),
('MIF-MARKETING','service','marketing','MIF Marketing | منصة التسويق','MIF Marketing | Marketing SaaS','صفحات ومحتوى وعروض وفرص ومحادثات وتحليلات التسويق.','Marketing pages, content, offers, leads, chats and analytics.','message-circle',true,4),
('MIF-HOSTING','service','infrastructure','استضافة وسيرفرات الأعمال','Business Servers & Hosting','تكوين استضافة السيرفرات حسب الموارد والبلد والنسخ الاحتياطية.','Configure hosting by resources, region and backup options.','server',true,5),
('MIF-MODULES','service','modules','متجر موديولات Odoo','Odoo Modules Marketplace','إضافات أودو من تطويرنا مع توافق الإصدارات والتسليم بعد الشراء.','Our Odoo add-ons with version compatibility and post-payment delivery.','puzzle',true,6),
('MIF-EMAIL','service','infrastructure','البريد الإلكتروني للشركات','Managed Business Email','البريد المؤسسي وإعداد الدومين وفق نطاق الخدمة.','Business email and domain setup within the agreed scope.','mail',false,7)
ON CONFLICT(sku) DO NOTHING;
INSERT INTO site_settings (key,value) VALUES
('contact','{"email":"","phone":"","whatsapp":"","address":"Saudi Arabia"}'::jsonb),
('branding','{"tagline_ar":"حلول تعمل بذكاء. أعمال تنمو بثقة.","tagline_en":"Smarter software. Stronger businesses."}'::jsonb)
ON CONFLICT(key) DO NOTHING;
