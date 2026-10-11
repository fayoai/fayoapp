import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('RAWI Enterprise and Developers are separately routed applications',()=>{
 const app=read('src/App.jsx'),developer=read('src/RawiDeveloperApp.jsx'),enterprise=read('src/MifSmartShell.jsx');
 assert.match(app,/window\.location\.pathname\.startsWith\('\/developers\/'\)/);
 assert.match(app,/<RawiDeveloperApp\/>/);
 assert.match(enterprise,/window\.location\.replace\('\/developers\/'\)/);
 assert.doesNotMatch(enterprise,/<RawiDevelopers/);
 assert.match(developer,/<RawiDevelopers/);
 assert.match(developer,/account_type:'developer'/);
 assert.match(enterprise,/account_type:'enterprise'/);
});
test('Separate Developers icon preserves approved glyph and uses black/yellow identity exclusively',()=>{
 const original=read('public/rawi-mark.svg'),developer=read('public/developers/rawi-dev-mark.svg');
 assert.match(original,/fill="#e35a0e"/);assert.match(original,/fill="#ffffff"/);
 assert.match(developer,/fill="#080808"/);assert.match(developer,/fill="#ffd637"/);
 const path=svg=>svg.match(/<path fill="[^"]+" d="([^"]+)"/)?.[1];
 assert.ok(path(original));assert.equal(path(developer),path(original));
 assert.equal(original.includes('fill="#ffd637"'),false);
});
test('Enterprise and Developers install as different scoped browser apps',()=>{
 const ent=JSON.parse(read('public/manifest.webmanifest')),dev=JSON.parse(read('public/developers/manifest.webmanifest'));
 assert.equal(ent.id,'/');assert.equal(ent.theme_color,'#e35a0e');assert.equal(ent.start_url,'/');
 assert.equal(dev.id,'/developers');assert.equal(dev.start_url,'/developers/');assert.equal(dev.scope,'/developers/');
 assert.equal(dev.theme_color,'#0b0b0c');assert.equal(dev.icons[0].src,'/developers/rawi-dev-mark.svg');
 const main=read('src/main.jsx');assert.match(main,/developers\/sw\.js/);
 const worker=read('worker/index.js');assert.match(worker,/\/developers\/manifest\.webmanifest/);assert.match(worker,/\/developers\/rawi-dev-mark\.svg/);
 const config=JSON.parse(read('wrangler.jsonc'));assert.ok(config.assets.run_worker_first.includes('/developers'));
});
test('MIF corporate catalog points Developers to its independent application and keeps both products',()=>{
 const migration=read('sql/rawi-developer-product.sql'),site=read('src/MifCompany.jsx');
 assert.match(migration,/RAWI-DEVELOPERS/);assert.match(migration,/NULL,true,2/);
 assert.match(site,/rawi-developers/);assert.match(site,/developers\/rawi-dev-mark.svg/);
 assert.match(site,/\?\'\/developers\/\':\'\/\'/);
});
test('Odoo Developers cannot call Enterprise ERP operations and receive Odoo-only AI context',()=>{
 const app=read('api/app.js'),odoo=read('api/rawi-developer.js'),chat=read('api/mif-chat.js');
 assert.match(app,/app\.use\('\/api\/admin\/erp\/\*'/);
 assert.match(app,/account_type==='developer'/);
 assert.match(odoo,/owner_type\.account_type='developer'/);
 assert.match(chat,/failed_odoo_connections/);
 assert.match(chat,/blocked_implementations/);
});
test('Developer CSS selectors do not modify Enterprise color palette',()=>{
 const app=read('src/rawi-developer-app.css'),ent=read('public/rawi-mark.svg');
 assert.match(app,/^\.rawi-dev-app\{/m);
 assert.match(app,/\.rawi-dev-app \.rawi-dev-panel/);
 assert.match(ent,/fill="#e35a0e"/);
});
