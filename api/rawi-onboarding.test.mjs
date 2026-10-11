import test from 'node:test';import assert from 'node:assert/strict';
import {evaluationSettings,ensureEvaluationPlan,enforceAuthLimit} from './rawi-onboarding.js';
test('Evaluation is bounded, free and never claims external AI provider credits',()=>{
 assert.deepEqual(evaluationSettings({}),{days:7,limit:30,code:'rawi-evaluation'});
 assert.deepEqual(evaluationSettings({RAWI_TRIAL_DAYS:'3',RAWI_TRIAL_MESSAGE_LIMIT:'12'}),{days:3,limit:12,code:'rawi-evaluation'});
 for(const n of ['0','31','xyz','-1'])assert.throws(()=>evaluationSettings({RAWI_TRIAL_DAYS:n}));
 for(const n of ['0','501','NaN'])assert.throws(()=>evaluationSettings({RAWI_TRIAL_MESSAGE_LIMIT:n}));
});
test('Evaluation provisioning preserves owner-edited settings',async()=>{
 let captured;const q=async(_db,sql,params)=>{captured={sql,params};return [{id:'example-plan',active:true,message_limit:45}]};
 const p=await ensureEvaluationPlan({},q,evaluationSettings({RAWI_TRIAL_MESSAGE_LIMIT:'30'}));
 assert.equal(p.id,'example-plan');
 assert.match(captured.sql,/ON CONFLICT\(code\) DO UPDATE SET code=EXCLUDED.code/);
 assert.match(captured.sql,/price_halalas,message_limit,active/);
 assert.deepEqual(captured.params,[30]);
});
test('Disabled evaluation plan blocks registration instead of creating unusable subscriptions',async()=>{
 await assert.rejects(()=>ensureEvaluationPlan({},async()=>[{id:'p',active:false}],evaluationSettings({})),/disabled/);
});
test('Login and registration throttles use atomic upserts and never write raw email or IP',async()=>{
 let captured;const query=async(_db,sql,params)=>{captured={sql,params};return [{hits:13,expires_at:'tomorrow'}]};
 const secret='a'.repeat(48);const result=await enforceAuthLimit({},query,secret,'192.0.2.17','login','PrivateUser@Example.com');
 assert.equal(result.allowed,false);
 assert.match(captured.sql,/ON CONFLICT\(client_key,bucket\) DO UPDATE/);
 assert.match(captured.sql,/RETURNING hits,expires_at/);
 assert.ok(!JSON.stringify(captured.params).includes('PrivateUser'));
 assert.ok(!JSON.stringify(captured.params).includes('192.0.2.17'));
 assert.equal(captured.params[1],'login');
 await assert.rejects(()=>enforceAuthLimit({},query,'x','192.0.2.17','login'),/secret/);
});
