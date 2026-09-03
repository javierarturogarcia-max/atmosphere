/**
 * modelos.js — Catalogo de mallas del juego, todas generadas por codigo.
 *
 * Cada entrada es una funcion (rnd) -> malla. Se construyen una vez al
 * arrancar y se suben a la GPU; luego se dibujan miles de veces por
 * instanciacion, que es lo que permite un monte lleno de arboles a 60 fps.
 */
import { Constructor, PALETA, tinte, construir } from './malla.js';
import { TAU, mezclar } from '../nucleo/mate.js';

const rnd0 = () => Math.random();

// ------------------------------------------------------------------- arboles
function tronco(c, { alto, radio, color, torcido = 0.12, tramos = 3 }) {
  let x = 0, z = 0, r = radio, y = 0;
  for (let t = 0; t < tramos; t++) {
    const h = alto / tramos;
    const rSup = r * 0.72;
    c.cilindro({ radio: r, radioSuperior: rSup, alto: h, lados: 7, en: [x, y, z], color,
      oleaje: (t / tramos) * 0.25 });
    y += h * 0.98;
    x += (Math.sin(t * 2.1) * torcido) * radio * 3;
    z += (Math.cos(t * 1.7) * torcido) * radio * 3;
    r = rSup;
  }
  return [x, y, z, r];
}

/** Ceiba: el arbol grande del potrero, copa ancha y abierta. */
export function arbolCeiba(rnd = rnd0) {
  return construir('arbol_ceiba', (c) => {
    const alto = mezclar(4.2, 6.4, rnd());
    const [x, y, z] = tronco(c, { alto, radio: 0.34, color: PALETA.tronco, tramos: 3 });
    const hojaBase = tinte(PALETA.hoja, (rnd() - 0.5) * 0.3);
    for (let r = 0; r < 5; r++) {
      const a = (r / 5) * TAU + rnd();
      const d = mezclar(0.6, 2.0, rnd());
      c.esfera({ radio: mezclar(1.1, 1.8, rnd()), lados: 8, anillos: 5, achatado: 0.62,
        en: [x + Math.cos(a) * d, y - 0.5 + rnd() * 1.2, z + Math.sin(a) * d],
        color: tinte(hojaBase, (rnd() - 0.5) * 0.22), oleaje: 0.8 });
    }
    c.esfera({ radio: 1.7, lados: 9, anillos: 6, achatado: 0.55, en: [x, y - 0.2, z],
      color: hojaBase, oleaje: 0.7 });
  });
}

/** Pino de altura, para las lomas altas. */
export function arbolPino(rnd = rnd0) {
  return construir('arbol_pino', (c) => {
    const alto = mezclar(5, 8, rnd());
    c.cilindro({ radio: 0.2, radioSuperior: 0.1, alto, lados: 6, color: PALETA.tronco });
    const verde = tinte([0.16, 0.31, 0.20], (rnd() - 0.5) * 0.25);
    const pisos = 4;
    for (let p = 0; p < pisos; p++) {
      const t = p / pisos;
      c.cono({ radio: mezclar(1.5, 0.55, t), alto: alto * 0.34, lados: 8,
        en: [0, alto * (0.3 + t * 0.55), 0], color: tinte(verde, t * 0.18), oleaje: 0.35 + t * 0.35 });
    }
  });
}

/** Palo de mango: copa densa y frutas visibles cuando toca la temporada. */
export function arbolMango(rnd = rnd0, conFruta = true) {
  return construir('arbol_mango', (c) => {
    const alto = mezclar(3.4, 4.6, rnd());
    const [x, y, z] = tronco(c, { alto, radio: 0.26, color: PALETA.troncoClaro, tramos: 2 });
    for (let r = 0; r < 4; r++) {
      const a = (r / 4) * TAU;
      c.esfera({ radio: mezclar(1.0, 1.5, rnd()), lados: 8, anillos: 5, achatado: 0.8,
        en: [x + Math.cos(a) * 0.85, y - 0.3 + rnd() * 0.7, z + Math.sin(a) * 0.85],
        color: tinte([0.19, 0.38, 0.17], (rnd() - 0.5) * 0.25), oleaje: 0.75 });
    }
    if (conFruta) {
      for (let f = 0; f < 7; f++) {
        const a = rnd() * TAU, d = mezclar(0.5, 1.5, rnd());
        c.esfera({ radio: 0.16, lados: 6, anillos: 4, achatado: 1.25,
          en: [x + Math.cos(a) * d, y - 0.4 - rnd() * 0.7, z + Math.sin(a) * d],
          color: [0.85, 0.55, 0.12], oleaje: 0.8 });
      }
    }
  });
}

