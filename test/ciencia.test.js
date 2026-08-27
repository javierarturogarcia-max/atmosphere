import test from 'node:test';
import assert from 'node:assert/strict';
import { aqiContaminante, calcularAQI, categoriaAQI, riesgoPM25, excesosOMS, GUIA_OMS } from '../src/core/aire.js';
import { calcularHuella, escenarios, entradasPorDefecto } from '../src/core/huella.js';
import { OBJETIVO_2030_TCO2E } from '../src/data/paises.js';
import { factorMovilidad, RFI_AVIACION, MOVILIDAD, ALIMENTOS } from '../src/data/factores.js';

// ------------------------------------------------------------- calidad del aire
test('los puntos de corte del AQI de la EPA salen exactos', () => {
  assert.equal(aqiContaminante('pm25', 9.0), 50, 'limite Buena/Moderada (revision 2024)');
  assert.equal(aqiContaminante('pm25', 35.4), 100);
  assert.equal(aqiContaminante('pm25', 55.4), 150);
  assert.equal(aqiContaminante('pm10', 154), 100);
  assert.equal(aqiContaminante('o3', 70), 100);
  assert.equal(aqiContaminante('co', 9.4), 100);
});

test('la interpolacion intermedia del AQI es lineal', () => {
  // 12 ug/m3 en el tramo [9.1, 35.4] -> [51, 100]
  const esperado = Math.round(((100 - 51) / (35.4 - 9.1)) * (12 - 9.1) + 51);
  assert.equal(aqiContaminante('pm25', 12), esperado);
  assert.equal(esperado, 56);
});

test('el AQI global toma el maximo subindice e identifica al dominante', () => {
  const r = calcularAQI({ pm25: 12, pm10: 40, o3: 30, no2: 20 });
  assert.equal(r.aqi, 56);
  assert.equal(r.dominante, 'pm25');
  assert.equal(r.categoria, 'Moderada');
  assert.equal(r.subindices.length, 4);
});

test('el AQI ignora lecturas vacias y devuelve null sin datos', () => {
  assert.equal(calcularAQI({}), null);
  assert.equal(calcularAQI({ pm25: '', pm10: null }), null);
  const r = calcularAQI({ pm25: 5, pm10: '' });
  assert.equal(r.subindices.length, 1);
});

test('las categorias cubren todo el rango sin huecos', () => {
  for (const v of [0, 50, 51, 100, 101, 150, 200, 300, 500]) {
    assert.ok(categoriaAQI(v).nombre, `sin categoria para AQI ${v}`);
  }
  assert.equal(categoriaAQI(0).nombre, 'Buena');
  assert.equal(categoriaAQI(450).nombre, 'Peligrosa');
});

test('el riesgo por PM2,5 sigue el modelo log-lineal del GBD', () => {
  const limpio = riesgoPM25(5);
  assert.equal(limpio.riesgoRelativo, 1, 'en el contrafactual no hay exceso');
  assert.equal(limpio.anosVidaPerdidos, 0);

  const sucio = riesgoPM25(35);
  // RR = exp(0.0059 * 30) = 1.1935 -> ~19,4 % de exceso
  assert.ok(Math.abs(sucio.excesoMortalidadPct - 19.4) < 0.2, `exceso=${sucio.excesoMortalidadPct}`);
  assert.ok(sucio.anosVidaPerdidos > 2.5 && sucio.anosVidaPerdidos < 3.2);
  assert.equal(sucio.vecesGuiaOMS, 7);
});

test('el cotejo con la guia OMS 2021 marca los excesos', () => {
  const ex = excesosOMS({ pm25: 30, pm10: 20 });
  const pm25 = ex.find((e) => e.contaminante === 'pm25');
  assert.equal(pm25.supera, true);
  assert.equal(pm25.guia, GUIA_OMS.pm25.dia);
  assert.equal(ex.find((e) => e.contaminante === 'pm10').supera, false);
});

// --------------------------------------------------------------------- huella
test('la huella por defecto cae en un rango plausible', () => {
  const h = calcularHuella(entradasPorDefecto('ES'));
  assert.ok(h.totalToneladas > 3 && h.totalToneladas < 20, `t=${h.totalToneladas}`);
  assert.equal(h.categorias.reduce((s, c) => s + c.pct, 0) > 99.4, true, 'los porcentajes suman ~100');
  assert.ok(h.categorias[0].kg >= h.categorias[1].kg, 'ordenada de mayor a menor');
});

