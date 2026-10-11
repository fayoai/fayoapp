import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {buildOdooModule,moduleInput} from './rawi-module-builder.js';
import {odooRead,checkOdoo,installRawiDeveloper} from './rawi-developer.js';
const owner='11111111-1111-4111-8111-111111111111';
const example={technical_name:'rawi_asset',display_name:'Asset Tracker',model_name:'asset',odoo_version:'19',fields:[{name:'serial_number',label:'Serial Number',type:'Char'},{name:'cost',label:'Cost',type:'Float'}]};
test('Generated Odoo ZIP contains a real valid ZIP structure and addon files',()=>{
 const bytes=buildOdooModule(example),value=Buffer.from(bytes);
 assert.equal(value.readUInt32LE(0),0x04034b50);
 assert.equal(value.readUInt32LE(value.length-22),0x06054b50);
 for(const name of ['rawi_asset/__manifest__.py','rawi_asset/models/models.py','rawi_asset/views/records.xml','rawi_asset/security/ir.model.access.csv'])assert.ok(value.includes(Buffer.from(name)),name);
 assert.ok(value.includes(Buffer.from('model_rawi_asset_asset')));
 assert.ok(value.includes(Buffer.from('<list string=')));
});
test('Module input blocks Python/XML identifiers and duplicated fields',()=>{
 for(const invalid of [{...example,technical_name:'../malicious'}, {...example,display_name:'A',fields:example.fields},{...example,fields:[example.fields[0],example.fields[0]]},{...example,fields:[{name:'__import__',label:'Bad',type:'Python'}]}])assert.equal(moduleInput.safeParse(invalid).success,false);
 assert.ok(buildOdooModule({...example,odoo_version:'17'}).length>500);
});
test('Odoo JSON-2 connector only performs safe read-only requests',async()=>{
 const fetchOld=globalThis.fetch;let called;
 globalThis.fetch=async(url,opt)=>{called={url,opt};return new Response(JSON.stringify([{id:1,name:'Test'}]),{headers:{'Content-Type':'application/json'}})};
 try{const r=await odooRead({base_url:'https://odoo.example.com',database_name:'production',api_version:'json2'},'SECRET_KEY','res.partner',['name'],3);
 assert.equal(r[0].name,'Test');assert.equal(called.url,'https://odoo.example.com/json/2/res.partner/search_read');
 assert.equal(called.opt.headers['X-Odoo-Database'],'production');assert.equal(called.opt.headers.Authorization,'bearer SECRET_KEY');assert.equal(called.opt.redirect,'error');
 }finally{globalThis.fetch=fetchOld}
});
test('Legacy Odoo JSON-RPC adapter authenticates before querying model data',async()=>{
 const fetchOld=globalThis.fetch;const methods=[];
 globalThis.fetch=async(url,opt)=>{const req=JSON.parse(opt.body);methods.push(req.params.method);return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:req.params.method==='authenticate'?2:[{name:'base',state:'installed'}]}),{headers:{'Content-Type':'application/json'}})};
 try{const r=await odooRead({base_url:'https://erp.example.com',database_name:'odoo17',api_version:'jsonrpc',login:'dev@example.com'},'SERVER_SECRET','ir.module.module',['name','state'],1);
 assert.equal(r[0].name,'base');assert.deepEqual(methods,['authenticate','execute_kw'])}finally{globalThis.fetch=fetchOld}
});
test('Odoo remote access rejects unsafe hosts and arbitrary models',async()=>{
 await assert.rejects(()=>odooRead({base_url:'http://localhost:8069',database_name:'odoo',api_version:'json2'},'key','res.partner'),/HTTPS/);
 await assert.rejects(()=>odooRead({base_url:'https://erp.example.com',database_name:'odoo',api_version:'json2'},'key','ir.config_parameter'),/Unsupported/);
});
test('Enterprise accounts cannot access Developer-only Odoo connection APIs',async()=>{
 const app=new Hono();app.use('/api/admin/*',async(c,next)=>{c.set('adminId',owner);await next()});
 installRawiDeveloper(app,{db:()=>({}),env:()=>({}),query:async()=>[]});
 const r=await app.request('https://app.example.com/api/admin/developer/w/'+owner+'/connections');
 assert.equal(r.status,403);
});
