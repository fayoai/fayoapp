import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {STANDARD_GROUPS,STANDARD_REPOSITORIES,findStandardRepository} from './rawi-standard-catalog.js';
import {installRawiStandardRepositories,zatcaTlv} from './rawi-standard-repositories.js';

const workspace='11111111-1111-4111-8111-111111111111',actor='22222222-2222-4222-8222-222222222222';
test('All requested fixed repositories exist by department, with one leave module',()=>{
 assert.deepEqual(STANDARD_GROUPS.map(x=>[x.title,x.repositories.length]),[['المبيعات',10],['المشتريات',7],['المخزون',5],['المحاسبة',17],['الموظفين',6],['إدارة النظام',3]]);
 assert.equal(STANDARD_REPOSITORIES.length,48);
 assert.equal(new Set(STANDARD_REPOSITORIES.map(x=>x.key)).size,48);
 assert.equal(STANDARD_REPOSITORIES.filter(x=>x.name==='الاجازات').length,1);
 assert.ok(findStandardRepository('std_warehouses'));
 assert.ok(findStandardRepository('std_units'));
 assert.equal(findStandardRepository('std_sales_orders').fields[0].target,'customers');
 assert.ok(findStandardRepository('std_tax_report').read_only);
});
test('ZATCA basic QR contains proper UTF-8 TLV tags 1 through 5',()=>{
 const raw=Uint8Array.from(atob(zatcaTlv({seller:'شركة الاختبار',vatNumber:'300000000000003',timestamp:'2026-10-12T12:00:00Z',total:'115.00',vat:'15.00'})),ch=>ch.charCodeAt(0));
 let pos=0,parts=[];
 while(pos<raw.length){const tag=raw[pos++],size=raw[pos++];parts.push([tag,new TextDecoder().decode(raw.slice(pos,pos+size))]);pos+=size}
 assert.deepEqual(parts.map(x=>x[0]),[1,2,3,4,5]);
 assert.equal(parts[0][1],'شركة الاختبار');assert.equal(parts[4][1],'15.00');
});
function harness({member=true,role='owner'}={}){
 const app=new Hono(),queries=[];
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',actor);c.set('tenantSQL',{id:'tenant'});await next()});
 const query=async(_sql,q,params=[])=>{
  queries.push({q,params});
  if(q.includes('SELECT role FROM erp_memberships'))return member?[{role}]:[];
  if(q.includes('FROM rawi_dynamic_records WHERE workspace_id=$1'))return [];
  if(q.includes('INSERT INTO rawi_dynamic_records')||q.includes('FROM inserted'))return [{id:'33333333-3333-4333-8333-333333333333',values_json:JSON.parse(params[3]||params[2]),stage:'مسودة'}];
  if(q.includes('FROM erp_warehouses'))return [{id:'33333333-3333-4333-8333-333333333333',name:'المركزي',location:'الرياض'}];
  if(q.includes('INSERT INTO erp_warehouses'))return [{id:'33333333-3333-4333-8333-333333333333',name:params[1],location:params[2]}];
  if(q.includes('FROM erp_document_sequences'))return [];
  if(q.includes('FROM erp_invoice_sequences'))return [];
  if(q.includes('FROM rawi_company_profiles'))return [{setup_inputs:{},name:'اختبار',tax_number:'300000000000003',currency:'SAR'}];
  return [];
 };
 installRawiStandardRepositories(app,{db:()=>({id:'tenant'}),centralDb:()=>({id:'central'}),env:c=>c.env||{},query});
 const req=(path,options={})=>app.request('http://localhost'+path,options,{MIF_APP_SURFACE:'enterprise'});
 return {req,queries};
}
test('Fixed catalog is membership-protected and includes warehouse schema',async()=>{
 const path='/api/admin/erp/w/'+workspace+'/standard/catalog';
 assert.equal((await harness({member:false}).req(path)).status,404);
 const r=await harness().req(path);assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.groups.find(x=>x.key==='inventory').repositories.find(x=>x.key==='std_warehouses').name,'المستودعات');
});
test('Warehouse records use existing ERP warehouse table, never a fake browser list',async()=>{
 const h=harness(),path='/api/admin/erp/w/'+workspace+'/standard/std_warehouses/records';
 const listed=await h.req(path);assert.equal(listed.status,200);
 const list=await listed.json();assert.equal(list.data[0].values_json.field_1,'المركزي');
 const created=await h.req(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:{field_1:'مستودع الجنوب',field_2:'جدة'}})});
 assert.equal(created.status,201);
 assert.ok(h.queries.some(x=>x.q.includes('INSERT INTO erp_warehouses')));
});
test('Viewer cannot change company records',async()=>{
 const r=await harness({role:'viewer'}).req('/api/admin/erp/w/'+workspace+'/standard/std_warehouses/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:{field_1:'غير مصرح'}})});
 assert.equal(r.status,403);
});
