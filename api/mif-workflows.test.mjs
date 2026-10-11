import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {readFileSync} from 'node:fs';
import {installMifWebsite} from './mif-website.js';
const uid='11111111-1111-4111-8111-111111111111';
function setup(owner){const app=new Hono(),calls=[];app.use('/api/admin/*',async(c,next)=>{c.set('adminId',uid);await next()});installMifWebsite(app,{db:()=>({}),env:c=>c.env||{},query:async(_db,sql,args=[])=>{
 calls.push({sql,args});if(sql.startsWith('SELECT id FROM admins'))return owner?[{id:uid}]:[];
 if(sql.includes('SELECT id FROM changed'))return [{id:uid}];
 if(sql.startsWith('SELECT 1 FROM mif_site_inquiries'))return [{id:uid}];
 return [];
}});return {app,calls}}
const opts=body=>({method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('Only MIF Smart operator can update website inquiry follow-ups',async()=>{
 const {app}=setup(false);const r=await app.request('http://localhost/api/admin/mif/inquiries/'+uid,opts({status:'contacted'}),{PLATFORM_OWNER_EMAIL:'owner@example.com'});
 assert.equal(r.status,403);
});
test('Inquiry updates validate status and follow-up date before database changes',async()=>{
 const {app,calls}=setup(true);for(const body of [{status:'invalid'},{next_action_on:'yesterday'},{internal_note:'x'.repeat(4001)},{external_secret:'x'},{}]){
  const r=await app.request('http://localhost/api/admin/mif/inquiries/'+uid,opts(body),{PLATFORM_OWNER_EMAIL:'owner@example.com'});
  assert.equal(r.status,400,JSON.stringify(body).slice(0,100));
 }
 assert.ok(!calls.some(x=>x.sql.includes('UPDATE mif_site_inquiries')));
});
test('Owner can update lead status, internal note and next follow-up in one audited statement',async()=>{
 const {app,calls}=setup(true),r=await app.request('http://localhost/api/admin/mif/inquiries/'+uid,opts({status:'qualified',internal_note:'Schedule technical demo',next_action_on:'2026-10-18'}),{PLATFORM_OWNER_EMAIL:'owner@example.com'});
 assert.equal(r.status,200);
 const change=calls.find(x=>x.sql.includes('INSERT INTO mif_site_inquiry_events'));
 assert.ok(change);assert.equal(change.args[0],uid);assert.equal(change.args[1],'qualified');assert.equal(change.args[3],true);assert.equal(change.args[4],'2026-10-18');
 assert.equal(change.args[5],uid);
});
test('MIF follow-up event history is private to the platform operator',async()=>{
 const {app}=setup(false),r=await app.request('http://localhost/api/admin/mif/inquiries/'+uid+'/events',{},{PLATFORM_OWNER_EMAIL:'owner@example.com'});
 assert.equal(r.status,403);
});
test('RAWI Enterprise and RAWI Developer original logos remain unchanged',()=>{
 const original=readFileSync(new URL('../public/rawi-mark.svg',import.meta.url),'utf8');
 const developer=readFileSync(new URL('../public/rawi-developer-mark.svg',import.meta.url),'utf8');
 assert.match(original,/fill="#e35a0e"/);assert.match(developer,/fill="#080808"/);assert.match(developer,/fill="#ffd21a"/);
});
test('RAWI signup selects plan only after account type is parsed',()=>{
 const source=readFileSync(new URL('./app.js',import.meta.url),'utf8'),p=source.indexOf("const user=validated.data;"),e=source.indexOf('ensureEvaluationPlan(sql,query,trial,surface)');
 assert.ok(p>0&&e>p,'Account type must be defined before selecting an Enterprise/Developer plan');
});
