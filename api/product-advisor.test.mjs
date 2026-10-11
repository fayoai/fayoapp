import test from 'node:test';
import assert from 'node:assert/strict';
import {adviseProducts,normalizeQuestion} from './product-advisor.js';

test('Arabic and English questions rank only permitted catalog products',()=>{
 for(const q of ['أريد Odoo Community المطوّر','نظام المحاسبة والمخزون','enhanced Odoo ERP']){
  assert.ok(adviseProducts(q).some(p=>p.sku==='MIF-ERP'));
 }
 assert.deepEqual(adviseProducts(''),[]);
 assert.equal(normalizeQuestion('إستضافة'), 'استضافه');
});
test('A multi-need request recommends multiple actual products',()=>{
 const r=adviseProducts('أحتاج نظام محاسبة ERP وسيرفر استضافة في السعودية');
 assert.ok(r.some(x=>x.sku==='MIF-ERP'));
 assert.ok(r.some(x=>x.sku==='MIF-HOSTING'));
});
test('Specialized tools are distinguished from generic hosting',()=>{
 assert.equal(adviseProducts('إدارة حاويات ونسخ احتياطي عملاء أودو')[0].sku,'MIF-CONTROL');
 assert.equal(adviseProducts('حملات تسويق ومحادثات الموقع')[0].sku,'MIF-MARKETING');
});
test('Assistant never invents products and limits output',()=>{
 const allowed=new Set(['MIF-ERP','MIF-CONTROL','MIF-PARTNERS','MIF-MARKETING','MIF-HOSTING','MIF-MODULES','MIF-EMAIL']);
 const r=adviseProducts('أحتاج تسويق وبرنامج أودو وسيرفر وإيميل وموديول', {limit:2});
 assert.ok(r.length<=2);
 assert.ok(r.every(p=>allowed.has(p.sku)));
});
