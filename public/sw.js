/* ERP app shell only. Never cache HTML containing sign-in or private APIs. */
const CACHE='mif-smart-shell-erp-brand-v6';
const SHELL=['/offline.html','/manifest.webmanifest','/mif-app-icon.svg','/mif-mark.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('mif-smart-')||k.startsWith('mif-'))&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
if(req.mode==='navigate'){event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match('/offline.html')));return}
if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/icons/')||url.pathname==='/mif-logo.svg'||url.pathname==='/mif-mark.svg'||url.pathname==='/mif-app-icon.svg'){event.respondWith(fetch(req).catch(()=>caches.match(req)))}
});
