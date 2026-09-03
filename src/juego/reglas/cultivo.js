/**
 * cultivo.js — La milpa: sembrar, regar, deshierbar y cosechar.
 *
 * Un cuadro guarda humedad, maleza y plaga. Cada dia el sol seca, la lluvia
 * moja, la maleza roba agua y la plaga come. La cosecha no es un numero fijo:
 * sale de como se cuido el cuadro, dia a dia. Por eso conviene sembrar poco y
 * atenderlo, en vez de sembrar todo y abandonarlo.
 */
import { CULTIVOS, ETAPAS } from '../contenido/cultivos.js';
import { limitar, mezclar } from '../nucleo/mate.js';

export function crearCuadro(id, x = 0, y = 0, z = 0) {
  return {
    id, x, y, z,
    cultivo: null, diaSiembra: 0, edad: 0,
    humedad: 0.35, maleza: 0, plaga: 0, salud: 1,
    arado: false, abonado: false, cosechado: 0,
  };
}

export function sembrar(cuadro, idCultivo, dia) {
  const c = CULTIVOS[idCultivo];
  if (!c) return { ok: false, motivo: 'Ese cultivo no existe.' };
  if (cuadro.cultivo) return { ok: false, motivo: 'Ese cuadro ya está sembrado.' };
  if (!cuadro.arado) return { ok: false, motivo: 'Hay que arar el cuadro antes de sembrar.' };
  cuadro.cultivo = idCultivo;
  cuadro.diaSiembra = dia;
  cuadro.edad = 0;
  cuadro.salud = 1;
  cuadro.maleza = 0;
  cuadro.plaga = 0;
  return { ok: true, cultivo: c };
}

export function arar(cuadro) {
  if (cuadro.cultivo) return { ok: false, motivo: 'Primero hay que cosechar o limpiar.' };
  cuadro.arado = true;
  cuadro.maleza = 0;
  return { ok: true };
}

export function regar(cuadro, litros = 1, conRiego = false) {
  const antes = cuadro.humedad;
  cuadro.humedad = limitar(cuadro.humedad + litros * (conRiego ? 0.14 : 0.08), 0, 1.35);
  return { ok: true, ganado: cuadro.humedad - antes };
}

export function deshierbar(cuadro) {
  const habia = cuadro.maleza;
  cuadro.maleza = 0;
  return { ok: true, quitado: habia };
}

export function abonar(cuadro) {
  if (cuadro.abonado) return { ok: false, motivo: 'Ese cuadro ya lleva ceniza.' };
  cuadro.abonado = true;
  return { ok: true };
}

/**
 * Un dia de vida del cuadro.
 * @param {object} cuadro
 * @param {object} ctx {agua: 0..2 (lluvia del dia), calor, estacion, rnd}
 */
export function avanzarDia(cuadro, ctx = {}) {
  const rnd = ctx.rnd || Math.random;
  const agua = ctx.agua ?? 0;
  const calor = limitar(((ctx.temperatura ?? 26) - 20) / 14, 0, 1.2);

  // Balance de agua del dia: entra la lluvia, sale la evaporacion.
  cuadro.humedad = limitar(cuadro.humedad + agua * 0.55 - (0.08 + calor * 0.10), 0, 1.35);
  if (!cuadro.cultivo) {
    // La tierra en descanso se enmaleza igual, y el arado se pierde.
    cuadro.maleza = limitar(cuadro.maleza + 0.12 + agua * 0.05, 0, 1);
    if (cuadro.maleza > 0.5) cuadro.arado = false;
    return { etapa: null };
  }

  const c = CULTIVOS[cuadro.cultivo];
  cuadro.maleza = limitar(cuadro.maleza + 0.07 + agua * 0.06, 0, 1);
  // La plaga aparece con calor y humedad, y crece si nadie la corta.
  if (rnd() < 0.06 + calor * 0.05 + cuadro.humedad * 0.04) {
    cuadro.plaga = limitar(cuadro.plaga + 0.18, 0, 1);
  }

  // Estres hidrico: falta o exceso de agua, corregido por la resistencia.
  const necesidad = c.aguaDia;
  const disponible = cuadro.humedad / Math.max(necesidad, 0.05);
  let estres = 0;
  if (disponible < 1) estres = (1 - disponible) * (1 - c.resistencia * 0.7);
  else if (disponible > 2.6) estres = (disponible - 2.6) * 0.35;
  estres += cuadro.maleza * 0.35 + cuadro.plaga * 0.45;
  if (ctx.estacion && !c.estaciones.includes(ctx.estacion)) estres += 0.16;

  // La planta aguanta: se resiente poco a poco y se repone si se la atiende.
  cuadro.salud = limitar(cuadro.salud - estres * 0.11 + (estres < 0.15 ? 0.07 : 0), 0, 1);
  cuadro.humedad = limitar(cuadro.humedad - necesidad * 0.30, 0, 1.35);

  // El crecimiento se frena si la planta lo esta pasando mal.
  const ritmo = mezclar(0.45, 1.12, cuadro.salud) * (cuadro.abonado ? 1.12 : 1);
  cuadro.edad += ritmo;

  return { etapa: etapaDe(cuadro), estres, salud: cuadro.salud };
}

