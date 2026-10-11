import {readFileSync} from 'node:fs';
import {neon} from '@neondatabase/serverless';
import {migrateTenantBatch,tenantMigrationCount} from '../api/tenant-migrations.js';

const url=process.env.MIF_DATABASE_URL;
if(!url)throw Error('MIF_DATABASE_URL is required to reconcile customer databases');
const {vars}=JSON.parse(readFileSync(new URL('../wrangler.enterprise.jsonc',import.meta.url),'utf8'));
const sql=neon(url),query=(database,text,params=[])=>database.query(text,params);
const records=await query(sql,`SELECT d.workspace_id,d.status,d.migration_version
 FROM mif_tenant_databases d
 JOIN rawi_company_profiles p ON p.workspace_id=d.workspace_id AND p.completed_at IS NOT NULL
 WHERE d.application='enterprise' AND (d.status<>'ready' OR d.migration_version<$1) ORDER BY d.created_at LIMIT 30`,[tenantMigrationCount]);
console.log('RAWI workspace reconciliation: '+records.length+' completed company profiles require initialization');
for(const record of records){
 const options={central:sql,query,settings:{DATABASE_URL:url,NEON_PROJECT_ID:vars.NEON_PROJECT_ID,NEON_BRANCH_ID:vars.NEON_BRANCH_ID},workspaceId:record.workspace_id};
 let status=record.status,last;
 for(let attempt=0;attempt<Math.ceil(tenantMigrationCount/20)+3&&status!=='ready';attempt++){
  last=await migrateTenantBatch(options);status=last.status;
  if(status==='busy')throw Error('Workspace is being initialized elsewhere; retry deployment');
 }
 if(status!=='ready')throw Error('Workspace schema is not ready after the required migration batches');
 console.log('Initialized customer database: '+String(record.workspace_id).slice(0,8)+'… at version '+tenantMigrationCount);
}
const remains=await query(sql,`SELECT count(*)::int n FROM mif_tenant_databases d
 JOIN rawi_company_profiles p ON p.workspace_id=d.workspace_id AND p.completed_at IS NOT NULL
 WHERE d.application='enterprise' AND (d.status<>'ready' OR d.migration_version<$1)`,[tenantMigrationCount]);
if(Number(remains[0]?.n)>0)throw Error('Some completed enterprise workspaces are not ready');
console.log('All completed RAWI ERP company databases are ready');