test('la red electrica del pais cambia el resultado en la direccion correcta', () => {
  const base = { ...entradasPorDefecto(), electricidadKwhMes: 500, personasHogar: 1 };
  const noruega = calcularHuella({ ...base, pais: 'NO' });
  const polonia = calcularHuella({ ...base, pais: 'PL' });
  assert.ok(polonia.totalToneladas > noruega.totalToneladas + 3,
    `PL=${polonia.totalToneladas} vs NO=${noruega.totalToneladas}`);
});

test('la aviacion aplica el forzamiento radiativo no-CO2', () => {
  const conVuelo = calcularHuella({ ...entradasPorDefecto(), vuelosLargosAnio: 1, vuelosCortosAnio: 0 });
  const aviacion = conVuelo.categorias.find((c) => c.id === 'aviacion');
  // 7.000 km x 0,150 kg/pkm x RFI 1,9 = 1.995 kg CO2e
  const esperado = 7000 * MOVILIDAD.avion_largo.co2e * RFI_AVIACION;
  assert.ok(Math.abs(aviacion.kg - esperado) < 0.5, `kg=${aviacion.kg} esperado=${esperado}`);
  assert.ok(RFI_AVIACION > 1, 'un vuelo emite mas que su CO2 puro');

  const sinVuelos = calcularHuella({ ...entradasPorDefecto(), vuelosLargosAnio: 0, vuelosCortosAnio: 0 });
  assert.equal(sinVuelos.categorias.find((c) => c.id === 'aviacion').kg, 0);
});

test('el hogar se reparte entre convivientes', () => {
  const solo = calcularHuella({ ...entradasPorDefecto(), personasHogar: 1 });
  const cuatro = calcularHuella({ ...entradasPorDefecto(), personasHogar: 4 });
  assert.ok(solo.totalToneladas > cuatro.totalToneladas);
});

test('los escenarios contrafactuales nunca empeoran ni mienten', () => {
  const entradas = entradasPorDefecto('MX');
  const base = calcularHuella(entradas);
  const esc = escenarios(entradas);
  assert.ok(esc.length >= 6);
  for (const e of esc) {
    assert.ok(e.ahorroT >= 0, `${e.id} no puede tener ahorro negativo`);
    assert.ok(e.nuevaHuella <= base.totalToneladas + 1e-9, `${e.id} empeora la huella`);
  }
  assert.ok(esc[0].ahorroT >= esc[esc.length - 1].ahorroT, 'ordenados por ahorro');
});

test('el veredicto se alinea con el objetivo de 1,5 C', () => {
  const minima = calcularHuella({
    pais: 'CR', personasHogar: 4, electricidadKwhMes: 40, combustible: 'ninguno',
    kmCocheSemana: 0, kmTransporteSemana: 20, vuelosCortosAnio: 0, vuelosLargosAnio: 0,
    dieta: 'vegana', gastoBienesMes: 20, gastoServiciosMes: 20, reciclajePct: 90,
  });
  assert.ok(minima.totalToneladas < 3.5, `t=${minima.totalToneladas}`);
  assert.equal(minima.comparativa.objetivo.valor, OBJETIVO_2030_TCO2E);
});

test('los factores de alimentacion respetan la jerarquia de Poore & Nemecek', () => {
  assert.ok(ALIMENTOS.carne_res.co2e > ALIMENTOS.cordero.co2e);
  assert.ok(ALIMENTOS.cordero.co2e > ALIMENTOS.cerdo.co2e);
  assert.ok(ALIMENTOS.cerdo.co2e > ALIMENTOS.pollo.co2e);
  assert.ok(ALIMENTOS.pollo.co2e > ALIMENTOS.legumbres.co2e);
  assert.ok(ALIMENTOS.carne_res.co2e / ALIMENTOS.legumbres.co2e > 50,
    'la res emite dos ordenes de magnitud mas que las legumbres');
});

test('factorMovilidad aplica RFI solo a los vuelos', () => {
  const avion = factorMovilidad('avion_corto');
  assert.equal(avion.rfiAplicado, true);
  assert.ok(Math.abs(avion.co2e - MOVILIDAD.avion_corto.co2e * RFI_AVIACION) < 1e-9);
  const bici = factorMovilidad('bicicleta');
  assert.equal(bici.rfiAplicado, false);
  assert.equal(bici.co2e, 0);
  assert.equal(factorMovilidad('inexistente'), null);
});
