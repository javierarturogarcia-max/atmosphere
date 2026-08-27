import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen, estadoInicial } from '../src/core/estado.js';
import { misionesDiarias, misionesSemanales, misionTemporada, evaluarMision, claveSemana, misionesVigentes } from '../src/core/misiones.js';
import { evaluarLogros, proximosLogros, completitud } from '../src/core/logros.js';
import { construirResumen, serieDiaria, analizarSerie, compararPeriodos, recomendarPalanca } from '../src/core/analitica.js';
import { clasificacion, ligaDePuntos, progresoLiga, cohorteSimulada } from '../src/core/ranking.js';
import { generador, muestra, elegirPonderado } from '../src/core/rng.js';
import { LOGROS } from '../src/data/logros.js';
import { puedeCanjear, recompensa } from '../src/data/recompensas.js';

const perfil = 'perfil-de-prueba';

// -------------------------------------------------------------------- azar
test('el generador es determinista y esta bien distribuido', () => {
  const a = generador('semilla'), b = generador('semilla');
  const sa = Array.from({ length: 5 }, () => a());
  const sb = Array.from({ length: 5 }, () => b());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, Array.from({ length: 5 }, generador('otra')));

  const rnd = generador('uniformidad');
  const n = 20000;
  const valores = Array.from({ length: n }, () => rnd());
  const media = valores.reduce((s, v) => s + v, 0) / n;
  assert.ok(Math.abs(media - 0.5) < 0.01, `media=${media}`);
  assert.ok(valores.every((v) => v >= 0 && v < 1));
});

test('muestra no repite elementos y respeta el tamano', () => {
  const rnd = generador('m');
  const m = muestra(rnd, [1, 2, 3, 4, 5], 3);
  assert.equal(m.length, 3);
  assert.equal(new Set(m).size, 3);
  assert.equal(muestra(generador('x'), [1, 2], 10).length, 2);
});

test('la eleccion ponderada respeta los pesos', () => {
  const rnd = generador('pesos');
  let a = 0;
  for (let i = 0; i < 3000; i++) if (elegirPonderado(rnd, ['a', 'b'], [9, 1]) === 'a') a++;
  assert.ok(a / 3000 > 0.85 && a / 3000 < 0.95, `proporcion=${a / 3000}`);
});

// ---------------------------------------------------------------- misiones
test('las misiones diarias son deterministas y cambian cada dia', () => {
  const hoy = misionesDiarias(perfil, '2026-05-10');
  const otra = misionesDiarias(perfil, '2026-05-10');
  const manana = misionesDiarias(perfil, '2026-05-11');
  assert.equal(hoy.length, 3);
  assert.deepEqual(hoy, otra, 'mismo perfil y dia -> mismas misiones');
  assert.notDeepEqual(hoy.map((m) => m.titulo), manana.map((m) => m.titulo));
});

test('dos perfiles distintos reciben misiones distintas', () => {
  const a = misionesDiarias('perfil-a', '2026-05-10');
  const b = misionesDiarias('perfil-b', '2026-05-10');
  assert.notDeepEqual(a.map((m) => m.titulo), b.map((m) => m.titulo));
});

test('el reto escala con el nivel del jugador', () => {
  const novato = misionesDiarias(perfil, '2026-05-10', { nivel: 1 });
  const veterano = misionesDiarias(perfil, '2026-05-10', { nivel: 40 });
  const sumaN = novato.reduce((s, m) => s + m.objetivo.cantidad, 0);
  const sumaV = veterano.reduce((s, m) => s + m.objetivo.cantidad, 0);
  assert.ok(sumaV > sumaN, `veterano=${sumaV} novato=${sumaN}`);
});

test('la clave ISO de semana es correcta en los bordes de anio', () => {
  assert.equal(claveSemana(new Date('2026-01-01T12:00:00')), '2026-W01');
  assert.equal(claveSemana(new Date('2025-12-29T12:00:00')), '2026-W01', 'lunes de la W01 de 2026');
  assert.equal(claveSemana(new Date('2026-05-10T12:00:00')), '2026-W19');
});

