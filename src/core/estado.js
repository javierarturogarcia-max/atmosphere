/**
 * estado.js — Almacen de estado, persistencia y transacciones de juego.
 *
 * Todo el estado vive en memoria en un unico objeto y se serializa a
 * localStorage con numero de version y migraciones. Los datos NUNCA salen del
 * dispositivo: privacidad por diseno (no hay backend ni telemetria).
 */
import { accion, CATEGORIAS } from '../data/acciones.js';
import { recompensa, puedeCanjear } from '../data/recompensas.js';
import { calcularImpacto } from './impacto.js';
import { calcularPuntos, bonusDiversidad, factorAire, VIGENCIA_AIRE_MS } from './puntos.js';
import { validarRegistro, NIVELES } from './validacion.js';
import { claveDia, calcularRacha, congelacionesGanadas } from './rachas.js';
import { detectarAscenso, nivelDesdeXP } from './nivel.js';
import { construirResumen } from './analitica.js';
import { evaluarLogros } from './logros.js';
import { misionesVigentes, evaluarMision, misionesPorAire } from './misiones.js';

export const VERSION_ESTADO = 1;
const CLAVE = 'atmosphere.estado.v1';


/**
 * Devuelve la ultima lectura de aire solo si sigue siendo representativa.
 * Una lectura de anteanoche no puede seguir dando multiplicador: la
 * contaminacion cambia de hora en hora.
 */
export function lecturaAireVigente(estado, fecha = new Date()) {
  const l = estado?.aire?.ultimaLectura;
  if (!l || !Number.isFinite(l.aqi) || !l.fecha) return null;
  const edad = new Date(fecha).getTime() - new Date(l.fecha).getTime();
  if (!Number.isFinite(edad) || edad < 0 || edad > VIGENCIA_AIRE_MS) return null;
  return l;
}

export function estadoInicial(nombre = 'Guardian', paisCod = 'WW') {
  return {
    version: VERSION_ESTADO,
    perfil: {
      id: `p_${Math.random().toString(36).slice(2, 10)}`,
      nombre,
      pais: paisCod,
      puntos: 0,
      puntosHistoricos: 0,
      xp: 0,
      congelaciones: 0,
      titulo: '',
      tema: 'bosque',
      multiplicadorHasta: null,
      creado: new Date().toISOString(),
    },
    registros: [],
    logros: [],
    misionesCompletadas: [],
    canjes: [],
    huella: null,
    huellaEntradas: null,
    aire: { ultimaLectura: null, historial: [] },
    ajustes: { modoOscuro: true, unidadesMetricas: true },
  };
}

/** Migraciones sucesivas del esquema persistido. */
const MIGRACIONES = {
  // 0 -> 1: estructura inicial. Se deja documentado el mecanismo para el futuro.
  1: (e) => e,
};

export function migrar(bruto) {
  let e = bruto;
  let v = e.version || 0;
  while (v < VERSION_ESTADO) {
    v += 1;
    if (MIGRACIONES[v]) e = MIGRACIONES[v](e);
    e.version = v;
  }
  return e;
}

const almacen = (() => {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* entorno sin almacenamiento */ }
  const memoria = new Map();
  return {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, v),
    removeItem: (k) => memoria.delete(k),
  };
})();

export function cargar() {
  try {
    const crudo = almacen.getItem(CLAVE);
    if (!crudo) return null;
    return migrar(JSON.parse(crudo));
  } catch {
    return null;
  }
}

export function guardar(estado) {
  try {
    almacen.setItem(CLAVE, JSON.stringify(estado));
    return true;
  } catch {
    return false;
  }
}

