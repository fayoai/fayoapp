import test from 'node:test';import assert from 'node:assert/strict';
import {providerCodes,getAIProviders,routeAI} from './ai-router.js';
test('Supported AI providers are explicitly allowlisted',()=>assert.deepEqual(providerCodes,['openai','anthropic','gemini']));
test('No configured model rejects without exposing credentials',async()=>{await assert.rejects(routeAI('Hello',[]),/not configured/)});
test('Operator environment credentials remain server side',async()=>{const p=await getAIProviders(null,{OPENAI_API_KEY:'private-test-secret',OPENAI_MODEL:'custom-model'},async()=>[]);assert.deepEqual(p.map(x=>({code:x.code,model:x.model})),[{code:'openai',model:'custom-model'}])});
test('Disabled database provider is not used even with environment secret',async()=>{const db={};const p=await getAIProviders(db,{OPENAI_API_KEY:'secret'},async()=>[]);assert.equal(p.length,1);const off=await getAIProviders(db,{OPENAI_API_KEY:'secret'},async()=>[{code:'openai',model:'model',encrypted_key:'',enabled:false,priority:1}]);assert.deepEqual(off,[])});
