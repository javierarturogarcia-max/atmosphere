import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularImpacto, agregarImpacto, equivalencias } from '../src/core/impacto.js';
import { calcularPuntos, saturar, factorRacha, factorDificultad, TOPE_DIARIO, K_SATURACION } from '../src/core/puntos.js';
import { validarRegistro, NIVELES, indiceConfianza } from '../src/core/validacion.js';
import { xpParaNivel, nivelDesdeXP, progresion, rangoDeNivel, detectarAscenso } from '../src/core/nivel.js';
import { calcularRacha, claveDia, sumarDias, mejorRacha, congelacionesGanadas } from '../src/core/rachas.js';
import { intensidadRed } from '../src/data/paises.js';

// ------------------------------------------------------------------- impacto
test('el impacto de la bici es la emision del coche evitada', () => {
  const i = calcularImpacto('mov_bici', 10);
  assert.equal(i.co2e, 1.71, '10 km x 0,171 kg CO2e/km');
  assert.equal(i.agua, 0);
});

test('las acciones electricas dependen del mix del pais', () => {
  const enFrancia = calcularImpacto('ene_led', 1, { pais: 'FR' });   // red muy limpia
  const enPolonia = calcularImpacto('ene_led', 1, { pais: 'PL' });   // red de carbon
  assert.ok(enPolonia.co2e > enFrancia.co2e * 10,
    `PL=${enPolonia.co2e} debe superar ampliamente a FR=${enFrancia.co2e}`);
  assert.equal(enFrancia.co2e, Math.round(51 * intensidadRed('FR') * 10000) / 10000);
});

test('cantidades no validas devuelven impacto cero sin lanzar', () => {
  assert.equal(calcularImpacto('mov_bici', -5).co2e, 0);
  assert.equal(calcularImpacto('mov_bici', 0).co2e, 0);
  assert.throws(() => calcularImpacto('no_existe', 1));
});

test('la agregacion propaga incertidumbre en vez de sumarla linealmente', () => {
  const registros = [
    { accionId: 'mov_bici', impacto: calcularImpacto('mov_bici', 10) },
    { accionId: 'mov_bici', impacto: calcularImpacto('mov_bici', 10) },
  ];
  const a = agregarImpacto(registros);
  assert.equal(a.co2e, 3.42);
  assert.ok(a.co2eIC.inferior < a.co2e && a.co2eIC.superior > a.co2e);
  assert.ok(a.co2eIC.incRelativa < 0.30, 'la incertidumbre relativa baja al agregar');
});

test('las equivalencias son coherentes entre si', () => {
  const e = equivalencias(21.77);
  assert.equal(e.arbolesAnio, 1, '21,77 kg = un arbol-anio');
  assert.ok(e.kmCoche > 120 && e.kmCoche < 130);
});

// -------------------------------------------------------------------- puntos
test('mas impacto produce mas puntos (monotonia)', () => {
  const p1 = calcularPuntos({ accionId: 'mov_bici', impacto: { co2e: 1, agua: 0, residuo: 0 } }).puntos;
  const p2 = calcularPuntos({ accionId: 'mov_bici', impacto: { co2e: 5, agua: 0, residuo: 0 } }).puntos;
  assert.ok(p2 > p1);
});

test('la saturacion aplica rendimientos decrecientes', () => {
  const impacto = { co2e: 5, agua: 0, residuo: 0 };
  const fresco = calcularPuntos({ accionId: 'mov_bici', impacto, acumuladoCategoriaHoy: 0 }).puntos;
  const saturado = calcularPuntos({ accionId: 'mov_bici', impacto, acumuladoCategoriaHoy: 1200 }).puntos;
  assert.ok(saturado < fresco / 3, `farmear debe rendir mucho menos: ${saturado} vs ${fresco}`);
  assert.equal(saturar(0), 0);
  assert.ok(saturar(K_SATURACION) < K_SATURACION, 'la funcion es concava');
});

test('el tope diario es infranqueable', () => {
  const r = calcularPuntos({
    accionId: 'bio_plantar_arbol',
    impacto: { co2e: 10000, agua: 0, residuo: 0 },
    acumuladoDiaHoy: TOPE_DIARIO - 10,
  });
  assert.ok(r.puntos <= 10);
  assert.equal(r.desglose.topadoPorLimiteDiario, true);
});

test('los multiplicadores conductuales tienen los limites documentados', () => {
  assert.equal(factorRacha(0), 1);
  assert.equal(factorRacha(25), 1.5);
  assert.equal(factorRacha(1000), 1.5, 'la racha satura en +50 %');
  assert.equal(factorDificultad(1), 1);
  assert.ok(Math.abs(factorDificultad(5) - 1.48) < 1e-9);
});

test('las acciones sin CO2e reciben el suelo minimo de puntos', () => {
  const r = calcularPuntos({ accionId: 'com_ciencia_ciudadana', impacto: { co2e: 0, agua: 0, residuo: 0 } });
  assert.ok(r.puntos > 0, 'ciencia ciudadana debe puntuar aunque no evite CO2e');
});

// ---------------------------------------------------------------- validacion
test('bloquea cantidades imposibles y ajusta las excesivas', () => {
  const nula = validarRegistro({ accionId: 'mov_bici', cantidad: 0 }, []);
  assert.equal(nula.nivel, NIVELES.BLOQUEO);

  const excesiva = validarRegistro({ accionId: 'mov_bici', cantidad: 500 }, []);
  assert.equal(excesiva.nivel, NIVELES.AVISO);
  assert.equal(excesiva.cantidadAjustada, 60, 'se recorta al maximo diario plausible');
});

