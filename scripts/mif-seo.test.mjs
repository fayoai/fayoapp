import test from 'node:test';import assert from 'node:assert/strict';
import {getCanonicalOrigin,seoForPage,sitemapXML} from '../worker/mif-seo.js';
test('MIF sitemap may publish only a configured canonical HTTPS domain',()=>{
 assert.equal(getCanonicalOrigin({}),'');
 assert.equal(getCanonicalOrigin({SITE_ORIGIN:'http://example.com'}),'');
 assert.equal(getCanonicalOrigin({SITE_ORIGIN:'https://mif.example.com/private'}),'');
 assert.equal(getCanonicalOrigin({SITE_ORIGIN:'https://mif.example.com'}),'https://mif.example.com');
});
test('Enterprise and Developer product pages have distinct crawler titles',()=>{
 const enterprise=seoForPage('/mif/products/rawi'),developers=seoForPage('/mif/products/rawi-developer');
 assert.match(enterprise.title,/Enterprise/);assert.match(developers.title,/Developer/);
 assert.equal(seoForPage('/mif/console').index,false);
 assert.equal(seoForPage('/mif/unpublished').index,false);
});
test('Sitemap exposes published MIF pages and products, not private admin paths or draft pages',()=>{
 const xml=sitemapXML('https://mif.example.com',[{slug:'privacy',published:true},{slug:'draft',published:false},{slug:'../private',published:true}],[{slug:'rawi',published:true},{slug:'rawi-developer',published:true},{slug:'hidden',published:false}]);
 assert.match(xml,/https:\/\/mif.example.com\/mif\/products\/rawi-developer/);
 assert.match(xml,/https:\/\/mif.example.com\/mif\/pages\/privacy/);
 assert.doesNotMatch(xml,/\/mif\/console|\/draft|\/hidden|\.\.\/private/);
});
