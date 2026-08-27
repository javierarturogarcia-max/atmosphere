/**
 * misiones.js — Generador determinista de misiones diarias, semanales y de temporada.
 *
 * Sin backend, la "novedad diaria" se consigue derivando las misiones de una
 * semilla = perfil + periodo. Todo el mundo con el mismo perfil y dia obtiene el
 * mismo reto, y el sistema es auditable y testeable.
 */
import { ACCIONES, CATEGORIAS, accion } from '../data/acciones.js';
import { generador, muestra, elegirPonderado, enteroEntre } from './rng.js';
import { claveDia, sumarDias, diasEntre } from './rachas.js';

/** Clave ISO de semana (YYYY-Www) para anclar misiones semanales. */
export function claveSemana(fecha = new Date()) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // jueves de esa semana ISO
  const anio = d.getFullYear();
  const primerJueves = new Date(anio, 0, 4);
  primerJueves.setDate(primerJueves.getDate() + 3 - ((primerJueves.getDay() + 6) % 7));
  const semana = 1 + Math.round((d - primerJueves) / (7 * 86400000));
  return `${anio}-W${String(semana).padStart(2, '0')}`;
}

/** Clave de mes YYYY-MM. */
export function claveMes(fecha = new Date()) {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const PLANTILLAS_DIARIAS = [
  { tipo: 'accion',    plural: (a, q) => `Registra ${q} ${a.unidad} de "${a.titulo}"`, mult: 1.0 },
  { tipo: 'categoria', plural: (c, q) => `Suma ${q} acciones de ${c.etiqueta}`,        mult: 1.1 },
  { tipo: 'co2e',      plural: (_, q) => `Evita ${q} kg de CO2e hoy`,                  mult: 1.2 },
  { tipo: 'puntos',    plural: (_, q) => `Consigue ${q} puntos hoy`,                   mult: 1.0 },
];

/** Cantidad objetivo razonable para una accion segun su tope diario. */
function objetivoAccion(a, rnd) {
  const techo = Math.max(1, Math.floor(a.maxDiario * 0.5));
  if (techo <= 3) return enteroEntre(rnd, 1, Math.max(1, techo));
  const q = enteroEntre(rnd, Math.max(1, Math.floor(techo * 0.2)), techo);
  return q >= 10 ? Math.round(q / 5) * 5 : q;
}

/**
 * Genera las misiones diarias (3) para un perfil y una fecha.
 * @param {string} perfilId
 * @param {string} dia clave YYYY-MM-DD
 * @param {{nivel?:number, categoriasFavoritas?:string[]}} contexto
 */
export function misionesDiarias(perfilId, dia = claveDia(), contexto = {}) {
  const rnd = generador(`${perfilId}|dia|${dia}`);
  const nivel = Math.max(1, contexto.nivel || 1);
  const escala = 1 + Math.min(1.5, (nivel - 1) * 0.05); // el reto crece con el nivel
  const catalogo = ACCIONES.filter((a) => a.rareza !== 'epico');
  const elegidas = muestra(rnd, catalogo, 3);
  const misiones = [];
  const firmas = new Set();

  for (let i = 0; i < 3; i++) {
    const plantilla = elegirPonderado(rnd, PLANTILLAS_DIARIAS, [4, 3, 2, 2]);
    const a = elegidas[i] || elegidas[0];
    let objetivo;
    let texto;

    if (plantilla.tipo === 'accion') {
      const q = Math.max(1, Math.round(objetivoAccion(a, rnd) * escala));
      objetivo = { tipo: 'accion', ref: a.id, cantidad: q, unidad: a.unidad };
      texto = plantilla.plural(a, q);
    } else if (plantilla.tipo === 'categoria') {
      const cat = a.cat;
      const q = Math.max(1, Math.round(enteroEntre(rnd, 2, 4) * escala));
      objetivo = { tipo: 'categoria', ref: cat, cantidad: q, unidad: 'acciones' };
      texto = plantilla.plural(CATEGORIAS[cat], q);
    } else if (plantilla.tipo === 'co2e') {
      const q = Math.max(1, Math.round(enteroEntre(rnd, 2, 8) * escala));
      objetivo = { tipo: 'co2e', ref: null, cantidad: q, unidad: 'kg CO2e' };
      texto = plantilla.plural(null, q);
    } else {
      const q = Math.round(enteroEntre(rnd, 60, 150) * escala / 10) * 10;
      objetivo = { tipo: 'puntos', ref: null, cantidad: q, unidad: 'pts' };
      texto = plantilla.plural(null, q);
    }

    // Evita que dos misiones del mismo dia pidan exactamente lo mismo:
    // dos retos identicos con distinta cifra son mal diseno de juego.
    const firma = `${objetivo.tipo}:${objetivo.ref ?? ''}`;
    if (firmas.has(firma)) {
      const alternativa = catalogo.find((c) => !firmas.has(`accion:${c.id}`) && c.id !== a.id);
      if (alternativa) {
        const q = Math.max(1, Math.round(objetivoAccion(alternativa, rnd) * escala));
        objetivo = { tipo: 'accion', ref: alternativa.id, cantidad: q, unidad: alternativa.unidad };
        texto = `Registra ${q} ${alternativa.unidad} de "${alternativa.titulo}"`;
      }
    }
    firmas.add(`${objetivo.tipo}:${objetivo.ref ?? ''}`);

    misiones.push({
      id: `d|${dia}|${i}`,
      tipo: 'diaria',
      titulo: texto,
      icono: plantilla.tipo === 'accion' ? a.icono : plantilla.tipo === 'categoria' ? CATEGORIAS[a.cat].icono : '🎯',
      objetivo,
      recompensa: { puntos: Math.round(35 * plantilla.mult * escala), xp: Math.round(25 * escala) },
      desde: `${dia}T00:00:00`,
      hasta: `${dia}T23:59:59`,
    });
  }
  return misiones;
}

const RETOS_SEMANALES = [
  { id: 'sin_coche',    titulo: 'Semana de movilidad limpia', icono: '🚲', objetivo: { tipo: 'categoria', ref: 'movilidad', cantidad: 8 }, recompensa: { puntos: 220, xp: 160 } },
  { id: 'residuo_cero', titulo: 'Objetivo residuo minimo',    icono: '♻️', objetivo: { tipo: 'residuo', ref: null, cantidad: 6 },        recompensa: { puntos: 200, xp: 150 } },
  { id: 'agua_1000',    titulo: 'Mil litros en siete dias',   icono: '💧', objetivo: { tipo: 'agua', ref: null, cantidad: 1000 },        recompensa: { puntos: 210, xp: 150 } },
  { id: 'dieta_baja',   titulo: 'Semana baja en carbono',     icono: '🥗', objetivo: { tipo: 'categoria', ref: 'alimentacion', cantidad: 10 }, recompensa: { puntos: 230, xp: 165 } },
  { id: 'co2_30',       titulo: '30 kg CO2e en la semana',    icono: '🌬️', objetivo: { tipo: 'co2e', ref: null, cantidad: 30 },          recompensa: { puntos: 250, xp: 180 } },
  { id: 'diversidad',   titulo: 'Toca cinco categorias',      icono: '🧭', objetivo: { tipo: 'diversidad', ref: null, cantidad: 5 },     recompensa: { puntos: 240, xp: 175 } },
  { id: 'energia',      titulo: 'Auditoria energetica',       icono: '⚡', objetivo: { tipo: 'categoria', ref: 'energia', cantidad: 7 }, recompensa: { puntos: 215, xp: 155 } },
  { id: 'comunidad',    titulo: 'Efecto contagio',            icono: '🤝', objetivo: { tipo: 'categoria', ref: 'comunidad', cantidad: 4 }, recompensa: { puntos: 260, xp: 190 } },
];

/** Dos retos semanales deterministas por perfil y semana ISO. */
export function misionesSemanales(perfilId, fecha = new Date(), contexto = {}) {
  const semana = claveSemana(fecha);
  const rnd = generador(`${perfilId}|sem|${semana}`);
  const escala = 1 + Math.min(1.2, ((contexto.nivel || 1) - 1) * 0.04);
  const base = new Date(fecha);
  const lunes = new Date(base);
  lunes.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  const desde = claveDia(lunes);
  const hasta = sumarDias(desde, 6);

  return muestra(rnd, RETOS_SEMANALES, 2).map((r, i) => ({
    id: `s|${semana}|${r.id}`,
    tipo: 'semanal',
    titulo: r.titulo,
    icono: r.icono,
    objetivo: { ...r.objetivo, cantidad: Math.max(1, Math.round(r.objetivo.cantidad * escala)) },
    recompensa: { puntos: Math.round(r.recompensa.puntos * escala), xp: Math.round(r.recompensa.xp * escala) },
    desde: `${desde}T00:00:00`,
    hasta: `${hasta}T23:59:59`,
  }));
}

const RETOS_TEMPORADA = [
  { id: 'reforesta',  titulo: 'Reforestacion del mes',   icono: '🌳', objetivo: { tipo: 'accion', ref: 'bio_plantar_arbol', cantidad: 5 },  recompensa: { puntos: 900, xp: 600 } },
  { id: 'tonelada',   titulo: 'Cuarto de tonelada',      icono: '🏋️', objetivo: { tipo: 'co2e', ref: null, cantidad: 250 },                recompensa: { puntos: 1100, xp: 750 } },
  { id: 'maestria',   titulo: 'Maestria del catalogo',   icono: '📚', objetivo: { tipo: 'accionesDistintas', ref: null, cantidad: 15 },     recompensa: { puntos: 850, xp: 580 } },
  { id: 'constancia', titulo: 'Mes completo',            icono: '🔥', objetivo: { tipo: 'diasActivos', ref: null, cantidad: 25 },           recompensa: { puntos: 1000, xp: 700 } },
];

/** Un reto de temporada por mes. */
export function misionTemporada(perfilId, fecha = new Date()) {
  const mes = claveMes(fecha);
  const rnd = generador(`${perfilId}|mes|${mes}`);
  const r = muestra(rnd, RETOS_TEMPORADA, 1)[0];
  const d = new Date(fecha);
  const primero = claveDia(new Date(d.getFullYear(), d.getMonth(), 1));
  const ultimo = claveDia(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return {
    id: `m|${mes}|${r.id}`,
    tipo: 'temporada',
    titulo: r.titulo,
    icono: r.icono,
    objetivo: r.objetivo,
    recompensa: r.recompensa,
    desde: `${primero}T00:00:00`,
    hasta: `${ultimo}T23:59:59`,
  };
}

/** Conjunto completo de misiones vigentes. */
export function misionesVigentes(perfilId, fecha = new Date(), contexto = {}) {
  return [
    ...misionesDiarias(perfilId, claveDia(fecha), contexto),
    ...misionesSemanales(perfilId, fecha, contexto),
    misionTemporada(perfilId, fecha),
  ];
}

/**
 * Evalua el progreso de una mision con los registros dentro de su ventana.
 * @returns {{progreso:number, actual:number, objetivo:number, completada:boolean}}
 */
export function evaluarMision(mision, registros) {
  const desde = new Date(mision.desde).getTime();
  const hasta = new Date(mision.hasta).getTime();
  const dentro = registros.filter((r) => {
    const t = new Date(r.fecha).getTime();
    return t >= desde && t <= hasta;
  });

  const o = mision.objetivo;
  let actual = 0;

  switch (o.tipo) {
    case 'accion':
      actual = dentro.filter((r) => r.accionId === o.ref).reduce((s, r) => s + (r.cantidad || 0), 0);
      break;
    case 'categoria':
      actual = dentro.filter((r) => accion(r.accionId)?.cat === o.ref).length;
      break;
    case 'co2e':
      actual = dentro.reduce((s, r) => s + (r.impacto?.co2e || 0), 0);
      break;
    case 'agua':
      actual = dentro.reduce((s, r) => s + (r.impacto?.agua || 0), 0);
      break;
    case 'residuo':
      actual = dentro.reduce((s, r) => s + (r.impacto?.residuo || 0), 0);
      break;
    case 'puntos':
      actual = dentro.reduce((s, r) => s + (r.puntos || 0), 0);
      break;
    case 'diversidad':
      actual = new Set(dentro.map((r) => accion(r.accionId)?.cat).filter(Boolean)).size;
      break;
    case 'accionesDistintas':
      actual = new Set(dentro.map((r) => r.accionId)).size;
      break;
    case 'diasActivos':
      actual = new Set(dentro.map((r) => claveDia(new Date(r.fecha)))).size;
      break;
    default:
      actual = 0;
  }

  const objetivo = o.cantidad || 1;
  return {
    actual: Math.round(actual * 100) / 100,
    objetivo,
    progreso: Math.min(1, actual / objetivo),
    completada: actual >= objetivo,
  };
}

/** Dias que le quedan de vida a una mision. */
export function diasRestantes(mision, hoy = claveDia()) {
  return Math.max(0, diasEntre(hoy, mision.hasta.slice(0, 10)));
}
