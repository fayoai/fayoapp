/* RAWI Developers standalone scope: no API or authenticated HTML caching. */
const CACHE='rawi-developers-shell-v1';
const SHELL=['/developers/manifest.webmanifest','/developers/rawi-dev-mark.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rawi-developers-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const u=new URL(req.url);if(u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;if(req.mode==='navigate'){event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>new Response('RAWI Developers requires a network connection to sign in.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}})));return}if(u.pathname.startsWith('/developers/')||u.pathname.startsWith('/assets/')){event.respondWith(fetch(req).catch(()=>caches.match(req)))}});
