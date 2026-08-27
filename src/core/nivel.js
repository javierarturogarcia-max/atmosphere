/**
 * nivel.js — Progresion: experiencia, niveles y rangos.
 * La curva es superlineal (exponente 1,55) para que subir de nivel sea rapido
 * al principio (enganche) y significativo despues (retencion a largo plazo).
 */

const BASE_XP = 80;
const EXPONENTE = 1.55;

/** XP acumulada necesaria para alcanzar un nivel. */
export function xpParaNivel(nivel) {
  const n = Math.max(1, Math.floor(nivel));
  return Math.round(BASE_XP * Math.pow(n - 1, EXPONENTE));
}

/** Nivel correspondiente a una XP acumulada (inversa de la curva). */
export function nivelDesdeXP(xp) {
  const x = Math.max(0, xp);
  const n = Math.floor(Math.pow(x / BASE_XP, 1 / EXPONENTE)) + 1;
  // Ajuste por redondeo de la curva directa.
  let nivel = Math.max(1, n);
  while (xpParaNivel(nivel + 1) <= x) nivel++;
  while (nivel > 1 && xpParaNivel(nivel) > x) nivel--;
  return nivel;
}

/** Estado completo de progresion a partir de la XP. */
export function progresion(xp) {
  const nivel = nivelDesdeXP(xp);
  const inicio = xpParaNivel(nivel);
  const fin = xpParaNivel(nivel + 1);
  const rango = rangoDeNivel(nivel);
  const enNivel = xp - inicio;
  const necesarios = Math.max(1, fin - inicio);
  return {
    xp, nivel, rango,
    xpInicioNivel: inicio,
    xpSiguienteNivel: fin,
    xpEnNivel: enNivel,
    xpRestante: Math.max(0, fin - xp),
    progreso: Math.min(1, enNivel / necesarios),
  };
}

export const RANGOS = Object.freeze([
  { min: 1,   nombre: 'Semilla',              icono: '🌱', color: '#a3e635', lema: 'Todo bosque empieza aqui' },
  { min: 5,   nombre: 'Brote',                icono: '🌿', color: '#4ade80', lema: 'El habito germina' },
  { min: 10,  nombre: 'Retono',               icono: '🍃', color: '#34d399', lema: 'Ya se te nota en los datos' },
  { min: 20,  nombre: 'Arbusto',              icono: '🌾', color: '#22d3ee', lema: 'Raices firmes' },
  { min: 30,  nombre: 'Arbol joven',          icono: '🌳', color: '#38bdf8', lema: 'Empiezas a dar sombra' },
  { min: 40,  nombre: 'Arbol',                icono: '🌲', color: '#60a5fa', lema: 'Sumidero verificado' },
  { min: 55,  nombre: 'Roble',                icono: '🪵', color: '#818cf8', lema: 'Referencia para otros' },
  { min: 70,  nombre: 'Bosque',               icono: '🏞️', color: '#a78bfa', lema: 'Tu impacto ya es sistemico' },
  { min: 85,  nombre: 'Ecosistema',           icono: '🌍', color: '#c084fc', lema: 'Regeneras mas de lo que consumes' },
  { min: 100, nombre: 'Guardian del planeta', icono: '🛡️', color: '#f472b6', lema: 'Elite climatica' },
]);

export function rangoDeNivel(nivel) {
  let r = RANGOS[0];
  for (const cand of RANGOS) if (nivel >= cand.min) r = cand;
  return r;
}

/** Siguiente rango por alcanzar, o null si ya es el maximo. */
export function siguienteRango(nivel) {
  return RANGOS.find((r) => r.min > nivel) || null;
}

/** Detecta si un incremento de XP produce subida de nivel y/o de rango. */
export function detectarAscenso(xpAntes, xpDespues) {
  const a = progresion(xpAntes), d = progresion(xpDespues);
  return {
    subioNivel: d.nivel > a.nivel,
    niveles: d.nivel - a.nivel,
    subioRango: d.rango.nombre !== a.rango.nombre,
    rangoNuevo: d.rango,
    nivelNuevo: d.nivel,
  };
}
