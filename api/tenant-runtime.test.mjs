import test from 'node:test';
import assert from 'node:assert/strict';
import {tenantDbUrl,tenantWorkspaceFromRequest,attachTenantDb} from './tenant-runtime.js';
import {tenantMigrationCount,tenantMigrationSteps} from './tenant-schema.generated.js';
const workspace='11111111-2222-4333-8444-555555555555',actor='99999999-8888-4777-8666-555555555555';
const cfg={MIF_APP_SURFACE:'enterprise',DATABASE_URL:'postgresql://owner:fake@ep-test-pooler.us-east-2.aws.neon.tech/mif_smart?sslmode=require'};
const name='rawi_e_11111111222243338444555555555555';
const context=(path,body={},qs={})=>{const state=new Map();return {req:{path,query:k=>qs[k],json:async()=>body},get:key=>key==='adminId'?actor:state.get(key),set:(key,v)=>state.set(key,v)}};
test('tenant database URL cannot escape trusted Neon host or RAWI ERP database names',()=>{
 const result=new URL(tenantDbUrl(cfg.DATABASE_URL,name));
 assert.equal(result.pathname,'/'+name);
 assert.throws(()=>tenantDbUrl(cfg.DATABASE_URL,'rawi_d_11111111222243338444555555555555'));
 assert.throws(()=>tenantDbUrl('postgres://user:password@evil.test/mif_smart',name));
});
test('only ERP and chat endpoints are routed into company databases',()=>{
 assert.equal(tenantWorkspaceFromRequest(context('/api/admin/erp/w/'+workspace+'/core/items')),workspace);
 assert.equal(tenantWorkspaceFromRequest(context('/api/admin/chat/send',{workspace_id:workspace})),'body');
 assert.equal(tenantWorkspaceFromRequest(context('/api/admin/chat/threads/123',{}, {workspace_id:workspace})),workspace);
 assert.equal(tenantWorkspaceFromRequest(context('/api/admin/developer/w/'+workspace+'/connections')),null);
 assert.equal(tenantWorkspaceFromRequest(context('/api/admin/platform/tenants')),null);
});
test('authenticated ERP tenant routes to a verified independent connection',async()=>{
 const c=context('/api/admin/erp/w/'+workspace+'/core/items');const queries=[];
 const query=async(_db,sql,args)=>{queries.push({sql,args});return [{database_name:name,status:'ready',application:'enterprise'}]};
 const result=await attachTenantDb(c,{central:{},query,settings:cfg,onReady:url=>({url})});
 assert.equal(result,null);
 assert.equal(new URL(c.get('tenantSQL').url).pathname,'/'+name);
 assert.deepEqual(queries[0].args,[workspace,actor,'enterprise']);
});
test('uninitialized, mismatched or unallocated tenants cannot access business data',async()=>{
 for(const record of [null,{status:'created',database_name:name,application:'enterprise'},{status:'ready',database_name:'rawi_d_11111111222243338444555555555555',application:'developer'}]){
  const c=context('/api/admin/erp/w/'+workspace+'/core/items');
  const result=await attachTenantDb(c,{central:{},query:async()=>record?[record]:[],settings:cfg,onReady:()=>{throw Error('unexpected connection')}});
  assert.ok([404,503].includes(result.status));assert.equal(c.get('tenantSQL'),undefined);
 }
});
test('tenant migration includes actual ERP schema without future-product Odoo developer tables',()=>{
 assert.ok(tenantMigrationCount>20);
 assert.ok(tenantMigrationSteps.some(x=>x.includes('CREATE TABLE IF NOT EXISTS erp_workspaces')));
 assert.ok(!tenantMigrationSteps.some(x=>x.includes('CREATE TABLE IF NOT EXISTS rawi_odoo_connections')));
 assert.ok(!tenantMigrationSteps.some(x=>x.includes('CREATE TABLE IF NOT EXISTS mif_tenant_databases')));
});
