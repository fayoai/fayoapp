import {surfacePolicy} from './surface-policy.js';
import app from '../api/app.js';
import {neon} from '@neondatabase/serverless';
import {runErpSchedule} from '../api/ai-erp.js';
import {getCanonicalOrigin,seoForPage,sitemapXML} from './mif-seo.js';
const companyPage=path=>path==='/mif'||path==='/mif/'||path.startsWith('/mif/');
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  const boundary=surfacePolicy(env.MIF_APP_SURFACE,url.pathname,request.method,{enterprise:env.RAWI_ENTERPRISE_ORIGIN});
  if(boundary){if(boundary.location)return Response.redirect(new URL(boundary.location,url),boundary.status);return new Response('Not found',{status:boundary.status,headers:{'Cache-Control':'no-store'}})}
  // The Enterprise Worker runs before static asset routing on '/': explicitly serve its app shell.
  if(env.MIF_APP_SURFACE==='enterprise'&&(request.method==='GET'||request.method==='HEAD')&&url.pathname==='/'&&env.ASSETS){
   return env.ASSETS.fetch(request);
  }
  // The company manifest must remain a static asset, never the HTML app shell.
  if(url.pathname==='/mif/manifest.webmanifest'&&env.ASSETS)return env.ASSETS.fetch(request);
  if(url.pathname==='/sitemap.xml'){
   const canonical=getCanonicalOrigin(env);
   if(!canonical||url.origin!==canonical||!env.DATABASE_URL)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
   try{
    const sql=neon(env.DATABASE_URL);
    const [pages,products]=await Promise.all([
     sql.query('SELECT slug,published FROM mif_site_pages WHERE published=true ORDER BY slug'),
     sql.query('SELECT slug,published FROM mif_products WHERE published=true ORDER BY sort_order,created_at')
    ]);
    return new Response(sitemapXML(canonical,pages,products),{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=1800'}});
   }catch{return new Response('Sitemap unavailable',{status:503,headers:{'Cache-Control':'no-store'}})}
  }
  // Public corporate pages may be indexed; RAWI customer routes and management remain private.
  if((request.method==='GET'||request.method==='HEAD')&&companyPage(url.pathname)&&env.ASSETS){
   const landing=new URL('/',request.url);
   const assets=await env.ASSETS.fetch(new Request(landing,request));
   const canonical=getCanonicalOrigin(env),isCanonical=!!canonical&&url.origin===canonical;
   const meta=seoForPage(url.pathname),robots=isCanonical&&meta.index?'index,follow':'noindex,nofollow';
   if(!(assets.headers.get('content-type')||'').includes('text/html'))return assets;
   return new HTMLRewriter()
    .on('meta[name="robots"]',{element(el){el.setAttribute('content',robots)}})
    .on('meta[name="description"]',{element(el){el.setAttribute('content',meta.description)}})
    .on('title',{element(el){el.setInnerContent(meta.title)}})
    .on('meta[name="theme-color"]',{element(el){el.setAttribute('content','#e35a0e')}})
    .on('link[rel="icon"]',{element(el){el.setAttribute('href','/mif-app-icon.svg')}})
    .on('link[rel="apple-touch-icon"]',{element(el){el.setAttribute('href','/mif-app-icon.svg')}})
    .on('link[rel="manifest"]',{element(el){el.setAttribute('href','/mif/manifest.webmanifest')}})
    .on('head',{element(el){
      if(!isCanonical||!meta.index)return;
      const href=canonical+meta.path;
      el.append('<link rel="canonical" href="'+href+'"/>',{html:true});
      el.append('<meta property="og:title" content="'+meta.title+'"/>',{html:true});
      el.append('<meta property="og:description" content="'+meta.description+'"/>',{html:true});
      el.append('<meta property="og:type" content="website"/>',{html:true});
    }})
    .transform(assets);
  }
  return app.fetch(request,env,ctx);
 },
 async scheduled(_controller,env,ctx){if(!env.DATABASE_URL)return;ctx.waitUntil(runErpSchedule(neon(env.DATABASE_URL)).catch(err=>console.error('RAWI task schedule error',err.message)))}
};
