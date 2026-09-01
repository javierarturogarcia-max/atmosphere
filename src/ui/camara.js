/**
 * camara.js — Grabar la prueba DENTRO de la app.
 *
 * DOS PROBLEMAS DE UNA VEZ.
 *
 * El primero es de comodidad: el atributo `capture` de un <input file> abre la
 * camara en muchos moviles, pero no en todos —hay navegadores que muestran un
 * selector igualmente— y en el escritorio no hace nada. Con getUserMedia la
 * camara se abre siempre, en cualquier dispositivo con una.
 *
 * El segundo es de fondo, y es el que de verdad importa: si el archivo llega
 * por un selector, puede venir de la galeria, de un grupo de mensajeria o de
 * internet. Los metadatos EXIF ayudan, pero se editan con herramientas
 * comunes. Cuando el video lo graba la propia aplicacion no hay archivo previo
 * que elegir: la captura es la prueba. Eso es lo que distingue el sello "en
 * vivo" de cualquier otro nivel de evidencia.
 *
 * Mientras graba, se muestrea el acelerometro. Con eso, correr o caminar se
 * pueden CONFIRMAR (ver cadencia.js). Reciclar o beber agua no: ningun sensor
 * ve eso, y la app no finge lo contrario.
 */
import { el, modal, toast } from './componentes.js';
import { analizarMovimiento } from '../core/cadencia.js';

/** Duracion por defecto de un clip. Suficiente para medir cadencia, corto de subir. */
export const SEGUNDOS_CLIP = 8;

/** Formatos que pedimos al grabador, en orden de preferencia. */
const FORMATOS = [
  'video/mp4;codecs=avc1',      // Safari e iOS
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
];

/** ¿Puede este navegador grabar dentro de la app? */
export function hayCamaraEnApp() {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined';
}

/** Primer formato de video que el navegador acepte de verdad. */
export function formatoSoportado(candidatos = FORMATOS, soporta = null) {
  const test = soporta || ((t) => window.MediaRecorder?.isTypeSupported?.(t));
  for (const t of candidatos) { try { if (test(t)) return t; } catch { /* siguiente */ } }
  return '';
}

/**
 * Pide permiso para leer el acelerometro.
 *
 * iOS 13 lo exige desde un gesto de la persona y devuelve una promesa; el resto
 * de navegadores no piden nada. Si se deniega, no pasa nada: la prueba sigue
 * valiendo, simplemente no habra contraste de movimiento.
 */
export async function permisoMovimiento() {
  const DME = typeof window !== 'undefined' ? window.DeviceMotionEvent : null;
  if (!DME) return false;
  if (typeof DME.requestPermission !== 'function') return true;
  try { return (await DME.requestPermission()) === 'granted'; } catch { return false; }
}

/**
 * Muestrea el acelerometro hasta que se le dice basta.
 * @returns {{parar:() => Array<{x,y,z,t}>}}
 */
export function muestreadorMovimiento(ventana = window) {
  const muestras = [];
  const inicio = Date.now();
  const alMover = (ev) => {
    // `accelerationIncludingGravity` esta disponible en practicamente todo;
    // `acceleration` (sin gravedad) falta en varios navegadores. Se usa la
    // primera y la gravedad se quita despues restando la media, que en una
    // ventana corta es justamente eso.
    const a = ev.accelerationIncludingGravity || ev.acceleration;
    if (!a || a.x === null) return;
    muestras.push({ x: a.x || 0, y: a.y || 0, z: a.z || 0, t: Date.now() - inicio });
  };
  ventana.addEventListener('devicemotion', alMover);
  return {
    parar() {
      ventana.removeEventListener('devicemotion', alMover);
      return muestras;
    },
  };
}

/**
 * Abre la camara y devuelve la prueba grabada.
 *
 * @param {{segundos?:number, modo?:'video'|'foto'}} opciones
 * @returns {Promise<{blob:Blob, tipo:string, enVivo:true, analisis:object}|null>}
 *          null si la persona cancela.
 */
