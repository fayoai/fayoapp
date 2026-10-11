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
