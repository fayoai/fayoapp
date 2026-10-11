import test from 'node:test';import assert from 'node:assert/strict';
import {providerCodes,getAIProviders,routeAI} from './ai-router.js';
test('Supported AI providers are explicitly allowlisted',()=>assert.deepEqual(providerCodes,['openai','anthropic','gemini','groq','openrouter','workers_ai']));
test('No configured model rejects without exposing credentials',async()=>{await assert.rejects(routeAI('Hello',[]),/not configured/)});
test('Operator environment credentials remain server side',async()=>{const p=await getAIProviders(null,{OPENAI_API_KEY:'private-test-secret',OPENAI_MODEL:'custom-model'},async()=>[]);assert.deepEqual(p.map(x=>({code:x.code,model:x.model})),[{code:'openai',model:'custom-model'}])});
test('Disabled database provider is not used even with environment secret',async()=>{const db={};const p=await getAIProviders(db,{OPENAI_API_KEY:'secret'},async()=>[]);assert.equal(p.length,1);const off=await getAIProviders(db,{OPENAI_API_KEY:'secret'},async()=>[{code:'openai',model:'model',encrypted_key:'',enabled:false,priority:1}]);assert.deepEqual(off,[])});

test('RAWI uses approved provider responses and reports token usage',async()=>{
 const saved=globalThis.fetch;let requested='';
 globalThis.fetch=async(url)=>{requested=url;return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'مرحبًا من راوي'}]}],usage:{input_tokens:14,output_tokens:7}})}};
 try{const r=await routeAI('مرحبا',[{code:'openai',model:'test-model',key:'server-only-key'}]);assert.equal(requested,'https://api.openai.com/v1/responses');assert.equal(r.answer,'مرحبًا من راوي');assert.equal(r.input_tokens,14);assert.equal(r.output_tokens,7);assert.equal(r.provider,'openai');}finally{globalThis.fetch=saved}
});
test('RAWI retries a second approved provider on failure',async()=>{
 const saved=globalThis.fetch;let hits=0;
 globalThis.fetch=async(url)=>{hits++;if(hits===1)return {ok:false,status:503};return {ok:true,json:async()=>({content:[{type:'text',text:'Claude response'}],usage:{input_tokens:5,output_tokens:4}})}};
 try{const r=await routeAI('Hello',[{code:'openai',model:'test',key:'key-a'},{code:'anthropic',model:'test-claude',key:'key-b'}]);assert.equal(hits,2);assert.equal(r.provider,'anthropic');assert.equal(r.answer,'Claude response')}finally{globalThis.fetch=saved}
});

test('Free Groq and OpenRouter models use server-side credentials and never receive private tenant context',async()=>{
 const saved=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,opt)=>{calls.push({url,body:JSON.parse(opt.body),headers:opt.headers});return {ok:true,json:async()=>({choices:[{message:{content:'Free model answer'}}],usage:{prompt_tokens:12,completion_tokens:5}})}};
 try{
  const a=await routeAI('How do I organize sales?',[{code:'groq',model:'openai/gpt-oss-20b',key:'server-private'}],[{role:'user',content:'SAVED_PRIVATE_HISTORY'}],'PRIVATE_CUSTOMER_123');
  const o=await routeAI('Hi',[{code:'openrouter',model:'openrouter/free',key:'server-private'}],[],'PRIVATE_CUSTOMER_123');
  assert.equal(a.provider,'groq');assert.equal(o.provider,'openrouter');
  assert.equal(a.input_tokens,12);assert.equal(o.output_tokens,5);
  assert.equal(calls[0].url,'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(calls[1].url,'https://openrouter.ai/api/v1/chat/completions');
  assert.ok(calls.every(c=>!JSON.stringify(c.body).includes('PRIVATE_CUSTOMER_123')));
  assert.ok(calls.every(c=>!JSON.stringify(c.body).includes('SAVED_PRIVATE_HISTORY')));
  assert.ok(calls.every(c=>c.headers.Authorization==='Bearer server-private'));
 }finally{globalThis.fetch=saved}
});
test('Workers AI binding can be used without a browser-visible API key',async()=>{
 let seen;
 const env={AI:{run:async(model,payload)=>{seen={model,payload};return {response:'Workers AI reply'}}}};
 const providers=await getAIProviders({},env,async()=>[{code:'workers_ai',enabled:true,model:'@cf/meta/llama-3.2-1b-instruct',priority:1}]);
 assert.equal(providers.length,1);
 const r=await routeAI('Hello',providers,[],'SENSITIVE_SECRET_ABC');
 assert.equal(r.answer,'Workers AI reply');assert.equal(r.provider,'workers_ai');
 assert.ok(!JSON.stringify(seen).includes('SENSITIVE_SECRET_ABC'));
});
