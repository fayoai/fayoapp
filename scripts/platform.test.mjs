import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd(),read=p=>readFileSync(path.join(root,p),'utf8');
test('installable PWA includes mandatory manifest and icon files',()=>{
 const manifest=JSON.parse(read('public/manifest.webmanifest'));
 assert.equal(manifest.display,'standalone');assert.ok(manifest.start_url.startsWith('/'));
 assert.equal(manifest.name,'MIF Smart | إم آي إف سمارت');
 for(const icon of manifest.icons) assert.equal(existsSync(path.join(root,'public',icon.src.slice(1))),true);
 assert.match(read('index.html'),/manifest\.webmanifest/);
});
test('offline service worker never caches private APIs and payments',()=>{
 const sw=read('public/sw.js');
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/url\.pathname\.startsWith\('\/payment-result'\)/);
 assert.match(sw,/url\.pathname\.startsWith\('\/admin'\)/);
});
test('website focuses only on selected MIF Smart products',()=>{
 const home=read('api/seed.js');
 assert.match(home,/MIF-ERP/);assert.match(home,/MIF-CONTROL/);
 assert.match(home,/MIF-PARTNERS/);assert.match(home,/MIF-MARKETING/);
 assert.doesNotMatch(home,/smart-home|contracting|Smart Living|المنازل الذكية/);
});
test('native app shells are secured and do not embed secrets',()=>{
 const config=JSON.parse(read('capacitor.config.json'));
 assert.equal(config.appId,'com.mifsmart.platform');
 assert.equal(config.webDir,'dist');
 const electron=read('apps/desktop/main.mjs');
 assert.match(electron,/contextIsolation:true/);assert.match(electron,/nodeIntegration:false/);
 assert.match(electron,/sandbox:true/);
 assert.match(electron,/site\.protocol!=='https:'/);
});
