/**
 * clima.js — Estaciones, lluvia y viento.
 *
 * El calendario del juego tiene 12 meses de 30 dias. En el campo hay dos
 * estaciones que lo mandan todo: la seca (noviembre a abril) y las lluvias
 * (mayo a octubre). De eso depende que la milpa crezca, que haya hongos, que
 * el rio venga crecido y que el nino pueda salir a jugar bajo el agua.
 *
 * El tiempo de cada dia se deriva de la semilla y del numero de dia: no se
 * guarda nada y siempre sale igual, asi que se puede consultar el pronostico
 * de pasado manana sin haber jugado hasta alli.
 */
import { generador } from '../../core/rng.js';
import { limitar, mezclar, suavizar, TAU } from '../nucleo/mate.js';

export const DIAS_MES = 30;
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Probabilidad de lluvia por mes (indice 0 = enero). Perfil tropical. */
const LLUVIA_MES = [0.04, 0.03, 0.05, 0.18, 0.55, 0.78, 0.62, 0.74, 0.82, 0.60, 0.18, 0.06];
const TEMPERATURA_MES = [25, 26, 28, 29, 28, 27, 27, 27, 26, 26, 25, 24];

export function mesDe(dia) { return Math.floor(((dia - 1) % 360) / DIAS_MES); }
export function diaDelMes(dia) { return ((dia - 1) % DIAS_MES) + 1;}
export function anioDe(dia) { return Math.floor((dia - 1) / 360) + 1; }
export function estacionDe(dia) {
  const m = mesDe(dia);
  return m >= 4 && m <= 9 ? 'lluvias' : 'seca';
}
export function nombreFecha(dia) {
  return `${diaDelMes(dia)} de ${MESES[mesDe(dia)]}`;
}

/**
 * Plan del dia: se calcula una vez y sirve para todas las horas.
 * @returns {{nubosidad, chubascos, viento, temperatura, tormenta, estacion}}
 */
export function climaDelDia(semilla, dia) {
  const rnd = generador(`${semilla}:clima:${dia}`);
  const mes = mesDe(dia);
  const pLluvia = LLUVIA_MES[mes];
  const estacion = estacionDe(dia);

  const nubosidad = limitar(pLluvia * mezclar(0.5, 1.15, rnd()) + rnd() * 0.22, 0.02, 0.98);
  const chubascos = [];
  // En el tropico llueve por la tarde: los chubascos se concentran ahi.
  const cuantos = rnd() < pLluvia ? (rnd() < pLluvia * 0.55 ? 2 : 1) : 0;
  for (let i = 0; i < cuantos; i++) {
    const inicio = mezclar(12.5, 20.5, rnd() ** 0.7) + i * 1.5;
    const duracion = mezclar(0.7, 3.4, rnd());
    chubascos.push({
      inicio: limitar(inicio, 0, 23.4),
      fin: limitar(inicio + duracion, 0.5, 23.9),
      fuerza: limitar(mezclar(0.35, 1, rnd() ** 0.8), 0.2, 1),
    });
  }
  const tormenta = chubascos.some((c) => c.fuerza > 0.8) && rnd() < 0.55;
  const viento = {
    direccion: rnd() * TAU,
    fuerza: limitar(mezclar(0.12, 0.75, rnd()) + (tormenta ? 0.35 : 0), 0.05, 1.2),
  };
  const temperatura = TEMPERATURA_MES[mes] + (rnd() - 0.5) * 4;

  return { dia, estacion, mes, nubosidad, chubascos, viento, temperatura, tormenta };
}

/** Estado instantaneo: lo que se ve y lo que afecta al juego en esta hora. */
export function climaEn(plan, hora) {
  let lluvia = 0;
  for (const c of plan.chubascos) {
    if (hora >= c.inicio && hora <= c.fin) {
      // Entra y sale suave: no empieza a cantaros de golpe.
      const entrada = suavizar(c.inicio, c.inicio + 0.35, hora);
      const salida = 1 - suavizar(c.fin - 0.5, c.fin, hora);
      lluvia = Math.max(lluvia, c.fuerza * entrada * salida);
    }
  }
  // Antes del chubasco se encapota; despues escampa poco a poco.
  let nubosidad = plan.nubosidad;
  for (const c of plan.chubascos) {
    if (hora > c.inicio - 1.5 && hora < c.fin + 2) {
      nubosidad = Math.max(nubosidad, limitar(0.55 + c.fuerza * 0.45, 0, 1) *
        suavizar(c.inicio - 1.6, c.inicio - 0.3, hora) * (1 - suavizar(c.fin, c.fin + 2.2, hora) * 0.45));
    }
  }
  nubosidad = limitar(Math.max(nubosidad, lluvia * 0.9), 0, 1);

  // La temperatura sigue el sol con retraso: lo mas fresco es antes del alba.
  const cicloDia = Math.cos(((hora - 15) / 24) * TAU);
  const temperatura = plan.temperatura - 5.5 * cicloDia - lluvia * 3.5;
  const fuerzaViento = plan.viento.fuerza * mezclar(0.6, 1.35, suavizar(6, 15, hora)) + lluvia * 0.4;

  return {
    dia: plan.dia,
    hora,
    estacion: plan.estacion,
    lluvia,
    nubosidad,
    temperatura,
    tormenta: plan.tormenta && lluvia > 0.7,
    viento: {
      direccion: plan.viento.direccion,
      fuerza: limitar(fuerzaViento, 0.03, 1.4),
      x: Math.cos(plan.viento.direccion),
      z: Math.sin(plan.viento.direccion),
    },
    // Cuanto se ha mojado el suelo hoy: lo usa el riego de la milpa.
    llovioHoy: plan.chubascos.some((c) => hora >= c.inicio),
  };
}

/** Agua caida en el dia entero, en "riegos" equivalentes (0..2). */
export function aguaDelDia(plan) {
  let total = 0;
  for (const c of plan.chubascos) total += (c.fin - c.inicio) * c.fuerza * 0.55;
  return limitar(total, 0, 2.2);
}

/** Texto corto para el parte del dia. */
export function describirClima(estado) {
  if (estado.tormenta) return 'tormenta';
  if (estado.lluvia > 0.65) return 'aguacero';
  if (estado.lluvia > 0.25) return 'lluvia';
  if (estado.lluvia > 0.02) return 'llovizna';
  if (estado.nubosidad > 0.75) return 'encapotado';
  if (estado.nubosidad > 0.4) return 'nublado';
  if (estado.nubosidad > 0.15) return 'medio nublado';
  return 'despejado';
}
