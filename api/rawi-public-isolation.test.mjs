import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installMifChat} from './mif-chat.js';
import {surfacePolicy} from '../worker/surface-policy.js';
const config={
 SESSION_SECRET:'strong-enough-secret-value-for-live-apps-1234',
 PUBLIC_CHAT_ENABLED:'true',
 OPENAI_API_KEY:'mock-key-for-test-only'
};
test('Enterprise and Developer use separate real, metered public AI routes without private context',async()=>{
 const original=globalThis.fetch;
 try{
  for(const surface of ['enterprise','developer']){
   const statements=[];let instruction='';
   globalThis.fetch=async(_url,options)=>{instruction=JSON.parse(options.body).instructions;return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Provider response'}]}],usage:{input_tokens:8,output_tokens:3}})}};
   const app=new Hono();
   installMifChat(app,{
    db:()=>({}),
    env:()=>({...config,MIF_APP_SURFACE:surface}),
    query:async(_sql,sql,args=[])=>{
     statements.push({sql,args});
     if(sql.startsWith('INSERT INTO mif_guest_usage'))return [{hits:1}];
     return [];
    }
   });
   const result=await app.request('http://localhost/api/chat/public',{method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':'192.0.2.111'},body:JSON.stringify({question:'How can RAWI help?'})});
   assert.equal(result.status,200);
   assert.equal((await result.json()).answer,'Provider response');
   assert.match(instruction,surface==='enterprise'?/You are RAWI Enterprise/:/You are RAWI Developer/);
   assert.doesNotMatch(instruction,/You are MIF Smart/);
   assert.ok(!statements.some(x=>x.sql.includes('FROM mif_products')));
   assert.ok(statements.some(x=>x.sql.startsWith('INSERT INTO mif_ai_usage')));
  }
 }finally{globalThis.fetch=original}
});
test('Developer guest AI does not enable Enterprise ERP or management routes',()=>{
 assert.equal(surfacePolicy('developer','/api/chat/public','POST'),null);
 assert.deepEqual(surfacePolicy('developer','/api/admin/erp/w/123/core/items','GET'),{status:404});
 assert.deepEqual(surfacePolicy('developer','/api/admin/platform/providers','GET'),{status:404});
});
