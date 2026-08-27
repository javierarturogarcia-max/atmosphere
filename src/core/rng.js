/**
 * rng.js — Aleatoriedad determinista y reproducible.
 * Sin servidor no puede haber "sorpresa" verificable, asi que todo lo aleatorio
 * (misiones diarias, cohorte de comparacion, cofres) se deriva de una semilla.
 * Misma semilla -> misma salida, siempre. Esto ademas hace los tests deterministas.
 */

/** Hash de cadena a entero de 32 bits (xfnv1a). */
export function hashSemilla(cadena) {
  let h = 2166136261 >>> 0;
  const s = String(cadena);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Generador mulberry32: rapido, periodo 2^32, suficiente para juego. */
export function generador(semilla) {
  let a = typeof semilla === 'number' ? semilla >>> 0 : hashSemilla(semilla);
  return function siguiente() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entero en [min, max] inclusive. */
export function enteroEntre(rnd, min, max) {
  return Math.floor(rnd() * (max - min + 1)) + min;
}

/** Elige un elemento del array. */
export function elegir(rnd, array) {
  return array[Math.floor(rnd() * array.length)];
}

/** Baraja Fisher-Yates sobre una copia. */
export function barajar(rnd, array) {
  const c = [...array];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

/** Toma n elementos distintos sin reposicion. */
export function muestra(rnd, array, n) {
  return barajar(rnd, array).slice(0, Math.min(n, array.length));
}

/** Eleccion ponderada: pesos[i] proporcional a la probabilidad de array[i]. */
export function elegirPonderado(rnd, array, pesos) {
  const total = pesos.reduce((a, b) => a + b, 0);
  if (total <= 0) return array[0];
  let r = rnd() * total;
  for (let i = 0; i < array.length; i++) {
    r -= pesos[i];
    if (r <= 0) return array[i];
  }
  return array[array.length - 1];
}

/** Normal estandar por Box-Muller (para simular cohortes realistas). */
export function normal(rnd, media = 0, desviacion = 1) {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return media + desviacion * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Log-normal: modela bien las distribuciones de impacto ambiental (colas largas). */
export function logNormal(rnd, mu = 0, sigma = 1) {
  return Math.exp(normal(rnd, mu, sigma));
}
