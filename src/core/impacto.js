/**
 * impacto.js — Traduce "cantidad registrada" a impacto fisico evitado.
 *
 * Separado a proposito del sistema de puntos: el impacto es FISICA (kg CO2e,
 * litros, kg de residuo) y no debe contaminarse con reglas de juego. Los puntos
 * son una capa motivacional construida encima (ver puntos.js).
 */
import { intensidadRed } from '../data/paises.js';
import { accion } from '../data/acciones.js';
import { SUMIDEROS, EQUIVALENCIAS } from '../data/factores.js';
import { propagarIncertidumbre, redondear } from './estadistica.js';

/** Incertidumbre relativa por defecto de un factor de accion (ACV tipico). */
const INC_POR_DEFECTO = 0.30;

/**
 * Calcula el impacto evitado por un registro.
 * @param {string} accionId
 * @param {number} cantidad  en la unidad de la accion
 * @param {{pais?: string}} opciones
 * @returns {{co2e:number, agua:number, residuo:number, kwh:number, detalle:object}}
 */
export function calcularImpacto(accionId, cantidad, { pais = 'WW' } = {}) {
  const a = accion(accionId);
  if (!a) throw new Error(`Accion desconocida: ${accionId}`);
  const q = Number(cantidad);
  if (!Number.isFinite(q) || q <= 0) {
    return { co2e: 0, agua: 0, residuo: 0, kwh: 0, detalle: { motivo: 'cantidad no valida' } };
  }

  const kwh = (a.kwh || 0) * q;
  // Si la accion ahorra electricidad, su CO2e depende del mix del pais.
  const co2eRed = a.dependeRed ? kwh * intensidadRed(pais) : 0;
  const co2eDirecto = (a.co2e || 0) * q;
  const co2e = co2eDirecto + co2eRed;

  return {
    co2e: redondear(co2e, 4),
    agua: redondear((a.agua || 0) * q, 2),
    residuo: redondear((a.residuo || 0) * q, 4),
    kwh: redondear(kwh, 4),
    detalle: {
      accionId, cantidad: q, unidad: a.unidad, pais,
      dependeRed: !!a.dependeRed,
      intensidadRed: a.dependeRed ? intensidadRed(pais) : null,
      base: a.base,
    },
  };
}

/**
 * Impacto agregado de una lista de registros, con propagacion de incertidumbre.
 * Devuelve el intervalo de confianza al 95 % del CO2e total: honestidad cientifica.
 */
export function agregarImpacto(registros) {
  const total = { co2e: 0, agua: 0, residuo: 0, kwh: 0 };
  const terminos = [];
  for (const r of registros) {
    total.co2e += r.impacto?.co2e || 0;
    total.agua += r.impacto?.agua || 0;
    total.residuo += r.impacto?.residuo || 0;
    total.kwh += r.impacto?.kwh || 0;
    const a = accion(r.accionId);
    terminos.push({ valor: r.impacto?.co2e || 0, inc: a?.inc ?? INC_POR_DEFECTO });
  }
  const ic = propagarIncertidumbre(terminos);
  return {
    co2e: redondear(total.co2e, 3),
    agua: redondear(total.agua, 1),
    residuo: redondear(total.residuo, 3),
    kwh: redondear(total.kwh, 2),
    co2eIC: { inferior: redondear(ic.inferior, 3), superior: redondear(ic.superior, 3), incRelativa: redondear(ic.incRelativa, 3) },
    n: registros.length,
  };
}

/** Agrupa el impacto por categoria de accion. */
export function impactoPorCategoria(registros) {
  const mapa = new Map();
  for (const r of registros) {
    const a = accion(r.accionId);
    if (!a) continue;
    const actual = mapa.get(a.cat) || { co2e: 0, agua: 0, residuo: 0, n: 0, puntos: 0 };
    actual.co2e += r.impacto?.co2e || 0;
    actual.agua += r.impacto?.agua || 0;
    actual.residuo += r.impacto?.residuo || 0;
    actual.puntos += r.puntos || 0;
    actual.n += 1;
    mapa.set(a.cat, actual);
  }
  return [...mapa.entries()]
    .map(([cat, v]) => ({ cat, ...v, co2e: redondear(v.co2e, 3) }))
    .sort((x, y) => y.co2e - x.co2e);
}

/**
 * Convierte kg CO2e a equivalencias comprensibles.
 * La abstraccion "kg CO2e" no motiva a nadie: los equivalentes si.
 */
export function equivalencias(co2eKg) {
  const c = Math.max(0, co2eKg);
  return {
    kmCoche: redondear(c / EQUIVALENCIAS.km_coche_gasolina, 1),
    cargasMovil: Math.round(c / EQUIVALENCIAS.carga_movil),
    botellas: Math.round(c / EQUIVALENCIAS.botella_plastico),
    hamburguesas: redondear(c / EQUIVALENCIAS.hamburguesa_res, 1),
    arbolesAnio: redondear(c / SUMIDEROS.arbol_anio, 2),
    m2BosqueAnio: redondear((c / SUMIDEROS.hectarea_bosque_anio) * 10000, 1),
    duchas: redondear(c / EQUIVALENCIAS.ducha_10min, 1),
  };
}

/** Equivalencias de agua en unidades cotidianas. */
export function equivalenciasAgua(litros) {
  const L = Math.max(0, litros);
  return {
    duchas: redondear(L / 95, 1),
    banerasLlenas: redondear(L / 150, 1),
    diasConsumoPersona: redondear(L / 130, 1), // consumo domestico medio: 130 L/hab/dia
    botellas15: Math.round(L / 1.5),
  };
}

/** Frase de equivalencia mas expresiva segun la magnitud. */
export function frasEquivalencia(co2eKg) {
  const e = equivalencias(co2eKg);
  if (co2eKg <= 0) return 'Sin impacto registrado todavia';
  if (co2eKg < 1) return `${e.cargasMovil} cargas de movil evitadas`;
  if (co2eKg < 25) return `${e.kmCoche} km en coche que no se han emitido`;
  if (co2eKg < 250) return `Lo que absorben ${e.arbolesAnio} arboles en un anio`;
  return `${redondear(co2eKg / 1000, 2)} t CO2e: mas de lo que emite una persona en un mes`;
}