/** Etapa visible del cuadro, de 'sembrado' a 'pasado'. */
export function etapaDe(cuadro) {
  if (!cuadro.cultivo) return null;
  const c = CULTIVOS[cuadro.cultivo];
  const t = cuadro.edad / c.dias;
  if (cuadro.salud <= 0.02) return 'perdido';
  if (t < 0.12) return 'sembrado';
  if (t < 0.38) return 'brote';
  if (t < 0.68) return 'crecimiento';
  if (t < 0.95) return 'floración';
  if (t < 1.55) return 'maduro';
  return 'pasado';
}

/** Indice 0..3 de la malla que hay que dibujar en el cuadro. */
export function etapaVisual(cuadro) {
  const e = etapaDe(cuadro);
  return { sembrado: 0, brote: 0, crecimiento: 1, 'floración': 2, maduro: 3, pasado: 3, perdido: 0 }[e] ?? 0;
}

export function listoParaCosechar(cuadro) {
  return etapaDe(cuadro) === 'maduro';
}

/**
 * Cosecha el cuadro.
 * @returns {{ok, grano, cantidad, semillas, calidad}}
 */
export function cosechar(cuadro, { bonoSiembra = 1, rnd = Math.random } = {}) {
  const etapa = etapaDe(cuadro);
  if (!cuadro.cultivo) return { ok: false, motivo: 'Aquí no hay nada sembrado.' };
  if (etapa === 'perdido') {
    limpiar(cuadro);
    return { ok: true, grano: null, cantidad: 0, semillas: 0, calidad: 0, motivo: 'La siembra se perdió.' };
  }
  if (etapa !== 'maduro' && etapa !== 'pasado') {
    return { ok: false, motivo: 'Todavía no está de cosecha.' };
  }
  const c = CULTIVOS[cuadro.cultivo];
  const castigoPasado = etapa === 'pasado' ? 0.55 : 1;
  const calidad = limitar(cuadro.salud * castigoPasado * bonoSiembra, 0, 1.3);
  const base = mezclar(c.rendimiento[0], c.rendimiento[1], calidad);
  const cantidad = Math.max(0, Math.round(base + (rnd() - 0.5)));
  const semillas = Math.round(mezclar(c.semillasExtra[0], c.semillasExtra[1], calidad));
  const grano = c.grano;
  limpiar(cuadro);
  cuadro.cosechado++;
  return { ok: true, grano, cantidad, semillas, semilla: c.semilla, calidad, cultivo: c };
}

export function limpiar(cuadro) {
  cuadro.cultivo = null;
  cuadro.edad = 0;
  cuadro.plaga = 0;
  cuadro.salud = 1;
  cuadro.arado = false;
  cuadro.abonado = false;
}

/** Que le hace falta al cuadro ahora mismo, en una linea. */
export function diagnostico(cuadro) {
  if (!cuadro.cultivo) return cuadro.arado ? 'Arado y listo para sembrar' : 'Tierra sin arar';
  const c = CULTIVOS[cuadro.cultivo];
  const etapa = etapaDe(cuadro);
  if (etapa === 'perdido') return `${c.nombre}: se perdió`;
  const avisos = [];
  if (cuadro.humedad < c.aguaDia * 0.8) avisos.push('sed');
  if (cuadro.maleza > 0.45) avisos.push('maleza');
  if (cuadro.plaga > 0.3) avisos.push('plaga');
  const estado = avisos.length ? ` — ${avisos.join(', ')}` : '';
  return `${c.nombre}: ${etapa}${estado}`;
}
