/**
 * ranking.js — Ligas y comparacion social.
 *
 * Sin servidor no hay usuarios reales que comparar, asi que se sintetiza una
 * cohorte estadisticamente realista: los puntos de una comunidad de habito se
 * distribuyen de forma LOG-NORMAL (pocos muy activos, mayoria moderada), como
 * ocurre en toda plataforma de participacion voluntaria (ley de Zipf-Pareto).
 * Cuando exista backend, se sustituye `cohorteSimulada` por datos reales sin
 * tocar el resto del modulo.
 */
import { generador, logNormal, elegir, normal } from './rng.js';
import { rangoPercentil, percentil, mediana, gini, redondear } from './estadistica.js';
import { nivelDesdeXP, rangoDeNivel } from './nivel.js';

export const LIGAS = Object.freeze([
  { id: 'musgo',    nombre: 'Musgo',    icono: '🍀', min: 0,     color: '#84cc16' },
  { id: 'helecho',  nombre: 'Helecho',  icono: '🌿', min: 1500,  color: '#22c55e' },
  { id: 'bambu',    nombre: 'Bambu',    icono: '🎋', min: 4000,  color: '#14b8a6' },
  { id: 'ceibo',    nombre: 'Ceibo',    icono: '🌳', min: 9000,  color: '#0ea5e9' },
  { id: 'secuoya',  nombre: 'Secuoya',  icono: '🌲', min: 18000, color: '#6366f1' },
  { id: 'amazonia', nombre: 'Amazonia', icono: '🌎', min: 35000, color: '#a855f7' },
]);

export function ligaDePuntos(puntos) {
  let l = LIGAS[0];
  for (const cand of LIGAS) if (puntos >= cand.min) l = cand;
  return l;
}

const NOMBRES = ['Ana', 'Luis', 'Marta', 'Diego', 'Sofia', 'Carlos', 'Elena', 'Javier', 'Lucia', 'Mateo',
  'Camila', 'Andres', 'Valeria', 'Pablo', 'Isabel', 'Nicolas', 'Paula', 'Tomas', 'Renata', 'Hugo',
  'Daniela', 'Sergio', 'Nora', 'Ivan', 'Ximena', 'Bruno', 'Alba', 'Emilio', 'Julia', 'Oscar'];
const APELLIDOS = ['G.', 'R.', 'M.', 'L.', 'S.', 'P.', 'V.', 'C.', 'T.', 'B.', 'A.', 'F.'];

/**
 * Cohorte sintetica reproducible.
 * @param {string} semilla identificador estable (p. ej. la liga + la semana)
 * @param {number} n tamano
 * @param {number} escala mediana de puntos de la cohorte
 */
export function cohorteSimulada(semilla, n = 40, escala = 1200) {
  const rnd = generador(semilla);
  const mu = Math.log(Math.max(1, escala));
  const salida = [];
  for (let i = 0; i < n; i++) {
    const puntos = Math.round(logNormal(rnd, mu, 0.85));
    const xp = Math.round(puntos * (0.6 + rnd() * 0.5));
    const co2e = Math.max(0, redondear(puntos / 10 * (0.7 + rnd() * 0.7), 1));
    salida.push({
      id: `sim_${i}`,
      nombre: `${elegir(rnd, NOMBRES)} ${elegir(rnd, APELLIDOS)}`,
      puntos,
      xp,
      nivel: nivelDesdeXP(xp),
      co2e,
      racha: Math.max(0, Math.round(normal(rnd, 8, 7))),
      simulado: true,
    });
  }
  return salida;
}

/**
 * Tabla de clasificacion combinando al usuario con la cohorte.
 * Devuelve tambien su posicion, percentil y la distancia al siguiente puesto.
 */
export function clasificacion(usuario, { semilla = 'global', n = 40, escala = null } = {}) {
  const escalaFinal = escala ?? Math.max(300, usuario.puntos * 0.9 || 800);
  const cohorte = cohorteSimulada(semilla, n, escalaFinal);
  const yo = {
    id: 'yo',
    nombre: usuario.nombre || 'Tu',
    puntos: usuario.puntos || 0,
    xp: usuario.xp || 0,
    nivel: nivelDesdeXP(usuario.xp || 0),
    co2e: usuario.co2e || 0,
    racha: usuario.racha || 0,
    esUsuario: true,
  };
  const tabla = [...cohorte, yo]
    .sort((a, b) => b.puntos - a.puntos)
    .map((p, i) => ({ ...p, posicion: i + 1, rango: rangoDeNivel(p.nivel) }));

  const puntosCohorte = cohorte.map((c) => c.puntos);
  const posicion = tabla.findIndex((p) => p.esUsuario) + 1;
  const siguiente = tabla[posicion - 2] || null;

  return {
    tabla,
    posicion,
    total: tabla.length,
    percentil: redondear(rangoPercentil(puntosCohorte, yo.puntos), 1),
    liga: ligaDePuntos(yo.puntos),
    faltanParaSubir: siguiente ? Math.max(0, siguiente.puntos - yo.puntos + 1) : 0,
    estadisticasCohorte: {
      mediana: Math.round(mediana(puntosCohorte)),
      p90: Math.round(percentil(puntosCohorte, 0.9)),
      gini: redondear(gini(puntosCohorte), 3),
    },
  };
}

/** Progreso hacia la siguiente liga. */
export function progresoLiga(puntos) {
  const actual = ligaDePuntos(puntos);
  const idx = LIGAS.findIndex((l) => l.id === actual.id);
  const siguiente = LIGAS[idx + 1] || null;
  if (!siguiente) return { actual, siguiente: null, progreso: 1, faltan: 0 };
  const span = siguiente.min - actual.min;
  return {
    actual, siguiente,
    progreso: Math.min(1, (puntos - actual.min) / span),
    faltan: Math.max(0, siguiente.min - puntos),
  };
}

/**
 * Reto entre dos perfiles (duelo). Compara impacto normalizado por dias activos
 * para que no gane simplemente quien lleva mas tiempo en la app.
 */
export function duelo(a, b) {
  const norm = (p) => (p.diasActivos ? p.puntos / p.diasActivos : p.puntos);
  const na = norm(a), nb = norm(b);
  return {
    ganador: na === nb ? 'empate' : na > nb ? a.nombre : b.nombre,
    ritmoA: redondear(na, 1),
    ritmoB: redondear(nb, 1),
    diferenciaPct: nb === 0 ? 100 : redondear(((na - nb) / nb) * 100, 1),
  };
}
