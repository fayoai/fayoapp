import test from 'node:test';
import assert from 'node:assert/strict';
import {tenantDbUrl,tenantWorkspaceFromRequest,attachTenantDb} from './tenant-runtime.js';
import {tenantMigrationCount,tenantMigrationSteps} from './tenant-schema.generated.js';
const workspace='11111111-2222-4333-8444-555555555555',actor='99999999-8888-4777-8666-555555555555';
const cfg={MIF_APP_SURFACE:'enterprise',DATABASE_URL:'postgresql://owner:PRIVATE_PASSWORD@ep-test-pooler.us-east-2.aws.neon.tech/mif_smart?sslmode=require'};
const name='rawi_e_11111111222243338444555555555555';
const context=(path,body={},qs={})=>{const state=new Map();return {req:{path,query:k=>qs[k],json:async()=>body},get:key=>key==='adminId'?actor:state.get(key),set:(k,v)=>state.set(k,v),state}};
test('independent Neon URL cannot select unregistered names or external host',()=>{
 const url=tenantDbUrl(cfg.DATABASE_URL,name);
 assert.equal(new URL(url).pathname,'/'+name);
 assert.equal(new URL(url).hostname,'ep-test-pooler.us-east-2.aws.neon.tech');
 assert.throws(()=>tenantDbUrl(cfg.DATABASE_URL,'mif_smart'));
 assert.throws(()=>tenantDbUrl('postgres://a:b@evil.com/mif_smart',name));
});
test('tenant routing looks up a workspace only for authorized application-specific endpoints',()=>{
 const a=context('/api/admin/erp/w/'+workspace+'/core/items');
 const d=context('/api/admin/developer/w/'+workspace+'/connections');
 const m=context('/api/admin/chat/send',{workspace_id:workspace});
 const ch=context('/api/admin/chat/threads/'+workspace,{}, {workspace_id:workspace});
 assert.equal(tenantWorkspaceFromRequest(a),workspace);
 assert.equal(tenantWorkspaceFromRequest(d),workspace);
 assert.equal(tenantWorkspaceFromRequest(m),'body');
 assert.equal(tenantWorkspaceFromRequest(ch),workspace);
 assert.equal(tenantWorkspaceFromRequest(context('/api/admin/platform/tenants')),null);
});
test('ready tenant routes to its physically distinct database and never executes query on an unauthorized connection',async()=>{
 const c=context('/api/admin/erp/w/'+workspace+'/core/items');const queries=[];
 const query=async(_sql,sql,args)=>{queries.push({sql,args});return [{database_name:name,status:'ready',application:'enterprise'}]};
 const response=await attachTenantDb(c,{central:{},query,settings:cfg,onReady:url=>({url})});
 assert.equal(response,null);assert.equal(new URL(c.get('tenantSQL').url).pathname,'/'+name);
 assert.deepEqual(queries[0].args,[workspace,actor,'enterprise']);
 assert.equal(c.get('tenantWorkspace'),workspace);
});
test('unallocated, failed and wrong application tenant access fails closed',async()=>{
 for(const row of [undefined,{database_name:name,status:'created',application:'enterprise'},{database_name:'rawi_d_11111111222243338444555555555555',status:'ready',application:'developer'}]){
  const c=context('/api/admin/erp/w/'+workspace+'/core/items');
  const outcome=await attachTenantDb(c,{central:{},query:async()=>row?[row]:[],settings:cfg,onReady:()=>{throw Error('must not connect')}});
  assert.ok(outcome.status===404||outcome.status===503);
  assert.equal(c.get('tenantSQL'),undefined);
 }
});
test('tenant schema has all operational modules and no registry of other customers',()=>{
 assert.ok(tenantMigrationCount>45);
 assert.ok(tenantMigrationSteps.some(x=>x.includes('CREATE TABLE IF NOT EXISTS erp_workspaces')));
 assert.ok(tenantMigrationSteps.some(x=>x.includes('CREATE TABLE IF NOT EXISTS rawi_odoo_connections')));
 assert.ok(!tenantMigrationSteps.some(x=>x.includes('CREATE TABLE IF NOT EXISTS mif_tenant_databases')));
});
