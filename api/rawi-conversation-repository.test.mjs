import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installAiErp} from './ai-erp.js';
import {readFileSync} from 'node:fs';
const workspace='11111111-1111-4111-8111-111111111111';
const owner='22222222-2222-4222-8222-222222222222';
const chat='33333333-3333-4333-8333-333333333333';
function appFor(role='owner'){
 const app=new Hono(),requests=[];
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',owner);await next()});
 const query=async(sql,statement,args=[])=>{
  requests.push({statement,args});
  if(statement.includes('SELECT role FROM erp_memberships'))return role?[{role}]:[];
  if(statement.includes('FROM mif_chat_threads t WHERE t.workspace_id='))return [{id:chat,title:'Project kickoff',message_count:2,latest_answer:'Plan ready'}];
  if(statement.includes('FROM erp_knowledge WHERE workspace_id=$1 ORDER BY'))return [];
  if(statement.includes('SELECT\n    (SELECT count(*)'))return [{open_tasks:1,invoices:0,contacts:2,projects:1}];
  if(statement.includes('FROM mif_chat_threads t WHERE t.id=$1'))return [{title:'Project kickoff',latest_answer:'Plan ready'}];
  if(statement.includes('INSERT INTO erp_knowledge'))return [{id:chat,title:'Project kickoff'}];
  return [];
 };
 installAiErp(app,{db:()=>({}),env:c=>c.env||{},query});
 return {app,requests};
}
test('Repository lists only conversations owned by the authenticated member in the current workspace',async()=>{
 const t=appFor();
 const res=await t.app.request('http://local/api/admin/erp/w/'+workspace+'/repository');
 assert.equal(res.status,200);
 const data=(await res.json()).data;
 assert.equal(data.threads[0].title,'Project kickoff');
 const read=t.requests.find(x=>x.statement.includes('FROM mif_chat_threads t WHERE t.workspace_id='));
 assert.deepEqual(read.args,[workspace,owner]);
 assert.match(read.statement,/t\.owner_id=\$2/);
});
test('Saving chat outcome to knowledge requires owner membership and exact thread ownership',async()=>{
 const t=appFor();
 const res=await t.app.request('http://local/api/admin/erp/w/'+workspace+'/repository/save-thread',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({thread_id:chat})});
 assert.equal(res.status,200);
 const saved=t.requests.find(x=>x.statement.includes('INSERT INTO erp_knowledge'));
 assert.deepEqual(saved.args,[workspace,'Project kickoff','Plan ready']);
 const lookup=t.requests.find(x=>x.statement.includes('FROM mif_chat_threads t WHERE t.id=$1'));
 assert.deepEqual(lookup.args,[chat,workspace,owner]);
 const visitor=appFor('viewer');
 const denied=await visitor.app.request('http://local/api/admin/erp/w/'+workspace+'/repository/save-thread',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({thread_id:chat})});
 assert.equal(denied.status,403);
});
test('No repository access is given without verified membership; admin is its own MIF-only route',async()=>{
 const t=appFor(null);
 const res=await t.app.request('http://local/api/admin/erp/w/'+workspace+'/repository');
 assert.equal(res.status,404);
 const policy=readFileSync(new URL('../worker/surface-policy.js',import.meta.url),'utf8');
 const company=readFileSync(new URL('../src/MifCompany.jsx',import.meta.url),'utf8');
 assert.match(policy,/is\(path,'\/admin'\)/);
 assert.doesNotMatch(company,/href="\/mif\/console\/products"/);
 const workspaceUi=readFileSync(new URL('../src/AiErpWorkspace.jsx',import.meta.url),'utf8');
 assert.match(workspaceUi,/rawi-workspace-more/);
 assert.match(workspaceUi,/tab==='repository'/);
});
