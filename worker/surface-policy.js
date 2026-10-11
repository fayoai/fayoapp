// Deployment boundary: the MIF control plane, Enterprise and Developer are separate Workers.
const is=(path,prefix)=>path===prefix||path.startsWith(prefix+'/');
const isAsset=path=>path.startsWith('/assets/')||path.startsWith('/developer/assets/')||/\.(?:svg|png|webp|ico|js|css|webmanifest|woff2?|ttf|map)$/.test(path);
export function surfacePolicy(surface,path,method='GET',links={}){
 if(!['mif','enterprise','developer'].includes(surface))return null;
 if(is(path,'/api')){
  if(surface==='mif'&&(is(path,'/api/admin/erp')||is(path,'/api/admin/developer')||is(path,'/api/admin/chat')||path==='/api/admin/my-subscription'||path==='/api/admin/register'||is(path,'/api/public/rawi')))return {status:404};
  if((surface==='enterprise'||surface==='developer')&&path==='/api/admin/bootstrap')return {status:404};
  if(surface==='enterprise'&&(is(path,'/api/admin/platform')||is(path,'/api/admin/mif')||is(path,'/api/admin/developer')||is(path,'/api/mif')))return {status:404};
  if(surface==='developer'&&(is(path,'/api/admin/platform')||is(path,'/api/admin/mif')||is(path,'/api/mif')||(is(path,'/api/admin/erp')&&!(path==='/api/admin/erp/workspaces'&&method==='GET'))||path==='/api/chat/public'))return {status:404};
  return null;
 }
 if(method!=='GET'&&method!=='HEAD')return null;
 if(isAsset(path))return null;
 if(surface==='mif'){
  if(path==='/'||path==='/index.html')return {status:302,location:'/mif'};
  if(path==='/owner-setup')return {status:302,location:'/mif/owner-setup'};
  if(is(path,'/developer'))return links.developer?{status:302,location:links.developer+'/developer/'}:{status:404};
  if(path==='/enterprise')return links.enterprise?{status:302,location:links.enterprise+'/'}:{status:404};
  if(!is(path,'/mif')&&path!=='/sitemap.xml')return {status:404};
 }
 if(surface==='enterprise'&&(is(path,'/mif')||is(path,'/developer')||path==='/owner-setup'||path==='/sitemap.xml'))return {status:404};
 if(surface==='developer'){
  if(path==='/'||path==='/index.html')return {status:302,location:'/developer/'};
  if(is(path,'/mif')||path==='/owner-setup'||path==='/sitemap.xml')return {status:404};
  if(!is(path,'/developer'))return {status:404};
 }
 return null;
}
