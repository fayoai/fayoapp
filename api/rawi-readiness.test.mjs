import test from 'node:test';import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installRawiDeveloper,odooRead} from './rawi-developer.js';
const w='11111111-1111-4111-8111-111111111111';
test('Odoo module reading supports pages and rejects negative offsets',async()=>{
 const old=globalThis.fetch;let body;
 globalThis.fetch=async(_url,opt)=>{body=JSON.parse(opt.body);return new Response('[]',{headers:{'Content-Type':'application/json'}})};
 try{
  await odooRead({base_url:'https://odoo.example.com',database_name:'demo',api_version:'json2'},'secret','ir.module.module',['name'],100,200);
  assert.equal(body.offset,200);assert.equal(body.limit,100);
  await assert.rejects(()=>odooRead({base_url:'https://odoo.example.com',api_version:'json2'},'secret','ir.module.module',['name'],100,-1),/offset/);
 }finally{globalThis.fetch=old}
});
test('Odoo developer connection cannot be deleted while a project still depends on it',async()=>{
 const app=new Hono(),calls=[];
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',w);await next()});
 installRawiDeveloper(app,{db:()=>({}),env:()=>({}),query:async(_,sql)=>{calls.push(sql);if(sql.includes('SELECT m.role'))return [{role:'owner'}];if(sql.includes('SELECT 1 FROM rawi_implementation_projects'))return [{id:w}];return []}});
 const result=await app.request('https://example.com/api/admin/developer/w/'+w+'/connections/'+w,{method:'DELETE'});
 assert.equal(result.status,409);assert.ok(!calls.some(x=>x.startsWith('DELETE FROM rawi_odoo_connections')));
});
