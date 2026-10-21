const CACHE_NAME = 'laundry-v25-final-stable';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-32.png',
  './icon-64.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  console.log('[SW] Install v25 FINAL STABLE - Lebaran Fix');
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(ASSETS.map(url => cache.add(url).catch(()=>{})));
    }).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activate v25 - cleaning ALL old cache');
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('supabase.co') || e.request.url.includes('supabase-js')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        caches.open(CACHE_NAME).then(c=>c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
