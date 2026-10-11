import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd(),read=p=>readFileSync(path.join(root,p),'utf8');
test('ERP installs as a single standalone application on supported devices',()=>{
 const manifest=JSON.parse(read('public/manifest.webmanifest'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.name,'MIF Smart AI ERP');
 assert.equal(manifest.start_url,'/');
 for(const icon of manifest.icons)assert.equal(existsSync(path.join(root,'public',icon.src.slice(1))),true);
 const config=JSON.parse(read('capacitor.config.json'));
 assert.equal(config.webDir,'dist');
 const desktop=read('apps/desktop/main.mjs');
 assert.match(desktop,/contextIsolation:true/);
 assert.match(desktop,/sandbox:true/);
});
test('Root application is ERP only without public store navigation',()=>{
 const app=read('src/App.jsx'),admin=read('src/Admin.jsx');
 assert.doesNotMatch(app,/CommerceStore|OrderCenter|AIPortal|<Footer/);
 assert.doesNotMatch(admin,/CommerceAdmin|Catalog notify|Pipeline key/);
 assert.match(admin,/AiErpWorkspace/);
 assert.match(read('api/app.js'),/installErpCore/);
 assert.doesNotMatch(read('api/app.js'),/installCommerce|seedCatalog/);
});
test('Offline worker avoids caching authenticated endpoints',()=>{
 const sw=read('public/sw.js');
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
});
