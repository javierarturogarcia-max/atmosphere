/**
 * aire.js — Indice de calidad del aire y riesgo sanitario.
 *
 * Implementa el AQI de la EPA de EE. UU. (revision de 2024 para PM2,5) por
 * interpolacion lineal por tramos, y compara con las guias de la OMS de 2021,
 * mucho mas estrictas. Se incluye el calculo de riesgo relativo de mortalidad
 * por PM2,5 segun la funcion concentracion-respuesta del Global Burden of Disease.
 */

/**
 * Tramos del AQI: [Clow, Chigh, Ilow, Ihigh].
 * PM2,5 y PM10 en ug/m3 (24 h); O3 en ppb (8 h); NO2 y SO2 en ppb (1 h); CO en ppm (8 h).
 */
export const TRAMOS = Object.freeze({
  pm25: [[0.0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150],
         [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]],
  pm10: [[0, 54, 0, 50], [55, 154, 51, 100], [155, 254, 101, 150],
         [255, 354, 151, 200], [355, 424, 201, 300], [425, 604, 301, 500]],
  o3:   [[0, 54, 0, 50], [55, 70, 51, 100], [71, 85, 101, 150],
         [86, 105, 151, 200], [106, 200, 201, 300]],
  no2:  [[0, 53, 0, 50], [54, 100, 51, 100], [101, 360, 101, 150],
         [361, 649, 151, 200], [650, 1249, 201, 300], [1250, 2049, 301, 500]],
  so2:  [[0, 35, 0, 50], [36, 75, 51, 100], [76, 185, 101, 150],
         [186, 304, 151, 200], [305, 604, 201, 300], [605, 1004, 301, 500]],
  co:   [[0.0, 4.4, 0, 50], [4.5, 9.4, 51, 100], [9.5, 12.4, 101, 150],
         [12.5, 15.4, 151, 200], [15.5, 30.4, 201, 300], [30.5, 50.4, 301, 500]],
});

export const CATEGORIAS_AQI = Object.freeze([
  { max: 50,  nombre: 'Buena',                    color: '#22c55e', consejo: 'Calidad del aire satisfactoria. Actividad al aire libre sin restricciones.' },
  { max: 100, nombre: 'Moderada',                 color: '#eab308', consejo: 'Aceptable. Las personas muy sensibles deberian limitar el esfuerzo prolongado al aire libre.' },
  { max: 150, nombre: 'Danina para sensibles',    color: '#f97316', consejo: 'Ninos, mayores, asmaticos y cardiopatas: reducir el ejercicio intenso en exterior.' },
  { max: 200, nombre: 'Danina',                   color: '#ef4444', consejo: 'Toda la poblacion puede notar efectos. Evitar el esfuerzo prolongado al aire libre.' },
  { max: 300, nombre: 'Muy danina',               color: '#a855f7', consejo: 'Alerta sanitaria. Permanecer en interiores con filtracion si es posible.' },
  { max: 500, nombre: 'Peligrosa',                color: '#7f1d1d', consejo: 'Emergencia sanitaria. Evitar toda actividad exterior y usar purificacion HEPA.' },
]);

/** Guias de la OMS 2021 (ug/m3, salvo CO en mg/m3). */
export const GUIA_OMS = Object.freeze({
  pm25: { anual: 5, dia: 15 },
  pm10: { anual: 15, dia: 45 },
  no2:  { anual: 10, dia: 25 },
  o3:   { pico: 60, ocho: 100 },
  so2:  { dia: 40 },
  co:   { ocho: 4 },
});

/** Interpolacion lineal por tramos del AQI para un contaminante. */
export function aqiContaminante(contaminante, concentracion) {
  const tramos = TRAMOS[contaminante];
  if (!tramos || !Number.isFinite(concentracion) || concentracion < 0) return null;
  for (const [cLo, cHi, iLo, iHi] of tramos) {
    if (concentracion >= cLo && concentracion <= cHi) {
      return Math.round(((iHi - iLo) / (cHi - cLo)) * (concentracion - cLo) + iLo);
    }
  }
  // Por encima del ultimo tramo: extrapolacion conservadora.
  const ultimo = tramos[tramos.length - 1];
  return concentracion > ultimo[1] ? 500 : null;
}

/** Categoria del AQI. */
export function categoriaAQI(aqi) {
  return CATEGORIAS_AQI.find((c) => aqi <= c.max) || CATEGORIAS_AQI[CATEGORIAS_AQI.length - 1];
}

/**
 * AQI global: el maximo de los subindices (asi lo define la EPA), indicando
 * cual es el contaminante dominante.
 * @param {{pm25?:number, pm10?:number, o3?:number, no2?:number, so2?:number, co?:number}} lecturas
 */
export function calcularAQI(lecturas) {
  const sub = [];
  for (const [k, v] of Object.entries(lecturas)) {
    if (!TRAMOS[k] || v === null || v === undefined || v === '') continue;
    const i = aqiContaminante(k, Number(v));
    if (i !== null) sub.push({ contaminante: k, concentracion: Number(v), aqi: i });
  }
  if (!sub.length) return null;
  sub.sort((a, b) => b.aqi - a.aqi);
  const dominante = sub[0];
  const cat = categoriaAQI(dominante.aqi);
  return {
    aqi: dominante.aqi,
    dominante: dominante.contaminante,
    categoria: cat.nombre,
    color: cat.color,
    consejo: cat.consejo,
    subindices: sub,
    excesosOMS: excesosOMS(lecturas),
  };
}

