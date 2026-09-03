/**
 * terreno.js — El valle donde vive el nino, generado a partir de una semilla.
 *
 * Todo es determinista: la misma semilla da el mismo valle en cualquier
 * dispositivo y en cualquier partida, asi que la historia puede referirse a
 * "la ceiba grande" o "la poza honda" sabiendo que estaran ahi.
 *
 * El relieve se compone en capas:
 *   1. lomas suaves (fbm)               -> el potrero y los caminos
 *   2. monte con crestas (fbm cresta)   -> la loma alta del norte
 *   3. cauce del rio                    -> se resta segun la distancia al hilo
 *   4. aplanados                        -> patio de la casa y cuadros de milpa
 */
import { fbm, fbmCresta, limitar, mezclar, suavizar, distanciaSegmento } from '../nucleo/mate.js';
import { PALETA, tinte } from '../render/malla.js';

export const NIVEL_AGUA = 0;

/** Hilo del rio: puntos por los que pasa el cauce, de norte a sur. */
export const CAUCE = [
  [-104, -96], [-78, -70], [-64, -44], [-58, -18], [-44, 4],
  [-26, 16], [-8, 26], [4, 44], [6, 66], [16, 88], [30, 106],
];

/** Anchura y hondura del cauce en cada tramo (se interpola por cercania). */
const POZA = { x: -26, z: 16, radio: 13 };   // la poza honda: banarse y pescar

export const LUGARES = {
  casa:    { x: -44, z: 44, radio: 12, giro: -0.25 },
  fogon:   { x: -36, z: 52 },
  milpa:   { x: -18, z: 56, filas: 3, columnas: 4, paso: 4.4 },
  poza:    { x: POZA.x, z: POZA.z, radio: POZA.radio },
  vado:    { x: -44, z: 4 },                 // por donde se cruza el rio
  monte:   { x: 34, z: -34, radio: 46 },
  ceiba:   { x: -14, z: 34 },                // el arbol grande, punto de referencia
  potrero: { x: -60, z: 80, radio: 26 },
  pueblo:  { x: 86, z: 92 },                 // hacia donde se va a vender
};

export class Terreno {
  /**
   * @param {object} op {semilla, lado, paso}
   */
  constructor(op = {}) {
    this.semilla = op.semilla ?? 20260903;
    this.lado = op.lado ?? 240;               // el valle es un cuadrado de lado x lado
    this.paso = op.paso ?? 1.5;               // metros entre muestras de altura
    this.n = Math.round(this.lado / this.paso) + 1;
    this.mitad = this.lado / 2;
    this.alturas = new Float32Array(this.n * this.n);
    this.generar();
  }

  /** Altura "cruda" del relieve en un punto continuo, antes de muestrear. */
  crudo(x, z) {
    const s = this.semilla;
    // Lomas suaves de fondo.
    // El valle entero queda por encima del nivel del agua: lo unico que baja
    // de cero es el cauce que se talla mas abajo. Si no, salen lagunas sueltas.
    let h = (fbm(x * 0.0075 + 40, z * 0.0075 + 40, 5, s) * 0.85 + 0.16) * 23;

    // La loma del monte: sube hacia el noreste con crestas.
    const dMonte = Math.hypot(x - LUGARES.monte.x, z - LUGARES.monte.z);
    const kMonte = suavizar(LUGARES.monte.radio + 26, 6, dMonte);
    h += fbmCresta(x * 0.017 + 7, z * 0.017 + 7, 4, s + 31) * 30 * kMonte;
    h += kMonte * 7;

    // Hondonada del potrero: donde pasta el ganado, casi plano.
    const dPot = Math.hypot(x - LUGARES.potrero.x, z - LUGARES.potrero.z);
    h = mezclar(h, mezclar(h, 3.2, 0.82), suavizar(LUGARES.potrero.radio + 14, 4, dPot));

    // El cauce: se busca el tramo mas cercano y se hunde el terreno.
    const { d, t } = this.distanciaCauce(x, z);
    const anchoRio = mezclar(5.5, 9.5, t);
    const dPoza = Math.hypot(x - POZA.x, z - POZA.z);
    const ancho = anchoRio + suavizar(POZA.radio, 0, dPoza) * 7;
    const hondo = 3.4 + suavizar(POZA.radio, 0, dPoza) * 2.6;
    const dentro = suavizar(ancho + 9, ancho * 0.35, d);
    h = mezclar(h, NIVEL_AGUA - hondo, dentro);
    // Barranco: el borde del cauce sube un poco, como en las quebradas.
    h += suavizar(ancho + 13, ancho + 3, d) * (1 - dentro) * 1.6;

    // Aplanado del patio de la casa.
    const dCasa = Math.hypot(x - LUGARES.casa.x, z - LUGARES.casa.z);
    h = mezclar(h, this.alturaCasa ?? h, suavizar(LUGARES.casa.radio + 8, LUGARES.casa.radio * 0.6, dCasa));

    // Aplanado de la milpa: los cuadros tienen que estar a nivel para regar.
    const m = LUGARES.milpa;
    const anchoM = m.columnas * m.paso, largoM = m.filas * m.paso;
    const dx = Math.abs(x - m.x) - anchoM / 2, dz = Math.abs(z - m.z) - largoM / 2;
    const dMilpa = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
    h = mezclar(h, this.alturaMilpa ?? h, suavizar(9, 1.5, dMilpa));

    return h;
  }

