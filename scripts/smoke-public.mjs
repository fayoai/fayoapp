// Read-only production smoke test for public MIF Smart, RAWI Enterprise and Developer.
// Usage: npm run smoke:public -- https://your-confirmed-production-domain
const input=process.argv[2];
if(!input){console.error('Provide the verified production HTTPS URL.');process.exit(2)}
let origin;
try{
 const u=new URL(input);
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error();
 origin=u.origin;
}catch{console.error('Only a clean HTTPS origin is allowed, without paths or credentials.');process.exit(2)}
const errors=[];
async function get(path){
 const response=await fetch(origin+path,{headers:{Accept:'application/json,text/html,application/xml'},redirect:'error',signal:AbortSignal.timeout(12000)});
 const body=await response.text();
 console.log(response.status+' GET '+path);
 return {response,body};
}
for(const path of ['/','/developer/','/mif','/mif/products/rawi','/mif/products/rawi-developer','/mif/products/odoo-community-enhanced']){
 try{
  const {response,body}=await get(path);
  if(response.status!==200||!response.headers.get('content-type')?.includes('text/html')||!body.includes('<html'))errors.push('Public application route is not serving HTML: '+path);
 }catch(e){errors.push('Route unavailable: '+path+' ('+e.message+')')}
}
try{
 const {response,body}=await get('/api/health');
 const data=JSON.parse(body);
 if(response.status!==200||!data.ok||data.service!=='MIF Smart'||data.database!=='connected')errors.push('MIF Smart production API is not connected to PostgreSQL');
}catch(e){errors.push('API health check failed: '+e.message)}
try{
 const {response,body}=await get('/api/mif/site');
 const site=JSON.parse(body);
 const products=new Set((site.products||[]).map(x=>x.code));
 if(response.status!==200||!site.ok)errors.push('Corporate site content API is unavailable');
 for(const code of ['RAWI-AI-ERP','RAWI-DEVELOPER','ODOO-COMMUNITY-ENHANCED'])if(!products.has(code))errors.push('Missing published catalogue product: '+code);
}catch(e){errors.push('MIF catalogue API failed: '+e.message)}
try{
 const {response}=await get('/api/admin/me');
 if(response.status!==401)errors.push('Unauthenticated account access was not correctly blocked (expected 401)');
}catch(e){errors.push('Account auth guard check failed: '+e.message)}
try{
 const {response,body}=await get('/sitemap.xml');
 if(response.status!==200||!body.includes('<urlset')||!body.includes('odoo-community-enhanced'))errors.push('Canonical sitemap is missing or not configured for this origin');
}catch(e){errors.push('Canonical sitemap failed: '+e.message)}
if(errors.length){console.error('\nProduction smoke checks FAILED:\n'+errors.map(x=>'- '+x).join('\n'));process.exitCode=1}
else console.log('\nPublic routing, catalogue, Neon connectivity, auth boundary and sitemap checks passed. Live AI credentials, billing, app-store signing and ERP business validation require separate tests.');
