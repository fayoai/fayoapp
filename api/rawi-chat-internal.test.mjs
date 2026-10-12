import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {installMifChat} from './mif-chat.js';
import {generateWorkspaceBlueprint,blueprintReady} from './rawi-generated-blueprint.js';
import {routeAI} from './ai-router.js';
import {readFileSync} from 'node:fs';

const owner='22222222-2222-4222-8222-222222222222';
const workspace='11111111-1111-4111-8111-111111111111';
const thread='33333333-3333-4333-8333-333333333333';
test('Authenticated Enterprise chat works with existing trial subscription and free Workers AI',async()=>{
 const app=new Hono(),writes=[];
 app.use('/api/admin/*',async(c,next)=>{c.set('adminId',owner);await next()});
 const env={MIF_APP_SURFACE:'enterprise',AI:{run:async(_model,payload)=>{
  assert.match(payload.messages[0].content,/MIF Smart/);
  return {response:'أنا راوي، طورّتني وتديرني شركة MIF Smart. أنا هنا علشان نطور برنامج شركتك سوا.'};
 }}};
 const query=async(db,sql,params=[])=>{
  writes.push({sql,params});
  if(sql.includes('SELECT COUNT(*)::int n FROM mif_chat_messages'))return [{n:0}];
  if(sql.includes('SELECT w.id FROM erp_workspaces'))return [{id:workspace}];
  if(sql.startsWith('WITH target AS'))return [{workspace_id:workspace}];
  if(sql.includes('FROM erp_workspaces w WHERE w.id=$1'))return [{name:'Sports Operations',contacts:0,invoices:0,pending_tasks:0,low_stock:0}];
  if(sql.includes('SELECT p.name,p.activity,p.setup_plan'))return [{name:'Sports Operations',activity:'Sports installation',setup_plan:{}}];
  if(sql.startsWith('INSERT INTO mif_chat_threads'))return [{id:thread}];
  if(sql.includes('SELECT code,model,encrypted_key'))return [];
  return [];
 };
 installMifChat(app,{db:()=>({}),centralDb:()=>({}),env:()=>env,query});
 const response=await app.request('http://localhost/api/admin/chat/send',{method:'POST',
  headers:{'Content-Type':'application/json','Accept-Language':'ar'},
  body:JSON.stringify({question:'انت مين ومين عملك؟',workspace_id:workspace,thread_id:null})});
 assert.equal(response.status,200,await response.text().catch(()=>'')); // response may already be consumed only on failure
 const body=await response.json();assert.equal(body.ok,true);
 assert.match(body.answer,/راوي/);assert.match(body.answer,/MIF Smart/);
 assert.equal(body.provider,'workers_ai');assert.equal(body.thread_id,thread);
 assert.ok(writes.some(x=>x.sql.startsWith('WITH target AS')));
 assert.ok(writes.some(x=>x.sql.startsWith('INSERT INTO mif_chat_threads')));
 assert.ok(writes.some(x=>x.sql.includes('INSERT INTO mif_chat_messages')));
});
test('Lightweight company-specific AI repositories can be generated in two short prompts if full JSON is truncated',async()=>{
 let calls=0;
 const route=async()=>{
  calls++;
  if(calls===1)return {answer:'{"title":"incomplete"',provider:'workers_ai'};
  const n=calls-1;
  return {answer:JSON.stringify({key:'repo_'+n,name:n===1?'مواقع التركيبات':'أعمال التركيب',
   description:'متابعة أعمال ملاعب العملاء',fields:[{key:'title',label:'اسم المهمة',type:'text',required:true},
   {key:'work_date',label:'تاريخ العمل',type:'date',required:false}],stages:['بدء العمل','تم التنفيذ']}),provider:'workers_ai'};
 };
 const generated=await generateWorkspaceBlueprint({name:'ملاعب الرياض',activity:'تركيب ملاعب',description:'أجهز ملاعب وتسليم',language:'ar',
  providers:[{code:'workers_ai'}],routeAI:route});
 assert.equal(generated.ready,true);
 assert.ok(blueprintReady(generated.blueprint));
 assert.equal(generated.blueprint.repositories.length,2);
 assert.equal(generated.provider,'workers_ai');
});
test('Private and public identities name the actual RAWI developer/operator and never invent a personal owner',async()=>{
 let instructions='';
 const binding={run:async(_,payload)=>{instructions=payload.messages[0].content;return {response:'أنا راوي، شركة ميف سمارت طورتني وتديرني.'}}};
 const p=[{code:'workers_ai',model:'@cf/meta/llama-3.1-8b-instruct-fast',binding}];
 await routeAI('مين عملك؟',p,[],'','enterprise');
 assert.match(instructions,/MIF Smart/);
 assert.match(instructions,/Do not invent an individual founder/);
 await routeAI('مين بيدير راوي؟',p,[],'','enterprise-public');
 assert.match(instructions,/MIF Smart/);
});
test('Mobile app has bounded scroll, full-width composer and seven adaptive navigation items',()=>{
 const css=readFileSync(new URL('../src/mif-smart-shell.css',import.meta.url),'utf8');
 assert.match(css,/\.mif-app \.mif-chat-page\{width:100%;max-width:100%/);
 assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(css,/\.mif-app \.mif-chat-scroll\{min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto/);
 assert.match(css,/\.mif-app \.mif-composer textarea\{min-width:0;font-size:16px/);
});
