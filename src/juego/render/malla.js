/**
 * malla.js — Geometria procedural. El juego no carga ni un solo archivo de
 * arte: cada arbol, animal, casa y planta se construye aqui con codigo.
 *
 * Formato de vertice (entrelazado, 10 flotantes):
 *   posicion(3) normal(3) color(3) oleaje(1)
 * "oleaje" es cuanto se mueve ese vertice con el viento: 0 en la base de un
 * tronco, 1 en la punta de una hoja. Lo aplica el vertex shader.
 */
import { limitar, mezclar, TAU } from '../nucleo/mate.js';

export const FLOTANTES_VERTICE = 10;

/** Paleta base del campo: tierra volcanica, verdes humedos y madera. */
export const PALETA = {
  tierra:      [0.40, 0.29, 0.20],
  tierraSeca:  [0.55, 0.43, 0.29],
  pasto:       [0.31, 0.47, 0.20],
  pastoSeco:   [0.56, 0.52, 0.26],
  monte:       [0.18, 0.34, 0.17],
  hoja:        [0.22, 0.42, 0.19],
  hojaClara:   [0.36, 0.56, 0.24],
  hojaSeca:    [0.52, 0.42, 0.18],
  tronco:      [0.30, 0.22, 0.16],
  troncoClaro: [0.44, 0.34, 0.24],
  roca:        [0.42, 0.41, 0.39],
  adobe:       [0.66, 0.50, 0.36],
  teja:        [0.51, 0.24, 0.16],
  paja:        [0.68, 0.56, 0.30],
  agua:        [0.16, 0.36, 0.42],
  maiz:        [0.78, 0.68, 0.24],
  frijol:      [0.34, 0.24, 0.18],
  arroz:       [0.79, 0.74, 0.52],
  trigo:       [0.80, 0.68, 0.33],
  piel:        [0.76, 0.56, 0.40],
  camisa:      [0.85, 0.86, 0.82],
  pantalon:    [0.28, 0.35, 0.50],
  pelo:        [0.14, 0.11, 0.10],
  venado:      [0.55, 0.38, 0.24],
  conejo:      [0.62, 0.56, 0.48],
  gallina:     [0.82, 0.76, 0.68],
  perro:       [0.48, 0.36, 0.24],
  pez:         [0.55, 0.62, 0.66],
  fuego:       [1.00, 0.55, 0.15],
};

/** Varia un color de forma determinista para que nada se vea clonado. */
export function tinte(color, k) {
  return [
    limitar(color[0] * (1 + k), 0, 1),
    limitar(color[1] * (1 + k * 0.85), 0, 1),
    limitar(color[2] * (1 + k * 0.7), 0, 1),
  ];
}

/**
 * Acumulador de geometria. Cada primitiva se anade ya transformada, asi que
 * un arbol entero acaba siendo una sola malla que se dibuja de un tiron.
 */
export class Constructor {
  constructor() {
    this.v = [];
    this.i = [];
  }

  get vertices() { return this.v.length / FLOTANTES_VERTICE; }

