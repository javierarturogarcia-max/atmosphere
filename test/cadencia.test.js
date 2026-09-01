/**
 * Pruebas del analisis de movimiento con senales sinteticas de cadencia y
 * amplitud conocidas: si la clasificacion se rompe, se ve aqui y no en la
 * calle con el telefono en la mano.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  modulos, intensidad, picos, regularidad, analizarMovimiento, contrastar,
  REFRACTARIO_MS, MUESTRAS_MINIMAS,
} from '../src/core/cadencia.js';

/**
 * Genera muestras de un paso periodico.
 * @param {number} spm pasos por minuto
 * @param {number} amplitud m/s2 de oscilacion
 * @param {number} seg duracion
 * @param {number} jitter desorden del ritmo (0 = metronomo)
 */
function marcha(spm, amplitud, seg = 10, jitter = 0, hz = 50) {
  const n = Math.round(seg * hz);
  const f = spm / 60;
  const out = [];
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = (i / hz) * 1000;
    const paso = Math.sin(2 * Math.PI * fase);
    fase += (f / hz) * (1 + (jitter ? (Math.sin(i * 1.7) * jitter) : 0));
    // Gravedad en z mas la oscilacion: es lo que entrega el sensor real.
    out.push({ x: amplitud * paso * 0.4, y: amplitud * paso * 0.3, z: 9.81 + amplitud * paso, t });
  }
  return out;
}

test('el modulo ignora muestras invalidas en vez de propagar NaN', () => {
  const m = modulos([{ x: 3, y: 4, z: 0 }, { x: NaN, y: 1, z: 1 }, null, { x: 0, y: 0, z: 2 }]);
  assert.deepEqual(m, [5, 2]);
});

test('la intensidad mide la oscilacion, no la gravedad', () => {
  // Telefono quieto: el modulo es ~9,81 constante. Si no se restara la media,
  // la intensidad saldria ~9,81 y un movil en la mesa pareceria una maraton.
  const quieto = modulos(marcha(0, 0, 6));
  assert.ok(intensidad(quieto) < 0.05, `quieto dio ${intensidad(quieto)}`);
  const corriendo = modulos(marcha(170, 6, 6));
  assert.ok(intensidad(corriendo) > 3, `corriendo dio ${intensidad(corriendo)}`);
});

test('el periodo refractario evita contar un paso varias veces', () => {
  const m = marcha(120, 3, 10);
  const p = picos(modulos(m), m.map((x) => x.t));
  for (let i = 1; i < p.length; i++) {
    assert.ok(p[i] - p[i - 1] >= REFRACTARIO_MS, `dos picos a ${p[i] - p[i - 1]} ms`);
  }
});

test('distingue quieto, caminando y corriendo', () => {
  assert.equal(analizarMovimiento(marcha(0, 0, 10)).regimen, 'reposo');

  const anda = analizarMovimiento(marcha(110, 2.5, 10));
  assert.equal(anda.regimen, 'caminando', `cadencia medida ${anda.cadencia}`);
  assert.ok(Math.abs(anda.cadencia - 110) < 12, `midio ${anda.cadencia} spm en vez de ~110`);

  const corre = analizarMovimiento(marcha(170, 7, 10));
  assert.equal(corre.regimen, 'corriendo', `cadencia medida ${corre.cadencia}`);
  assert.ok(Math.abs(corre.cadencia - 170) < 15, `midio ${corre.cadencia} spm en vez de ~170`);
});

test('la zona de solape se declara, no se adivina', () => {
  // Marcha muy rapida y trote lento se parecen de verdad. Inventar un veredicto
  // ahi seria el error facil: se prefiere decir que no esta claro.
  const limite = analizarMovimiento(marcha(140, 4.5, 10));
  assert.equal(limite.regimen, 'indeterminado', `midio ${limite.cadencia} spm`);
  assert.match(limite.motivo, /entre marcha rapida y trote/);
});

test('una ventana demasiado corta no produce veredicto', () => {
  const corto = analizarMovimiento(marcha(120, 3, 1));
  assert.equal(corto.regimen, 'desconocido');
  assert.equal(corto.confianza, 0);
  assert.match(corto.motivo, /pocas muestras/);
  // Y el umbral es el declarado, no uno accidental.
  assert.ok(marcha(120, 3, 1).length < MUESTRAS_MINIMAS);
});

test('el paso regular da mas confianza que el caotico', () => {
  const metronomo = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500];
  const caotico   = [0, 380, 1010, 1240, 1980, 2130, 2900, 3510];
  assert.ok(regularidad(metronomo) > 0.95, `metronomo dio ${regularidad(metronomo)}`);
  assert.ok(regularidad(caotico) < 0.75, `caotico dio ${regularidad(caotico)}`);
  assert.ok(regularidad(metronomo) > regularidad(caotico));
});

test('un movimiento con cadencia de marcha pero intensidad absurda baja la confianza', () => {
  // Agitar el telefono en la mano puede imitar la cadencia; lo que no imita es
  // el perfil de intensidad. No descalifica —el telefono puede ir en cualquier
  // sitio— pero si rebaja lo que se afirma.
  const normal = analizarMovimiento(marcha(110, 2.5, 10));
  const brusco = analizarMovimiento(marcha(110, 22, 10));
  assert.equal(normal.regimen, 'caminando');
  assert.equal(brusco.regimen, 'caminando', 'la intensidad no veta la clasificacion');
  assert.ok(brusco.confianza < normal.confianza,
    `brusco ${brusco.confianza} deberia ser menor que ${normal.confianza}`);
});

test('sin picos suficientes la regularidad es cero, no un NaN', () => {
  assert.equal(regularidad([]), 0);
  assert.equal(regularidad([100, 200]), 0);
  assert.ok(Number.isFinite(regularidad([0, 500, 1000, 1500, 2000])));
});

test('el contraste confirma pero nunca descalifica', () => {
  const corre = analizarMovimiento(marcha(170, 7, 10));
  assert.equal(contrastar('corriendo', corre).veredicto, 'confirma');

  // Reciclar de pie y quieto no es sospechoso: el sensor no aplica.
  assert.equal(contrastar(null, corre).veredicto, 'no_aplica');

  // Sensor bloqueado por el navegador: la prueba sigue valiendo.
  const sin = contrastar('corriendo', analizarMovimiento([]));
  assert.equal(sin.veredicto, 'sin_datos');
  assert.match(sin.texto, /vale igual/);

  // Y la discrepancia se informa, sin veredicto de fraude.
  const discrepa = contrastar('corriendo', analizarMovimiento(marcha(105, 2.2, 10)));
  assert.equal(discrepa.veredicto, 'discrepa');
  assert.match(discrepa.texto, /sensor midio/);
});
