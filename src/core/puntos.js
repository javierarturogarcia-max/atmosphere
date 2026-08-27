/**
 * puntos.js — Motor de puntuacion.
 *
 * PRINCIPIO DE DISENO: los puntos derivan del impacto fisico real, no de la
 * simpatia del boton. Una accion que evita 10 kg CO2e vale ~10 veces mas que
 * una que evita 1 kg. Encima se aplican multiplicadores conductuales
 * (dificultad, rareza, racha, mision) y un freno de saturacion que impide
 * "farmear" una sola accion.
 *
 * Formula:
 *   base       = 10*co2e + 0.01*agua + 5*residuo   (+ suelo minimo)
 *   bruto      = base * f_dificultad * f_rareza * f_racha * f_mision * f_evento
 *   efectivo   = S(acumuladoCategoriaHoy + bruto) - S(acumuladoCategoriaHoy)
 *   donde S(x) = K * ln(1 + x/K)   -> rendimientos decrecientes por categoria/dia
 */
import { accion, RAREZAS } from '../data/acciones.js';
import { redondear } from './estadistica.js';

/** Equivalencias de puntuacion entre dimensiones de impacto. */
export const PESOS = Object.freeze({
  porKgCO2e: 10,      // 1 kg CO2e evitado = 10 puntos
  porLitroAgua: 0.01, // 1.000 L de agua  = 10 puntos
  porKgResiduo: 5,    // 1 kg desviado    = 5 puntos
  sueloMinimo: 3,     // acciones sin equivalencia directa (ciencia ciudadana)
});

/** Constante de saturacion por categoria y dia. Mas alta = menos freno. */
export const K_SATURACION = 160;

/** Tope duro de puntos por dia: barrera final contra abusos. */
export const TOPE_DIARIO = 2500;

/** Funcion de saturacion logaritmica. Concava, creciente, S(0)=0. */
export function saturar(x, K = K_SATURACION) {
  return K * Math.log(1 + Math.max(0, x) / K);
}

/** Multiplicador por dificultad (1..5) -> 1.00 .. 1.48 */
export function factorDificultad(d = 1) {
  return 1 + 0.12 * (Math.min(5, Math.max(1, d)) - 1);
}

/** Multiplicador por rareza del catalogo. */
export function factorRareza(rareza = 'comun') {
  return RAREZAS[rareza]?.mult ?? 1;
}

/**
 * Multiplicador por racha: +2 % por dia consecutivo, tope +50 % a los 25 dias.
 * Crecimiento lineal saturado: refuerza el habito sin volverse absurdo.
 */
export function factorRacha(dias = 0) {
  return 1 + Math.min(0.5, 0.02 * Math.max(0, dias));
}

/**
 * Puntos de un registro concreto.
 * @param {object} args
 * @param {string} args.accionId
 * @param {number} args.cantidad
 * @param {{co2e:number,agua:number,residuo:number}} args.impacto
 * @param {number} [args.racha]
 * @param {number} [args.acumuladoCategoriaHoy] puntos ya obtenidos hoy en la categoria
 * @param {number} [args.acumuladoDiaHoy] puntos totales ya obtenidos hoy
 * @param {boolean} [args.contribuyeMision]
 * @param {number} [args.factorEvento]
 */
