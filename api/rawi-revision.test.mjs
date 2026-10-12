import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApprovedDesignRevision,designChangeRequested} from './rawi-revision.js';
import {generateWorkspaceBlueprint,validateGeneratedBlueprint} from './rawi-generated-blueprint.js';

const workspace='11111111-1111-4111-8111-111111111111';
const user='22222222-2222-4222-8222-222222222222';
const original=validateGeneratedBlueprint({
 title:'Sports operations',sector:'Sports',summary:'Manage installation workflows',
 repositories:[{key:'projects',name:'Projects',description:'Work orders',fields:[
  {key:'title',label:'Project title',type:'text',required:true},{key:'site',label:'Site name',type:'text',required:false}],
  stages:['Open','Done'],relations:[]},{key:'materials',name:'Materials',description:'Material orders',fields:[
  {key:'name',label:'Material name',type:'text',required:true},{key:'quantity',label:'Quantity',type:'number',required:false}],
  stages:['Open','Done'],relations:[]}],workflows:['Supply materials']
});
const revision=validateGeneratedBlueprint({
 ...original,repositories:[...original.repositories,{
  key:'inspection',name:'Inspection records',description:'On-site testing',fields:[
   {key:'summary',label:'Inspection summary',type:'text',required:true},{key:'date',label:'Inspection date',type:'date',required:false}],
   stages:['Planned','Completed'],relations:[]}]
});
const call=async({stage='completed',message='عدل مستودعات المشاريع',existing=original,proposal=revision,used=[]}={})=>{
 const writes=[],tenant={};
 const query=async(_db,sql,params=[])=>{
  writes.push({sql,params});
  if(sql.includes('SELECT m.content FROM mif_chat_messages'))return [];
  if(sql.includes('SELECT DISTINCT repository_key'))return used;
  if(sql.includes('UPDATE rawi_company_profiles'))return [{workspace_id:workspace}];
  return [];
 };
 const result=await handleApprovedDesignRevision({
  c:{get:k=>k==='tenantSQL'?tenant:null},
  company:{name:'Sports Installers',activity:'Install sports pitches',description:'Outdoor courts',setup_plan:existing},
  current:{stage,proposal,answers:{overview:'Construction projects and material deliveries'}},
  workspace,user,message,language:'ar',central:{},settings:{},query,
  providers:async()=>[{code:'stub'}],design:async()=>({ready:true,blueprint:revision})
 });
 return {result,writes};
};
test('Design revisions are not triggered by ordinary questions',async()=>{
 assert.equal(designChangeRequested('كم سعر هذا المنتج؟'),false);
 assert.equal((await call({message:'كيف حالك اليوم؟'})).result,null);
});
test('Approved company can request a new preview without overwriting its stored plan',async()=>{
 const x=await call();
 assert.match(x.result.answer,/لم يُنشر/);
 assert.ok(x.writes.some(e=>e.sql.includes("stage='revision_review'")));
 assert.equal(x.writes.some(e=>e.sql.includes('UPDATE rawi_company_profiles')),false);
});
test('Revision approval cannot remove a populated field or repository',async()=>{
 const x=await call({stage:'revision_review',message:'اعتمد التصميم',
  proposal:validateGeneratedBlueprint({...original,repositories:[original.repositories[1],revision.repositories[2]]}),
  used:[{repository_key:'projects',field_key:'title'}]});
 assert.match(x.result.answer,/حماية البيانات/);
 assert.equal(x.writes.some(e=>e.sql.includes('UPDATE rawi_company_profiles')),false);
});
test('Explicit approval saves a compatible revised plan',async()=>{
 const x=await call({stage:'revision_review',message:'اعتمد التصميم',used:[{repository_key:'projects',field_key:'title'}]});
 assert.match(x.result.answer,/اعتمدت التعديل/);
 assert.ok(x.writes.some(e=>e.sql.includes('UPDATE rawi_company_profiles')));
});
test('A richer generated plan has independent repositories and real record fields',async()=>{
 const entities=['projects','materials','inspections','deliveries'];
 const routeAI=async(prompt)=>{
  if(prompt.includes('enterprise analyst')){
   return {answer:JSON.stringify({title:'Installers workspace',sector:'Construction',summary:'Manage sports project installations',
    repositories:entities.map(x=>({key:x,name:x+' records',description:'Manage '+x})),workflows:['Plan delivery','Complete installation']})};
  }
  const item=entities.find(x=>prompt.includes('"key":"'+x+'"'))||entities[0];
  return {answer:JSON.stringify({key:item,name:item+' records',description:'Manage '+item,
   fields:[{key:'title',label:'Record title',type:'text',required:true},{key:'reference',label:'Reference code',type:'text',required:false},
    {key:'quantity',label:'Quantity',type:'number',required:false},{key:'date',label:'Record date',type:'date',required:false}],stages:['Open','Closed']})};
 };
 const res=await generateWorkspaceBlueprint({name:'Installers',activity:'Sports courts construction',
  description:'Projects, materials, on-site inspections and delivery records',language:'en',providers:[{code:'stub'}],routeAI});
 assert.equal(res.ready,true);
 assert.equal(res.blueprint.repositories.length,4);
 assert.ok(res.blueprint.repositories.every(x=>x.fields.length===4));
});
