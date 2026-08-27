/**
 * medios.js — Captura y almacenamiento de fotos y videos de prueba.
 *
 * Dos decisiones de almacenamiento que importan:
 *
 * 1. NO se guarda el archivo original de las fotos, sino una miniatura de
 *    1024 px al 72 % de calidad. Una foto de movil pesa entre 3 y 8 MB y
 *    localStorage tiene un limite de unos 5 MB EN TOTAL: guardar originales
 *    reventaria la aplicacion al tercer registro. La miniatura ronda los
 *    120 kB y sigue siendo prueba visual perfectamente valida.
 *
 * 2. Los binarios van a IndexedDB, no a localStorage. localStorage es
 *    sincrono, solo admite texto y tiene un limite minusculo; IndexedDB
 *    guarda Blobs y dispone de mucho mas espacio. En el estado del perfil
 *    solo queda el identificador.
 *
 * Los metadatos EXIF se leen del archivo ORIGINAL antes de reescalarlo, porque
 * el canvas los descarta al redibujar.
 */
import { leerEXIF, hashPercepcion } from '../core/evidencia.js';

const BD = 'atmosphere-medios';
const ALMACEN = 'medios';
const VERSION = 1;

/** Limites: por archivo y para el conjunto del perfil. */
export const LIMITE_ARCHIVO_MB = 25;
export const PRESUPUESTO_TOTAL_MB = 150;
const ANCHO_MINIATURA = 1024;

let promesaBD = null;

function abrirBD() {
  if (promesaBD) return promesaBD;
  promesaBD = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Este navegador no admite IndexedDB.')); return; }
    const req = indexedDB.open(BD, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ALMACEN)) db.createObjectStore(ALMACEN, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('No se pudo abrir el almacen de medios.'));
  });
  return promesaBD;
}

function transaccion(modo, fn) {
  return abrirBD().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN, modo);
    const store = tx.objectStore(ALMACEN);
    let resultado;
    try { resultado = fn(store); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(resultado && resultado.result !== undefined ? resultado.result : resultado);
    tx.onerror = () => reject(tx.error);
  }));
}

export async function guardarMedio(registro) {
  return transaccion('readwrite', (s) => s.put(registro));
}

export async function leerMedio(id) {
  return transaccion('readonly', (s) => s.get(id));
}

export async function borrarMedio(id) {
  return transaccion('readwrite', (s) => s.delete(id));
}

export async function listarMedios() {
  return transaccion('readonly', (s) => s.getAll());
}

/** Espacio ocupado por las pruebas guardadas, en MB. */
export async function espacioUsadoMB() {
  try {
    const todos = await listarMedios();
    const bytes = todos.reduce((s, m) => s + (m.blob?.size || 0), 0);
    return Math.round((bytes / 1048576) * 10) / 10;
  } catch { return 0; }
}

/** Elimina las pruebas que ya no pertenecen a ningun registro vivo. */
export async function limpiarHuerfanos(idsVivos) {
  const vivos = new Set(idsVivos);
  const todos = await listarMedios();
  let borrados = 0;
  for (const m of todos) {
    if (!vivos.has(m.registroId)) { await borrarMedio(m.id); borrados++; }
  }
  return borrados;
}

/** Lee un File como ArrayBuffer. */
function comoBuffer(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    fr.readAsArrayBuffer(file);
  });
}

/** Carga un File en un elemento <img> ya decodificado. */
function comoImagen(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ img, revocar: () => URL.revokeObjectURL(url) }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('El archivo no es una imagen legible.')); };
    img.src = url;
  });
}

/**
 * Procesa una foto: miniatura, hash perceptual y metadatos.
 * @returns {Promise<{tipo:'foto', blob:Blob, url:string, hash:string, exif:object,
 *                    ancho:number, alto:number, bytes:number, fechaArchivo:number}>}
 */
