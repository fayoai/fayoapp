import app from '../api/app.js';
import {neon} from '@neondatabase/serverless';
import {runErpSchedule} from '../api/ai-erp.js';
const companyPage=path=>path==='/mif'||path==='/mif/'||path.startsWith('/mif/');
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  // Standalone RAWI Developers shell: its icon and manifest are independent of Enterprise.
  if((request.method==='GET'||request.method==='HEAD')&&(url.pathname==='/developers'||url.pathname==='/developers/')&&env.ASSETS){
   const page=await env.ASSETS.fetch(new Request(new URL('/',request.url),request));
   if(!(page.headers.get('content-type')||'').includes('text/html'))return page;
   return new HTMLRewriter()
    .on('title',{element(el){el.setInnerContent('RAWI Developers | راوي للمطورين')}})
    .on('link[rel="icon"]',{element(el){el.setAttribute('href','/developers/rawi-dev-mark.svg')}})
    .on('link[rel="apple-touch-icon"]',{element(el){el.setAttribute('href','/developers/rawi-dev-mark.svg')}})
    .on('link[rel="manifest"]',{element(el){el.setAttribute('href','/developers/manifest.webmanifest')}})
    .on('meta[name="theme-color"]',{element(el){el.setAttribute('content','#0b0b0c')}})
    .on('meta[name="apple-mobile-web-app-title"]',{element(el){el.setAttribute('content','RAWI Dev')}})
    .on('meta[name="description"]',{element(el){el.setAttribute('content','RAWI Developers — independent Odoo engineering, module development and AI integration studio.')}})
    .transform(page);
  }
  // Public corporate pages may be indexed; RAWI customer routes and management remain private.
  if((request.method==='GET'||request.method==='HEAD')&&companyPage(url.pathname)&&env.ASSETS){
   const landing=new URL('/',request.url);
   const assets=await env.ASSETS.fetch(new Request(landing,request));
   const robots=url.pathname.startsWith('/mif/console')?'noindex,nofollow':'index,follow';
   if(!(assets.headers.get('content-type')||'').includes('text/html'))return assets;
   return new HTMLRewriter()
    .on('meta[name="robots"]',{element(el){el.setAttribute('content',robots)}})
    .on('meta[name="description"]',{element(el){el.setAttribute('content','MIF Smart develops connected business software. RAWI AI ERP is the first product.')}})
    .on('title',{element(el){el.setInnerContent('MIF Smart | Business Software')}})
    .on('link[rel="icon"]',{element(el){el.setAttribute('href','/mif-app-icon.svg')}})
    .transform(assets);
  }
  return app.fetch(request,env,ctx);
 },
 async scheduled(_controller,env,ctx){if(!env.DATABASE_URL)return;ctx.waitUntil(runErpSchedule(neon(env.DATABASE_URL)).catch(err=>console.error('RAWI task schedule error',err.message)))}
};
