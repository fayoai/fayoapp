import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MIF_PRODUCT_GROUPS,MIF_PRODUCTS,productBySlug} from '../src/mif-product-catalog.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('MIF Smart product architecture is frozen to three requested families and seven products',()=>{
 assert.deepEqual(MIF_PRODUCT_GROUPS.map(x=>x.products.length),[3,3,1]);
 assert.deepEqual(MIF_PRODUCT_GROUPS.map(x=>x.id),['rawi-ai','odoo','marketing']);
 assert.deepEqual(MIF_PRODUCTS.map(x=>x.slug),['rawi-erp','rawi-dev','rawi-copilot','odoo-community','odoo-saas','odoo-my-saas','marketing']);
 const live=MIF_PRODUCTS.filter(x=>x.active);
 assert.equal(live.length,1);
 assert.equal(live[0].slug,'rawi-erp');
 assert.equal(MIF_PRODUCTS.find(x=>x.slug==='odoo-community').title_ar,'Odoo Community المطوّر');
 assert.match(MIF_PRODUCTS.find(x=>x.slug==='rawi-copilot').summary_ar,/Odoo وGmail وOutlook/);
 assert.match(MIF_PRODUCTS.find(x=>x.slug==='marketing').summary_ar,/واتساب/);
 assert.equal(productBySlug('rawi').slug,'rawi-erp');
});
test('Website presents only RAWI ERP as available and marks all remaining products coming soon',()=>{
 const site=read('src/MifCompany.jsx');
 assert.match(site,/MIF_PRODUCT_GROUPS\.map/);
 assert.match(site,/MIF_PRODUCTS/);
 assert.match(site,/p\.active\?'a':'div'/);
 assert.match(site,/قريباً/);
 assert.match(site,/rawi-erp-mark\.svg/);
 assert.match(site,/mif-logo\.svg/);
 assert.doesNotMatch(site,/<MifWebsiteAssistant\/>/);
 assert.doesNotMatch(site,/MIF ERP/);
});
test('Existing company and future-product logo colors stay unchanged',()=>{
 const mif=read('public/mif-logo.svg'),legacy=read('public/rawi-mark.svg'),developer=read('public/rawi-developer-mark.svg');
 assert.match(mif,/fill="#e35a0e"/);
 assert.match(legacy,/fill="#e35a0e"/);
 assert.match(developer,/fill="#080808"/);
 assert.match(developer,/fill="#ffd21a"/);
 assert.match(read('src/mif-company.css'),/--mif-org:#e35a0e/);
});
