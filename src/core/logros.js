/**
 * logros.js (core) — Evaluacion de insignias.
 * Se ejecuta tras cada registro: compara el estado de logros guardado con la
 * evaluacion actual y devuelve los recien desbloqueados para notificarlos.
 */
import { LOGROS, NIVELES_LOGRO, logro } from '../data/logros.js';

/** Evalua todos los logros contra un resumen. */
export function evaluarLogros(resumen, desbloqueadosPrevios = []) {
  const previos = new Set(desbloqueadosPrevios.map((d) => (typeof d === 'string' ? d : d.id)));
  const estado = LOGROS.map((l) => {
    const cumple = safe(() => l.condicion(resumen), false);
    const [actual, objetivo] = safe(() => l.progreso(resumen), [0, 1]);
    return {
      id: l.id,
      titulo: l.titulo,
      icono: l.icono,
      nivel: l.nivel,
      desc: l.desc,
      meta: NIVELES_LOGRO[l.nivel],
      desbloqueado: cumple || previos.has(l.id),
      nuevo: cumple && !previos.has(l.id),
      actual: Math.min(Number(actual) || 0, Number(objetivo) || 1),
      objetivo: Number(objetivo) || 1,
      progreso: Math.min(1, (Number(actual) || 0) / (Number(objetivo) || 1)),
    };
  });
  return {
    estado,
    nuevos: estado.filter((e) => e.nuevo),
    desbloqueados: estado.filter((e) => e.desbloqueado).length,
    total: LOGROS.length,
    xpGanada: estado.filter((e) => e.nuevo).reduce((s, e) => s + (e.meta?.xp || 0), 0),
  };
}

/** Logros mas cercanos a completarse: excelente gancho motivacional. */
export function proximosLogros(estadoLogros, n = 3) {
  return estadoLogros
    .filter((e) => !e.desbloqueado && e.progreso > 0)
    .sort((a, b) => b.progreso - a.progreso)
    .slice(0, n);
}

/** Recuento por nivel de insignia. */
export function resumenPorNivel(estadoLogros) {
  const out = {};
  for (const nivel of Object.keys(NIVELES_LOGRO)) {
    const total = estadoLogros.filter((e) => e.nivel === nivel).length;
    const hechos = estadoLogros.filter((e) => e.nivel === nivel && e.desbloqueado).length;
    out[nivel] = { total, hechos, meta: NIVELES_LOGRO[nivel] };
  }
  return out;
}

/** Puntuacion de completitud 0..100 ponderada por dificultad del nivel. */
export function completitud(estadoLogros) {
  const peso = { bronce: 1, plata: 2, oro: 4, platino: 8 };
  let obtenido = 0, maximo = 0;
  for (const e of estadoLogros) {
    maximo += peso[e.nivel] || 1;
    if (e.desbloqueado) obtenido += peso[e.nivel] || 1;
  }
  return maximo === 0 ? 0 : Math.round((obtenido / maximo) * 100);
}

function safe(fn, porDefecto) {
  try {
    const v = fn();
    return v === undefined || v === null ? porDefecto : v;
  } catch { return porDefecto; }
}

export { logro };
