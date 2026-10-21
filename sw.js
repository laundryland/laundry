const CACHE_NAME = 'laundry-v21-fix-pin-bulletproof';
const ASSETS = [
  '/',
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
  console.log('[SW] Install v21 bulletproof');
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activate v21 - cleaning all old cache');
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('supabase.co') || e.request.url.includes('supabase-js')) {
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        caches.open(CACHE_NAME).then(cache=>cache.put(e.request, res.clone()));
        return res;
      }).catch(() => {
        return caches.match('/').then(r => r || caches.match('./index.html')).then(r => r || caches.match('./'));
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request).then(fetchRes => {
        if(e.request.method==='GET' && e.request.url.startsWith(self.location.origin)){
          caches.open(CACHE_NAME).then(cache=>cache.put(e.request, fetchRes.clone()));
        }
        return fetchRes;
      });
    })
  );
});
