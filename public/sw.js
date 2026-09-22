/*
  GRIT — offline service worker.

  Strategy: precache the app shell on install, then cache-first with a network
  fallback for every same-origin GET (hashed JS/CSS/font/image assets get
  cached the first time they are fetched). SPA navigations fall back to the
  cached shell so the app opens with no network at all after the first visit.
  Dependency-free and scoped automatically to the registration path (/hi/).
*/
const CACHE = 'grit-aqua-v25';
const BASE = self.registration.scope; // e.g. https://host/hi/

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([BASE, BASE + 'index.html', BASE + 'manifest.webmanifest']))
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigations -> serve the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return (
            (await caches.match(BASE + 'index.html')) ||
            (await caches.match(BASE)) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Static assets -> cache-first, populate cache on first fetch.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});
