/**
 * analitica.js — Capa analitica: convierte el historial en conocimiento.
 * Construye el `resumen` que consumen logros, ranking e interfaz, y ejecuta
 * el analisis de series temporales (tendencia, proyeccion, estacionalidad).
 */
import { accion, CATEGORIAS } from '../data/acciones.js';
import { claveDia, calcularRacha, mejorRacha, ultimosDias } from './rachas.js';
import { nivelDesdeXP } from './nivel.js';
import { indiceConfianza } from './validacion.js';
import { agregarImpacto, impactoPorCategoria } from './impacto.js';
import {
  suma, media, mediana, desviacion, regresionLineal, theilSen, mannKendall,
  mediaMovil, ewma, pielou, shannon, gini, redondear, percentil, coefVariacion,
} from './estadistica.js';

/**
 * Resumen agregado del perfil. Es la unica fuente de verdad para logros.
 * @param {object} estado estado completo del perfil
 */
export function construirResumen(estado) {
  const registros = estado.registros || [];
  const impacto = agregarImpacto(registros);
  const dias = [...new Set(registros.map((r) => claveDia(new Date(r.fecha))))].sort();
  const racha = calcularRacha(dias, claveDia(), estado.perfil?.congelaciones || 0);

  // Acumulados por accion en su unidad nativa: `${accionId}_${unidad}`
  const porAccion = {};
  const conteoAcciones = {};
  for (const r of registros) {
    const a = accion(r.accionId);
    if (!a) continue;
    const clave = `${a.id}_${a.unidad}`;
    porAccion[clave] = (porAccion[clave] || 0) + (r.cantidad || 0);
    conteoAcciones[a.id] = (conteoAcciones[a.id] || 0) + 1;
  }

  const porCat = impactoPorCategoria(registros);
  const conteosCat = Object.keys(CATEGORIAS).map(
    (c) => porCat.find((p) => p.cat === c)?.n || 0
  );

  const xp = estado.perfil?.xp || 0;
  const registroMadrugada = registros.some((r) => new Date(r.fecha).getHours() < 7);

  return {
    registros: registros.length,
    accionesDistintas: Object.keys(conteoAcciones).length,
    puntos: estado.perfil?.puntos || 0,
    puntosTotalesHistoricos: estado.perfil?.puntosHistoricos || 0,
    xp,
    nivel: nivelDesdeXP(xp),
    co2eTotal: impacto.co2e,
    co2eIC: impacto.co2eIC,
    aguaTotal: impacto.agua,
    residuoTotal: impacto.residuo,
    kwhTotal: impacto.kwh,
    porAccion,
    conteoAcciones,
    porCategoria: porCat,
    categoriasUsadas: porCat.length,
    shannon: redondear(shannon(conteosCat), 3),
    pielou: redondear(pielou(conteosCat), 3),
    gini: redondear(gini(conteosCat), 3),
    diasActivos: dias.length,
    dias,
    rachaActual: racha.actual,
    rachaMejor: Math.max(racha.mejor, mejorRacha(dias)),
    rachaSinCoche: rachaSinCoche(registros),
    arboles: (porAccion['bio_plantar_arbol_ud'] || 0),
    misionesCompletadas: (estado.misionesCompletadas || []).length,
    canjes: (estado.canjes || []).length,
    confianza: indiceConfianza(registros).valor,
    huellaAnual: estado.huella?.totalToneladas || 0,
    registroMadrugada,
  };
}

/** Dias consecutivos con movilidad registrada y sin uso de coche particular. */
function rachaSinCoche(registros) {
  const porDia = new Map();
  for (const r of registros) {
    const a = accion(r.accionId);
    if (!a || a.cat !== 'movilidad') continue;
    const d = claveDia(new Date(r.fecha));
    const limpio = a.id !== 'mov_conduccion';
    porDia.set(d, (porDia.get(d) ?? true) && limpio);
  }
  const dias = [...porDia.keys()].sort();
  let mejor = 0, actual = 0, previo = null;
  for (const d of dias) {
    const esConsecutivo = previo && (new Date(`${d}T00:00:00`) - new Date(`${previo}T00:00:00`)) === 86400000;
    actual = porDia.get(d) ? (esConsecutivo ? actual + 1 : 1) : 0;
    if (actual > mejor) mejor = actual;
    previo = d;
  }
  return mejor;
}

/**
 * Serie temporal diaria de una metrica, rellenando los dias sin actividad con 0.
 * @param {Array} registros
 * @param {'co2e'|'agua'|'residuo'|'puntos'|'n'} metrica
 * @param {number} nDias
 */
export function serieDiaria(registros, metrica = 'co2e', nDias = 30, hoy = claveDia()) {
  const dias = ultimosDias(nDias, hoy);
  const mapa = new Map(dias.map((d) => [d, 0]));
  for (const r of registros) {
    const d = claveDia(new Date(r.fecha));
    if (!mapa.has(d)) continue;
    const v = metrica === 'puntos' ? (r.puntos || 0)
      : metrica === 'n' ? 1
      : (r.impacto?.[metrica] || 0);
    mapa.set(d, mapa.get(d) + v);
  }
  return dias.map((d) => ({ dia: d, valor: redondear(mapa.get(d), 3) }));
}

/**
 * Analisis completo de una serie: descriptivos, tendencia robusta, test de
 * significacion y proyeccion. Es la pieza que da rigor a la palabra "analitica".
 */
