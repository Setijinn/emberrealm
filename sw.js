const CACHE = 'emberrealm-v137';
const ASSETS = ['.', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  // drop every old-version cache so the fresh build's assets get fetched clean
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
// CACHE-FIRST: serve assets instantly from cache; only hit the network on a miss
// (then store it). Freshness is handled by the CACHE version bump on each deploy —
// the activate step above deletes old caches, so a new build re-fetches everything once
// and then loads instantly on every subsequent visit. Much faster than re-fetching every
// asset over the network on every load (the old network-first behaviour).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
