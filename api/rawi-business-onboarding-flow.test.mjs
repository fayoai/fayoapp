import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {readFileSync} from 'node:fs';
import {installRawiCompany} from './rawi-company.js';
const workspace='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
function create({allowed=true,existing={sections:['sales','inventory']}}={}){
 const calls=[],app=new Hono(),env={MIF_APP_SURFACE:'enterprise',AI:{run:async()=>{throw Error('AI must not run before company discovery')}}};
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',owner);await next()});
 const query=async(_sql,text,args=[])=>{
  calls.push({text,args});
  if(text.includes('SELECT p.setup_plan,p.setup_source,p.name,p.activity,m.role'))return allowed?[{setup_plan:existing,setup_source:'basic',name:'ملعبنا',activity:'تنفيذ ملاعب',role:'owner'}]:[];
  if(text.includes('WITH allowed AS'))return [{workspace_id:workspace}];
  return [];
 };
 installRawiCompany(app,{centralDb:()=>({}),env:c=>c.env||{},query});
 const request=(path,body)=>app.request('http://local'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{},env);
 return {calls,request};
}
test('Company registration does not ask AI to generate anything before the conversation',async()=>{
 const t=create();
 const r=await t.request('/api/admin/company/plan',{workspace_id:workspace,name:'ملعبنا',activity:'ملاعب'});
 assert.equal(r.status,404);
 assert.equal(t.calls.some(x=>x.text.includes('UPDATE rawi_company_profiles')),false);
});
test('Existing unapproved workspace stays pending until customer approves the chat design',async()=>{
 const t=create(),r=await t.request('/api/admin/company/workspace-plan/'+workspace);
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.ready,false);
 assert.equal(body.data.source,'pending');
 assert.equal(body.data.repositories,undefined);
});
test('Unauthorized user cannot read another company blueprint',async()=>{
 const t=create({allowed:false});
 assert.equal((await t.request('/api/admin/company/workspace-plan/'+workspace)).status,404);
});
test('Company form excludes narrative business summary and sends user to new chat',()=>{
 const shell=readFileSync(new URL('../src/MifSmartShell.jsx',import.meta.url),'utf8');
 const screen=readFileSync(new URL('../src/RawiGeneratedWorkspace.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(shell,/L\('نبذة عن النشاط','About the business'\)/);
 assert.match(shell,/setSignupStep\('auth'\);startNew\(\)/);
 assert.match(shell,/\/api\/admin\/company\/discovery\//);
 assert.match(screen,/selected\.fields\.map/);
});