test('respeta el tiempo de espera entre registros identicos', () => {
  const ahora = new Date('2026-05-10T10:00:00');
  const previos = [{ accionId: 'mov_bici', cantidad: 5, fecha: new Date('2026-05-10T09:50:00').toISOString() }];
  const r = validarRegistro({ accionId: 'mov_bici', cantidad: 5, fecha: ahora }, previos);
  assert.equal(r.nivel, NIVELES.BLOQUEO);
  assert.match(r.mensajes[0], /Espera/);
});

test('marca como sospechoso un valor muy atipico frente al historial', () => {
  const base = new Date('2026-05-10T12:00:00');
  const previos = Array.from({ length: 8 }, (_, i) => ({
    accionId: 'res_reciclar_papel', cantidad: 1,
    fecha: new Date(2026, 4, i + 1, 10).toISOString(),
  }));
  const r = validarRegistro({ accionId: 'res_reciclar_papel', cantidad: 19, fecha: base }, previos);
  assert.ok(r.sospecha > 0, 'debe levantar sospecha');
  assert.equal(r.nivel, NIVELES.AVISO);
});

test('bloquea un dia con mas de 24 h de actividad declarada', () => {
  // Ninguna accion supera su propio tope, pero la suma temporal es imposible:
  // 25 km andando (300 min) + 60 km en bici (240 min) + 8 h de voluntariado (480 min)
  // = 1.020 min; anadir 8 h de streaming (480 min) llevaria el dia a 1.500 min.
  const previos = [
    { accionId: 'mov_caminar', cantidad: 25, fecha: new Date('2026-05-10T08:00:00').toISOString() },
    { accionId: 'mov_bici', cantidad: 60, fecha: new Date('2026-05-10T10:00:00').toISOString() },
    { accionId: 'com_voluntariado', cantidad: 8, fecha: new Date('2026-05-10T12:00:00').toISOString() },
  ];
  const r = validarRegistro(
    { accionId: 'con_streaming', cantidad: 8, fecha: new Date('2026-05-10T20:00:00') }, previos);
  assert.equal(r.nivel, NIVELES.BLOQUEO);
  assert.match(r.mensajes[0], /24 horas/);
});

test('el indice de confianza premia evidencia y diversidad', () => {
  const pobre = indiceConfianza([{ accionId: 'mov_bici', fecha: new Date().toISOString(), sospecha: 0.9 }]);
  const bueno = indiceConfianza(Array.from({ length: 40 }, (_, i) => ({
    accionId: ['mov_bici', 'res_compostar', 'agu_ducha', 'ali_sin_carne', 'bio_planta_nativa'][i % 5],
    fecha: new Date(2026, 3, (i % 28) + 1).toISOString(),
    evidencia: 'foto', sospecha: 0,
  })));
  assert.ok(bueno.valor > pobre.valor);
  assert.ok(bueno.valor > 0.75, `confianza=${bueno.valor}`);
});

// ------------------------------------------------------------------- niveles
test('la curva de nivel es consistente en ambos sentidos', () => {
  for (const n of [1, 2, 5, 10, 25, 50, 100]) {
    const xp = xpParaNivel(n);
    assert.equal(nivelDesdeXP(xp), n, `nivel ${n} <-> xp ${xp}`);
    assert.equal(nivelDesdeXP(xp - 1), Math.max(1, n - 1));
  }
});

test('la progresion nunca sale del rango 0..1', () => {
  for (const xp of [0, 1, 79, 80, 5000, 999999]) {
    const p = progresion(xp);
    assert.ok(p.progreso >= 0 && p.progreso <= 1, `xp=${xp} progreso=${p.progreso}`);
    assert.ok(p.nivel >= 1);
  }
});

test('los rangos avanzan con el nivel', () => {
  assert.equal(rangoDeNivel(1).nombre, 'Semilla');
  assert.equal(rangoDeNivel(100).nombre, 'Guardian del planeta');
  const a = detectarAscenso(0, xpParaNivel(10));
  assert.equal(a.subioNivel, true);
  assert.equal(a.nivelNuevo, 10);
});

// -------------------------------------------------------------------- rachas
test('la racha cuenta dias consecutivos hasta hoy', () => {
  const hoy = '2026-05-10';
  const dias = ['2026-05-08', '2026-05-09', '2026-05-10'];
  assert.equal(calcularRacha(dias, hoy).actual, 3);
});

test('un hueco rompe la racha salvo que haya congelacion', () => {
  const hoy = '2026-05-10';
  const dias = ['2026-05-06', '2026-05-07', '2026-05-09', '2026-05-10'];
  assert.equal(calcularRacha(dias, hoy, 0).actual, 2, 'sin proteccion se corta en el hueco');
  const conProteccion = calcularRacha(dias, hoy, 1);
  assert.equal(conProteccion.actual, 4);
  assert.equal(conProteccion.usadasCongelaciones, 1);
});

test('si hoy no hay actividad la racha sigue viva pero en riesgo', () => {
  const hoy = '2026-05-10';
  const r = calcularRacha(['2026-05-08', '2026-05-09'], hoy);
  assert.equal(r.actual, 2);
  assert.equal(r.enRiesgo, true);
});

test('mejor racha historica y congelaciones ganadas', () => {
  assert.equal(mejorRacha(['2026-01-01', '2026-01-02', '2026-01-03', '2026-02-01']), 3);
  assert.equal(congelacionesGanadas(14, 0), 2);
  assert.equal(congelacionesGanadas(70, 3), 0, 'tope de 3 acumuladas');
});

test('claveDia usa hora local sin desplazamiento UTC', () => {
  const d = new Date(2026, 0, 1, 23, 30);
  assert.equal(claveDia(d), '2026-01-01');
  assert.equal(sumarDias('2026-02-28', 1), '2026-03-01');
  assert.equal(sumarDias('2028-02-28', 1), '2028-02-29', 'anio bisiesto');
});
