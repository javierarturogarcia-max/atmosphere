/**
 * pesca.js — El rio, la cana y el pulso con el pez.
 *
 * Dos capas: primero decidir DONDE y CUANDO (la poza honda al amanecer no da lo
 * mismo que el remanso a mediodia), y despues aguantar el tiron sin reventar la
 * linea. La segunda capa es puro reflejo; la primera es estrategia, y es la que
 * de verdad decide si se come pescado.
 */
import { PECES } from '../contenido/peces.js';
import { limitar, mezclar, suavizar } from '../nucleo/mate.js';

/** Calidad del sitio y del momento, de 0 a 1. */
export function calidadPunto(ctx) {
  const { hondura = 0.3, hora = 12, lluvia = 0, cebo = false, bono = 1, atarraya = false } = ctx;
  // El pez sube al amanecer y al atardecer.
  const franja = Math.max(
    suavizar(4.2, 6.0, hora) * (1 - suavizar(8.0, 10.0, hora)),
    suavizar(15.5, 17.5, hora) * (1 - suavizar(19.5, 21.0, hora)),
  );
  let q = 0.2 + franja * 0.4 + hondura * 0.3;
  if (cebo) q += 0.14;
  if (lluvia > 0.2) q += 0.12;              // el agua revuelta les da confianza
  if (lluvia > 0.85) q -= 0.25;             // pero con la crecida se esconden
  if (atarraya) q += 0.1;
  return limitar(q * mezclar(0.85, 1.2, limitar(bono - 1, 0, 1)), 0.03, 1);
}

/** Segundos hasta que pica. */
export function esperaPicada(calidad, rnd = Math.random) {
  return mezclar(11, 1.6, calidad) * mezclar(0.55, 1.6, rnd());
}

/** Escoge que pez pica: los raros piden poza honda y hora buena. */
export function elegirPez(ctx, rnd = Math.random) {
  const { hondura = 0.3, hora = 12, bono = 1 } = ctx;
  const noche = hora < 5.5 || hora > 18.5;
  const posibles = PECES.filter((p) => {
    if (p.hondura > hondura + 0.2) return false;
    if (p.noche && !noche) return false;
    return true;
  });
  if (!posibles.length) return PECES[0];
  // Cuanto mejor la habilidad y mas honda la poza, mas peso tienen los raros.
  const suerte = limitar(rnd() * mezclar(0.75, 1.5, limitar(bono - 1, 0, 1)) + hondura * 0.3, 0, 1.4);
  const candidatos = posibles.filter((p) => p.raro <= suerte);
  const lista = candidatos.length ? candidatos : [posibles[0]];
  return lista[Math.min(lista.length - 1, Math.floor(rnd() * lista.length * 1.15))];
}

/**
 * Prepara un lance completo.
 * @returns {{estado, espera, pez, tension, progreso, tiempo, calidad}}
 */
export function crearLance(ctx, rnd = Math.random) {
  const calidad = calidadPunto(ctx);
  return {
    estado: 'esperando',
    calidad,
    espera: esperaPicada(calidad, rnd),
    pez: elegirPez(ctx, rnd),
    tension: 0,
    progreso: 0,
    tiempo: 0,
    fase: rnd() * 6.28,
    bono: ctx.bono ?? 1,
    // La ventana para clavar el anzuelo: si no reaccionas, se va.
    ventana: mezclar(1.5, 0.75, limitar((ctx.bono ?? 1) - 1, 0, 1)),
  };
}

/** Fuerza instantanea del pez: tirones irregulares, no una curva plana. */
export function tironPez(lance, t) {
  const p = lance.pez;
  return p.fuerza * (0.62 + 0.38 * Math.sin(t * 2.4 + lance.fase) * Math.sin(t * 0.9 + lance.fase * 1.7));
}

/**
 * Avanza el lance un instante.
 * @param {object} lance
 * @param {number} dt segundos
 * @param {boolean} recogiendo el jugador esta tirando de la cana
 * @param {boolean} clavar el jugador acaba de clavar (solo en 'picando')
 */
export function avanzarLance(lance, dt, recogiendo, clavar = false) {
  lance.tiempo += dt;
  if (lance.estado === 'esperando') {
    if (clavar) { lance.estado = 'fallado'; lance.motivo = 'Clavaste antes de tiempo.'; return lance; }
    if (lance.tiempo >= lance.espera) { lance.estado = 'picando'; lance.tiempo = 0; }
    return lance;
  }
  if (lance.estado === 'picando') {
    if (clavar) { lance.estado = 'luchando'; lance.tiempo = 0; return lance; }
    if (lance.tiempo >= lance.ventana) { lance.estado = 'escapado'; lance.motivo = 'Se llevó el cebo.'; }
    return lance;
  }
  if (lance.estado !== 'luchando') return lance;

  const bono = mezclar(1, 0.72, limitar(lance.bono - 1, 0, 1));   // habilidad = linea mas sufrida
  const tiron = tironPez(lance, lance.tiempo);
  if (recogiendo) {
    lance.tension = limitar(lance.tension + (tiron * 1.45 + 0.30) * bono * dt, 0, 1.2);
    lance.progreso = limitar(lance.progreso + (0.30 / Math.max(0.5, lance.pez.resistencia)) * dt, 0, 1);
  } else {
    lance.tension = limitar(lance.tension - 0.55 * dt, 0, 1.2);
    lance.progreso = limitar(lance.progreso - 0.075 * dt, 0, 1);
  }
  if (lance.tension >= 1) { lance.estado = 'roto'; lance.motivo = 'Se reventó la línea.'; }
  else if (lance.progreso >= 1) { lance.estado = 'cobrado'; }
  // Si nadie recoge, el pez acaba soltandose: no vale esperar sin hacer nada.
  else if (lance.tiempo > 26) { lance.estado = 'escapado'; lance.motivo = 'Se soltó del anzuelo.'; }
  return lance;
}

/** Resultado en objetos y experiencia. */
export function cobrar(lance) {
  if (lance.estado !== 'cobrado') return { ok: false };
  const p = lance.pez;
  return {
    ok: true, pez: p,
    objetos: [{ id: p.objeto, cantidad: p.cantidad }],
    xp: p.xp,
    texto: `${p.nombre} de ${p.peso.toFixed(1)} kg`,
  };
}

/**
 * Tirar la atarraya: sin pulso, pero cansa y depende del sitio.
 * Es lo que desbloquea pescar para toda la casa, no solo para uno.
 */
export function tirarAtarraya(ctx, rnd = Math.random) {
  const calidad = calidadPunto({ ...ctx, atarraya: true });
  const n = Math.round(mezclar(0, 4.5, calidad * mezclar(0.7, 1.25, rnd())));
  const capturas = [];
  for (let k = 0; k < n; k++) capturas.push(elegirPez({ ...ctx, bono: (ctx.bono ?? 1) * 0.8 }, rnd));
  const total = capturas.reduce((s, p) => s + p.cantidad, 0);
  return {
    ok: n > 0, capturas,
    objetos: total ? [{ id: 'pescado', cantidad: total }] : [],
    xp: capturas.reduce((s, p) => s + Math.round(p.xp * 0.6), 0) + 3,
    aguante: 22,
  };
}
