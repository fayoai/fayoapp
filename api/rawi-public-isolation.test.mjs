import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installMifChat} from './mif-chat.js';
import {surfacePolicy} from '../worker/surface-policy.js';
test('RAWI ERP visitor has real AI answers without exposing customer records',async()=>{
 const original=globalThis.fetch,statements=[];let instruction='';
 try{
  globalThis.fetch=async(_url,opt)=>{instruction=JSON.parse(opt.body).instructions;return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Provider response'}]}],usage:{input_tokens:8,output_tokens:3}})}};
  const app=new Hono();
  installMifChat(app,{db:()=>({}),env:()=>({SESSION_SECRET:'secure-secret-credential-for-test-only-00000',PUBLIC_CHAT_ENABLED:'true',OPENAI_API_KEY:'mock-secret',MIF_APP_SURFACE:'enterprise'}),query:async(_db,sql,args=[])=>{statements.push({sql,args});if(sql.startsWith('INSERT INTO mif_guest_usage'))return [{hits:1}];return []}});
  const result=await app.request('https://erp.example/api/chat/public',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.21'},body:JSON.stringify({question:'How to invoice?'})});
  assert.equal(result.status,200);
  assert.equal((await result.json()).answer,'Provider response');
  assert.match(instruction,/You are RAWI ERP/);
  assert.ok(!statements.some(x=>x.sql.includes('FROM mif_products')));
  assert.ok(statements.some(x=>x.sql.startsWith('INSERT INTO mif_ai_usage')));
 }finally{globalThis.fetch=original}
});
test('Future-product service cannot expose public AI or SaaS APIs',()=>{
 assert.deepEqual(surfacePolicy('developer','/api/chat/public','POST'),{status:404});
 assert.deepEqual(surfacePolicy('developer','/api/admin/login','POST'),{status:404});
 assert.deepEqual(surfacePolicy('enterprise','/api/admin/platform/providers','GET'),{status:404});
});
