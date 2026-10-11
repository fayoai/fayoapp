import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Enterprise starts in chat with the exact requested welcome and branded icon',()=>{
 const s=read('src/MifSmartShell.jsx');
 assert.match(s,/setTab\]=useState\('chats'\)/);
 assert.match(s,/كيف أستطيع مساعدتك اليوم؟/);
 assert.match(s,/rawi-mark\.svg/);
 assert.match(s,/rawi-chat-install/);
 assert.doesNotMatch(s,/rawi-chat-signin|mif-chat-footnote|<header className="mif-topbar"/);
 assert.match(s,/mif-login-page/);
 assert.doesNotMatch(s,/GuestPreview/);
});
test('Developer starts in chat and signs in only in the account screen',()=>{
 const s=read('src/RawiDeveloperApp.jsx');
 assert.match(s,/setView\]=useState\('chats'\)/);
 assert.match(s,/كيف أستطيع مساعدتك اليوم؟/);
 assert.match(s,/rawi-developer-mark\.svg/);
 assert.match(s,/rd-chat-first/);
 assert.match(s,/rd-download/);
 assert.match(s,/view==='account'/);
 assert.match(s,/view==='studio'/);
 assert.match(s,/RawiDevelopers/);
 assert.doesNotMatch(s,/<header className="rd-header"|rd-entry|rd-intro|هذا حساب Enterprise/);
});
test('Three products have independent Cloudflare Worker asset directories and PWA manifests',()=>{
 for(const [cfg,surface]of [['wrangler.enterprise.jsonc','enterprise'],['wrangler.developer.jsonc','developer'],['wrangler.jsonc','mif']]){
  const c=JSON.parse(read(cfg));assert.equal(c.assets.directory,'./dist/'+surface);
 }
 const source=read('scripts/build-surfaces.mjs');
 assert.match(source,/VITE_APP_SURFACE/);
 assert.match(source,/Developer source is present in Enterprise bundle/);
 assert.match(source,/Enterprise source is present in Developer bundle/);
});
test('Cloudflare production smoke separates public routing checks from live database checks',()=>{
 assert.match(read('scripts/smoke-runtime.mjs'),/database==='connected'/);
 assert.match(read('.github/workflows/deploy.yml'),/smoke:runtime/);
});
