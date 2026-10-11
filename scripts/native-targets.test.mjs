import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {prepareNativeConfig} from './prepare-native.mjs';
import {approvedNativeSvg} from './native-icons.mjs';
const cfg=x=>JSON.parse(readFileSync(new URL('../'+x,import.meta.url),'utf8'));
const enterprise=cfg('capacitor.config.json'),developer=cfg('capacitor.developer.config.json');
test('Enterprise and Developer mobile apps use distinct approved identifiers and origins',()=>{
 const e=prepareNativeConfig('enterprise','https://app.example.org',enterprise,developer);
 const d=prepareNativeConfig('developer','https://app.example.org',enterprise,developer);
 assert.equal(e.appId,'com.mifsmart.rawi');assert.equal(d.appId,'com.mifsmart.rawideveloper');
 assert.equal(e.server.url,'https://app.example.org/');assert.equal(d.server.url,'https://app.example.org/developer/');
 assert.equal(e.plugins.SplashScreen.backgroundColor,'#e35a0e');assert.equal(d.plugins.SplashScreen.backgroundColor,'#080808');
 assert.equal(d.server.cleartext,false);
});
test('Native builds reject non-HTTPS origins and unknown application targets',()=>{
 for(const url of ['http://app.example.org','http://localhost:5173','https://app.example.org/other','https://user:secret@app.example.org']){
  assert.throws(()=>prepareNativeConfig('developer',url,enterprise,developer));
 }
 assert.throws(()=>prepareNativeConfig('enterprise-or-developer','https://app.example.org',enterprise,developer));
});
test('Native launcher renders use only approved RAWI source marks without changing their colors',()=>{
 const e=readFileSync(new URL('../public/rawi-mark.svg',import.meta.url),'utf8');
 const d=readFileSync(new URL('../public/rawi-developer-mark.svg',import.meta.url),'utf8');
 const nativeEnterprise=approvedNativeSvg('enterprise',e);
 const nativeDeveloper=approvedNativeSvg('developer',d);
 assert.match(nativeEnterprise,/#e35a0e/);
 assert.match(nativeDeveloper,/#080808/);assert.match(nativeDeveloper,/#ffd21a/);
 assert.match(nativeEnterprise,/viewBox="254 165 742 742"/);
 assert.match(nativeDeveloper,/viewBox="254 165 742 742"/);
 assert.throws(()=>approvedNativeSvg('developer',e));
 assert.throws(()=>approvedNativeSvg('enterprise',d));
});
