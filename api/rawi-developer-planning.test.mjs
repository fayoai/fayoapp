import test from 'node:test';import assert from 'node:assert/strict';import {Hono} from 'hono';import {installRawiDeveloper} from './rawi-developer.js';
const id='11111111-1111-4111-8111-111111111111';
function setup(role){const app=new Hono(),queries=[];app.use('/api/admin/*',async(c,next)=>{c.set('adminId',id);await next()});
 installRawiDeveloper(app,{db:()=>({}),env:()=>({}),query:async(_db,sql,args)=>{queries.push({sql,args});if(sql.includes('SELECT m.role'))return role?[{role}]:[];return []}});return {app,queries}}
test('Only Developer members can invoke the AI module planner',async()=>{
 const {app,queries}=setup(null);
 const res=await app.request('https://example.com/api/admin/developer/w/'+id+'/modules/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description:'Create customer equipment tracking',odoo_version:'19'})});
 assert.equal(res.status,403);assert.ok(!queries.some(x=>x.sql.includes('UPDATE mif_tenant_subscriptions')));
});
test('Invalid Odoo addon prompts are rejected before AI usage is charged',async()=>{
 const {app,queries}=setup('owner');
 const res=await app.request('https://example.com/api/admin/developer/w/'+id+'/modules/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description:'x',odoo_version:'99'})});
 assert.equal(res.status,400);assert.ok(!queries.some(x=>x.sql.includes('UPDATE mif_tenant_subscriptions')));
});
test('Developer AI usage requires an active Developer-specific subscription',async()=>{
 const {app,queries}=setup('owner');
 const res=await app.request('https://example.com/api/admin/developer/w/'+id+'/modules/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description:'Track maintenance jobs with a priority and due date',odoo_version:'19'})});
 assert.equal(res.status,402);assert.ok(queries.some(x=>x.sql.includes("p.application='developer'")));
});
