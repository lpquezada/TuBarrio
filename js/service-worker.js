const cacheName = 'doorloop-cache-v1';
const assetsToCache = [
  './',
  './index.html',
  './dashboard.html',
  './css/style.css',
  './js/auth.js',
  './js/app.js',
  './manifest.json',
  './img/icon-192.png',
  './img/icon-512.png'
];

// Install service worker and cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(assetsToCache);
    })
  );
});

// Activate service worker and remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== cacheName).map(key => caches.delete(key))
      );
    })
  );
});

// Fetch event: respond from cache, then network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});