/** Jocote: mas bajo y espinoso, da fruta en verano. */
export function arbolJocote(rnd = rnd0) {
  return construir('arbol_jocote', (c) => {
    const alto = mezclar(2.4, 3.4, rnd());
    const [x, y, z] = tronco(c, { alto, radio: 0.18, color: PALETA.troncoClaro, tramos: 2, torcido: 0.3 });
    for (let r = 0; r < 5; r++) {
      const a = rnd() * TAU;
      c.esfera({ radio: mezclar(0.55, 0.95, rnd()), lados: 7, anillos: 4, achatado: 0.9,
        en: [x + Math.cos(a) * 0.6, y - 0.2 + rnd() * 0.8, z + Math.sin(a) * 0.6],
        color: tinte([0.28, 0.45, 0.20], (rnd() - 0.5) * 0.3), oleaje: 0.85 });
    }
    for (let f = 0; f < 6; f++) {
      const a = rnd() * TAU, d = mezclar(0.3, 0.9, rnd());
      c.esfera({ radio: 0.11, lados: 5, anillos: 3,
        en: [x + Math.cos(a) * d, y - 0.1 - rnd() * 0.6, z + Math.sin(a) * d],
        color: [0.86, 0.33, 0.16], oleaje: 0.9 });
    }
  });
}

/** Arbol seco: es de donde sale la lena sin cortar nada vivo. */
export function arbolSeco(rnd = rnd0) {
  return construir('arbol_seco', (c) => {
    const alto = mezclar(2.6, 4, rnd());
    const [x, y, z, r] = tronco(c, { alto, radio: 0.24, color: [0.35, 0.30, 0.25], tramos: 3, torcido: 0.35 });
    for (let b = 0; b < 4; b++) {
      const a = (b / 4) * TAU + rnd() * 0.6;
      c.cilindro({ radio: r * 0.6, radioSuperior: 0.02, alto: mezclar(0.8, 1.6, rnd()), lados: 5,
        en: [x, y - mezclar(0.2, 1.4, rnd()), z], giroY: a, inclina: mezclar(0.5, 1.1, rnd()),
        color: [0.38, 0.32, 0.26], oleaje: 0.2 });
    }
  });
}

export function palmera(rnd = rnd0) {
  return construir('palmera', (c) => {
    const alto = mezclar(4.5, 6.5, rnd());
    c.cilindro({ radio: 0.22, radioSuperior: 0.14, alto, lados: 7, color: [0.45, 0.38, 0.26],
      inclina: 0.06, oleaje: 0.3 });
    for (let h = 0; h < 8; h++) {
      c.hoja({ largo: mezclar(1.8, 2.6, rnd()), ancho: 0.5, curva: 0.55, tramos: 5,
        en: [0, alto, 0], giroY: (h / 8) * TAU, inclina: mezclar(0.9, 1.5, rnd()),
        color: tinte([0.24, 0.44, 0.22], (rnd() - 0.5) * 0.2), oleaje: 1 });
    }
    for (let f = 0; f < 4; f++) {
      const a = (f / 4) * TAU;
      c.esfera({ radio: 0.17, lados: 5, anillos: 4, en: [Math.cos(a) * 0.25, alto - 0.25, Math.sin(a) * 0.25],
        color: [0.55, 0.45, 0.22], oleaje: 0.6 });
    }
  });
}

// ------------------------------------------------------------ monte y suelo
export function matorral(rnd = rnd0) {
  return construir('matorral', (c) => {
    const base = tinte(PALETA.monte, (rnd() - 0.5) * 0.35);
    for (let b = 0; b < 4; b++) {
      const a = rnd() * TAU, d = rnd() * 0.4;
      c.esfera({ radio: mezclar(0.35, 0.6, rnd()), lados: 6, anillos: 4, achatado: 0.75,
        en: [Math.cos(a) * d, rnd() * 0.15, Math.sin(a) * d],
        color: tinte(base, (rnd() - 0.5) * 0.2), oleaje: 0.85 });
    }
  });
}

/** Mata de mora: el matorral que da fruta al buscar en el monte. */
export function matorralMora(rnd = rnd0) {
  return construir('matorral_mora', (c) => {
    for (let b = 0; b < 3; b++) {
      const a = rnd() * TAU, d = rnd() * 0.35;
      c.esfera({ radio: mezclar(0.35, 0.55, rnd()), lados: 6, anillos: 4, achatado: 0.8,
        en: [Math.cos(a) * d, 0, Math.sin(a) * d], color: [0.20, 0.36, 0.18], oleaje: 0.9 });
    }
    for (let f = 0; f < 9; f++) {
      const a = rnd() * TAU, d = mezclar(0.15, 0.5, rnd());
      c.esfera({ radio: 0.07, lados: 5, anillos: 3,
        en: [Math.cos(a) * d, mezclar(0.3, 0.8, rnd()), Math.sin(a) * d],
        color: [0.32, 0.10, 0.30], oleaje: 0.95 });
    }
  });
}

