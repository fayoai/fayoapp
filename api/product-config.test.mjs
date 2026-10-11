import test from 'node:test';
import assert from 'node:assert/strict';
import {productRequirements,defaultProductConfig,validateProductConfig,needsTailoredQuote} from './product-config.js';
test('Every bespoke product has a validated specification',()=>{
 for(const sku of Object.keys(productRequirements)){
  const defaults=defaultProductConfig(sku);
  assert.deepEqual(validateProductConfig(sku,defaults),defaults);
  assert.throws(()=>validateProductConfig(sku,{...defaults,arbitraryPrice:1}),/Unknown product option/);
 }
});
test('Quantity and select validation cannot be bypassed through API input',()=>{
 const d=defaultProductConfig('MIF-ERP');
 assert.throws(()=>validateProductConfig('MIF-ERP',{...d,users:99999}),/Invalid users/);
 assert.throws(()=>validateProductConfig('MIF-ERP',{...d,version:'Enterprise'}),/Invalid version/);
 assert.throws(()=>validateProductConfig('MIF-ERP',{...d,modules:['sales','sales']}),/Invalid modules/);
});
test('Only uploaded add-ons can be direct fixed-price checkout',()=>{
 for(const sku of Object.keys(productRequirements))assert.equal(needsTailoredQuote(sku),true);
 assert.equal(needsTailoredQuote('MIF-HOSTING'),true);
 assert.equal(needsTailoredQuote('MOD-MY-ADDON'),true===false);
 assert.equal(needsTailoredQuote('MOD-SALES'),false);
 assert.equal(needsTailoredQuote('MOD-'),true);
});
