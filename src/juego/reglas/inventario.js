/**
 * inventario.js — Lo que se lleva encima y lo que pesa.
 *
 * La carga no es un numero de huecos sino kilos: se puede llevar mucha fruta o
 * poca agua, y el peso frena al andar. Esa es la decision que hace interesante
 * ir al rio: cuantos litros traigo antes de quedarme sin fuerzas.
 */
import { OBJETOS, pesoObjeto } from '../contenido/objetos.js';

/**
 * Kilos que aguanta un nino sin ayuda. Esta calibrado para que en un solo viaje
 * quepan el cantaro lleno (10 L) y tres lenas: ese es el mandado del primer
 * capitulo. Con la canasta al hombro caben doce kilos mas.
 */
export const CARGA_BASE = 17;

export function crearInventario(inicial = {}) {
  return { ...inicial };
}

export function cuenta(inv, id) { return inv[id] || 0; }
export function tiene(inv, id, n = 1) { return cuenta(inv, id) >= n; }

export function peso(inv) {
  let total = 0;
  for (const id in inv) total += pesoObjeto(id) * inv[id];
  return Math.round(total * 100) / 100;
}

/** Kilos que puede cargar: fuerza del nino mas lo que ayuda la canasta. */
export function cargaMaxima(inv, nivelFuerza = 1) {
  const extra = cuenta(inv, 'canasta') > 0 ? (OBJETOS.canasta.cargaExtra || 0) : 0;
  return CARGA_BASE + (nivelFuerza - 1) * 3.5 + extra;
}

/** Cuantas unidades mas caben antes de pasarse de peso. */
export function huecoPara(inv, id, nivelFuerza = 1) {
  const libre = cargaMaxima(inv, nivelFuerza) - peso(inv);
  const p = pesoObjeto(id);
  if (p <= 0) return Infinity;
  return Math.max(0, Math.floor(libre / p));
}

/**
 * Anade objetos respetando el limite de carga.
 * @returns {{anadido:number, rechazado:number, lleno:boolean}}
 */
export function agregar(inv, id, n = 1, nivelFuerza = 1) {
  if (!OBJETOS[id]) throw new Error(`Objeto desconocido: ${id}`);
  if (OBJETOS[id].unica && cuenta(inv, id) >= 1) {
    return { anadido: 0, rechazado: n, lleno: false, repetido: true };
  }
  const cabe = Math.min(n, huecoPara(inv, id, nivelFuerza));
  if (cabe > 0) inv[id] = cuenta(inv, id) + cabe;
  return { anadido: cabe, rechazado: n - cabe, lleno: cabe < n };
}

export function quitar(inv, id, n = 1) {
  const hay = cuenta(inv, id);
  const quitado = Math.min(hay, n);
  if (quitado <= 0) return 0;
  if (hay - quitado <= 0) delete inv[id];
  else inv[id] = hay - quitado;
  return quitado;
}

/** Mueve objetos de un inventario a otro (por ejemplo, a la despensa de casa). */
export function transferir(origen, destino, id, n = 1, nivelFuerza = 99) {
  const disponible = Math.min(n, cuenta(origen, id));
  if (!disponible) return 0;
  const { anadido } = agregar(destino, id, disponible, nivelFuerza);
  quitar(origen, id, anadido);
  return anadido;
}

/** Lista ordenada para la interfaz: primero herramientas, luego comida. */
export function listar(inv) {
  const orden = { herramienta: 0, recurso: 1, comida: 2, crudo: 3, semilla: 4, material: 5 };
  return Object.keys(inv)
    .filter((id) => inv[id] > 0 && OBJETOS[id])
    .map((id) => ({ id, cantidad: inv[id], objeto: OBJETOS[id], peso: pesoObjeto(id) * inv[id] }))
    .sort((a, b) => (orden[a.objeto.tipo] ?? 9) - (orden[b.objeto.tipo] ?? 9)
      || a.objeto.nombre.localeCompare(b.objeto.nombre));
}

/** Valor de venta de todo lo que se lleva (para el dia que se va al pueblo). */
export function valorTotal(inv) {
  let v = 0;
  for (const id in inv) v += (OBJETOS[id]?.valor || 0) * inv[id];
  return v;
}
