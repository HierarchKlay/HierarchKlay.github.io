// Scope is dictionary/ only: never intercepts study records, login, sync or Qwen.
const CACHE='kotoba-dictionary-shell-v1-2026-10-13-3d857bea6d30';
const FILES=['./','index.html','dictionary.css','dictionary.mjs','worker.mjs','search.mjs','render.mjs','config.mjs','manifest.json','LICENSE.txt'];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(FILES.map(f=>new Request(new URL(f,self.registration.scope),{cache:'reload'})));await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url),scope=new URL(self.registration.scope);
  if(e.request.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname))return;
  const path=u.pathname.slice(scope.pathname.length);
  if(!['','index.html',...FILES.slice(2)].includes(path))return;
  e.respondWith((async()=>{const c=await caches.open(CACHE);const key=e.request.mode==='navigate'?new URL('index.html',scope).href:new URL(path,scope).href;const hit=await c.match(key);return hit||fetch(e.request);})());
});
