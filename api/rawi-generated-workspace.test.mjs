import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {validateGeneratedBlueprint,blueprintReady,validateRepositoryRecord,generateWorkspaceBlueprint} from './rawi-generated-blueprint.js';
import {installRawiDynamicWorkspace} from './rawi-dynamic-workspace.js';
const workspace='11111111-1111-4111-8111-111111111111',actor='22222222-2222-4222-8222-222222222222',thread='33333333-3333-4333-8333-333333333333';
const draft={title:'Airfield inspection system',sector:'Aviation inspection',summary:'Manage runway condition inspections and repair cases.',
 repositories:[
  {key:'runways',name:'Runway assets',description:'Airfield runways',fields:[{key:'code',label:'Runway code',type:'text',required:true},{key:'length',label:'Length in meters',type:'number',required:false}],stages:['Inspected','Needs repair'],relations:[]},
  {key:'repair_cases',name:'Runway repairs',description:'Repairs following an inspection',fields:[{key:'title',label:'Repair case title',type:'text',required:true},{key:'runway',label:'Runway reference',type:'relation',target:'runways',required:false}],stages:['Open','Scheduled','Completed'],relations:[{field:'runway',repository:'runways'}]}
 ],workflows:['Inspect each runway and register repair cases']};
const plan=validateGeneratedBlueprint(draft);
function harness({role='owner',owner=true}={}){
 const app=new Hono(),sqlLog=[];
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',actor);await next()});
 const query=async(_sql,q,params=[])=>{
  sqlLog.push({q,params});
  if(q.includes('SELECT role FROM erp_memberships'))return role?[{role}]:[];
  if(q.includes('SELECT p.setup_plan,p.setup_inputs,p.name,p.activity'))return owner?[{setup_plan:plan,setup_inputs:{discovery:true},name:'Airfield Ops',activity:'Aviation inspection'}]:[];
  if(q.includes('SELECT id FROM mif_chat_threads'))return [{id:thread}];
  if(q.includes('INSERT INTO rawi_dynamic_records'))return [{id:thread,values_json:JSON.parse(params[2]),stage:params[3]}];
  if(q.includes('SELECT id,repository_key,values_json,stage,source_thread_id'))return [];
  return [];
 };
 installRawiDynamicWorkspace(app,{db:()=>({}),centralDb:()=>({}),env:c=>c.env||{},query});
 const request=(url,opt={})=>app.request('http://local'+url,opt,{MIF_APP_SURFACE:'enterprise'});
 return {request,sqlLog};
}
test('AI can produce domain-specific repositories without an allowlist of generic ERP departments',()=>{
 assert.ok(blueprintReady(plan));
 assert.equal(plan.repositories[0].key,'runways');
 assert.deepEqual(plan.repositories.map(x=>x.key),['runways','repair_cases']);
 assert.equal(validateRepositoryRecord(plan.repositories[0],{code:'12L',length:2400}).length,2400);
 assert.equal(validateRepositoryRecord(plan.repositories[0],{unknown:'value'}),null);
 assert.equal(validateRepositoryRecord(plan.repositories[0],{length:20}),null);
 assert.equal(validateGeneratedBlueprint({...draft,repositories:[draft.repositories[0],draft.repositories[0]]}),null);
});
test('Unconfigured AI does not pretend to generate a company program',async()=>{
 const result=await generateWorkspaceBlueprint({name:'Airfield',activity:'Aviation inspection',providers:[],routeAI:async()=>{throw Error('Unexpected call')}});
 assert.equal(result.ready,false);assert.equal(result.blueprint,null);
});
test('Generated business repositories are visible only to company members',async()=>{
 const ok=harness(),r=await ok.request('/api/admin/erp/w/'+workspace+'/dynamic/blueprint');
 assert.equal(r.status,200);assert.equal((await r.json()).data.repositories[0].key,'runways');
 assert.equal((await harness({role:null}).request('/api/admin/erp/w/'+workspace+'/dynamic/blueprint')).status,404);
 assert.equal((await harness({owner:false}).request('/api/admin/erp/w/'+workspace+'/dynamic/blueprint')).status,404);
});
test('Valid custom record is tenant-isolated and source chat ownership is checked',async()=>{
 const h=harness(),path='/api/admin/erp/w/'+workspace+'/dynamic/runways/records';
 const r=await h.request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:{code:'12L',length:2400},stage:'Inspected',source_thread_id:thread})});
 assert.equal(r.status,201);
 const insert=h.sqlLog.find(x=>x.q.includes('INSERT INTO rawi_dynamic_records'));
 assert.deepEqual(insert.params.slice(0,2),[workspace,'runways']);
 const bad=await h.request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:{code:'12L'},stage:'Not a valid stage'})});
 assert.equal(bad.status,400);
 assert.equal((await harness({role:'viewer'}).request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:{code:'12L'}})})).status,403);
});
