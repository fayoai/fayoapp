import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installCommerce} from './commerce.js';
const orderId='11111111-1111-4111-8111-111111111111';
function setup(handler,config={}){
 const app=new Hono(),statements=[];
 installCommerce(app,{db:()=>({}),env:()=>config,query:async(_db,sql,args=[])=>{statements.push({sql,args});return handler(sql,args)}});
 return {app,statements};
}
const post=(app,url,data)=>app.request('http://localhost'+url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)},{});
test('Custom software cannot be charged without a quotation',async()=>{
 const {app}=setup(()=>[]);
 const payload={idempotency_key:'22222222-2222-4222-8222-222222222222',customer:{name:'Real Customer',email:'customer@example.com',phone:'0550000000'},items:[{sku:'MIF-ERP',cycle:'yearly',quantity:1,configuration:{users:10}}],method:'gateway'};
 const result=await post(app,'/api/commerce/checkout',payload);
 assert.equal(result.status,400);
 assert.match((await result.json()).error,/quotation/i);
});
test('Invalid product requirements are rejected before order insertion',async()=>{
 const {app,statements}=setup(()=>[]);
 const payload={idempotency_key:'22222222-2222-4222-8222-222222222222',customer:{name:'Real Customer',email:'customer@example.com',phone:'0550000000'},items:[{sku:'MIF-ERP',cycle:'yearly',quantity:1,configuration:{users:100000}}],method:'quote'};
 const result=await post(app,'/api/commerce/checkout',payload);
 assert.equal(result.status,400);
 assert.equal(statements.some(x=>/INSERT INTO commerce_orders/.test(x.sql)),false);
});
test('Quote price is server-calculated in halalas including VAT',async()=>{
 const {app,statements}=setup((sql,args)=>/UPDATE commerce_orders SET status='quoted'/.test(sql)?[{id:orderId,reference:'MIF-2026-AAAAAAAAAA',total_halalas:20188}]:[]);
 const result=await post(app,'/api/admin/commerce/orders/'+orderId+'/quote',{subtotal:175.55});
 assert.equal(result.status,200);
 const call=statements.find(x=>x.sql.includes("SET status='quoted'"));
 assert.deepEqual(call.args.slice(0,3),[17555,2633,20188]);
});
test('Private quote acceptance checks payment source and updates state once',async()=>{
 const order={id:orderId,reference:'MIF-2026-AAAAAAAAAA',total_halalas:20188,status:'quoted',payment_method:'quote'};
 const {app,statements}=setup((sql)=>{
  if(sql.startsWith('SELECT id,reference,total_halalas'))return [order];
  if(sql.includes("WHERE key='billing'"))return [{value:{iban:'SA1234567890123456789012',beneficiary:'MIF Smart'}}];
  if(sql.includes("SET status='awaiting_transfer'"))return [{reference:order.reference}];
  return [];
 });
 const result=await post(app,'/api/commerce/order/MIF-2026-AAAAAAAAAA/accept',{access:'an-access-code-with-more-than-20-characters',method:'bank'});
 assert.equal(result.status,200);
 assert.equal((await result.json()).status,'awaiting_transfer');
 assert.ok(statements.some(x=>x.sql.includes("AND status='quoted' RETURNING reference")));
});
test('Fulfillment requires verified paid order and activates subscriptions',async()=>{
 const {app,statements}=setup(sql=>sql.includes("SET status='fulfilled'")?[{reference:'MIF-2026-AAAAAAAAAA'}]:[]);
 const r=await post(app,'/api/admin/commerce/orders/'+orderId+'/fulfill',{});
 assert.equal(r.status,200);
 assert.ok(statements.some(x=>x.sql.includes("commerce_subscriptions SET status='active'")));
});