  /** Anade un vertice ya en espacio local de la malla. */
  vertice(p, n, c, oleaje = 0) {
    this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], oleaje);
    return this.vertices - 1;
  }

  triangulo(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }

  /**
   * Anade una lista de posiciones+normales aplicando traslacion, rotacion en Y
   * e inclinacion, y una escala. Es el nucleo que usan todas las primitivas.
   */
  aportar(pos, nor, ind, { en = [0, 0, 0], giroY = 0, inclina = 0, giroZ = 0,
    escala = [1, 1, 1], color = PALETA.hoja, oleaje = 0, oleajePorAltura = false }) {
    const base = this.vertices;
    const [ex, ey, ez] = Array.isArray(escala) ? escala : [escala, escala, escala];
    const cy = Math.cos(giroY), sy = Math.sin(giroY);
    const cx = Math.cos(inclina), sx = Math.sin(inclina);
    const cz = Math.cos(giroZ), sz = Math.sin(giroZ);
    let maxY = 1e-6;
    if (oleajePorAltura) for (let k = 1; k < pos.length; k += 3) maxY = Math.max(maxY, pos[k] * ey);

    for (let k = 0; k < pos.length; k += 3) {
      let x = pos[k] * ex, y = pos[k + 1] * ey, z = pos[k + 2] * ez;
      let nx = nor[k] / ex, ny = nor[k + 1] / ey, nz = nor[k + 2] / ez;
      // giro Z (balanceo), luego inclinacion X, luego giro Y (orientacion)
      let t;
      t = x * cz - y * sz; y = x * sz + y * cz; x = t;
      t = nx * cz - ny * sz; ny = nx * sz + ny * cz; nx = t;
      t = y * cx - z * sx; z = y * sx + z * cx; y = t;
      t = ny * cx - nz * sx; nz = ny * sx + nz * cx; ny = t;
      t = x * cy + z * sy; z = -x * sy + z * cy; x = t;
      t = nx * cy + nz * sy; nz = -nx * sy + nz * cy; nx = t;
      const l = Math.hypot(nx, ny, nz) || 1;
      const o = oleajePorAltura ? limitar((pos[k + 1] * ey) / maxY, 0, 1) * oleaje : oleaje;
      this.v.push(x + en[0], y + en[1], z + en[2], nx / l, ny / l, nz / l, color[0], color[1], color[2], o);
    }
    for (const idx of ind) this.i.push(base + idx);
    return this;
  }

  caja(opciones = {}) {
    const { ancho = 1, alto = 1, fondo = 1 } = opciones;
    const x = ancho / 2, y = alto, z = fondo / 2;
    const pos = [], nor = [], ind = [];
    const caras = [
      [[-x, 0, z], [x, 0, z], [x, y, z], [-x, y, z], [0, 0, 1]],
      [[x, 0, -z], [-x, 0, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
      [[x, 0, z], [x, 0, -z], [x, y, -z], [x, y, z], [1, 0, 0]],
      [[-x, 0, -z], [-x, 0, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]],
      [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]],
      [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [0, -1, 0]],
    ];
    for (const cara of caras) {
      const b = pos.length / 3;
      const n = cara[4];
      for (let k = 0; k < 4; k++) { pos.push(...cara[k]); nor.push(...n); }
      ind.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return this.aportar(pos, nor, ind, opciones);
  }

  cilindro(opciones = {}) {
    const { radio = 0.5, radioSuperior = null, alto = 1, lados = 8, tapas = true } = opciones;
    const r1 = radioSuperior === null ? radio : radioSuperior;
    const pos = [], nor = [], ind = [];
    for (let s = 0; s <= lados; s++) {
      const a = (s / lados) * TAU;
      const cx = Math.cos(a), sz = Math.sin(a);
      const pendiente = (radio - r1) / Math.max(alto, 1e-4);
      const n = [cx, pendiente, sz];
      const l = Math.hypot(n[0], n[1], n[2]);
      pos.push(cx * radio, 0, sz * radio); nor.push(n[0] / l, n[1] / l, n[2] / l);
      pos.push(cx * r1, alto, sz * r1); nor.push(n[0] / l, n[1] / l, n[2] / l);
    }
    for (let s = 0; s < lados; s++) {
      const b = s * 2;
      ind.push(b, b + 2, b + 3, b, b + 3, b + 1);
    }
    if (tapas) {
      const cima = pos.length / 3;
      pos.push(0, alto, 0); nor.push(0, 1, 0);
      for (let s = 0; s <= lados; s++) {
        const a = (s / lados) * TAU;
        pos.push(Math.cos(a) * r1, alto, Math.sin(a) * r1); nor.push(0, 1, 0);
      }
      for (let s = 0; s < lados; s++) ind.push(cima, cima + 1 + s, cima + 2 + s);
      const base = pos.length / 3;
      pos.push(0, 0, 0); nor.push(0, -1, 0);
      for (let s = 0; s <= lados; s++) {
        const a = (s / lados) * TAU;
        pos.push(Math.cos(a) * radio, 0, Math.sin(a) * radio); nor.push(0, -1, 0);
      }
      for (let s = 0; s < lados; s++) ind.push(base, base + 2 + s, base + 1 + s);
    }
    return this.aportar(pos, nor, ind, opciones);
  }

  cono(opciones = {}) {
    return this.cilindro({ ...opciones, radioSuperior: 0.001 });
  }

  esfera(opciones = {}) {
    const { radio = 0.5, lados = 10, anillos = 7, achatado = 1 } = opciones;
    const pos = [], nor = [], ind = [];
    for (let r = 0; r <= anillos; r++) {
      const phi = (r / anillos) * Math.PI;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      for (let s = 0; s <= lados; s++) {
        const th = (s / lados) * TAU;
        const x = sp * Math.cos(th), y = cp, z = sp * Math.sin(th);
        pos.push(x * radio, y * radio * achatado + radio * achatado, z * radio);
        nor.push(x, y / achatado, z);
      }
    }
    for (let r = 0; r < anillos; r++) {
      for (let s = 0; s < lados; s++) {
        const a = r * (lados + 1) + s, b = a + lados + 1;
        ind.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
    return this.aportar(pos, nor, ind, opciones);
  }

  /** Cuadrilatero vertical, para hojas, palmas y aspas. */
  hoja(opciones = {}) {
    const { largo = 1, ancho = 0.25, curva = 0.35, tramos = 4 } = opciones;
    const pos = [], nor = [], ind = [];
    for (let t = 0; t <= tramos; t++) {
      const u = t / tramos;
      const y = largo * u;
      const caida = -curva * u * u * largo;
      const w = ancho * (1 - u * u * 0.85) / 2;
      pos.push(-w, y + caida, u * curva * largo * 0.35); nor.push(0, 0.4, 1);
      pos.push(w, y + caida, u * curva * largo * 0.35); nor.push(0, 0.4, 1);
    }
    for (let t = 0; t < tramos; t++) {
      const b = t * 2;
      ind.push(b, b + 1, b + 3, b, b + 3, b + 2);
      ind.push(b, b + 3, b + 1, b, b + 2, b + 3);
    }
    return this.aportar(pos, nor, ind, { oleajePorAltura: true, ...opciones });
  }

  /** Rejilla plana con altura y color por vertice (terreno, agua, parcelas). */
  rejilla(opciones = {}) {
    const { ancho = 10, fondo = 10, divX = 10, divZ = 10, alturaEn = null, colorEn = null,
      color = PALETA.pasto, oleajeEn = null } = opciones;
    const pos = [], nor = [], ind = [], col = [], ole = [];
    for (let z = 0; z <= divZ; z++) {
      for (let x = 0; x <= divX; x++) {
        const px = (x / divX - 0.5) * ancho;
        const pz = (z / divZ - 0.5) * fondo;
        const py = alturaEn ? alturaEn(px, pz) : 0;
        pos.push(px, py, pz); nor.push(0, 1, 0);
        const c = colorEn ? colorEn(px, pz, py) : color;
        col.push(c[0], c[1], c[2]);
        ole.push(oleajeEn ? oleajeEn(px, pz, py) : 0);
      }
    }
    const paso = divX + 1;
    for (let z = 0; z < divZ; z++) {
      for (let x = 0; x < divX; x++) {
        const a = z * paso + x;
        ind.push(a, a + paso, a + paso + 1, a, a + paso + 1, a + 1);
      }
    }
    // Normales por acumulacion de caras: da un sombreado continuo del terreno.
    for (let k = 0; k < ind.length; k += 3) {
      const [i0, i1, i2] = [ind[k] * 3, ind[k + 1] * 3, ind[k + 2] * 3];
      const ux = pos[i1] - pos[i0], uy = pos[i1 + 1] - pos[i0 + 1], uz = pos[i1 + 2] - pos[i0 + 2];
      const vx = pos[i2] - pos[i0], vy = pos[i2 + 1] - pos[i0 + 1], vz = pos[i2 + 2] - pos[i0 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const i of [i0, i1, i2]) { nor[i] += nx; nor[i + 1] += ny; nor[i + 2] += nz; }
    }
    const base = this.vertices;
    const en = opciones.en || [0, 0, 0];
    for (let k = 0; k < pos.length; k += 3) {
      const l = Math.hypot(nor[k], nor[k + 1], nor[k + 2]) || 1;
      this.v.push(pos[k] + en[0], pos[k + 1] + en[1], pos[k + 2] + en[2],
        nor[k] / l, nor[k + 1] / l, nor[k + 2] / l,
        col[k], col[k + 1], col[k + 2], ole[k / 3]);
    }
    for (const idx of ind) this.i.push(base + idx);
    return this;
  }

  /** Empaqueta lo acumulado en buffers listos para la GPU. */
  malla(nombre = 'malla') {
    const vertices = new Float32Array(this.v);
    const indices = this.vertices > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i);
    let minY = Infinity, maxY = -Infinity, radio = 0;
    for (let k = 0; k < vertices.length; k += FLOTANTES_VERTICE) {
      minY = Math.min(minY, vertices[k + 1]);
      maxY = Math.max(maxY, vertices[k + 1]);
      radio = Math.max(radio, Math.hypot(vertices[k], vertices[k + 1], vertices[k + 2]));
    }
    return { nombre, vertices, indices, cuenta: this.i.length, radio, minY, maxY };
  }
}

/** Atajo: construye y empaqueta en una sola llamada. */
export function construir(nombre, fn) {
  const c = new Constructor();
  fn(c);
  return c.malla(nombre);
}
