/**
 * sw.js — Service worker: cache-first para que la app funcione sin conexion.
 * Una app ambiental que exige red constante es una contradiccion: cada peticion
 * evitada es energia de red y de centro de datos que no se consume.
 */
const CACHE = 'atmosphere-v1';
const RECURSOS = [
  './', './index.html', './assets/styles.css', './manifest.webmanifest',
  './src/main.js', './src/ui/app.js', './src/ui/componentes.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(RECURSOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
