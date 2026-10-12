import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {discoveryGreeting,approvalMessage,installRawiDiscovery} from './rawi-discovery.js';
import {blueprintReady} from './rawi-generated-blueprint.js';
const workspace='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
const proposal={title:'Project Delivery System',sector:'Sports turf installation',summary:'Tracks pitches, material deliveries and installation phases.',
 repositories:[
  {key:'pitches',name:'Sports pitches',description:'Installation sites',fields:[{key:'name',label:'Pitch name',type:'text',required:true},{key:'area',label:'Area',type:'number',required:false}],stages:['Survey','Approved'],relations:[]},
  {key:'turf_jobs',name:'Turf jobs',description:'Installation projects',fields:[{key:'task',label:'Task',type:'text',required:true},{key:'pitch',label:'Pitch',type:'relation',target:'pitches',required:false}],stages:['Pending','Active','Delivered'],relations:[]}
 ],workflows:['Survey site','Deliver materials','Install and hand over']};
function harness(){
 let state={stage:'intro',answers:{},proposal:{},research:[],setup_plan:{}};
 const calls=[],app=new Hono();
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',owner);await next()});
 const query=async(_sql,sql,params=[])=>{
  calls.push({sql,params});
  if(sql.includes('SELECT p.name,p.activity,p.setup_plan,p.setup_inputs,d.workspace_id'))return [{name:'Stadium Works',activity:'Sports turf installation',setup_plan:state.setup_plan,discovery_id:workspace,stage:state.stage,answers:state.answers,proposal:state.proposal,research:state.research}];
  if(sql.includes('SELECT stage,answers,proposal,research FROM rawi_workspace_discovery'))return [state];
  if(sql.includes('SELECT code,model,encrypted_key'))return [];
  if(sql.includes('UPDATE rawi_company_profiles p SET setup_plan=')){state.setup_plan=JSON.parse(params[2]);return [{workspace_id:workspace}]}
  if(sql.includes('UPDATE rawi_workspace_discovery SET stage=')){state={...state,stage:params[2],answers:JSON.parse(params[3]),proposal:JSON.parse(params[4]),research:JSON.parse(params[5])};return []}
  return [];
 };
 const ai={run:async()=>({response:JSON.stringify(proposal)})};
 const discovery=installRawiDiscovery(app,{centralDb:()=>({}),env:c=>c.env||{},query});
 app.post('/api/admin/probe',async c=>{
  const b=await c.req.json();const result=await discovery.respond({c,workspace,user:owner,message:b.message,language:b.language||'ar'});
  return c.json({ok:true,result});
 });
 const env={MIF_APP_SURFACE:'enterprise',AI:ai};
 const request=async(message)=>{const res=await app.request('http://localhost/api/admin/probe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})},env);assert.equal(res.status,200);return (await res.json()).result};
 return {request,app,state:()=>state,calls,env};
}
test('Newly completed company enters a fresh private chat requesting a business overview',()=>{
 const greeting=discoveryGreeting({name:'شركة الملاعب'},'ar');
 assert.match(greeting,/احكي لي بنبذة عن شغلك/);
 assert.equal(approvalMessage('اعتمد التصميم'),true);
 assert.equal(approvalMessage('أحتاج تعديل عرض السعر'),false);
});
test('Business discovery takes several chat turns and does not create program without approval',async()=>{
 const h=harness();
 const r=await h.app.request('http://localhost/api/admin/company/discovery/'+workspace+'?language=ar',{},h.env);
 assert.equal(r.status,200);assert.equal((await r.json()).stage,'intro');
 const first=await h.request('تركيب ملاعب كرة قدم وصيانة أرضياتها للمشاريع والمقاولين');
 assert.equal(first.discovery_stage,'references');assert.equal(blueprintReady(h.state().setup_plan),false);
 const second=await h.request('أفضل أودو في العقود، وواجهة سهلة مثل Monday للمشاريع');
 assert.equal(second.discovery_stage,'processes');assert.match(second.answer,/البحث المباشر/);
 const third=await h.request('عايز عروض أسعار وأوامر بيع، متابعة التوريد والشراء وتكلفة كل مشروع والتسليم');
 assert.equal(third.discovery_stage,'review');assert.match(third.answer,/المقترح الأول/);
 assert.equal(blueprintReady(h.state().setup_plan),false);
 const feedback=await h.request('أضف مراجعة الجودة قبل التسليم');
 assert.equal(feedback.discovery_stage,'review');assert.equal(blueprintReady(h.state().setup_plan),false);
 const approved=await h.request('اعتمد التصميم');
 assert.equal(approved.design_ready,true);assert.equal(approved.discovery_stage,'completed');
 assert.equal(blueprintReady(h.state().setup_plan),true);
 assert.equal(h.state().answers.revisions,'أضف مراجعة الجودة قبل التسليم');
 const after=await h.request('أنشئ عميلًا جديدًا');
 assert.equal(after,null);
});
