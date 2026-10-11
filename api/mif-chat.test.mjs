import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installMifChat,respondWithOwnerKey} from './mif-chat.js';
const user='11111111-1111-4111-8111-111111111111';
const root=()=>{const app=new Hono();const statements=[];app.use('/api/admin/*',async(c,next)=>{c.set('adminId',user);await next()});installMifChat(app,{db:()=>({}),env:()=>({SESSION_SECRET:'a-strong-session-secret-at-least-thirty-two-characters',PUBLIC_CHAT_ENABLED:'true'}),query:async(_db,sql,args=[])=>{statements.push({sql,args});return []}});return {app,statements}};
const send=(app,path,body)=>app.request('http://localhost'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
test('Public chat requires an identifiable visitor',async()=>{const {app}=root();const r=await send(app,'/api/chat/public',{question:'Hello'});assert.equal(r.status,403)});
test('Owner OpenAI credentials are not exposed to ordinary accounts',async()=>{const {app}=root();const r=await app.request('http://localhost/api/admin/platform/openai');assert.equal(r.status,403)});
test('Anonymous visitors cannot access saved private conversations',async()=>{const {app}=root();const r=await app.request('http://localhost/api/admin/chat/threads/'+user);assert.equal(r.status,404)});
test('Model calls fail explicitly when the operator key is absent',async()=>{await assert.rejects(()=>respondWithOwnerKey('Hello',{}),/not been activated/)});
test('Empty messages and oversized prompts are rejected',async()=>{const {app}=root();assert.equal((await send(app,'/api/chat/public',{question:''})).status,400);assert.equal((await send(app,'/api/chat/public',{question:'x'.repeat(2501)})).status,400)});
test('Saved threads only return records belonging to authenticated principal',async()=>{const {app,statements}=root();const r=await app.request('http://localhost/api/admin/chat/threads');assert.equal(r.status,200);assert.deepEqual((await r.json()).data,[]);assert.equal(statements[0].args[0],user)});

test('Public marketing AI calls are tenant-free and metered only after a real provider answer',async()=>{
 const original=globalThis.fetch;const statements=[];let instructions='';
 const app=new Hono();
 installMifChat(app,{
  db:()=>({}),
  env:()=>({SESSION_SECRET:'a-strong-session-secret-at-least-thirty-two-characters',PUBLIC_CHAT_ENABLED:'true',OPENAI_API_KEY:'test-server-key'}),
  query:async(_sql,q,args=[])=>{statements.push({q,args});if(q.startsWith('INSERT INTO mif_guest_usage'))return [{hits:1}];return []}
 });
 globalThis.fetch=async(_url,opt)=>{instructions=JSON.parse(opt.body).instructions;return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Real AI response'}]}],usage:{input_tokens:12,output_tokens:8}})}};
 try{
  const response=await app.request('http://localhost/api/chat/public',{method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':'203.0.113.10'},body:JSON.stringify({question:'What is MIF Smart?'})});
  assert.equal(response.status,200);
  assert.equal((await response.json()).answer,'Real AI response');
  assert.match(instructions,/You are MIF Smart/);
  const meter=statements.find(x=>x.q.startsWith('INSERT INTO mif_ai_usage'));
  assert.ok(meter);
  assert.deepEqual(meter.args,['openai','gpt-4.1-mini',12,8]);
  assert.ok(!JSON.stringify(meter).includes('203.0.113.10'));
 }finally{globalThis.fetch=original}
});

test('Public RAWI PDF attachment reaches the configured AI provider without storing guest files',async()=>{
 const original=globalThis.fetch;let received;const statements=[];
 const app=new Hono();
 installMifChat(app,{
  db:()=>({}),
  env:()=>({SESSION_SECRET:'a-strong-session-secret-at-least-thirty-two-characters',PUBLIC_CHAT_ENABLED:'true',MIF_APP_SURFACE:'enterprise',OPENAI_API_KEY:'test-secret'}),
  query:async(_db,sql,args=[])=>{statements.push({sql,args});if(sql.startsWith('INSERT INTO mif_guest_usage'))return [{hits:1}];return []}
 });
 globalThis.fetch=async(_url,opts)=>{received=JSON.parse(opts.body);return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'PDF analyzed'}]}]})}};
 try{
  const pdf={name:'receipt.pdf',mime_type:'application/pdf',data:'data:application/pdf;base64,'+Buffer.from('%PDF-1.7').toString('base64')};
  const response=await app.request('http://localhost/api/chat/public',{method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':'203.0.113.21'},body:JSON.stringify({question:'Summarize the file',documents:[pdf]})});
  assert.equal(response.status,200);
  assert.equal((await response.json()).answer,'PDF analyzed');
  assert.deepEqual(received.input.at(-1).content[1],{type:'input_file',filename:'receipt.pdf',file_data:pdf.data});
  assert.ok(!statements.some(x=>JSON.stringify(x).includes(pdf.data)));
 }finally{globalThis.fetch=original}
});
test('Microphone fallback transcribes a bounded audio recording without a signed-in account',async()=>{
 const original=globalThis.fetch;let endpoint,transcription;
 const app=new Hono();
 installMifChat(app,{
  db:()=>({}),
  env:()=>({SESSION_SECRET:'a-strong-session-secret-at-least-thirty-two-characters',PUBLIC_CHAT_ENABLED:'true',OPENAI_API_KEY:'voice-secret'}),
  query:async(_db,sql)=>sql.startsWith('INSERT INTO mif_guest_usage')?[{hits:1}]:[]
 });
 globalThis.fetch=async(url,opts)=>{endpoint=url;transcription=opts.body;return {ok:true,json:async()=>({text:'Send the monthly report'})}};
 try{
  const form=new FormData();form.append('audio',new Blob([new Uint8Array(400)],{type:'audio/webm'}),'voice.webm');
  const response=await app.request('http://localhost/api/chat/transcribe',{method:'POST',headers:{'CF-Connecting-IP':'203.0.113.22'},body:form});
  assert.equal(response.status,200);
  assert.equal((await response.json()).text,'Send the monthly report');
  assert.equal(endpoint,'https://api.openai.com/v1/audio/transcriptions');
  assert.equal(transcription.get('model'),'gpt-4o-mini-transcribe');
 }finally{globalThis.fetch=original}
});
