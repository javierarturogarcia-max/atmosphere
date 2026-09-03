/**
 * caza.js — Acercarse, apuntar y tirar.
 *
 * La probabilidad de acertar no es un dado escondido: la mira se mueve sola
 * (mas cuanto mas cansado y mas lejos), el viento desvia la piedra y el
 * jugador decide cuando soltar. Lo que hace la habilidad es calmar el pulso,
 * no regalar aciertos.
 *
 * Y antes de eso esta lo importante: llegar cerca. De eso se encarga
 * mundo/fauna.js con el olfato y el oido del animal.
 */
import { limitar, mezclar, suavizar } from '../nucleo/mate.js';

export const ARMAS = {
  hondilla: {
    nombre: 'Hondilla', icono: '🪁', municion: 'piedra',
    alcance: 14, oscilacion: 1, tiempoCarga: 0.85, dano: 1,
    descripcion: 'Alcance corto, silenciosa. Hay que estar encima.',
  },
  hondilla_larga: {
    nombre: 'Hondilla reforzada', icono: '🪁', municion: 'piedra',
    alcance: 21, oscilacion: 0.8, tiempoCarga: 0.9, dano: 1.35,
    requiere: 'tiro_largo', descripcion: 'Con hule doble llega más lejos y pega más.',
  },
};

/**
 * Prepara el apuntado.
 * @param {object} ctx {arma, distancia, bono, punteria (0..1), viento, agachado}
 */
export function crearApuntado(ctx) {
  const arma = ARMAS[ctx.arma] || ARMAS.hondilla;
  const dist = ctx.distancia ?? 8;
  const calma = limitar((ctx.punteria ?? 1) * mezclar(1, 1.45, limitar((ctx.bono ?? 1) - 1, 0, 1)), 0.25, 2);
  const lejania = limitar(dist / arma.alcance, 0.15, 1.8);
  return {
    arma,
    distancia: dist,
    // Amplitud del vaiven, en "radios de blanco".
    oscilacion: arma.oscilacion * lejania * 0.85 / calma * (ctx.agachado ? 0.72 : 1),
    velocidad: mezclar(1.5, 2.9, limitar(1 / calma, 0, 1)),
    fase: (ctx.fase ?? 0),
    // Deriva del viento: crece con la distancia, no con el tiempo.
    deriva: (ctx.viento?.fuerza ?? 0) * lejania * 0.55,
    derivaAngulo: ctx.viento?.direccion ?? 0,
    tension: 0,
    listo: false,
  };
}

/** Posicion de la mira en el instante t (unidades: radios de blanco). */
export function posicionMira(ap, t) {
  const w = ap.velocidad;
  const x = Math.sin(t * w + ap.fase) * ap.oscilacion
          + Math.sin(t * w * 2.7 + ap.fase * 1.9) * ap.oscilacion * 0.35;
  const y = Math.sin(t * w * 0.73 + ap.fase * 2.3) * ap.oscilacion * 0.7
          + Math.cos(t * w * 1.9 + ap.fase) * ap.oscilacion * 0.25;
  return { x, y };
}

/**
 * Suelta el tiro.
 * @returns {{desvio, mira, deriva}}
 */
export function disparar(ap, t) {
  const mira = posicionMira(ap, t);
  const dx = mira.x + Math.cos(ap.derivaAngulo) * ap.deriva;
  const dy = mira.y + Math.sin(ap.derivaAngulo) * ap.deriva * 0.4;
  return { desvio: Math.hypot(dx, dy), mira, deriva: ap.deriva };
}

/**
 * Resuelve el disparo contra el animal.
 * @param {object} ctx {animal(perfil), desvio, distancia, arma, bono, rnd}
 * @returns {{acierto, limpio, presa, xp, huye, texto}}
 */
export function resolverTiro(ctx) {
  const rnd = ctx.rnd || Math.random;
  const perfil = ctx.animal;
  const arma = ARMAS[ctx.arma] || ARMAS.hondilla;
  if (ctx.distancia > arma.alcance * 1.25) {
    return { acierto: false, huye: true, texto: 'Demasiado lejos: la piedra ni llegó.', xp: 1 };
  }
  // Blanco efectivo: los animales grandes perdonan mas desvio.
  const tamano = mezclar(0.55, 1.35, 1 - (perfil.dificultad ?? 0.5));
  const acierto = ctx.desvio < tamano;
  if (!acierto) {
    return { acierto: false, huye: true, xp: 2, texto: 'Falló, y el animal salió huyendo.' };
  }
  // Un buen tiro (muy centrado) cobra la pieza entera; uno justo, la hiere.
  const limpio = ctx.desvio < tamano * 0.45 || rnd() < 0.35 * arma.dano;
  if (!limpio) {
    return { acierto: true, limpio: false, huye: true, xp: Math.round((perfil.xp ?? 8) * 0.4),
      texto: 'Le diste, pero se fue herido monte adentro.' };
  }
  return {
    acierto: true, limpio: true, huye: false,
    presa: perfil.presa,
    xp: perfil.xp ?? 10,
    texto: `¡Cobraste el ${perfil.nombre}!`,
  };
}

/** Probabilidad estimada, solo para mostrarla en la interfaz antes de tirar. */
export function probabilidadEstimada(ap, perfil) {
  const tamano = mezclar(0.55, 1.35, 1 - (perfil?.dificultad ?? 0.5));
  const amplitud = ap.oscilacion + ap.deriva;
  return limitar(1 - suavizar(tamano * 0.35, tamano * 2.1, amplitud), 0.02, 0.98);
}

// ------------------------------------------------------------------ trampas
export const TRAMPA = { materiales: { pita: 2, fibra: 3 }, dias: 1, xp: 8 };

export function colocarTrampa(estado, x, z, dia) {
  const trampa = { id: `tr${dia}_${Math.round(x)}_${Math.round(z)}`, x, z, dia, revisada: false };
  estado.trampas.push(trampa);
  return trampa;
}

/**
 * Revisa una trampa puesta. Cuanto mas tiempo lleve, mas probable que haya
 * caido algo, pero tambien mas probable que se lo hayan comido antes.
 */
export function revisarTrampa(trampa, dia, ctx = {}) {
  const rnd = ctx.rnd || Math.random;
  const dias = dia - trampa.dia;
  if (dias < 1) return { ok: false, motivo: 'Todavía no ha pasado la noche.' };
  trampa.revisada = true;
  const prob = limitar(0.32 + dias * 0.16 + (ctx.bono ?? 1) * 0.1 - 0.08, 0, 0.85);
  if (rnd() > prob) return { ok: true, vacia: true, xp: 2, texto: 'La trampa está vacía.' };
  if (dias > 2 && rnd() < 0.35) {
    return { ok: true, vacia: true, xp: 3, texto: 'Cayó algo, pero se lo comieron antes que tú.' };
  }
  const presa = rnd() < 0.75
    ? { objeto: 'carne_conejo', cantidad: 1, nombre: 'conejo' }
    : { objeto: 'carne_pajaro', cantidad: 1, nombre: 'pájaro' };
  return { ok: true, vacia: false, objetos: [{ id: presa.objeto, cantidad: presa.cantidad }],
    xp: TRAMPA.xp, texto: `Cayó un ${presa.nombre} en la trampa.` };
}
