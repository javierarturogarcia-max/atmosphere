/**
 * peces.js — Lo que hay en el rio.
 *
 * `fuerza` es cuanto tira (mas tension en la linea), `resistencia` cuanto
 * aguanta antes de rendirse, y `peso` lo que da de comer. Los grandes salen en
 * las pozas hondas y a las horas en que el pez sube: al amanecer y al oscurecer.
 */
export const PECES = [
  { id: 'chimbolo', nombre: 'Chimbolo', icono: '🐠', peso: 0.2, fuerza: 0.5, resistencia: 0.6, raro: 0, hondura: 0, xp: 5, objeto: 'pescado', cantidad: 1 },
  { id: 'mojarra', nombre: 'Mojarra', icono: '🐟', peso: 0.5, fuerza: 0.85, resistencia: 1, raro: 0.25, hondura: 0.25, xp: 9, objeto: 'pescado', cantidad: 1 },
  { id: 'guapote', nombre: 'Guapote', icono: '🐟', peso: 1.1, fuerza: 1.25, resistencia: 1.5, raro: 0.55, hondura: 0.5, xp: 16, objeto: 'pescado', cantidad: 2 },
  { id: 'bagre', nombre: 'Bagre', icono: '🐡', peso: 1.8, fuerza: 1.55, resistencia: 2.1, raro: 0.75, hondura: 0.65, xp: 24, objeto: 'pescado', cantidad: 3, noche: true },
  { id: 'tepemechin', nombre: 'Tepemechín', icono: '🐋', peso: 2.6, fuerza: 1.9, resistencia: 2.6, raro: 0.92, hondura: 0.8, xp: 38, objeto: 'pescado', cantidad: 4 },
];

export function pez(id) { return PECES.find((p) => p.id === id) || null; }
