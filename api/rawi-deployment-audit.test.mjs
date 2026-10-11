import test from 'node:test';import assert from 'node:assert/strict';import {Hono} from 'hono';
import {installPlatformSaas} from './platform-saas.js';import {installRawiReadiness} from './rawi-readiness.js';
const id='11111111-1111-4111-8111-111111111111';
const setup=allow=>{const app=new Hono();app.use('/api/admin/*',async(c,next)=>{c.set('adminId',id);await next()});const query=async(_,s)=>{if(s.startsWith('SELECT id FROM admins'))return allow?[{id}]:[];if(s.includes('mif_subscription_plans WHERE active'))return [{plans:1,subscriptions:0,odoo_connections:0,developers:0}];return []};const deps={db:()=>({}),env:c=>c.env||{},query};installPlatformSaas(app,deps);installRawiReadiness(app,deps);return app};
test('Deployment readiness is not public or available to a non-owner',async()=>{
 const a=setup(false);const r=await a.request('http://localhost/api/admin/platform/deployment-audit',{},{PLATFORM_OWNER_EMAIL:'owner@example.com'});assert.equal(r.status,403);
});
test('Owner readiness exposes action items without exposing credentials',async()=>{
 const app=setup(true),env={PLATFORM_OWNER_EMAIL:'owner@example.com',SESSION_SECRET:'s'.repeat(40),CONNECTOR_ENCRYPTION_KEY:'c'.repeat(40),REGISTRATION_ENABLED:'false'};
 const res=await app.request('http://localhost/api/admin/platform/deployment-audit',{},env);assert.equal(res.status,200);
 const payload=await res.json();
 assert.equal(payload.configuration_ready,false);assert.equal(payload.credits_verified,false);
 assert.equal(payload.checks.find(x=>x.code==='registration').ready,false);
 assert.equal(payload.checks.find(x=>x.code==='ai').ready,false);
 assert.ok(!JSON.stringify(payload).includes('s'.repeat(40)));
 assert.ok(!JSON.stringify(payload).includes('c'.repeat(40)));
});
