const APP_CACHE = 'booklover-app-v3';
const COVER_CACHE = 'lesestapel-covers';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './css/theme.css',
  './css/base.css',
  './css/views.css',
  './css/dialogs.css',
  './js/main.js',
  './js/ui.js',
  './js/logic.js',
  './js/store.js',
  './js/api.js',
  './js/templates.js',
  './js/views/library.js',
  './js/views/series.js',
  './js/views/random.js',
  './js/views/settings.js',
  './js/dialogs/edit.js',
  './js/dialogs/add.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== APP_CACHE && k !== COVER_CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const copy = r.clone();
          caches.open(APP_CACHE).then(c => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  if (e.request.destination === 'image') {
    e.respondWith(
      caches.open(COVER_CACHE).then(async c => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        try {
          const r = await fetch(e.request);
          c.put(e.request, r.clone());
          return r;
        } catch (err) {
          return Response.error();
        }
      })
    );
  }
});
