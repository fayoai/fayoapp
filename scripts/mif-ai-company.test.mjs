import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seoForPage,sitemapXML} from '../worker/mif-seo.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Marketing lists exactly the requested Odoo Community identity, not MIF ERP',()=>{
 const sql=read('sql/mif-website.sql'),site=read('src/MifCompany.jsx');
 assert.match(sql,/ODOO-COMMUNITY-ENHANCED/);
 assert.match(sql,/Odoo Community المطوّر/);
 assert.match(sql,/ON CONFLICT\(code\) DO NOTHING/);
 assert.doesNotMatch(sql,/MIF ERP/);
 assert.match(site,/odoo-community-enhanced/);
 assert.match(site,/encodeURIComponent\(product.code\)/);
 assert.match(site,/get\('product'\)/);
});
test('MIF public page hosts an actual endpoint-backed interactive AI widget, not scripted replies',()=>{
 const source=read('src/MifWebsiteAssistant.jsx'),site=read('src/MifCompany.jsx');
 assert.match(site,/<MifWebsiteAssistant\/>/);
 assert.match(source,/api\('\/api\/chat\/public'/);
 assert.match(source,/result\.answer/);
 assert.match(source,/aria-live="polite"/);
 assert.match(source,/لا تشارك بيانات سرية/);
 assert.doesNotMatch(source,/setTimeout|fakeAnswer|mockResponse/);
});
test('Enhanced Odoo Community has a canonical marketing page and published sitemap eligibility',()=>{
 const meta=seoForPage('/mif/products/odoo-community-enhanced');
 assert.equal(meta.index,true);
 assert.match(meta.title,/Odoo Community/);
 assert.match(sitemapXML('https://mif.example.com',[],[{slug:'odoo-community-enhanced',published:true}]),/mif\/products\/odoo-community-enhanced/);
});
test('Approved RAWI Enterprise and Developer graphics are referenced without brand mutation',()=>{
 const site=read('src/MifCompany.jsx'),css=read('src/mif-company.css');
 assert.match(site,/rawi-mark\.svg/);
 assert.match(site,/rawi-developer-mark\.svg/);
 assert.match(css,/--mif-org:#e35a0e/);
});
