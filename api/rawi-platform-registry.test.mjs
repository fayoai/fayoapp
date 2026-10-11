import test from 'node:test';import assert from 'node:assert/strict';
import {Hono} from 'hono';import {listDeveloperPlatforms,requireEnabledDeveloperPlatform} from './rawi-platform-registry.js';
import {installRawiDeveloper} from './rawi-developer.js';
const id='11111111-1111-4111-8111-111111111111';
test('Odoo is the only active developer integration; future adapters are not falsely enabled',()=>{
 const list=listDeveloperPlatforms();assert.deepEqual(list.map(x=>x.code),['odoo']);assert.equal(list[0].active,true);
 assert.ok(list[0].capabilities.includes('diagnostic_history'));
 assert.equal(requireEnabledDeveloperPlatform('odoo').name,'Odoo');
 assert.throws(()=>requireEnabledDeveloperPlatform('sap'),/Unsupported/);
 assert.throws(()=>requireEnabledDeveloperPlatform('erpnext'),/Unsupported/);
});
test('Developer integration catalog is not accessible from Enterprise accounts',async()=>{
 const app=new Hono();app.use('/api/admin/*',async(c,next)=>{c.set('adminId',id);await next()});
 installRawiDeveloper(app,{db:()=>({}),env:()=>({}),query:async()=>[]});
 const res=await app.request('https://app.example.com/api/admin/developer/platforms');
 assert.equal(res.status,403);
});
test('Authenticated developer account sees only supported safe platform capabilities',async()=>{
 const app=new Hono();app.use('/api/admin/*',async(c,next)=>{c.set('adminId',id);await next()});
 installRawiDeveloper(app,{db:()=>({}),env:()=>({}),query:async()=>[{exists:1}]});
 const res=await app.request('https://app.example.com/api/admin/developer/platforms'),body=await res.json();
 assert.equal(res.status,200);assert.equal(body.data.length,1);
 assert.equal(body.data[0].code,'odoo');assert.ok(!('secret' in body.data[0]));
});
