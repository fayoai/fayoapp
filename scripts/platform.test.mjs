import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd(),read=p=>readFileSync(path.join(root,p),'utf8');
test('RAWI is the independent client application and MIF Smart retains corporate ownership',()=>{
 const manifest=JSON.parse(read('public/manifest.webmanifest'));
 assert.equal(manifest.short_name,'نظام راوي');
 const en=JSON.parse(read('public/manifest.en.webmanifest'));
 assert.equal(en.short_name,'Rawi ERP');
 assert.equal(manifest.name,'نظام راوي');
 assert.equal(manifest.start_url,'/');
 assert.equal(manifest.display,'standalone');
 assert.ok(manifest.icons.every(i=>i.src==='/rawi-erp-mark.svg'));
 assert.match(read('src/MifCompany.jsx'),/mif-logo.svg/);
 assert.match(read('src/MifCompany.jsx'),/mif\/products/);
 assert.match(read('src/App.jsx'),/MifCompany/);
 assert.ok(manifest.icons.every(i=>existsSync(path.join(root,'public',i.src.slice(1)))));
 assert.doesNotMatch(read('index.html'),/MIF ERP|MIF Smart AI ERP/);
});
test('Chat-first app installs from bottom navigation',()=>{
 const shell=read('src/MifSmartShell.jsx'),app=read('src/App.jsx');
 assert.match(app,/MifSmartShell/);
 assert.match(shell,/\['chats'/);
 for(const k of ['operations','new','schedule','account'])assert.match(shell,new RegExp("'"+k+"'"));
 assert.match(shell,/mif-bottom-nav/);
 assert.match(shell,/authed&&/);
 assert.match(shell,/beforeinstallprompt/);
 assert.match(shell,/rawi-erp-mark.svg/);
 assert.doesNotMatch(shell,/mif-logo.svg/);
 assert.doesNotMatch(shell,/\/mif\/console/);
 assert.match(shell,/RawiCustomerAccount/);
 assert.doesNotMatch(shell,/MIF Smart AI ERP|Odoo Community|<CommerceStore/);
});
test('Only installed applications are offered for download',()=>{
 const app=read('src/MifSmartShell.jsx');
 assert.match(app,/beforeinstallprompt/);
 assert.match(app,/Add to Home Screen/);
 assert.doesNotMatch(app,/download=.*\.apk|download=.*\.exe/);
});
test('Native wrappers retain required isolation for supported builds',()=>{
 const config=JSON.parse(read('capacitor.config.json'));
 assert.equal(config.webDir,'dist');
 const desktop=read('apps/desktop/main.mjs');
 assert.match(desktop,/contextIsolation:true/);
 assert.match(desktop,/sandbox:true/);
});
test('Offline worker does not cache authenticated API responses',()=>{
 const sw=read('public/sw.js');
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
});
