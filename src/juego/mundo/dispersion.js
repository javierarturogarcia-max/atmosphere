/**
 * dispersion.js — Reparte la vegetacion, las piedras y los recursos del valle.
 *
 * Se hace por rejilla con salto pseudoaleatorio (no por sorteo libre) para que
 * quede repartido sin amontonarse, y sobre todo para que sea reproducible: la
 * ceiba que hoy esta en el potrero sigue ahi manana y en otro dispositivo.
 */
import { hash2, limitar, mezclar, suavizar, TAU } from '../nucleo/mate.js';
import { LUGARES, NIVEL_AGUA, CAUCE } from './terreno.js';

/** Especies por zona con su peso. La suma no tiene que dar 1. */
const FLORA = {
  monte:   [['pino', 3], ['ceiba', 1], ['jocote', 1.2], ['seco', 0.7], ['matorral', 4], ['helecho', 3], ['mora', 1.2]],
  ribera:  [['ceiba', 1.6], ['palmera', 1.4], ['mango', 1.2], ['matorral', 3], ['helecho', 2.4], ['mora', 1.6]],
  potrero: [['ceiba', 0.8], ['jocote', 0.9], ['mango', 0.7], ['seco', 0.5], ['matorral', 1.6]],
  casa:    [['mango', 1.2], ['jocote', 0.8], ['matorral', 0.6]],
  milpa:   [],
  rio:     [],
};

/** Radios que hay que respetar: nada crece encima de la casa ni de la milpa. */
function despejado(x, z) {
  if (Math.hypot(x - LUGARES.casa.x, z - LUGARES.casa.z) < LUGARES.casa.radio + 3) return false;
  if (Math.hypot(x - LUGARES.fogon.x, z - LUGARES.fogon.z) < 4) return false;
  const m = LUGARES.milpa;
  if (Math.abs(x - m.x) < m.columnas * m.paso * 0.8 + 2 && Math.abs(z - m.z) < m.filas * m.paso * 0.8 + 2) return false;
  return true;
}

function elegirPeso(tabla, r) {
  let total = 0;
  for (const [, p] of tabla) total += p;
  let acumulado = r * total;
  for (const [k, p] of tabla) { acumulado -= p; if (acumulado <= 0) return k; }
  return tabla.length ? tabla[tabla.length - 1][0] : null;
}

/**
 * @param {Terreno} terreno
 * @param {object} op {densidad, semilla}
 * @returns {{plantas:Array, rocas:Array, hierba:Array, recursos:Array}}
 */
