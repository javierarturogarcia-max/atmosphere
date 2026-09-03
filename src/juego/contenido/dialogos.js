/**
 * dialogos.js — Lo que dice la gente de la casa segun como va el dia.
 *
 * No son misiones: son la voz del sitio. Se eligen por condiciones (hora,
 * clima, estado del nino) para que la casa se sienta viva sin obligar a nada.
 */
export const AMBIENTE = [
  { quien: 'mama', texto: 'No salgás sin comer algo, aunque sea un mango.', cuando: { horaMax: 8 } },
  { quien: 'mama', texto: '¿Ya trajiste el agua? Mirá que el cántaro está vacío.', cuando: { sinAgua: true } },
  { quien: 'mama', texto: 'Vení a comer antes de que se enfríe.', cuando: { horaMin: 11, horaMax: 14 } },
  { quien: 'papa', texto: 'Si vas al monte, llevá piedras. Nunca se sabe.', cuando: { horaMin: 5, horaMax: 10 } },
  { quien: 'papa', texto: 'Esa nube viene cargada. Guardá la leña.', cuando: { nubosidadMin: 0.7 } },
  { quien: 'papa', texto: 'El río viene crecido. Hoy no te metás a la poza honda.', cuando: { lluviaMin: 0.6 } },
  { quien: 'abuela', texto: 'Cuando yo era chiquita, aquí abajo había venados hasta en el patio.', cuando: { horaMin: 18 } },
  { quien: 'abuela', texto: 'Sentate un rato. El monte no se va a ir.', cuando: { aguanteMax: 30 } },
  { quien: 'abuela', texto: 'Las estrellas de allá son las que marcan el norte. Aprendételas.', cuando: { horaMin: 20, nubosidadMax: 0.3 } },
  { quien: 'meches', texto: '¿Me llevás al río? ¡Porfa!', cuando: { horaMin: 9, horaMax: 16 } },
  { quien: 'meches', texto: '¡Está lloviendo! ¡Salí, salí!', cuando: { lluviaMin: 0.4 } },
  { quien: 'meches', texto: 'Tenés lodo hasta en las orejas.', cuando: { higieneMax: 30 } },
  { quien: 'mama', texto: 'Mañana hay que sembrar temprano, antes del sol.', cuando: { horaMin: 19, estacion: 'lluvias' } },
  { quien: 'papa', texto: 'En seca el agua está más lejos. Hay que ir dos veces.', cuando: { estacion: 'seca', horaMax: 10 } },
];

/** Frases del narrador al pasar cosas. Se usan como avisos con alma. */
export const SUCESOS = {
  amanecer:    ['Sale el sol por detrás del monte.', 'El gallo ya cantó dos veces.'],
  anochecer:   ['Se va la luz del día. En la casa no hay más luz que el fogón.', 'Las chicharras arrancan de golpe.'],
  primeraLluvia: ['Cae la primera gota, gorda, en el polvo. Y detrás, todas las demás.'],
  tormenta:    ['Truena cerca. El monte se calla de repente.'],
  hambre:      ['Te suenan las tripas.'],
  agotado:     ['Las piernas no dan más.'],
  cargado:     ['Vas cargado: pesás el doble y andás la mitad.'],
  banarse:     ['El agua está fría y se siente bien.'],
  lluviaJuego: ['Corrés bajo el agua sin ninguna razón. Esa es la razón.'],
  estrellas:   ['Sin luz eléctrica, el cielo se ve entero.'],
};

/**
 * Escoge una frase de ambiente que encaje con la situacion.
 * @param {object} ctx {hora, clima, necesidades, hogar, estacion}
 */
export function frasePara(ctx, rnd = Math.random) {
  const validas = AMBIENTE.filter((d) => {
    const c = d.cuando || {};
    if (c.horaMin != null && ctx.hora < c.horaMin) return false;
    if (c.horaMax != null && ctx.hora > c.horaMax) return false;
    if (c.lluviaMin != null && (ctx.clima?.lluvia ?? 0) < c.lluviaMin) return false;
    if (c.nubosidadMin != null && (ctx.clima?.nubosidad ?? 0) < c.nubosidadMin) return false;
    if (c.nubosidadMax != null && (ctx.clima?.nubosidad ?? 0) > c.nubosidadMax) return false;
    if (c.aguanteMax != null && (ctx.necesidades?.aguante ?? 100) > c.aguanteMax) return false;
    if (c.higieneMax != null && (ctx.necesidades?.higiene ?? 100) > c.higieneMax) return false;
    if (c.estacion && ctx.estacion !== c.estacion) return false;
    if (c.sinAgua && (ctx.aguaEnCasa ?? 99) > 2) return false;
    return true;
  });
  if (!validas.length) return null;
  return validas[Math.floor(rnd() * validas.length)];
}

export function suceso(clave, rnd = Math.random) {
  const lista = SUCESOS[clave];
  if (!lista || !lista.length) return null;
  return lista[Math.floor(rnd() * lista.length)];
}
