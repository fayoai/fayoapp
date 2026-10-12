import test from 'node:test';
import assert from 'node:assert/strict';
import {plannedRepository} from './rawi-chat-drafts.js';
test('explicit Arabic action routes to a standard draft repository',()=>{
 assert.equal(plannedRepository('اعمل عرض سعر للعميل أحمد')?.key,'std_quotations');
 assert.equal(plannedRepository('اعمل طلب عرض سعر من المورد')?.key,'std_purchase_quotes');
 assert.equal(plannedRepository('أنشئ أمر شراء جديد')?.key,'std_purchase_orders');
});
test('chat and unsafe non-action requests are never executed',()=>{
 assert.equal(plannedRepository('ما هو عرض السعر؟'),null);
 assert.equal(plannedRepository('اعتمد الفاتورة وادفعها'),null);
 assert.equal(plannedRepository('احذف كل الفواتير'),null);
});