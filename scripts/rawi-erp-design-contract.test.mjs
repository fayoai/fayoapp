import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MIF_PRODUCTS,MIF_PRODUCT_GROUPS} from '../src/mif-product-catalog.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Only approved RAWI ERP opens from MIF, every other product remains coming soon',()=>{
 assert.equal(MIF_PRODUCT_GROUPS.length,3);
 assert.equal(MIF_PRODUCTS.length,7);
 assert.deepEqual(MIF_PRODUCTS.filter(p=>p.active).map(p=>p.slug),['rawi-erp']);
 assert.ok(MIF_PRODUCTS.filter(p=>!p.active).every(p=>!p.app_url));
 const company=read('src/MifCompany.jsx');
 assert.match(company,/href=\{p\.active\?p\.app_url:undefined\}/);
 assert.match(company,/قريباً/);
});
test('RAWI ERP has a distinct white mark on its blue background, preserving company and Developer logos',()=>{
 const icon=read('public/rawi-erp-mark.svg');
 assert.match(icon,/fill="#2166e8"/);
 assert.match(icon,/<path fill="#ffffff"/);
 assert.match(read('public/mif-logo.svg'),/fill="#e35a0e"/);
 const pwa=JSON.parse(read('public/manifest.webmanifest'));
 assert.equal(pwa.theme_color,'#2166e8');
 assert.ok(pwa.icons.every(x=>x.src==='/rawi-erp-mark.svg'));
});
test('RAWI ERP chat greeting types dynamically; no traditional heading',()=>{
 const src=read('src/MifSmartShell.jsx');
 assert.match(src,/function RawiGreeting\(\{lang\}\)/);
 assert.match(src,/setInterval/);
 assert.match(src,/كيف أقدر أساعدك اليوم؟/);
 assert.match(src,/<RawiGreeting lang=\{lang\}\/\>/);
 assert.doesNotMatch(src,/<header className="mif-topbar"|mif-chat-welcome/);
});
test('Five bottom tabs preserve the large New center and all login/install controls stay inside My Account',()=>{
 const src=read('src/MifSmartShell.jsx');
 for(const tab of ['chats','operations','new','schedule','account'])assert.match(src,new RegExp("'"+tab+"'"));
 assert.match(src,/\['new','جديدة','New',Plus\]/);
 assert.match(src,/id==='new'\?'new'/);
 assert.match(src,/className="rawi-install-in-account"/);
 assert.doesNotMatch(src,/rawi-chat-install/);
 assert.match(src,/if\(!authed\)\{navigate\('account'\);return\}/);
 const css=read('src/mif-smart-shell.css');
 assert.match(css,/\.mif-bottom-item\.new \.mif-bottom-icon\{width:64px/);
});
