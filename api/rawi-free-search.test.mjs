import test from 'node:test';
import assert from 'node:assert/strict';
import {freePublicSearch,wantsPublicSearch,sourceContext} from './rawi-free-search.js';
test('Free encyclopedia lookups need no API key and return safely constructed primary-source links',async()=>{
 const urls=[];
 const fetcher=async url=>{urls.push(url);return {ok:true,json:async()=>({query:{search:[{title:'Odoo',snippet:'<span class="searchmatch">Odoo</span> is an ERP platform.'}]}})}};
 const found=await freePublicSearch('ابحث لي عن أودو',{language:'ar',fetcher});
 assert.equal(found.sources[0].title,'Odoo');
 assert.equal(found.sources[0].url,'https://ar.wikipedia.org/wiki/Odoo');
 assert.ok(!found.sources[0].summary.includes('<'));
 assert.ok(urls[0].includes('srsearch=Odoo'));
 assert.match(sourceContext(found,'ar'),/Odoo/);
});
test('Guest browsing is opt-in by question, and no provider is misrepresented as general internet search',async()=>{
 assert.equal(wantsPublicSearch('هل تقدر تبحث عن برامج إدارة المشاريع؟'),true);
 assert.equal(wantsPublicSearch('عامل إيه النهارده؟'),false);
 const none=await freePublicSearch('unknown',{fetcher:async()=>{throw Error('public API unreachable')}});
 assert.deepEqual(none.sources,[]);
 assert.equal(none.engine,'wikimedia');
});
