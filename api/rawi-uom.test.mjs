import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installRawiUom,unitsToBase,resolveItemUnit} from './rawi-uom.js';
import {STANDARD_GROUPS} from './rawi-standard-catalog.js';
import {tenantMigrationSteps} from './tenant-schema.generated.js';

const workspace='11111111-1111-4111-8111-111111111111';
const item='22222222-2222-4222-8222-222222222222';
const unit='33333333-3333-4333-8333-333333333333';
test('UOM catalogue is exposed under system management',()=>{
 const admin=STANDARD_GROUPS.find(x=>x.key==='management');
 assert.equal(admin.repositories.length,3);
 assert.ok(admin.repositories.some(x=>x.name==='وحدات القياس'));
});
test('UOM quantity conversions respect three decimal base stock precision',()=>{
 assert.equal(unitsToBase(2,12),24);
 assert.equal(unitsToBase(0.5,12),6);
 assert.equal(unitsToBase(2.5,0.2),0.5);
 assert.throws(()=>unitsToBase(1,1/7),/3/);
 assert.throws(()=>unitsToBase(Infinity,12));
});
test('Document lookup applies selected product UOM factor and alternate selling price',async()=>{
 const query=async(_,sql,params)=>{
  assert.equal(params[0],workspace);assert.equal(params[1],item);assert.equal(params[2],unit);
  return [{id:item,unit:'pcs',factor:12,sale_price_halalas:1000,cost_halalas:500,
   unit_sale_halalas:10500,unit_purchase_halalas:null,unit_name:'كرتون',unit_code:'box'}];
 };
 const x=await resolveItemUnit({sql:{},query,workspace,itemId:item,unitId:unit,quantity:3});
 assert.deepEqual({quantity:x.baseQuantity,sales:x.sale_price_halalas,purchase:x.purchase_price_halalas,code:x.unit_code},
  {quantity:36,sales:10500,purchase:6000,code:'box'});
});
function mock({role='owner',knownItem=true,unitCategory='count'}={}){
 const app=new Hono(),events=[];
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',item);await next()});
 const query=async(_db,sql,args=[])=>{
  events.push({sql,args});
  if(sql.includes('SELECT role FROM erp_memberships'))return [{role}];
  if(sql.includes('SELECT id,unit FROM erp_items'))return knownItem?[{id:item,unit:'pcs'}]:[];
  if(sql.includes('SELECT id,code,category,active FROM erp_units'))return [{id:unit,code:'box',category:unitCategory,active:true}];
  if(sql.includes('SELECT u.category,u.code'))return [{category:'count',code:'pcs'}];
  if(sql.includes('INSERT INTO erp_item_units'))return [{item_id:item,unit_id:unit,factor:12,is_base:false,barcode:'BOX12'}];
  if(sql.includes('SELECT id,code,name,category,precision_digits,active FROM erp_units'))return [];
  if(sql.includes('INSERT INTO erp_units'))return [{id:unit,code:'box',name:'كرتون',category:'count',precision_digits:0,active:true}];
  return [];
 };
 installRawiUom(app,{db:()=>({}),env:c=>c.env||{},query});
 const request=(path,options={})=>app.request('http://local/api/admin/erp/w/'+workspace+path,options,{MIF_APP_SURFACE:'enterprise'});
 return {request,events};
}
test('Creating units and linking product conversions persist through tenant SQL',async()=>{
 const h=mock();
 const posted=await h.request('/system/units',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'box',name:'كرتون',category:'count',precision_digits:0})});
 assert.equal(posted.status,201);
 const link=await h.request('/system/items/'+item+'/units',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({unit_id:unit,factor:12,barcode:'BOX12',sale_price:105,purchase_price:60})});
 assert.equal(link.status,200);
 assert.ok(h.events.some(x=>x.sql.includes('INSERT INTO erp_item_units')&&x.args[3]===12));
});
test('UOM cannot cross categories or bypass viewer restrictions',async()=>{
 const payload={unit_id:unit,factor:12};
 const route='/system/items/'+item+'/units';
 const options={method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)};
 assert.equal((await mock({unitCategory:'weight'}).request(route,options)).status,409);
 assert.equal((await mock({role:'viewer'}).request(route,options)).status,403);
 assert.equal((await mock({knownItem:false}).request(route,options)).status,404);
});

test('UOM migrations append after existing tenant schema versions',()=>{
 assert.ok(tenantMigrationSteps.length>=107);
 assert.ok(tenantMigrationSteps.slice(98).some(x=>x.includes('CREATE TABLE IF NOT EXISTS erp_units')));
 assert.ok(tenantMigrationSteps.slice(98).some(x=>x.includes('CREATE TABLE IF NOT EXISTS erp_item_units')));
 assert.equal(tenantMigrationSteps.slice(0,98).some(x=>x.includes('CREATE TABLE IF NOT EXISTS erp_units')),false);
});