export function calcularPuntos({
  accionId,
  impacto,
  racha = 0,
  acumuladoCategoriaHoy = 0,
  acumuladoDiaHoy = 0,
  contribuyeMision = false,
  factorEvento = 1,
}) {
  const a = accion(accionId);
  if (!a) return { puntos: 0, desglose: { motivo: 'accion desconocida' } };

  const porCO2e = (impacto.co2e || 0) * PESOS.porKgCO2e;
  const porAgua = (impacto.agua || 0) * PESOS.porLitroAgua;
  const porResiduo = (impacto.residuo || 0) * PESOS.porKgResiduo;
  const base = Math.max(PESOS.sueloMinimo, porCO2e + porAgua + porResiduo);

  const fDif = factorDificultad(a.dificultad);
  const fRar = factorRareza(a.rareza);
  const fRac = factorRacha(racha);
  const fMis = contribuyeMision ? 1.5 : 1;
  const fEve = Number.isFinite(factorEvento) ? factorEvento : 1;

  const bruto = base * fDif * fRar * fRac * fMis * fEve;

  // Rendimientos decrecientes dentro de la categoria y el dia.
  const antes = saturar(acumuladoCategoriaHoy);
  const despues = saturar(acumuladoCategoriaHoy + bruto);
  let efectivo = despues - antes;

  // Tope diario absoluto.
  const margen = Math.max(0, TOPE_DIARIO - acumuladoDiaHoy);
  const topado = efectivo > margen;
  efectivo = Math.min(efectivo, margen);

  return {
    puntos: Math.max(0, Math.round(efectivo)),
    desglose: {
      base: redondear(base, 2),
      porCO2e: redondear(porCO2e, 2),
      porAgua: redondear(porAgua, 2),
      porResiduo: redondear(porResiduo, 2),
      factores: {
        dificultad: redondear(fDif, 3),
        rareza: redondear(fRar, 3),
        racha: redondear(fRac, 3),
        mision: fMis,
        evento: fEve,
      },
      bruto: redondear(bruto, 2),
      penalizacionSaturacion: redondear(bruto - (despues - antes), 2),
      topadoPorLimiteDiario: topado,
    },
  };
}

/**
 * Bonus de diversidad: premia repartir el esfuerzo entre categorias.
 * Un perfil que solo recicla no cambia su huella; la diversidad si.
 */
export function bonusDiversidad(categoriasDistintasHoy) {
  const n = categoriasDistintasHoy;
  if (n >= 5) return { factor: 1.25, etiqueta: 'Diversidad excepcional (+25 %)' };
  if (n >= 4) return { factor: 1.15, etiqueta: 'Gran diversidad (+15 %)' };
  if (n >= 3) return { factor: 1.08, etiqueta: 'Buena diversidad (+8 %)' };
  return { factor: 1, etiqueta: '' };
}

/** Puntos teoricos maximos de una accion (para mostrar "hasta X pts" en el catalogo). */
export function puntosOrientativos(accionId, cantidad, impacto) {
  return calcularPuntos({ accionId, cantidad, impacto, racha: 0, acumuladoCategoriaHoy: 0 }).puntos;
}

/**
 * Multiplicador por calidad del aire real.
 *
 * Es la pieza que ata el juego al entorno: cuando el aire de tu ciudad esta
 * mal, dejar el coche vale mas puntos, porque en ese momento vale mas de
 * verdad. Las emisiones evitadas en un episodio de contaminacion tienen un
 * efecto sanitario inmediato sobre las personas que estan respirando ese aire,
 * no solo un efecto climatico difuso a decadas vista.
 *
 * Solo se aplica a movilidad y energia, que son las categorias que influyen
 * sobre la contaminacion local. Reciclar no limpia el aire de hoy.
 *
 * @param {number} aqi indice de calidad del aire (escala EPA)
 * @param {string} categoria categoria de la accion
 */
export function factorAire(aqi, categoria) {
  if (!Number.isFinite(aqi) || !['movilidad', 'energia'].includes(categoria)) {
    return { factor: 1, etiqueta: '', nivel: null };
  }
  if (aqi > 200) return { factor: 2.0, etiqueta: 'Aire muy daniño: puntuacion doble', nivel: 'muy_danina' };
  if (aqi > 150) return { factor: 1.75, etiqueta: 'Aire daniño: x1,75 en movilidad limpia', nivel: 'danina' };
  if (aqi > 100) return { factor: 1.5, etiqueta: 'Aire daniño para sensibles: x1,5', nivel: 'sensibles' };
  if (aqi > 50) return { factor: 1.25, etiqueta: 'Aire moderado: x1,25', nivel: 'moderada' };
  return { factor: 1, etiqueta: '', nivel: 'buena' };
}

/** Antiguedad maxima de una lectura para que siga contando: 3 horas. */
export const VIGENCIA_AIRE_MS = 3 * 60 * 60 * 1000;