export function helecho(rnd = rnd0) {
  return construir('helecho', (c) => {
    for (let h = 0; h < 6; h++) {
      c.hoja({ largo: mezclar(0.5, 0.9, rnd()), ancho: 0.22, curva: 0.5, tramos: 3,
        giroY: (h / 6) * TAU + rnd(), inclina: mezclar(0.5, 0.9, rnd()),
        color: tinte([0.20, 0.40, 0.18], (rnd() - 0.5) * 0.25), oleaje: 1 });
    }
  });
}

export function hierba(rnd = rnd0) {
  return construir('hierba', (c) => {
    for (let h = 0; h < 5; h++) {
      c.hoja({ largo: mezclar(0.28, 0.55, rnd()), ancho: 0.09, curva: 0.35, tramos: 2,
        en: [(rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3],
        giroY: rnd() * TAU, inclina: rnd() * 0.4,
        color: tinte(PALETA.pasto, (rnd() - 0.5) * 0.35), oleaje: 1 });
    }
  });
}

export function roca(rnd = rnd0) {
  return construir('roca', (c) => {
    const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const a = rnd() * TAU, d = rnd() * 0.35;
      c.esfera({ radio: mezclar(0.25, 0.6, rnd()), lados: 5, anillos: 3, achatado: mezclar(0.5, 0.9, rnd()),
        en: [Math.cos(a) * d, -0.1, Math.sin(a) * d], giroY: rnd() * TAU,
        color: tinte(PALETA.roca, (rnd() - 0.5) * 0.3) });
    }
  });
}

export function troncoCaido(rnd = rnd0) {
  return construir('tronco_caido', (c) => {
    c.cilindro({ radio: 0.26, radioSuperior: 0.2, alto: mezclar(1.6, 2.6, rnd()), lados: 7,
      inclina: Math.PI / 2, en: [0, 0.26, 0], giroY: rnd() * TAU, color: [0.34, 0.27, 0.20] });
  });
}

/** Monton de lena junto a la casa: crece visualmente segun lo que juntas. */
export function pilaLena(rnd = rnd0) {
  return construir('pila_lena', (c) => {
    for (let k = 0; k < 7; k++) {
      const fila = Math.floor(k / 3);
      c.cilindro({ radio: 0.09, alto: 0.9, lados: 5, inclina: Math.PI / 2,
        en: [(k % 3) * 0.22 - 0.22, 0.09 + fila * 0.19, (fila % 2) * 0.05],
        giroY: 0.1 * k, color: tinte([0.42, 0.32, 0.22], (rnd() - 0.5) * 0.25) });
    }
  });
}

// -------------------------------------------------------------------- cultivos
/** Devuelve las cuatro etapas visibles de una mata: brote, crece, flor, maduro. */
export function mataMaiz(etapa, rnd = rnd0) {
  return construir(`maiz_${etapa}`, (c) => {
    const alto = [0.25, 0.8, 1.5, 1.8][etapa];
    const verde = etapa === 3 ? [0.55, 0.55, 0.25] : [0.30, 0.50, 0.20];
    c.cilindro({ radio: 0.045, radioSuperior: 0.03, alto, lados: 5, color: verde, oleaje: 0.5,
      oleajePorAltura: true });
    const hojas = etapa === 0 ? 2 : 4 + etapa;
    for (let h = 0; h < hojas; h++) {
      c.hoja({ largo: alto * mezclar(0.5, 0.85, rnd()), ancho: 0.16, curva: 0.6, tramos: 3,
        en: [0, alto * (0.25 + 0.6 * (h / hojas)), 0], giroY: (h / hojas) * TAU + rnd(),
        inclina: mezclar(0.7, 1.2, rnd()), color: tinte(verde, (rnd() - 0.5) * 0.2), oleaje: 1 });
    }
    if (etapa >= 2) {
      c.cilindro({ radio: 0.02, alto: 0.3, lados: 4, en: [0, alto, 0], color: [0.70, 0.62, 0.35], oleaje: 1 });
      c.esfera({ radio: 0.075, lados: 6, anillos: 4, achatado: 2.2, en: [0.07, alto * 0.55, 0],
        color: etapa === 3 ? PALETA.maiz : [0.45, 0.55, 0.25], oleaje: 0.6 });
    }
  });
}

