import {tenantDbUrl} from './tenant-runtime.js';
import {tenantMigrationSteps,tenantMigrationCount} from './tenant-schema.generated.js';
import {neon} from '@neondatabase/serverless';
const maxBatch=20;
export {tenantMigrationCount};
export async function seedTenantIdentity({central,tenant,query,workspaceId,application}){
 // Central control-plane is the only authority for identities, plans and entitlements.
 const rows=await query(central,`SELECT w.id workspace_id,w.name,w.currency,w.owner_id,a.email,
 p.account_type,s.plan_id,s.status subscription_status,s.messages_used,s.period_starts_at,s.period_ends_at,
 pl.code,pl.title,pl.cycle,pl.price_halalas,pl.message_limit,pl.active
 FROM erp_workspaces w JOIN admins a ON a.id=w.owner_id
 JOIN rawi_account_profiles p ON p.admin_id=a.id
 JOIN mif_tenant_subscriptions s ON s.workspace_id=w.id
 JOIN mif_subscription_plans pl ON pl.id=s.plan_id
 WHERE w.id=$1 AND p.account_type=$2 AND pl.application=$2`,[workspaceId,application]);
 const row=rows[0];
 if(!row)throw Error('Central tenant identity and matching subscription must exist before initialization');
 await query(tenant,`INSERT INTO admins(id,email,password_hash,salt) VALUES($1,$2,'local-password-disabled','local-auth-disabled')
  ON CONFLICT(id) DO NOTHING`,[row.owner_id,row.email]);
 await query(tenant,`INSERT INTO erp_workspaces(id,name,currency,owner_id) VALUES($1,$2,$3,$4)
  ON CONFLICT(id) DO NOTHING`,[row.workspace_id,row.name,row.currency,row.owner_id]);
 await query(tenant,`INSERT INTO erp_memberships(workspace_id,admin_id,role) VALUES($1,$2,'owner')
  ON CONFLICT(workspace_id,admin_id) DO NOTHING`,[row.workspace_id,row.owner_id]);
 await query(tenant,`INSERT INTO rawi_account_profiles(admin_id,account_type) VALUES($1,$2)
  ON CONFLICT(admin_id) DO NOTHING`,[row.owner_id,application]);
 await query(tenant,`INSERT INTO mif_subscription_plans(id,code,title,cycle,price_halalas,message_limit,active,application)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8)
  ON CONFLICT(id) DO NOTHING`,[row.plan_id,row.code,row.title,row.cycle,row.price_halalas,row.message_limit,row.active,application]);
 await query(tenant,`INSERT INTO mif_tenant_subscriptions(workspace_id,plan_id,status,messages_used,period_starts_at,period_ends_at)
  VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id) DO NOTHING`,
  [row.workspace_id,row.plan_id,row.subscription_status,row.messages_used,row.period_starts_at,row.period_ends_at]);
 await query(tenant,`INSERT INTO erp_invoice_templates(workspace_id,name)
 SELECT $1,'RAWI' WHERE NOT EXISTS(SELECT 1 FROM erp_invoice_templates WHERE workspace_id=$1)`,[row.workspace_id]);
 const check=await query(tenant,`SELECT w.id FROM erp_workspaces w
 JOIN erp_memberships m ON m.workspace_id=w.id AND m.admin_id=w.owner_id
 JOIN rawi_account_profiles a ON a.admin_id=m.admin_id AND a.account_type=$2
 JOIN mif_tenant_subscriptions s ON s.workspace_id=w.id
 JOIN mif_subscription_plans p ON p.id=s.plan_id AND p.application=$2
 WHERE w.id=$1`,[workspaceId,application]);
 if(check.length!==1)throw Error('Isolated database identity verification failed');
 return {workspace_id:workspaceId,application};
}
export async function migrateTenantBatch({central,query,settings,workspaceId,limit=maxBatch,connector=neon}){
 if(!Number.isInteger(limit)||limit<1||limit>maxBatch)throw Error('Invalid migration batch size');
 if(!settings.DATABASE_URL)throw Error('Central Neon database URL is required');
 // Lease prevents simultaneous setup requests from racing migrations.
 const reserved=await query(central,`UPDATE mif_tenant_databases
 SET status='migrating',updated_at=now(),last_error=''
 WHERE workspace_id=$1 AND
 (status IN ('created','failed') OR (status='ready' AND migration_version<$2)
  OR (status='migrating' AND updated_at<now()-interval '2 minutes'))
 RETURNING workspace_id,application,database_name,migration_version,neon_project_id,neon_branch_id`,[workspaceId,tenantMigrationCount]);
 if(!reserved.length)return {status:'busy'};
 const row=reserved[0];
 if(row.neon_project_id!==settings.NEON_PROJECT_ID||row.neon_branch_id!==settings.NEON_BRANCH_ID)throw Error('Neon project or branch changed; refusing cross-project migration');
 if(row.application!=='enterprise')throw Error('This product is not active');
 const expected='rawi_e_'+workspaceId.replaceAll('-','');
 if(row.database_name!==expected)throw Error('Tenant database registry mismatch');
 const tenant=connector(tenantDbUrl(settings.DATABASE_URL,row.database_name));
 let pos=Number(row.migration_version||0);
 try{
  const end=Math.min(pos+limit,tenantMigrationCount);
  while(pos<end){
   await query(tenant,tenantMigrationSteps[pos]);
   // Checkpoint after every completed DDL statement. A partial migration never counts as ready.
   await query(central,`UPDATE mif_tenant_databases SET migration_version=$2,updated_at=now()
     WHERE workspace_id=$1 AND status='migrating'`,[workspaceId,pos+1]);
   pos++;
  }
  if(pos===tenantMigrationCount){
   await seedTenantIdentity({central,tenant,query,workspaceId,application:row.application});
   await query(central,`UPDATE mif_tenant_databases SET status='ready',migration_version=$2,
     last_error='',updated_at=now() WHERE workspace_id=$1`,[workspaceId,tenantMigrationCount]);
   return {status:'ready',applied:pos,total:tenantMigrationCount,database_name:row.database_name};
  }
  await query(central,`UPDATE mif_tenant_databases SET status='created',updated_at=now()
    WHERE workspace_id=$1 AND status='migrating'`,[workspaceId]);
  return {status:'created',applied:pos,total:tenantMigrationCount,database_name:row.database_name};
 }catch(e){
  await query(central,`UPDATE mif_tenant_databases SET status='failed',last_error=$2,updated_at=now()
    WHERE workspace_id=$1 AND status='migrating'`,[workspaceId,String(e?.message||'Schema initialization failed').slice(0,220)]).catch(()=>{});
  throw e;
 }
}
