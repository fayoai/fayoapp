import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const erpCss=['src/mif-smart-shell.css','src/ai-erp-workspace.css','src/erp-departments.css','src/mif-schedule.css','src/rawi-advanced.css','src/rawi-insights.css'];
test('No MIF orange survives in any RAWI ERP stylesheet',()=>{
 for(const path of erpCss){
  const css=read(path);
  assert.doesNotMatch(css,/#(?:e35a0e|e45a13|f3a26e|e89b69|d85314|a8460b)/i,path);
 }
 assert.match(read('src/mif-smart-shell.css'),/\.rawi-send\{/);
 assert.match(read('src/mif-smart-shell.css'),/\.rawi-auth-tabs\{/);
 assert.match(read('src/mif-company.css'),/#e35a0e/);
});
test('RAWI ERP chat and sign in have approved interaction and account-only download',()=>{
 const s=read('src/MifSmartShell.jsx');
 assert.match(s,/function RawiGreeting/);
 assert.match(s,/كيف أقدر أساعدك اليوم؟/);
 assert.match(s,/className="mif-composer"/);
 assert.match(s,/className="rawi-send"/);
 assert.doesNotMatch(s,/className="rawi-composer-actions"/);
 assert.match(s,/onInput=\{e=>/);
 assert.match(s,/className="rawi-auth-tabs"/);
 assert.match(s,/className="rawi-account-form"/);
 assert.match(s,/className="rawi-auth-heading"/);
 assert.match(s,/installed&&/);
 assert.doesNotMatch(s,/form\.invitation/);
 assert.match(s,/const authPanel=/);
 assert.match(s,/className="rawi-install-in-account"/);
 assert.doesNotMatch(s,/<header className="mif-topbar"/);
});
test('MIF Smart product manager is directly accessible at products route and shows seven approved cards',()=>{
 const site=read('src/MifCompany.jsx'),console=read('src/MifCompanyAdmin.jsx');
 assert.match(site,/href="\/mif\/console\/products"/);
 assert.match(console,/MIF_PRODUCTS\.map/);
 assert.match(console,/\/mif\/console\//);
 assert.match(console,/\['platform','database','website','products','pages','inquiries'\]/);
 assert.match(console,/databaseState==='unavailable'/);
 assert.match(console,/mif-product-admin-footer|status-soon/);
});