test('las misiones semanales y de temporada cubren su ventana', () => {
  const f = new Date('2026-05-13T12:00:00'); // miercoles
  const [sem] = misionesSemanales(perfil, f);
  assert.equal(sem.desde.slice(0, 10), '2026-05-11', 'empieza el lunes');
  assert.equal(sem.hasta.slice(0, 10), '2026-05-17', 'termina el domingo');
  const mes = misionTemporada(perfil, f);
  assert.equal(mes.desde.slice(0, 10), '2026-05-01');
  assert.equal(mes.hasta.slice(0, 10), '2026-05-31');
  assert.equal(misionesVigentes(perfil, f).length, 6);
});

test('la evaluacion de misiones cuenta solo lo que cae en su ventana', () => {
  const mision = {
    id: 'm', objetivo: { tipo: 'accion', ref: 'mov_bici', cantidad: 10 },
    desde: '2026-05-10T00:00:00', hasta: '2026-05-10T23:59:59',
  };
  const registros = [
    { accionId: 'mov_bici', cantidad: 6, fecha: '2026-05-10T09:00:00', impacto: { co2e: 1 } },
    { accionId: 'mov_bici', cantidad: 6, fecha: '2026-05-11T09:00:00', impacto: { co2e: 1 } },
  ];
  const ev = evaluarMision(mision, registros);
  assert.equal(ev.actual, 6, 'el registro de otro dia no cuenta');
  assert.equal(ev.completada, false);
  assert.ok(Math.abs(ev.progreso - 0.6) < 1e-9);

  registros.push({ accionId: 'mov_bici', cantidad: 5, fecha: '2026-05-10T18:00:00', impacto: { co2e: 1 } });
  assert.equal(evaluarMision(mision, registros).completada, true);
});

test('las misiones de diversidad y dias activos usan conjuntos', () => {
  const registros = [
    { accionId: 'mov_bici', cantidad: 1, fecha: '2026-05-11T09:00:00', impacto: {} },
    { accionId: 'agu_ducha', cantidad: 1, fecha: '2026-05-11T10:00:00', impacto: {} },
    { accionId: 'agu_grifo', cantidad: 1, fecha: '2026-05-12T10:00:00', impacto: {} },
  ];
  const ventana = { desde: '2026-05-11T00:00:00', hasta: '2026-05-17T23:59:59' };
  assert.equal(evaluarMision({ ...ventana, objetivo: { tipo: 'diversidad', cantidad: 2 } }, registros).actual, 2);
  assert.equal(evaluarMision({ ...ventana, objetivo: { tipo: 'diasActivos', cantidad: 2 } }, registros).actual, 2);
  assert.equal(evaluarMision({ ...ventana, objetivo: { tipo: 'accionesDistintas', cantidad: 3 } }, registros).actual, 3);
});

// ----------------------------------------------------------------- logros
test('ningun logro lanza excepcion con un resumen vacio', () => {
  const vacio = construirResumen(estadoInicial());
  const ev = evaluarLogros(vacio, []);
  assert.equal(ev.estado.length, LOGROS.length);
  assert.equal(ev.nuevos.length, 0);
  assert.ok(ev.estado.every((e) => e.progreso >= 0 && e.progreso <= 1));
});

test('los logros se desbloquean una sola vez', () => {
  const resumen = { registros: 1, co2eTotal: 0, aguaTotal: 0 };
  const primera = evaluarLogros(resumen, []);
  assert.ok(primera.nuevos.some((l) => l.id === 'primer_paso'));
  const segunda = evaluarLogros(resumen, ['primer_paso']);
  assert.equal(segunda.nuevos.some((l) => l.id === 'primer_paso'), false);
  assert.ok(segunda.estado.find((l) => l.id === 'primer_paso').desbloqueado);
});

