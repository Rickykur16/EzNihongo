// EzNihongo App Service Worker
const CACHE = 'eznihongo-app-v8';
const SHELL = [
  './',
  './index.html',
  './kanji.html',
  './login.html',
  './register.html',
  './auth-callback.html',
  './style.css',
  './level.css',
  './nav.js',
  './analytics.js',
  './fsrs.js',
  './modules.js',
  './modules.json',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached || caches.match('./kanji.html'));
      return cached || network;
    })
  );
});
