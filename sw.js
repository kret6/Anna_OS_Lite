/* Service worker — jedyny powód jego istnienia to tryb offline.
 *
 * Cache-first, bo ta aplikacja nie ma treści, która by się starzała: silnik i skrypt
 * AED są takie same w Nairobi i w Omsku. Nazwa cache'u niesie wersję — podbicie jej
 * jest JEDYNYM sposobem wypchnięcia aktualizacji, więc trzeba o tym pamiętać przy
 * każdym wydaniu.
 */
var CACHE = 'anna-os-lite-v5';

var FILES = [
  './',
  'index.html',
  'app.js',
  'medicos-core.js',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-180.png',
  'manifest.json',
  // Glos AED wchodzi do cache'u PRZY INSTALACJI, nie przy pierwszym odtworzeniu.
  // Inaczej pierwsze uzycie bez sieci byloby nieme — a pierwsze uzycie bez sieci
  // jest dokladnie tym, pod co ta aplikacja jest zrobiona. To 165 KB; warte tego.
  'audio/ana_1.mp3',
  'audio/ana_2.mp3',
  'audio/ana_3.mp3',
  'audio/ana_4.mp3',
  'audio/cpr_1.mp3',
  'audio/cpr_2.mp3',
  'audio/cpr_3.mp3',
  'audio/noshock.mp3',
  'audio/on_1.mp3',
  'audio/on_2.mp3',
  'audio/on_3.mp3',
  'audio/on_4.mp3',
  'audio/pads_1.mp3',
  'audio/pads_2.mp3',
  'audio/pads_3.mp3',
  'audio/pads_check.mp3',
  'audio/safe.mp3',
  'audio/sh_1.mp3',
  'audio/sh_2.mp3',
  'audio/sh_3.mp3',
  'audio/sh_4.mp3',
  'audio/sh_5.mp3',
  'audio/sh_6.mp3',
  'audio/stop_1.mp3'
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
      return fetch(e.request).then(function (res) { return res; })
             .catch(function () { return hit; });
    })
  );
});
