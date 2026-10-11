import test from 'node:test';import assert from 'node:assert/strict';
import {notifyMifInquiry} from './mif-notifications.js';
test('Website request remains saved even when email provider is not configured',async()=>{
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Must never call external mail without permission')};
 try{const result=await notifyMifInquiry({}, {name:'Company visitor',email:'visitor@example.com'});assert.equal(result.status,'not_configured')}finally{globalThis.fetch=old}
});
test('Configured MIF email delivery calls only the verified Resend endpoint',async()=>{
 const old=globalThis.fetch;let calls;
 globalThis.fetch=async(url,opts)=>{calls={url,opts};return new Response(JSON.stringify({id:'test-id'}),{status:200,headers:{'Content-Type':'application/json'}})};
 try{const result=await notifyMifInquiry({RESEND_API_KEY:'secret-from-server',MAIL_FROM:'MIF Smart <notices@example.com>',MIF_INQUIRY_NOTIFY_EMAIL:'owner@example.com'}, {name:'Test Company',email:'visitor@example.com',message:'Requesting a call'});
 // A verified sender display name is valid for Resend.
 assert.equal(result.status,'sent');
 const direct=await notifyMifInquiry({RESEND_API_KEY:'secret-from-server',MAIL_FROM:'notices@example.com',MIF_INQUIRY_NOTIFY_EMAIL:'owner@example.com'},{name:'Test Company',email:'visitor@example.com',message:'Requesting a call'});
 assert.equal(direct.status,'sent');assert.equal(calls.url,'https://api.resend.com/emails');
 assert.equal(calls.opts.headers.Authorization,'Bearer secret-from-server');
 assert.ok(!JSON.stringify(calls.opts.body).includes('fake_password'));
 }finally{globalThis.fetch=old}
});
test('Mail failure is recorded as failure and does not expose a secret',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:403});
 try{const r=await notifyMifInquiry({RESEND_API_KEY:'server-only-key',MAIL_FROM:'info@example.com',MIF_INQUIRY_NOTIFY_EMAIL:'admin@example.com'}, {name:'Visitor',email:'visitor@example.com'});
 assert.equal(r.status,'failed');assert.ok(!JSON.stringify(r).includes('server-only-key'))}finally{globalThis.fetch=old}
});
