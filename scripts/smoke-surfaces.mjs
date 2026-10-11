// A real public HTTP smoke check, run after all three authenticated Cloudflare deployments.
const origin={
 enterprise:'https://rawi-enterprise.fayosaas.workers.dev',
 developer:'https://rawi-developer.fayosaas.workers.dev',
 mif:'https://mif-smart-platform.fayosaas.workers.dev'
};
const checks=[
 ['enterprise home',origin.enterprise+'/',200,'html'],
 ['enterprise blocks Developer',origin.enterprise+'/developer/',404],
 ['enterprise blocks MIF SaaS',origin.enterprise+'/mif/console',404],
 ['enterprise blocks Developer API',origin.enterprise+'/api/admin/developer/platforms',404],
 ['Developer root redirects to Developer app',origin.developer+'/',302,'/developer/'],
 ['Developer application',origin.developer+'/developer/',200,'html'],
 ['Developer blocks Enterprise',origin.developer+'/mif/console',404],
 ['Developer blocks Enterprise ERP API',origin.developer+'/api/admin/erp/w/00000000-0000-4000-8000-000000000000/core/items',404],
 ['MIF homepage',origin.mif+'/mif',200,'html'],
 ['MIF SaaS',origin.mif+'/mif/console',200,'html'],
 ['MIF root redirects',origin.mif+'/',302,'/mif'],
 ['MIF Developer link points to separate worker',origin.mif+'/developer/',302,origin.developer+'/developer/'],
 ['MIF blocks tenant ERP APIs',origin.mif+'/api/admin/erp/workspaces',404],
 ['MIF blocks direct tenant registration',origin.mif+'/api/admin/register',404],
 ['MIF owner setup page',origin.mif+'/mif/owner-setup',200,'html']
];
let failures=0;
for(const [label,url,status,type] of checks){
 try{
  const res=await fetch(url,{redirect:'manual',headers:{'user-agent':'mif-smart-deploy-smoke/1.0'},signal:AbortSignal.timeout(15000)});
  const content=res.headers.get('content-type')||'',location=res.headers.get('location')||'';
  const pass=res.status===status&&(!type||(type==='html'?content.includes('text/html'):new URL(location,url).href===new URL(type,url).href));
  console.log((pass?'PASS':'FAIL')+' '+label+' '+res.status+' '+url);
  if(!pass){console.error('Expected '+status+' '+(type||'')+'; got '+content+' redirect '+location);failures++}
 }catch(e){console.error('FAIL '+label+' '+String(e));failures++}
}
if(failures)process.exitCode=1;
else console.log('All three deployed Cloudflare applications passed surface isolation and navigation smoke checks.');
