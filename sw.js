const CACHE = 'emberrealm-v198';
const ASSETS = ['.', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  // drop every old-version cache so a fresh build never mixes with stale files
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Split strategy so code can never go stale-mismatched (the cause of "errors on
// launch after a deploy"), while heavy art still loads instantly:
//   * CODE (page navigations + .js) -> NETWORK-FIRST: always fetch the current
//     build; fall back to cache only when offline. index.html and every module
//     therefore always match each other.
//   * ASSETS (sprites/images/fonts/etc) -> CACHE-FIRST: instant, fetched once.
function isCode(req, url) {
  return req.mode === 'navigate' || /\.(js|mjs)(\?|$)/.test(url.pathname);
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && isCode(req, url)) {
    // network-first: freshest code wins; cache is only an offline fallback
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() =>
        caches.match(req).then(hit => hit || caches.match('index.html'))
      )
    );
    return;
  }

  // cache-first for everything else (art, fonts, etc.)
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
