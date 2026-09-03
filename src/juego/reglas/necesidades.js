/**
 * necesidades.js — Hambre, sed, aguante y animo.
 *
 * No es un juego de supervivencia cruel: nadie se muere de hambre por
 * descuidarse una tarde. Lo que hacen las necesidades es empujar la rutina —
 * hay que beber, hay que comer, hay que descansar— y castigar con torpeza, no
 * con la muerte. El animo es la medida de la superacion: sube cuando el nino
 * juega, se bana en el rio o aporta a la casa, y de el dependen el aguante y la
 * pulseria del dia siguiente.
 */
import { limitar, mezclar } from '../nucleo/mate.js';

export const MAXIMO = 100;

export function crearNecesidades() {
  return { hambre: 78, sed: 74, aguante: 100, animo: 62, salud: 100, higiene: 70 };
}

/**
 * Gasto por hora de juego. El aguante en positivo se gasta y en negativo se
 * recupera; sus numeros son mayores porque es un recurso de rafaga: correr un
 * buen rato lo vacia y pararse a respirar lo repone.
 */
export const ACTIVIDADES = {
  quieto:    { hambre: 2.2, sed: 3.0, aguante: -150, animo: -0.4 },
  andar:     { hambre: 3.4, sed: 4.6, aguante: -32,  animo: 0 },
  correr:    { hambre: 6.2, sed: 9.0, aguante: 92,   animo: 0.4 },
  cargar:    { hambre: 5.0, sed: 7.4, aguante: 48,   animo: -1.2 },
  trabajar:  { hambre: 5.6, sed: 8.0, aguante: 62,   animo: -1.6 },
  nadar:     { hambre: 5.0, sed: 3.0, aguante: 70,   animo: 6 },
  jugar:     { hambre: 4.2, sed: 5.4, aguante: 34,   animo: 14 },
  dormir:    { hambre: 1.1, sed: 1.4, aguante: -420, animo: 2.5 },
};

/**
 * Avanza las necesidades.
 * @param {object} n         estado (se modifica)
 * @param {number} horas     horas de juego transcurridas
 * @param {object} ctx       {actividad, calor, cargaRelativa, mojado, bajoTecho}
 */
export function actualizar(n, horas, ctx = {}) {
  const act = ACTIVIDADES[ctx.actividad] || ACTIVIDADES.andar;
  const calor = limitar((ctx.temperatura ?? 26) - 22, -6, 14) / 14;   // 0..1
  const carga = limitar(ctx.cargaRelativa ?? 0, 0, 1.4);

  n.hambre = limitar(n.hambre - act.hambre * horas * (1 + carga * 0.35), 0, MAXIMO);
  n.sed = limitar(n.sed - act.sed * horas * (1 + calor * 0.55 + carga * 0.3), 0, MAXIMO);

  // El aguante se gasta con signo positivo y se recupera con signo negativo.
  const recupera = act.aguante < 0;
  const factorAnimo = mezclar(0.75, 1.25, n.animo / MAXIMO);
  let daguante = -act.aguante * horas;
  if (recupera) daguante *= factorAnimo * (n.hambre > 25 && n.sed > 25 ? 1 : 0.5);
  else daguante *= (1 + carga * 0.8) / factorAnimo;
  n.aguante = limitar(n.aguante + daguante, 0, MAXIMO);

  n.animo = limitar(n.animo + act.animo * horas, 0, MAXIMO);
  if (ctx.mojado && !ctx.bajoTecho) n.higiene = limitar(n.higiene + 6 * horas, 0, MAXIMO);
  else n.higiene = limitar(n.higiene - 1.6 * horas, 0, MAXIMO);

  // Pasar hambre o sed de verdad si afecta a la salud.
  const carencia = (n.hambre < 12 ? 1 : 0) + (n.sed < 12 ? 1.6 : 0);
  if (carencia) n.salud = limitar(n.salud - carencia * 3.5 * horas, 0, MAXIMO);
  else if (n.hambre > 45 && n.sed > 45) n.salud = limitar(n.salud + 2.2 * horas, 0, MAXIMO);

  return n;
}

export function comer(n, objeto) {
  if (!objeto) return null;
  n.hambre = limitar(n.hambre + (objeto.hambre || 0), 0, MAXIMO);
  n.sed = limitar(n.sed + (objeto.sed || 0), 0, MAXIMO);
  n.animo = limitar(n.animo + (objeto.animo || 0), 0, MAXIMO);
  n.salud = limitar(n.salud + (objeto.salud || 0), 0, MAXIMO);
  return n;
}

export function beber(n, litros = 1) {
  n.sed = limitar(n.sed + litros * 22, 0, MAXIMO);
  return n;
}

export function banarse(n) {
  n.higiene = MAXIMO;
  n.animo = limitar(n.animo + 16, 0, MAXIMO);
  n.aguante = limitar(n.aguante + 12, 0, MAXIMO);
  return n;
}

export function dormir(n, horas = 8) {
  actualizar(n, horas, { actividad: 'dormir', bajoTecho: true });
  n.aguante = MAXIMO;
  n.animo = limitar(n.animo + (n.hambre > 40 ? 8 : 0), 0, MAXIMO);
  return n;
}

/**
 * Como afecta el estado a lo que el nino puede hacer.
 * @returns {{velocidad, punteria, exito, aviso}}
 */
export function penalizaciones(n) {
  const cansado = n.aguante < 25;
  const flojo = n.hambre < 25 || n.sed < 25;
  const velocidad = mezclar(0.62, 1, limitar(n.aguante / 60, 0, 1)) * (flojo ? 0.85 : 1);
  const punteria = mezclar(0.55, 1, limitar(n.aguante / 70, 0, 1)) * mezclar(0.8, 1, limitar(n.animo / 70, 0, 1));
  const exito = mezclar(0.7, 1.12, limitar((n.animo + n.salud) / 180, 0, 1));
  let aviso = null;
  if (n.sed < 15) aviso = 'Tienes mucha sed. Al río.';
  else if (n.hambre < 15) aviso = 'Te suenan las tripas.';
  else if (cansado) aviso = 'Estás cansado: descansa o come algo.';
  else if (n.animo < 20) aviso = 'Andas decaído. Un rato de juego levanta el ánimo.';
  return { velocidad, punteria, exito, aviso, cansado, flojo };
}

/** Resumen para la interfaz: 0..1 por barra. */
export function barras(n) {
  return {
    hambre: n.hambre / MAXIMO,
    sed: n.sed / MAXIMO,
    aguante: n.aguante / MAXIMO,
    animo: n.animo / MAXIMO,
  };
}
