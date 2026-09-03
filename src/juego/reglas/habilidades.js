/**
 * habilidades.js — La superacion del nino, medida.
 *
 * Siete oficios que solo suben haciendolos. Cada nivel desbloquea algo
 * concreto —no un porcentaje invisible— porque lo que engancha es poder hacer
 * cosas nuevas: poner trampas, tirar la atarraya, abrir una acequia.
 */
import { limitar, mezclar } from '../nucleo/mate.js';

export const HABILIDADES = {
  caza:        { nombre: 'Caza', icono: '🏹', descripcion: 'Acercarse sin que te huelan y tirar con la hondilla.' },
  pesca:       { nombre: 'Pesca', icono: '🎣', descripcion: 'Leer el río, escoger la poza y aguantar el tirón.' },
  recoleccion: { nombre: 'Recolección', icono: '🧺', descripcion: 'Saber qué se come del monte y en qué mes está.' },
  siembra:     { nombre: 'Siembra', icono: '🌱', descripcion: 'Milpa, riego y cosecha.' },
  fuerza:      { nombre: 'Fuerza', icono: '💪', descripcion: 'Cargar agua y leña sin quedarse a medio camino.' },
  oficio:      { nombre: 'Oficio', icono: '🔨', descripcion: 'Cocinar, hacer pita, arreglar lo que se rompe.' },
  espiritu:    { nombre: 'Espíritu', icono: '✨', descripcion: 'Jugar, bañarse, mirar las estrellas. También cuenta.' },
};

/** Curva superlineal: los primeros niveles llegan rapido y luego cuesta. */
export function xpParaNivel(nivel) {
  if (nivel <= 1) return 0;
  return Math.round(45 * (nivel - 1) ** 1.55);
}

export function nivelDesde(xp) {
  let nivel = 1;
  while (nivel < 12 && xp >= xpParaNivel(nivel + 1)) nivel++;
  const actual = xpParaNivel(nivel);
  const siguiente = nivel >= 12 ? actual : xpParaNivel(nivel + 1);
  return {
    nivel,
    xp,
    enNivel: xp - actual,
    paraSiguiente: Math.max(0, siguiente - actual),
    progreso: nivel >= 12 ? 1 : limitar((xp - actual) / Math.max(1, siguiente - actual), 0, 1),
  };
}

export function crearHabilidades() {
  const h = {};
  for (const k of Object.keys(HABILIDADES)) h[k] = 0;
  return h;
}

/**
 * Suma experiencia y avisa si hubo ascenso.
 * @returns {{habilidad, xp, nivel, subio, desbloqueos}}
 */
export function ganar(habilidades, habilidad, xp) {
  if (!(habilidad in HABILIDADES)) throw new Error(`Habilidad desconocida: ${habilidad}`);
  const antes = nivelDesde(habilidades[habilidad] || 0).nivel;
  habilidades[habilidad] = Math.max(0, (habilidades[habilidad] || 0) + xp);
  const info = nivelDesde(habilidades[habilidad]);
  const subio = info.nivel > antes;
  return {
    habilidad, xp, nivel: info.nivel, subio,
    desbloqueos: subio ? desbloqueosEntre(habilidad, antes, info.nivel) : [],
  };
}

export const DESBLOQUEOS = {
  caza: {
    2: { id: 'rastro', texto: 'Ves las huellas frescas en el suelo' },
    3: { id: 'trampa', texto: 'Puedes fabricar y poner trampas' },
    4: { id: 'tiro_largo', texto: 'La hondilla llega más lejos y pega más fuerte' },
    6: { id: 'destazar', texto: 'Aprovechas también el cuero de la pieza' },
  },
  pesca: {
    2: { id: 'cebo', texto: 'Preparas cebo con lombriz: pican antes' },
    3: { id: 'atarraya', texto: 'Puedes hacer y tirar la atarraya' },
    5: { id: 'poza', texto: 'Reconoces la poza buena de un vistazo' },
  },
  recoleccion: {
    2: { id: 'hongos', texto: 'Distingues los hongos buenos de los malos' },
    3: { id: 'trepar', texto: 'Trepas a los palos altos por la fruta de arriba' },
    4: { id: 'colmena', texto: 'Sacas miel sin que te coma el enjambre' },
    5: { id: 'medicina', texto: 'Conoces las hierbas que bajan la fiebre' },
  },
  siembra: {
    2: { id: 'riego', texto: 'Riegas con acequia: el agua cunde el doble' },
    3: { id: 'abono', texto: 'Abonas con ceniza del fogón' },
    4: { id: 'asocio', texto: 'Siembras frijol trepando el maíz: rinde más' },
    6: { id: 'guardar', texto: 'Guardas semilla buena para el año siguiente' },
  },
  fuerza: {
    2: { id: 'carga', texto: 'Cargas 3,5 kg más sin cansarte' },
    3: { id: 'dos_cantaros', texto: 'Llevas dos cántaros a la vez' },
    5: { id: 'aguante', texto: 'Te cansas mucho más despacio en cuesta' },
  },
  oficio: {
    2: { id: 'cocina', texto: 'Cocinas guisos, no solo asados' },
    3: { id: 'pita', texto: 'Tuerces pita con fibra de maguey' },
    4: { id: 'barro', texto: 'Haces cántaros y comales de barro' },
    5: { id: 'reparar', texto: 'Arreglas herramientas antes de que se rompan' },
  },
  espiritu: {
    2: { id: 'cuentos', texto: 'La abuela te cuenta historias del valle' },
    3: { id: 'aguante_animo', texto: 'El buen ánimo te da aguante extra' },
    5: { id: 'estrellas', texto: 'Sabes orientarte de noche por las estrellas' },
  },
};

export function desbloqueosEntre(habilidad, desde, hasta) {
  const tabla = DESBLOQUEOS[habilidad] || {};
  const salida = [];
  for (let n = desde + 1; n <= hasta; n++) if (tabla[n]) salida.push({ ...tabla[n], habilidad, nivel: n });
  return salida;
}

/** Todo lo desbloqueado hasta ahora, como conjunto de identificadores. */
export function desbloqueado(habilidades) {
  const set = new Set();
  for (const h of Object.keys(HABILIDADES)) {
    const nivel = nivelDesde(habilidades[h] || 0).nivel;
    for (const [n, d] of Object.entries(DESBLOQUEOS[h] || {})) {
      if (nivel >= Number(n)) set.add(d.id);
    }
  }
  return set;
}

/** Multiplicador de eficacia de una habilidad (1 en nivel 1, ~1,9 en nivel 12). */
export function bono(habilidades, habilidad) {
  const nivel = nivelDesde(habilidades[habilidad] || 0).nivel;
  return mezclar(1, 1.9, (nivel - 1) / 11);
}

export function nivel(habilidades, habilidad) {
  return nivelDesde(habilidades[habilidad] || 0).nivel;
}
