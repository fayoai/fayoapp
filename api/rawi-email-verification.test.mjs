import test from 'node:test';
import assert from 'node:assert/strict';
import {createSixDigitCode,hashVerificationCode,mailReady} from './rawi-email-verification.js';
test('Six-digit email codes are generated randomly and never stored as plaintext',async()=>{
 const secret='x'.repeat(48),email='person@example.com';
 for(let i=0;i<20;i++)assert.match(createSixDigitCode(),/^[0-9]{6}$/);
 const hash=await hashVerificationCode(secret,email,'012345');
 assert.match(hash,/^[a-f0-9]{64}$/);
 assert.notEqual(hash,await hashVerificationCode(secret,email,'012346'));
 assert.notEqual(hash,await hashVerificationCode(secret,'different@example.com','012345'));
});
test('Verification email registration requires an email sending service',()=>{
 assert.equal(mailReady({}),false);
 assert.equal(mailReady({RESEND_API_KEY:'demo'.repeat(8),EMAIL_FROM:'sender@example.com'}),true);
});
