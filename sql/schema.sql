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
INSERT INTO catalog (sku,kind,category,title_ar,title_en,description_ar,description_en,icon,featured,sort_order) VALUES
('MIF-SAAS','service','saas','أنظمة SaaS','SaaS Platforms','تطوير منصات أعمال مرنة ولوحات تحكم وتجارب مستخدم متكاملة.','Scalable business platforms, dashboards and seamless digital experiences.','blocks',true,1),
('MIF-AI','service','ai','تدريب وحلول الذكاء الاصطناعي','AI Training & Solutions','برامج تدريب عملية وحلول أتمتة مدروسة للفرق والشركات.','Practical AI enablement and purposeful automation for businesses.','brain-circuit',true,2),
('MIF-INFRA','service','infrastructure','السيرفرات والبريد المؤسسي','Servers & Business Email','تجهيز البنية التحتية والاستضافة والبريد المؤسسي وفق متطلبات عملك.','Infrastructure, hosting and business email configured around your needs.','server',true,3),
('MIF-SMART','service','smart-home','المنازل الذكية','Smart Home','أنظمة تحكم متصلة للإضاءة والأمان والراحة.','Connected control for lighting, comfort and security.','house-plus',true,4),
('MIF-CONTRACT','service','contracting','المقاولات والحلول الهندسية','Contracting','تنفيذ مشاريع متكاملة بمعايير تشغيلية دقيقة.','Integrated project delivery with thoughtful execution.','building-2',true,5),
('MIF-GROW','service','consulting','التحول الرقمي والتوسع','Digital Transformation','استشارات وربط الأنظمة لتوسيع أعمالك دون تعقيد.','Consulting and integrations that scale with your ambitions.','workflow',true,6),
('SKU-SERVER','product','infrastructure','تجهيز سيرفر أعمال','Business Server Setup','توريد وتجهيز خوادم أعمال وفق المواصفات المطلوبة.','Tailored business server procurement and setup.','server',true,11),
('SKU-MAIL','product','infrastructure','البريد الإلكتروني للشركات','Business Email Suite','إعداد بريد احترافي بدومين شركتك مع سياسة حماية مناسبة.','Professional domain email, setup and sensible security.','mail',true,12),
('SKU-AI-TEAM','product','ai','برنامج تدريب فريق على AI','AI Team Training','برنامج تدريبي مخصص حسب مستوى الفريق وأهدافه.','Customised AI training for your team and goals.','sparkles',true,13),
('SKU-HOME','product','smart-home','باقة المنزل الذكي','Smart Living Package','تخطيط وتركيب حلول منزل ذكي قابلة للتوسع.','Planned, expandable smart-home installation.','house',true,14),
('SKU-SAAS','product','saas','بناء منصة SaaS مخصصة','Custom SaaS Build','منصة مصممة لسير العمل الحقيقي مع قابلية للتطوير.','A SaaS experience built for your actual workflows.','layout-dashboard',true,15),
('SKU-CLOUD','product','infrastructure','خدمات سحابية مُدارة','Managed Cloud Services','تهيئة ومتابعة وتشغيل البنية السحابية.','Cloud setup, management and operations.','cloud',false,16)
ON CONFLICT(sku) DO NOTHING;
INSERT INTO site_settings (key,value) VALUES
('contact','{"email":"","phone":"","whatsapp":"","address":"Saudi Arabia"}'::jsonb),
('branding','{"tagline_ar":"نبتكر اليوم، لنمكّن الغد","tagline_en":"Intelligence in every connection"}'::jsonb)
ON CONFLICT(key) DO NOTHING;
