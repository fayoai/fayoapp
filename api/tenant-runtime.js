import {neon} from '@neondatabase/serverless';
import {tenantDatabaseName} from './neon-tenant-databases.js';
const workspaceRegex=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function tenantDbUrl(baseUrl,name){
 if(typeof baseUrl!=='string'||!baseUrl)throw Error('Central Neon connection string is not configured');
 if(!/^rawi_e_[0-9a-f]{32}$/.test(name))throw Error('Invalid isolated tenant database name');
 const url=new URL(baseUrl);
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname.endsWith('.neon.tech'))throw Error('Invalid trusted Neon connection');
 url.pathname='/'+name;
 return url.toString();
}
// The control-plane database and RAWI's operational project are different trust boundaries.
// Never derive a RAWI tenant connection from MIF's credentials after cutover.
export function tenantConnectionUrl(settings,tenant){
 const is=(project,branch)=>!!project&&!!branch&&tenant.neon_project_id===project&&tenant.neon_branch_id===branch;
 if(is(settings.NEON_PROJECT_ID,settings.NEON_BRANCH_ID)){
  if(!settings.RAWI_DATABASE_URL)throw Error('RAWI_DATABASE_URL is not configured for the independent RAWI project');
  const control=new URL(settings.RAWI_DATABASE_URL);
  if(control.pathname!=='/rawi_control')throw Error('RAWI_DATABASE_URL must point to rawi_control');
  return tenantDbUrl(settings.RAWI_DATABASE_URL,tenant.database_name);
 }
 if(is(settings.LEGACY_NEON_PROJECT_ID,settings.LEGACY_NEON_BRANCH_ID)){
  if(!settings.DATABASE_URL)throw Error('Legacy MIF database credentials unavailable');
  const control=new URL(settings.DATABASE_URL);
  if(control.pathname!=='/mif_smart')throw Error('Legacy database must point to mif_smart');
  return tenantDbUrl(settings.DATABASE_URL,tenant.database_name);
 }
 throw Error('Tenant project or branch is not approved for this Worker');
}
export function tenantWorkspaceFromRequest(c){
 const path=c.req.path;
 let x=path.match(/^\/api\/admin\/erp\/w\/([^/]+)(?:\/|$)/);
 if(x)return x[1];
 x=path.match(/^\/api\/admin\/erp\/workspaces\/([^/]+)\/profile$/);
 if(x)return x[1];
 if(path==='/api/admin/chat/send')return 'body';
 if(path.startsWith('/api/admin/chat/threads'))return c.req.query('workspace_id')||'missing';
 return null;
}
export async function attachTenantDb(c,{central,query,settings,onReady=neon}){
 const surface=settings.MIF_APP_SURFACE;
 if(surface!=='enterprise')return null;
 const requested=tenantWorkspaceFromRequest(c);
 if(!requested)return null;
 let id=requested;
 if(requested==='body'){
  let body;try{body=await c.req.json()}catch{return {status:400,error:'Invalid conversation payload'}}
  id=body?.workspace_id;
 }
 if(!id||!workspaceRegex.test(id))return {status:400,error:'A valid workspace is required'};
 if(!central)return {status:503,error:'MIF central database is unavailable'};
 const rows=await query(central,`SELECT w.id,d.database_name,d.status,d.application,d.neon_project_id,d.neon_branch_id
  FROM erp_workspaces w
  JOIN erp_memberships m ON m.workspace_id=w.id
  JOIN mif_tenant_databases d ON d.workspace_id=w.id
  WHERE w.id=$1 AND m.admin_id=$2 AND d.application=$3`,[id,c.get('adminId'),surface]);
 const selected=rows[0];
 if(!selected)return {status:404,error:'Workspace not found'};
 if(selected.status!=='ready')return {status:503,error:'Customer database is not ready'};
 if(selected.database_name!==tenantDatabaseName(id,surface))return {status:503,error:'Customer database registry mismatch'};
 c.set('tenantSQL',onReady(tenantConnectionUrl(settings,selected)));
 c.set('tenantWorkspace',id);
 return null;
}
