import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const rawiStyles=[
 'src/mif-smart-shell.css','src/ai-erp-workspace.css','src/erp-departments.css',
 'src/guest-preview.css','src/mif-schedule.css','src/rawi-advanced.css',
 'src/rawi-developers.css','src/rawi-insights.css'
];
test('RAWI ERP uses approved blue without modifying other products',()=>{
 const s=source('src/mif-smart-shell.css');
 assert.match(s,/--mif-accent:#2166e8/);
 assert.match(s,/\.rawi-signup-types\s*>\s*button\.selected/);
 assert.match(s,/\.mif-dialog form input:focus/);
 assert.match(s,/\.mif-composer:focus-within/);
 for(const path of rawiStyles){
  const css=source(path);
  assert.doesNotMatch(css,/#(?:6556e8|6255d7|6050c9|6051d6|087f86|07848a|067e87|0a7e84|143a41|eaf6f3)/i,path);
 }
});
test('Existing approved RAWI logo remains an untouched orange SVG asset',()=>{
 const logo=source('public/rawi-mark.svg');
 assert.match(logo,/viewBox="280 165 690 742"/);
 assert.match(logo,/fill="#e35a0e"/);
 assert.match(logo,/<path fill="#ffffff"/);
});
test('Installed RAWI ERP uses the blue and white icon on all supported app surfaces',()=>{
 const manifest=JSON.parse(source('public/manifest.webmanifest'));
 const capacitor=JSON.parse(source('capacitor.config.json'));
 assert.equal(manifest.theme_color,'#2166e8');
 assert.equal(capacitor.plugins.SplashScreen.backgroundColor,'#2166e8');
 assert.ok(manifest.icons.every(icon=>icon.src==='/rawi-erp-mark.svg'));
});
test('Registration and Odoo developer forms keep their functional fields and responsive layouts',()=>{
 const shell=source('src/MifSmartShell.jsx');
 const dev=source('src/RawiDevelopers.jsx');
 const css=source('src/rawi-developers.css');
 assert.match(shell,/account_type:'enterprise'/);
 assert.doesNotMatch(shell,/account_type==='developer'/);
 for(const id of ['connection','module','implementation']){
  assert.match(dev,new RegExp('rawi-dev-form-'+id));
  assert.match(css,new RegExp('\\.rawi-dev-form-'+id));
 }
 assert.match(css,/@media\(max-width:650px\)/);
});
