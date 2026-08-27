/**
 * recompensas.js — Catalogo de canjes.
 *
 * DISENO ETICO: las recompensas no deben incentivar consumo nuevo (seria
 * contraproducente). Se agrupan en cuatro familias:
 *   impacto  — el canje financia una accion ambiental real y verificable
 *   utilidad — mejora la propia herramienta (congelaciones, informes)
 *   estatus  — cosmeticos y titulos, coste cero en recursos
 *   alianza  — descuentos con entidades que reducen impacto (transporte, reparacion)
 */

export const FAMILIAS = Object.freeze({
  impacto:  { etiqueta: 'Impacto real', icono: '🌍', color: '#34d399' },
  utilidad: { etiqueta: 'Utilidad',     icono: '🧰', color: '#38bdf8' },
  estatus:  { etiqueta: 'Estatus',      icono: '✨', color: '#c084fc' },
  alianza:  { etiqueta: 'Alianzas',     icono: '🤝', color: '#fbbf24' },
});

export const RECOMPENSAS = Object.freeze([
  // ---------------------------------------------------------------- impacto real
  { id: 'arbol_real', familia: 'impacto', titulo: 'Plantar 1 arbol real', icono: '🌳',
    coste: 1200, stock: null, nivelMin: 5,
    desc: 'Se financia la plantacion y el mantenimiento de 3 anios de un arbol autoctono con una entidad certificada.',
    nota: 'Requiere convenio con vivero u ONG. Equivale a ~725 kg CO2 en 40 anios.' },

  { id: 'm2_arrecife', familia: 'impacto', titulo: 'Restaurar 1 m2 de pradera marina', icono: '🌊',
    coste: 1500, stock: null, nivelMin: 8,
    desc: 'Sumidero azul: la Posidonia fija hasta 15 veces mas carbono por hectarea que un bosque tropical.',
    nota: 'Proyectos de restauracion en Mediterraneo y Caribe.' },

  { id: 'kit_residuo', familia: 'impacto', titulo: 'Kit de limpieza para 1 jornada', icono: '🧤',
    coste: 800, stock: 50, nivelMin: 3,
    desc: 'Financia guantes, pinzas y sacos para una jornada de limpieza comunitaria.',
    nota: 'Se entrega al grupo local que organice la jornada.' },

  { id: 'donacion_10', familia: 'impacto', titulo: 'Donacion equivalente a 10 kg CO2', icono: '💚',
    coste: 400, stock: null, nivelMin: 2,
    desc: 'Aportacion a proyectos de captura verificada (Gold Standard o Verra).',
    nota: 'La compensacion no sustituye a la reduccion: es el ultimo recurso, no el primero.' },

  // -------------------------------------------------------------------- utilidad
  { id: 'congelacion', familia: 'utilidad', titulo: 'Congelacion de racha', icono: '🧊',
    coste: 250, stock: 3, nivelMin: 1, efecto: { tipo: 'congelacion', valor: 1 },
    desc: 'Protege tu racha un dia. Maximo 3 acumuladas.',
    nota: 'La constancia importa mas que la perfeccion.' },

  { id: 'multiplicador', familia: 'utilidad', titulo: 'Multiplicador x1,5 (24 h)', icono: '⚡',
    coste: 600, stock: null, nivelMin: 4, efecto: { tipo: 'multiplicador', valor: 1.5, horas: 24 },
    desc: 'Multiplica por 1,5 los puntos obtenidos durante 24 horas.',
    nota: 'No afecta al impacto fisico calculado: solo a la capa de juego.' },

  { id: 'informe_pdf', familia: 'utilidad', titulo: 'Informe cientifico personal', icono: '📄',
    coste: 500, stock: null, nivelMin: 3, efecto: { tipo: 'informe' },
    desc: 'Genera un informe con tu serie temporal, tendencia Mann-Kendall e intervalos de confianza.',
    nota: 'Exportable e imprimible. Util para memorias escolares o corporativas.' },

  { id: 'analitica_pro', familia: 'utilidad', titulo: 'Analitica avanzada permanente', icono: '📊',
    coste: 2000, stock: 1, nivelMin: 10, efecto: { tipo: 'desbloqueo', valor: 'analitica_pro' },
    desc: 'Desbloquea descomposicion por categoria, proyecciones y comparativa de cohortes.',
    nota: 'Pago unico.' },

  // --------------------------------------------------------------------- estatus
  { id: 'titulo_guardian', familia: 'estatus', titulo: 'Titulo: Guardian del Aire', icono: '🛡️',
    coste: 700, stock: null, nivelMin: 6, efecto: { tipo: 'titulo', valor: 'Guardian del Aire' },
    desc: 'Titulo visible junto a tu nombre en el ranking.' },

  { id: 'tema_bosque', familia: 'estatus', titulo: 'Tema visual: Bosque humedo', icono: '🌿',
    coste: 450, stock: null, nivelMin: 3, efecto: { tipo: 'tema', valor: 'bosque' },
    desc: 'Paleta de color alternativa para toda la interfaz.' },

  { id: 'tema_oceano', familia: 'estatus', titulo: 'Tema visual: Oceano profundo', icono: '🐋',
    coste: 450, stock: null, nivelMin: 3, efecto: { tipo: 'tema', valor: 'oceano' },
    desc: 'Paleta de color alternativa para toda la interfaz.' },

  { id: 'marco_platino', familia: 'estatus', titulo: 'Marco de perfil platino', icono: '💠',
    coste: 1800, stock: null, nivelMin: 15, efecto: { tipo: 'marco', valor: 'platino' },
    desc: 'Distintivo visual reservado a perfiles de alto impacto sostenido.' },

  // --------------------------------------------------------------------- alianzas
  { id: 'bono_transporte', familia: 'alianza', titulo: 'Bono de transporte publico', icono: '🚇',
    coste: 1600, stock: 20, nivelMin: 5,
    desc: 'Diez viajes en la red de transporte municipal asociada.',
    nota: 'Requiere convenio con el operador local.' },

  { id: 'taller_reparacion', familia: 'alianza', titulo: 'Taller de reparacion', icono: '🛠️',
    coste: 1000, stock: 15, nivelMin: 4,
    desc: 'Plaza en un taller de reparacion de electrodomesticos o textil.',
    nota: 'Repair cafes y entidades de economia circular.' },

  { id: 'cesta_local', familia: 'alianza', titulo: 'Cesta de producto local', icono: '🧺',
    coste: 1400, stock: 10, nivelMin: 6,
    desc: 'Cesta de temporada de productores agroecologicos de proximidad.',
    nota: 'Sustituye consumo existente: no genera demanda adicional.' },

  { id: 'entrada_museo', familia: 'alianza', titulo: 'Entrada a museo de ciencias', icono: '🔬',
    coste: 900, stock: 25, nivelMin: 3,
    desc: 'Acceso a exposicion de clima y biodiversidad.',
    nota: 'Educacion ambiental como recompensa: refuerza el bucle.' },
]);

const INDICE = new Map(RECOMPENSAS.map((r) => [r.id, r]));
export function recompensa(id) { return INDICE.get(id) || null; }

export function recompensasPorFamilia() {
  return Object.entries(FAMILIAS).map(([id, meta]) => ({
    id, ...meta, items: RECOMPENSAS.filter((r) => r.familia === id),
  }));
}

/** Comprueba si un perfil puede canjear: puntos, nivel y stock. */
export function puedeCanjear(rec, { puntos = 0, nivel = 1, canjesPrevios = [] } = {}) {
  if (!rec) return { ok: false, motivo: 'Recompensa inexistente' };
  if (nivel < rec.nivelMin) return { ok: false, motivo: `Necesitas nivel ${rec.nivelMin}` };
  if (puntos < rec.coste) return { ok: false, motivo: `Te faltan ${rec.coste - puntos} puntos` };
  if (rec.stock !== null && rec.stock !== undefined) {
    const usados = canjesPrevios.filter((c) => c.recompensaId === rec.id).length;
    if (usados >= rec.stock) return { ok: false, motivo: 'Sin unidades disponibles' };
  }
  return { ok: true, motivo: '' };
}
