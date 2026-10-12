import {z} from 'zod';
const uid=z.string().uuid();
const invalid=(c,message,status=400)=>c.json({ok:false,error:message},status);
const body=async c=>{try{return await c.req.json()}catch{return {}}};
const customer=z.object({name:z.string().min(2).max(180),kind:z.enum(['customer','vendor','person']).default('customer'),email:z.string().max(180).default(''),phone:z.string().max(40).default(''),company:z.string().max(180).default(''),address:z.string().max(1000).default(''),tax_number:z.string().max(40).default(''),notes:z.string().max(3000).default('')});
const task=z.object({title:z.string().min(2).max(200),description:z.string().max(3000).default(''),due_at:z.string().datetime({offset:true}),repeat:z.enum(['once','daily','weekly','monthly']).default('once')});
const item=z.object({description:z.string().min(1).max(500),quantity:z.number().positive().max(100000),unit_price:z.number().min(0).max(10000000)});
const invoice=z.object({customer_id:uid,template_id:uid.nullable().optional(),issued_on:z.iso.date().optional(),due_on:z.iso.date().nullable().optional(),notes:z.string().max(2000).default(''),lines:z.array(item).min(1).max(100)});
export function invoiceTotals(lines,vatRate=0.15){
 if(!Number.isFinite(vatRate)||vatRate<0||vatRate>1)throw Error('Invalid sales tax rate');
 let subtotal=0,vat=0;
 const items=lines.map(l=>{const amount=Math.round(l.quantity*l.unit_price*100);if(!Number.isSafeInteger(amount))throw Error('Amount overflow');const tax=Math.round(amount*vatRate);subtotal+=amount;vat+=tax;return {...l,amount_halalas:amount,vat_halalas:tax}});
 if(!Number.isSafeInteger(subtotal+vat)||subtotal+vat>1000000000000)throw Error('Amount overflow');
 return {lines:items,subtotal_halalas:subtotal,vat_halalas:vat,total_halalas:subtotal+vat};
}
export function validateRemote(url,provider){
 let u;try{u=new URL(url)}catch{throw Error('Enter a valid HTTPS URL')}
 const h=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||(u.port&&u.port!=='443')||u.username||u.password||u.search||u.hash||(u.pathname&&u.pathname!=='/')||h==='localhost'||h.endsWith('.local')||h.endsWith('.internal')||h.startsWith('[')||/^[0-9.]+$/.test(h)||!h.includes('.'))throw Error('Public HTTPS domain required');
 if(provider==='zoho'&&!/^www\.zohoapis\.(com|eu|in|com\.au|jp|com\.cn)$/.test(h))throw Error('Unsupported Zoho API host');
 return u.origin;
}
async function cipherKey(master){
 if(!master||master.length<32)throw Error('CONNECTOR_ENCRYPTION_KEY is required');
 return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(master)),'AES-GCM',false,['encrypt','decrypt']);
}
const toB64=a=>btoa(String.fromCharCode(...a));
const fromB64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
// Provider credentials remain encrypted without requiring an unrelated signup setting.
// Keep SESSION_SECRET stable; changing it requires re-entering provider credentials.
export function providerEncryptionKey(settings){
 if(typeof settings.CONNECTOR_ENCRYPTION_KEY==='string'&&settings.CONNECTOR_ENCRYPTION_KEY.length>=32)return settings.CONNECTOR_ENCRYPTION_KEY;
 if(typeof settings.SESSION_SECRET==='string'&&settings.SESSION_SECRET.length>=32)return 'mif-smart/ai-provider-secrets/v1/'+settings.SESSION_SECRET;
 throw Error('AI provider encryption secret is not configured');
}
export async function unsealProviderSecret(value,settings){
 const preferred=providerEncryptionKey(settings);
 try{return await unseal(value,preferred)}catch(e){
  const fallback='mif-smart/ai-provider-secrets/v1/'+String(settings.SESSION_SECRET||'');
  if(fallback!==preferred&&String(settings.SESSION_SECRET||'').length>=32)return unseal(value,fallback);
  throw e;
 }
}
export async function seal(value,master){
 const k=await cipherKey(master),iv=crypto.getRandomValues(new Uint8Array(12));
 const v=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(value)));
 return toB64(iv)+'.'+toB64(v);
}
export async function unseal(value,master){
 const [i,v]=value.split('.'),k=await cipherKey(master);
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(i)},k,fromB64(v)));
}
export async function runErpSchedule(sql){
 return sql.query("WITH due AS(SELECT id FROM erp_tasks WHERE status='pending' AND next_run_at<=now() ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 100), changed AS(UPDATE erp_tasks t SET last_run_at=now(),next_run_at=CASE t.repeat WHEN 'daily' THEN now()+interval '1 day' WHEN 'weekly' THEN now()+interval '7 days' WHEN 'monthly' THEN now()+interval '1 month' ELSE NULL END,status=CASE WHEN t.repeat='once' THEN 'done' ELSE t.status END FROM due WHERE t.id=due.id RETURNING t.id,t.workspace_id,t.title) INSERT INTO erp_task_events(workspace_id,task_id,message) SELECT workspace_id,id,title FROM changed RETURNING task_id");
}
const integrationSchema=z.object({label:z.string().min(2).max(100),base_url:z.string().max(260).default(''),secret:z.string().max(4000).optional(),model:z.string().max(70).default('gpt-4.1-mini'),organization_id:z.string().max(50).default(''),sender:z.union([z.literal(''),z.email()]).default(''),enabled:z.boolean().default(true)});
export function installAiErp(app,{db,env,query}){
 async function gate(c,write=false){
  const sql=db(c),id=c.req.param('workspace');if(!sql)return {err:invalid(c,'Database is not connected',503)};
  if(!uid.safeParse(id).success)return {err:invalid(c,'Invalid workspace')};
  const rows=await query(sql,'SELECT role FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2',[id,c.get('adminId')]);
  if(!rows.length)return {err:invalid(c,'Workspace not found',404)};
  if(write&&rows[0].role==='viewer')return {err:invalid(c,'Read-only access',403)};
  return {sql,id};
 }
 const list=async(c,table,sort='created_at DESC')=>{const g=await gate(c);if(g.err)return g.err;if(table==='erp_tasks'||table==='erp_task_events')await runErpSchedule(g.sql).catch(e=>console.error('On-demand task processing failed',e.message));return c.json({ok:true,data:await query(g.sql,'SELECT * FROM '+table+' WHERE workspace_id=$1 ORDER BY '+sort+' LIMIT 500',[g.id])})};
 // Conversation-led repository. Every conversation remains private to its owner;
 // membership in the same business workspace never grants access to another person's chats.
 app.get('/api/admin/erp/w/:workspace/repository',async c=>{
  const g=await gate(c);if(g.err)return g.err;
  const owner=c.get('adminId');
  const [threads,notes,counts]=await Promise.all([
   query(g.sql,`SELECT t.id,t.title,t.created_at,t.updated_at,
     (SELECT COUNT(*)::int FROM mif_chat_messages m WHERE m.thread_id=t.id) message_count,
     (SELECT LEFT(m.content,1800) FROM mif_chat_messages m WHERE m.thread_id=t.id AND m.role='assistant'
      ORDER BY m.created_at DESC,m.id DESC LIMIT 1) latest_answer
    FROM mif_chat_threads t WHERE t.workspace_id=$1 AND t.owner_id=$2 ORDER BY t.updated_at DESC LIMIT 100`,[g.id,owner]),
   query(g.sql,"SELECT id,title,category,LEFT(body,900) preview,created_at FROM erp_knowledge WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100",[g.id]),
   query(g.sql,`SELECT
    (SELECT count(*)::int FROM erp_tasks WHERE workspace_id=$1 AND status='pending') open_tasks,
    (SELECT count(*)::int FROM erp_invoices WHERE workspace_id=$1) invoices,
    (SELECT count(*)::int FROM erp_contacts WHERE workspace_id=$1) contacts,
    (SELECT count(*)::int FROM erp_projects WHERE workspace_id=$1) projects`,[g.id])
  ]);
  return c.json({ok:true,data:{threads,notes,counts:counts[0]||{}}});
 });
 app.post('/api/admin/erp/w/:workspace/repository/save-thread',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  const input=z.object({thread_id:uid}).safeParse(await body(c));
  if(!input.success)return invalid(c,'Invalid conversation');
  const owner=c.get('adminId');
  const found=await query(g.sql,`SELECT t.title,
   (SELECT m.content FROM mif_chat_messages m WHERE m.thread_id=t.id AND m.role='assistant'
    ORDER BY m.created_at DESC,m.id DESC LIMIT 1) latest_answer
   FROM mif_chat_threads t WHERE t.id=$1 AND t.workspace_id=$2 AND t.owner_id=$3`,
   [input.data.thread_id,g.id,owner]);
  if(!found.length)return invalid(c,'Conversation not found',404);
  if(!found[0].latest_answer?.trim())return invalid(c,'Conversation has no AI result yet',409);
  const noteTitle=String(found[0].title||'RAWI').slice(0,180);
  const noteBody=String(found[0].latest_answer).slice(0,16000);
  const saved=await query(g.sql,`INSERT INTO erp_knowledge(workspace_id,title,body,category)
   SELECT $1,$2,$3,'conversation'
   WHERE NOT EXISTS(SELECT 1 FROM erp_knowledge WHERE workspace_id=$1
    AND category='conversation' AND title=$2 AND body=$3)
   RETURNING id,title`,[g.id,noteTitle,noteBody]);
  return c.json({ok:true,saved:saved.length>0,note:saved[0]||null});
 });
 app.get('/api/admin/erp/workspaces',async c=>{const sql=db(c);if(!sql)return invalid(c,'Database unavailable',503);const data=await query(sql,'SELECT w.*,m.role FROM erp_workspaces w JOIN erp_memberships m ON w.id=m.workspace_id JOIN mif_tenant_databases d ON d.workspace_id=w.id AND d.status=\'ready\' WHERE m.admin_id=$1 ORDER BY w.created_at DESC',[c.get('adminId')]);return c.json({ok:true,data})});
 app.post('/api/admin/erp/workspaces',async c=>{
  if(['enterprise','developer'].includes(env(c).MIF_APP_SURFACE))return invalid(c,'New workspaces require independent Neon database provisioning',503);
  const v=z.object({name:z.string().trim().min(2).max(130),currency:z.literal('SAR').default('SAR')}).safeParse(await body(c));
  if(!v.success)return invalid(c,'Invalid workspace');
  const sql=db(c);if(!sql)return invalid(c,'Database unavailable',503);
  const rows=await query(sql,"WITH w AS(INSERT INTO erp_workspaces(name,currency,owner_id) VALUES($1,$2,$3) RETURNING *),m AS(INSERT INTO erp_memberships(workspace_id,admin_id,role) SELECT id,$3,'owner' FROM w RETURNING workspace_id),t AS(INSERT INTO erp_invoice_templates(workspace_id,name) SELECT id,'MIF Default' FROM w RETURNING id) SELECT w.* FROM w JOIN m ON m.workspace_id=w.id",[v.data.name,v.data.currency,c.get('adminId')]);
  return c.json({ok:true,data:rows[0]},201);
 });
 app.put('/api/admin/erp/workspaces/:id/profile',async c=>{
  const id=c.req.param('id');if(!uid.safeParse(id).success)return invalid(c,'Invalid workspace');
  const v=z.object({legal_name:z.string().max(200),vat_number:z.string().max(40),address:z.string().max(500),phone:z.string().max(40)}).safeParse(await body(c));
  if(!v.success)return invalid(c,'Invalid company details');
  const sql=db(c);if(!sql)return invalid(c,'Database unavailable',503);
  const x=v.data;
  const rows=await query(sql,"UPDATE erp_workspaces SET legal_name=$1,vat_number=$2,address=$3,phone=$4 WHERE id=$5 AND EXISTS(SELECT 1 FROM erp_memberships WHERE workspace_id=$5 AND admin_id=$6 AND role IN('owner','admin')) RETURNING *",[x.legal_name,x.vat_number,x.address,x.phone,id,c.get('adminId')]);
  return rows.length?c.json({ok:true,data:rows[0]}):invalid(c,'Workspace unavailable',404);
 });
 app.get('/api/admin/erp/w/:workspace/overview',async c=>{
  const g=await gate(c);if(g.err)return g.err;
  const data=await query(g.sql,'SELECT (SELECT COUNT(*) FROM erp_contacts WHERE workspace_id=$1)::int contacts,(SELECT COUNT(*) FROM erp_invoices WHERE workspace_id=$1)::int invoices,(SELECT COUNT(*) FROM erp_tasks WHERE workspace_id=$1 AND status=$2)::int tasks,(SELECT COUNT(*) FROM erp_knowledge WHERE workspace_id=$1)::int knowledge',[g.id,'pending']);
  return c.json({ok:true,data:data[0]});
 });
 app.get('/api/admin/erp/w/:workspace/contacts',c=>list(c,'erp_contacts'));
 app.post('/api/admin/erp/w/:workspace/contacts',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=customer.safeParse(await body(c));if(!v.success)return invalid(c,'Invalid contact');
  const x=v.data;
  const data=await query(g.sql,'INSERT INTO erp_contacts(workspace_id,kind,name,email,phone,company,address,tax_number,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[g.id,x.kind,x.name,x.email,x.phone,x.company,x.address,x.tax_number,x.notes]);
  return c.json({ok:true,data:data[0]},201);
 });
 app.put('/api/admin/erp/w/:workspace/contacts/:record',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=customer.safeParse(await body(c));if(!v.success||!uid.safeParse(c.req.param('record')).success)return invalid(c,'Invalid contact');
  const x=v.data;const data=await query(g.sql,'UPDATE erp_contacts SET kind=$1,name=$2,email=$3,phone=$4,company=$5,address=$6,tax_number=$7,notes=$8,updated_at=now() WHERE workspace_id=$9 AND id=$10 RETURNING *',[x.kind,x.name,x.email,x.phone,x.company,x.address,x.tax_number,x.notes,g.id,c.req.param('record')]);
  return data.length?c.json({ok:true,data:data[0]}):invalid(c,'Contact not found',404);
 });
 app.get('/api/admin/erp/w/:workspace/templates',c=>list(c,'erp_invoice_templates'));
 app.post('/api/admin/erp/w/:workspace/templates',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  const v=z.object({name:z.string().min(2).max(100),primary_color:z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#e95814'),header_text:z.string().max(600).default(''),footer_text:z.string().max(600).default(''),logo_url:z.union([z.literal(''),z.url()]).default(''),layout:z.enum(['modern','classic','minimal']).default('modern')}).safeParse(await body(c));
  if(!v.success)return invalid(c,'Invalid template');
  const x=v.data;const data=await query(g.sql,'INSERT INTO erp_invoice_templates(workspace_id,name,primary_color,header_text,footer_text,logo_url,settings) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *',[g.id,x.name,x.primary_color,x.header_text,x.footer_text,x.logo_url,JSON.stringify({layout:x.layout})]);
  return c.json({ok:true,data:data[0]},201);
 });
 app.put('/api/admin/erp/w/:workspace/templates/:record',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  if(!uid.safeParse(c.req.param('record')).success)return invalid(c,'Invalid invoice template');
  const v=z.object({name:z.string().min(2).max(100),primary_color:z.string().regex(/^#[0-9a-fA-F]{6}$/),header_text:z.string().max(600),footer_text:z.string().max(600),logo_url:z.union([z.literal(''),z.url()]),layout:z.enum(['modern','classic','minimal'])}).safeParse(await body(c));
  if(!v.success)return invalid(c,'Invalid invoice template');
  const x=v.data;
  const rows=await query(g.sql,'UPDATE erp_invoice_templates SET name=$1,primary_color=$2,header_text=$3,footer_text=$4,logo_url=$5,settings=$6::jsonb WHERE workspace_id=$7 AND id=$8 RETURNING *',[x.name,x.primary_color,x.header_text,x.footer_text,x.logo_url,JSON.stringify({layout:x.layout}),g.id,c.req.param('record')]);
  return rows.length?c.json({ok:true,data:rows[0]}):invalid(c,'Template not found',404);
 });
 app.get('/api/admin/erp/w/:workspace/invoices',async c=>{
  const g=await gate(c);if(g.err)return g.err;
  const data=await query(g.sql,'SELECT i.*,c.name customer_name FROM erp_invoices i JOIN erp_contacts c ON c.id=i.customer_id WHERE i.workspace_id=$1 ORDER BY i.created_at DESC LIMIT 500',[g.id]);
  return c.json({ok:true,data});
 });
 app.post('/api/admin/erp/w/:workspace/invoices',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  const v=invoice.safeParse(await body(c));if(!v.success)return invalid(c,'Invalid invoice data');
  const x=v.data;
  const contact=await query(g.sql,"SELECT id FROM erp_contacts WHERE workspace_id=$1 AND id=$2 AND kind IN('customer','person')",[g.id,x.customer_id]);
  if(!contact.length)return invalid(c,'Customer not found');
  if(x.template_id){const tmpl=await query(g.sql,'SELECT id FROM erp_invoice_templates WHERE workspace_id=$1 AND id=$2',[g.id,x.template_id]);if(!tmpl.length)return invalid(c,'Invoice template not found');}
  const companyRate=await query(g.sql,'SELECT vat_rate FROM erp_workspaces WHERE id=$1',[g.id]);
  let t;try{t=invoiceTotals(x.lines,Number(companyRate[0]?.vat_rate??.15))}catch{return invalid(c,'Invalid invoice amounts')}
  const stmt="WITH seq AS(INSERT INTO erp_invoice_sequences(workspace_id,year,last_number) VALUES($1,EXTRACT(YEAR FROM CURRENT_DATE)::int,1) ON CONFLICT(workspace_id,year) DO UPDATE SET last_number=erp_invoice_sequences.last_number+1 RETURNING year,last_number), created AS(INSERT INTO erp_invoices(workspace_id,invoice_no,customer_id,template_id,issued_on,due_on,lines,subtotal_halalas,vat_halalas,total_halalas,notes,currency) SELECT $1,'MIF-'||seq.year||'-'||lpad(seq.last_number::text,6,'0'),$2,$3,COALESCE($4::date,CURRENT_DATE),$5::date,$6::jsonb,$7,$8,$9,$10,w.currency FROM seq CROSS JOIN erp_workspaces w WHERE w.id=$1 RETURNING *) SELECT * FROM created";
  const data=await query(g.sql,stmt,[g.id,x.customer_id,x.template_id||null,x.issued_on||null,x.due_on||null,JSON.stringify(t.lines),t.subtotal_halalas,t.vat_halalas,t.total_halalas,x.notes]);
  return c.json({ok:true,data:data[0]},201);
 });
 app.patch('/api/admin/erp/w/:workspace/invoices/:record/status',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  const x=z.object({status:z.enum(['issued','paid','cancelled'])}).safeParse(await body(c));
  if(!x.success||!uid.safeParse(c.req.param('record')).success)return invalid(c,'Invalid invoice');
  const data=await query(g.sql,"UPDATE erp_invoices SET status=$1 WHERE workspace_id=$2 AND id=$3 AND ((status='draft' AND $1 IN('issued','cancelled')) OR (status='issued' AND $1 IN('paid','cancelled'))) RETURNING id,status",[x.data.status,g.id,c.req.param('record')]);
  return data.length?c.json({ok:true,data:data[0]}):invalid(c,'Invalid invoice status transition',409);
 });
 app.get('/api/admin/erp/w/:workspace/tasks',c=>list(c,'erp_tasks'));
 app.get('/api/admin/erp/w/:workspace/events',c=>list(c,'erp_task_events','fired_at DESC'));
 app.post('/api/admin/erp/w/:workspace/tasks',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  const v=task.safeParse(await body(c));if(!v.success)return invalid(c,'Invalid task');
  const x=v.data;const data=await query(g.sql,'INSERT INTO erp_tasks(workspace_id,title,description,due_at,repeat,next_run_at) VALUES($1,$2,$3,$4,$5,$4) RETURNING *',[g.id,x.title,x.description,x.due_at,x.repeat]);
  return c.json({ok:true,data:data[0]},201);
 });
 app.patch('/api/admin/erp/w/:workspace/tasks/:record/status',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=z.object({status:z.enum(['done','cancelled'])}).safeParse(await body(c));
  if(!v.success||!uid.safeParse(c.req.param('record')).success)return invalid(c,'Invalid task');
  const data=await query(g.sql,"UPDATE erp_tasks SET status=$1,next_run_at=NULL WHERE workspace_id=$2 AND id=$3 AND status='pending' RETURNING id,status",[v.data.status,g.id,c.req.param('record')]);
  return data.length?c.json({ok:true,data:data[0]}):invalid(c,'Task already closed',409);
 });
 app.get('/api/admin/erp/w/:workspace/knowledge',c=>list(c,'erp_knowledge'));
 app.post('/api/admin/erp/w/:workspace/knowledge',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  const v=z.object({title:z.string().min(2).max(180),body:z.string().min(1).max(16000),category:z.string().max(60).default('general')}).safeParse(await body(c));
  if(!v.success)return invalid(c,'Invalid knowledge');
  const x=v.data;const data=await query(g.sql,'INSERT INTO erp_knowledge(workspace_id,title,body,category) VALUES($1,$2,$3,$4) RETURNING *',[g.id,x.title,x.body,x.category]);
  return c.json({ok:true,data:data[0]},201);
 });
 app.get('/api/admin/erp/w/:workspace/integrations',async c=>{
  const g=await gate(c);if(g.err)return g.err;
  const rows=await query(g.sql,'SELECT provider,label,base_url,configuration,enabled,last_checked_at,last_error,(length(encrypted_secret)>0) AS has_secret FROM erp_integrations WHERE workspace_id=$1 AND provider=$2 ORDER BY provider',[g.id,'email']);
  return c.json({ok:true,data:rows,openai_env:!!env(c).OPENAI_API_KEY,email_env:!!env(c).RESEND_API_KEY});
 });
 app.put('/api/admin/erp/w/:workspace/integrations/:provider',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const provider=c.req.param('provider');
  if(provider!=='email')return invalid(c,'Unsupported integration');
  const v=integrationSchema.safeParse(await body(c));if(!v.success)return invalid(c,'Invalid integration');
  const x=v.data;if(['odoo','erpnext','zoho'].includes(provider)&&!x.base_url)return invalid(c,'Integration URL required');
  let url='';try{if(x.base_url)url=validateRemote(x.base_url,provider)}catch(e){return invalid(c,e.message)}
  if(provider==='zoho'&&!x.organization_id)return invalid(c,'Zoho organization ID required');
  let token='';if(x.secret){try{token=await seal(x.secret,env(c).CONNECTOR_ENCRYPTION_KEY)}catch(e){return invalid(c,e.message,503)}}
  const config=JSON.stringify({model:x.model,organization_id:x.organization_id,sender:x.sender});
  const data=await query(g.sql,"INSERT INTO erp_integrations(workspace_id,provider,label,base_url,configuration,encrypted_secret,enabled) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7) ON CONFLICT(workspace_id,provider) DO UPDATE SET label=EXCLUDED.label,base_url=EXCLUDED.base_url,configuration=EXCLUDED.configuration,encrypted_secret=CASE WHEN EXCLUDED.encrypted_secret<>'' THEN EXCLUDED.encrypted_secret ELSE erp_integrations.encrypted_secret END,enabled=EXCLUDED.enabled RETURNING provider,label,base_url,configuration,enabled",[g.id,provider,x.label,url,config,token,x.enabled]);
  return c.json({ok:true,data:data[0]});
 });
 app.get('/api/admin/erp/w/:workspace/external-invoices',c=>list(c,'erp_external_invoices','updated_at DESC'));
 app.get('/api/admin/erp/w/:workspace/messages',c=>list(c,'erp_ai_messages'));
 app.post('/api/admin/erp/w/:workspace/email',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  const v=z.object({to:z.email(),subject:z.string().min(2).max(200),text:z.string().min(1).max(10000)}).safeParse(await body(c));if(!v.success)return invalid(c,'Invalid message');
  const emailCfg=await query(g.sql,"SELECT encrypted_secret,configuration FROM erp_integrations WHERE workspace_id=$1 AND provider='email' AND enabled=true",[g.id]);let key=env(c).RESEND_API_KEY||'';if(emailCfg[0]?.encrypted_secret){try{key=await unseal(emailCfg[0].encrypted_secret,env(c).CONNECTOR_ENCRYPTION_KEY)}catch{return invalid(c,'Email credential cannot be decrypted',503)}}const from=emailCfg[0]?.configuration?.sender||env(c).MAIL_FROM;if(!key||!from)return invalid(c,'Email provider not configured',503);
  let sent=false;try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[v.data.to],subject:v.data.subject,text:v.data.text})});sent=r.ok}catch{}
  await query(g.sql,'INSERT INTO erp_email_log(workspace_id,recipient,subject,delivery_status) VALUES($1,$2,$3,$4)',[g.id,v.data.to,v.data.subject,sent?'sent':'failed']);
  return sent?c.json({ok:true}):invalid(c,'Email was not sent',502);
 });
}
