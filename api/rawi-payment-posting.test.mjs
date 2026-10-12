import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installRawiAdvanced} from './rawi-advanced.js';

const workspace='11111111-1111-4111-8111-111111111111';
const user='22222222-2222-4222-8222-222222222222';
const cash='33333333-3333-4333-8333-333333333333';
const offset='44444444-4444-4444-8444-444444444444';
const requestId='55555555-5555-4555-8555-555555555555';
const postPath='/api/admin/erp/w/'+workspace+'/advanced/payments';
const payload={direction:'incoming',method:'bank',amount_halalas:13500,reference:'RE-00012',details:'Receipt',
 cash_account_id:cash,counterpart_account_id:offset,request_id:requestId};
const mock=({role='owner',cashType='asset',prior=null}={})=>{
 const app=new Hono(),calls=[];
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',user);await next()});
 const query=async(_sql,statement,params=[])=>{
  calls.push({statement,params});
  if(statement.includes('SELECT role FROM erp_memberships'))return [{role}];
  if(statement.includes('SELECT p.*,j.id journal_entry_id'))return prior?[prior]:[];
  if(statement.includes('SELECT id,type FROM erp_accounts'))return [{id:cash,type:cashType},{id:offset,type:'liability'}];
  if(statement.includes('WITH recorded AS('))return [{id:requestId,journal_entry_id:requestId}];
  if(statement.includes('SELECT p.*,i.invoice_no,j.id'))return [];
  return [];
 };
 installRawiAdvanced(app,{db:()=>({}),query});
 const send=(data=payload)=>app.request('http://localhost'+postPath,
  {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
 return {send,calls};
};

test('Receipt posts a balanced two-line journal in the SAME SQL statement as the payment',async()=>{
 const h=mock();
 const response=await h.send();
 assert.equal(response.status,201,await response.clone().text());
 const result=await response.json();
 assert.equal(result.posted,true);
 assert.ok(result.journal_entry_id);
 const entry=h.calls.find(c=>c.statement.includes('WITH recorded AS('));
 assert.ok(entry);
 assert.match(entry.statement,/INSERT INTO rawi_payments/);
 assert.match(entry.statement,/INSERT INTO erp_journal_entries/);
 assert.match(entry.statement,/ON CONFLICT\(id\) DO NOTHING/);
 assert.equal(entry.params[0],requestId);
 const [debit,credit]=JSON.parse(entry.params[9]);
 assert.deepEqual([debit.account_id,debit.debit_halalas,debit.credit_halalas],[cash,13500,0]);
 assert.deepEqual([credit.account_id,credit.debit_halalas,credit.credit_halalas],[offset,0,13500]);
});

test('Expense voucher reverses debit/credit direction',async()=>{
 const h=mock();const response=await h.send({...payload,direction:'outgoing'});
 assert.equal(response.status,201);
 const entry=h.calls.find(c=>c.statement.includes('WITH recorded AS('));
 const [debit,credit]=JSON.parse(entry.params[9]);
 assert.equal(debit.account_id,offset);assert.equal(credit.account_id,cash);
});

test('Posting never accepts the same account twice or a non-asset cash account',async()=>{
 const one=mock();
 assert.equal((await one.send({...payload,counterpart_account_id:cash})).status,400);
 assert.ok(!one.calls.some(c=>c.statement.includes('WITH recorded AS(')));
 const second=mock({cashType:'income'});
 assert.equal((await second.send()).status,400);
 assert.ok(!second.calls.some(c=>c.statement.includes('WITH recorded AS(')));
});

test('Read-only viewers cannot issue a payment',async()=>{
 const h=mock({role:'viewer'});
 assert.equal((await h.send()).status,403);
 assert.ok(!h.calls.some(c=>c.statement.includes('WITH recorded AS(')));
});

test('Retried payment returns its existing voucher instead of posting twice',async()=>{
 const prior={id:requestId,invoice_id:null,direction:'incoming',method:'bank',amount_halalas:13500,reference:'RE-00012',journal_entry_id:requestId};
 const h=mock({prior});
 const response=await h.send();
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.existing,true);assert.equal(result.posted,true);
 assert.ok(!h.calls.some(c=>c.statement.includes('WITH recorded AS(')));
});

test('Legacy unposted vouchers stay distinguishable from posted vouchers',async()=>{
 const h=mock();const response=await h.send({...payload,cash_account_id:undefined,counterpart_account_id:undefined});
 assert.equal(response.status,201);
 const entry=h.calls.find(c=>c.statement.includes('WITH recorded AS('));
 assert.deepEqual(JSON.parse(entry.params[9]),[]);
});