/** Crea el almacen reactivo. */
export function crearAlmacen(inicial = null) {
  let estado = inicial || cargar() || estadoInicial();
  const oyentes = new Set();

  const notificar = (evento = {}) => {
    guardar(estado);
    for (const fn of oyentes) fn(estado, evento);
  };

  const api = {
    get: () => estado,
    suscribir(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },

    reemplazar(nuevo) {
      estado = migrar(nuevo);
      notificar({ tipo: 'reemplazo' });
    },

    actualizarPerfil(campos) {
      estado.perfil = { ...estado.perfil, ...campos };
      notificar({ tipo: 'perfil' });
    },

    /** Transaccion principal: registrar una accion ecologica. */
    registrar(accionId, cantidad, opciones = {}) {
      const a = accion(accionId);
      if (!a) return { ok: false, mensajes: ['Accion desconocida'] };

      const fecha = opciones.fecha ? new Date(opciones.fecha) : new Date();
      const val = validarRegistro({ accionId, cantidad, fecha }, estado.registros);
      if (val.nivel === NIVELES.BLOQUEO) {
        return { ok: false, mensajes: val.mensajes, nivel: val.nivel };
      }
      const q = val.cantidadAjustada;

      const impacto = calcularImpacto(accionId, q, { pais: estado.perfil.pais });

      // Contexto de puntuacion del dia en curso.
      const hoy = claveDia(fecha);
      const delDia = estado.registros.filter((r) => claveDia(new Date(r.fecha)) === hoy);
      const acumuladoDia = delDia.reduce((s, r) => s + (r.puntos || 0), 0);
      const acumuladoCat = delDia
        .filter((r) => accion(r.accionId)?.cat === a.cat)
        .reduce((s, r) => s + (r.puntos || 0), 0);

      const dias = [...new Set(estado.registros.map((r) => claveDia(new Date(r.fecha))))];
      const racha = calcularRacha(dias, hoy, estado.perfil.congelaciones);

      // Misiones vigentes que esta accion puede empujar.
      const lecturaAire = lecturaAireVigente(estado, fecha);
      const misiones = [
        ...misionesVigentes(estado.perfil.id, fecha, { nivel: nivelDesdeXP(estado.perfil.xp) }),
        ...(lecturaAire ? misionesPorAire(lecturaAire.aqi, lecturaAire.lugar, hoy) : []),
      ];
      const contribuye = misiones.some((m) => {
        const o = m.objetivo;
        return (o.tipo === 'accion' && o.ref === accionId)
          || (o.tipo === 'categoria' && o.ref === a.cat)
          || ['co2e', 'agua', 'residuo', 'puntos', 'diversidad', 'accionesDistintas', 'diasActivos'].includes(o.tipo);
      });

      const multActivo = estado.perfil.multiplicadorHasta && new Date(estado.perfil.multiplicadorHasta) > fecha ? 1.5 : 1;
      const catsHoy = new Set(delDia.map((r) => accion(r.accionId)?.cat).filter(Boolean));
      catsHoy.add(a.cat);
      const bonus = bonusDiversidad(catsHoy.size);
      const aire = factorAire(lecturaAire?.aqi, a.cat);

      const { puntos, desglose } = calcularPuntos({
        accionId,
        impacto,
        racha: racha.actual,
        acumuladoCategoriaHoy: acumuladoCat,
        acumuladoDiaHoy: acumuladoDia,
        contribuyeMision: contribuye,
        factorEvento: multActivo * bonus.factor * aire.factor,
      });

      const registro = {
        id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        accionId,
        cantidad: q,
        unidad: a.unidad,
        fecha: fecha.toISOString(),
        impacto: { co2e: impacto.co2e, agua: impacto.agua, residuo: impacto.residuo, kwh: impacto.kwh },
        puntos,
        desglose,
        evidencia: opciones.evidencia || null,
        nota: opciones.nota || '',
        sospecha: val.sospecha,
      };

      const xpAntes = estado.perfil.xp;
      estado.registros.push(registro);
      estado.perfil.puntos += puntos;
      estado.perfil.puntosHistoricos += puntos;
      estado.perfil.xp += Math.round(puntos * 0.7);

      // Misiones completadas por este registro.
      const completadas = [];
      const yaCompletadas = new Set(estado.misionesCompletadas.map((m) => m.id));
      for (const m of misiones) {
        if (yaCompletadas.has(m.id)) continue;
        const ev = evaluarMision(m, estado.registros);
        if (ev.completada) {
          estado.misionesCompletadas.push({ id: m.id, titulo: m.titulo, tipo: m.tipo, fecha: fecha.toISOString(), recompensa: m.recompensa });
          estado.perfil.puntos += m.recompensa.puntos;
          estado.perfil.puntosHistoricos += m.recompensa.puntos;
          estado.perfil.xp += m.recompensa.xp;
          completadas.push(m);
        }
      }

      // Logros.
      const resumen = construirResumen(estado);
      const ev = evaluarLogros(resumen, estado.logros);
      if (ev.nuevos.length) {
        estado.logros = [...new Set([...estado.logros, ...ev.nuevos.map((l) => l.id)])];
        estado.perfil.xp += ev.xpGanada;
      }

      // Congelaciones ganadas por racha.
      const nuevaRacha = calcularRacha(
        [...new Set(estado.registros.map((r) => claveDia(new Date(r.fecha))))], hoy, estado.perfil.congelaciones);
      const ganadas = congelacionesGanadas(nuevaRacha.actual, estado.perfil.congelaciones);
      if (ganadas > 0) estado.perfil.congelaciones += ganadas;

      const ascenso = detectarAscenso(xpAntes, estado.perfil.xp);
      notificar({ tipo: 'registro', registro });

      return {
        ok: true,
        registro,
        puntos,
        desglose,
        mensajes: val.mensajes,
        nivel: val.nivel,
        ascenso,
        logrosNuevos: ev.nuevos,
        misionesCompletadas: completadas,
        congelacionesGanadas: ganadas,
        bonusDiversidad: bonus,
        bonusAire: aire,
        racha: nuevaRacha,
      };
    },

    /** Elimina un registro y revierte sus puntos (no la XP de logros ya obtenidos). */
    eliminarRegistro(id) {
      const i = estado.registros.findIndex((r) => r.id === id);
      if (i < 0) return { ok: false };
      const [r] = estado.registros.splice(i, 1);
      estado.perfil.puntos = Math.max(0, estado.perfil.puntos - (r.puntos || 0));
      estado.perfil.xp = Math.max(0, estado.perfil.xp - Math.round((r.puntos || 0) * 0.7));
      notificar({ tipo: 'eliminacion', registro: r });
      return { ok: true, registro: r };
    },

    /** Canje de una recompensa de la tienda. */
    canjear(recompensaId) {
      const rec = recompensa(recompensaId);
      const nivel = nivelDesdeXP(estado.perfil.xp);
      const permiso = puedeCanjear(rec, { puntos: estado.perfil.puntos, nivel, canjesPrevios: estado.canjes });
      if (!permiso.ok) return { ok: false, motivo: permiso.motivo };

      estado.perfil.puntos -= rec.coste;
      const canje = { id: `c_${Date.now().toString(36)}`, recompensaId, fecha: new Date().toISOString(), coste: rec.coste };
      estado.canjes.push(canje);

      // Efectos inmediatos.
      const ef = rec.efecto;
      if (ef?.tipo === 'congelacion') estado.perfil.congelaciones = Math.min(3, estado.perfil.congelaciones + ef.valor);
      if (ef?.tipo === 'multiplicador') {
        const hasta = new Date(Date.now() + (ef.horas || 24) * 3600000);
        estado.perfil.multiplicadorHasta = hasta.toISOString();
      }
      if (ef?.tipo === 'titulo') estado.perfil.titulo = ef.valor;
      if (ef?.tipo === 'tema') estado.perfil.tema = ef.valor;

      notificar({ tipo: 'canje', canje });
      return { ok: true, canje, recompensa: rec };
    },

    guardarHuella(entradas, resultado) {
      estado.huellaEntradas = entradas;
      estado.huella = resultado;
      const resumen = construirResumen(estado);
      const ev = evaluarLogros(resumen, estado.logros);
      if (ev.nuevos.length) {
        estado.logros = [...new Set([...estado.logros, ...ev.nuevos.map((l) => l.id)])];
        estado.perfil.xp += ev.xpGanada;
      }
      notificar({ tipo: 'huella' });
      return ev.nuevos;
    },

    guardarLecturaAire(lectura) {
      // La marca de tiempo es imprescindible: el bonus por aire solo cuenta
      // mientras la lectura siga siendo reciente (ver VIGENCIA_AIRE_MS).
      const conFecha = { ...lectura, fecha: lectura.fecha || new Date().toISOString() };
      estado.aire.ultimaLectura = conFecha;
      estado.aire.historial = [...(estado.aire.historial || []), conFecha].slice(-120);
      notificar({ tipo: 'aire' });
    },

    exportar() {
      return JSON.stringify({ ...estado, exportado: new Date().toISOString() }, null, 2);
    },

    importar(json) {
      try {
        const datos = typeof json === 'string' ? JSON.parse(json) : json;
        if (!datos || !datos.perfil || !Array.isArray(datos.registros)) {
          return { ok: false, motivo: 'El archivo no tiene el formato esperado.' };
        }
        estado = migrar(datos);
        notificar({ tipo: 'importacion' });
        return { ok: true };
      } catch (e) {
        return { ok: false, motivo: 'JSON no valido.' };
      }
    },

    reiniciar(nombre, paisCod) {
      estado = estadoInicial(nombre || estado.perfil.nombre, paisCod || estado.perfil.pais);
      notificar({ tipo: 'reinicio' });
    },

    /** Datos derivados listos para la interfaz. */
    resumen() { return construirResumen(estado); },
    categorias() { return CATEGORIAS; },
  };

  return api;
}
