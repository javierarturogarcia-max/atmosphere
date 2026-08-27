/** main.js — Punto de entrada. */
import { iniciar } from './ui/app.js';

const raiz = document.getElementById('app');
if (raiz) {
  raiz.innerHTML = '';
  window.atmosphere = iniciar(raiz);
}

// Registro del service worker para uso sin conexion. Solo se intenta en el
// despliegue completo (el que incluye manifiesto): la version empaquetada en un
// unico archivo no tiene sw.js al lado y pedirlo daria un 404 inutil.
const hayManifiesto = !!document.querySelector('link[rel="manifest"]');
if (hayManifiesto && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* sin PWA, la app sigue funcionando */ });
  });
}
