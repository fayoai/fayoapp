import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installRawiCompany} from './rawi-company.js';
import {readFileSync} from 'node:fs';
const workspace='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222';
function setup(authorized=true){
 const calls=[],app=new Hono();
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',user);await next()});
 const query=async(_sql,text,args=[])=>{
  calls.push({text,args});
  if(text.includes('SELECT p.setup_plan,p.setup_inputs'))return authorized?[{setup_plan:{},setup_inputs:{},setup_source:'basic',setup_updated_at:null}]:[];
  if(text.includes('SELECT code,model,encrypted_key'))return [];
  if(text.includes("FROM mif_platform_settings"))return [];
  if(text.includes('UPDATE rawi_company_profiles p SET setup_plan'))return [{workspace_id:workspace}];
  return [];
 };
 installRawiCompany(app,{centralDb:()=>({}),env:c=>c.env||{},query});
 const request=body=>app.request('http://localhost/api/admin/company/plan',
 {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},{MIF_APP_SURFACE:'enterprise'});
 return {calls,request};
}
test('Company name and activity produce a persisted industry configuration before full signup completes',async()=>{
 const t=setup();
 const response=await t.request({workspace_id:workspace,name:'مؤسسة التقنية',activity:'مقاولات وتركيب ملاعب',language:'ar'});
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.source,'basic');
 assert.equal(result.plan.sections[0],'projects');
 const saved=t.calls.find(c=>c.text.includes('UPDATE rawi_company_profiles p SET setup_plan'));
 assert.ok(saved);
 assert.equal(JSON.parse(saved.args[2]).sections[0],'projects');
 assert.equal(JSON.parse(saved.args[3]).activity,'مقاولات وتركيب ملاعب');
});
test('Only the authorized company owner can run activity setup',async()=>{
 const t=setup(false);
 const response=await t.request({workspace_id:workspace,name:'مؤسسة التقنية',activity:'مقاولات',language:'ar'});
 assert.equal(response.status,404);
 assert.equal(t.calls.some(c=>c.text.includes('UPDATE rawi_company_profiles p SET setup_plan')),false);
});
test('Onboarding UI previews analysis and operations rearranges existing departments',()=>{
 const jsx=readFileSync(new URL('../src/MifSmartShell.jsx',import.meta.url),'utf8');
 const workspaceUI=readFileSync(new URL('../src/AiErpWorkspace.jsx',import.meta.url),'utf8');
 assert.match(jsx,/\/api\/admin\/company\/plan/);
 assert.match(jsx,/setTimeout\(analyze,1100\)/);
 assert.match(jsx,/className="rawi-business-departments"/);
 assert.match(workspaceUI,/\/api\/admin\/company\/workspace-plan\//);
 assert.match(workspaceUI,/Recommended for your business/);
 assert.match(workspaceUI,/businessPlan\.summary/);
});

test('Previously registered companies receive a saved activity configuration on first workspace visit',async()=>{
 const app=new Hono(),calls=[];
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',user);await next()});
 const query=async(_sql,text,args=[])=>{
  calls.push({text,args});
  if(text.includes('SELECT p.setup_plan,p.setup_source,p.name,p.activity,m.role'))
   return [{setup_plan:{},setup_source:'basic',name:'Construction Group',activity:'Contracting and landscaping',role:'owner'}];
  if(text.includes('SELECT code,model,encrypted_key'))return [];
  return [];
 };
 installRawiCompany(app,{centralDb:()=>({}),env:c=>c.env||{},query});
 const response=await app.request('http://localhost/api/admin/company/workspace-plan/'+workspace+'?language=en',{}, {MIF_APP_SURFACE:'enterprise'});
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.data.sections[0],'projects');
 assert.ok(calls.some(x=>x.text.includes('UPDATE rawi_company_profiles SET setup_plan')));
});