export function mataFrijol(etapa, rnd = rnd0) {
  return construir(`frijol_${etapa}`, (c) => {
    const alto = [0.12, 0.32, 0.5, 0.55][etapa];
    const verde = etapa === 3 ? [0.48, 0.45, 0.22] : [0.26, 0.45, 0.22];
    // Tallo y hojas anchas: la mata de frijol se reconoce por la hoja.
    c.cilindro({ radio: 0.016, alto, lados: 4, color: tinte(verde, -0.15), oleaje: 0.5, oleajePorAltura: true });
    for (let h = 0; h < 4 + etapa * 3; h++) {
      const y = alto * mezclar(0.25, 1, rnd());
      c.hoja({ largo: mezclar(0.14, 0.26, rnd()) * (0.65 + etapa * 0.15), ancho: 0.2, curva: 0.55, tramos: 2,
        en: [0, y, 0], giroY: rnd() * TAU, inclina: mezclar(1.0, 1.5, rnd()),
        color: tinte(verde, (rnd() - 0.5) * 0.25), oleaje: 1 });
    }
    if (etapa >= 2) {
      for (let v = 0; v < 3; v++) {
        c.cilindro({ radio: 0.018, alto: 0.16, lados: 4, en: [(rnd() - 0.5) * 0.2, alto * 0.5, (rnd() - 0.5) * 0.2],
          inclina: 1.2, giroY: rnd() * TAU, color: etapa === 3 ? [0.55, 0.44, 0.20] : [0.34, 0.50, 0.22], oleaje: 1 });
      }
    }
  });
}

export function mataArroz(etapa, rnd = rnd0) {
  return construir(`arroz_${etapa}`, (c) => {
    const alto = [0.15, 0.45, 0.7, 0.78][etapa];
    const verde = etapa === 3 ? PALETA.arroz : [0.34, 0.52, 0.24];
    for (let h = 0; h < 6 + etapa * 2; h++) {
      c.hoja({ largo: alto * mezclar(0.7, 1.05, rnd()), ancho: 0.055, curva: 0.4, tramos: 2,
        en: [(rnd() - 0.5) * 0.12, 0, (rnd() - 0.5) * 0.12], giroY: rnd() * TAU,
        inclina: mezclar(0.05, 0.4, rnd()), color: tinte(verde, (rnd() - 0.5) * 0.2), oleaje: 1 });
    }
    if (etapa === 3) {
      for (let e = 0; e < 4; e++) {
        c.cilindro({ radio: 0.012, alto: 0.2, lados: 4, en: [(rnd() - 0.5) * 0.15, alto * 0.8, (rnd() - 0.5) * 0.15],
          inclina: 0.6, giroY: rnd() * TAU, color: [0.82, 0.76, 0.45], oleaje: 1 });
      }
    }
  });
}

export function mataTrigo(etapa, rnd = rnd0) {
  return construir(`trigo_${etapa}`, (c) => {
    const alto = [0.14, 0.42, 0.72, 0.8][etapa];
    const color = etapa === 3 ? PALETA.trigo : [0.42, 0.55, 0.26];
    for (let h = 0; h < 5 + etapa; h++) {
      const dx = (rnd() - 0.5) * 0.12, dz = (rnd() - 0.5) * 0.12;
      c.cilindro({ radio: 0.014, alto, lados: 4, en: [dx, 0, dz], inclina: (rnd() - 0.5) * 0.2,
        color, oleaje: 0.9, oleajePorAltura: true });
      if (etapa >= 2) {
        c.esfera({ radio: 0.035, lados: 5, anillos: 4, achatado: 3.2, en: [dx, alto, dz],
          color: etapa === 3 ? [0.86, 0.74, 0.36] : [0.55, 0.62, 0.30], oleaje: 1 });
      }
    }
  });
}

/** Cuadro de tierra labrada: cambia de color con la humedad (tinte por instancia). */
export function parcela() {
  return construir('parcela', (c) => {
    c.rejilla({ ancho: 2, fondo: 2, divX: 4, divZ: 4, color: PALETA.tierra,
      alturaEn: (x, z) => 0.02 + Math.sin(x * 6) * 0.012 + Math.cos(z * 5) * 0.01 });
    for (let s = 0; s < 4; s++) {
      c.caja({ ancho: 1.9, alto: 0.05, fondo: 0.12, en: [0, 0.02, -0.75 + s * 0.5],
        color: [0.34, 0.24, 0.16] });
    }
  });
}

