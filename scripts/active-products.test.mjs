import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {MIF_PRODUCTS,MIF_PRODUCT_GROUPS} from '../src/mif-product-catalog.js';
import {surfacePolicy} from '../worker/surface-policy.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('exact seven MIF products, but only RAWI ERP is active',()=>{
 assert.equal(MIF_PRODUCT_GROUPS.length,3);
 assert.deepEqual(MIF_PRODUCTS.map(p=>p.slug),['rawi-erp','rawi-dev','rawi-copilot','odoo-community','odoo-saas','odoo-my-saas','marketing']);
 assert.deepEqual(MIF_PRODUCTS.filter(p=>p.active).map(p=>p.slug),['rawi-erp']);
 assert.ok(MIF_PRODUCTS.filter(p=>!p.active).every(p=>!p.app_url));
 assert.match(read('src/MifCompany.jsx'),/p\.active\?'a':'div'/);
 assert.match(read('src/MifCompany.jsx'),/قريباً/);
});
test('only MIF control plane and RAWI ERP have a functional application entry',()=>{
 const list=['src/entry-mif.jsx','src/entry-enterprise.jsx'];
 for(const name of list)assert.ok(existsSync(new URL('../'+name,import.meta.url)));
 for(const name of ['src/entry-developer.jsx','src/RawiDeveloperApp.jsx','api/rawi-developer.js','public/developer/sw.js','apps/developer-desktop/main.mjs'])
  assert.ok(!existsSync(new URL('../'+name,import.meta.url)),name+' must not exist');
 const build=read('scripts/build-surfaces.mjs');
 assert.match(build,/surfaces=\['enterprise','mif'\]/);
 const inactive=JSON.parse(read('wrangler.developer.jsonc'));
 assert.equal(inactive.main,'worker/coming-soon.js');
 assert.ok(!inactive.assets);
});
test('inactive product Worker and routes never serve runnable customer code',()=>{
 assert.deepEqual(surfacePolicy('developer','/developer/'),{status:404});
 assert.deepEqual(surfacePolicy('developer','/api/admin/login','POST'),{status:404});
 assert.deepEqual(surfacePolicy('enterprise','/api/admin/developer/connections','GET'),{status:404});
 assert.deepEqual(surfacePolicy('mif','/developer/'),{status:404});
 assert.match(read('worker/coming-soon.js'),/status:404/);
});
test('RAWI ERP approved blue chat layout and account-only installation are frozen',()=>{
 const source=read('src/MifSmartShell.jsx');
 const brand=read('public/rawi-erp-mark.svg');
 const pwa=JSON.parse(read('public/manifest.webmanifest'));
 assert.match(brand,/fill="#2166e8"/);
 assert.match(brand,/<path fill="#ffffff"/);
 assert.equal(pwa.theme_color,'#2166e8');
 assert.equal(pwa.short_name,'RAWI ERP');
 assert.match(source,/function RawiGreeting/);
 assert.match(source,/كيف أقدر أساعدك اليوم؟/);
 assert.match(source,/setInterval/);
 for(const key of ['chats','operations','new','schedule','account'])assert.match(source,new RegExp("'"+key+"'"));
 assert.match(source,/rawi-install-in-account/);
 assert.doesNotMatch(source,/RawiDevelopers|GuestPreview|MIF ERP/);
});
