import {z} from 'zod';
const name=z.string().trim().min(2).max(160);
const id=z.string().uuid();
const error=(c,status,message)=>c.json({ok:false,error:message},status);
const read=async c=>{try{return await c.req.json()}catch{return {}}};
const product=z.object({code:z.string().regex(/^[A-Z0-9-]{3,50}$/),slug:z.string().regex(/^[a-z0-9-]{2,80}$/),title_ar:name,title_en:name,category:z.string().trim().min(2).max(80).default('software'),summary_ar:z.string().max(450).default(''),summary_en:z.string().max(450).default(''),description_ar:z.string().max(5000).default(''),description_en:z.string().max(5000).default(''),features_ar:z.array(z.string().max(180)).max(18).default([]),features_en:z.array(z.string().max(180)).max(18).default([]),price_halalas:z.number().int().min(0).max(10000000000).nullable().default(null),published:z.boolean().default(false),sort_order:z.number().int().min(0).max(9999).default(100)});
const page=z.object({slug:z.string().regex(/^[a-z0-9-]{2,80}$/),title_ar:name,title_en:name,body_ar:z.string().max(25000).default(''),body_en:z.string().max(25000).default(''),seo_description_ar:z.string().max(300).default(''),seo_description_en:z.string().max(300).default(''),published:z.boolean().default(false)});
const enquiry=z.object({name,email:z.email().max(180),phone:z.string().max(35).default(''),company:z.string().max(160).default(''),product_code:z.string().max(50).default(''),message:z.string().trim().min(10).max(3500),website:z.string().max(100).default('')});
export function installMifWebsite(app,{db,env,query}){
 const getSite=async(sql)=>{const settings=await query(sql,'SELECT key,value FROM mif_site_settings');return Object.fromEntries(settings.map(x=>[x.key,x.value]));};
 app.get('/api/mif/site',async c=>{
  const sql=db(c);if(!sql)return error(c,503,'MIF website data source is not connected');
  const [settings,pages,products]=await Promise.all([getSite(sql),query(sql,'SELECT slug,title_ar,title_en,body_ar,body_en,seo_description_ar,seo_description_en FROM mif_site_pages WHERE published=true ORDER BY slug'),query(sql,'SELECT code,slug,title_ar,title_en,category,summary_ar,summary_en,description_ar,description_en,features_ar,features_en,price_halalas,currency FROM mif_products WHERE published=true ORDER BY sort_order,created_at')]);
  return c.json({ok:true,settings,pages,products});
 });
 app.post('/api/mif/enquiries',async c=>{
  const data=enquiry.safeParse(await read(c));if(!data.success)return error(c,400,'Invalid inquiry information');
  if(data.data.website)return c.json({ok:true});
  const sql=db(c),ip=c.req.header('CF-Connecting-IP')||c.req.header('X-Real-IP');
  if(!sql)return error(c,503,'Website inquiries are unavailable');
  if(!ip||!env(c).SESSION_SECRET)return error(c,503,'Request validation is not configured');
  const key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env(c).SESSION_SECRET+'|mif-web|'+ip))),n=>n.toString(16).padStart(2,'0')).join('');
  const a=await query(sql,`INSERT INTO mif_site_rate_limits(client_key,bucket,count,expires_at) VALUES($1,'hour',1,now()+interval '1 hour')
    ON CONFLICT(client_key,bucket) DO UPDATE SET count=CASE WHEN mif_site_rate_limits.expires_at<now() THEN 1 ELSE mif_site_rate_limits.count+1 END,
    expires_at=CASE WHEN mif_site_rate_limits.expires_at<now() THEN now()+interval '1 hour' ELSE mif_site_rate_limits.expires_at END RETURNING count`,[key]);
  if(Number(a[0]?.count)>6)return error(c,429,'Too many inquiries from this source');
  const x=data.data;
  await query(sql,'INSERT INTO mif_site_inquiries(name,email,phone,company,product_code,message) VALUES($1,$2,$3,$4,$5,$6)',[x.name,x.email,x.phone,x.company,x.product_code,x.message]);
  return c.json({ok:true},201);
 });
 // Owner-only APIs stay protected even if the marketing website is public.
 app.use('/api/admin/mif/*',async(c,next)=>{
  const sql=db(c),email=env(c).PLATFORM_OWNER_EMAIL?.trim().toLowerCase(),actor=c.get('adminId');
  if(!sql||!email||!actor)return error(c,403,'MIF operator only');
  const row=await query(sql,'SELECT id FROM admins WHERE id=$1 AND lower(email)=$2',[actor,email]);
  if(!row.length)return error(c,403,'MIF operator only');
  await next();
 });
 app.get('/api/admin/mif/settings',async c=>c.json({ok:true,data:await getSite(db(c))}));
 app.put('/api/admin/mif/settings/:key',async c=>{
  const key=c.req.param('key');if(!['identity','contact','seo'].includes(key))return error(c,400,'Unknown website section');
  const v=await read(c);if(!v||typeof v!=='object'||Array.isArray(v))return error(c,400,'Invalid website settings');
  const allowed={identity:['company_ar','company_en','tagline_ar','tagline_en','hero_title_ar','hero_title_en','hero_description_ar','hero_description_en'],contact:['email','phone','whatsapp','address'],seo:['title_ar','title_en','description_ar','description_en']}[key];
  if(Object.keys(v).some(x=>!allowed.includes(x))||Object.values(v).some(x=>typeof x!=='string'||x.length>800))return error(c,400,'Invalid website settings fields');
  await query(db(c),'INSERT INTO mif_site_settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()',[key,JSON.stringify(v)]);
  return c.json({ok:true});
 });
 app.get('/api/admin/mif/products',async c=>c.json({ok:true,data:await query(db(c),'SELECT * FROM mif_products ORDER BY sort_order,created_at')}));
 app.post('/api/admin/mif/products',async c=>{
  const v=product.safeParse(await read(c));if(!v.success)return error(c,400,'Invalid product');
  const p=v.data;
  const x=await query(db(c),'INSERT INTO mif_products(code,slug,title_ar,title_en,category,summary_ar,summary_en,description_ar,description_en,features_ar,features_en,price_halalas,published,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14) ON CONFLICT(code) DO NOTHING RETURNING id',[p.code,p.slug,p.title_ar,p.title_en,p.category,p.summary_ar,p.summary_en,p.description_ar,p.description_en,JSON.stringify(p.features_ar),JSON.stringify(p.features_en),p.price_halalas,p.published,p.sort_order]);
  return x.length?c.json({ok:true,id:x[0].id},201):error(c,409,'Product code already exists');
 });
 app.patch('/api/admin/mif/products/:id',async c=>{
  if(!id.safeParse(c.req.param('id')).success)return error(c,400,'Invalid product');
  const v=product.omit({code:true}).safeParse(await read(c));if(!v.success)return error(c,400,'Invalid product');
  const p=v.data,rows=await query(db(c),'UPDATE mif_products SET slug=$1,title_ar=$2,title_en=$3,category=$4,summary_ar=$5,summary_en=$6,description_ar=$7,description_en=$8,features_ar=$9::jsonb,features_en=$10::jsonb,price_halalas=$11,published=$12,sort_order=$13,updated_at=now() WHERE id=$14 RETURNING id',[p.slug,p.title_ar,p.title_en,p.category,p.summary_ar,p.summary_en,p.description_ar,p.description_en,JSON.stringify(p.features_ar),JSON.stringify(p.features_en),p.price_halalas,p.published,p.sort_order,c.req.param('id')]);
  return rows.length?c.json({ok:true}):error(c,404,'Product not found');
 });
 app.get('/api/admin/mif/pages',async c=>c.json({ok:true,data:await query(db(c),'SELECT * FROM mif_site_pages ORDER BY slug')}));
 app.post('/api/admin/mif/pages',async c=>{
  const v=page.safeParse(await read(c));if(!v.success)return error(c,400,'Invalid page');
  const x=v.data,r=await query(db(c),'INSERT INTO mif_site_pages(slug,title_ar,title_en,body_ar,body_en,seo_description_ar,seo_description_en,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(slug) DO NOTHING RETURNING id',[x.slug,x.title_ar,x.title_en,x.body_ar,x.body_en,x.seo_description_ar,x.seo_description_en,x.published]);return r.length?c.json({ok:true,id:r[0].id},201):error(c,409,'Page slug exists');
 });
 app.patch('/api/admin/mif/pages/:id',async c=>{
  if(!id.safeParse(c.req.param('id')).success)return error(c,400,'Invalid page');
  const v=page.safeParse(await read(c));if(!v.success)return error(c,400,'Invalid page');
  const x=v.data,r=await query(db(c),'UPDATE mif_site_pages SET slug=$1,title_ar=$2,title_en=$3,body_ar=$4,body_en=$5,seo_description_ar=$6,seo_description_en=$7,published=$8,updated_at=now() WHERE id=$9 RETURNING id',[x.slug,x.title_ar,x.title_en,x.body_ar,x.body_en,x.seo_description_ar,x.seo_description_en,x.published,c.req.param('id')]);return r.length?c.json({ok:true}):error(c,404,'Page not found');
 });
 app.get('/api/admin/mif/inquiries',async c=>c.json({ok:true,data:await query(db(c),'SELECT * FROM mif_site_inquiries ORDER BY created_at DESC LIMIT 500')}));
 app.patch('/api/admin/mif/inquiries/:id',async c=>{
  if(!id.safeParse(c.req.param('id')).success)return error(c,400,'Invalid inquiry');
  const v=z.object({status:z.enum(['new','contacted','qualified','closed'])}).safeParse(await read(c));if(!v.success)return error(c,400,'Invalid status');
  const r=await query(db(c),'UPDATE mif_site_inquiries SET status=$1 WHERE id=$2 RETURNING id',[v.data.status,c.req.param('id')]);return r.length?c.json({ok:true}):error(c,404,'Inquiry not found');
 });
}