/** Cuantas veces se supera la guia diaria de la OMS 2021. */
export function excesosOMS(lecturas) {
  const out = [];
  const dia = { pm25: GUIA_OMS.pm25.dia, pm10: GUIA_OMS.pm10.dia, no2: GUIA_OMS.no2.dia, so2: GUIA_OMS.so2.dia };
  for (const [k, guia] of Object.entries(dia)) {
    const v = Number(lecturas[k]);
    if (Number.isFinite(v) && v > 0) {
      out.push({ contaminante: k, valor: v, guia, veces: Math.round((v / guia) * 100) / 100, supera: v > guia });
    }
  }
  return out;
}

/**
 * Riesgo relativo de mortalidad por exposicion cronica a PM2,5.
 * Modelo log-lineal usado en GBD/OMS: RR = exp(beta * max(0, C - C0))
 * con beta = 0,0059 por ug/m3 (equivale a +6 % de mortalidad total por cada
 * 10 ug/m3, coherente con Pope et al. 2002 y meta-analisis posteriores) y
 * C0 = 5 ug/m3 (contrafactual teorico minimo de la OMS).
 */
export function riesgoPM25(concentracionAnual) {
  const C0 = 5;
  const beta = 0.0059;
  const C = Math.max(0, Number(concentracionAnual) || 0);
  const rr = Math.exp(beta * Math.max(0, C - C0));
  const exceso = (rr - 1) * 100;
  // Esperanza de vida: ~0,098 anios perdidos por cada ug/m3 sobre C0 (AQLI, Chicago).
  const anosVida = Math.max(0, (C - C0)) * 0.098;
  return {
    concentracion: C,
    riesgoRelativo: Math.round(rr * 1000) / 1000,
    excesoMortalidadPct: Math.round(exceso * 10) / 10,
    anosVidaPerdidos: Math.round(anosVida * 100) / 100,
    vecesGuiaOMS: Math.round((C / GUIA_OMS.pm25.anual) * 10) / 10,
  };
}

/** Nombres legibles de contaminantes con su origen principal. */
export const CONTAMINANTES = Object.freeze({
  pm25: { nombre: 'PM2,5', unidad: 'ug/m3', origen: 'Combustion: trafico diesel, biomasa, industria. Penetra hasta los alveolos y pasa a la sangre.' },
  pm10: { nombre: 'PM10',  unidad: 'ug/m3', origen: 'Polvo, obras, desgaste de frenos y neumaticos, agricultura.' },
  o3:   { nombre: 'Ozono troposferico', unidad: 'ppb', origen: 'Secundario: se forma con NOx + COV bajo radiacion solar. Empeora en olas de calor.' },
  no2:  { nombre: 'NO2',   unidad: 'ppb', origen: 'Trafico rodado (sobre todo diesel) y calderas de gas. Marcador urbano.' },
  so2:  { nombre: 'SO2',   unidad: 'ppb', origen: 'Quema de carbon y fueloil con azufre; refino y maritimo.' },
  co:   { nombre: 'CO',    unidad: 'ppm', origen: 'Combustion incompleta: motores, braseros, calentadores mal ventilados.' },
});

// ============================================================ conversion de unidades

/**
 * Volumen molar de un gas ideal a 25 C y 1013,25 hPa, en L/mol.
 * Es la constante que usa la EPA para convertir entre masa y volumen.
 */
export const VOLUMEN_MOLAR = 24.45;

/** Masas moleculares en g/mol de los gases con tramos de AQI. */
export const MASA_MOLAR = Object.freeze({
  o3: 48.00,
  no2: 46.0055,
  so2: 64.066,
  co: 28.010,
});

/**
 * Convierte una concentracion de ug/m3 a ppb.
 *
 * IMPRESCINDIBLE: los tramos del AQI de la EPA estan definidos en ppb para O3,
 * NO2 y SO2, y en ppm para CO, pero casi todas las fuentes de datos (Open-Meteo,
 * CAMS, la mayoria de sensores) publican en ug/m3. Aplicar los tramos
 * directamente sobre ug/m3 es un error silencioso: da un AQI plausible pero
 * equivocado, casi siempre por exceso.
 */
export function ugm3ApPpb(valor, contaminante) {
  const mw = MASA_MOLAR[contaminante];
  if (!mw || !Number.isFinite(valor)) return null;
  return (valor * VOLUMEN_MOLAR) / mw;
}

/** Conversion inversa: de ppb a ug/m3. */
export function ppbAUgm3(valor, contaminante) {
  const mw = MASA_MOLAR[contaminante];
  if (!mw || !Number.isFinite(valor)) return null;
  return (valor * mw) / VOLUMEN_MOLAR;
}

/**
 * Normaliza un juego de lecturas en ug/m3 a las unidades que espera calcularAQI:
 * PM en ug/m3 (sin tocar), O3/NO2/SO2 en ppb y CO en ppm.
 */
export function normalizarDesdeUgm3(lecturas) {
  const salida = {};
  if (Number.isFinite(lecturas.pm25)) salida.pm25 = lecturas.pm25;
  if (Number.isFinite(lecturas.pm10)) salida.pm10 = lecturas.pm10;
  for (const gas of ['o3', 'no2', 'so2']) {
    if (Number.isFinite(lecturas[gas])) salida[gas] = ugm3ApPpb(lecturas[gas], gas);
  }
  if (Number.isFinite(lecturas.co)) salida.co = ugm3ApPpb(lecturas.co, 'co') / 1000; // ppb -> ppm
  return salida;
}
