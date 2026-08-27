/**
 * huella.js — Calculadora de huella de carbono personal anual.
 *
 * Metodo hibrido: factores de proceso (ACV) para energia, movilidad y dieta, y
 * factores input-output ambientalmente extendidos (EEIO) para bienes y
 * servicios, que es como se cierra el hueco de las emisiones "invisibles".
 * Resultado en toneladas de CO2e/anio comparado con:
 *   - la media del pais,          - la media mundial,
 *   - el objetivo 2,3 t compatible con 1,5 C (UNEP Emissions Gap 2023).
 */
import { intensidadRed, pais, OBJETIVO_2030_TCO2E, MEDIA_MUNDIAL_TCO2E } from '../data/paises.js';
import { MOVILIDAD, DIETAS, RFI_AVIACION } from '../data/factores.js';
import { redondear } from './estadistica.js';

/** Factores de combustibles domesticos (kg CO2e por unidad, incluye upstream). */
export const COMBUSTIBLES = Object.freeze({
  gas_natural_m3: 2.30,
  glp_litro:      1.56,
  gasoleo_litro:  2.68,
  lena_kg:        0.05,   // biogenico: solo emisiones no-CO2 y gestion
  ninguno:        0,
});

/** Factores EEIO de gasto (kg CO2e por unidad monetaria). Fuente: EXIOBASE v3.8. */
export const EEIO = Object.freeze({
  bienes:    0.35,
  servicios: 0.20,
  ocio:      0.28,
  salud:     0.15,
});

/** Emisiones publicas per capita no atribuibles al individuo (infraestructura, sanidad). */
export const BASE_PUBLICA_T = 1.1;

/**
 * @param {object} e entradas del formulario
 * @param {string} e.pais
 * @param {number} e.personasHogar
 * @param {number} e.electricidadKwhMes
 * @param {string} e.combustible clave de COMBUSTIBLES
 * @param {number} e.combustibleUnidadesMes
 * @param {number} e.kmCocheSemana
 * @param {string} e.tipoCoche clave de MOVILIDAD
 * @param {number} e.kmTransporteSemana
 * @param {number} e.vuelosCortosAnio
 * @param {number} e.vuelosLargosAnio
 * @param {string} e.dieta clave de DIETAS
 * @param {number} e.gastoBienesMes
 * @param {number} e.gastoServiciosMes
 * @param {number} e.reciclajePct
 */
export function calcularHuella(e = {}) {
  const p = pais(e.pais || 'WW');
  const personas = Math.max(1, Number(e.personasHogar) || 1);

  // --- Hogar: se reparte entre convivientes ------------------------------
  const kwhAnio = (Number(e.electricidadKwhMes) || 0) * 12;
  const electricidad = (kwhAnio * intensidadRed(p.cod)) / personas;

  const combKey = e.combustible in COMBUSTIBLES ? e.combustible : 'ninguno';
  const combustible = ((Number(e.combustibleUnidadesMes) || 0) * 12 * COMBUSTIBLES[combKey]) / personas;

  // --- Movilidad terrestre ----------------------------------------------
  const fCoche = MOVILIDAD[e.tipoCoche]?.co2e ?? MOVILIDAD.coche_gasolina.co2e;
  const coche = (Number(e.kmCocheSemana) || 0) * 52 * fCoche;
  const transporte = (Number(e.kmTransporteSemana) || 0) * 52 * MOVILIDAD.autobus_urbano.co2e * 0.8;

  // --- Aviacion: con forzamiento radiativo no-CO2 ------------------------
  const vuelosCortos = (Number(e.vuelosCortosAnio) || 0) * 1200 * MOVILIDAD.avion_corto.co2e * RFI_AVIACION;
  const vuelosLargos = (Number(e.vuelosLargosAnio) || 0) * 7000 * MOVILIDAD.avion_largo.co2e * RFI_AVIACION;
  const aviacion = vuelosCortos + vuelosLargos;

  // --- Alimentacion -------------------------------------------------------
  const dieta = DIETAS[e.dieta] || DIETAS.media_carne;
  const alimentacion = dieta.co2e_dia * 365;

  // --- Consumo (EEIO) -----------------------------------------------------
  const bienes = (Number(e.gastoBienesMes) || 0) * 12 * EEIO.bienes;
  const servicios = (Number(e.gastoServiciosMes) || 0) * 12 * EEIO.servicios;

  // --- Residuos: el reciclaje reduce la fraccion enterrada -----------------
  const reciclaje = Math.min(100, Math.max(0, Number(e.reciclajePct) || 0)) / 100;
  const residuos = 400 * (1 - 0.55 * reciclaje) * 0.45; // 400 kg/hab/anio, 0,45 kg CO2e/kg

  const categorias = [
    { id: 'electricidad', etiqueta: 'Electricidad',   kg: electricidad, icono: '⚡' },
    { id: 'combustible',  etiqueta: 'Calefaccion y gas', kg: combustible, icono: '🔥' },
    { id: 'coche',        etiqueta: 'Coche',          kg: coche,        icono: '🚗' },
    { id: 'transporte',   etiqueta: 'Transporte publico', kg: transporte, icono: '🚇' },
    { id: 'aviacion',     etiqueta: 'Aviacion',       kg: aviacion,     icono: '✈️' },
    { id: 'alimentacion', etiqueta: 'Alimentacion',   kg: alimentacion, icono: '🍽️' },
    { id: 'bienes',       etiqueta: 'Bienes',         kg: bienes,       icono: '🛍️' },
    { id: 'servicios',    etiqueta: 'Servicios',      kg: servicios,    icono: '💼' },
    { id: 'residuos',     etiqueta: 'Residuos',       kg: residuos,     icono: '🗑️' },
    { id: 'publica',      etiqueta: 'Servicios publicos', kg: BASE_PUBLICA_T * 1000, icono: '🏛️' },
  ].map((c) => ({ ...c, kg: Math.max(0, c.kg) }));

  const totalKg = categorias.reduce((s, c) => s + c.kg, 0);
  const totalT = totalKg / 1000;

  const conPct = categorias
    .map((c) => ({ ...c, kg: redondear(c.kg, 1), t: redondear(c.kg / 1000, 3), pct: totalKg ? redondear((c.kg / totalKg) * 100, 1) : 0 }))
    .sort((a, b) => b.kg - a.kg);

  return {
    totalToneladas: redondear(totalT, 2),
    totalKg: redondear(totalKg, 0),
    categorias: conPct,
    dominante: conPct[0],
    comparativa: {
      pais: { nombre: p.nombre, valor: p.huella, ratio: p.huella ? redondear(totalT / p.huella, 2) : null },
      mundial: { valor: MEDIA_MUNDIAL_TCO2E, ratio: redondear(totalT / MEDIA_MUNDIAL_TCO2E, 2) },
      objetivo: { valor: OBJETIVO_2030_TCO2E, ratio: redondear(totalT / OBJETIVO_2030_TCO2E, 2),
                  exceso: redondear(Math.max(0, totalT - OBJETIVO_2030_TCO2E), 2) },
    },
    veredicto: veredicto(totalT),
    planetas: redondear(totalT / OBJETIVO_2030_TCO2E, 2),
    equivalenteArboles: Math.round((totalKg / 21.77)),
  };
}

