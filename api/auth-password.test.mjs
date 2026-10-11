import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync} from 'node:crypto';
import {passwordHash,PASSWORD_HASH_ITERATIONS} from './auth-password.js';

test('RAWI passwords use Worker-supported PBKDF2-HMAC-SHA256 100000 iteration format',async()=>{
 assert.equal(PASSWORD_HASH_ITERATIONS,100000);
 const password='MySecurePass#2026',salt='93ac6d23-eeda-4836-85bb-d0befbe760b4';
 const derived=await passwordHash(password,salt);
 const original=pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');
 assert.equal(derived,original);
 assert.match(derived,/^[0-9a-f]{64}$/);
});
test('Changing the salt or password changes the derived hash',async()=>{
 const base=await passwordHash('example-long-password','salt-1');
 assert.notEqual(base,await passwordHash('example-long-password','salt-2'));
 assert.notEqual(base,await passwordHash('different-password','salt-1'));
});
