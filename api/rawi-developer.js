import {z} from 'zod';
import {validateRemote,seal,unseal} from './ai-erp.js';
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
export async function odooRead(connection,credential,model,fields=['name'],limit=50){
 if(!['ir.module.module','res.partner','ir.cron'].includes(model))throw new Error('Unsupported read-only model');
 const safeLimit=Math.min(Math.max(Number(limit)||1,1),150);
 const host=validateRemote(connection.base_url,'odoo');
 if(connection.api_version==='json2'){
  const response=await safeFetch(host+'/json/2/'+model+'/search_read',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'bearer '+credential,'X-Odoo-Database':connection.database_name},
   body:JSON.stringify({domain:[],fields,limit:safeLimit})
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
  const rows=await req('object','execute_kw',[connection.database_name,uid,credential,model,'search_read',[[]],{fields,limit:safeLimit}]);
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
export function installRawiDeveloper(app,{db,env,query}){
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
 const view="id,label,base_url,database_name,api_version,login,(length(encrypted_credential)>0) has_credential,odoo_version,last_status,last_tested_at,last_summary,created_at";
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
 app.delete('/api/admin/developer/w/:workspace/connections/:id',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  if(!uuid.safeParse(c.req.param('id')).success)return fail(c,400,'Invalid connection');
  const rows=await query(g.sql,'DELETE FROM rawi_odoo_connections WHERE id=$1 AND workspace_id=$2 RETURNING id',[c.req.param('id'),g.workspace]);
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
  try{const data=await odooRead(connection,await credential(c,connection),'ir.module.module',['name','shortdesc','state','installed_version','latest_version'],150);return c.json({ok:true,data,partial:true,limit:150})}
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
  const v=z.object({phase:implementationInput.shape.phase,status:implementationInput.shape.status}).safeParse(await parse(c));
  if(!v.success)return fail(c,400,'Invalid implementation status');
  const x=v.data,rows=await query(g.sql,`UPDATE rawi_implementation_projects SET phase=$1,status=$2,updated_at=now()
   WHERE workspace_id=$3 AND id=$4 RETURNING id`,[x.phase,x.status,g.workspace,c.req.param('id')]);
  return rows.length?c.json({ok:true}):fail(c,404,'Implementation not found');
 });
}
