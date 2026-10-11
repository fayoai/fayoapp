import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {invoiceTotals,validateRemote,seal,unseal,installAiErp,runErpSchedule} from './ai-erp.js';
const ws='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222';
test('Invoice totals calculate VAT server-side in integer halalas',()=>{
 const r=invoiceTotals([{description:'Consulting',quantity:2,unit_price:150},{description:'Software',quantity:1,unit_price:95.5}]);
 assert.equal(r.subtotal_halalas,39550);
 assert.equal(r.vat_halalas,5933);
 assert.equal(r.total_halalas,45483);
});
test('Integration URL guard rejects SSRF-like private hosts and HTTP',()=>{
 for(const u of ['http://public.example.com','https://127.0.0.1','https://localhost','https://internal.local','https://test.example.com:8080','https://user:pass@example.com'])assert.throws(()=>validateRemote(u,'odoo'));
 assert.equal(validateRemote('https://odoo.example.com/','odoo'),'https://odoo.example.com');
 assert.throws(()=>validateRemote('https://example.com','zoho'));
});
test('Credentials are encrypted at rest and recover with the server master key',async()=>{
 const master='long-private-test-master-key-is-at-least-thirty-two-characters';
 const secret='sk-actual-credential-not-for-repo';
 const encrypted=await seal(secret,master);
 assert.ok(!encrypted.includes(secret));
 assert.equal(await unseal(encrypted,master),secret);
 await assert.rejects(()=>unseal(encrypted,'wrong-key'));
});
function api(handler,settings={}){
 const app=new Hono(),calls=[];
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',admin);await next()});
 installAiErp(app,{db:()=>({}),env:()=>settings,query:async(_db,sql,args=[])=>{calls.push({sql,args});return handler(sql,args)}});
 return {app,calls};
}
const req=(app,url,data,method='POST')=>app.request('http://localhost'+url,{method,headers:{'content-type':'application/json'},body:JSON.stringify(data)},{});
test('Workspace access cannot cross tenants',async()=>{
 const {app}=api(()=>[]);
 const res=await app.request('http://localhost/api/admin/erp/w/'+ws+'/contacts');
 assert.equal(res.status,404);
});
test('Cannot create invoice for a customer outside the workspace',async()=>{
 const {app,calls}=api((sql)=>sql.includes('SELECT role FROM erp_memberships')?[{role:'owner'}]:[]);
 const response=await req(app,'/api/admin/erp/w/'+ws+'/invoices',{customer_id:'33333333-3333-4333-8333-333333333333',lines:[{description:'One unit',quantity:1,unit_price:200}]});
 assert.equal(response.status,400);
 assert.equal(calls.some(x=>x.sql.includes('INSERT INTO erp_invoices')),false);
});
test('AI replies require an enabled configured key',async()=>{
 const {app}=api((sql)=>sql.includes('SELECT role FROM erp_memberships')?[{role:'owner'}]:[]);
 const r=await req(app,'/api/admin/erp/w/'+ws+'/ask',{question:'Summarize all customers'});
 assert.equal(r.status,503);
 assert.match((await r.json()).error,/OpenAI/);
});
test('Scheduler uses one atomic due-task claim',async()=>{
 let statement='';
 const rows=await runErpSchedule({query:async sql=>{statement=sql;return [{task_id:ws}]}});
 assert.equal(rows.length,1);
 assert.match(statement,/FOR UPDATE SKIP LOCKED/);
 assert.match(statement,/erp_task_events/);
});