// ------------------------------------------------------------------ la casa
/** El rancho: adobe, teja y corredor. Es el centro del juego. */
export function casa() {
  return construir('casa', (c) => {
    c.caja({ ancho: 5.2, alto: 2.5, fondo: 4.2, color: PALETA.adobe });
    c.caja({ ancho: 5.4, alto: 0.18, fondo: 4.4, en: [0, 2.5, 0], color: [0.48, 0.38, 0.28] });
    // Dos aguas: dos cajas inclinadas que se encuentran en el caballete.
    for (const lado of [-1, 1]) {
      c.caja({ ancho: 5.8, alto: 0.16, fondo: 3.0, en: [0, 2.68, lado * 1.15],
        inclina: lado * 0.42, color: PALETA.teja });
    }
    c.caja({ ancho: 5.9, alto: 0.16, fondo: 0.3, en: [0, 3.28, 0], color: [0.44, 0.20, 0.14] });
    // Puerta y ventana
    c.caja({ ancho: 1.0, alto: 1.9, fondo: 0.12, en: [0, 0, 2.12], color: [0.30, 0.20, 0.13] });
    c.caja({ ancho: 0.85, alto: 0.75, fondo: 0.12, en: [1.7, 1.2, 2.12], color: [0.16, 0.16, 0.18] });
    c.caja({ ancho: 0.85, alto: 0.75, fondo: 0.12, en: [-1.7, 1.2, 2.12], color: [0.16, 0.16, 0.18] });
    // Corredor con horcones
    c.caja({ ancho: 5.6, alto: 0.12, fondo: 1.9, en: [0, 2.42, 3.0], inclina: 0.3, color: PALETA.teja });
    for (const x of [-2.4, 0, 2.4]) {
      c.cilindro({ radio: 0.12, alto: 2.4, lados: 6, en: [x, 0, 3.6], color: PALETA.troncoClaro });
    }
    c.caja({ ancho: 5.6, alto: 0.08, fondo: 2.0, en: [0, 0, 3.2], color: [0.55, 0.48, 0.40] });
  });
}

export function fogon() {
  return construir('fogon', (c) => {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      c.esfera({ radio: 0.17, lados: 5, anillos: 3, achatado: 0.7,
        en: [Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55], color: tinte(PALETA.roca, (k % 3) * 0.1) });
    }
    for (let k = 0; k < 4; k++) {
      c.cilindro({ radio: 0.06, alto: 0.7, lados: 4, en: [0, 0.02, 0], giroY: (k / 4) * TAU,
        inclina: 0.9, color: [0.32, 0.24, 0.17] });
    }
    // Trebede y comal
    for (const a of [0.4, 2.5, 4.6]) {
      c.cilindro({ radio: 0.05, alto: 0.62, lados: 4, en: [Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45],
        color: [0.25, 0.25, 0.27] });
    }
    c.cilindro({ radio: 0.52, radioSuperior: 0.56, alto: 0.09, lados: 12, en: [0, 0.62, 0],
      color: [0.22, 0.21, 0.20] });
  });
}

export function gallinero() {
  return construir('gallinero', (c) => {
    c.caja({ ancho: 1.8, alto: 1.0, fondo: 1.4, color: [0.52, 0.42, 0.30] });
    c.caja({ ancho: 2.0, alto: 0.12, fondo: 1.6, en: [0, 1.0, 0], inclina: 0.2, color: PALETA.paja });
    for (let k = 0; k < 5; k++) {
      c.cilindro({ radio: 0.03, alto: 1.0, lados: 4, en: [-0.7 + k * 0.35, 0, 0.72], color: [0.35, 0.30, 0.24] });
    }
  });
}

export function cerca() {
  return construir('cerca', (c) => {
    c.cilindro({ radio: 0.07, alto: 1.15, lados: 5, color: PALETA.troncoClaro });
    c.caja({ ancho: 2.0, alto: 0.07, fondo: 0.05, en: [1.0, 0.85, 0], color: [0.48, 0.38, 0.27] });
    c.caja({ ancho: 2.0, alto: 0.07, fondo: 0.05, en: [1.0, 0.5, 0], color: [0.48, 0.38, 0.27] });
  });
}

export function cantaro() {
  return construir('cantaro', (c) => {
    c.esfera({ radio: 0.26, lados: 9, anillos: 6, achatado: 1.1, color: [0.55, 0.32, 0.22] });
    c.cilindro({ radio: 0.1, radioSuperior: 0.13, alto: 0.16, lados: 8, en: [0, 0.5, 0], color: [0.5, 0.28, 0.2] });
  });
}

export function canasta() {
  return construir('canasta', (c) => {
    c.cilindro({ radio: 0.3, radioSuperior: 0.38, alto: 0.34, lados: 10, color: [0.62, 0.48, 0.28] });
    c.cilindro({ radio: 0.36, radioSuperior: 0.36, alto: 0.05, lados: 10, en: [0, 0.34, 0], color: [0.52, 0.40, 0.22] });
  });
}

