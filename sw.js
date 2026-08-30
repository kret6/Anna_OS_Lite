/* Service worker — jedyny powód jego istnienia to tryb offline.
 *
 * Cache-first, bo ta aplikacja nie ma treści, która by się starzała: silnik i skrypt
 * AED są takie same w Nairobi i w Omsku. Nazwa cache'u niesie wersję — podbicie jej
 * jest JEDYNYM sposobem wypchnięcia aktualizacji, więc trzeba o tym pamiętać przy
 * każdym wydaniu.
 */
var CACHE = 'anna-os-lite-v1';

var FILES = [
  './',
  'index.html',
  'app.js',
  'medicos-core.js',
  'icon.svg',
  'manifest.json'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) {
      return k === CACHE ? null : caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        // Nagrania głosu AED dochodzą do cache'u dopiero przy pierwszym odtworzeniu,
        // żeby brak pliku nie wywracał instalacji (aplikacja działa bez nich).
        if (res && res.ok && e.request.url.indexOf('/audio/') >= 0) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});
