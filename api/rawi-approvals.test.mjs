import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installRawiApprovals} from './rawi-approvals.js';

const workspace='11111111-1111-4111-8111-111111111111';
const actor='22222222-2222-4222-8222-222222222222';
const approval='33333333-3333-4333-8333-333333333333';
const thread='44444444-4444-4444-8444-444444444444';
const base='/api/admin/erp/w/'+workspace+'/approvals';
function harness(role='owner'){
 const app=new Hono(),statements=[];
 let row={id:approval,workspace_id:workspace,repository_key:'rawi_ai_approvals',stage:'بانتظار الموافقة',
 source_thread_id:thread,created_at:'2026-10-13T10:00:00Z',updated_at:'2026-10-13T10:00:00Z',
 values_json:{target_repository_key:'std_opportunities',request:{values:{field_1:'فرصة جديدة'},stage:'مسودة'},rawi_command_fingerprint:'abc',source_thread_id:thread,original_instruction:'أنشئ فرصة جديدة'}};
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',actor);await next()});
 const query=async(_sql,statement,params=[])=>{
  statements.push({statement,params});
  if(statement.includes('SELECT role FROM erp_memberships'))return [{role}];
  if(statement.includes('FROM rawi_dynamic_records WHERE workspace_id=$1 AND (repository_key='))return [row];
  if(statement.includes('SELECT id,repository_key,stage,values_json,source_thread_id FROM rawi_dynamic_records'))return [row];
  if(statement.includes("UPDATE rawi_dynamic_records SET stage='مرفوض'")){
   if(row.stage!=='بانتظار الموافقة')return [];
   row={...row,stage:'مرفوض'};return [{id:approval}];
  }
  if(statement.includes("UPDATE rawi_dynamic_records SET repository_key=$4")){
   if(row.repository_key!=='rawi_ai_approvals'||row.stage!=='بانتظار الموافقة')return [];
   row={...row,repository_key:params[3],stage:'مسودة',values_json:JSON.parse(params[4])};
   return [row];
  }
  return [];
 };
 installRawiApprovals(app,{db:()=>({}),env:c=>c.env||{},query,centralDb:()=>({})});
 const req=(path,options={})=>app.request('http://localhost'+path,options,{MIF_APP_SURFACE:'enterprise'});
 return {req,statements,get:()=>row};
}
test('AI requests remain segregated from their destination until user approval',async()=>{
 const h=harness();
 const before=await (await h.req(base)).json();
 assert.equal(before.data.length,1);
 assert.equal(before.data[0].status,'pending');
 assert.equal(h.get().repository_key,'rawi_ai_approvals');
 const approved=await h.req(base+'/'+approval+'/approve',{method:'POST'});
 assert.equal(approved.status,200,await approved.clone().text());
 assert.equal(h.get().repository_key,'std_opportunities');
 assert.equal(h.get().values_json.field_1,'فرصة جديدة');
 assert.ok(h.get().values_json.rawi_ai_approved_at);
 const second=await h.req(base+'/'+approval+'/approve',{method:'POST'});
 assert.equal(second.status,409);
});
test('rejected AI operation cannot be published into a repository',async()=>{
 const h=harness();
 assert.equal((await h.req(base+'/'+approval+'/reject',{method:'POST'})).status,200);
 assert.equal(h.get().repository_key,'rawi_ai_approvals');
 assert.equal((await h.req(base+'/'+approval+'/approve',{method:'POST'})).status,409);
});
test('viewer can see requests but cannot approve or reject',async()=>{
 const h=harness('viewer');
 assert.equal((await h.req(base)).status,200);
 assert.equal((await h.req(base+'/'+approval+'/approve',{method:'POST'})).status,403);
 assert.equal((await h.req(base+'/'+approval+'/reject',{method:'POST'})).status,403);
});
