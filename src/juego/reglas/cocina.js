/**
 * cocina.js — El fogon y el taller.
 *
 * Cocinar convierte lo crudo en comida que de verdad alimenta y anima, pero
 * gasta lena y tiempo del dia. Ese es el intercambio: el nino puede comerse un
 * mango de camino, o llegar a casa y hacer algo que rinda para todos.
 */
import { RECETAS, receta } from '../contenido/recetas.js';
import { OBJETOS } from '../contenido/objetos.js';
import { cuenta, quitar, agregar } from './inventario.js';

/** Recetas que el nino ya sabe hacer. */
export function disponibles(tipo, sabe = new Set()) {
  return RECETAS.filter((r) => r.tipo === tipo && (!r.requiere || sabe.has(r.requiere)));
}

/**
 * Comprueba si se puede cocinar.
 * @returns {{ok, faltan:[{id,cantidad}], receta}}
 */
export function puedeCocinar(idReceta, inv, ctx = {}) {
  const r = receta(idReceta);
  if (!r) return { ok: false, motivo: 'Esa receta no existe.' };
  if (r.requiere && !(ctx.sabe || new Set()).has(r.requiere)) {
    return { ok: false, receta: r, motivo: 'Todavía no sabes hacer eso.' };
  }
  if (r.herramienta && !cuenta(inv, r.herramienta)) {
    return { ok: false, receta: r, motivo: `Hace falta: ${OBJETOS[r.herramienta]?.nombre || r.herramienta}.` };
  }
  const faltan = [];
  for (const [id, n] of Object.entries(r.ingredientes)) {
    const hay = cuenta(inv, id) + (ctx.despensa ? cuenta(ctx.despensa, id) : 0);
    if (hay < n) faltan.push({ id, cantidad: n - hay, nombre: OBJETOS[id]?.nombre || id });
  }
  const lenaHay = cuenta(inv, 'lena') + (ctx.despensa ? cuenta(ctx.despensa, 'lena') : 0);
  if ((r.lena || 0) > lenaHay) {
    faltan.push({ id: 'lena', cantidad: r.lena - lenaHay, nombre: 'Leña' });
  }
  return { ok: faltan.length === 0, faltan, receta: r };
}

/**
 * Cocina de verdad: consume del inventario y, si falta, de la despensa.
 * @returns {{ok, produce, xp, minutos}}
 */
export function cocinar(idReceta, inv, ctx = {}) {
  const comprobacion = puedeCocinar(idReceta, inv, ctx);
  if (!comprobacion.ok) return { ok: false, ...comprobacion };
  const r = comprobacion.receta;
  const gastar = (id, n) => {
    const delBolso = quitar(inv, id, n);
    if (delBolso < n && ctx.despensa) quitar(ctx.despensa, id, n - delBolso);
  };
  for (const [id, n] of Object.entries(r.ingredientes)) gastar(id, n);
  if (r.lena) gastar('lena', r.lena);

  const res = agregar(inv, r.produce.id, r.produce.cantidad, ctx.nivelFuerza ?? 1);
  const sobra = r.produce.cantidad - res.anadido;
  if (sobra > 0 && ctx.despensa) agregar(ctx.despensa, r.produce.id, sobra, 999);
  return {
    ok: true, receta: r, xp: r.xp, minutos: r.minutos,
    produce: { id: r.produce.id, cantidad: r.produce.cantidad },
    aBolso: res.anadido, aDespensa: sobra,
    texto: `${r.produce.cantidad} × ${OBJETOS[r.produce.id]?.nombre || r.produce.id}`,
  };
}
