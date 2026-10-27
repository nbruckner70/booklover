const APP_CACHE = 'booklover-app-v11';
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
  './js/version.js',
  './js/ui.js',
  './js/logic.js',
  './js/store.js',
  './js/api.js',
  './js/covers.js',
  './js/templates.js',
  './js/views/library.js',
  './js/views/series.js',
  './js/views/random.js',
  './js/views/settings.js',
  './js/dialogs/edit.js',
  './js/dialogs/add.js'
];

self.addEventListener('install', e => {
  // cache: 'reload' holt die Dateien am Zwischenspeicher von Chrome vorbei, sonst mischen sich alte und neue Versionen
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' })))));
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

  // Eigene Dateien: zuerst aus dem Netz (damit Updates ankommen), offline aus dem Speicher.
  // no-cache: beim Server nachfragen, ob sich die Datei geändert hat, statt eine alte Kopie zu nehmen.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(r => {
          const copy = r.clone();
          caches.open(APP_CACHE).then(c => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cover-Bilder: einmal laden, danach auch offline verfügbar
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
