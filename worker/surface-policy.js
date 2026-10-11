// Only MIF Smart and RAWI ERP run. Upcoming product routes are closed.
const is=(path,prefix)=>path===prefix||path.startsWith(prefix+'/');
const isAsset=path=>path.startsWith('/assets/')||/\.(?:svg|png|webp|ico|js|css|webmanifest|woff2?|ttf|map)$/.test(path);
export function surfacePolicy(surface,path,method='GET',links={}){
 if(!['mif','enterprise'].includes(surface))return {status:404};
 if(is(path,'/api')){
  if(is(path,'/api/admin/developer'))return {status:404};
  if(surface==='mif'&&(is(path,'/api/admin/erp')||is(path,'/api/admin/chat')||is(path,'/api/admin/tenant')||path==='/api/admin/my-subscription'||path==='/api/admin/register'||is(path,'/api/public/rawi')))return {status:404};
  if(surface==='enterprise'&&(is(path,'/api/admin/platform')||is(path,'/api/admin/mif')||is(path,'/api/mif')||path==='/api/admin/bootstrap'))return {status:404};
  return null;
 }
 if(method!=='GET'&&method!=='HEAD')return null;
 if(is(path,'/developer'))return {status:404};
 if(isAsset(path))return null;
 if(surface==='mif'){
  if(path==='/'||path==='/index.html')return {status:302,location:'/mif'};
  if(path==='/owner-setup'||path==='/mif/owner-setup')return {status:302,location:'/admin/setup'};
  if(path==='/mif/console'||is(path,'/mif/console'))return {status:302,location:'/admin'+path.slice('/mif/console'.length)};
  if(is(path,'/admin'))return null;
  if(path==='/enterprise')return links.enterprise?{status:302,location:links.enterprise+'/'}:{status:404};
  if(!is(path,'/mif')&&!is(path,'/admin')&&path!=='/sitemap.xml')return {status:404};
 }
 if(surface==='enterprise'&&(is(path,'/admin')||is(path,'/mif')||path==='/owner-setup'||path==='/sitemap.xml'))return {status:404};
 return null;
}
