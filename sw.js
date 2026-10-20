const CACHE_NAME = 'laundry-v3-supabase-real';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-32.png',
  './icon-64.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  console.log('[SW] Install v3');
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activate v3 - cleaning old');
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Jangan cache supabase - biar online real
  if (e.request.url.includes('supabase.co')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request).then(fetchRes => {
        // cache html/css/js saja
        if(e.request.method==='GET' && e.request.url.startsWith(self.location.origin)){
          caches.open(CACHE_NAME).then(cache=>cache.put(e.request, fetchRes.clone()));
        }
        return fetchRes;
      }).catch(()=> {
        // fallback offline cuma untuk navigasi
        if(e.request.mode==='navigate'){
          return caches.match('./index.html');
        }
      });
    })
  );
});
