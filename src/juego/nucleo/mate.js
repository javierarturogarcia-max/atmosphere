/**
 * mate.js — Algebra lineal y ruido para el motor del juego.
 *
 * Sin dependencias: matrices como Float32Array de 16 en orden por columnas
 * (el mismo que esperan WebGL2 y WebGPU), vectores como arrays de 3 numeros.
 * Todas las funciones que producen matrices aceptan un destino opcional para
 * poder reutilizar memoria en el bucle de render y no generar basura.
 */

export const TAU = Math.PI * 2;
export const GRADO = Math.PI / 180;

export function limitar(v, min, max) { return v < min ? min : v > max ? max : v; }
export function mezclar(a, b, t) { return a + (b - a) * t; }
export function inversa(a, b, v) { return a === b ? 0 : limitar((v - a) / (b - a), 0, 1); }
export function suavizar(a, b, v) { const t = inversa(a, b, v); return t * t * (3 - 2 * t); }
/** Interpolacion independiente de la tasa de refresco. */
export function seguir(actual, objetivo, velocidad, dt) {
  return mezclar(actual, objetivo, 1 - Math.exp(-velocidad * dt));
}
/** Diferencia angular mas corta entre dos angulos, en (-PI, PI]. */
export function deltaAngulo(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function seguirAngulo(actual, objetivo, velocidad, dt) {
  return actual + deltaAngulo(actual, objetivo) * (1 - Math.exp(-velocidad * dt));
}

// ------------------------------------------------------------------ vectores
export function v3(x = 0, y = 0, z = 0) { return [x, y, z]; }
export function sumar(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function restar(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function escalar(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
export function punto(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function cruz(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function longitud(a) { return Math.hypot(a[0], a[1], a[2]); }
export function normalizar(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
export function mezclarV3(a, b, t) {
  return [mezclar(a[0], b[0], t), mezclar(a[1], b[1], t), mezclar(a[2], b[2], t)];
}

// ------------------------------------------------------------------ matrices
export function m4() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function identidad(d = m4()) {
  d.fill(0); d[0] = d[5] = d[10] = d[15] = 1;
  return d;
}

/** d = a * b (aplicar b y luego a, convenio de columnas). */
export function multiplicar(a, b, d = m4()) {
  const o = d === a || d === b ? new Float32Array(16) : d;
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    o[c * 4]     = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
    o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
    o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  if (o !== d) d.set(o);
  return d;
}

/**
 * Proyeccion en perspectiva con profundidad en [0, 1] (convenio de WebGPU).
 * En WebGL2 el rango nativo es [-1, 1], asi que el respaldo llama a
 * gl.clipControl cuando existe o corrige la matriz; ver render/webgl2.js.
 */
export function perspectiva(fovY, aspecto, cerca, lejos, d = m4()) {
  const f = 1 / Math.tan(fovY / 2);
  d.fill(0);
  d[0] = f / aspecto; d[5] = f; d[11] = -1;
  d[10] = lejos / (cerca - lejos);
  d[14] = (lejos * cerca) / (cerca - lejos);
  return d;
}

/** Proyeccion ortografica con profundidad en [0, 1]. Se usa para las sombras. */
export function ortografica(izq, der, aba, arr, cerca, lejos, d = m4()) {
  d.fill(0);
  d[0] = 2 / (der - izq);
  d[5] = 2 / (arr - aba);
  d[10] = 1 / (cerca - lejos);
  d[12] = -(der + izq) / (der - izq);
  d[13] = -(arr + aba) / (arr - aba);
  d[14] = cerca / (cerca - lejos);
  d[15] = 1;
  return d;
}

/** Matriz de vista que mira desde ojo hacia centro. */
export function mirarA(ojo, centro, arriba, d = m4()) {
  const z = normalizar(restar(ojo, centro));
  let x = cruz(arriba, z);
  if (longitud(x) < 1e-6) x = cruz([0, 0, 1], z);
  x = normalizar(x);
  const y = cruz(z, x);
  d[0] = x[0]; d[1] = y[0]; d[2] = z[0];  d[3] = 0;
  d[4] = x[1]; d[5] = y[1]; d[6] = z[1];  d[7] = 0;
  d[8] = x[2]; d[9] = y[2]; d[10] = z[2]; d[11] = 0;
  d[12] = -punto(x, ojo); d[13] = -punto(y, ojo); d[14] = -punto(z, ojo); d[15] = 1;
  return d;
}

/**
 * Compone traslacion, rotacion (Euler YXZ, que es lo natural para personajes
 * y plantas) y escala en una sola matriz de modelo.
 */
export function componer(pos, rot, esc, d = m4()) {
  const [rx, ry, rz] = rot;
  const [sx, sy, sz] = Array.isArray(esc) ? esc : [esc, esc, esc];
  const cx = Math.cos(rx), sxr = Math.sin(rx);
  const cy = Math.cos(ry), syr = Math.sin(ry);
  const cz = Math.cos(rz), szr = Math.sin(rz);
  // R = Ry * Rx * Rz
  const m00 = cy * cz + syr * sxr * szr;
  const m01 = cx * szr;
  const m02 = -syr * cz + cy * sxr * szr;
  const m10 = -cy * szr + syr * sxr * cz;
  const m11 = cx * cz;
  const m12 = syr * szr + cy * sxr * cz;
  const m20 = syr * cx;
  const m21 = -sxr;
  const m22 = cy * cx;
  d[0] = m00 * sx; d[1] = m01 * sx; d[2] = m02 * sx; d[3] = 0;
  d[4] = m10 * sy; d[5] = m11 * sy; d[6] = m12 * sy; d[7] = 0;
  d[8] = m20 * sz; d[9] = m21 * sz; d[10] = m22 * sz; d[11] = 0;
  d[12] = pos[0]; d[13] = pos[1]; d[14] = pos[2]; d[15] = 1;
  return d;
}

/** Inversa general de 4x4. Devuelve null si la matriz es singular. */
export function invertir(m, d = m4()) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  const i = 1 / det;
  d[0] = (a11 * b11 - a12 * b10 + a13 * b09) * i;
  d[1] = (a02 * b10 - a01 * b11 - a03 * b09) * i;
  d[2] = (a31 * b05 - a32 * b04 + a33 * b03) * i;
  d[3] = (a22 * b04 - a21 * b05 - a23 * b03) * i;
  d[4] = (a12 * b08 - a10 * b11 - a13 * b07) * i;
  d[5] = (a00 * b11 - a02 * b08 + a03 * b07) * i;
  d[6] = (a32 * b02 - a30 * b05 - a33 * b01) * i;
  d[7] = (a20 * b05 - a22 * b02 + a23 * b01) * i;
  d[8] = (a10 * b10 - a11 * b08 + a13 * b06) * i;
  d[9] = (a01 * b08 - a00 * b10 - a03 * b06) * i;
  d[10] = (a30 * b04 - a31 * b02 + a33 * b00) * i;
  d[11] = (a21 * b02 - a20 * b04 - a23 * b00) * i;
  d[12] = (a11 * b07 - a10 * b09 - a12 * b06) * i;
  d[13] = (a00 * b09 - a01 * b07 + a02 * b06) * i;
  d[14] = (a31 * b01 - a30 * b03 - a32 * b00) * i;
  d[15] = (a20 * b03 - a21 * b01 + a22 * b00) * i;
  return d;
}

/** Transforma un punto (w = 1) y divide por w. */
export function transformar(m, p) {
  const x = p[0], y = p[1], z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

// --------------------------------------------------------------------- ruido
/** Hash entero -> [0, 1). Estable entre plataformas (solo enteros de 32 bits). */
export function hash2(x, y, semilla = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(semilla | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruido de valor bilineal con interpolacion suave. */
export function ruido2(x, y, semilla = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, semilla), b = hash2(xi + 1, yi, semilla);
  const c = hash2(xi, yi + 1, semilla), d = hash2(xi + 1, yi + 1, semilla);
  return mezclar(mezclar(a, b, u), mezclar(c, d, u), v);
}

/** Suma de octavas. Devuelve aproximadamente [0, 1]. */
export function fbm(x, y, octavas = 4, semilla = 0, lagunaridad = 2.03, ganancia = 0.5) {
  let suma = 0, amp = 1, norma = 0, fx = x, fy = y;
  for (let i = 0; i < octavas; i++) {
    suma += ruido2(fx, fy, semilla + i * 131) * amp;
    norma += amp;
    amp *= ganancia;
    fx *= lagunaridad; fy *= lagunaridad;
  }
  return suma / norma;
}

/** Ruido con crestas: hace lomas y filos, util para el monte. */
export function fbmCresta(x, y, octavas = 4, semilla = 0) {
  let suma = 0, amp = 1, norma = 0, fx = x, fy = y;
  for (let i = 0; i < octavas; i++) {
    const n = 1 - Math.abs(ruido2(fx, fy, semilla + i * 977) * 2 - 1);
    suma += n * n * amp;
    norma += amp;
    amp *= 0.5;
    fx *= 2.07; fy *= 2.07;
  }
  return suma / norma;
}

/** Distancia de un punto al segmento AB, en 2D. */
export function distanciaSegmento(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const wx = px - ax, wz = pz - az;
  const l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? limitar((wx * vx + wz * vz) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}
