import test from 'node:test';
import assert from 'node:assert/strict';
import {
  media, mediana, desviacion, percentil, rangoPercentil, regresionLineal, theilSen,
  mannKendall, normalAcumulada, shannon, pielou, gini, zRobusta, mediaMovil, ewma,
  propagarIncertidumbre, bootstrapIC, pearson, atipicos,
} from '../src/core/estadistica.js';
import { generador } from '../src/core/rng.js';

test('descriptivos basicos', () => {
  assert.equal(media([1, 2, 3, 4]), 2.5);
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([4, 1, 2, 3]), 2.5);
  assert.ok(Math.abs(desviacion([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 0.01);
  assert.equal(media([]), 0);
});

test('percentil sigue el metodo R-7 (igual que NumPy)', () => {
  const xs = [1, 2, 3, 4, 5];
  assert.equal(percentil(xs, 0.5), 3);
  assert.equal(percentil(xs, 0.25), 2);
  assert.equal(percentil(xs, 0), 1);
  assert.equal(percentil(xs, 1), 5);
});

test('rango percentil situa correctamente al usuario', () => {
  const cohorte = [10, 20, 30, 40, 50];
  assert.equal(rangoPercentil(cohorte, 60), 100);
  assert.equal(rangoPercentil(cohorte, 5), 0);
  assert.equal(rangoPercentil(cohorte, 30), 50);
});

test('regresion lineal recupera una recta exacta', () => {
  const ys = [2, 4, 6, 8, 10]; // y = 2 + 2x
  const r = regresionLineal(ys);
  assert.ok(Math.abs(r.pendiente - 2) < 1e-9);
  assert.ok(Math.abs(r.intercepto - 2) < 1e-9);
  assert.ok(Math.abs(r.r2 - 1) < 1e-9);
  assert.equal(r.predecir(5), 12);
});

test('Theil-Sen resiste un atipico que descoloca a OLS', () => {
  const limpio = [1, 2, 3, 4, 5, 6, 7, 8];
  const sucio = [...limpio];
  sucio[7] = 200; // valor absurdo
  assert.equal(theilSen(limpio), 1);
  assert.equal(theilSen(sucio), 1, 'Theil-Sen mantiene la pendiente real');
  assert.ok(regresionLineal(sucio).pendiente > 10, 'OLS se dispara con el atipico');
});

test('Mann-Kendall detecta tendencia creciente significativa', () => {
  const creciente = Array.from({ length: 20 }, (_, i) => i + 1);
  const mk = mannKendall(creciente);
  assert.ok(mk.S > 0);
  assert.ok(mk.p < 0.001, `p=${mk.p}`);
  assert.equal(mk.tendencia, 'creciente significativa');
  assert.ok(Math.abs(mk.tau - 1) < 1e-9);
});

test('Mann-Kendall no ve tendencia donde no la hay', () => {
  const plana = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
  const mk = mannKendall(plana);
  assert.equal(mk.S, 0);
  assert.ok(mk.p > 0.5);
});

test('normal acumulada coincide con valores tabulados', () => {
  assert.ok(Math.abs(normalAcumulada(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalAcumulada(1.96) - 0.975) < 1e-3);
  assert.ok(Math.abs(normalAcumulada(-1.645) - 0.05) < 1e-3);
});

test('indices de diversidad se comportan como deben', () => {
  assert.equal(shannon([10, 0, 0, 0]), 0, 'una sola categoria: diversidad nula');
  assert.ok(Math.abs(shannon([5, 5]) - Math.log(2)) < 1e-9);
  assert.ok(Math.abs(pielou([5, 5, 5, 5]) - 1) < 1e-9, 'reparto perfecto: equidad 1');
  assert.ok(pielou([100, 1, 1, 1]) < 0.5);
});

test('Gini distingue igualdad de concentracion', () => {
  assert.ok(Math.abs(gini([10, 10, 10, 10])) < 1e-9);
  assert.ok(gini([0, 0, 0, 100]) > 0.7);
});

test('z robusta detecta el atipico que la z clasica diluye', () => {
  const historial = [10, 11, 9, 10, 12, 11, 10];
  assert.ok(Math.abs(zRobusta(300, historial)) > 3.5);
  assert.ok(Math.abs(zRobusta(11, historial)) < 2);
});

test('suavizados conservan longitud y reducen varianza', () => {
  const xs = [10, 0, 10, 0, 10, 0, 10, 0];
  const mm = mediaMovil(xs, 4);
  const ew = ewma(xs, 0.3);
  assert.equal(mm.length, xs.length);
  assert.equal(ew.length, xs.length);
  assert.ok(desviacion(mm.slice(4)) < desviacion(xs));
});

test('propagacion de incertidumbre da un IC coherente', () => {
  const r = propagarIncertidumbre([
    { valor: 100, inc: 0.3 },
    { valor: 100, inc: 0.3 },
  ]);
  assert.equal(r.valor, 200);
  // sqrt(30^2+30^2) = 42.4 -> menor que la suma lineal de 60: la clave del metodo
  assert.ok(Math.abs(r.sigma - 42.43) < 0.1);
  assert.ok(r.inferior > 0 && r.superior > r.valor);
});

test('bootstrap es reproducible con semilla y cubre la media', () => {
  const rnd = generador('test-bootstrap');
  const xs = [4, 5, 6, 5, 4, 6, 5, 5, 4, 6];
  const ic = bootstrapIC(xs, media, 500, 0.95, rnd);
  assert.ok(ic.inferior <= ic.estimacion && ic.estimacion <= ic.superior);
  const rnd2 = generador('test-bootstrap');
  const ic2 = bootstrapIC(xs, media, 500, 0.95, rnd2);
  assert.deepEqual(ic, ic2, 'misma semilla, mismo resultado');
});

test('pearson y atipicos', () => {
  assert.ok(Math.abs(pearson([1, 2, 3], [2, 4, 6]) - 1) < 1e-9);
  assert.ok(Math.abs(pearson([1, 2, 3], [6, 4, 2]) + 1) < 1e-9);
  assert.deepEqual(atipicos([1, 2, 2, 3, 2, 100]), [100]);
});
