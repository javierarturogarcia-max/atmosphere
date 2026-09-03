/**
 * plantas.js — Lo que da el monte, y cuando lo da.
 *
 * Cada hallazgo declara donde sale, en que meses, que hace falta saber para
 * cogerlo y cuanto pesa en el sorteo. Es la tabla mas facil de ampliar del
 * juego: una linea nueva y ya se puede encontrar cosa nueva.
 *
 * meses: 0 = enero ... 11 = diciembre. Vacio = todo el ano.
 */
export const HALLAZGOS = [
  // ---- de los arboles frutales -------------------------------------------
  { id: 'mango', objeto: 'mango', fuente: 'frutal', especie: 'mango', meses: [2, 3, 4, 5], peso: 6, cantidad: [1, 3], xp: 4 },
  { id: 'mango_alto', objeto: 'mango', fuente: 'frutal', especie: 'mango', meses: [2, 3, 4, 5], peso: 5, cantidad: [2, 5], xp: 8, requiere: 'trepar' },
  { id: 'jocote', objeto: 'jocote', fuente: 'frutal', especie: 'jocote', meses: [5, 6, 7, 8], peso: 6, cantidad: [2, 6], xp: 4 },
  { id: 'jocote_verde', objeto: 'jocote', fuente: 'frutal', especie: 'jocote', meses: [], peso: 2, cantidad: [1, 2], xp: 2 },

  // ---- matorrales ---------------------------------------------------------
  { id: 'mora', objeto: 'mora', fuente: 'mata', especie: 'mora', meses: [4, 5, 6, 7, 8], peso: 7, cantidad: [3, 8], xp: 4 },
  { id: 'hierbas_mata', objeto: 'hierbas', fuente: 'mata', meses: [], peso: 4, cantidad: [1, 3], xp: 3 },

  // ---- rebuscar en el monte ----------------------------------------------
  { id: 'hierbas', objeto: 'hierbas', fuente: 'monte', zonas: ['monte', 'ribera'], meses: [], peso: 8, cantidad: [1, 3], xp: 3 },
  { id: 'hongos', objeto: 'hongos', fuente: 'monte', zonas: ['monte'], meses: [4, 5, 6, 7, 8, 9], peso: 7, cantidad: [1, 4], xp: 6, requiere: 'hongos', trasLluvia: true },
  { id: 'fibra', objeto: 'fibra', fuente: 'monte', zonas: ['monte', 'potrero'], meses: [], peso: 6, cantidad: [2, 5], xp: 2 },
  { id: 'ocote', objeto: 'ocote', fuente: 'monte', zonas: ['monte'], meses: [], peso: 5, cantidad: [1, 3], xp: 3 },
  { id: 'yuca', objeto: 'yuca', fuente: 'monte', zonas: ['monte', 'potrero'], meses: [], peso: 3, cantidad: [1, 2], xp: 6 },
  { id: 'guayaba', objeto: 'guayaba', fuente: 'monte', zonas: ['monte', 'ribera'], meses: [7, 8, 9, 10], peso: 5, cantidad: [1, 4], xp: 4 },
  { id: 'chile', objeto: 'chile', fuente: 'monte', zonas: ['monte', 'casa'], meses: [], peso: 3, cantidad: [1, 3], xp: 3 },
  { id: 'miel', objeto: 'miel', fuente: 'monte', zonas: ['monte'], meses: [], peso: 2, cantidad: [1, 2], xp: 14, requiere: 'colmena' },
  { id: 'medicina', objeto: 'hierbas', fuente: 'monte', zonas: ['monte'], meses: [], peso: 2, cantidad: [2, 4], xp: 9, requiere: 'medicina' },

  // ---- ribera y rio -------------------------------------------------------
  { id: 'barro', objeto: 'barro', fuente: 'ribera', zonas: ['ribera', 'rio'], meses: [], peso: 6, cantidad: [1, 3], xp: 2 },
  { id: 'piedra', objeto: 'piedra', fuente: 'ribera', zonas: ['ribera', 'rio', 'monte'], meses: [], peso: 8, cantidad: [2, 6], xp: 1 },
  { id: 'huevo_rio', objeto: 'huevo', fuente: 'ribera', zonas: ['ribera'], meses: [1, 2, 3], peso: 2, cantidad: [1, 2], xp: 5 },

  // ---- el patio de la casa -------------------------------------------------
  { id: 'huevo', objeto: 'huevo', fuente: 'casa', zonas: ['casa'], meses: [], peso: 7, cantidad: [1, 3], xp: 2 },
  { id: 'tomate', objeto: 'tomate', fuente: 'casa', zonas: ['casa'], meses: [], peso: 4, cantidad: [1, 3], xp: 2 },
];

/** Lena: lo que se junta del suelo o se raja de un tronco. */
export const LENA = {
  tronco: { objeto: 'tronco', cantidad: [1, 1], xp: 5, requiereMachete: false },
  rajar: { objeto: 'lena', cantidad: [3, 3], xp: 4, requiereMachete: true },
  suelo: { objeto: 'lena', cantidad: [1, 3], xp: 3 },
};
