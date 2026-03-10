// The Upper Room — Service Worker v2
// Network-first with offline shell fallback

const CACHE_NAME = 'upper-room-v2';
const OFFLINE_URL = '/the-upper-room/';

const SHELL_URLS = [
  '/the-upper-room/',
  '/the-upper-room/bible/',
  '/the-upper-room/archive/',
  '/the-upper-room/studies/',
  '/the-upper-room/about/',
  '/the-upper-room/manifest.json',
];

// Install: pre-cache shell pages individually so partial failures don't block
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache each URL individually — don't fail on missing assets
      const results = await Promise.allSettled(
        SHELL_URLS.map(url => cache.add(url).catch(() => null))
      );
      const cached = results.filter(r => r.status === 'fulfilled').length;
      console.log(`SW: Cached ${cached}/${SHELL_URLS.length} shell URLs`);
    })
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for navigation + same-origin, cache-first for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip external ESV API calls
  if (url.hostname === 'api.esv.org') return;

  // Skip cross-origin requests (fonts, etc.)
  if (url.origin !== self.location.origin) return;

  // For navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // For static assets (.css, .js, .png, etc.) — cache-first after first visit
  const isStaticAsset = /\.(css|js|png|svg|ico|woff2?|ttf|jpg|webp)(\?.*)?$/.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => cached || caches.match(OFFLINE_URL))
      )
  );
});
