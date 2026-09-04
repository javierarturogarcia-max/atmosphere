/**
 * sw.js — Service worker: la app sigue funcionando sin conexion.
 *
 * ESTRATEGIA: red primero, cache como respaldo.
 *
 * La version anterior hacia lo contrario —cache primero— con un nombre de
 * cache fijo, y eso tenia una consecuencia grave: quien ya habia abierto la
 * aplicacion una vez seguia recibiendo el codigo viejo PARA SIEMPRE. Cada
 * despliegue nuevo era invisible para los usuarios existentes. Se detecto
 * porque una pestana recien anadida no aparecia en el navegador de nadie que
 * ya hubiera visitado la app.
 *
 * Con "red primero" el comportamiento es el correcto para una aplicacion que
 * se despliega a menudo: si hay conexion siempre se sirve la version actual, y
 * la cache solo entra en juego cuando no hay red. Se pierde algun milisegundo
 * de carga; se gana que el codigo publicado sea el que la gente ejecuta.
 */
const CACHE = 'atmosphere-v2';

const RECURSOS = [
  './', './index.html', './assets/styles.css', './manifest.webmanifest',
  './src/main.js', './src/ui/app.js', './src/ui/componentes.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Uno a uno y tolerando fallos: con addAll, un solo recurso ausente
    // aborta la instalacion entera y deja la app sin funcionar sin conexion.
    await Promise.all(RECURSOS.map((r) => cache.add(r).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Lo de fuera del propio origen (tipografias, API del aire) va directo a la
  // red: cachearlo aqui no aporta y complica la invalidacion.
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      }
      return res;
    } catch {
      // Sin red: se responde con lo ultimo que se guardo.
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      // Una navegacion sin cache propia cae en el documento principal, para
      // que la aplicacion arranque igualmente y trabaje con datos locales.
      if (req.mode === 'navigate') {
        const inicio = await caches.match('./index.html') || await caches.match('./');
        if (inicio) return inicio;
      }
      return new Response('Sin conexion y sin copia guardada.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});

// Permite que la pagina fuerce la activacion inmediata de una version nueva.
self.addEventListener('message', (e) => {
  if (e.data === 'actualizar') self.skipWaiting();
});
