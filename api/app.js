import {Hono} from 'hono';
import {getCookie,setCookie,deleteCookie} from 'hono/cookie';
import {neon} from '@neondatabase/serverless';
import {SignJWT,jwtVerify} from 'jose';
import {z} from 'zod';
import {installAiErp} from './ai-erp.js';
import {installErpCore} from './erp-core.js';
import {installMifChat} from './mif-chat.js';
import {installPlatformSaas} from './platform-saas.js';
import {installMifWebsite} from './mif-website.js';
import {installRawiAdvanced} from './rawi-advanced.js';
import {installRawiInsights} from './rawi-insights.js';
import {installRawiActivities} from './rawi-activities.js';
import {evaluationSettings,ensureEvaluationPlan,enforceAuthLimit} from './rawi-onboarding.js';
import {installRawiReadiness} from './rawi-readiness.js';
import {installRawiTeam} from './rawi-team.js';
import {attachTenantDb} from './tenant-runtime.js';
import {tenantDatabaseName,neonTenantConfig,createNeonTenantDatabase} from './neon-tenant-databases.js';
import {migrateTenantBatch} from './tenant-migrations.js';
import {createSixDigitCode,hashVerificationCode,deliverVerificationCode,mailReady} from './rawi-email-verification.js';
import {installRawiCompany} from './rawi-company.js';
import {passwordHash} from './auth-password.js';
const app=new Hono(),encoder=new TextEncoder();
const env=c=>c.env||{};
const centralDb=c=>env(c).DATABASE_URL?neon(env(c).DATABASE_URL):null;
const db=c=>c.get('tenantSQL')||centralDb(c);
const query=(sql,text,args=[])=>sql.query(text,args);
const secret=c=>{const s=env(c).SESSION_SECRET;return s?.length>=32?encoder.encode(s):null};
const loginSurface=c=>['mif','enterprise'].includes(env(c).MIF_APP_SURFACE)?env(c).MIF_APP_SURFACE:'mif';
export const sessionCookieFor=surface=>({mif:'mif_session',enterprise:'rawi_enterprise_session'}[surface]||'mif_session');
export const sessionAudienceFor=surface=>({mif:'mif-console',enterprise:'rawi-enterprise'}[surface]||'mif-console');
const fail=(c,status,message)=>c.json({ok:false,error:message},status);
const parse=async c=>{try{return await c.req.json()}catch{return {}}};
const loginData=z.object({email:z.email().max(180),password:z.string().min(1).max(200)});
const hashed=passwordHash;
async function equal(a,b){const x=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(a)));const y=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(b)));return x.every((n,i)=>n===y[i])}
function originOK(c){const origin=c.req.header('origin');if(!origin)return true;try{const src=new URL(origin),dst=new URL(c.req.url);return src.origin===dst.origin||(['localhost','127.0.0.1'].includes(src.hostname)&&['localhost','127.0.0.1'].includes(dst.hostname))}catch{return false}}
app.onError((e,c)=>{console.error('ERP request failed',e?.message);return fail(c,500,'Server operation failed')});
app.use('/api/*',async(c,next)=>{c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');c.header('X-Frame-Options','DENY');c.header('Referrer-Policy','strict-origin-when-cross-origin');if(!['GET','HEAD','OPTIONS'].includes(c.req.method)&&!originOK(c))return fail(c,403,'Cross-origin request rejected');await next()});
function signupReady(settings){
 try{return settings.REGISTRATION_ENABLED==='true'&&!!settings.DATABASE_URL&&settings.SESSION_SECRET?.length>=32&&mailReady(settings)&&!!neonTenantConfig(settings)}catch{return false}
}
app.get('/api/public/rawi/status',c=>c.json({ok:true,registration_enabled:signupReady(env(c)),evaluation_available:signupReady(env(c)),odoo_developer_supported:false}));
app.get('/api/health',async c=>{
 const kind=env(c).MIF_APP_SURFACE;
 const service=kind==='enterprise'?'RAWI ERP':'MIF Smart';
 const sql=db(c);if(!sql)return c.json({ok:false,service,database:'not_configured'},503);
 try{await query(sql,'SELECT 1');return c.json({ok:true,service,database:'connected'})}
 catch{return c.json({ok:false,service,database:'unavailable'},503)}
});
app.post('/api/admin/bootstrap',async c=>{const sql=db(c),key=secret(c),bootstrap=env(c).ADMIN_BOOTSTRAP_TOKEN,ownerEmail=env(c).PLATFORM_OWNER_EMAIL?.trim().toLowerCase();if(env(c).MIF_APP_SURFACE==='enterprise')return fail(c,404,'Not found');if(!sql||!key||!bootstrap||bootstrap.length<24)return fail(c,503,'Administrator setup unavailable');const input=await parse(c),v=loginData.safeParse(input);if(!v.success||input.password.length<12||typeof input.token!=='string'||!(await equal(input.token,bootstrap))||!ownerEmail||v.data.email.toLowerCase()!==ownerEmail)return fail(c,403,'Administrator setup denied');const count=await query(sql,'SELECT count(*)::int n FROM admins WHERE lower(email)=$1',[ownerEmail]);if(count[0].n)return fail(c,409,'Administrator already exists');const salt=crypto.randomUUID(),password_hash=await hashed(v.data.password,salt);await query(sql,'INSERT INTO admins(email,password_hash,salt) VALUES($1,$2,$3)',[v.data.email.toLowerCase(),password_hash,salt]);return c.json({ok:true})});
// Customer accounts are independent from the platform operator's OpenAI settings.
app.post('/api/admin/register',async c=>{
 const sql=centralDb(c),settings=env(c),surface=loginSurface(c);
 if(surface!=='enterprise')return fail(c,404,'Not found');
 if(!signupReady(settings))return fail(c,503,'Email verification is not configured for registration');
 const schema=z.object({email:z.email().max(180),password:z.string().min(12).max(200),
  name:z.string().trim().min(2).max(160),account_type:z.literal('enterprise'),language:z.enum(['ar','en']).default('ar')});
 const v=schema.safeParse(await parse(c));if(!v.success)return fail(c,400,'Invalid account registration');
 const user=v.data,email=user.email.trim().toLowerCase(),ip=c.req.header('CF-Connecting-IP')||c.req.header('X-Real-IP');
 if(!ip)return fail(c,403,'Unable to verify registration source');
 let allowed;try{allowed=await enforceAuthLimit(sql,query,settings.SESSION_SECRET,ip,'registration',email)}
 catch{return fail(c,503,'Registration protection is unavailable')}
 if(!allowed.allowed)return fail(c,429,'Too many requests. Try again later');
 let stage='account_lookup';
 try{
 const exists=await query(sql,'SELECT 1 FROM admins WHERE email=$1 LIMIT 1',[email]);
 if(exists.length)return fail(c,409,'Email is already registered');
 stage='otp_generation';
 const code=createSixDigitCode(),codeHash=await hashVerificationCode(settings.SESSION_SECRET,email,code);
 stage='salt_generation';
 const salt=crypto.randomUUID();
 stage='password_hash';
 const passwordHash=await hashed(user.password,salt);
 stage='pending_record';
 const pending=await query(sql,`INSERT INTO rawi_pending_signups(email,full_name,password_hash,salt,code_hash,expires_at)
  VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')
  ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash,
   salt=EXCLUDED.salt,code_hash=EXCLUDED.code_hash,attempts=0,sent_at=now(),expires_at=EXCLUDED.expires_at
  WHERE rawi_pending_signups.sent_at<now()-interval '60 seconds'
  RETURNING email`,[email,user.name,passwordHash,salt,codeHash]);
 if(!pending.length)return fail(c,429,'Please wait one minute before requesting another code');
 try{await deliverVerificationCode(settings,email,code,user.language)}
 catch(e){console.error('RAWI verification email delivery failed',e?.message);
  await query(sql,'DELETE FROM rawi_pending_signups WHERE email=$1 AND code_hash=$2',[email,codeHash]).catch(()=>{});
  return fail(c,503,'Could not send verification email. Please try again later')}
 return c.json({ok:true,email,verification_required:true,expires_in_seconds:600},202);
 }catch(e){console.error('RAWI registration failed in '+stage,e?.message);return c.json({ok:false,error:'Registration is temporarily unavailable',code:'SIGNUP_'+stage.toUpperCase()},503)}
});
app.post('/api/admin/verify-email',async c=>{
 const sql=centralDb(c),settings=env(c),surface=loginSurface(c);
 if(surface!=='enterprise')return fail(c,404,'Not found');
 if(!sql||!secret(c))return fail(c,503,'Email verification unavailable');
 const v=z.object({email:z.email().max(180),code:z.string().regex(/^\d{6}$/)}).safeParse(await parse(c));
 if(!v.success)return fail(c,400,'Enter a valid 6-digit verification code');
 const email=v.data.email.toLowerCase(),hash=await hashVerificationCode(settings.SESSION_SECRET,email,v.data.code);
 const pending=await query(sql,`DELETE FROM rawi_pending_signups
  WHERE email=$1 AND code_hash=$2 AND expires_at>now() AND attempts<5
  RETURNING full_name,password_hash,salt`,[email,hash]);
 if(!pending.length){
  await query(sql,`UPDATE rawi_pending_signups SET attempts=attempts+1
   WHERE email=$1 AND expires_at>now() AND attempts<5 AND code_hash<>$2`,[email,hash]);
  return fail(c,400,'Invalid or expired verification code');
 }
 let trial,plan;
 try{trial=evaluationSettings(settings);plan=await ensureEvaluationPlan(sql,query,trial,surface)}
 catch{return fail(c,503,'Account plan is unavailable')}
 const user=pending[0];
 const statement=`WITH account AS(
  INSERT INTO admins(email,password_hash,salt)
  SELECT $1,$2,$3 WHERE (SELECT count(*) FROM admins WHERE created_at>now()-interval '24 hours')<15
  ON CONFLICT(email) DO NOTHING RETURNING id,email
 ), workspace AS(
  INSERT INTO erp_workspaces(name,owner_id,currency)
  SELECT $4,id,'SAR' FROM account RETURNING id,owner_id
 ), membership AS(
  INSERT INTO erp_memberships(workspace_id,admin_id,role)
  SELECT id,owner_id,'owner' FROM workspace RETURNING workspace_id
 ), profile AS(
  INSERT INTO rawi_account_profiles(admin_id,account_type)
  SELECT id,$5 FROM account RETURNING admin_id
 ), subscription AS(
  INSERT INTO mif_tenant_subscriptions(workspace_id,plan_id,status,period_starts_at,period_ends_at)
  SELECT id,$6,'trial',now(),now()+($7::int*interval '1 day')
  FROM workspace RETURNING workspace_id
 ), registry AS(
  INSERT INTO mif_tenant_databases(workspace_id,application,neon_project_id,neon_branch_id,database_name,status)
  SELECT id,$5,$8,$9,
   'rawi_'||CASE WHEN $5='developer' THEN 'd' ELSE 'e' END||'_'||replace(id::text,'-',''),'allocating'
  FROM workspace RETURNING workspace_id,database_name
 ), company AS(
  INSERT INTO rawi_company_profiles(workspace_id) SELECT id FROM workspace RETURNING workspace_id
 )
 SELECT account.id,account.email,registry.workspace_id,registry.database_name FROM account
 JOIN workspace ON workspace.owner_id=account.id
 JOIN membership ON membership.workspace_id=workspace.id
 JOIN subscription ON subscription.workspace_id=workspace.id
 JOIN profile ON profile.admin_id=account.id
 JOIN registry ON registry.workspace_id=workspace.id
 JOIN company ON company.workspace_id=workspace.id`;

 const rows=await query(sql,statement,[email,user.password_hash,user.salt,user.full_name.slice(0,150),surface,plan.id,trial.days,settings.NEON_PROJECT_ID,settings.NEON_BRANCH_ID]);
 if(!rows.length)return fail(c,409,'Account already exists or daily signup limit reached');
 const record=rows[0];
 try{await createNeonTenantDatabase(settings,record.workspace_id,surface);
  await query(sql,`UPDATE mif_tenant_databases SET status='created',updated_at=now()
   WHERE workspace_id=$1 AND status='allocating'`,[record.workspace_id])
 }catch(e){console.error('RAWI account tenant allocation failed',e?.message);
  await query(sql,`UPDATE mif_tenant_databases SET status='failed',last_error='Tenant allocation pending',updated_at=now()
   WHERE workspace_id=$1`,[record.workspace_id]).catch(()=>{})}
 const token=await new SignJWT({email:record.email}).setProtectedHeader({alg:'HS256'})
  .setSubject(record.id).setIssuer('mif-smart').setAudience(sessionAudienceFor(surface))
  .setIssuedAt().setExpirationTime('8h').sign(secret(c));
 setCookie(c,sessionCookieFor(surface),token,{httpOnly:true,sameSite:'Strict',
  secure:new URL(c.req.url).protocol==='https:',path:'/',maxAge:28800});
 return c.json({ok:true,email:record.email,workspace_id:record.workspace_id,company_setup_required:true},201);
});
app.get('/api/admin/tenant/status',async c=>{
 const surface=loginSurface(c),sql=centralDb(c);
 if(!['enterprise','developer'].includes(surface)||!sql)return fail(c,404,'Not found');
 const records=await query(sql,`SELECT d.workspace_id,d.status,d.migration_version,d.last_error,w.name
 FROM mif_tenant_databases d JOIN erp_workspaces w ON w.id=d.workspace_id
 JOIN erp_memberships m ON m.workspace_id=w.id WHERE m.admin_id=$1 AND d.application=$2
 ORDER BY w.created_at ASC LIMIT 20`,[c.get('adminId'),surface]);
 return c.json({ok:true,data:records});
});
app.post('/api/admin/tenant/initialize',async c=>{
 const surface=loginSurface(c),sql=centralDb(c),settings=env(c);
 if(!['enterprise','developer'].includes(surface)||!sql)return fail(c,404,'Not found');
 const records=await query(sql,`SELECT d.workspace_id,d.status,d.migration_version
 FROM mif_tenant_databases d JOIN erp_workspaces w ON w.id=d.workspace_id
 JOIN erp_memberships m ON m.workspace_id=w.id AND m.role='owner'
 WHERE m.admin_id=$1 AND d.application=$2 ORDER BY w.created_at ASC LIMIT 1`,[c.get('adminId'),surface]);
 if(!records.length)return fail(c,404,'No customer database');
 const record=records[0];
 if(record.status==='ready')return c.json({ok:true,status:'ready',workspace_id:record.workspace_id});
 if(record.status==='allocating'||record.status==='failed'&&Number(record.migration_version||0)===0){
  try{
   await createNeonTenantDatabase(settings,record.workspace_id,surface);
   await query(sql,`UPDATE mif_tenant_databases SET status='created',last_error='',updated_at=now()
    WHERE workspace_id=$1`,[record.workspace_id]);
  }catch{return fail(c,503,'Neon database allocation unavailable')}
 }
 try{
  const result=await migrateTenantBatch({central:sql,query,settings,workspaceId:record.workspace_id});
  return result.status==='busy'?fail(c,409,'Database setup is already running'):
    c.json({ok:true,workspace_id:record.workspace_id,...result},result.status==='ready'?200:202);
 }catch(e){console.error('Tenant migration failed',e?.message);return fail(c,503,'Neon database initialization failed')}
});
app.post('/api/admin/login',async c=>{const sql=db(c),key=secret(c);if(!sql||!key)return fail(c,503,'Admin login unavailable');const v=loginData.safeParse(await parse(c));if(!v.success)return fail(c,400,'Invalid credentials');let allowed;try{allowed=await enforceAuthLimit(sql,query,env(c).SESSION_SECRET,c.req.header('CF-Connecting-IP')||c.req.header('X-Real-IP')||'unavailable','login',v.data.email)}catch{return fail(c,503,'Login protection unavailable')}if(!allowed.allowed)return fail(c,429,'Too many login attempts; try again later');const found=await query(sql,'SELECT id,email,password_hash,salt FROM admins WHERE email=$1',[v.data.email.toLowerCase()]);const row=found[0];const hash=await hashed(v.data.password,row?.salt||'invalid-salt');if(!row||!(await equal(hash,row.password_hash)))return fail(c,401,'Invalid credentials');
 const surface=env(c).MIF_APP_SURFACE;
 if(surface==='mif'){
  const owner=env(c).PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
  if(!owner||row.email.toLowerCase()!==owner)return fail(c,403,'This sign-in is reserved for MIF Smart management');
 }else if(surface==='enterprise'){
  const profiles=await query(sql,"SELECT COALESCE(p.account_type,'enterprise') account_type FROM admins a LEFT JOIN rawi_account_profiles p ON p.admin_id=a.id WHERE a.id=$1",[row.id]);
  if(profiles[0]?.account_type!==surface)return fail(c,403,'This account belongs to the other RAWI application');
 }
 const token=await new SignJWT({email:row.email}).setProtectedHeader({alg:'HS256'}).setSubject(row.id).setIssuer('mif-smart').setAudience(sessionAudienceFor(loginSurface(c))).setIssuedAt().setExpirationTime('8h').sign(key);setCookie(c,sessionCookieFor(loginSurface(c)),token,{httpOnly:true,sameSite:'Strict',secure:new URL(c.req.url).protocol==='https:',path:'/',maxAge:28800});return c.json({ok:true,email:row.email})});
app.use('/api/admin/*',async(c,next)=>{
 if(['login','bootstrap','register','verify-email'].includes(c.req.path.split('/').pop()))return next();
 const key=secret(c);
 if(!key)return fail(c,503,'Authentication unavailable');
 const token=getCookie(c,sessionCookieFor(loginSurface(c)));
 if(!token)return fail(c,401,'Sign-in required');
 let payload;
 try{({payload}=await jwtVerify(token,key,{issuer:'mif-smart',audience:sessionAudienceFor(loginSurface(c))}))}
 catch{return fail(c,401,'Session expired')}
 c.set('adminId',payload.sub);
 const central=centralDb(c),surface=env(c).MIF_APP_SURFACE;
 if(surface==='enterprise'){
  if(!central)return fail(c,503,'Central Neon database is not connected');
  try{
   const profiles=await query(central,"SELECT COALESCE(p.account_type,'enterprise') account_type FROM admins a LEFT JOIN rawi_account_profiles p ON p.admin_id=a.id WHERE a.id=$1",[payload.sub]);
   if(profiles[0]?.account_type!==surface)return fail(c,403,'Application account mismatch');
  }catch(e){console.error('Identity verification unavailable',e?.message);return fail(c,503,'Identity service unavailable')}
 }
 try{
  const routing=await attachTenantDb(c,{central,query,settings:env(c)});
  if(routing)return fail(c,routing.status,routing.error);
 }catch(e){console.error('Customer Neon routing failed',e?.message);return fail(c,503,'Customer database unavailable')}
 c.set('centralSQL',central);
 if(surface==='enterprise'&&!['/api/admin/me','/api/admin/logout'].includes(c.req.path)
  &&!c.req.path.startsWith('/api/admin/company/')){
  const pending=await query(central,`SELECT 1 FROM rawi_company_profiles p
   JOIN erp_workspaces w ON w.id=p.workspace_id WHERE w.owner_id=$1 AND p.completed_at IS NULL LIMIT 1`,[payload.sub]);
  if(pending.length)return fail(c,409,'Complete your company profile first');
 }
 return next();
});
app.post('/api/admin/logout',c=>{deleteCookie(c,sessionCookieFor(loginSurface(c)),{path:'/'});return c.json({ok:true})});
app.get('/api/admin/my-subscription',async c=>{
 const sql=db(c);if(!sql)return fail(c,503,'Database unavailable');
 const data=await query(sql,`SELECT w.id workspace_id,w.name workspace_name,s.status,s.messages_used,s.period_starts_at,s.period_ends_at,p.code plan_code,p.title plan_name,p.message_limit,
 CASE WHEN s.status IN ('trial','active') AND s.period_ends_at>now() THEN GREATEST(0,p.message_limit-s.messages_used) ELSE 0 END messages_remaining
 FROM erp_workspaces w JOIN erp_memberships m ON m.workspace_id=w.id
 LEFT JOIN mif_tenant_subscriptions s ON s.workspace_id=w.id
 LEFT JOIN mif_subscription_plans p ON p.id=s.plan_id
 WHERE m.admin_id=$1 ORDER BY w.created_at DESC`,[c.get('adminId')]);
 return c.json({ok:true,data});
});
app.get('/api/admin/me',async c=>{const sql=db(c);if(!sql)return fail(c,503,'Database unavailable');const rows=await query(sql,`SELECT a.id,a.email,COALESCE(p.account_type,'enterprise') account_type FROM admins a LEFT JOIN rawi_account_profiles p ON p.admin_id=a.id WHERE a.id=$1`,[c.get('adminId')]);const pending=await query(centralDb(c),`SELECT w.id workspace_id FROM erp_workspaces w JOIN rawi_company_profiles p ON p.workspace_id=w.id WHERE w.owner_id=$1 AND p.completed_at IS NULL LIMIT 1`,[c.get('adminId')]);return rows.length?c.json({ok:true,id:rows[0].id,email:rows[0].email,account_type:rows[0].account_type,company_setup_required:pending.length>0,setup_workspace_id:pending[0]?.workspace_id||null,platform_owner:!!env(c).PLATFORM_OWNER_EMAIL&&rows[0].email.toLowerCase()===env(c).PLATFORM_OWNER_EMAIL.trim().toLowerCase()}):fail(c,401,'Account not found')});
installRawiCompany(app,{centralDb,env,query});
installAiErp(app,{db,env,query});
installRawiTeam(app,{db,query});
installErpCore(app,{db,env,query});
installMifChat(app,{db,env,query,centralDb});
installPlatformSaas(app,{db,env,query});
installRawiReadiness(app,{db,env,query});
installMifWebsite(app,{db,env,query});
installRawiAdvanced(app,{db,query});
installRawiInsights(app,{db,query});
installRawiActivities(app,{db,query});
export default app;
