import test from 'node:test';
import assert from 'node:assert/strict';
import app from './app.js';
const invoke=(path,options={})=>app.request('http://localhost'+path,options,{});
test('ERP health is explicit when persistent storage is not connected',async()=>{
 const res=await invoke('/api/health');
 assert.equal(res.status,503);
 const data=await res.json();
 assert.equal(data.service,'MIF Smart AI ERP');
 assert.equal(data.database,'not_configured');
});
test('ERP routes require authorized session and do not leak workspace records',async()=>{
 for(const path of ['/api/admin/me','/api/admin/erp/workspaces','/api/admin/erp/w/11111111-1111-4111-8111-111111111111/core/items']){
  const r=await invoke(path);assert.equal(r.status,503);
 }
});
test('Legacy marketing, store, sales checkout and product APIs are absent',async()=>{
 for(const path of ['/api/bootstrap','/api/articles','/api/commerce/catalog','/api/commerce/checkout','/api/leads','/api/orders']){
  const r=await invoke(path);assert.equal(r.status,404);
 }
});
test('Cross-origin modifications are rejected before processing',async()=>{
 const r=await invoke('/api/admin/login',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'});
 assert.equal(r.status,403);
});
