import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Single chat input has one visual border, no nested brand bar, and stays over the fixed bottom menu',()=>{
 const ui=read('src/MifSmartShell.jsx'),css=read('src/mif-smart-shell.css');
 assert.equal((ui.match(/className="mif-composer"/g)||[]).length,1);
 assert.equal((ui.match(/className="rawi-send"/g)||[]).length,1);
 assert.doesNotMatch(ui,/className="rawi-composer-actions"/);
 assert.match(css,/\.mif-chat-page\{[^}]*display:grid;grid-template-rows:auto minmax\(0,1fr\) auto;/);
 assert.match(css,/\.mif-composer textarea\{[^}]*border:0!important;outline:0!important;box-shadow:none!important;background:transparent!important/);
 assert.match(css,/\.mif-body-chats\{height:calc\(100dvh - 80px/);
});
test('Seven navigation tabs keep New in the center and account form appears directly on gated tabs',()=>{
 const ui=read('src/MifSmartShell.jsx');
 const order=['chats','operations','team','new','schedule','alerts','account'];
 const start=ui.slice(ui.indexOf('const nav='),ui.indexOf('function',ui.indexOf('const nav=')));
 assert.deepEqual([...start.matchAll(/\['(chats|operations|team|new|schedule|alerts|account)'/g)].map(x=>x[1]),order);
 assert.match(ui,/tab==='schedule'&&\(checking\?null:authed\?<MifSchedule[^>]*>:authPanel\)/);
 assert.match(ui,/tab==='team'&&\(checking\?null:authed\?<RawiTeamPanel/);
 assert.match(ui,/tab==='alerts'&&\(checking\?null:authed\?<RawiNotificationsPanel/);
 assert.match(ui,/const authPanel=<section/);
 assert.match(ui,/!authed&&!checking&&authPanel/);
 assert.doesNotMatch(ui,/rawi-need-account/);
});
test('Login is compact, no invitation input, and PWA installation button is not shown when installed',()=>{
 const ui=read('src/MifSmartShell.jsx'),backend=read('api/app.js'),css=read('src/mif-smart-shell.css');
 assert.doesNotMatch(ui,/form\.invitation|Invitation code|رمز الدعوة/);
 assert.doesNotMatch(backend,/hashInvite|user\.invitation/);
 assert.match(ui,/window\.localStorage\.setItem\('rawi-erp-installed','1'\)/);
 assert.match(ui,/!installed&&<div className="rawi-auth-bottom"/);
 assert.match(ui,/!installed&&<button type="button" className="rawi-install-in-account"/);
 assert.match(css,/\.mif-login-page\{width:min\(100%,445px\)/);
 assert.match(css,/\.rawi-install-in-account\{[^}]*width:auto;/);
});
test('Team and notifications read real authorized company records; membership must be registered in central and tenant DB',()=>{
 const panels=read('src/RawiPanels.jsx'),server=read('api/rawi-team.js');
 assert.match(panels,/workspaceId/);
 assert.match(panels,/api\(base\+'\/tasks'\)/);
 assert.match(panels,/api\(base\+'\/activities'\)/);
 assert.ok(panels.includes("+'/members')"));
 assert.match(server,/const central=c\.get\('centralSQL'\)/);
 assert.match(server,/JOIN rawi_account_profiles/);
 assert.match(server,/query\(central,`INSERT INTO erp_memberships/);
});