  /** Distancia al hilo del rio y posicion normalizada a lo largo del cauce. */
  distanciaCauce(x, z) {
    let mejor = Infinity, mejorT = 0;
    for (let i = 0; i < CAUCE.length - 1; i++) {
      const [ax, az] = CAUCE[i], [bx, bz] = CAUCE[i + 1];
      const d = distanciaSegmento(x, z, ax, az, bx, bz);
      if (d < mejor) { mejor = d; mejorT = i / (CAUCE.length - 2); }
    }
    return { d: mejor, t: mejorT };
  }

  generar() {
    // Las cotas de casa y milpa se fijan antes de muestrear para que el
    // aplanado sea estable (si no, cada muestra se aplanaria contra si misma).
    this.alturaCasa = null; this.alturaMilpa = null;
    this.alturaCasa = this.crudo(LUGARES.casa.x, LUGARES.casa.z) + 0.15;
    this.alturaMilpa = this.crudo(LUGARES.milpa.x, LUGARES.milpa.z);

    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        const x = -this.mitad + i * this.paso;
        const z = -this.mitad + j * this.paso;
        this.alturas[j * this.n + i] = this.crudo(x, z);
      }
    }
  }

  indice(i, j) {
    const ii = limitar(i, 0, this.n - 1) | 0;
    const jj = limitar(j, 0, this.n - 1) | 0;
    return this.alturas[jj * this.n + ii];
  }

  /** Altura interpolada. Es la funcion mas llamada del juego: barata a proposito. */
  altura(x, z) {
    const fx = (x + this.mitad) / this.paso;
    const fz = (z + this.mitad) / this.paso;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const a = this.indice(i, j), b = this.indice(i + 1, j);
    const c = this.indice(i, j + 1), d = this.indice(i + 1, j + 1);
    return mezclar(mezclar(a, b, tx), mezclar(c, d, tx), tz);
  }

  normal(x, z) {
    const e = this.paso;
    const hx = this.altura(x + e, z) - this.altura(x - e, z);
    const hz = this.altura(x, z + e) - this.altura(x, z - e);
    const nx = -hx, ny = 2 * e, nz = -hz;
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }

  /** 0 = llano, 1 = pared. Decide si se puede sembrar o si hay que rodear. */
  pendiente(x, z) {
    return 1 - this.normal(x, z)[1];
  }

  profundidadAgua(x, z) {
    return NIVEL_AGUA - this.altura(x, z);
  }

  enAgua(x, z) { return this.altura(x, z) < NIVEL_AGUA - 0.05; }

  /** Fuera del valle no se puede caminar: el mundo se cierra con el monte. */
  dentro(x, z) {
    const m = this.mitad - 4;
    return x > -m && x < m && z > -m && z < m;
  }

  /**
   * Zona logica del punto. La usan la recoleccion, la caza y las misiones:
   * "buscar en el monte" y "buscar en el potrero" no dan lo mismo.
   */
  zona(x, z) {
    const h = this.altura(x, z);
    if (h < NIVEL_AGUA - 0.05) return 'rio';
    const { d } = this.distanciaCauce(x, z);
    if (d < 13) return 'ribera';
    const m = LUGARES.milpa;
    if (Math.abs(x - m.x) < m.columnas * m.paso * 0.75 && Math.abs(z - m.z) < m.filas * m.paso * 0.9) return 'milpa';
    if (Math.hypot(x - LUGARES.casa.x, z - LUGARES.casa.z) < LUGARES.casa.radio + 6) return 'casa';
    if (Math.hypot(x - LUGARES.monte.x, z - LUGARES.monte.z) < LUGARES.monte.radio) return 'monte';
    if (h > 16) return 'monte';
    return 'potrero';
  }

  /** Color del suelo: mezcla de altura, pendiente y cercania al agua. */
  colorSuelo(x, z, h = this.altura(x, z)) {
    const pend = this.pendiente(x, z);
    const zona = this.zona(x, z);
    let c;
    if (h < NIVEL_AGUA + 0.5) c = [0.62, 0.58, 0.46];              // arena y grava del cauce
    else if (zona === 'milpa') c = PALETA.tierra;
    else if (zona === 'casa') c = mezclarColor(PALETA.tierraSeca, PALETA.pasto, 0.35);
    else if (h > 24) c = mezclarColor(PALETA.monte, PALETA.roca, suavizar(24, 40, h) * 0.7);
    else if (zona === 'monte') c = PALETA.monte;
    else c = PALETA.pasto;
    // Las paredes muestran la tierra: sin esto el monte parece cesped pintado.
    c = mezclarColor(c, PALETA.tierra, suavizar(0.28, 0.72, pend));
    // Variacion fina para que no haya manchas planas de un solo verde.
    const v = (fbm(x * 0.09, z * 0.09, 2, this.semilla + 5) - 0.5) * 0.22;
    return tinte(c, v);
  }

  /** Punto de la orilla mas cercano a un punto dado (para ir a traer agua). */
  orillaCercana(x, z) {
    let mejor = null, mejorD = Infinity;
    for (let i = 0; i < CAUCE.length - 1; i++) {
      for (let t = 0; t <= 1; t += 0.1) {
        const cx = mezclar(CAUCE[i][0], CAUCE[i + 1][0], t);
        const cz = mezclar(CAUCE[i][1], CAUCE[i + 1][1], t);
        const d = Math.hypot(cx - x, cz - z);
        if (d < mejorD) { mejorD = d; mejor = [cx, cz]; }
      }
    }
    return mejor;
  }
}

function mezclarColor(a, b, t) {
  return [mezclar(a[0], b[0], t), mezclar(a[1], b[1], t), mezclar(a[2], b[2], t)];
}
