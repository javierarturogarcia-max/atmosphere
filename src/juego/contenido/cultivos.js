/**
 * cultivos.js — Lo que se siembra en la milpa.
 *
 * Los dias son dias de juego. Cada cultivo pide agua distinta y aguanta de
 * distinta manera la seca: el arroz se muere sin agua y el frijol perdona.
 * Anadir un cultivo nuevo es anadir una entrada aqui y una malla en modelos.js.
 */
export const CULTIVOS = {
  maiz: {
    nombre: 'Maíz', icono: '🌽', semilla: 'semilla_maiz', grano: 'maiz',
    dias: 14, aguaDia: 0.55, resistencia: 0.5, rendimiento: [3, 7], semillasExtra: [1, 2],
    estaciones: ['lluvias', 'seca'], malla: 'maiz',
    descripcion: 'Se siembra con la primera lluvia de mayo. De la milpa sale todo.',
  },
  frijol: {
    nombre: 'Frijol', icono: '🫘', semilla: 'semilla_frijol', grano: 'frijol',
    dias: 11, aguaDia: 0.4, resistencia: 0.75, rendimiento: [2, 5], semillasExtra: [1, 2],
    estaciones: ['lluvias', 'seca'], malla: 'frijol',
    descripcion: 'Aguanta la seca mejor que nadie y le deja fuerza a la tierra.',
  },
  arroz: {
    nombre: 'Arroz', icono: '🍚', semilla: 'semilla_arroz', grano: 'arroz',
    dias: 17, aguaDia: 1.1, resistencia: 0.15, rendimiento: [4, 9], semillasExtra: [1, 3],
    estaciones: ['lluvias'], malla: 'arroz',
    descripcion: 'Quiere el pie mojado todo el tiempo. Solo en invierno.',
  },
  trigo: {
    nombre: 'Trigo', icono: '🌾', semilla: 'semilla_trigo', grano: 'trigo',
    dias: 20, aguaDia: 0.35, resistencia: 0.85, rendimiento: [3, 8], semillasExtra: [1, 2],
    estaciones: ['seca'], malla: 'trigo',
    descripcion: 'De tierra fría y de verano. Cuesta, pero el pan se paga bien.',
  },
};

export const ETAPAS = ['sembrado', 'brote', 'crecimiento', 'floración', 'maduro', 'pasado'];

export function cultivo(id) { return CULTIVOS[id] || null; }
export const IDS_CULTIVOS = Object.keys(CULTIVOS);
