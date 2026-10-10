import test from 'node:test';import assert from 'node:assert/strict';
import {cycles,offers,hostingChoices,validateHosting,quoteCart} from './commerce-model.js';
test('five payment frequencies',()=>assert.deepEqual(cycles,['once','monthly','quarterly','semiannual','yearly']));
test('Odoo Community, Odoo partner SaaS, marketing SaaS, hosting, modules are present',()=>{for(const sku of ['MIF-ERP','MIF-CONTROL','MIF-PARTNERS','MIF-MARKETING','MIF-HOSTING','MIF-MODULES'])assert.ok(offers.some(o=>o.sku===sku))});
test('server cost cannot be controlled by user supplied price',()=>{const x={location:'sa-riyadh',cpu:8,ram:32,storage:320,os:'ubuntu-24.04',backup:'daily',management:'managed',notes:'30 concurrent users'};assert.equal(validateHosting(x).cpu,8);assert.throws(()=>validateHosting({...x,cpu:99}));assert.throws(()=>validateHosting({...x,location:'fake'}))});
test('prices use server-controlled values and 15% VAT',()=>{const x=quoteCart([{sku:'MIF-ERP',cycle:'monthly',quantity:2},{sku:'MIF-MARKETING',cycle:'yearly',quantity:1}],{'MIF-ERP:monthly':'149.99','MIF-MARKETING:yearly':'699.00'});assert.equal(x.total_halalas,114883);assert.equal(x.vat_halalas,14985)});
test('unpublished price prevents checkout',()=>assert.throws(()=>quoteCart([{sku:'MIF-ERP',cycle:'monthly',quantity:1,price:0}],{}),/not published/));
test('invalid cycles and quantity rejected',()=>{assert.throws(()=>quoteCart([{sku:'MIF-ERP',cycle:'weekly',quantity:1}],{}));assert.throws(()=>quoteCart([{sku:'MIF-ERP',cycle:'once',quantity:0}],{}))});
