import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {surfacePolicy} from '../worker/surface-policy.js';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('independent Cloudflare Workers for MIF management, Enterprise and Odoo Developer',()=>{
 const configs=['wrangler.jsonc','wrangler.enterprise.jsonc','wrangler.developer.jsonc'].map(p=>JSON.parse(file(p)));
 assert.deepEqual(configs.map(c=>c.name),['mif-smart-platform','rawi-enterprise','rawi-developer']);
 assert.deepEqual(configs.map(c=>c.vars.MIF_APP_SURFACE),['mif','enterprise','developer']);
 assert.ok(configs[0].assets.run_worker_first.includes('/'));
 assert.ok(configs[1].assets.run_worker_first.includes('/api/*'));
 assert.ok(configs[2].assets.run_worker_first.includes('/developer/*'));
});
test('MIF control plane redirects old app routes and excludes tenant APIs',()=>{
 const links={enterprise:'https://rawi-enterprise.example.workers.dev',developer:'https://rawi-developer.example.workers.dev'};
 assert.deepEqual(surfacePolicy('mif','/','GET',links),{status:302,location:'/mif'});
 assert.deepEqual(surfacePolicy('mif','/developer/','GET',links),{status:302,location:links.developer+'/developer/'});
 assert.deepEqual(surfacePolicy('mif','/api/admin/erp/workspaces'),{status:404});
 assert.deepEqual(surfacePolicy('mif','/api/admin/register','POST'),{status:404});
 assert.equal(surfacePolicy('mif','/mif/console'),null);
 assert.equal(surfacePolicy('mif','/api/admin/mif/settings'),null);
});
test('Enterprise and Developer Workers do not expose each other applications or SaaS',()=>{
 for(const surface of ['enterprise','developer']){
  assert.deepEqual(surfacePolicy(surface,'/api/admin/platform/tenants'),{status:404});
  assert.deepEqual(surfacePolicy(surface,'/mif/console'),{status:404});
  assert.equal(surfacePolicy(surface,'/api/admin/login','POST'),null);
 }
 assert.deepEqual(surfacePolicy('enterprise','/developer/'),{status:404});
 assert.equal(surfacePolicy('enterprise','/api/admin/erp/w/any/core/items'),null);
 assert.deepEqual(surfacePolicy('developer','/api/admin/erp/w/any/core/items'),{status:404});
 assert.equal(surfacePolicy('developer','/api/admin/developer/w/any/connections'),null);
 assert.deepEqual(surfacePolicy('developer','/'),{status:302,location:'/developer/'});
 assert.equal(surfacePolicy('developer','/developer/'),null);
});
test('independent apps retain branding and MIF owner bootstrap remains on company only',()=>{
 const company=file('src/MifCompany.jsx'),worker=file('worker/index.js'),ci=file('.github/workflows/deploy.yml');
 assert.match(company,/isSetup\?<MifOwnerSetup\/>/);
 assert.match(company,/rawi-enterprise\.fayosaas\.workers\.dev/);
 assert.match(company,/rawi-developer\.fayosaas\.workers\.dev/);
 assert.match(worker,/surfacePolicy/);
 assert.match(ci,/wrangler\.enterprise\.jsonc wrangler\.developer\.jsonc wrangler\.jsonc/);
 assert.doesNotMatch(ci,/--temporary/);
});
