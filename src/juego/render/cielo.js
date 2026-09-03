/**
 * cielo.js — Iluminacion y atmosfera segun la hora y el clima.
 *
 * Devuelve un unico objeto con todo lo que necesitan los shaders: direccion y
 * color del sol, colores del cielo por zonas, niebla, ambiente y cuanto se ven
 * las estrellas. Que todo salga de aqui es lo que hace que el amanecer sea
 * coherente entre el cielo, la hierba, el agua y la piel del nino.
 */
import { limitar, mezclar, mezclarV3, suavizar, normalizar, TAU } from '../nucleo/mate.js';

const NOCHE   = { cenit: [0.016, 0.028, 0.070], horizonte: [0.055, 0.075, 0.135], sol: [0.35, 0.45, 0.75] };
const ALBA    = { cenit: [0.13, 0.22, 0.42],   horizonte: [0.95, 0.52, 0.30],    sol: [1.00, 0.62, 0.35] };
const DIA     = { cenit: [0.20, 0.42, 0.78],   horizonte: [0.66, 0.80, 0.92],    sol: [1.00, 0.97, 0.90] };
const OCASO   = { cenit: [0.16, 0.20, 0.40],   horizonte: [0.98, 0.45, 0.22],    sol: [1.00, 0.52, 0.26] };

/**
 * @param {number} hora 0..24
 * @param {object} clima {nubosidad 0..1, lluvia 0..1, niebla 0..1}
 */
export function estadoCielo(hora, clima = {}) {
  const nubosidad = limitar(clima.nubosidad ?? 0, 0, 1);
  const lluvia = limitar(clima.lluvia ?? 0, 0, 1);

  // Elevacion solar: 0 al amanecer (6h) y al ocaso (18h), 1 al mediodia.
  const t = ((hora - 6) / 12) * Math.PI;
  const elevacion = Math.sin(t);
  const azimut = ((hora - 6) / 24) * TAU;
  const dirSol = normalizar([Math.cos(azimut) * 0.75, Math.max(elevacion, -1), Math.sin(azimut) * 0.42 + 0.25]);

  // Mezcla de paletas: noche -> alba -> dia -> ocaso -> noche.
  let base;
  if (elevacion <= 0) {
    const k = suavizar(-0.34, 0.03, elevacion);
    base = hora < 12 ? mezclarPaleta(NOCHE, ALBA, k) : mezclarPaleta(NOCHE, OCASO, k);
  } else {
    const k = suavizar(0.02, 0.34, elevacion);
    base = hora < 12 ? mezclarPaleta(ALBA, DIA, k) : mezclarPaleta(OCASO, DIA, k);
  }

  // El cielo cubierto apaga el contraste y tira todo a gris azulado.
  const gris = [0.42, 0.45, 0.50];
  const kNube = nubosidad * 0.75;
  const cenit = mezclarV3(base.cenit, mezclarV3(gris, [0.10, 0.12, 0.14], 1 - Math.max(elevacion, 0)), kNube);
  const horizonte = mezclarV3(base.horizonte, mezclarV3(gris, [0.14, 0.15, 0.17], 1 - Math.max(elevacion, 0)), kNube);

  const fuerzaSol = Math.max(0, elevacion) ** 0.65;
  const intensidad = mezclar(0.10, 1.85, fuerzaSol) * mezclar(1, 0.42, nubosidad);
  const colorSol = mezclarV3(base.sol, [0.75, 0.80, 0.88], nubosidad * 0.6);

  // La luna sostiene una lectura minima de noche: sin esto no se ve nada.
  // De noche la luna hace de sol tenue y azulado: sin esto no se ve nada.
  const luna = limitar(-elevacion * 2.2, 0, 1);
  // El suelo minimo de luz ambiente es una decision de jugabilidad: de noche y
  // al amanecer se tiene que poder ver por donde se anda, aunque el sol no este.
  const ambiente = mezclarV3(
    mezclarV3([0.19, 0.24, 0.36], [0.52, 0.62, 0.76], fuerzaSol),
    [0.56, 0.59, 0.63], nubosidad * 0.5);

  const nieblaColor = mezclarV3(horizonte, [0.62, 0.66, 0.70], lluvia * 0.5);
  const densidadNiebla = mezclar(0.0075, 0.030, Math.max(nubosidad * 0.5, lluvia)) *
    mezclar(1.5, 1, fuerzaSol);

  return {
    hora,
    elevacion,
    dirSol,
    colorSol,
    intensidad,
    cenit,
    horizonte,
    ambiente,
    luna,
    estrellas: limitar(-elevacion * 3 + 0.15, 0, 1) * (1 - nubosidad * 0.9),
    nubes: nubosidad,
    lluvia,
    niebla: { color: nieblaColor, densidad: densidadNiebla, altura: 0.022 },
    // Cuanto "moja" la escena: oscurece y da brillo especular al suelo.
    humedad: limitar(lluvia * 1.2, 0, 1),
  };
}

function mezclarPaleta(a, b, k) {
  return {
    cenit: mezclarV3(a.cenit, b.cenit, k),
    horizonte: mezclarV3(a.horizonte, b.horizonte, k),
    sol: mezclarV3(a.sol, b.sol, k),
  };
}
