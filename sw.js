// Caché únicamente de recursos públicos. Nunca cachear datos privados de Supabase.
const CACHE='buzon-cupissa-shell-v7';
const SHELL=['./','./index.html','./app.js','./logo.png','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 if(!SHELL.some(path=>new URL(path,self.registration.scope).pathname===u.pathname))return;
 e.respondWith(fetch(e.request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}
   return response;
 }).catch(()=>caches.match(e.request)));
});