export async function procesarFoto(file) {
  if (file.size > LIMITE_ARCHIVO_MB * 1048576) {
    throw new Error(`La foto pesa ${(file.size / 1048576).toFixed(1)} MB y el limite es ${LIMITE_ARCHIVO_MB} MB.`);
  }
  // El EXIF se lee del original: el canvas lo elimina al redibujar.
  const exif = leerEXIF(await comoBuffer(file)) || {};
  const { img, revocar } = await comoImagen(file);

  try {
    const escala = Math.min(1, ANCHO_MINIATURA / Math.max(img.width, img.height));
    const ancho = Math.max(1, Math.round(img.width * escala));
    const alto = Math.max(1, Math.round(img.height * escala));

    const lienzo = document.createElement('canvas');
    lienzo.width = ancho; lienzo.height = alto;
    lienzo.getContext('2d').drawImage(img, 0, 0, ancho, alto);

    // Huella perceptual: 8x8 en escala de grises con luminancia Rec. 601.
    const chico = document.createElement('canvas');
    chico.width = 8; chico.height = 8;
    const ctx = chico.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 8, 8);
    const px = ctx.getImageData(0, 0, 8, 8).data;
    const grises = [];
    for (let i = 0; i < px.length; i += 4) {
      grises.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    }

    const blob = await new Promise((res) => lienzo.toBlob(res, 'image/jpeg', 0.72));
    if (!blob) throw new Error('No se pudo generar la miniatura.');

    return {
      tipo: 'foto',
      blob,
      url: URL.createObjectURL(blob),
      hash: hashPercepcion(grises),
      exif,
      ancho: img.width,
      alto: img.height,
      bytes: file.size,
      fechaArchivo: file.lastModified || null,
      nombre: file.name,
    };
  } finally {
    revocar();
  }
}

/**
 * Procesa un video: se guarda el archivo y se extrae un fotograma de portada.
 * Un video del momento es mucho mas costoso de falsificar que una foto, por eso
 * puntua mas, pero tambien ocupa mucho mas: de ahi el limite por archivo.
 */
export async function procesarVideo(file) {
  if (file.size > LIMITE_ARCHIVO_MB * 1048576) {
    throw new Error(`El video pesa ${(file.size / 1048576).toFixed(1)} MB y el limite es ${LIMITE_ARCHIVO_MB} MB. Graba un clip mas corto.`);
  }
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  const meta = await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve({ duracion: video.duration, ancho: video.videoWidth, alto: video.videoHeight });
    video.onerror = () => reject(new Error('El archivo no es un video legible.'));
    video.src = url;
  });

  // Portada del segundo 0,5 (o del principio si el clip es mas corto).
  let portada = null;
  try {
    await new Promise((resolve) => {
      video.onseeked = resolve;
      video.currentTime = Math.min(0.5, Math.max(0, (meta.duracion || 1) / 2));
      setTimeout(resolve, 2500); // no bloquear si el navegador no emite el evento
    });
    const escala = Math.min(1, ANCHO_MINIATURA / Math.max(meta.ancho || 1, meta.alto || 1));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round((meta.ancho || 320) * escala));
    lienzo.height = Math.max(1, Math.round((meta.alto || 240) * escala));
    lienzo.getContext('2d').drawImage(video, 0, 0, lienzo.width, lienzo.height);
    portada = lienzo.toDataURL('image/jpeg', 0.6);
  } catch { /* sin portada, el video sigue valiendo */ }

  URL.revokeObjectURL(url);

  return {
    tipo: 'video',
    blob: file,
    url: URL.createObjectURL(file),
    portada,
    hash: null, // el hash perceptual es para imagenes fijas
    exif: {},
    duracion: Math.round((meta.duracion || 0) * 10) / 10,
    ancho: meta.ancho || null,
    alto: meta.alto || null,
    bytes: file.size,
    fechaArchivo: file.lastModified || null,
    nombre: file.name,
  };
}

/** Enruta segun el tipo MIME del archivo. */
export async function procesarMedio(file) {
  if (!file) throw new Error('No se recibio ningun archivo.');
  if (file.type.startsWith('video/')) return procesarVideo(file);
  if (file.type.startsWith('image/')) return procesarFoto(file);
  throw new Error('Solo se admiten imagenes y videos.');
}

/** Crea el selector de archivo con captura directa de camara en movil. */
export function selectorMedio(alElegir, { video = true } = {}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = video ? 'image/*,video/*' : 'image/*';
  // En movil abre la camara trasera directamente en vez del carrete.
  input.capture = 'environment';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) alElegir(f);
    input.value = '';
  });
  return input;
}
