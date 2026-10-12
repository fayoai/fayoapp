// Test the actual deployed free-tier AI, not merely a configured binding.
const endpoints=[
 {name:'RAWI guest',url:'https://rawi-enterprise.fayosaas.workers.dev/api/chat/public'},
 {name:'MIF guest',url:'https://mif-smart-platform.fayosaas.workers.dev/api/chat/public'}
];
for(const item of endpoints){
 const response=await fetch(item.url,{method:'POST',headers:{'Content-Type':'application/json','Accept-Language':'ar','Cache-Control':'no-store'},body:JSON.stringify({question:'مرحبًا. ما اسمك وكيف تساعد صاحب مشروع جديد؟'}),signal:AbortSignal.timeout(60000)});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||!payload.ok||typeof payload.answer!=='string'||payload.answer.trim().length<12){
  throw Error(item.name+' live model test failed with HTTP '+response.status+': '+String(payload.error||'missing generated response').slice(0,220));
 }
 if(!payload.provider||!payload.model)throw Error(item.name+' did not report a real AI provider');
 console.log(item.name+' live model successfully responded via '+payload.provider+' / '+payload.model+' ('+payload.answer.length+' characters)');
}

const research=await fetch(endpoints[0].url,{method:'POST',
 headers:{'Content-Type':'application/json','Accept-Language':'ar','Cache-Control':'no-store'},
 body:JSON.stringify({question:'ابحث عن أودو Odoo وأعطني مصدرًا مباشرًا للمعلومات'}),signal:AbortSignal.timeout(60000)});
const found=await research.json().catch(()=>({}));
if(!research.ok||!found.ok||typeof found.answer!=='string'||!Array.isArray(found.sources)||!found.sources.length
 ||!found.sources.some(s=>s.url.startsWith('https://')&&s.title)){
 throw Error('RAWI guest research test failed with HTTP '+research.status+': '+String(found.error||'no live source citations from public research').slice(0,220));
}
console.log('RAWI guest live public research returned '+found.sources.length+' verified source(s) via '+found.provider);

const identity=await fetch(endpoints[0].url,{method:'POST',
 headers:{'Content-Type':'application/json','Accept-Language':'ar','Cache-Control':'no-store'},
 body:JSON.stringify({question:'إنت مين ومين اللي طورك وبيديرك؟'}),signal:AbortSignal.timeout(60000)});
const identityData=await identity.json().catch(()=>({}));
if(!identity.ok||!identityData.ok||!/(?:MIF|ميف)/i.test(String(identityData.answer||''))||!/(?:راوي|RAWI)/i.test(String(identityData.answer||''))){
 throw Error('RAWI guest identity model test failed: '+String(identityData.error||identityData.answer||'unavailable').slice(0,180));
}
console.log('RAWI correctly identifies itself and MIF Smart in a real inference reply.');
