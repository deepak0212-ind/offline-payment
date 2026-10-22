// Offline Payment System Service Worker for offline application caching
const CACHE_NAME = 'offlinepay-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Pre-cache asset warning:', err);
      });
    })
  );
  self.skipWaiting();
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
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Let /api calls go through network directly so client-side Axios/IndexedDB handles offline
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Only intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle SPA navigation requests (e.g. /wallet, /dashboard)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached =
            (await caches.match(event.request)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (cached) {
            return cached;
          }
          return new Response(
            '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>OfflinePay</title></head><body><h2>Offline Mode Active</h2><p>Application shell is loading. Please reload or reconnect.</p></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html' },
            }
          );
        })
    );
    return;
  }

  // Handle static assets (CSS, JS, fonts, images)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          return new Response('Resource unavailable offline.', {
            status: 404,
            statusText: 'Not Found',
            headers: new Headers({ 'Content-Type': 'text/plain' }),
          });
        });
    })
  );
});
