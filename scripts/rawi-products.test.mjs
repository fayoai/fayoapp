import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const root=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('RAWI Enterprise original orange logo and manifest stay untouched',()=>{
 const logo=root('public/rawi-mark.svg'),manifest=JSON.parse(root('public/manifest.webmanifest'));
 assert.match(logo,/fill="#e35a0e"/);assert.match(logo,/fill="#ffffff"/);
 assert.equal(manifest.id,'/');assert.equal(manifest.theme_color,'#e35a0e');assert.equal(manifest.start_url,'/');
});
test('Developer uses identical approved symbol in distinct black and yellow identity',()=>{
 const original=root('public/rawi-mark.svg'),developer=root('public/rawi-developer-mark.svg');
 assert.equal(developer.replace('RAWI Developer','RAWI assistant').replace('fill="#080808"','fill="#e35a0e"').replace('fill="#ffd21a"','fill="#ffffff"'),original);
 assert.match(developer,/fill="#080808"/);assert.match(developer,/fill="#ffd21a"/);
});
test('Developer and Enterprise are separate installable PWA identities with independent service workers',()=>{
 const e=JSON.parse(root('public/manifest.webmanifest')),d=JSON.parse(root('public/developer/manifest.webmanifest'));
 assert.notEqual(e.id,d.id);assert.equal(d.id,'/developer/');assert.equal(d.start_url,'/developer/');
 assert.equal(d.scope,'/developer/');assert.equal(d.theme_color,'#ffd21a');
 assert.ok(d.icons.every(x=>x.src==='/rawi-developer-mark.svg'));
 assert.match(root('src/main.jsx'),/developer\/sw\.js/);
 assert.match(root('public/developer/sw.js'),/startsWith\('\/api\/'\)/);
});
test('Developer route has dedicated UI while Enterprise no longer imports Odoo developer console',()=>{
 const app=root('src/App.jsx'),enterprise=root('src/MifSmartShell.jsx'),developer=root('src/RawiDeveloperApp.jsx');
 assert.match(app,/RawiDeveloperApp/);
 assert.match(app,/pathname\.startsWith\('\/developer\/'\)/);
 assert.doesNotMatch(enterprise,/import RawiDevelopers/);
 assert.match(enterprise,/location\.replace\('\/developer\/'\)/);
 assert.match(developer,/RAWI Developer/);
 assert.match(developer,/RawiDevelopers/);
});
test('Cloudflare serves developer HTML identity without affecting company or Enterprise pages',()=>{
 const wrangler=JSON.parse(root('wrangler.jsonc'));const worker=root('worker/index.js');
 assert.ok(wrangler.assets.run_worker_first.includes('/developer/'));
 assert.match(worker,/rawi-developer-mark\.svg/);
 assert.match(worker,/developer\/manifest\.webmanifest/);
 assert.match(worker,/companyPage\(url\.pathname\)/);
});
test('SaaS isolates Developer application billing plans from Enterprise',()=>{
 const sql=root('sql/rawi-products.sql'),saas=root('api/platform-saas.js'),chat=root('api/mif-chat.js');
 assert.match(sql,/ADD COLUMN IF NOT EXISTS application/);
 assert.match(sql,/rawi-developer-evaluation/);
 assert.match(saas,/p\.application=COALESCE\(ap\.account_type,'enterprise'\)/);
 assert.match(chat,/p\.application=COALESCE/);
});
