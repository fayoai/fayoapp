export function installRawiReadiness(app,{db,env,query}){
 app.get('/api/admin/platform/deployment-audit',async c=>{
  const settings=env(c),sql=db(c);
  if(!sql)return c.json({ok:false,error:'Database not configured'},503);
  const [providers,counts]=await Promise.all([
   query(sql,'SELECT code,enabled,length(encrypted_key)>0 configured FROM mif_ai_providers'),
   query(sql,`SELECT (SELECT count(*)::int FROM mif_subscription_plans WHERE active) plans,
    (SELECT count(*)::int FROM mif_tenant_subscriptions WHERE status IN ('trial','active') AND period_ends_at>now()) subscriptions,
    (SELECT count(*)::int FROM rawi_odoo_connections) odoo_connections,
    (SELECT count(*)::int FROM rawi_account_profiles WHERE account_type='developer') developers`)
  ]);
  const vars={openai:'OPENAI_API_KEY',anthropic:'ANTHROPIC_API_KEY',gemini:'GEMINI_API_KEY',groq:'GROQ_API_KEY',openrouter:'OPENROUTER_API_KEY'};
  const ai=providers.some(p=>p.enabled&&(p.code==='workers_ai'?!!settings.AI?.run:p.configured||!!settings[vars[p.code]]));
  const checks=[
    {code:'database',ready:true,required:true,ar:'اتصال قاعدة البيانات',en:'Database connection'},
    {code:'session',ready:!!settings.SESSION_SECRET&&settings.SESSION_SECRET.length>=32,required:true,ar:'سر جلسات الدخول',en:'Session secret'},
    {code:'owner',ready:!!settings.PLATFORM_OWNER_EMAIL?.trim(),required:true,ar:'بريد مالك المنصة',en:'Platform owner identity'},
    {code:'encryption',ready:!!settings.CONNECTOR_ENCRYPTION_KEY&&settings.CONNECTOR_ENCRYPTION_KEY.length>=32,required:true,ar:'تشفير بيانات الربط',en:'Connector encryption'},
    {code:'ai',ready:ai,required:true,ar:'مزوّد AI فعّال',en:'Enabled AI provider'},
    {code:'registration',ready:settings.REGISTRATION_ENABLED==='true',required:false,ar:'فتح التسجيل',en:'Registration enabled'},
    {code:'plans',ready:Number(counts[0]?.plans||0)>0,required:false,ar:'باقات الاشتراك',en:'Available subscription plan'},
    {code:'site',ready:!!settings.SITE_ORIGIN?.startsWith('https://'),required:false,ar:'رابط الخدمة الآمن',en:'Canonical HTTPS site URL'},
    {code:'inquiry_mail',ready:!!settings.RESEND_API_KEY&&!!settings.MAIL_FROM&&!!settings.MIF_INQUIRY_NOTIFY_EMAIL,required:false,ar:'بريد إشعارات طلبات الموقع',en:'Website inquiry mail notifications'}
  ];
  return c.json({ok:true,checks,counts:counts[0]||{},configuration_ready:checks.filter(x=>x.required).every(x=>x.ready),credits_verified:false,note:'Checks configuration, not actual Odoo access or regulatory readiness.'});
 });
}
