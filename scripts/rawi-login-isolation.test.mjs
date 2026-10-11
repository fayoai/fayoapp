import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {surfacePolicy} from '../worker/surface-policy.js';
test('first owner bootstrap is accessible only in MIF SaaS',()=>{
 assert.equal(surfacePolicy('mif','/api/admin/bootstrap','POST'),null);
 for(const x of ['enterprise','developer'])assert.deepEqual(surfacePolicy(x,'/api/admin/bootstrap','POST'),{status:404});
 const source=readFileSync(new URL('../api/app.js',import.meta.url),'utf8');
 assert.match(source,/ownerEmail/);
 assert.match(source,/v\.data\.email\.toLowerCase\(\)!==ownerEmail/);
});
test('RAWI backend rejects cross-application login and sessions',()=>{
 const src=readFileSync(new URL('../api/app.js',import.meta.url),'utf8');
 assert.match(src,/profiles\[0\]\?\.account_type!==surface/);
 assert.match(src,/Registration type does not match this RAWI application/);
 assert.match(src,/Application account mismatch/);
 assert.match(src,/This sign-in is reserved for MIF Smart management/);
});
