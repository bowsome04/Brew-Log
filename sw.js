// Service worker: lets Brew Log open and work with no connection.
// Network first (so updates arrive automatically), cache as the offline fallback.
const CACHE = 'brew-log-shell-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/util.js',
  './js/db.js',
  './js/data.js',
  './js/router.js',
  './js/flavors.js',
  './js/wheel.js',
  './js/charts.js',
  './js/views/brews.js',
  './js/views/beans.js',
  './js/views/grinders.js',
  './js/views/insights.js',
  './js/views/settings.js',
  './js/views/taste.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const withTimeout = (p, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('timeout')), ms);
  p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await withTimeout(fetch(req), 4000);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = (await cache.match(req, { ignoreSearch: true }))
        || (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
      if (hit) return hit;
      throw err;
    }
  })());
});