/** Bandera de objetivo: marca a donde hay que ir sin romper la ambientacion. */
export function senal() {
  return construir('senal', (c) => {
    c.cilindro({ radio: 0.035, alto: 1.6, lados: 5, color: [0.45, 0.36, 0.26] });
    c.caja({ ancho: 0.5, alto: 0.3, fondo: 0.03, en: [0.25, 1.2, 0], color: [0.92, 0.78, 0.30] });
  });
}

// -------------------------------------------------------------------- fauna
/** Cuerpo generico de cuadrupedo, parametrizado por proporciones. */
function cuadrupedo(c, p) {
  const { largo, alto, ancho, color, cuello = 0.3, cabeza = 0.2, orejas = 0.12,
    cola = 0.15, patas = 0.3, cuernos = false, colorPanza = null } = p;
  c.esfera({ radio: largo / 2, lados: 8, anillos: 5, achatado: (alto / largo) * 1.1,
    en: [0, patas, 0], escala: [0.8, 1, ancho / largo * 1.6], color });
  if (colorPanza) {
    c.esfera({ radio: largo / 2.4, lados: 6, anillos: 4, achatado: 0.5,
      en: [0, patas - 0.02, 0], escala: [0.75, 1, ancho / largo * 1.5], color: colorPanza });
  }
  const frente = largo * 0.42;
  c.cilindro({ radio: cabeza * 0.55, radioSuperior: cabeza * 0.45, alto: cuello, lados: 6,
    en: [0, patas + alto * 0.5, frente], inclina: -0.5, color });
  const cy = patas + alto * 0.5 + cuello * 0.75;
  c.esfera({ radio: cabeza, lados: 7, anillos: 5, achatado: 0.85, en: [0, cy, frente + cuello * 0.45], color });
  c.esfera({ radio: cabeza * 0.55, lados: 6, anillos: 4, achatado: 0.8,
    en: [0, cy + cabeza * 0.5, frente + cuello * 0.45 + cabeza * 0.75], color });
  for (const lado of [-1, 1]) {
    c.esfera({ radio: orejas, lados: 5, anillos: 3, achatado: 1.8,
      en: [lado * cabeza * 0.6, cy + cabeza * 1.3, frente + cuello * 0.3], inclina: -0.3, color });
    if (cuernos) {
      c.cilindro({ radio: 0.025, radioSuperior: 0.01, alto: 0.42, lados: 4,
        en: [lado * cabeza * 0.45, cy + cabeza * 1.5, frente + cuello * 0.3],
        inclina: 0.4, giroZ: lado * 0.4, color: [0.42, 0.34, 0.24] });
    }
  }
  for (const lado of [-1, 1]) {
    for (const z of [largo * 0.28, -largo * 0.28]) {
      c.cilindro({ radio: alto * 0.09, alto: patas, lados: 5,
        en: [lado * ancho * 0.34, 0, z], color });
    }
  }
  c.cilindro({ radio: 0.04, radioSuperior: 0.02, alto: cola, lados: 4,
    en: [0, patas + alto * 0.4, -largo * 0.45], inclina: 2.4, color });
}

export function venado(rnd = rnd0) {
  return construir('venado', (c) => cuadrupedo(c, {
    largo: 1.3, alto: 0.62, ancho: 0.5, patas: 0.62, cuello: 0.42, cabeza: 0.17,
    orejas: 0.11, cola: 0.16, cuernos: true,
    color: tinte(PALETA.venado, (rnd() - 0.5) * 0.15), colorPanza: [0.78, 0.70, 0.58],
  }));
}

export function conejo(rnd = rnd0) {
  return construir('conejo', (c) => cuadrupedo(c, {
    largo: 0.38, alto: 0.26, ancho: 0.2, patas: 0.12, cuello: 0.08, cabeza: 0.11,
    orejas: 0.1, cola: 0.06, color: tinte(PALETA.conejo, (rnd() - 0.5) * 0.2),
  }));
}

export function gallina(rnd = rnd0) {
  return construir('gallina', (c) => {
    const col = tinte(PALETA.gallina, (rnd() - 0.5) * 0.25);
    c.esfera({ radio: 0.19, lados: 7, anillos: 5, achatado: 0.9, en: [0, 0.14, 0], escala: [0.85, 1, 1.15], color: col });
    c.esfera({ radio: 0.1, lados: 6, anillos: 4, en: [0, 0.34, 0.16], color: col });
    c.cono({ radio: 0.045, alto: 0.11, lados: 4, en: [0, 0.42, 0.2], inclina: 1.4, color: [0.85, 0.62, 0.15] });
    c.esfera({ radio: 0.05, lados: 5, anillos: 3, achatado: 1.6, en: [0, 0.5, 0.14], color: [0.75, 0.15, 0.12] });
    c.esfera({ radio: 0.12, lados: 6, anillos: 4, achatado: 0.6, en: [0, 0.2, -0.16], inclina: -0.5, color: tinte(col, -0.15) });
    for (const lado of [-1, 1]) {
      c.cilindro({ radio: 0.017, alto: 0.13, lados: 4, en: [lado * 0.06, 0, 0], color: [0.82, 0.60, 0.16] });
    }
  });
}

