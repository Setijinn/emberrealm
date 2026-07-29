// TWO CACHES, VERSIONED SEPARATELY. There used to be one, and the standing rule was to bump it
// on every commit -- done 330 times. But .js and navigations are NETWORK-FIRST here (see below),
// so code could never go stale on its own; the only thing the bump achieved was that `activate`
// deleted the cache holding 38MB of art, forcing every player to re-download all of it. Art is
// content-addressed by filename and changes when a file changes, so it needs its own version
// that moves only when the art does.
const CODE_CACHE = 'emberrealm-code-v548';   // bump freely; holds html/css/js only
const ART_CACHE  = 'emberrealm-art-v2';      // bump ONLY when art is added/replaced
const CACHE = CODE_CACHE;                    // install/precache target
const ASSETS = ['.', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
// Media, wherever it lives. Deliberately keyed on the EXTENSION and not on the folder: the first
// version of this said "anything under assets/", which quietly routed assets/font/pixelify.css --
// a stylesheet -- into the cache-first art cache, so an edit to it was invisible until the art
// version moved. Code is code wherever it is stored.
function isArt(url){ const p=url.pathname;
  if(/\.(css|js|mjs|html?|json|webmanifest)(\?|$)/i.test(p)) return false;
  return /\.(png|jpg|jpeg|gif|webp|svg|woff2?|ttf|otf|mp3|ogg|wav)(\?|$)/i.test(p); }

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  // drop every old-version cache so a fresh build never mixes with stale files
  // Drop stale CODE caches only. The art cache is deliberately left alone -- that is the whole
  // point of splitting them.
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CODE_CACHE && k !== ART_CACHE).map(k => caches.delete(k)))
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

  // cache-first for everything else. Art goes in ART_CACHE so a code bump never evicts it;
  // anything else same-origin (style.css) rides the code cache and refreshes with it.
  const store = isArt(url) ? ART_CACHE : CODE_CACHE;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(store).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