test('proximos logros y completitud son coherentes', () => {
  const ev = evaluarLogros({ registros: 7, co2eTotal: 60, nivel: 3 }, []);
  const proximos = proximosLogros(ev.estado, 3);
  assert.ok(proximos.length <= 3);
  assert.ok(proximos.every((p) => !p.desbloqueado && p.progreso > 0));
  assert.ok(proximos[0].progreso >= (proximos[1]?.progreso ?? 0), 'ordenados por cercania');
  const c = completitud(ev.estado);
  assert.ok(c >= 0 && c <= 100);
});

// ------------------------------------------------------------- integracion
test('flujo completo: registrar suma puntos, impacto, misiones y logros', () => {
  const st = crearAlmacen(estadoInicial('Tester', 'ES'));
  const r = st.registrar('mov_bici', 10);
  assert.equal(r.ok, true);
  assert.ok(r.puntos > 0);
  assert.equal(st.get().registros.length, 1);
  assert.equal(st.get().perfil.puntos, r.puntos + (r.misionesCompletadas.reduce((s, m) => s + m.recompensa.puntos, 0)));
  assert.ok(r.logrosNuevos.some((l) => l.id === 'primer_paso'), 'el primer registro da la primera insignia');
  assert.ok(st.get().perfil.xp > 0);
  const resumen = st.resumen();
  assert.equal(resumen.co2eTotal, 1.71);
  assert.equal(resumen.registros, 1);
});

test('el motor rechaza el registro fraudulento sin tocar el estado', () => {
  const st = crearAlmacen(estadoInicial('Tester', 'ES'));
  const r = st.registrar('mov_bici', -3);
  assert.equal(r.ok, false);
  assert.equal(st.get().registros.length, 0);
  assert.equal(st.get().perfil.puntos, 0);
});

test('el tope diario por accion se aplica en la transaccion real', () => {
  const st = crearAlmacen(estadoInicial('Tester', 'ES'));
  const r = st.registrar('mov_bici', 500); // maxDiario = 60
  assert.equal(r.ok, true);
  assert.equal(st.get().registros[0].cantidad, 60);
  assert.ok(r.mensajes.length > 0);
});

test('eliminar un registro revierte sus puntos', () => {
  const st = crearAlmacen(estadoInicial('Tester', 'ES'));
  const r = st.registrar('res_reciclar_aluminio', 2);
  const puntosAntes = st.get().perfil.puntos;
  st.eliminarRegistro(r.registro.id);
  assert.equal(st.get().registros.length, 0);
  assert.ok(st.get().perfil.puntos < puntosAntes);
});

test('el canje descuenta puntos y aplica el efecto', () => {
  const st = crearAlmacen(estadoInicial('Tester', 'ES'));
  st.actualizarPerfil({ puntos: 5000, xp: 20000 });
  const antes = st.get().perfil.congelaciones;
  const c = st.canjear('congelacion');
  assert.equal(c.ok, true);
  assert.equal(st.get().perfil.puntos, 5000 - recompensa('congelacion').coste);
  assert.equal(st.get().perfil.congelaciones, antes + 1);

  st.actualizarPerfil({ puntos: 0 });
  assert.equal(st.canjear('arbol_real').ok, false, 'sin puntos no hay canje');
});

test('puedeCanjear valida nivel, puntos y stock', () => {
  const rec = recompensa('arbol_real');
  assert.equal(puedeCanjear(rec, { puntos: 100, nivel: 10 }).ok, false);
  assert.equal(puedeCanjear(rec, { puntos: 5000, nivel: 1 }).ok, false);
  assert.equal(puedeCanjear(rec, { puntos: 5000, nivel: 10 }).ok, true);
  const limitado = recompensa('analitica_pro');
  assert.equal(puedeCanjear(limitado, { puntos: 9999, nivel: 20, canjesPrevios: [{ recompensaId: 'analitica_pro' }] }).ok, false);
});

