import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {readFileSync} from 'node:fs';
import {installRawiCompany} from './rawi-company.js';
const workspace='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
const generated={title:'منصة تشغيل مشروعات الملاعب',sector:'تركيب ملاعب',summary:'متابعة مراحل تركيب الملاعب والمواقع والأعمال.',
 repositories:[
  {key:'sites',name:'المواقع',description:'مواقع التركيب',fields:[{key:'site_name',label:'اسم الموقع',type:'text',required:true},{key:'area',label:'المساحة',type:'number',required:false}],stages:['معاينة','تركيب'],relations:[]},
  {key:'installations',name:'أعمال التركيب',description:'تركيب الأرضيات',fields:[{key:'job',label:'نوع العمل',type:'text',required:true},{key:'site',label:'الموقع',type:'relation',target:'sites',required:true}],stages:['جديد','جارٍ','مكتمل'],relations:[{field:'site',repository:'sites'}]}
 ],workflows:['معاينة الموقع ثم تنفيذ أعمال التركيب']};
function create({allowed=true,ai=true,legacy=false}={}){
 const calls=[],app=new Hono(),settings={MIF_APP_SURFACE:'enterprise',...(ai?{AI:{run:async()=>({response:JSON.stringify(generated)})}}:{})};
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',owner);await next()});
 const query=async(_sql,text,args=[])=>{
  calls.push({text,args});
  if(text.includes('SELECT p.setup_plan,p.setup_inputs'))return allowed?[{setup_plan:{},setup_inputs:{},setup_source:'pending',setup_updated_at:null}]:[];
  if(text.includes('SELECT p.setup_plan,p.setup_source,p.name,p.activity,m.role'))return allowed?[{setup_plan:legacy?{sections:['sales','inventory']}:{},setup_source:'basic',name:'مؤسسة الملاعب',activity:'تركيب ملاعب',role:'owner'}]:[];
  if(text.includes('SELECT code,model,encrypted_key'))return [];
  if(text.includes('UPDATE rawi_company_profiles'))return [{workspace_id:workspace}];
  return [];
 };
 installRawiCompany(app,{centralDb:()=>({}),env:c=>c.env||{},query});
 const request=(path,body)=>app.request('http://local'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{},settings);
 return {calls,request};
}
test('Business name and activity generate actual typed repositories, not a list of static ERP departments',async()=>{
 const t=create();
 const r=await t.request('/api/admin/company/plan',{workspace_id:workspace,name:'مؤسسة الملاعب',activity:'تركيب ملاعب',language:'ar'});
 assert.equal(r.status,200);const body=await r.json();
 assert.equal(body.ready,true);assert.equal(body.source,'ai');
 assert.equal(body.plan.repositories[0].key,'sites');
 assert.equal(body.plan.repositories[1].fields[1].type,'relation');
 assert.equal(body.plan.sections,undefined);
 assert.ok(t.calls.some(x=>x.text.includes('UPDATE rawi_company_profiles')&&JSON.parse(x.args[2]).repositories));
});
test('Workspace blueprint is not invented when model is unavailable',async()=>{
 const t=create({ai:false});
 const r=await t.request('/api/admin/company/plan',{workspace_id:workspace,name:'مؤسسة الملاعب',activity:'تركيب ملاعب'});
 const body=await r.json();assert.equal(body.ready,false);
 assert.equal(body.reason,'ai_not_configured');
 assert.ok(!t.calls.some(x=>x.text.includes('UPDATE rawi_company_profiles')));
});
test('Only authorized owners can generate company-specific workspaces',async()=>{
 const t=create({allowed:false});
 const r=await t.request('/api/admin/company/plan',{workspace_id:workspace,name:'مؤسسة الملاعب',activity:'تركيب ملاعب'});
 assert.equal(r.status,404);
});
test('Legacy company department menus are replaced by AI-authored repository blueprints without deleting data',async()=>{
 const t=create({legacy:true});
 const r=await t.request('/api/admin/company/workspace-plan/'+workspace+'?language=ar');
 assert.equal(r.status,200);
 const body=await r.json();assert.equal(body.ready,true);
 assert.equal(body.data.repositories[0].name,'المواقع');
 assert.equal(body.data.sections,undefined);
 assert.ok(t.calls.some(x=>x.text.includes('UPDATE rawi_company_profiles')));
});
test('Operations UI is generated from industry schema, not a pre-existing list of ERP departments',()=>{
 const shell=readFileSync(new URL('../src/MifSmartShell.jsx',import.meta.url),'utf8');
 const screen=readFileSync(new URL('../src/RawiGeneratedWorkspace.jsx',import.meta.url),'utf8');
 assert.match(shell,/RawiGeneratedWorkspace/);
 assert.match(shell,/\/api\/admin\/company\/plan/);
 assert.match(screen,/blueprint\.repositories/);
 assert.match(screen,/selected\.fields\.map/);
 assert.match(screen,/\/propose/);
 assert.doesNotMatch(screen,/const sections=/);
});
