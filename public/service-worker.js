// The Upper Room — Service Worker v4
// Shell precache + stale-while-revalidate for content pages + cache-first for static assets

const CACHE_VERSION = 'v4';
const CACHE_NAME = `upper-room-${CACHE_VERSION}`;
const OFFLINE_URL = '/the-upper-room/';

const SHELL_URLS = [
  '/the-upper-room/',
  '/the-upper-room/bible/',
  '/the-upper-room/archive/',
  '/the-upper-room/studies/',
  '/the-upper-room/about/',
  '/the-upper-room/manifest.json',
  '/the-upper-room/icons/icon-192.png',
  '/the-upper-room/icons/icon-512.png',
];

// Content pages that use stale-while-revalidate (serve cached, update in background)
const CONTENT_PATHS = [
  '/the-upper-room/lent',
  '/the-upper-room/studies',
  '/the-upper-room/archive',
];

function isContentPage(pathname) {
  return CONTENT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

// Install: pre-cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const results = await Promise.allSettled(
        SHELL_URLS.map(url => cache.add(url).catch(() => null))
      );
      const cached = results.filter(r => r.status === 'fulfilled').length;
      console.log(`[SW] Cached ${cached}/${SHELL_URLS.length} shell URLs`);
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
          .filter((key) => key.startsWith('upper-room-') && key !== CACHE_NAME)
          .map((key) => {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Pass through cross-origin (fonts, Google APIs, etc.)
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;

  // Navigation requests
  if (event.request.mode === 'navigate') {
    // Content pages: stale-while-revalidate
    // Serve cached version immediately; fetch fresh in background to update cache
    if (isContentPage(pathname)) {
      event.respondWith(
        caches.open(CACHE_NAME).then(cache =>
          cache.match(event.request).then(cached => {
            // Always start a background network fetch to keep cache fresh
            const networkFetch = fetch(event.request).then(response => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            }).catch(() => cached || caches.match(OFFLINE_URL));

            // If cached: return immediately, network runs in background
            // If not cached: wait for network
            return cached || networkFetch;
          })
        )
      );
      return;
    }

    // Other navigation: network-first, fall back to cache then offline shell
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

  // Pagefind assets: network-first (index changes after each build)
  if (pathname.includes('/pagefind/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets: cache-first, update in background (stale-while-revalidate)
  // Includes fonts, icons, Bible JSON cache — offline Bible reading preserved
  const isStaticAsset = /\.(css|js|png|svg|ico|woff2?|ttf|jpg|webp|json)(\?.*)?$/.test(pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const networkFetch = fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached);

          // Return cache immediately if available, otherwise wait for network
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Default: network-first with cache fallback
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
