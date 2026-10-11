import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialLanguage,languageFromDevice} from '../src/language-preferences.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('New RAWI installs follow the preferred device language',()=>{
 assert.equal(languageFromDevice({languages:['ar-SA','en-US'],language:'en-US'}),'ar');
 assert.equal(languageFromDevice({languages:['en-GB','ar-SA'],language:'ar-SA'}),'en');
 assert.equal(initialLanguage('rawi_lang',{getItem:()=>null},{language:'ar-EG'}),'ar');
 assert.equal(initialLanguage('rawi_lang',{getItem:()=>null},{languages:['en-US']}),'en');
});
test('Saved RAWI language takes precedence over the device, including account changes',()=>{
 const stored={rawi_lang:'en',mif_lang:'ar'};
 const local={getItem:key=>stored[key]||null};
 assert.equal(initialLanguage('rawi_lang',local,{language:'ar-SA'}),'en');
 assert.equal(initialLanguage('mif_lang',local,{language:'en-US'}),'ar');
 assert.equal(initialLanguage('rawi_lang',{getItem:()=> 'invalid'},{language:'ar-SA'}),'ar');
 assert.equal(initialLanguage('rawi_lang',{getItem(){throw new Error('blocked')}},{language:'en-US'}),'en');
});
test('Enterprise launcher isolates RAWI language from MIF Smart company website and saves user choice',()=>{
 const entry=read('src/entry-enterprise.jsx'),runtime=read('src/runtime-entry.jsx'),app=read('src/App.jsx');
 assert.match(entry,/launch\(MifSmartShell,'\/sw\.js','rawi_lang'\)/);
 assert.match(runtime,/initialLanguage\(languageKey\)/);
 assert.match(runtime,/localStorage\.setItem\(languageKey,lang\)/);
 assert.match(app,/startsWith\('\/mif'\)\?'mif_lang':'rawi_lang'/);
});
