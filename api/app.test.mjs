import test from 'node:test';
import assert from 'node:assert/strict';
import app from './app.js';
const invoke=(path,init={})=>app.request('http://localhost'+path,init,{});
test('health declares preview mode when database is not configured',async()=>{const res=await invoke('/api/health');assert.equal(res.status,200);const data=await res.json();assert.equal(data.database,'unconfigured');assert.equal(data.mode,'preview')});
test('bootstrap returns complete preview catalog without leaking backend secrets',async()=>{const res=await invoke('/api/bootstrap');assert.equal(res.status,200);const body=await res.json();assert.equal(body.mode,'preview');assert.ok(body.catalog.length>=6);assert.ok(body.catalog.some(x=>x.sku==='MIF-ERP'));assert.equal('DATABASE_URL' in body,false)});
test('invalid inquiries are rejected',async()=>{const res=await invoke('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'a',email:'invalid',message:'x'})});assert.equal(res.status,400)});
test('valid inquiries are unavailable until database connected',async()=>{const res=await invoke('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'MIF Customer',email:'customer@example.com',phone:'123456789',message:'I want a SaaS platform.'})});assert.equal(res.status,503)});
test('private admin endpoint rejects missing session or secret',async()=>{const res=await invoke('/api/admin/me');assert.equal(res.status,503)});
test('unlisted admin datasets cannot be accessed',async()=>{const res=await invoke('/api/admin/unknown');assert.equal(res.status,503)});
test('public articles list is empty before connecting a database',async()=>{const res=await invoke('/api/articles');assert.equal(res.status,200);const body=await res.json();assert.deepEqual(body.data,[])});

test('out of scope activities are not exposed by bootstrap', async()=>{const r=await invoke('/api/bootstrap');const d=await r.json();assert.equal(d.catalog.some(x=>['smart-home','contracting'].includes(x.category)),false)});
