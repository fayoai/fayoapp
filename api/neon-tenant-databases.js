// MIF SaaS control-plane provisioning of a physically distinct Neon PostgreSQL database.
// Creating a database does not make a tenant operational: schema migration, auth and all routes must be tested.
const safeId=/^[a-z0-9-]{1,60}$/,safeRole=/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
export function tenantDatabaseName(workspaceId,application){
 if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(workspaceId))throw Error('Invalid workspace ID');
 if(application!=='enterprise')throw Error('Only RAWI ERP databases are currently enabled');
 return 'rawi_e_'+workspaceId.replaceAll('-','').toLowerCase();
}
export function neonTenantConfig(env){
 const project=String(env.NEON_PROJECT_ID||'');
 const branch=String(env.NEON_BRANCH_ID||'');
 const role=String(env.NEON_DB_ROLE_NAME||'');
 const token=String(env.NEON_API_KEY||'');
 if(!safeId.test(project)||!safeId.test(branch)||!safeRole.test(role)||token.length<20)throw Error('Neon tenant provisioning credentials not configured');
 return {project,branch,role,token};
}
export async function createNeonTenantDatabase(env,workspaceId,application,request=fetch){
 const {project,branch,role,token}=neonTenantConfig(env);
 const name=tenantDatabaseName(workspaceId,application);
 const uri='https://console.neon.tech/api/v2/projects/'+project+'/branches/'+branch+'/databases';
 const auth={Authorization:'Bearer '+token,Accept:'application/json'};
 const details=async()=>{
  const r=await request(uri+'/'+name,{method:'GET',headers:auth,signal:AbortSignal.timeout(12000)});
  if(r.status===404)return false;
  if(!r.ok)throw Error('Neon database verification failed (HTTP '+r.status+')');
  const result=await r.json();
  if(result.database?.name!==name||result.database?.owner_name!==role)throw Error('Neon database owner/name mismatch');
  return true;
 };
 if(!await details()){
  const r=await request(uri,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({database:{name,owner_name:role}}),signal:AbortSignal.timeout(15000)});
  if(r.status!==201&&r.status!==409)throw Error('Neon database allocation failed (HTTP '+r.status+')');
  if(!await details())throw Error('Neon database allocation has not been verified');
 }
 return {database_name:name,neon_project_id:project,neon_branch_id:branch,status:'created'};
}
