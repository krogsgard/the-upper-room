// The Upper Room — Service Worker
// Caches the shell for offline reading

const CACHE_NAME = 'upper-room-v1';
const SHELL_URLS = [
  '/the-upper-room/',
  '/the-upper-room/bible/',
  '/the-upper-room/archive/',
  '/the-upper-room/studies/',
  '/the-upper-room/about/',
  '/the-upper-room/manifest.json',
];

// Install: cache the shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_URLS).catch(err => {
        console.log('SW: Shell cache partial failure (expected in dev):', err);
      });
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
    )
  );
  self.clients.claim();
});

// Fetch: network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for our origin
  if (event.request.method !== 'GET') return;
  if (!event.request.url.includes('/the-upper-room/')) return;

  // Bible API calls — network only
  if (event.request.url.includes('api.esv.org')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Fallback for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/the-upper-room/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
