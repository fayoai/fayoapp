import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installErpCore,journalTotals} from './erp-core.js';
const workspace='11111111-1111-4111-8111-111111111111';
const user='22222222-2222-4222-8222-222222222222';
const post=(app,path,obj)=>app.request('http://localhost'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});
function run(behavior,role='owner'){const app=new Hono(),calls=[];app.use('/api/admin/*',async(c,next)=>{c.set('adminId',user);await next()});installErpCore(app,{db:()=>({}),query:async(_sql,sql,args)=>{calls.push({sql,args});if(sql.includes('FROM erp_memberships'))return role?[{role}]:[];return behavior(sql,args)}});return {app,calls}}
test('Double entry totals require equal debits and credits',()=>{
 const x=journalTotals([{account_id:workspace,debit:123.45,credit:0},{account_id:user,debit:0,credit:123.45}]);
 assert.equal(x.debit_halalas,12345);assert.equal(x.credit_halalas,12345);
 assert.throws(()=>journalTotals([{debit:5,credit:0},{debit:0,credit:4}]),/balance/);
 assert.throws(()=>journalTotals([{debit:5,credit:5},{debit:0,credit:4}]),/one positive/);
});
test('All operational datasets require workspace membership',async()=>{
 const {app}=run(()=>[],null);
 const res=await app.request('http://localhost/api/admin/erp/w/'+workspace+'/core/items');
 assert.equal(res.status,404);
});
test('Read only roles cannot mutate inventory',async()=>{
 const {app}=run(()=>[],'viewer');
 const res=await post(app,'/api/admin/erp/w/'+workspace+'/core/warehouses',{name:'Main Warehouse'});
 assert.equal(res.status,403);
});
test('Outgoing stock cannot be posted when there is no sufficient balance',async()=>{
 const {app}=run(()=>[]);
 const res=await post(app,'/api/admin/erp/w/'+workspace+'/core/movements',{item_id:user,warehouse_id:user,delta:-10,reason:'Sale dispatch'});
 assert.equal(res.status,409);
});
test('Journal rejects invalid account IDs even with balanced entries',async()=>{
 const {app,calls}=run(()=>[]);
 const res=await post(app,'/api/admin/erp/w/'+workspace+'/core/journal',{reference:'JE-1',lines:[{account_id:user,debit:100,credit:0},{account_id:workspace,debit:0,credit:100}]});
 assert.equal(res.status,400);
 assert.equal(calls.some(x=>x.sql.includes('INSERT INTO erp_journal_entries')),false);
});
test('Document creation rejects supplier as a sales customer',async()=>{
 const {app}=run(sql=>sql.includes('FROM erp_contacts')?[{kind:'vendor'}]:[]);
 const r=await post(app,'/api/admin/erp/w/'+workspace+'/core/documents',{kind:'sale',partner_id:user,lines:[{item_id:user,quantity:1}]});
 assert.equal(r.status,400);
});
