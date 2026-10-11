import test from 'node:test';
import assert from 'node:assert/strict';
import {tenantDatabaseName,neonTenantConfig,createNeonTenantDatabase} from './neon-tenant-databases.js';
import app,{sessionCookieFor,sessionAudienceFor} from './app.js';
const id='11111111-2222-4333-8444-555555555555';
const env={NEON_PROJECT_ID:'blue-wave-63999494',NEON_BRANCH_ID:'br-still-recipe-b9xl70wg',NEON_DB_ROLE_NAME:'mif_smart_owner',NEON_API_KEY:'test-only-credential-never-used-live'};
test('only RAWI ERP can allocate a physical tenant database',()=>{
 assert.equal(tenantDatabaseName(id,'enterprise'),'rawi_e_11111111222243338444555555555555');
 assert.throws(()=>tenantDatabaseName(id,'developer'));
 assert.throws(()=>tenantDatabaseName('bad-id','enterprise'));
});
test('Neon provisioning requires safe owner credentials',()=>{
 for(const name of Object.keys(env))assert.throws(()=>neonTenantConfig({...env,[name]:''}));
 assert.equal(neonTenantConfig(env).project,'blue-wave-63999494');
});
test('Neon database creation verifies database name and role',async()=>{
 const name=tenantDatabaseName(id,'enterprise'),calls=[];
 const requester=async(url,opt)=>{
  calls.push({url,method:opt.method,body:opt.body?JSON.parse(opt.body):null});
  if(opt.method==='GET'&&calls.length===1)return {status:404,ok:false};
  if(opt.method==='POST')return {status:201,ok:true};
  return {status:200,ok:true,json:async()=>({database:{name,owner_name:env.NEON_DB_ROLE_NAME}})};
 };
 const result=await createNeonTenantDatabase(env,id,'enterprise',requester);
 assert.equal(result.status,'created');assert.equal(result.database_name,name);
 assert.equal(calls.length,3);assert.deepEqual(calls[1].body,{database:{name,owner_name:env.NEON_DB_ROLE_NAME}});
});
test('Neon verification does not accept incorrect ownership',async()=>{
 const name=tenantDatabaseName(id,'enterprise');
 await assert.rejects(()=>createNeonTenantDatabase(env,id,'enterprise',async()=>({status:200,ok:true,json:async()=>({database:{name,owner_name:'other'}})})),/mismatch/);
});
test('registration stays gated until real production credentials are configured',async()=>{
 const res=await app.request('https://app.example/api/admin/register',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.88'},body:JSON.stringify({email:'test@example.com',password:'very-long-password-abc',name:'Tester',organization:'Company',account_type:'enterprise'})},{DATABASE_URL:'postgresql://user:password@neon.example/central',SESSION_SECRET:'s'.repeat(48),REGISTRATION_ENABLED:'true',MIF_APP_SURFACE:'enterprise'});
 assert.equal(res.status,503);assert.match((await res.json()).error,/Email verification is not configured/);
});
test('ERP and MIF have separate signed session audiences',()=>{
 assert.notEqual(sessionCookieFor('enterprise'),sessionCookieFor('mif'));
 assert.notEqual(sessionAudienceFor('enterprise'),sessionAudienceFor('mif'));
});
