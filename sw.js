// sw.js — Service Worker — Conejo Malo Global Fan Community
const CACHE_NAME = 'conejomalo-v1';
const ASSETS = [
  '/conejomalo-global/',
  '/conejomalo-global/index.html',
  '/conejomalo-global/community.html',
  '/conejomalo-global/style.css',
  '/conejomalo-global/community.css',
  '/conejomalo-global/script.js',
  '/conejomalo-global/language.js',
  '/conejomalo-global/manifest.json'
];

// Install — cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip Firebase requests — always need network
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