export function repartir(terreno, op = {}) {
  const semilla = op.semilla ?? terreno.semilla;
  const densidad = op.densidad ?? 1;
  const paso = 5.5 / Math.sqrt(densidad);
  const mitad = terreno.mitad - 6;
  const plantas = [], rocas = [], hierba = [], recursos = [];
  let idRecurso = 0;

  for (let cz = -mitad; cz < mitad; cz += paso) {
    for (let cx = -mitad; cx < mitad; cx += paso) {
      const ci = Math.round(cx / paso), cj = Math.round(cz / paso);
      const r1 = hash2(ci, cj, semilla);
      const r2 = hash2(ci + 917, cj - 431, semilla);
      const r3 = hash2(ci - 77, cj + 613, semilla);
      const r4 = hash2(ci + 251, cj + 149, semilla);
      const x = cx + (r1 - 0.5) * paso * 0.95;
      const z = cz + (r2 - 0.5) * paso * 0.95;
      if (!terreno.dentro(x, z) || !despejado(x, z)) continue;
      const y = terreno.altura(x, z);
      if (y < NIVEL_AGUA + 0.35) continue;
      const pend = terreno.pendiente(x, z);
      if (pend > 0.55) continue;
      const zona = terreno.zona(x, z);

      // Hierba: casi en todas partes menos en la milpa y en la roca pelada.
      if (zona !== 'milpa' && r3 < 0.86 && pend < 0.4) {
        hierba.push({ x: x + (r4 - 0.5) * 2.4, y, z: z + (r3 - 0.5) * 2.4, giro: r4 * TAU,
          escala: mezclar(0.7, 1.5, r1) });
      }

      // Piedras: mas donde hay pendiente y en la ribera.
      const probRoca = 0.05 + pend * 0.35 + (zona === 'ribera' ? 0.12 : 0);
      if (r4 < probRoca) {
        rocas.push({ x, y, z, giro: r1 * TAU, escala: mezclar(0.5, 1.5, r2) });
        continue;
      }

      const tabla = FLORA[zona] || [];
      if (!tabla.length) continue;
      // Densidad de arbolado por zona: el monte es tupido, el potrero abierto.
      const prob = zona === 'monte' ? 0.72 : zona === 'ribera' ? 0.5 : zona === 'potrero' ? 0.22 : 0.3;
      if (r3 > prob) continue;
      const especie = elegirPeso(tabla, r4);
      if (!especie) continue;
      const planta = { especie, x, y, z, giro: r1 * TAU, escala: mezclar(0.75, 1.3, r2) };
      plantas.push(planta);

      // Los que dan de comer o de quemar se registran como recurso con memoria.
      if (especie === 'mango' || especie === 'jocote') {
        recursos.push({ id: `f${idRecurso++}`, tipo: 'frutal', especie, x, y, z, planta });
      } else if (especie === 'mora') {
        recursos.push({ id: `m${idRecurso++}`, tipo: 'mata', especie, x, y, z, planta });
      } else if (especie === 'seco') {
        recursos.push({ id: `l${idRecurso++}`, tipo: 'lena', especie, x, y, z, planta });
      }
    }
  }

  // Lena suelta por el suelo del monte: lo que de verdad se recoge a diario.
  const pasoLena = 11;
  for (let cz = -mitad; cz < mitad; cz += pasoLena) {
    for (let cx = -mitad; cx < mitad; cx += pasoLena) {
      const ci = Math.round(cx / pasoLena), cj = Math.round(cz / pasoLena);
      const r1 = hash2(ci, cj, semilla + 7717);
      const r2 = hash2(ci + 55, cj + 91, semilla + 7717);
      const x = cx + (r1 - 0.5) * pasoLena, z = cz + (r2 - 0.5) * pasoLena;
      if (!terreno.dentro(x, z) || !despejado(x, z)) continue;
      const y = terreno.altura(x, z);
      if (y < NIVEL_AGUA + 0.4 || terreno.pendiente(x, z) > 0.5) continue;
      const zona = terreno.zona(x, z);
      if (zona !== 'monte' && zona !== 'ribera' && r1 > 0.35) continue;
      recursos.push({ id: `t${idRecurso++}`, tipo: 'tronco', especie: 'tronco', x, y, z,
        giro: r1 * TAU, escala: mezclar(0.8, 1.3, r2) });
    }
  }

  return { plantas, rocas, hierba, recursos };
}

/** Cuadros de milpa: posiciones fijas derivadas de LUGARES.milpa. */
export function cuadrosMilpa(terreno) {
  const m = LUGARES.milpa;
  const cuadros = [];
  for (let f = 0; f < m.filas; f++) {
    for (let c = 0; c < m.columnas; c++) {
      const x = m.x + (c - (m.columnas - 1) / 2) * m.paso;
      const z = m.z + (f - (m.filas - 1) / 2) * m.paso;
      cuadros.push({ id: `p${f}${c}`, x, y: terreno.altura(x, z), z });
    }
  }
  return cuadros;
}

/** Puntos de pesca: los remansos del cauce, donde se para el pez. */
export function puntosPesca(terreno) {
  const puntos = [];
  for (let i = 1; i < CAUCE.length - 1; i++) {
    const [x, z] = CAUCE[i];
    puntos.push({ id: `pesca${i}`, x, y: NIVEL_AGUA, z, hondura: limitar(-terreno.altura(x, z) / 6, 0.15, 1) });
  }
  return puntos;
}
