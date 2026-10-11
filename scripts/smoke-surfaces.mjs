// Public Cloudflare checks: only MIF Smart and RAWI ERP are active.
const origin={
 erp:'https://rawi-enterprise.fayosaas.workers.dev',
 mif:'https://mif-smart-platform.fayosaas.workers.dev'
};
const checks=[
 ['RAWI ERP home',origin.erp+'/',200,'html'],
 ['RAWI ERP blocks other products',origin.erp+'/developer/',404],
 ['RAWI ERP blocks MIF console',origin.erp+'/mif/console',404],
 ['RAWI ERP blocks developer API',origin.erp+'/api/admin/developer/platforms',404],
 ['MIF homepage',origin.mif+'/mif',200,'html'],
 ['MIF SaaS',origin.mif+'/mif/console',200,'html'],
 ['MIF home route',origin.mif+'/',302,'/mif'],
 ['MIF future application disabled',origin.mif+'/developer/',404],
 ['MIF blocks ERP tenant APIs',origin.mif+'/api/admin/erp/workspaces',404],
 ['MIF blocks tenant registration',origin.mif+'/api/admin/register',404],
 ['MIF owner setup',origin.mif+'/mif/owner-setup',200,'html']
];
let failures=0;
for(const [label,url,status,type] of checks){
 try{
  const res=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});
  const content=res.headers.get('content-type')||'',location=res.headers.get('location')||'';
  const pass=res.status===status&&(!type||(type==='html'?content.includes('text/html'):new URL(location,url).href===new URL(type,url).href));
  console.log((pass?'PASS':'FAIL')+' '+label+' '+res.status);
  if(!pass){console.error('Expected '+status+' '+(type||'')+' got '+content+' location '+location);failures++}
 }catch(e){console.error('FAIL '+label+' '+String(e));failures++}
}
if(failures)process.exitCode=1;else console.log('Only MIF Smart and RAWI ERP are active; future products have no app surfaces.');