test('exportar e importar conserva el estado integro', () => {
  const st = crearAlmacen(estadoInicial('Tester', 'ES'));
  st.registrar('mov_bici', 5);
  st.registrar('res_compostar', 2);
  const json = st.exportar();
  const st2 = crearAlmacen(estadoInicial('Otro', 'MX'));
  const res = st2.importar(json);
  assert.equal(res.ok, true);
  assert.equal(st2.get().perfil.nombre, 'Tester');
  assert.equal(st2.get().registros.length, 2);
  assert.equal(st2.resumen().co2eTotal, st.resumen().co2eTotal);
  assert.equal(st2.importar('{no es json').ok, false);
  assert.equal(st2.importar('{"a":1}').ok, false);
});

test('los suscriptores reciben los eventos del almacen', () => {
  const st = crearAlmacen(estadoInicial('Tester', 'ES'));
  const eventos = [];
  const baja = st.suscribir((_, ev) => eventos.push(ev.tipo));
  st.registrar('mov_bici', 3);
  st.actualizarPerfil({ nombre: 'X' });
  baja();
  st.registrar('mov_caminar', 1);
  assert.deepEqual(eventos, ['registro', 'perfil']);
});

// ----------------------------------------------------------------- analitica
test('la serie diaria rellena los huecos con cero', () => {
  const registros = [{ accionId: 'mov_bici', cantidad: 5, fecha: '2026-05-10T10:00:00', impacto: { co2e: 0.855 }, puntos: 9 }];
  const serie = serieDiaria(registros, 'co2e', 7, '2026-05-10');
  assert.equal(serie.length, 7);
  assert.equal(serie[6].valor, 0.855);
  assert.equal(serie[0].valor, 0);
});

test('el analisis de serie detecta una tendencia creciente real', () => {
  const serie = Array.from({ length: 20 }, (_, i) => ({ dia: `d${i}`, valor: i * 0.5 }));
  const a = analizarSerie(serie);
  assert.equal(a.tendencia.direccion, 'al alza');
  assert.equal(a.tendencia.significativa, true);
  assert.ok(a.tendencia.r2 > 0.99);
  assert.ok(a.proyeccion.porMedia > 0);
});

test('la comparativa entre periodos detecta mejora y empeoramiento', () => {
  const registros = [];
  for (let i = 0; i < 7; i++) registros.push({ accionId: 'mov_bici', cantidad: 1, fecha: `2026-05-0${i + 1}T10:00:00`, impacto: { co2e: 1 }, puntos: 5 });
  for (let i = 0; i < 7; i++) registros.push({ accionId: 'mov_bici', cantidad: 1, fecha: `2026-05-${String(i + 8).padStart(2, '0')}T10:00:00`, impacto: { co2e: 3 }, puntos: 5 });
  const c = compararPeriodos(registros, 'co2e', 7, '2026-05-14');
  assert.ok(c.actual > c.previa);
  assert.equal(c.mejora, true);
});

test('la recomendacion senala una categoria sin explotar', () => {
  const st = crearAlmacen(estadoInicial('Tester', 'ES'));
  st.registrar('mov_bici', 10);
  const rec = recomendarPalanca(st.resumen());
  assert.ok(rec.cat && rec.cat !== 'movilidad');
  assert.ok(rec.motivo.length > 10);
});

// ------------------------------------------------------------------ ranking
test('la cohorte simulada es reproducible y tiene forma log-normal', () => {
  const a = cohorteSimulada('liga-x', 30, 1000);
  const b = cohorteSimulada('liga-x', 30, 1000);
  assert.deepEqual(a, b);
  assert.equal(a.length, 30);
  const puntos = a.map((c) => c.puntos).sort((x, y) => x - y);
  const mediana = puntos[15];
  assert.ok(puntos[29] > mediana * 2, 'cola larga a la derecha, como en la realidad');
  assert.ok(puntos.every((p) => p >= 0));
});

