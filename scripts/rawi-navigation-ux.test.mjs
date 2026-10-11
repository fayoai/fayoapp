import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Single chat input has one visual border, no nested brand bar, and stays over the fixed bottom menu',()=>{
 const ui=read('src/MifSmartShell.jsx'),css=read('src/mif-smart-shell.css');
 assert.equal((ui.match(/className="mif-composer"/g)||[]).length,1);
 assert.equal((ui.match(/className="rawi-send"/g)||[]).length,1);
 assert.match(ui,/<form className="mif-composer"/);
 assert.doesNotMatch(ui,/\{authed&&<form className="mif-composer"/);
 assert.doesNotMatch(ui,/className="rawi-composer-actions"/);
 assert.match(css,/\.mif-chat-page\{[^}]*display:grid;grid-template-rows:auto minmax\(0,1fr\) auto;/);
 assert.match(css,/\.mif-composer textarea\{[^}]*border:0!important;outline:0!important;box-shadow:none!important;background:transparent!important/);
 assert.match(css,/\.mif-body-chats\{height:calc\(100dvh - 80px/);
});
test('Seven navigation tabs keep New centered and unauthenticated gated tabs display inline chat login',()=>{
 const ui=read('src/MifSmartShell.jsx');
 const order=['chats','operations','schedule','new','team','alerts','account'];
 const start=ui.slice(ui.indexOf('const nav='),ui.indexOf('function',ui.indexOf('const nav=')));
 assert.deepEqual([...start.matchAll(/\['(chats|operations|team|new|schedule|alerts|account)'/g)].map(x=>x[1]),order);
 assert.match(ui,/tab==='schedule'&&!checking&&authed&&<MifSchedule/);
 assert.match(ui,/tab==='team'&&!checking&&authed&&<RawiTeamPanel/);
 assert.match(ui,/tab==='alerts'&&!checking&&authed&&<RawiNotificationsPanel/);
 assert.match(ui,/\[tab,setTab\]=useState\('new'\)/);
 assert.match(ui,/const selectTab=key=>\{if\(key==='new'\)\{startNew\(\);return\}navigate\(key\)\}/);
 assert.match(ui,/tab==='chats'&&authed&&<section className="mif-chats-history"/);
 assert.match(ui,/!checking&&!authed&&protectedTabs\.includes\(tab\)/);
 assert.match(ui,/const authPanel=<section/);
 assert.doesNotMatch(ui,/:authPanel/);
 assert.match(ui,/const privateChat=authed&&!!workspaceId/);
 assert.match(ui,/const endpoint=privateChat\?'\/api\/admin\/chat\/send':'\/api\/chat\/public'/);
 assert.match(ui,/navigate\('thread'\)/);
 assert.doesNotMatch(ui,/rawi-need-account/);
});
test('Login is compact, no invitation input, and PWA installation button is not shown when installed',()=>{
 const ui=read('src/MifSmartShell.jsx'),backend=read('api/app.js'),css=read('src/mif-smart-shell.css');
 assert.doesNotMatch(ui,/form\.invitation|Invitation code|رمز الدعوة/);
 assert.doesNotMatch(backend,/hashInvite|user\.invitation/);
 assert.match(ui,/window\.localStorage\.setItem\('rawi-erp-installed','1'\)/);
 assert.match(ui,/!installed&&<button type="button" className="rawi-install-in-account rawi-install-mini"/);
 assert.match(ui,/!installed&&<button type="button" className="rawi-install-in-account"/);
 assert.match(css,/\.mif-login-page\{width:min\(100%,365px\)/);
 assert.match(css,/\.mif-login-page\{[^}]*border:1px solid var\(--rawi-border\);border-radius:20px;background:#fff/);
 assert.match(css,/\.mif-body\.mif-body-auth\{[^}]*display:flex;align-items:center;justify-content:center/);
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

test('Account sign-up has exactly name, email and password and backend derives the workspace name',()=>{
 const ui=read('src/MifSmartShell.jsx'),api=read('api/app.js');
 const auth=ui.slice(ui.indexOf('const authPanel='),ui.indexOf(' return <div className="mif-app"'));
 assert.match(auth,/signup&&<label>\{L\('الاسم'/);
 assert.match(auth,/L\('البريد الإلكتروني'/);
 assert.match(auth,/L\('كلمة المرور'/);
 assert.doesNotMatch(auth,/form\.organization|L\('الشركة'/);
 assert.match(ui,/const initialLogin=\{name:'',email:'',password:'',account_type:'enterprise'\}/);
 assert.doesNotMatch(api,/organization:z\.string/);
 assert.match(api,/user\.name\.slice\(0,150\)/);
});
test('Fresh RAWI greeting sits in the middle while the single message composer remains at the bottom',()=>{
 const css=read('src/mif-smart-shell.css'),ui=read('src/MifSmartShell.jsx');
 assert.match(css,/\.mif-chat-scroll\.is-empty\{[^}]*align-items:center;justify-content:center/);
 assert.match(css,/\.mif-welcome-message\{[^}]*width:fit-content;max-width:100%;align-self:center/);
 assert.match(css,/\.mif-welcome-message p\{[^}]*margin:0/);
 assert.match(ui,/<RawiGreeting lang=\{lang\}\/>/);
 assert.equal((ui.match(/className="mif-composer"/g)||[]).length,1);
});
