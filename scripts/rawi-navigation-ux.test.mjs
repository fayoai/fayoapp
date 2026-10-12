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
 assert.match(css,/\.mif-app\{height:100dvh;min-height:100dvh;max-height:100dvh;overflow:hidden/);
 assert.match(css,/\.mif-body-chats\{height:auto;min-height:0/);
 assert.match(css,/\.mif-chat-page>\.mif-composer\{grid-row:3;align-self:end;justify-self:center;width:min\(100%,620px\)/);
 assert.match(ui,/<form className="mif-composer" onSubmit=\{ask\}>\s*<div className="mif-composer-field">/);
 assert.match(ui,/<div className="rawi-composer-toolbar">/);
 assert.match(ui,/<button type="submit" className="rawi-send"/);
 assert.match(ui,/<\/button>\s*<\/div>\s*<\/div>\s*<\/form>/);

 assert.match(ui,/e\.key==='Enter'&&!e\.shiftKey&&!e\.nativeEvent\?\.isComposing&&e\.keyCode!==229/);
 assert.match(css,/\.mif-composer-field\{flex:1;min-width:0/);
 assert.match(ui,/<img src="\/rawi-erp-mark\.svg" alt="" width="32" height="32" style=/);
 assert.match(css,/\.mif-app \.mif-login-page \.rawi-auth-heading>img\{[^}]*width:32px!important/);
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
 assert.match(ui,/const selectTab=key=>\{if\(session\?\.company_setup_required\)/);
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
 assert.match(ui,/RawiCustomerAccount installed=\{installed\}/);
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
 assert.match(api,/user\.full_name\.slice\(0,150\)/);
});
test('Fresh RAWI greeting sits in the middle while the single message composer remains at the bottom',()=>{
 const css=read('src/mif-smart-shell.css'),ui=read('src/MifSmartShell.jsx');
 assert.match(css,/\.mif-chat-scroll\.is-empty\{[^}]*align-items:center;justify-content:flex-start;padding-top:/);
 assert.match(css,/\.mif-welcome-message\{[^}]*width:fit-content;max-width:100%;align-self:center/);
 assert.match(css,/\.mif-welcome-message p\{[^}]*margin:0/);
 assert.match(ui,/<RawiGreeting lang=\{lang\} customText=/);
 assert.equal((ui.match(/className="mif-composer"/g)||[]).length,1);
});

test('A chat error stays in the scroll region, not in a fourth grid row that displaces the composer',()=>{
 const ui=read('src/MifSmartShell.jsx');
 assert.match(ui,/\{chatError&&<div className="mif-chat-error" role="alert">\{chatError\}<\/div>\}\s*<\/div>\s*<form className="mif-composer"/);
});

test('Responsive mobile menu uses smaller icons, labels and footprint without changing tab order',()=>{
 const css=read('src/mif-smart-shell.css');
 assert.match(css,/\.mif-bottom-nav\{height:calc\(64px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(css,/\.mif-bottom-item\{font-size:9px;min-height:49px/);
 assert.match(css,/\.mif-bottom-item \.mif-bottom-icon svg\{width:19px;height:19px\}/);
 assert.match(css,/\.mif-bottom-item\.new \.mif-bottom-icon\{width:46px;height:46px/);
});

test('Composer exposes real attachments and voice, but company selection only exists when signed in',()=>{
 const ui=read('src/MifSmartShell.jsx'),css=read('src/mif-smart-shell.css'),server=read('api/mif-chat.js');
 assert.match(ui,/type="file" className="rawi-file-input"/);
 assert.match(ui,/multiple aria-label=\{L\('اختيار المستندات'/);
 assert.match(ui,/onChange=\{addDocuments\}/);
 assert.match(ui,/onClick=\{toggleMicrophone\}/);
 assert.match(ui,/authed&&workspaces\.length>0&&<label className="rawi-composer-company"/);
 assert.doesNotMatch(ui,/className="rawi-workspace-picker">\{L\('المؤسسة','Organization'\)\}<select aria-label=\{L\('المؤسسة النشطة'/);
 assert.match(ui,/<ArrowUp size=\{19\}/);
 assert.match(css,/\.rawi-composer-company\{margin-inline-start:auto/);
 assert.match(server,/documentsSchema\.optional\(\)/);
 assert.match(server,/routeAI\(/);
 assert.match(server,/app\.post\('\/api\/chat\/transcribe'/);
});
