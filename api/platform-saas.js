import {z} from 'zod';
import {createNeonTenantDatabase,tenantDatabaseName,neonTenantConfig} from './neon-tenant-databases.js';
import {migrateTenantBatch} from './tenant-migrations.js';
import {hashInvite,newInviteToken} from './rawi-invitations.js';
import {seal} from './ai-erp.js';
import {providerCodes,getAIProviders,routeAI} from './ai-router.js';
const uuid=z.string().uuid();
const failed=(c,status,error)=>c.json({ok:false,error},status);
const payload=async c=>{try{return await c.req.json()}catch{return {}}};
const model=z.string().regex(/^[a-zA-Z0-9._@/:-]{2,150}$/);
const providerInput=z.object({model,enabled:z.boolean(),priority:z.number().int().min(1).max(999),secret:z.string().min(12).max(4000).optional()});
const planInput=z.object({code:z.string().regex(/^[a-z0-9-]{2,40}$/),title:z.string().trim().min(2).max(120),cycle:z.enum(['monthly','yearly']),price_halalas:z.number().int().min(0).max(1000000000),message_limit:z.number().int().min(1).max(1000000),application:z.enum(['enterprise','developer']).default('enterprise'),active:z.boolean()});
const subscriptionInput=z.object({plan_id:uuid,status:z.enum(['trial','active','past_due','suspended','cancelled']),period_ends_at:z.iso.datetime({offset:true}),reset_usage:z.boolean().default(false)});
const names={openai:'OpenAI',anthropic:'Anthropic Claude',gemini:'Google Gemini',groq:'GroqCloud',openrouter:'OpenRouter',workers_ai:'Cloudflare Workers AI'};
const keyVars={openai:'OPENAI_API_KEY',anthropic:'ANTHROPIC_API_KEY',gemini:'GEMINI_API_KEY',groq:'GROQ_API_KEY',openrouter:'OPENROUTER_API_KEY',workers_ai:''};
export function installPlatformSaas(app,{db,env,query}){
 app.use('/api/admin/platform/*',async(c,next)=>{
  const sql=db(c),email=env(c).PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
  if(!sql||!email||!c.get('adminId'))return failed(c,403,'Platform owner access only');
  const rows=await query(sql,'SELECT id FROM admins WHERE id=$1 AND lower(email)=$2',[c.get('adminId'),email]);
  if(!rows.length)return failed(c,403,'Platform owner access only');
  await next();
 });
 app.get('/api/admin/platform/overview',async c=>{
  const sql=db(c),[summary,usage]=await Promise.all([
   query(sql,`SELECT (SELECT count(*)::int FROM erp_workspaces) tenants,
     (SELECT count(*)::int FROM mif_tenant_subscriptions WHERE status IN ('active','trial') AND period_ends_at>now()) active_subscriptions,
     (SELECT count(*)::int FROM mif_subscription_plans WHERE active=true) plans,
     (SELECT count(*)::int FROM mif_ai_providers WHERE enabled=true) active_providers`),
   query(sql,"SELECT count(*)::int requests,COALESCE(sum(input_tokens),0)::bigint input_tokens,COALESCE(sum(output_tokens),0)::bigint output_tokens FROM mif_ai_usage WHERE created_at>now()-interval '30 days'")
  ]);
  return c.json({ok:true,data:{...summary[0],...usage[0]}});
 });
 app.get('/api/admin/platform/providers',async c=>{
  const rows=await query(db(c),'SELECT code,model,priority,enabled,length(encrypted_key)>0 configured,updated_at FROM mif_ai_providers ORDER BY priority,code');
  return c.json({ok:true,data:providerCodes.map(code=>{const x=rows.find(r=>r.code===code);return {code,label:names[code],model:x?.model||'',priority:x?.priority||100,enabled:!!x?.enabled,configured:code==='workers_ai'?!!env(c).AI?.run:!!x?.configured||!!env(c)[keyVars[code]],managed_by:code==='workers_ai'?'binding':env(c)[keyVars[code]]?'environment':'platform',updated_at:x?.updated_at||null};})});
 });
 app.put('/api/admin/platform/providers/:code',async c=>{
  const code=c.req.param('code');
  if(!providerCodes.includes(code))return failed(c,400,'Unsupported AI provider');
  const v=providerInput.safeParse(await payload(c));if(!v.success)return failed(c,400,'Invalid provider configuration');
  const sql=db(c),x=v.data,secretVar=env(c)[keyVars[code]];let encrypted='';
  const existing=await query(sql,'SELECT encrypted_key FROM mif_ai_providers WHERE code=$1',[code]);
  if(x.secret){
   if(secretVar)return failed(c,409,'Credential is managed by hosting secrets');
   try{encrypted=await seal(x.secret,env(c).CONNECTOR_ENCRYPTION_KEY)}catch{return failed(c,503,'Secret encryption not configured')}
  }else encrypted=existing[0]?.encrypted_key||'';
  if(x.enabled&&code==='workers_ai'&&!env(c).AI?.run)return failed(c,400,'Configure Cloudflare Workers AI binding before enabling');
  if(x.enabled&&code!=='workers_ai'&&!encrypted&&!secretVar)return failed(c,400,'Set an API key before enabling this provider');
  await query(sql,'INSERT INTO mif_ai_providers(code,model,encrypted_key,enabled,priority) VALUES($1,$2,$3,$4,$5) ON CONFLICT(code) DO UPDATE SET model=$2,encrypted_key=$3,enabled=$4,priority=$5,updated_at=now()',[code,x.model,encrypted,x.enabled,x.priority]);
  return c.json({ok:true,configured:code==='workers_ai'?!!env(c).AI?.run:!!encrypted||!!secretVar});
 });
 app.post('/api/admin/platform/providers/:code/test',async c=>{
  const code=c.req.param('code');
  if(!providerCodes.includes(code))return failed(c,400,'Unknown AI provider');
  const sql=db(c),active=await query(sql,'SELECT code FROM mif_ai_providers WHERE code=$1 AND enabled=true',[code]);
  if(!active.length)return failed(c,409,'Enable the provider before testing it');
  const providers=await getAIProviders(sql,env(c),query),target=providers.find(p=>p.code===code);
  if(!target)return failed(c,503,'Provider key or AI binding is not configured');
  try{const result=await routeAI('Respond with a short greeting in Arabic.',[target]);
    return c.json({ok:true,provider:result.provider,model:result.model,answer:result.answer,input_tokens:result.input_tokens,output_tokens:result.output_tokens});
  }catch(e){return failed(c,e.status||502,e.message)}
 });
 app.get('/api/admin/platform/ai-quotas',async c=>{
  const usage=await query(db(c),"SELECT provider,count(*)::int requests,coalesce(sum(input_tokens),0)::bigint input_tokens,coalesce(sum(output_tokens),0)::bigint output_tokens FROM mif_ai_usage WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' GROUP BY provider");
  return c.json({ok:true,period:'UTC today',source:'MIF Smart measured AI requests only',external_credits_verified:false,usage:providerCodes.map(code=>({provider:code,...(usage.find(u=>u.provider===code)||{requests:0,input_tokens:0,output_tokens:0})}))});
 });
 app.get('/api/admin/platform/plans',async c=>c.json({ok:true,data:await query(db(c),'SELECT id,code,title,cycle,price_halalas,message_limit,application,active,created_at FROM mif_subscription_plans ORDER BY created_at DESC')}));
 app.post('/api/admin/platform/plans',async c=>{
  const v=planInput.safeParse(await payload(c));if(!v.success)return failed(c,400,'Invalid subscription plan');
  const x=v.data;
  const rows=await query(db(c),'INSERT INTO mif_subscription_plans(code,title,cycle,price_halalas,message_limit,active,application) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(code) DO NOTHING RETURNING id',[x.code,x.title,x.cycle,x.price_halalas,x.message_limit,x.active,x.application]);
  return rows.length?c.json({ok:true,id:rows[0].id},201):failed(c,409,'Plan code already exists');
 });
 app.patch('/api/admin/platform/plans/:id',async c=>{
  if(!uuid.safeParse(c.req.param('id')).success)return failed(c,400,'Invalid plan');
  const v=planInput.omit({code:true,application:true}).safeParse(await payload(c));if(!v.success)return failed(c,400,'Invalid plan settings');const x=v.data;
  const rows=await query(db(c),'UPDATE mif_subscription_plans SET title=$1,cycle=$2,price_halalas=$3,message_limit=$4,active=$5 WHERE id=$6 RETURNING id',[x.title,x.cycle,x.price_halalas,x.message_limit,x.active,c.req.param('id')]);
  return rows.length?c.json({ok:true}):failed(c,404,'Plan not found');
 });
 app.post('/api/admin/platform/invitations',async c=>{
  const input=z.object({
   email:z.email().max(180),application:z.enum(['enterprise','developer']),
   expires_in_days:z.number().int().min(1).max(14).default(7)
  }).safeParse(await payload(c));
  if(!input.success)return failed(c,400,'Invalid invitation');
  const settings=env(c);
  if(!settings.SESSION_SECRET||settings.SESSION_SECRET.length<32)return failed(c,503,'Invitation signing is not configured');
  const token=newInviteToken(),digest=await hashInvite(token,settings.SESSION_SECRET);
  const email=input.data.email.trim().toLowerCase(),appType=input.data.application;
  const existing=await query(db(c),'SELECT id FROM admins WHERE lower(email)=$1',[email]);
  if(existing.length)return failed(c,409,'An account with that email already exists');
  const created=await query(db(c),`INSERT INTO mif_tenant_invitations(email,application,token_hash,invited_by,expires_at)
   VALUES($1,$2,$3,$4,now()+($5::int*interval '1 day'))
   RETURNING id,expires_at`,[email,appType,digest,c.get('adminId'),input.data.expires_in_days]);
  return c.json({ok:true,id:created[0].id,email,application:appType,expires_at:created[0].expires_at,invitation:token},201);
 });
 app.get('/api/admin/platform/invitations',async c=>c.json({ok:true,data:await query(db(c),
  'SELECT id,email,application,expires_at,used_at,created_at FROM mif_tenant_invitations ORDER BY created_at DESC LIMIT 200')}));
 app.get('/api/admin/platform/tenants',async c=>c.json({ok:true,data:await query(db(c),`SELECT w.id,w.name,w.created_at,a.email owner_email,COALESCE(ap.account_type,'enterprise') application,s.plan_id,s.status subscription_status,s.messages_used,s.period_starts_at,s.period_ends_at,p.title plan_title,p.message_limit,d.status database_status,d.database_name FROM erp_workspaces w JOIN admins a ON a.id=w.owner_id LEFT JOIN rawi_account_profiles ap ON ap.admin_id=a.id LEFT JOIN mif_tenant_subscriptions s ON s.workspace_id=w.id LEFT JOIN mif_subscription_plans p ON p.id=s.plan_id LEFT JOIN mif_tenant_databases d ON d.workspace_id=w.id ORDER BY w.created_at DESC LIMIT 500`)}));
 app.get('/api/admin/platform/tenant-databases',async c=>{
  const sql=db(c);
  const rows=await query(sql,`SELECT d.workspace_id,w.name workspace_name,d.application,d.neon_project_id,d.neon_branch_id,d.database_name,d.status,d.migration_version,d.last_error,d.created_at,d.updated_at FROM mif_tenant_databases d JOIN erp_workspaces w ON w.id=d.workspace_id ORDER BY d.created_at DESC LIMIT 500`);
  return c.json({ok:true,data:rows});
 });
 app.post('/api/admin/platform/tenants/:id/provision-database',async c=>{
  const id=c.req.param('id'),settings=env(c);
  if(!uuid.safeParse(id).success)return failed(c,400,'Invalid tenant');
  try{neonTenantConfig(settings)}catch{return failed(c,503,'Neon provisioning is not configured')}
  const sql=db(c);
  const owners=await query(sql,`SELECT w.id,COALESCE(p.account_type,'enterprise') application FROM erp_workspaces w JOIN admins a ON a.id=w.owner_id LEFT JOIN rawi_account_profiles p ON p.admin_id=a.id WHERE w.id=$1`,[id]);
  if(!owners.length)return failed(c,404,'Tenant does not exist');
  const application=owners[0].application;
  const name=tenantDatabaseName(id,application);
  const first=await query(sql,`INSERT INTO mif_tenant_databases(workspace_id,application,neon_project_id,neon_branch_id,database_name,status)
   VALUES($1,$2,$3,$4,$5,'allocating') ON CONFLICT(workspace_id) DO NOTHING RETURNING workspace_id`,
    [id,application,settings.NEON_PROJECT_ID,settings.NEON_BRANCH_ID,name]);
  if(!first.length){
   const existing=await query(sql,'SELECT status,database_name,updated_at FROM mif_tenant_databases WHERE workspace_id=$1',[id]);
   if(existing[0]?.status==='created'||existing[0]?.status==='ready')return c.json({ok:true,status:existing[0].status,database_name:existing[0].database_name});
   return failed(c,409,'Database allocation already started; check status before retrying');
  }
  try{
   const result=await createNeonTenantDatabase(settings,id,application);
   await query(sql,`UPDATE mif_tenant_databases SET status='created',last_error='',updated_at=now() WHERE workspace_id=$1`,[id]);
   // Created means a separate empty database exists; schema migration and routing have NOT been verified.
   return c.json({ok:true,status:'created',database_name:result.database_name,application},201);
  }catch(e){
   await query(sql,`UPDATE mif_tenant_databases SET status='failed',last_error=$2,updated_at=now() WHERE workspace_id=$1`,[id,String(e?.message||'Neon provisioning failed').slice(0,250)]).catch(()=>{});
   return failed(c,503,'Neon provisioning failed; inspect tenant database status');
  }
 });
 app.post('/api/admin/platform/tenants/:id/initialize-database',async c=>{
  const workspaceId=c.req.param('id');if(!uuid.safeParse(workspaceId).success)return failed(c,400,'Invalid tenant');
  const central=db(c),settings=env(c);
  if(!central||!settings.DATABASE_URL)return failed(c,503,'Database is unavailable');
  const exists=await query(central,'SELECT status FROM mif_tenant_databases WHERE workspace_id=$1',[workspaceId]);
  if(!exists.length)return failed(c,404,'Tenant database is not registered');
  if(exists[0].status==='ready')return c.json({ok:true,status:'ready'});
  try{
   const result=await migrateTenantBatch({central,query,settings,workspaceId});
   if(result.status==='busy')return failed(c,409,'Tenant migration is already running');
   return c.json({ok:true,...result},result.status==='ready'?200:202);
  }catch(e){console.error('Isolated tenant schema migration failed',e?.message);return failed(c,503,'Tenant database migration failed; see database status')}
 });
 app.put('/api/admin/platform/tenants/:id/subscription',async c=>{
  const id=c.req.param('id'),v=subscriptionInput.safeParse(await payload(c));
  if(!uuid.safeParse(id).success||!v.success)return failed(c,400,'Invalid subscription');
  const sql=db(c),x=v.data,ends=new Date(x.period_ends_at);
  if(ends<=new Date()&&!['cancelled','suspended'].includes(x.status))return failed(c,400,'Subscription end date must be in the future');
  const rows=await query(sql,`INSERT INTO mif_tenant_subscriptions(workspace_id,plan_id,status,period_ends_at)
    SELECT w.id,p.id,$3,$4::timestamptz FROM erp_workspaces w JOIN admins a ON a.id=w.owner_id LEFT JOIN rawi_account_profiles ap ON ap.admin_id=a.id CROSS JOIN mif_subscription_plans p WHERE w.id=$1 AND p.id=$2 AND p.active=true AND p.application=COALESCE(ap.account_type,'enterprise')
    ON CONFLICT(workspace_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status=EXCLUDED.status,period_starts_at=CASE WHEN $5 THEN now() ELSE mif_tenant_subscriptions.period_starts_at END,period_ends_at=EXCLUDED.period_ends_at,messages_used=CASE WHEN $5 THEN 0 ELSE mif_tenant_subscriptions.messages_used END,updated_at=now() RETURNING workspace_id`,[id,x.plan_id,x.status,x.period_ends_at,x.reset_usage]);
  return rows.length?c.json({ok:true}):failed(c,404,'Tenant, active plan or matching application not found');
 });
 app.get('/api/admin/platform/usage',async c=>c.json({ok:true,data:await query(db(c),`SELECT u.workspace_id,w.name workspace_name,u.provider,u.model,count(*)::int requests,sum(u.input_tokens)::bigint input_tokens,sum(u.output_tokens)::bigint output_tokens FROM mif_ai_usage u LEFT JOIN erp_workspaces w ON w.id=u.workspace_id WHERE u.created_at>now()-interval '30 days' GROUP BY u.workspace_id,w.name,u.provider,u.model ORDER BY requests DESC LIMIT 150`)}));
 app.get('/api/admin/platform/ready',async c=>{
  const rows=await query(db(c),'SELECT code,enabled,length(encrypted_key)>0 configured FROM mif_ai_providers');
  const configured=rows.some(r=>r.enabled&&(r.code==='workers_ai'?!!env(c).AI?.run:r.configured||!!env(c)[keyVars[r.code]]))||providerCodes.filter(code=>code!=='workers_ai').some(code=>!!env(c)[keyVars[code]]);
  return c.json({ok:true,model_ready:configured,db_ready:true,credentials_hidden:true});
 });
}