export function analizarSerie(serie, { horizonte = 30 } = {}) {
  const valores = serie.map((p) => p.valor);
  const n = valores.length;
  if (n === 0) return null;

  const ols = regresionLineal(valores);
  const ts = theilSen(valores);
  const mk = mannKendall(valores);
  const activos = valores.filter((v) => v > 0);

  const total = suma(valores);
  const mediaDiaria = media(valores);
  const proyeccion = Math.max(0, mediaDiaria * horizonte);

  // La proyeccion por tendencia usa el estimador ROBUSTO (Theil-Sen), no OLS:
  // con pocos dias activos, un unico pico dispara la recta de minimos cuadrados
  // y produce cifras absurdas que destruyen la credibilidad de la herramienta.
  const ultimo = valores[n - 1] ?? 0;
  const proyeccionTendencia = Math.max(
    0,
    suma(Array.from({ length: horizonte }, (_, i) => Math.max(0, ultimo + ts * (i + 1))))
  );

  // Una serie con menos de 7 puntos o menos de 5 dias activos no sostiene
  // ninguna extrapolacion: se declara explicitamente en vez de disimularlo.
  const fiable = n >= 7 && activos.length >= 5;

  return {
    n,
    total: redondear(total, 3),
    media: redondear(mediaDiaria, 3),
    mediana: redondear(mediana(valores), 3),
    desviacion: redondear(desviacion(valores), 3),
    coefVariacion: redondear(coefVariacion(valores), 3),
    max: Math.max(...valores),
    p90: redondear(percentil(valores, 0.9), 3),
    diasActivos: activos.length,
    tasaActividad: redondear(activos.length / n, 3),
    tendencia: {
      ols: redondear(ols.pendiente, 4),
      theilSen: redondear(ts, 4),
      r2: redondear(ols.r2, 3),
      mannKendall: { tau: redondear(mk.tau, 3), p: redondear(mk.p, 4), texto: mk.tendencia },
      direccion: ts > 0.001 ? 'al alza' : ts < -0.001 ? 'a la baja' : 'estable',
      significativa: mk.p < 0.05,
    },
    suavizado: {
      mm7: mediaMovil(valores, 7).map((v) => redondear(v, 3)),
      ewma: ewma(valores, 0.3).map((v) => redondear(v, 3)),
    },
    proyeccion: {
      horizonte,
      porMedia: redondear(proyeccion, 2),
      porTendencia: redondear(proyeccionTendencia, 2),
      fiable,
      motivo: fiable ? '' : `Serie insuficiente para extrapolar: ${activos.length} dias activos de ${n}.`,
    },
  };
}

/** Comparativa semana actual frente a la anterior (variacion porcentual). */
export function compararPeriodos(registros, metrica = 'co2e', dias = 7, hoy = claveDia()) {
  const serie = serieDiaria(registros, metrica, dias * 2, hoy).map((p) => p.valor);
  const previa = suma(serie.slice(0, dias));
  const actual = suma(serie.slice(dias));
  // Sin actividad en el periodo previo no existe variacion porcentual: dar un
  // "+100 %" seria inventarse una linea base que no existe.
  const sinBase = previa === 0;
  const variacion = sinBase ? 0 : (actual - previa) / previa;
  return {
    actual: redondear(actual, 2),
    previa: redondear(previa, 2),
    variacion: redondear(variacion, 3),
    sinBase,
    mejora: actual >= previa,
  };
}

/** Distribucion por hora del dia: revela cuando actua la persona. */
export function perfilHorario(registros) {
  const horas = new Array(24).fill(0);
  for (const r of registros) horas[new Date(r.fecha).getHours()] += 1;
  const total = suma(horas) || 1;
  const pico = horas.indexOf(Math.max(...horas));
  return { horas, porcentajes: horas.map((h) => redondear((h / total) * 100, 1)), pico };
}

/** Distribucion por dia de la semana (0 = lunes). */
export function perfilSemanal(registros) {
  const dias = new Array(7).fill(0);
  for (const r of registros) {
    const d = new Date(r.fecha).getDay();
    dias[(d + 6) % 7] += 1;
  }
  const etiquetas = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  return { dias, etiquetas, pico: etiquetas[dias.indexOf(Math.max(...dias))] };
}

/**
 * Detecta la palanca con mayor potencial no explotado: compara el impacto medio
 * por accion de cada categoria con lo que la persona ya usa.
 */
export function recomendarPalanca(resumen) {
  const usadas = new Map(resumen.porCategoria.map((c) => [c.cat, c]));
  const candidatas = Object.keys(CATEGORIAS).map((cat) => {
    const c = usadas.get(cat);
    return { cat, n: c?.n || 0, co2e: c?.co2e || 0, meta: CATEGORIAS[cat] };
  });
  const sinUsar = candidatas.filter((c) => c.n === 0);
  if (sinUsar.length) {
    return {
      cat: sinUsar[0].cat,
      meta: sinUsar[0].meta,
      motivo: `No has registrado ninguna accion de ${sinUsar[0].meta.etiqueta}. Es tu mayor margen de mejora.`,
    };
  }
  const ordenadas = [...candidatas].sort((a, b) => a.co2e - b.co2e);
  return {
    cat: ordenadas[0].cat,
    meta: ordenadas[0].meta,
    motivo: `${ordenadas[0].meta.etiqueta} es tu categoria con menor impacto acumulado (${redondear(ordenadas[0].co2e, 1)} kg CO2e).`,
  };
}
