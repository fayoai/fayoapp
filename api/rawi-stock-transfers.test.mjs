import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installErpCore} from './erp-core.js';
const ws='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222';
const product='33333333-3333-4333-8333-333333333333',source='44444444-4444-4444-8444-444444444444',dest='55555555-5555-4555-8555-555555555555';
const path='/api/admin/erp/w/'+ws+'/core/transfers';
const payload={item_id:product,source_warehouse_id:source,target_warehouse_id:dest,quantity:3,reference:'Warehouse reallocation'};
const make=(role='owner',hasStock=true)=>{
 const app=new Hono(),calls=[];
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',admin);await next()});
 const query=async(_db,statement,args=[])=>{
  calls.push({statement,args});
  if(statement.includes('SELECT role FROM erp_memberships'))return [{role}];
  if(statement.includes('SELECT i.id,i.unit,i.sale_price_halalas'))return [{id:product,unit:'unit',sale_price_halalas:300,cost_halalas:200,unit_code:'unit',unit_sale_halalas:null,unit_purchase_halalas:null}];
  if(statement.includes('WITH allowed AS('))return [{moved:hasStock?1:0,movement_count:hasStock?2:0}];
  if(statement.includes('WITH received AS('))return hasStock?[{id:product,doc_no:'PO-000012',movement_count:2}]:[];
  return [];
 };
 installErpCore(app,{db:()=>({}),centralDb:()=>({}),query});
 const post=(target=path,data=payload)=>app.request('http://localhost'+target,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
 return {post,calls};
};
test('Two-warehouse transfer debits, credits and audits stock in a single SQL statement',async()=>{
 const h=make();const r=await h.post();
 assert.equal(r.status,201,await r.clone().text());
 const result=await r.json();assert.equal(result.moved_quantity,3);
 const tx=h.calls.find(c=>c.statement.includes('WITH allowed AS('));
 assert.ok(tx);assert.equal(tx.args[0],ws);assert.equal(tx.args[2],source);assert.equal(tx.args[3],dest);
 assert.match(tx.statement,/UPDATE erp_stock s SET quantity=s.quantity-\$5::numeric/);
 assert.match(tx.statement,/INSERT INTO erp_stock\(workspace_id,item_id,warehouse_id,quantity\)/);
 assert.match(tx.statement,/INSERT INTO erp_stock_movements/);
 assert.match(tx.statement,/FROM deposited/);
});
test('Cannot transfer stock from warehouse to itself or without adequate on-hand quantity',async()=>{
 const h=make();const invalid=await h.post(path,{...payload,target_warehouse_id:source});
 assert.equal(invalid.status,400);
 assert.equal(h.calls.some(c=>c.statement.includes('WITH allowed AS(')),false);
 const insufficient=make('owner',false);
 assert.equal((await insufficient.post()).status,409);
});
test('Read-only users cannot transfer stock',async()=>{
 const h=make('viewer');assert.equal((await h.post()).status,403);
 assert.equal(h.calls.some(c=>c.statement.includes('WITH allowed AS(')),false);
});
test('Stock counting passes the old on-hand balance to optimistic concurrency guard',async()=>{
 const h=make();const stock='/api/admin/erp/w/'+ws+'/core/movements';
 const response=await h.post(stock,{item_id:product,warehouse_id:source,delta:2,expected_quantity:5,reason:'Physical count'});
 assert.equal(response.status,409);
 const statement=h.calls.find(c=>c.statement.includes('WITH available AS('));
 assert.ok(statement);
 assert.match(statement.statement,/erp_stock.quantity=\$7/);
 assert.equal(statement.args[6],5);
});

test('Confirmed purchase receipts atomically update the purchase order, stock and audit movements',async()=>{
 const h=make();
 const doc='66666666-6666-4666-8666-666666666666';
 const response=await h.post('/api/admin/erp/w/'+ws+'/core/documents/'+doc+'/receive',{warehouse_id:dest});
 assert.equal(response.status,200,await response.clone().text());
 const entry=h.calls.find(x=>x.statement.includes('WITH received AS('));
 assert.ok(entry);
 assert.match(entry.statement,/UPDATE erp_documents d SET status='completed'/);
 assert.match(entry.statement,/d.kind='purchase' AND d.status='confirmed'/);
 assert.match(entry.statement,/INSERT INTO erp_stock\(workspace_id,item_id,warehouse_id,quantity\)/);
 assert.match(entry.statement,/INSERT INTO erp_stock_movements/);
 assert.equal(entry.args[2],dest);
});
test('Purchase receipt with no confirmable document does not record a stock movement',async()=>{
 const h=make('owner',false);
 const doc='66666666-6666-4666-8666-666666666666';
 const response=await h.post('/api/admin/erp/w/'+ws+'/core/documents/'+doc+'/receive',{warehouse_id:dest});
 assert.equal(response.status,409);
});
