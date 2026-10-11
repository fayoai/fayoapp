const escapeXML=s=>String(s).replace(/[<>&"']/g,x=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[x]));
export function getCanonicalOrigin(env={},requestOrigin=''){
 try{
  const url=new URL(env.SITE_ORIGIN||'');
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return '';
  // Only use configured production canonical URL; never publish temporary preview as canonical.
  return url.origin;
 }catch{return ''}
}
const content={
 '/mif':{title:'MIF Smart | Business Software',description:'MIF Smart develops connected business software and intelligent tools for business operations.'},
 '/mif/about':{title:'About MIF Smart | Business Software',description:'Learn about MIF Smart and its enterprise and developer software applications.'},
 '/mif/contact':{title:'Contact MIF Smart',description:'Get in touch with MIF Smart about RAWI Enterprise, RAWI Developer and technical solutions.'},
 '/mif/products/rawi':{title:'RAWI Enterprise | AI ERP by MIF Smart',description:'RAWI Enterprise brings business operations together in an AI-powered ERP workspace.'},
 '/mif/products/rawi-developer':{title:'RAWI Developer | Odoo Engineering by MIF Smart',description:'RAWI Developer supports Odoo connections, diagnostic checks, addon building and implementation projects.'}
};
export function seoForPage(path){
 if(path.startsWith('/mif/console'))return {...content['/mif'],index:false};
 const key=path.replace(/\/+$/,'')||'/mif';
 const item=content[key]||content['/mif'];
 return {...item,index:!!content[key],path:key};
}
export function sitemapXML(origin,pages=[],products=[]){
 const root=new URL(origin),links=new Set(['/mif','/mif/about','/mif/contact']);
 for(const p of pages)if(p.published&&/^[a-z0-9-]{2,80}$/.test(p.slug))links.add('/mif/pages/'+p.slug);
 for(const p of products)if(p.published&&/^[a-z0-9-]{2,80}$/.test(p.slug))links.add('/mif/products/'+p.slug);
 const rows=[...links].map(path=>'<url><loc>'+escapeXML(root.origin+path)+'</loc></url>').join('');
 return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+rows+'</urlset>';
}
