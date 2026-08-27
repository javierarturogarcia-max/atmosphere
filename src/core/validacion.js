/**
 * validacion.js — Integridad de los registros (antifraude).
 *
 * Sin verificacion, cualquier sistema de puntos se degrada: la gente registra
 * "300 km en bici" y el ranking pierde todo significado. Aqui se aplican cuatro
 * capas, de la mas barata a la mas cara:
 *   1. Limites fisicos de plausibilidad por accion y dia
 *   2. Tiempos de espera entre registros identicos
 *   3. Deteccion estadistica de anomalias frente al historial propio (z robusta)
 *   4. Coherencia interna (energia declarada frente a tiempo del dia, etc.)
 */
import { accion } from '../data/acciones.js';
import { zRobusta } from './estadistica.js';
import { claveDia } from './rachas.js';

export const NIVELES = Object.freeze({ OK: 'ok', AVISO: 'aviso', BLOQUEO: 'bloqueo' });

/** Minutos totales de un dia: nadie puede registrar mas actividad que esto. */
const MINUTOS_DIA = 1440;

/**
 * Valida un registro antes de aceptarlo.
 * @param {{accionId:string, cantidad:number, fecha?:string|Date}} propuesta
 * @param {Array} registrosPrevios historial completo del usuario
 * @returns {{nivel:string, mensajes:string[], cantidadAjustada:number, sospecha:number}}
 */
export function validarRegistro(propuesta, registrosPrevios = []) {
  const a = accion(propuesta.accionId);
  const mensajes = [];
  if (!a) {
    return { nivel: NIVELES.BLOQUEO, mensajes: ['Accion desconocida.'], cantidadAjustada: 0, sospecha: 1 };
  }

  let cantidad = Number(propuesta.cantidad);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { nivel: NIVELES.BLOQUEO, mensajes: ['La cantidad debe ser un numero mayor que cero.'], cantidadAjustada: 0, sospecha: 0 };
  }

  const ahora = propuesta.fecha ? new Date(propuesta.fecha) : new Date();
  const hoy = claveDia(ahora);
  const delDia = registrosPrevios.filter((r) => claveDia(new Date(r.fecha)) === hoy);
  const mismaAccionHoy = delDia.filter((r) => r.accionId === a.id);

  // --- Capa 1: tope diario de plausibilidad ------------------------------
  const acumuladoHoy = mismaAccionHoy.reduce((s, r) => s + (r.cantidad || 0), 0);
  const margen = Math.max(0, a.maxDiario - acumuladoHoy);
  let nivel = NIVELES.OK;
  if (margen <= 0) {
    return {
      nivel: NIVELES.BLOQUEO,
      mensajes: [`Ya has alcanzado el maximo diario para "${a.titulo}" (${a.maxDiario} ${a.unidad}).`],
      cantidadAjustada: 0, sospecha: 0,
    };
  }
  if (cantidad > margen) {
    mensajes.push(`Ajustado a ${margen} ${a.unidad}: es el maximo verosimil que queda hoy para esta accion.`);
    cantidad = margen;
    nivel = NIVELES.AVISO;
  }

  // --- Capa 2: tiempo de espera ------------------------------------------
  const ultimo = [...mismaAccionHoy].sort((x, y) => new Date(y.fecha) - new Date(x.fecha))[0];
  if (ultimo && a.cooldownMin > 0) {
    const minutos = (ahora - new Date(ultimo.fecha)) / 60000;
    if (minutos < a.cooldownMin) {
      return {
        nivel: NIVELES.BLOQUEO,
        mensajes: [`Espera ${Math.ceil(a.cooldownMin - minutos)} min antes de volver a registrar "${a.titulo}".`],
        cantidadAjustada: 0, sospecha: 0.4,
      };
    }
  }

  // --- Capa 3: anomalia frente al historial propio ------------------------
  const historial = registrosPrevios
    .filter((r) => r.accionId === a.id)
    .map((r) => r.cantidad)
    .filter((n) => Number.isFinite(n));
  let sospecha = 0;
  if (historial.length >= 5) {
    const zr = Math.abs(zRobusta(cantidad, historial));
    if (zr > 3.5) {
      sospecha = Math.min(1, zr / 10);
      mensajes.push(`Este valor es muy atipico frente a tu historial (z robusta = ${zr.toFixed(1)}). Se marcara para revision.`);
      nivel = NIVELES.AVISO;
    }
  }

  // --- Capa 4: coherencia temporal del dia --------------------------------
  const minutosDeclarados = estimarMinutos(delDia) + estimarMinutosAccion(a, cantidad);
  if (minutosDeclarados > MINUTOS_DIA) {
    return {
      nivel: NIVELES.BLOQUEO,
      mensajes: ['Los registros de hoy superan las 24 horas de actividad. Revisa las cantidades.'],
      cantidadAjustada: 0, sospecha: 0.9,
    };
  }
  if (minutosDeclarados > MINUTOS_DIA * 0.6) {
    mensajes.push('Llevas mas de 14 h de actividad declarada hoy: comprueba que sea correcto.');
    nivel = nivel === NIVELES.OK ? NIVELES.AVISO : nivel;
  }

  // --- Requisito de evidencia --------------------------------------------
  if (a.evidencia !== 'ninguna' && cantidad >= a.maxDiario * 0.5) {
    mensajes.push(`Registro grande: adjunta ${a.evidencia === 'gps' ? 'la traza GPS' : a.evidencia} para que cuente en el ranking verificado.`);
  }

  return { nivel, mensajes, cantidadAjustada: cantidad, sospecha };
}

/** Traduce una accion a minutos aproximados de dedicacion (para la capa 4). */
function estimarMinutosAccion(a, cantidad) {
  switch (a.unidad) {
    case 'min': return cantidad;
    case 'h':   return cantidad * 60;
    case 'km':  return a.id === 'mov_caminar' ? cantidad * 12 : a.id === 'mov_bici' ? cantidad * 4 : cantidad * 1.2;
    case 'dia': return 0;   // acciones pasivas
    case 'mes': return 0;
    default:    return 5;   // registro puntual
  }
}

function estimarMinutos(registrosDelDia) {
  return registrosDelDia.reduce((s, r) => {
    const a = accion(r.accionId);
    return a ? s + estimarMinutosAccion(a, r.cantidad || 0) : s;
  }, 0);
}

/**
 * Indice de confianza del perfil (0..1): que credito merece el historial.
 * Combina proporcion de registros con evidencia, dispersion y diversidad.
 */
export function indiceConfianza(registros) {
  if (!registros.length) return { valor: 0.5, etiqueta: 'Sin historial', detalle: {} };
  const conEvidencia = registros.filter((r) => r.evidencia).length / registros.length;
  const sospechosos = registros.filter((r) => (r.sospecha || 0) > 0.3).length / registros.length;
  const categorias = new Set(registros.map((r) => accion(r.accionId)?.cat).filter(Boolean)).size;
  const diversidad = Math.min(1, categorias / 5);
  const dias = new Set(registros.map((r) => claveDia(new Date(r.fecha)))).size;
  const constancia = Math.min(1, dias / 30);

  const valor = Math.max(0, Math.min(1,
    0.35 * conEvidencia + 0.30 * (1 - sospechosos) + 0.20 * diversidad + 0.15 * constancia));

  const etiqueta = valor >= 0.8 ? 'Muy alta' : valor >= 0.6 ? 'Alta' : valor >= 0.4 ? 'Media' : 'Baja';
  return { valor, etiqueta, detalle: { conEvidencia, sospechosos, diversidad, constancia } };
}
