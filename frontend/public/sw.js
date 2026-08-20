const CACHE_NAME = 'ujrat-v1';
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/favicon-transparent.png',
  '/site.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Exclude Supabase, Sentry, PostHog, Google Fonts, and non-GET requests from caching.
  // Cross-origin font CSS must bypass the SW: the page CSP `connect-src`
  // governs fetch() inside the worker, and a cache-first put() of an
  // opaque/CSP-blocked response breaks the stylesheet load.
  if (
    request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('sentry.io') ||
    url.hostname.includes('posthog.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.pathname.startsWith('/functions/v1') ||
    url.pathname.startsWith('/rest/v1') ||
    url.pathname.startsWith('/auth/v1')
  ) {
    return;
  }

  // Handle navigation requests (HTML pages) - Network-first with offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match('/offline.html') || new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Static assets (images, fonts, stylesheets) - Cache-first with network fallback
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2?|ttf|css)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Default: Network with cache fallback. Never resolve undefined:
  // caches.match() misses resolve to undefined, which throws
  // "Failed to convert value to 'Response'" inside respondWith().
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
      .then((fallback) => fallback || Response.error())
  );
});
