// Assert actual public Worker->Neon availability and a protected session endpoint.
const targets=[
 ['RAWI ERP','https://rawi-enterprise.fayosaas.workers.dev'],
 ['MIF Smart','https://mif-smart-platform.fayosaas.workers.dev']
];
let errors=0;
for(const [name,origin] of targets){
 try{
  const response=await fetch(origin+'/api/health',{redirect:'manual',signal:AbortSignal.timeout(12000)});
  const body=await response.json();
  const ok=response.status===200&&body.ok===true&&body.database==='connected'&&body.service===name;
  console.log((ok?'PASS':'FAIL')+' '+name+' '+response.status+' database '+String(body.database));
  if(!ok)errors++;
  const protectedResponse=await fetch(origin+'/api/admin/me',{redirect:'manual',signal:AbortSignal.timeout(12000)});
  const protectedOK=protectedResponse.status===401;
  console.log((protectedOK?'PASS':'FAIL')+' '+name+' unauthorized access '+protectedResponse.status);
  if(!protectedOK)errors++;
 }catch(e){console.error('FAIL '+name+' '+String(e));errors++}
}
if(errors)process.exitCode=1;
else console.log('Active deployed Workers have real connected databases and enforce unauthenticated access.');
