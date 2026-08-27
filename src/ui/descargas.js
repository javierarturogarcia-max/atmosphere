/**
 * descargas.js — Entrega de archivos al usuario en cualquier entorno.
 *
 * La app corre en tres sitios distintos y solo uno admite el truco clasico
 * del enlace <a download>:
 *   - servida por http o abierta como archivo local -> enlace con Blob
 *   - publicada como Artifact -> el visor bloquea las descargas iniciadas por
 *     la pagina; hay que pasar por la capacidad `downloads`, que ademas pide
 *     confirmacion al usuario y puede ser rechazada.
 * Este modulo detecta el entorno y usa la via que funcione, sin que las vistas
 * tengan que saber nada de eso.
 */

/** Extensiones que el visor de Artifacts admite siempre. */
const EXTENSIONES_BASE = new Set(['txt', 'json', 'md', 'csv']);

async function capacidadDescargas() {
  try {
    if (typeof window === 'undefined' || !window.claude || typeof window.claude.use !== 'function') return null;
    return await window.claude.use('downloads');
  } catch {
    return null;
  }
}

/**
 * Entrega un archivo generado.
 * @param {{nombre:string, contenido:string|Blob, tipo?:string}} args
 * @returns {Promise<{ok:boolean, via:string, motivo?:string}>}
 */
export async function descargar({ nombre, contenido, tipo = 'text/plain;charset=utf-8' }) {
  const dl = await capacidadDescargas();

  if (dl) {
    try {
      await dl.save({ filename: nombre, data: contenido });
      return { ok: true, via: 'artifact' };
    } catch (e) {
      const codigo = e?.code || 'unavailable';
      if (codigo === 'declined') return { ok: false, via: 'artifact', motivo: 'Descarga cancelada.' };
      if (codigo === 'extension_not_enabled') {
        // El visor no admite esta extension: se ofrece el mismo contenido
        // como texto plano en vez de dejar al usuario sin nada.
        try {
          await dl.save({ filename: nombre.replace(/\.[^.]+$/, '.txt'), data: contenido });
          return { ok: true, via: 'artifact-txt' };
        } catch {
          return { ok: false, via: 'artifact', motivo: 'Este visor no admite ese tipo de archivo.' };
        }
      }
      if (codigo === 'too_large') return { ok: false, via: 'artifact', motivo: 'El archivo supera el limite de 16 MB.' };
      if (codigo === 'rate_limited') return { ok: false, via: 'artifact', motivo: 'Hay otra descarga en curso. Intentalo de nuevo en unos segundos.' };
      return { ok: false, via: 'artifact', motivo: 'Las descargas no estan disponibles en este visor.' };
    }
  }

  // Entorno normal: enlace con Blob.
  try {
    const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, via: 'blob' };
  } catch (e) {
    return { ok: false, via: 'blob', motivo: 'No se pudo generar el archivo.' };
  }
}

/** Indica si la vista actual puede entregar archivos. */
export async function hayDescargas() {
  if (await capacidadDescargas()) return true;
  return typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
}
