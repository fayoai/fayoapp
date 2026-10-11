import test from 'node:test';import assert from 'node:assert/strict';import {Hono} from 'hono';import {installRawiTeam} from './rawi-team.js';
const workspace='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222';
const setup=role=>{const app=new Hono(),calls=[];app.use('/api/admin/*',async(c,next)=>{c.set('adminId',workspace);await next()});installRawiTeam(app,{db:()=>({}),query:async(_,sql,args)=>{calls.push({sql,args});if(sql.startsWith('SELECT role FROM erp_memberships'))return role?[{role}]:[];return []}});return {app,calls}};
test('Team access is invisible without authorized workspace membership',async()=>{
 const {app}=setup(null);const res=await app.request('http://localhost/api/admin/erp/w/'+workspace+'/members');assert.equal(res.status,404);
});
test('Viewer cannot add or remove organization members',async()=>{
 const {app}=setup('viewer');const endpoint='http://localhost/api/admin/erp/w/'+workspace+'/members';
 const add=await app.request(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'user@example.com',role:'admin'})});
 assert.equal(add.status,403);
 const remove=await app.request(endpoint+'/'+member,{method:'DELETE'});
 assert.equal(remove.status,403);
});
test('Owner role cannot be escalated by adding a second owner or changing owner membership',async()=>{
 const {app,calls}=setup('owner'),endpoint='http://localhost/api/admin/erp/w/'+workspace+'/members';
 const r=await app.request(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'test@example.com',role:'owner'})});
 assert.equal(r.status,400);
 const update=await app.request(endpoint+'/'+member,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({role:'owner'})});
 assert.equal(update.status,400);
 assert.ok(!calls.some(x=>x.sql.startsWith('UPDATE erp_memberships')));
});
test('Existing registered account must be found before adding them to an organization',async()=>{
 const {app,calls}=setup('owner'),endpoint='http://localhost/api/admin/erp/w/'+workspace+'/members';
 const r=await app.request(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'new@example.com',role:'viewer'})});
 assert.equal(r.status,409);assert.ok(calls.some(x=>x.sql.startsWith('INSERT INTO erp_memberships')));
});
