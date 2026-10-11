import test from 'node:test';
import assert from 'node:assert/strict';
import {basicBusinessPlan,normalizeBusinessPlan,generateBusinessPlan} from './rawi-business-setup.js';

test('Arabic and English business activities choose only existing ERP sections',()=>{
 const contracting=basicBusinessPlan('شركتنا','مقاولات وتركيب ملاعب','ar');
 assert.equal(contracting.sections[0],'projects');
 assert.ok(contracting.sections.includes('purchases'));
 assert.ok(contracting.sections.includes('inventory'));
 const retail=basicBusinessPlan('Store','Retail sales','en');
 assert.equal(retail.sections[0],'inventory');
 assert.ok(retail.sections.includes('sales'));
 assert.ok(!retail.sections.includes('fake-inventory'));
});
test('AI response can reorder actual modules but cannot invent new departments',()=>{
 const input={sector:'Contracting',summary:'Contracting and installation workflows.',sections:['projects','fake-department','purchases','projects','inventory'],workflows:['Track project costs']};
 const normalized=normalizeBusinessPlan(input,'Company','construction','en');
 assert.deepEqual(normalized.sections,['projects','purchases','inventory']);
 assert.equal(normalizeBusinessPlan({...input,sections:['invented']},'Company','construction','en'),null);
});
test('AI plan is genuinely marked AI only after a valid AI provider response',async()=>{
 const output=await generateBusinessPlan('BuildCo','Contracting','en',[{code:'openai'}],async()=>({answer:'{"sector":"Construction","summary":"Project-oriented ERP.","sections":["projects","purchases","inventory"],"workflows":["Monitor project material costs"]}'}));
 assert.equal(output.source,'ai');assert.equal(output.sections[0],'projects');
 const fallback=await generateBusinessPlan('BuildCo','Contracting','en',[],async()=>{throw Error('Should not call AI')});
 assert.equal(fallback.source,'basic');
 const bad=await generateBusinessPlan('BuildCo','Contracting','en',[{code:'openai'}],async()=>({answer:'NOT JSON'}));
 assert.equal(bad.source,'basic');
});
