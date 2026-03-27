// sw.js — Service Worker for offline caching

const CACHE = 'solaris-v2';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './src/css/main.css',
  './src/js/app.js',
  './src/js/sun-engine.js',
  './src/js/sun-path-scene.js',
  './src/js/buildings.js',
  './src/js/map-renderer.js',
  './src/js/ar-renderer.js',
  './src/js/scrubber.js',
  './src/js/location.js',
  './src/js/compass.js',
  './src/js/camera.js',
  './src/js/sw-register.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/suncalc/1.9.0/suncalc.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for Overpass API (live data), cache-first for everything else
  const url = new URL(e.request.url);
  if (url.hostname.includes('overpass-api.de')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('[]', { headers: { 'Content-Type': 'application/json' }}))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
