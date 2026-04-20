// EzNihongo Service Worker v5
const CACHE = 'eznihongo-v6';
const SHELL = [
  './', './index.html', './kanji.html', './style.css', './nav.js', './fsrs.js',
  './logo.png', './manifest.json', './level.css', './level.js',
  './login.html', './register.html', './dashboard.html',
  './n5.html', './n4.html', './n3.html', './n2.html', './n1.html',
  './404.html',
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
  // Biarkan Supabase & request eksternal lewat network langsung
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
      // Cache-first untuk shell, network-first untuk halaman lain
      return cached || network;
    })
  );
});
