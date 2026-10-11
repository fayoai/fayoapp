/* RAWI Developer PWA: own scope and immutable public shell only, never private routes. */
const CACHE='rawi-developer-shell-v8';
const SHELL=['/developer/offline.html','/developer/manifest.webmanifest','/rawi-developer-mark.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rawi-developer-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match('/developer/offline.html')));return}
 if(url.pathname==='/developer/manifest.webmanifest'||url.pathname==='/rawi-developer-mark.svg'){event.respondWith(fetch(req).catch(()=>caches.match(req)))}
});