export function abrirCamara({ segundos = SEGUNDOS_CLIP, modo = 'video' } = {}) {
  return new Promise((resolver, rechazar) => {
    let flujo = null;
    let grabador = null;
    let sensor = null;
    let temporizador = null;
    let resuelto = false;

    const video = el('video', { autoplay: '', muted: '', playsinline: '', clase: 'camara-previa' });
    video.muted = true;

    const estado = el('p', { clase: 'pista', texto: 'Pidiendo permiso a la cámara…' });
    const contador = el('div', { clase: 'camara-contador', texto: '' });
    const boton = el('button', { clase: 'btn primario grande bloque', texto: 'Grabando…', disabled: '' });

    const cerrar = modal(el('div', { clase: 'camara' }, [
      el('div', { clase: 'camara-marco' }, [video, contador]),
      estado,
      boton,
    ]), { titulo: modo === 'foto' ? 'Hacer una foto' : 'Grabar la prueba', ancho: 460 });

    const limpiar = () => {
      clearInterval(temporizador);
      try { grabador?.state === 'recording' && grabador.stop(); } catch { /* ya parado */ }
      flujo?.getTracks().forEach((t) => t.stop());
      sensor?.parar();
    };
    const terminar = (valor) => {
      if (resuelto) return;
      resuelto = true;
      limpiar();
      cerrar();
      resolver(valor);
    };

    // Cerrar el modal por fuera equivale a cancelar: sin esto, la camara del
    // telefono se quedaria encendida y el punto rojo del sistema tambien.
    const observador = new MutationObserver(() => {
      if (!document.body.contains(video)) { observador.disconnect(); terminar(null); }
    });
    observador.observe(document.body, { childList: true, subtree: true });

    (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: modo === 'video',
        });
      } catch (e) {
        terminar(null);
        rechazar(new Error(
          e?.name === 'NotAllowedError'
            ? 'No diste permiso a la cámara. Puedes adjuntar un archivo en su lugar.'
            : 'No se pudo abrir la cámara en este dispositivo.'));
        return;
      }
      video.srcObject = flujo;

      const permiso = await permisoMovimiento();
      if (permiso) sensor = muestreadorMovimiento();

      if (modo === 'foto') {
        estado.textContent = permiso
          ? 'Encuadra y pulsa. Se mide también el movimiento.'
          : 'Encuadra y pulsa.';
        boton.textContent = '📸 Hacer la foto';
        boton.disabled = false;
        boton.onclick = async () => {
          boton.disabled = true;
          const lienzo = el('canvas');
          lienzo.width = video.videoWidth || 1280;
          lienzo.height = video.videoHeight || 720;
          lienzo.getContext('2d').drawImage(video, 0, 0, lienzo.width, lienzo.height);
          const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.85));
          const muestras = sensor?.parar() || [];
          sensor = null;
          terminar({ blob, tipo: 'image/jpeg', enVivo: true, analisis: analizarMovimiento(muestras) });
        };
        return;
      }

      const formato = formatoSoportado();
      try {
        grabador = new MediaRecorder(flujo, formato ? { mimeType: formato } : undefined);
      } catch {
        terminar(null);
        rechazar(new Error('Este navegador no puede grabar vídeo. Adjunta un archivo en su lugar.'));
        return;
      }

      const trozos = [];
      grabador.ondataavailable = (ev) => { if (ev.data?.size) trozos.push(ev.data); };
      grabador.onstop = () => {
        const muestras = sensor?.parar() || [];
        sensor = null;
        const tipo = grabador.mimeType || formato || 'video/webm';
        terminar({
          blob: new Blob(trozos, { type: tipo }),
          tipo, enVivo: true, analisis: analizarMovimiento(muestras),
        });
      };

      grabador.start();
      estado.textContent = permiso
        ? 'Grabando. Muévete como en la acción que declaraste.'
        : 'Grabando.';
      let quedan = segundos;
      contador.textContent = `${quedan}`;
      boton.textContent = '⏹ Terminar ya';
      boton.disabled = false;
      boton.onclick = () => { try { grabador.stop(); } catch { terminar(null); } };
      temporizador = setInterval(() => {
        quedan -= 1;
        contador.textContent = `${Math.max(0, quedan)}`;
        if (quedan <= 0) {
          clearInterval(temporizador);
          try { grabador.stop(); } catch { terminar(null); }
        }
      }, 1000);
    })().catch(() => { terminar(null); });
  });
}

/** Envoltorio con aviso: devuelve null y avisa si la camara no esta disponible. */
export async function capturar(opciones) {
  if (!hayCamaraEnApp()) {
    toast({ titulo: 'Sin cámara en la app', tipo: 'alerta', icono: '📷',
      texto: 'Este navegador no permite grabar aquí. Adjunta un archivo con el otro botón.' });
    return null;
  }
  try {
    return await abrirCamara(opciones);
  } catch (e) {
    toast({ titulo: 'No se pudo grabar', texto: e.message, tipo: 'alerta', icono: '📷' });
    return null;
  }
}