export function perro(rnd = rnd0) {
  return construir('perro', (c) => cuadrupedo(c, {
    largo: 0.72, alto: 0.34, ancho: 0.26, patas: 0.3, cuello: 0.18, cabeza: 0.14,
    orejas: 0.08, cola: 0.24, color: tinte(PALETA.perro, (rnd() - 0.5) * 0.2),
  }));
}

export function pajaro(rnd = rnd0) {
  return construir('pajaro', (c) => {
    const col = tinte([0.30, 0.36, 0.55], (rnd() - 0.5) * 0.4);
    c.esfera({ radio: 0.1, lados: 6, anillos: 4, achatado: 0.8, escala: [0.8, 1, 1.4], color: col });
    c.esfera({ radio: 0.06, lados: 5, anillos: 3, en: [0, 0.12, 0.1], color: col });
    c.cono({ radio: 0.02, alto: 0.06, lados: 3, en: [0, 0.16, 0.15], inclina: 1.5, color: [0.85, 0.65, 0.2] });
    for (const lado of [-1, 1]) {
      c.hoja({ largo: 0.22, ancho: 0.12, curva: 0.2, tramos: 2, en: [lado * 0.07, 0.08, 0],
        giroY: lado * 1.5, inclina: 1.4, color: tinte(col, -0.2), oleaje: 0.6 });
    }
    c.hoja({ largo: 0.16, ancho: 0.1, curva: 0.1, tramos: 1, en: [0, 0.06, -0.11], inclina: 1.7, color: tinte(col, -0.3) });
  });
}

export function pez(rnd = rnd0) {
  return construir('pez', (c) => {
    const col = tinte(PALETA.pez, (rnd() - 0.5) * 0.3);
    c.esfera({ radio: 0.11, lados: 7, anillos: 4, achatado: 0.55, escala: [0.55, 1, 1.9], color: col });
    c.hoja({ largo: 0.14, ancho: 0.14, curva: 0, tramos: 1, en: [0, 0.06, -0.2], inclina: 1.6, color: tinte(col, -0.25) });
    c.hoja({ largo: 0.09, ancho: 0.07, curva: 0.1, tramos: 1, en: [0, 0.11, 0], inclina: 0.2, color: tinte(col, -0.3) });
  });
}

// ---------------------------------------------------------------- personaje
/**
 * El nino se dibuja por piezas, cada una con el origen en su articulacion.
 * Asi la animacion es girar matrices, sin esqueleto ni pesos: barato y basta.
 */
export function piezasNino(opciones = {}) {
  const piel = opciones.piel || PALETA.piel;
  const camisa = opciones.camisa || PALETA.camisa;
  const pantalon = opciones.pantalon || PALETA.pantalon;
  return {
    nino_torso: construir('nino_torso', (c) => {
      c.caja({ ancho: 0.32, alto: 0.42, fondo: 0.2, en: [0, 0, 0], color: camisa });
      c.caja({ ancho: 0.34, alto: 0.06, fondo: 0.22, en: [0, 0.02, 0], color: [0.35, 0.28, 0.20] });
      c.esfera({ radio: 0.09, lados: 6, anillos: 4, achatado: 0.6, en: [0, 0.4, 0], color: camisa });
    }),
    nino_cabeza: construir('nino_cabeza', (c) => {
      c.esfera({ radio: 0.135, lados: 9, anillos: 7, achatado: 1.05, en: [0, 0, 0], color: piel });
      c.esfera({ radio: 0.14, lados: 8, anillos: 5, achatado: 0.62, en: [0, 0.12, -0.01], color: PALETA.pelo });
      for (const lado of [-1, 1]) {
        c.esfera({ radio: 0.022, lados: 5, anillos: 3, en: [lado * 0.055, 0.13, 0.115], color: [0.10, 0.08, 0.07] });
        c.esfera({ radio: 0.028, lados: 5, anillos: 3, achatado: 0.9, en: [lado * 0.135, 0.11, 0], color: piel });
      }
    }),
    nino_sombrero: construir('nino_sombrero', (c) => {
      c.cilindro({ radio: 0.3, radioSuperior: 0.26, alto: 0.035, lados: 12, color: PALETA.paja });
      c.cilindro({ radio: 0.15, radioSuperior: 0.14, alto: 0.14, lados: 10, en: [0, 0.03, 0], color: tinte(PALETA.paja, -0.1) });
      c.cilindro({ radio: 0.152, radioSuperior: 0.152, alto: 0.035, lados: 10, en: [0, 0.04, 0], color: [0.45, 0.32, 0.20] });
    }),
    nino_brazo: construir('nino_brazo', (c) => {
      c.cilindro({ radio: 0.045, radioSuperior: 0.038, alto: 0.24, en: [0, -0.24, 0], lados: 6, color: camisa });
      c.cilindro({ radio: 0.038, radioSuperior: 0.035, alto: 0.14, en: [0, -0.38, 0], lados: 6, color: piel });
      c.esfera({ radio: 0.05, lados: 5, anillos: 4, en: [0, -0.43, 0], color: piel });
    }),
    nino_pierna: construir('nino_pierna', (c) => {
      c.cilindro({ radio: 0.058, radioSuperior: 0.05, alto: 0.26, en: [0, -0.26, 0], lados: 6, color: pantalon });
      c.cilindro({ radio: 0.048, radioSuperior: 0.045, alto: 0.16, en: [0, -0.42, 0], lados: 6, color: piel });
      c.caja({ ancho: 0.1, alto: 0.05, fondo: 0.17, en: [0, -0.46, 0.03], color: [0.28, 0.22, 0.18] });
    }),
  };
}

