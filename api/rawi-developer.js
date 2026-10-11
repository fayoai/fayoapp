import {z} from 'zod';
import {validateRemote,seal,unseal} from './ai-erp.js';
import {buildOdooModule,moduleInput} from './rawi-module-builder.js';
import {getAIProviders,routeAI} from './ai-router.js';
import {listDeveloperPlatforms} from './rawi-platform-registry.js';
const uuid=z.string().uuid();
const fail=(c,status,error)=>c.json({ok:false,error},status);
const parse=async c=>{try{return await c.req.json()}catch{return {}}};
const connectionInput=z.object({
 label:z.string().trim().min(2).max(120),base_url:z.url().max(250),
 database_name:z.string().regex(/^[a-zA-Z0-9_\-\.]{1,100}$/),
 api_version:z.enum(['json2','jsonrpc']),
 login:z.string().max(180).default(''),
 credential:z.string().min(8).max(3000).optional()
});
const implementationInput=z.object({
 connection_id:uuid.nullable().optional(),
 title:z.string().trim().min(2).max(200),
 client_name:z.string().max(150).default(''),
 phase:z.enum(['discovery','analysis','configuration','development','migration','testing','training','golive','support']).default('discovery'),
 status:z.enum(['planned','active','blocked','done']).default('planned'),
 details:z.string().max(4000).default(''),
 due_on:z.iso.date().nullable().optional()
});
const shortError=e=>{
 const msg=String(e?.message||e||'Connection failed');
 if(/401|403|access denied|accesserror|unauthorized|forbidden|invalid api/i.test(msg))return 'Odoo rejected the credentials or this user lacks required permissions';
 if(/timeout|abort/i.test(msg))return 'Connection timed out';
 if(/not found|404/i.test(msg))return 'Requested Odoo API was not found. Check the Odoo version and API mode.';
 return 'Could not verify the Odoo connection. Check the public HTTPS URL, database, version and user access.';
};
async function safeFetch(url,options={}){
 const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(16000)});
 if(!response.ok)throw new Error('Odoo HTTP '+response.status);
 const type=response.headers?.get?.('content-type')||'application/json';
 if(!type.includes('json'))throw new Error('Odoo returned non-JSON content');
 const text=await response.text();
 if(text.length>1024*1024)throw new Error('Odoo response exceeds supported size');
 try{return JSON.parse(text)}catch{throw new Error('Invalid JSON returned by Odoo')}
}
export async function odooRead(connection,credential,model,fields=['name'],limit=50,offset=0){
 if(!['ir.module.module','res.partner','ir.cron'].includes(model))throw new Error('Unsupported read-only model');
 const safeLimit=Math.min(Math.max(Number(limit)||1,1),150),safeOffset=Number(offset);
 if(!Number.isInteger(safeOffset)||safeOffset<0||safeOffset>100000)throw new Error('Invalid Odoo record offset');
 const host=validateRemote(connection.base_url,'odoo');
 if(connection.api_version==='json2'){
  const response=await safeFetch(host+'/json/2/'+model+'/search_read',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'bearer '+credential,'X-Odoo-Database':connection.database_name},
   body:JSON.stringify({domain:[],fields,limit:safeLimit,offset:safeOffset})
  });
  if(!Array.isArray(response))throw new Error('Unexpected Odoo records response');
  return response;
 }
 if(connection.api_version==='jsonrpc'){
  if(!connection.login)throw new Error('Login is required for Odoo legacy JSON-RPC');
  const req=async(service,method,args)=>{
   const data=await safeFetch(host+'/jsonrpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'call',params:{service,method,args},id:1})});
   if(data?.error)throw new Error('Odoo access or RPC method denied');
   return data?.result;
  };
  const uid=await req('common','authenticate',[connection.database_name,connection.login,credential,{}]);
  if(!Number.isInteger(uid)||uid<1)throw new Error('Odoo login failed');
  const rows=await req('object','execute_kw',[connection.database_name,uid,credential,model,'search_read',[[]],{fields,limit:safeLimit,offset:safeOffset}]);
  if(!Array.isArray(rows))throw new Error('Unexpected Odoo records response');
  return rows;
 }
 throw new Error('Unknown Odoo API protocol');
}
export async function checkOdoo(connection,credential){
 const host=validateRemote(connection.base_url,'odoo');
 const out={reachable:false,authenticated:false,version:'',api_mode:connection.api_version,checks:[]};
 try{
  const version=await safeFetch(host+'/web/version',{method:'GET',headers:{Accept:'application/json'}});
  out.version=String(version?.version||'').slice(0,45);
  out.reachable=true;out.checks.push({code:'reachable',status:'ok',detail:'Public Odoo HTTPS endpoint responded'});
 }catch(e){out.checks.push({code:'reachable',status:'warning',detail:'Odoo version endpoint not available'})}
 try{
  const records=await odooRead(connection,credential,'res.partner',['id','name'],1);
  out.authenticated=true;out.checks.push({code:'authentication',status:'ok',detail:'Read-only ORM authentication and database access verified'});
  out.sample_count=records.length;
 }catch(e){out.checks.push({code:'authentication',status:'error',detail:shortError(e)});return out}
 try{
  const installed=await odooRead(connection,credential,'ir.module.module',['name','shortdesc','state','installed_version','latest_version'],120);
  out.modules_checked=installed.length;
  out.installed_count=installed.filter(x=>x.state==='installed').length;
  out.problem_modules=installed.filter(x=>['to install','to upgrade','to remove'].includes(x.state)).map(x=>({name:x.name,state:x.state})).slice(0,30);
  out.checks.push({code:'modules',status:out.problem_modules.length?'warning':'ok',detail:out.problem_modules.length?out.problem_modules.length+' modules have pending actions':'Module registry accessible'});
 }catch(e){out.checks.push({code:'modules',status:'warning',detail:'Module registry access not granted for this API user'})}
 try{
  const crons=await odooRead(connection,credential,'ir.cron',['name','active','nextcall'],80);
  out.inactive_crons=crons.filter(x=>x.active===false).length;
  out.checks.push({code:'scheduled_actions',status:'ok',detail:'Scheduled actions accessible; inactive entries are not necessarily errors'});
 }catch{out.checks.push({code:'scheduled_actions',status:'warning',detail:'Scheduled actions require additional read privileges'})}
 return out;
}
export function installRawiDeveloper(app,{db,env,query,centralDb=db}){
 async function gate(c,write=false){
  const sql=db(c),workspace=c.req.param('workspace'),actor=c.get('adminId');
  if(!sql)return {error:fail(c,503,'Database not connected')};
  if(!uuid.safeParse(workspace).success)return {error:fail(c,400,'Invalid workspace')};
  const member=await query(sql,`SELECT m.role FROM erp_memberships m
   JOIN rawi_account_profiles p ON p.admin_id=m.admin_id AND p.account_type='developer'
   WHERE m.admin_id=$1 AND m.workspace_id=$2`,[actor,workspace]);
  if(!member.length)return {error:fail(c,403,'Developer account and workspace membership required')};
  if(write&&member[0].role==='viewer')return {error:fail(c,403,'Write permission required')};
  return {sql,workspace};
 }
 app.get('/api/admin/developer/platforms',async c=>{
  const sql=db(c);if(!sql)return fail(c,503,'Database unavailable');
  const rows=await query(sql,"SELECT 1 FROM rawi_account_profiles WHERE admin_id=$1 AND account_type='developer'",[c.get('adminId')]);
  if(!rows.length)return fail(c,403,'Developer account required');
  return c.json({ok:true,data:listDeveloperPlatforms(),note:'Only Odoo is implemented and enabled'});
 });
 const view="id,label,base_url,database_name,api_version,login,(length(encrypted_credential)>0) has_credential,odoo_version,last_status,last_tested_at,last_summary,created_at";
 app.post('/api/admin/developer/w/:workspace/modules/plan',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const v=z.object({description:z.string().trim().min(12).max(1500),odoo_version:z.enum(['17','18','19','20'])}).safeParse(await parse(c));
  if(!v.success)return fail(c,400,'Describe the Odoo module and target version');
  const actor=c.get('adminId'),reservation=await query(g.sql,`UPDATE mif_tenant_subscriptions s
   SET messages_used=messages_used+1,updated_at=now()
   FROM mif_subscription_plans p WHERE s.workspace_id=$1 AND p.id=s.plan_id
   AND p.application='developer' AND p.active=true AND s.status IN ('trial','active')
   AND s.period_ends_at>now() AND s.messages_used<p.message_limit RETURNING s.workspace_id`,[g.workspace]);
  if(!reservation.length)return fail(c,402,'Activate a RAWI Developer plan with remaining AI usage');
  try{
   const prompt=`Design a BASIC INSTALLABLE Odoo addon specification for Odoo ${v.data.odoo_version}, based on this user request: ${v.data.description}. Return ONLY raw valid JSON, without markdown, in this exact schema:
    {"technical_name":"lowercase_underscored_id","display_name":"Human readable title","model_name":"short_lowercase_underscored_name","odoo_version":"${v.data.odoo_version}","fields":[{"name":"snake_case_field","label":"Field Label","type":"Char"}]}
    Allowed field types ONLY Char,Text,Integer,Float,Boolean,Date,Datetime. 1-12 safe nonreserved fields; do not include "name" because it is built in. Use only lowercase letters, numbers and underscores for technical identifiers. No Python/XML/code snippets or unrequested external API calls. The resulting ZIP is a scaffold for review, NOT deployed software.`;
   const response=await routeAI(prompt,await getAIProviders(centralDb(c),env(c),query),[],'','developer');
   const text=String(response.answer||'').trim().replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\s*\x60{3}$/,'').trim();
   const found=text.match(/\{[\s\S]*\}/);if(!found)throw new Error('AI did not produce a structured Odoo addon proposal');
   const parsed=moduleInput.safeParse(JSON.parse(found[0]));
   if(!parsed.success||parsed.data.odoo_version!==v.data.odoo_version)throw new Error('AI proposal failed module safety validation; please revise the request');
   await query(g.sql,'INSERT INTO mif_ai_usage(workspace_id,actor_id,provider,model,input_tokens,output_tokens) VALUES($1,$2,$3,$4,$5,$6)',[g.workspace,actor,response.provider,response.model,response.input_tokens,response.output_tokens]);
   return c.json({ok:true,proposal:parsed.data,provider:response.provider,model:response.model,requires_staging_review:true});
  }catch(e){
   await query(g.sql,'UPDATE mif_tenant_subscriptions SET messages_used=GREATEST(0,messages_used-1) WHERE workspace_id=$1',[g.workspace]).catch(()=>{});
   return fail(c,422,e.message||'AI module proposal could not be generated');
  }
 });
 app.post('/api/admin/developer/w/:workspace/modules/build',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  let bytes,technical;
  try{const params=await parse(c);bytes=buildOdooModule(params);technical=params.technical_name}
  catch{return fail(c,400,'Invalid module fields or names')}
  return new Response(bytes,{status:200,headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="'+technical+'.zip"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 });
 app.get('/api/admin/developer/w/:workspace/connections',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  return c.json({ok:true,data:await query(g.sql,'SELECT '+view+' FROM rawi_odoo_connections WHERE workspace_id=$1 ORDER BY updated_at DESC',[g.workspace])});
 });
 app.post('/api/admin/developer/w/:workspace/connections',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const v=connectionInput.safeParse(await parse(c));if(!v.success||!v.data.credential)return fail(c,400,'Valid URL, database and Odoo credential are required');
  const x=v.data;let host,encrypted;
  try{host=validateRemote(x.base_url,'odoo');encrypted=await seal(x.credential,env(c).CONNECTOR_ENCRYPTION_KEY)}
  catch{return fail(c,400,'Use a public HTTPS Odoo URL and configure server-side encryption')}
  if(x.api_version==='jsonrpc'&&!x.login)return fail(c,400,'Login required for Odoo legacy JSON-RPC');
  const rows=await query(g.sql,`INSERT INTO rawi_odoo_connections(workspace_id,label,base_url,database_name,api_version,login,encrypted_credential)
   VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[g.workspace,x.label,host,x.database_name,x.api_version,x.login,encrypted]);
  return c.json({ok:true,id:rows[0].id},201);
 });
 app.patch('/api/admin/developer/w/:workspace/connections/:id',async c=>{
   const g=await gate(c,true);if(g.error)return g.error;
   const id=c.req.param('id');if(!uuid.safeParse(id).success)return fail(c,400,'Invalid connection');
   const existing=await query(g.sql,'SELECT * FROM rawi_odoo_connections WHERE workspace_id=$1 AND id=$2',[g.workspace,id]);
   if(!existing.length)return fail(c,404,'Connection not found');
   const v=connectionInput.safeParse({...existing[0],...await parse(c)});
   if(!v.success)return fail(c,400,'Invalid Odoo connection configuration');
   const x=v.data;
   let host,encrypted='';
   try{host=validateRemote(x.base_url,'odoo');
     if(x.credential)encrypted=await seal(x.credential,env(c).CONNECTOR_ENCRYPTION_KEY)
   }catch{return fail(c,400,'Invalid HTTPS Odoo address or server encryption configuration')}
   if(x.api_version==='jsonrpc'&&!x.login)return fail(c,400,'Odoo legacy JSON-RPC requires a username');
   const data=await query(g.sql,`UPDATE rawi_odoo_connections SET label=$1,base_url=$2,database_name=$3,api_version=$4,login=$5,
    encrypted_credential=CASE WHEN $6<>'' THEN $6 ELSE encrypted_credential END,
    last_status='not_tested',last_tested_at=NULL,last_summary='{}'::jsonb,updated_at=now()
    WHERE workspace_id=$7 AND id=$8 RETURNING id`,[x.label,host,x.database_name,x.api_version,x.login,encrypted,g.workspace,id]);
   return data.length?c.json({ok:true,id:data[0].id}):fail(c,404,'Connection not found');
 });
 app.delete('/api/admin/developer/w/:workspace/connections/:id',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  if(!uuid.safeParse(c.req.param('id')).success)return fail(c,400,'Invalid connection');
  const id=c.req.param('id');
  const linked=await query(g.sql,'SELECT 1 FROM rawi_implementation_projects WHERE workspace_id=$1 AND connection_id=$2 LIMIT 1',[g.workspace,id]);
  if(linked.length)return fail(c,409,'This Odoo database is linked to implementation projects. Reassign their connection before deleting it.');
  await query(g.sql,'DELETE FROM rawi_odoo_diagnostics WHERE workspace_id=$1 AND connection_id=$2',[g.workspace,id]);
  const rows=await query(g.sql,'DELETE FROM rawi_odoo_connections WHERE id=$1 AND workspace_id=$2 RETURNING id',[id,g.workspace]);
  return rows.length?c.json({ok:true}):fail(c,404,'Connection not found');
 });
 async function getConnection(c,g){
  if(!uuid.safeParse(c.req.param('id')).success)return null;
  const rows=await query(g.sql,'SELECT * FROM rawi_odoo_connections WHERE workspace_id=$1 AND id=$2',[g.workspace,c.req.param('id')]);
  return rows[0]||null;
 }
 async function credential(c,connection){return unseal(connection.encrypted_credential,env(c).CONNECTOR_ENCRYPTION_KEY)}
 app.post('/api/admin/developer/w/:workspace/connections/:id/test',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const connection=await getConnection(c,g);if(!connection)return fail(c,404,'Connection not found');
  let result;
  try{result=await checkOdoo(connection,await credential(c,connection))}
  catch{return fail(c,503,'Unable to test Odoo connection')}
  const status=result.authenticated?'ok':'failed';
  await query(g.sql,`UPDATE rawi_odoo_connections SET last_tested_at=now(),last_status=$1,
    odoo_version=$2,last_summary=$3::jsonb,updated_at=now() WHERE id=$4 AND workspace_id=$5`,
    [status,result.version,JSON.stringify(result),connection.id,g.workspace]);
  await query(g.sql,'INSERT INTO rawi_odoo_diagnostics(workspace_id,connection_id,status,checks) VALUES($1,$2,$3,$4::jsonb)',[g.workspace,connection.id,status==='ok'?(result.checks.some(x=>x.status==='warning')?'warning':'ok'):'error',JSON.stringify(result.checks)]);
  return c.json({ok:true,result});
 });
 app.get('/api/admin/developer/w/:workspace/connections/:id/modules',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  const connection=await getConnection(c,g);if(!connection)return fail(c,404,'Connection not found');
  try{
    const requested=Number(c.req.query('offset')||0);
    if(!Number.isInteger(requested)||requested<0||requested>100000)return fail(c,400,'Invalid page offset');
    const limit=100,data=await odooRead(connection,await credential(c,connection),'ir.module.module',['name','shortdesc','state','installed_version','latest_version'],limit,requested);
    return c.json({ok:true,data,limit,offset:requested,has_more:data.length===limit,next_offset:requested+data.length})
   }
  catch(e){return fail(c,502,shortError(e))}
 });
 app.get('/api/admin/developer/w/:workspace/connections/:id/diagnostics',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  const connection=await getConnection(c,g);if(!connection)return fail(c,404,'Connection not found');
  return c.json({ok:true,data:await query(g.sql,'SELECT id,status,checks,checked_at FROM rawi_odoo_diagnostics WHERE workspace_id=$1 AND connection_id=$2 ORDER BY checked_at DESC LIMIT 20',[g.workspace,connection.id])});
 });
 app.get('/api/admin/developer/w/:workspace/implementations',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  return c.json({ok:true,data:await query(g.sql,`SELECT p.*,o.label odoo_connection FROM rawi_implementation_projects p
   LEFT JOIN rawi_odoo_connections o ON o.id=p.connection_id AND o.workspace_id=p.workspace_id
   WHERE p.workspace_id=$1 ORDER BY p.updated_at DESC LIMIT 200`,[g.workspace])});
 });
 app.post('/api/admin/developer/w/:workspace/implementations',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const v=implementationInput.safeParse(await parse(c));if(!v.success)return fail(c,400,'Invalid implementation');
  const x=v.data;
  const rows=await query(g.sql,`INSERT INTO rawi_implementation_projects(workspace_id,connection_id,title,client_name,phase,status,details,due_on)
   SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE $2::uuid IS NULL OR EXISTS(SELECT 1 FROM rawi_odoo_connections WHERE id=$2 AND workspace_id=$1)
   RETURNING id`,[g.workspace,x.connection_id||null,x.title,x.client_name,x.phase,x.status,x.details,x.due_on||null]);
  return rows.length?c.json({ok:true,id:rows[0].id},201):fail(c,400,'Connection belongs to another workspace');
 });
 app.patch('/api/admin/developer/w/:workspace/implementations/:id',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  if(!uuid.safeParse(c.req.param('id')).success)return fail(c,400,'Invalid implementation');
  const raw=await parse(c),v=z.object({phase:implementationInput.shape.phase.optional(),status:implementationInput.shape.status.optional(),connection_id:uuid.nullable().optional()}).safeParse(raw);
  if(!v.success||!Object.keys(v.data).length)return fail(c,400,'Invalid implementation update');
  const x=v.data,hasConnection=Object.prototype.hasOwnProperty.call(x,'connection_id');
  const rows=await query(g.sql,`UPDATE rawi_implementation_projects SET
    phase=COALESCE($1::text,phase),status=COALESCE($2::text,status),
    connection_id=CASE WHEN $3::boolean THEN $4::uuid ELSE connection_id END,updated_at=now()
    WHERE workspace_id=$5 AND id=$6
    AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM rawi_odoo_connections WHERE workspace_id=$5 AND id=$4))
    RETURNING id`,
    [x.phase||null,x.status||null,hasConnection,x.connection_id||null,g.workspace,c.req.param('id')]);
  return rows.length?c.json({ok:true}):fail(c,404,'Project not found or Odoo connection belongs to another organization');
 });
}
