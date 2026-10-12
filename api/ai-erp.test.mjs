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
test('Customer accounts cannot configure the operator OpenAI key through workspace API',async()=>{
 const {app}=api(sql=>sql.includes('SELECT role FROM erp_memberships')?[{role:'owner'}]:[]);
 const r=await req(app,'/api/admin/erp/w/'+ws+'/integrations/openai',{label:'OpenAI',secret:'sk-customer-key'},'PUT');
 assert.equal(r.status,400);
 const legacy=await req(app,'/api/admin/erp/w/'+ws+'/ask',{question:'Hello'});
 assert.equal(legacy.status,404);
});
test('Scheduler uses one atomic due-task claim',async()=>{
 let statement='';
 const rows=await runErpSchedule({query:async sql=>{statement=sql;return [{task_id:ws}]}});
 assert.equal(rows.length,1);
 assert.match(statement,/FOR UPDATE SKIP LOCKED/);
 assert.match(statement,/erp_task_events/);
});

const invoiceId='44444444-4444-4444-8444-444444444444';
const receivableId='55555555-5555-4555-8555-555555555555',revenueId='66666666-6666-4666-8666-666666666666',vatId='77777777-7777-4777-8777-777777777777';
const issueUrl='/api/admin/erp/w/'+ws+'/invoices/'+invoiceId+'/issue';
const issueAccounts={receivable_account_id:receivableId,revenue_account_id:revenueId,vat_account_id:vatId};
test('Issuing an invoice changes draft status and posts balanced receivables, revenue and VAT in one SQL statement',async()=>{
 const {app,calls}=api((sql)=>{
  if(sql.includes('SELECT role FROM erp_memberships'))return [{role:'owner'}];
  if(sql.includes('SELECT status,subtotal_halalas'))return [{status:'draft',subtotal_halalas:10000,vat_halalas:1500,total_halalas:11500}];
  if(sql.includes('SELECT id,type FROM erp_accounts'))return [{id:receivableId,type:'asset'},{id:revenueId,type:'income'},{id:vatId,type:'liability'}];
  if(sql.includes('WITH issued AS('))return [{id:invoiceId,invoice_no:'MIF-1',journal_entry_id:invoiceId}];
  return [];
 });
 const response=await req(app,issueUrl,issueAccounts);
 assert.equal(response.status,200,await response.clone().text());
 assert.equal((await response.json()).posted,true);
 const commit=calls.find(x=>x.sql.includes('WITH issued AS('));
 assert.ok(commit);
 assert.match(commit.sql,/UPDATE erp_invoices SET status='issued'/);
 assert.match(commit.sql,/INSERT INTO erp_journal_entries/);
 assert.match(commit.sql,/jsonb_build_object\('account_id',\$5::uuid/);
 assert.deepEqual(commit.args,[ws,invoiceId,receivableId,revenueId,vatId]);
});
test('Sales invoice cannot be issued without valid company tax accounts',async()=>{
 const {app,calls}=api(sql=>{
  if(sql.includes('SELECT role FROM erp_memberships'))return [{role:'owner'}];
  if(sql.includes('SELECT status,subtotal_halalas'))return [{status:'draft',subtotal_halalas:10000,vat_halalas:1500,total_halalas:11500}];
  if(sql.includes('SELECT id,type FROM erp_accounts'))return [{id:receivableId,type:'asset'},{id:revenueId,type:'expense'},{id:vatId,type:'liability'}];
  return [];
 });
 const result=await req(app,issueUrl,issueAccounts);
 assert.equal(result.status,400);
 assert.equal(calls.some(x=>x.sql.includes('WITH issued AS(')),false);
});
test('Direct issued status is refused unless the dedicated GL-safe route is used',async()=>{
 const {app,calls}=api(sql=>sql.includes('SELECT role FROM erp_memberships')?[{role:'owner'}]:[]);
 const result=await req(app,'/api/admin/erp/w/'+ws+'/invoices/'+invoiceId+'/status',{status:'issued'},'PATCH');
 assert.equal(result.status,409);
 assert.equal(calls.some(x=>x.sql.includes('UPDATE erp_invoices')),false);
});
test('Invoice paid transition verifies full posted receipts instead of trusting a click',async()=>{
 const {app,calls}=api(sql=>{
  if(sql.includes('SELECT role FROM erp_memberships'))return [{role:'owner'}];
  if(sql.includes('UPDATE erp_invoices i SET status'))return [];
  return [];
 });
 const response=await req(app,'/api/admin/erp/w/'+ws+'/invoices/'+invoiceId+'/status',{status:'paid'},'PATCH');
 assert.equal(response.status,409);
 assert.ok(calls.some(x=>x.sql.includes("pj.reference='RAWI-PAY-'")));
});
