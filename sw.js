// ═══════════════════════════════════════════════════
//  Service Worker — Conejo Malo Global Fan Community
//  Caches core assets for fast loading & offline use
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'conejomalo-v2';

const CORE_ASSETS = [
  './index.html',
  './community.html',
  './media.html',
  './tickets.html',
  './events.html',
  './connect.html',
  './donate.html',
  './style.css',
  './pwa.js',
  './manifest.json',
];

// ── INSTALL: cache core assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS).catch(err => {
        console.log('Cache partial error (non-critical):', err);
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: network first, cache fallback ──
self.addEventListener('fetch', event => {
  // Skip non-GET, Firebase, Cloudinary and external requests
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('firestore') || url.includes('firebase') ||
      url.includes('cloudinary') || url.includes('googleapis') ||
      url.includes('gstatic') || url.includes('youtube') ||
      url.includes('chrome-extension')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for our own assets
        if (response && response.status === 200 && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback to index for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
