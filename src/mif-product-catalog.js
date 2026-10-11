// The approved MIF Smart product catalogue. This is the single source of truth for the website.
// Freeze scope: only RAWI ERP is active. No other product routes to a live application yet.
export const MIF_PRODUCT_GROUPS=Object.freeze([
 {id:'rawi-ai',title_ar:'راوي AI',title_en:'RAWI AI',products:['rawi-erp','rawi-dev','rawi-copilot']},
 {id:'odoo',title_ar:'منتجات Odoo',title_en:'Odoo products',products:['odoo-community','odoo-saas','odoo-my-saas']},
 {id:'marketing',title_ar:'التسويق',title_en:'Marketing',products:['marketing']}
]);
export const MIF_PRODUCTS=Object.freeze([
 {code:'RAWI-AI-ERP',slug:'rawi-erp',group:'rawi-ai',title_ar:'نظام راوي',title_en:'Rawi ERP',summary_ar:'نظام ERP متكامل بالذكاء الاصطناعي، لكل شركة ومستخدميها، وتُدار عملياته من المحادثة.',summary_en:'Private company ERP with AI-driven conversations and business operations.',description_ar:'إدارة بيانات الشركة وعملياتها داخل حساب مؤسسي مستقل، عبر محادثات راوي والعمليات والجدولة.',description_en:'Company-scoped data, conversations, operations and scheduling.',features_ar:['المحادثات','العمليات','الجدولة','حساب الشركة والمستخدمين'],features_en:['Chat','Operations','Scheduling','Company users'],active:true,app_url:'https://rawi-enterprise.fayosaas.workers.dev/',icon:'/rawi-erp-mark.svg'},
 {code:'RAWI-DEVELOPER',slug:'rawi-dev',group:'rawi-ai',title_ar:'راوي Dev',title_en:'RAWI Dev',summary_ar:'تطوير أنظمة Odoo حاليًا.',summary_en:'Development tools focused on Odoo.',active:false},
 {code:'RAWI-COPILOT',slug:'rawi-copilot',group:'rawi-ai',title_ar:'راوي Copilot',title_en:'RAWI Copilot',summary_ar:'مساعد مرتبط بأنظمة الشركات، يبدأ بـOdoo وGmail وOutlook.',summary_en:'AI copilot connected to Odoo, Gmail and Outlook.',active:false},
 {code:'ODOO-COMMUNITY-ENHANCED',slug:'odoo-community',group:'odoo',title_ar:'Odoo Community المطوّر',title_en:'Enhanced Odoo Community',summary_ar:'نظام Odoo Community مع تطويرات العملاء.',summary_en:'Odoo Community with customer-specific enhancements.',active:false},
 {code:'ODOO-SAAS',slug:'odoo-saas',group:'odoo',title_ar:'Odoo SaaS',title_en:'Odoo SaaS',summary_ar:'منصة SaaS لشركاء Odoo.',summary_en:'SaaS platform for Odoo partners.',active:false},
 {code:'ODOO-MY-SAAS',slug:'odoo-my-saas',group:'odoo',title_ar:'Odoo My SaaS',title_en:'Odoo My SaaS',summary_ar:'إدارة أنظمة Odoo الحالية للعملاء.',summary_en:'Manage existing Odoo deployments.',active:false},
 {code:'MIF-MARKETING',slug:'marketing',group:'marketing',title_ar:'منصة التسويق',title_en:'Marketing Platform',summary_ar:'إنشاء المواقع وتحسينها والتسويق الإلكتروني والتواصل عبر واتساب.',summary_en:'Website creation, SEO, digital marketing and WhatsApp connectivity.',active:false}
]);
export const activeProducts=()=>MIF_PRODUCTS.filter(p=>p.active);
export const productBySlug=slug=>MIF_PRODUCTS.find(p=>p.slug===slug||slug==='rawi'&&p.slug==='rawi-erp'||slug==='rawi-developer'&&p.slug==='rawi-dev'||slug==='odoo-community-enhanced'&&p.slug==='odoo-community')||null;
