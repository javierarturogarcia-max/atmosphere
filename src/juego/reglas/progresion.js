/**
 * progresion.js — Los capitulos: cuando se ofrecen, como se comprueban y que
 * dan al terminar.
 *
 * La comprobacion es siempre contra el estado guardado, nunca contra un evento
 * suelto: asi da igual el orden en que pasen las cosas y una partida cargada
 * sigue exactamente donde estaba.
 */
import { CAPITULOS, capitulo } from '../contenido/capitulos.js';
import { OBJETOS } from '../contenido/objetos.js';
import { cuenta, valorTotal } from './inventario.js';
import { ganar, nivel } from './habilidades.js';
import { agregar } from './inventario.js';
import { limitar } from '../nucleo/mate.js';

/** Capitulos ya terminados, como conjunto. */
export function hechos(estado) {
  return new Set((estado.capitulos?.hechos || []).map((h) => h.id));
}

/** Capitulos que se pueden empezar ahora. */
export function disponibles(estado) {
  const listos = hechos(estado);
  return CAPITULOS.filter((c) => !listos.has(c.id)
    && (c.requiere || []).every((r) => listos.has(r))
    && (!c.dia || estado.dia >= c.dia));
}

export function activo(estado) {
  return estado.capitulos?.activo ? capitulo(estado.capitulos.activo) : null;
}

export function activar(estado, id) {
  const c = capitulo(id);
  if (!c) return { ok: false, motivo: 'Ese capítulo no existe.' };
  if (hechos(estado).has(id)) return { ok: false, motivo: 'Ese capítulo ya está hecho.' };
  estado.capitulos.activo = id;
  if (!estado.capitulos.vistos.includes(id)) estado.capitulos.vistos.push(id);
  // Se apunta el punto de partida para que los objetivos cuenten desde aqui.
  estado.capitulos.marca = marcar(estado);
  return { ok: true, capitulo: c };
}

/** Foto de los contadores al empezar el capitulo (los objetivos son relativos). */
function marcar(estado) {
  const c = estado.contadores;
  return {
    entregado: { ...c.entregado },
    entregadoCategoria: { ...c.entregadoCategoria },
    recetas: { ...c.recetas },
    cultivos: { ...c.cultivos },
    acciones: {
      pescar: c.pescar, cazar: c.cazar, buscar: c.buscar, sembrar: c.sembrar,
      regar: c.regar, cosechar: c.cosechar, cocinar: c.cocinar, lena: c.lena,
      agua: c.agua, banar: c.banar, jugar_lluvia: c.jugar_lluvia, trampa: c.trampa,
      deshierbar: c.deshierbar, nadar: c.nadar,
    },
    estrellas: c.estrellas,
    diasSeguidos: estado.hogar?.diasSeguidos || 0,
  };
}

function desde(estado, camino, clave) {
  const marca = estado.capitulos?.marca;
  const base = marca ? (camino ? (marca[camino]?.[clave] || 0) : (marca[clave] || 0)) : 0;
  const c = estado.contadores;
  const ahora = camino ? (c[camino]?.[clave] || 0) : (c[clave] || 0);
  return Math.max(0, ahora - base);
}

/**
 * Evalua un objetivo contra el estado.
 * @returns {{hecho, valor, meta, progreso, texto}}
 */
export function evaluarObjetivo(obj, estado) {
  const meta = obj.meta ?? 1;
  let valor = 0;
  switch (obj.tipo) {
    case 'entregar':
      valor = desde(estado, 'entregado', obj.objeto);
      break;
    case 'entregarCategoria':
      valor = desde(estado, 'entregadoCategoria', obj.categoria);
      break;
    case 'juntar':
      valor = cuenta(estado.jugador.inventario, obj.objeto) + cuenta(estado.hogar.despensa, obj.objeto);
      break;
    case 'accion':
      valor = desde(estado, 'acciones', obj.accion) || desde(estado, null, obj.accion);
      break;
    case 'cocinar':
      valor = desde(estado, 'recetas', obj.receta);
      break;
    case 'sembrar':
      valor = desde(estado, 'cultivos', obj.cultivo);
      break;
    case 'cosechar':
      valor = desde(estado, 'acciones', 'cosechar');
      break;
    case 'habilidad':
      valor = nivel(estado.jugador.habilidades, obj.habilidad);
      break;
    case 'dias':
      valor = estado.hogar?.diasSeguidos || 0;
      break;
    case 'estrellas':
      valor = estado.contadores.estrellas - (estado.capitulos?.marca?.estrellas || 0);
      break;
    case 'valor':
      valor = valorTotal(estado.jugador.inventario) + valorTotal(estado.hogar.despensa);
      break;
    case 'lugar':
      valor = (estado.lugaresVisitados || []).includes(obj.lugar) ? 1 : 0;
      break;
    default:
      valor = 0;
  }
  return {
    id: obj.id, texto: obj.texto, tipo: obj.tipo,
    valor: Math.min(valor, meta), meta,
    progreso: limitar(valor / meta, 0, 1),
    hecho: valor >= meta,
  };
}

export function evaluarCapitulo(cap, estado) {
  const objetivos = cap.objetivos.map((o) => evaluarObjetivo(o, estado));
  const hechos = objetivos.filter((o) => o.hecho).length;
  return {
    id: cap.id,
    objetivos,
    completado: hechos === objetivos.length,
    progreso: objetivos.length ? hechos / objetivos.length : 0,
  };
}

/**
 * Cierra el capitulo activo si esta completo y entrega el premio.
 * @returns {null|{capitulo, premios:[], subidas:[]}}
 */
export function intentarCompletar(estado) {
  const cap = activo(estado);
  if (!cap) return null;
  const ev = evaluarCapitulo(cap, estado);
  if (!ev.completado) return null;
  return completar(estado, cap);
}

export function completar(estado, cap) {
  const premios = [];
  const subidas = [];
  const p = cap.premio || {};
  for (const [hab, xp] of Object.entries(p.xp || {})) {
    const r = ganar(estado.jugador.habilidades, hab, xp);
    premios.push({ tipo: 'xp', habilidad: hab, xp });
    if (r.subio) subidas.push(r);
  }
  for (const o of p.objetos || []) {
    agregar(estado.jugador.inventario, o.id, o.cantidad, 99);
    premios.push({ tipo: 'objeto', id: o.id, cantidad: o.cantidad, nombre: OBJETOS[o.id]?.nombre });
  }
  for (const s of p.sabe || []) {
    if (!estado.sabe.includes(s)) estado.sabe.push(s);
    premios.push({ tipo: 'sabe', id: s });
  }
  estado.capitulos.hechos.push({ id: cap.id, dia: estado.dia });
  estado.capitulos.activo = null;
  estado.capitulos.marca = null;
  return { capitulo: cap, premios, subidas };
}

/** Resumen para el diario: que hay hecho, que hay activo y que viene despues. */
export function resumen(estado) {
  const listos = hechos(estado);
  const act = activo(estado);
  return {
    activo: act ? { capitulo: act, ...evaluarCapitulo(act, estado) } : null,
    disponibles: disponibles(estado).filter((c) => c.id !== act?.id),
    hechos: CAPITULOS.filter((c) => listos.has(c.id)),
    total: CAPITULOS.length,
    completados: listos.size,
  };
}
