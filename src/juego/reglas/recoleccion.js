/**
 * recoleccion.js — Buscar comida y materiales en el monte.
 *
 * Lo que sale depende del sitio, del mes, de lo que el nino ya sabe reconocer
 * y de si llovio hace poco (los hongos no salen en seco). No es un boton de
 * "dame cosas": es la razon por la que merece la pena aprender el valle.
 */
import { HALLAZGOS, LENA } from '../contenido/plantas.js';
import { limitar, mezclar } from '../nucleo/mate.js';

/** Hallazgos posibles ahora mismo, con su peso ya ajustado. */
export function posibles(ctx) {
  const { fuente, zona, mes, sabe = new Set(), especie = null, lluviaReciente = false } = ctx;
  return HALLAZGOS.filter((h) => {
    if (h.fuente !== fuente) return false;
    if (h.especie && especie && h.especie !== especie) return false;
    if (h.zonas && zona && !h.zonas.includes(zona)) return false;
    if (h.meses && h.meses.length && mes != null && !h.meses.includes(mes)) return false;
    if (h.requiere && !sabe.has(h.requiere)) return false;
    if (h.trasLluvia && !lluviaReciente) return false;
    return true;
  });
}

/**
 * Rebusca una vez.
 * @param {object} ctx {fuente, zona, mes, sabe, bono, rnd, lluviaReciente, especie}
 * @returns {{objetos:[{id,cantidad}], xp:number, vacio:boolean}}
 */
export function buscar(ctx) {
  const rnd = ctx.rnd || Math.random;
  const bono = ctx.bono ?? 1;
  const lista = posibles(ctx);
  if (!lista.length) return { objetos: [], xp: 1, vacio: true, motivo: 'Aquí no hay nada que servir.' };

  // Cuantos hallazgos: casi siempre uno, a veces dos, con suerte tres.
  const suerte = rnd() * bono;
  const cuantos = suerte > 1.15 ? 3 : suerte > 0.78 ? 2 : suerte > 0.16 ? 1 : 0;
  if (!cuantos) return { objetos: [], xp: 1, vacio: true, motivo: 'Esta vez no encontraste nada.' };

  const objetos = [];
  let xp = 0;
  for (let k = 0; k < cuantos; k++) {
    const h = elegirPonderado(lista, rnd);
    const [a, b] = h.cantidad;
    const cantidad = Math.max(1, Math.round(mezclar(a, b, limitar(rnd() * bono, 0, 1))));
    const ya = objetos.find((o) => o.id === h.objeto);
    if (ya) ya.cantidad += cantidad;
    else objetos.push({ id: h.objeto, cantidad, hallazgo: h.id });
    xp += h.xp;
  }
  return { objetos, xp: Math.round(xp * mezclar(1, 1.35, limitar(bono - 1, 0, 1))), vacio: false };
}

function elegirPonderado(lista, rnd) {
  let total = 0;
  for (const h of lista) total += h.peso;
  let r = rnd() * total;
  for (const h of lista) { r -= h.peso; if (r <= 0) return h; }
  return lista[lista.length - 1];
}

/**
 * Junta lena. Del suelo salen rajas; de un tronco caido, el tronco entero,
 * que luego se raja con machete (mas peso, mas rendimiento: esa es la
 * decision).
 */
export function juntarLena(modo, ctx = {}) {
  const rnd = ctx.rnd || Math.random;
  const receta = LENA[modo];
  if (!receta) return { ok: false, motivo: 'No sabes hacer eso.' };
  if (receta.requiereMachete && !ctx.tieneMachete) {
    return { ok: false, motivo: 'Hace falta un machete para rajar el tronco.' };
  }
  const [a, b] = receta.cantidad;
  const bono = ctx.bono ?? 1;
  const cantidad = Math.max(1, Math.round(mezclar(a, b, rnd()) * (modo === 'suelo' ? bono : 1)));
  return { ok: true, objetos: [{ id: receta.objeto, cantidad }], xp: receta.xp };
}

/** Dias que tarda en volver a haber fruta o mora en el mismo sitio. */
export const DIAS_REGENERACION = { frutal: 3, mata: 2, monte: 1, ribera: 1, casa: 1, tronco: 5 };

export function disponible(recurso, dia) {
  return !recurso.agotadoHasta || dia >= recurso.agotadoHasta;
}

export function agotar(recurso, dia, fuente) {
  recurso.agotadoHasta = dia + (DIAS_REGENERACION[fuente] ?? 2);
  return recurso;
}