/** Objetos que el nino lleva en la mano segun lo que este haciendo. */
export function herramientas() {
  return {
    hondilla: construir('hondilla', (c) => {
      c.cilindro({ radio: 0.012, alto: 0.16, lados: 4, color: [0.36, 0.28, 0.18] });
      for (const lado of [-1, 1]) {
        c.cilindro({ radio: 0.009, alto: 0.14, lados: 4, en: [0, 0.16, 0], giroZ: lado * 0.5, color: [0.36, 0.28, 0.18] });
      }
    }),
    cana: construir('cana', (c) => {
      c.cilindro({ radio: 0.014, radioSuperior: 0.005, alto: 1.5, lados: 4, inclina: -0.5, color: [0.45, 0.36, 0.22] });
    }),
    machete: construir('machete', (c) => {
      c.caja({ ancho: 0.05, alto: 0.5, fondo: 0.012, en: [0, 0.1, 0], color: [0.68, 0.70, 0.72] });
      c.cilindro({ radio: 0.022, alto: 0.12, lados: 5, color: [0.30, 0.22, 0.15] });
    }),
    balde: construir('balde', (c) => {
      c.cilindro({ radio: 0.11, radioSuperior: 0.13, alto: 0.22, lados: 9, color: [0.30, 0.45, 0.55] });
    }),
  };
}

/**
 * Cordillera del fondo: una cortina dentada alrededor del valle. Tapa el borde
 * del mapa y da profundidad; la niebla aerea hace el resto.
 */
export function cordillera(radio, altura, semilla = 1, color = [0.30, 0.38, 0.42]) {
  return construir('cordillera', (c) => {
    const pasos = 96;
    const alturaEn = (i) => {
      const a = (i / pasos) * TAU;
      const n = Math.sin(a * 3.1 + semilla) * 0.5 + Math.sin(a * 7.3 + semilla * 2.1) * 0.3
              + Math.sin(a * 13.7 + semilla * 0.7) * 0.2;
      return altura * (0.55 + 0.45 * (n * 0.5 + 0.5));
    };
    for (let i = 0; i < pasos; i++) {
      const a0 = (i / pasos) * TAU, a1 = ((i + 1) / pasos) * TAU;
      const h0 = alturaEn(i), h1 = alturaEn(i + 1);
      const x0 = Math.cos(a0) * radio, z0 = Math.sin(a0) * radio;
      const x1 = Math.cos(a1) * radio, z1 = Math.sin(a1) * radio;
      const base = c.vertices;
      const dentro = [-Math.cos((a0 + a1) / 2), 0.35, -Math.sin((a0 + a1) / 2)];
      c.vertice([x0, -12, z0], dentro, tinte(color, -0.25), 0);
      c.vertice([x1, -12, z1], dentro, tinte(color, -0.25), 0);
      c.vertice([x1, h1, z1], dentro, tinte(color, 0.18), 0);
      c.vertice([x0, h0, z0], dentro, tinte(color, 0.18), 0);
      c.quad(base, base + 1, base + 2, base + 3);
    }
  });
}

/** Cuadrilatero unitario: lo usan lluvia, chispas y sombras de contacto. */
export function quad() {
  return construir('quad', (c) => {
    c.aportar([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0],
      [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [0, 1, 2, 0, 2, 3], { color: [1, 1, 1] });
  });
}
