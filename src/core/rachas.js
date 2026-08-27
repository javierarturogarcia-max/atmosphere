/**
 * rachas.js — Rachas diarias con congelaciones.
 * La racha es el mecanismo de retencion mas potente conocido en apps de habito,
 * pero castiga demasiado el fallo puntual: por eso se incluyen "congelaciones"
 * (protecciones) que absorben un dia perdido, como en los idiomas.
 */

/** Convierte una fecha a clave local YYYY-MM-DD (sin desplazamiento UTC). */
export function claveDia(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Diferencia en dias enteros entre dos claves YYYY-MM-DD. */
export function diasEntre(claveA, claveB) {
  const a = new Date(`${claveA}T00:00:00`);
  const b = new Date(`${claveB}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

/** Suma dias a una clave. */
export function sumarDias(clave, n) {
  const d = new Date(`${clave}T00:00:00`);
  d.setDate(d.getDate() + n);
  return claveDia(d);
}

/**
 * Calcula la racha a partir del conjunto de dias con actividad.
 * @param {string[]} diasActivos claves YYYY-MM-DD (pueden venir desordenadas)
 * @param {string} hoy clave del dia de referencia
 * @param {number} congelaciones protecciones disponibles
 */
export function calcularRacha(diasActivos, hoy = claveDia(), congelaciones = 0) {
  const set = new Set(diasActivos);
  if (set.size === 0) {
    return { actual: 0, usadasCongelaciones: 0, enRiesgo: false, ultimoDia: null, mejor: 0 };
  }
  const ordenados = [...set].sort();
  const ultimoDia = ordenados[ordenados.length - 1];

  // Punto de partida: hoy si hay actividad, si no ayer (el dia aun no ha acabado).
  let cursor = set.has(hoy) ? hoy : sumarDias(hoy, -1);
  let actual = 0;
  let usadas = 0;
  let libres = Math.max(0, congelaciones);

  while (true) {
    if (set.has(cursor)) {
      actual++;
      cursor = sumarDias(cursor, -1);
    } else if (libres > 0 && actual > 0) {
      libres--; usadas++;
      cursor = sumarDias(cursor, -1);
    } else break;
    if (actual > 3650) break; // guarda de seguridad
  }

  return {
    actual,
    usadasCongelaciones: usadas,
    enRiesgo: !set.has(hoy) && actual > 0,
    ultimoDia,
    mejor: mejorRacha(ordenados),
  };
}

/** Racha maxima historica en la serie de dias activos. */
export function mejorRacha(diasOrdenados) {
  if (!diasOrdenados.length) return 0;
  let mejor = 1, actual = 1;
  for (let i = 1; i < diasOrdenados.length; i++) {
    actual = diasEntre(diasOrdenados[i - 1], diasOrdenados[i]) === 1 ? actual + 1 : 1;
    if (actual > mejor) mejor = actual;
  }
  return mejor;
}

/** Ultimos n dias en orden cronologico, para mapas de calor. */
export function ultimosDias(n, hoy = claveDia()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(sumarDias(hoy, -i));
  return out;
}

/** Congelaciones ganadas: 1 por cada 7 dias de racha, tope 3 acumuladas. */
export function congelacionesGanadas(rachaActual, yaTiene = 0) {
  const merecidas = Math.floor(rachaActual / 7);
  return Math.max(0, Math.min(3 - yaTiene, merecidas - yaTiene));
}