test('la clasificacion situa al usuario y calcula lo que falta para subir', () => {
  const c = clasificacion({ nombre: 'Yo', puntos: 100000, xp: 50000, co2e: 500 }, { semilla: 'l', n: 20, escala: 500 });
  assert.equal(c.posicion, 1, 'con muchos puntos debe ir primero');
  assert.equal(c.faltanParaSubir, 0);
  assert.equal(c.percentil, 100);

  const ultimo = clasificacion({ nombre: 'Yo', puntos: 0, xp: 0, co2e: 0 }, { semilla: 'l', n: 20, escala: 500 });
  assert.equal(ultimo.posicion, 21);
  assert.ok(ultimo.faltanParaSubir > 0);
  assert.equal(ultimo.tabla.filter((p) => p.esUsuario).length, 1);
});

test('las ligas progresan por umbrales de puntos', () => {
  assert.equal(ligaDePuntos(0).id, 'musgo');
  assert.equal(ligaDePuntos(4000).id, 'bambu');
  assert.equal(ligaDePuntos(999999).id, 'amazonia');
  const p = progresoLiga(2000);
  assert.equal(p.siguiente.id, 'bambu');
  assert.ok(p.progreso > 0 && p.progreso < 1);
  assert.equal(progresoLiga(99999).siguiente, null);
});

// ------------------------------------------- regresiones corregidas en revision
test('la proyeccion se declara no fiable con pocos dias activos', () => {
  // Un unico pico en 30 dias: OLS extrapolaria una cifra absurda.
  const serie = Array.from({ length: 30 }, (_, i) => ({ dia: `d${i}`, valor: i === 29 ? 169 : 0 }));
  const a = analizarSerie(serie, { horizonte: 30 });
  assert.equal(a.proyeccion.fiable, false);
  assert.ok(a.proyeccion.motivo.length > 0);
  assert.ok(a.proyeccion.porTendencia < 10000, `proyeccion desbocada: ${a.proyeccion.porTendencia}`);
  assert.equal(a.tendencia.significativa, false, 'un solo pico no es tendencia');
});

test('la proyeccion se marca fiable con una serie sostenida', () => {
  const serie = Array.from({ length: 30 }, (_, i) => ({ dia: `d${i}`, valor: 2 + i * 0.1 }));
  const a = analizarSerie(serie, { horizonte: 30 });
  assert.equal(a.proyeccion.fiable, true);
  assert.equal(a.proyeccion.motivo, '');
  assert.ok(a.proyeccion.porTendencia > 0);
});

test('sin periodo previo no se inventa una variacion porcentual', () => {
  const registros = [{ accionId: 'mov_bici', cantidad: 5, fecha: '2026-05-14T10:00:00', impacto: { co2e: 10 }, puntos: 5 }];
  const c = compararPeriodos(registros, 'co2e', 7, '2026-05-14');
  assert.equal(c.previa, 0);
  assert.equal(c.sinBase, true);
  assert.equal(c.variacion, 0, 'no puede haber +100 % sobre una base inexistente');
});

test('las tres misiones diarias piden cosas distintas', () => {
  // Se comprueban muchos dias: la duplicacion aparecia solo en algunas semillas.
  for (let d = 1; d <= 60; d++) {
    const dia = `2026-05-${String((d % 28) + 1).padStart(2, '0')}`;
    const ms = misionesDiarias(`perfil-${d}`, dia, { nivel: 1 + (d % 30) });
    const firmas = ms.map((m) => `${m.objetivo.tipo}:${m.objetivo.ref ?? ''}`);
    assert.equal(new Set(firmas).size, firmas.length,
      `misiones duplicadas en ${dia} para perfil-${d}: ${firmas.join(' | ')}`);
  }
});