function veredicto(t) {
  if (t <= 2.3) return { nivel: 'compatible', texto: 'Compatible con la trayectoria de 1,5 C. Estas en el 5 % mundial mas sostenible.', color: '#22c55e' };
  if (t <= 4.0) return { nivel: 'bueno', texto: 'Por debajo de la media mundial, pero aun por encima del objetivo de 2030.', color: '#84cc16' };
  if (t <= 6.6) return { nivel: 'medio', texto: 'En el entorno de la media mundial. Hay margen claro de reduccion.', color: '#eab308' };
  if (t <= 10) return { nivel: 'alto', texto: 'Por encima de la media mundial. Ataca primero aviacion, coche y dieta.', color: '#f97316' };
  return { nivel: 'muy_alto', texto: 'Huella muy elevada. Tres o cuatro decisiones estructurales la reducirian a la mitad.', color: '#ef4444' };
}

/**
 * Escenarios contrafactuales: cuanto se ahorraria con cada palanca.
 * Es lo mas util de una calculadora: no el numero, sino que hacer con el.
 */
export function escenarios(entradas) {
  const base = calcularHuella(entradas);
  const palancas = [
    { id: 'dieta_vegetariana', etiqueta: 'Pasar a dieta vegetariana', cambios: { dieta: 'vegetariana' }, icono: '🥗' },
    { id: 'dieta_vegana', etiqueta: 'Pasar a dieta vegana', cambios: { dieta: 'vegana' }, icono: '🌱' },
    { id: 'sin_vuelos', etiqueta: 'Renunciar a volar un anio', cambios: { vuelosCortosAnio: 0, vuelosLargosAnio: 0 }, icono: '🚆' },
    { id: 'coche_electrico', etiqueta: 'Cambiar a coche electrico', cambios: { tipoCoche: 'coche_electrico' }, icono: '🔌' },
    { id: 'mitad_coche', etiqueta: 'Reducir el coche a la mitad', cambios: { kmCocheSemana: (Number(entradas.kmCocheSemana) || 0) / 2 }, icono: '🚲' },
    { id: 'energia_verde', etiqueta: 'Contratar electricidad renovable', cambios: { pais: 'NO' }, icono: '🌞' },
    { id: 'menos_bienes', etiqueta: 'Reducir 30 % la compra de bienes', cambios: { gastoBienesMes: (Number(entradas.gastoBienesMes) || 0) * 0.7 }, icono: '🛍️' },
    { id: 'reciclar_todo', etiqueta: 'Reciclar el 90 % de los residuos', cambios: { reciclajePct: 90 }, icono: '♻️' },
  ];

  return palancas.map((p) => {
    const alternativa = calcularHuella({ ...entradas, ...p.cambios });
    const ahorro = base.totalToneladas - alternativa.totalToneladas;
    return {
      ...p,
      nuevaHuella: alternativa.totalToneladas,
      ahorroT: redondear(Math.max(0, ahorro), 2),
      ahorroPct: base.totalToneladas ? redondear((Math.max(0, ahorro) / base.totalToneladas) * 100, 1) : 0,
    };
  }).sort((a, b) => b.ahorroT - a.ahorroT);
}

/** Entradas por defecto: perfil urbano medio, util como punto de partida. */
export function entradasPorDefecto(codPais = 'WW') {
  return {
    pais: codPais,
    personasHogar: 3,
    electricidadKwhMes: 200,
    combustible: 'gas_natural_m3',
    combustibleUnidadesMes: 60,
    kmCocheSemana: 120,
    tipoCoche: 'coche_gasolina',
    kmTransporteSemana: 40,
    vuelosCortosAnio: 1,
    vuelosLargosAnio: 0,
    dieta: 'media_carne',
    gastoBienesMes: 150,
    gastoServiciosMes: 120,
    reciclajePct: 40,
  };
}
