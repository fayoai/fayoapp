import test from 'node:test';
import assert from 'node:assert/strict';
import {tenantDatabaseName,neonTenantConfig,createNeonTenantDatabase} from './neon-tenant-databases.js';
import app,{sessionCookieFor,sessionAudienceFor} from './app.js';
const ws='11111111-2222-4333-8444-555555555555';
const env={NEON_PROJECT_ID:'blue-wave-63999494',NEON_BRANCH_ID:'br-still-recipe-b9xl70wg',NEON_DB_ROLE_NAME:'mif_smart_owner',NEON_API_KEY:'test-only-credential-never-used-live'};
test('Neon database IDs and application types must match their workspace',()=>{
 assert.equal(tenantDatabaseName(ws,'enterprise'),'rawi_e_11111111222243338444555555555555');
 assert.equal(tenantDatabaseName(ws,'developer'),'rawi_d_11111111222243338444555555555555');
 assert.notEqual(tenantDatabaseName(ws,'developer'),tenantDatabaseName(ws,'enterprise'));
 for(const invalid of ['','abc','11111111-2222-3333-4444-55555555555!'])assert.throws(()=>tenantDatabaseName(invalid,'developer'));
 assert.throws(()=>tenantDatabaseName(ws,'mif'));
});
test('Missing or unsafe management API settings fail closed',()=>{
 for(const key of ['NEON_PROJECT_ID','NEON_BRANCH_ID','NEON_DB_ROLE_NAME','NEON_API_KEY']){
  const broken={...env,[key]:''};
  assert.throws(()=>neonTenantConfig(broken));
 }
 assert.equal(neonTenantConfig(env).project,'blue-wave-63999494');
});
test('Database creation verifies Neon and never returns a fake ready state',async()=>{
 const actions=[];
 const name=tenantDatabaseName(ws,'developer');
 const fake=async(url,options)=>{
  actions.push({url,method:options.method,payload:options.body?JSON.parse(options.body):undefined});
  if(options.method==='GET'&&actions.filter(x=>x.method==='GET').length===1)return {status:404,ok:false};
  if(options.method==='POST')return {status:201,ok:true};
  return {status:200,ok:true,json:async()=>({database:{name,owner_name:env.NEON_DB_ROLE_NAME}})};
 };
 const response=await createNeonTenantDatabase(env,ws,'developer',fake);
 assert.equal(response.status,'created');
 assert.equal(response.database_name,name);
 assert.equal(actions.length,3);
 assert.deepEqual(actions[1].payload,{database:{name,owner_name:env.NEON_DB_ROLE_NAME}});
 assert.ok(actions.every(x=>!JSON.stringify(x).includes(env.NEON_API_KEY)));
});
test('Existing Neon database is recognized without duplicate POST',async()=>{
 const name=tenantDatabaseName(ws,'enterprise'),calls=[];
 const mock=async(url,opt)=>{calls.push(opt.method);return {status:200,ok:true,json:async()=>({database:{name,owner_name:env.NEON_DB_ROLE_NAME}})}};
 const result=await createNeonTenantDatabase(env,ws,'enterprise',mock);
 assert.equal(result.status,'created');assert.deepEqual(calls,['GET']);
});
test('Wrong Neon database owner fails verification',async()=>{
 await assert.rejects(()=>createNeonTenantDatabase(env,ws,'developer',async()=>({status:200,ok:true,json:async()=>({database:{name:tenantDatabaseName(ws,'developer'),owner_name:'attacker'}})})),/mismatch/);
});
test('Unprovisioned registration cannot create a shared central workspace',async()=>{
 const res=await app.request('https://enterprise.example/api/admin/register',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.88'},body:JSON.stringify({email:'test@example.com',password:'very-long-password-abc',name:'Tester',organization:'Demo',account_type:'enterprise'})},{DATABASE_URL:'postgresql://user:password@neon.example/central?sslmode=require',SESSION_SECRET:'s'.repeat(48),REGISTRATION_ENABLED:'true',MIF_APP_SURFACE:'enterprise'});
 assert.equal(res.status,503);
 assert.match((await res.json()).error,/Independent customer database provisioning/);
});
test('Registration sessions are scoped per application instead of MIF management',()=>{
 const source=String(requireSource);
 for(const surface of ['enterprise','developer'])assert.notEqual(sessionCookieFor(surface),sessionCookieFor('mif'));
 assert.equal(sessionAudienceFor('enterprise'),'rawi-enterprise');
 assert.equal(sessionAudienceFor('developer'),'rawi-developer');
 assert.match(source,/setCookie\(c,sessionCookieFor\(loginSurface\(c\)\),token/);
});
const requireSource=(await import('node:fs')).readFileSync(new URL('./app.js',import.meta.url),'utf8');
