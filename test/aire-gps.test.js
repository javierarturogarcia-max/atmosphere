import test from 'node:test';
import assert from 'node:assert/strict';
import { ugm3ApPpb, ppbAUgm3, normalizarDesdeUgm3, calcularAQI, VOLUMEN_MOLAR, MASA_MOLAR } from '../src/core/aire.js';
import { factorAire, VIGENCIA_AIRE_MS } from '../src/core/puntos.js';
import { misionesPorAire } from '../src/core/misiones.js';
import { haversine, analizarTraza, inferirModo, verificarContra, PERFILES } from '../src/core/gps.js';
import { parsearGPX, parsearTCX, parsearTraza, metadatosTraza } from '../src/core/gpx.js';
import { crearAlmacen, estadoInicial, lecturaAireVigente } from '../src/core/estado.js';

// ------------------------------------------------------- conversion de unidades
test('la conversion ug/m3 -> ppb usa el volumen molar de la EPA', () => {
  // ppb = ug/m3 * 24,45 / masa molar
  assert.ok(Math.abs(ugm3ApPpb(100, 'o3') - (100 * VOLUMEN_MOLAR / MASA_MOLAR.o3)) < 1e-9);
  assert.ok(Math.abs(ugm3ApPpb(100, 'o3') - 50.94) < 0.01);
  assert.ok(Math.abs(ugm3ApPpb(100, 'no2') - 53.15) < 0.01);
  assert.ok(Math.abs(ugm3ApPpb(100, 'so2') - 38.16) < 0.01);
  assert.equal(ugm3ApPpb(100, 'pm25'), null, 'las particulas no se convierten: ya van en masa');
});

test('la conversion es reversible', () => {
  for (const gas of ['o3', 'no2', 'so2', 'co']) {
    const ida = ugm3ApPpb(80, gas);
    assert.ok(Math.abs(ppbAUgm3(ida, gas) - 80) < 1e-9, `fallo en ${gas}`);
  }
});

test('SIN convertir, el AQI sale catastroficamente mal', () => {
  // Este es el error silencioso que arruina las integraciones de calidad del aire:
  // aplicar los tramos de la EPA (ppb/ppm) sobre datos en ug/m3.
  const crudas = { pm25: 12, pm10: 30, o3: 100, no2: 40, so2: 10, co: 500 };
  const malCalculado = calcularAQI(crudas);
  const bienCalculado = calcularAQI(normalizarDesdeUgm3(crudas));

  assert.equal(malCalculado.aqi, 500, 'sin convertir, el CO de 500 ug/m3 se lee como 500 ppm');
  assert.equal(malCalculado.dominante, 'co');
  assert.equal(bienCalculado.aqi, 56);
  assert.equal(bienCalculado.dominante, 'pm25');
  assert.equal(bienCalculado.categoria, 'Moderada');
});

test('normalizarDesdeUgm3 respeta las particulas y omite lo ausente', () => {
  const r = normalizarDesdeUgm3({ pm25: 12.5, o3: 100 });
  assert.equal(r.pm25, 12.5, 'PM2,5 pasa sin tocar');
  assert.ok(Math.abs(r.o3 - 50.94) < 0.01);
  assert.equal('no2' in r, false, 'lo que no viene no se inventa');
  assert.equal('co' in r, false);
});

test('el CO se entrega en ppm, no en ppb', () => {
  const r = normalizarDesdeUgm3({ co: 10000 });
  assert.ok(Math.abs(r.co - 8.729) < 0.001, `co=${r.co}`);
});

// --------------------------------------------------------- juego ligado al aire
test('el multiplicador por aire escala con el riesgo y solo afecta a lo que toca', () => {
  assert.equal(factorAire(30, 'movilidad').factor, 1, 'aire limpio no da bonus');
  assert.equal(factorAire(80, 'movilidad').factor, 1.25);
  assert.equal(factorAire(130, 'movilidad').factor, 1.5);
  assert.equal(factorAire(175, 'movilidad').factor, 1.75);
  assert.equal(factorAire(250, 'movilidad').factor, 2.0);
  assert.equal(factorAire(250, 'energia').factor, 2.0);
  assert.equal(factorAire(250, 'residuos').factor, 1, 'reciclar no limpia el aire de hoy');
  assert.equal(factorAire(250, 'alimentacion').factor, 1);
  assert.equal(factorAire(NaN, 'movilidad').factor, 1);
  assert.equal(factorAire(undefined, 'movilidad').factor, 1);
});

test('las misiones por aire cambian con el nivel de contaminacion', () => {
  assert.equal(misionesPorAire(30, 'San Salvador')[0].urgencia, 'ninguna');
  assert.equal(misionesPorAire(80, 'San Salvador')[0].urgencia, 'baja');
  assert.equal(misionesPorAire(130, 'San Salvador')[0].urgencia, 'media');
  assert.equal(misionesPorAire(180, 'San Salvador')[0].urgencia, 'alta');
  const alerta = misionesPorAire(130, 'San Salvador', '2026-05-10')[0];
  assert.match(alerta.titulo, /San Salvador/);
  assert.match(alerta.titulo, /130/);
  assert.equal(alerta.desde, '2026-05-10T00:00:00');
  assert.equal(alerta.objetivo.ref, 'movilidad');
  assert.deepEqual(misionesPorAire(NaN), [], 'sin dato no hay mision');
});

test('una lectura de aire caduca y deja de dar bonus', () => {
  const ahora = new Date('2026-05-10T12:00:00');
  const base = estadoInicial();
  base.aire.ultimaLectura = { aqi: 150, lugar: 'X', fecha: new Date('2026-05-10T11:00:00').toISOString() };
  assert.ok(lecturaAireVigente(base, ahora), 'una hora de antiguedad sigue valiendo');

  base.aire.ultimaLectura.fecha = new Date('2026-05-10T07:00:00').toISOString();
  assert.equal(lecturaAireVigente(base, ahora), null, 'cinco horas ya no');

  base.aire.ultimaLectura = { aqi: 150, lugar: 'X' };
  assert.equal(lecturaAireVigente(base, ahora), null, 'sin fecha no se acepta');
  assert.ok(VIGENCIA_AIRE_MS > 0);
});

test('con aire malo, la misma accion de movilidad da mas puntos', () => {
  const limpio = crearAlmacen(estadoInicial('A', 'SV'));
  const sucio = crearAlmacen(estadoInicial('B', 'SV'));
  sucio.guardarLecturaAire({ aqi: 180, lugar: 'San Salvador' });

  const a = limpio.registrar('mov_bici', 10);
  const b = sucio.registrar('mov_bici', 10);
  assert.ok(b.puntos > a.puntos, `sucio=${b.puntos} debe superar a limpio=${a.puntos}`);
  assert.equal(b.bonusAire.factor, 1.75);
  assert.equal(a.bonusAire.factor, 1);
});

test('el bonus de aire no se aplica a categorias sin relacion', () => {
  const st = crearAlmacen(estadoInicial('C', 'SV'));
  st.guardarLecturaAire({ aqi: 250, lugar: 'X' });
  const r = st.registrar('res_reciclar_papel', 3);
  assert.equal(r.bonusAire.factor, 1);
});

// -------------------------------------------------------------------- geometria
test('haversine coincide con la distancia conocida de un grado', () => {
  // Un grado de latitud sobre la esfera media = 2*pi*R/360 = 111.194,9 m
  const d = haversine(0, 0, 1, 0);
  assert.ok(Math.abs(d - 111194.93) < 1, `d=${d}`);
  assert.equal(haversine(10, 10, 10, 10), 0);
  // Simetria
  assert.ok(Math.abs(haversine(41.4, 2.2, 40.4, -3.7) - haversine(40.4, -3.7, 41.4, 2.2)) < 1e-6);
});

/** Genera una traza recta a velocidad constante. */
function traza(kmh, minutos, { precision = 5, cada = 10 } = {}) {
  const puntos = [];
  const metrosPorSegundo = (kmh * 1000) / 3600;
  const gradosPorSegundo = metrosPorSegundo / 111194.93;
  const t0 = new Date('2026-05-10T08:00:00Z').getTime();
  const n = Math.floor((minutos * 60) / cada);
  for (let i = 0; i <= n; i++) {
    puntos.push({ lat: 13.6929 + gradosPorSegundo * cada * i, lon: -89.2182, t: t0 + i * cada * 1000, precision });
  }
  return puntos;
}

test('analizarTraza mide bien distancia, duracion y velocidad', () => {
  const r = analizarTraza(traza(15, 20)); // 15 km/h durante 20 min = 5 km
  assert.equal(r.valida, true);
  assert.ok(Math.abs(r.distanciaKm - 5) < 0.05, `km=${r.distanciaKm}`);
  assert.ok(Math.abs(r.duracionMin - 20) < 0.2);
  assert.ok(Math.abs(r.velocidadMediana - 15) < 0.3);
  assert.equal(r.modo.modo, 'mov_bici');
});

test('el modo se infiere del perfil de velocidad', () => {
  assert.equal(analizarTraza(traza(4.5, 15)).modo.modo, 'mov_caminar');
  assert.equal(analizarTraza(traza(11, 15)).modo.modo, 'mov_correr');
  assert.equal(analizarTraza(traza(22, 15)).modo.modo, 'mov_bici');
  assert.equal(analizarTraza(traza(60, 15)).modo.modo, 'mov_transporte');
});

test('inferirModo admite la ambiguedad en vez de fingir certeza', () => {
  const solapado = inferirModo(10, 12); // cabe en correr y en bici
  assert.ok(solapado.confianza < 0.9, `confianza=${solapado.confianza}`);
  assert.match(solapado.nota, /Compatible tambien/);
  const imposible = inferirModo(500, 900);
  assert.equal(imposible.modo, null);
  assert.equal(imposible.confianza, 0);
});

test('se descartan los saltos de GPS sin contaminar la distancia', () => {
  const puntos = traza(15, 10);
  // Un salto a 3.000 km de distancia en un segundo: error del sensor.
  puntos.splice(30, 0, { lat: 40.4, lon: -3.7, t: puntos[29].t + 1000, precision: 5 });
  const r = analizarTraza(puntos);
  assert.equal(r.valida, true);
  assert.ok(r.distanciaKm < 3, `el salto no debe sumarse: km=${r.distanciaKm}`);
  assert.ok(r.puntosDescartados >= 1);
  assert.ok(r.velocidadMaxima < 200);
});

test('se descartan los puntos de precision pesima', () => {
  const puntos = traza(15, 10, { precision: 500 });
  const r = analizarTraza(puntos);
  assert.equal(r.valida, false);
  assert.ok(r.puntosDescartados > 0);
});

test('trazas degeneradas no rompen nada', () => {
  assert.equal(analizarTraza([]).valida, false);
  assert.equal(analizarTraza(null).valida, false);
  assert.equal(analizarTraza([{ lat: 1, lon: 1, t: 0 }]).valida, false);
  const quieto = [
    { lat: 13.6, lon: -89.2, t: 0, precision: 5 },
    { lat: 13.6, lon: -89.2, t: 60000, precision: 5 },
  ];
  assert.equal(analizarTraza(quieto).valida, false, 'estar parado no es un trayecto');
});

// ----------------------------------------------------------------- verificacion
test('verificarContra acepta la cantidad que respalda el GPS', () => {
  const r = analizarTraza(traza(15, 20));
  assert.equal(verificarContra(r, 'mov_bici', 5).verificado, true);
  assert.equal(verificarContra(r, 'mov_bici', 5.4).verificado, true, 'tolera el 15 % de error del GPS');
});

test('verificarContra rechaza una cantidad inflada', () => {
  const r = analizarTraza(traza(15, 20)); // 5 km reales
  const v = verificarContra(r, 'mov_bici', 40);
  assert.equal(v.verificado, false);
  assert.match(v.motivo, /40 km/);
  assert.ok(Math.abs(v.cantidadSugerida - 5) < 0.05);
});

test('verificarContra detecta que el modo no cuadra', () => {
  const enCoche = analizarTraza(traza(70, 20));
  const v = verificarContra(enCoche, 'mov_bici', 23);
  assert.equal(v.verificado, false);
  assert.match(v.motivo, /Vehiculo/);
});

test('sin cantidad declarada, el GPS propone la suya', () => {
  const r = analizarTraza(traza(4.5, 30));
  const v = verificarContra(r, 'mov_caminar', null);
  assert.equal(v.verificado, true);
  assert.ok(v.cantidadSugerida > 2 && v.cantidadSugerida < 2.5);
});

// ------------------------------------------------------------------ archivos GPX
const GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="StravaGPX">
  <trk><name>Paseo matutino</name><trkseg>
    <trkpt lat="13.69290" lon="-89.21820"><ele>650</ele><time>2026-05-10T08:00:00Z</time></trkpt>
    <trkpt lat="13.69515" lon="-89.21820"><ele>651</ele><time>2026-05-10T08:01:00Z</time></trkpt>
    <trkpt lat="13.69740" lon="-89.21820"><ele>652</ele><time>2026-05-10T08:02:00Z</time></trkpt>
    <trkpt lat="13.69965" lon="-89.21820"><ele>653</ele><time>2026-05-10T08:03:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

test('el GPX se lee con coordenadas y tiempos', () => {
  const p = parsearGPX(GPX);
  assert.equal(p.length, 4);
  assert.equal(p[0].lat, 13.6929);
  assert.equal(p[0].lon, -89.2182);
  assert.ok(Number.isFinite(p[0].t));
  assert.equal(new Date(p[0].t).toISOString(), '2026-05-10T08:00:00.000Z');
});

test('la traza del GPX produce metricas coherentes', () => {
  const r = analizarTraza(parsearGPX(GPX));
  assert.equal(r.valida, true);
  // 0,00225 grados por minuto = 250 m/min = 15 km/h
  assert.ok(Math.abs(r.velocidadMediana - 15) < 0.5, `v=${r.velocidadMediana}`);
  assert.ok(Math.abs(r.distanciaKm - 0.75) < 0.02);
  assert.equal(r.modo.modo, 'mov_bici');
});

test('los metadatos del GPX identifican la actividad y la app', () => {
  const meta = metadatosTraza(GPX);
  assert.equal(meta.nombre, 'Paseo matutino');
  assert.equal(meta.aplicacion, 'StravaGPX');
  assert.equal(meta.fecha, '2026-05-10T08:00:00Z');
});

test('tambien se leen los TCX de Garmin', () => {
  const TCX = `<TrainingCenterDatabase><Activities><Activity><Lap><Track>
    <Trackpoint><Time>2026-05-10T08:00:00Z</Time><Position>
      <LatitudeDegrees>13.6929</LatitudeDegrees><LongitudeDegrees>-89.2182</LongitudeDegrees></Position></Trackpoint>
    <Trackpoint><Time>2026-05-10T08:01:00Z</Time><Position>
      <LatitudeDegrees>13.69515</LatitudeDegrees><LongitudeDegrees>-89.2182</LongitudeDegrees></Position></Trackpoint>
  </Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const r = parsearTraza(TCX, 'actividad.tcx');
  assert.equal(r.formato, 'TCX');
  assert.equal(r.puntos.length, 2);
  assert.equal(r.conTiempo, 2);
  assert.equal(parsearTCX('<nada/>').length, 0);
});

test('un archivo corrupto devuelve vacio en vez de reventar', () => {
  assert.deepEqual(parsearGPX('esto no es xml'), []);
  assert.deepEqual(parsearGPX(''), []);
  assert.deepEqual(parsearGPX(null), []);
  assert.equal(parsearTraza('<gpx></gpx>').total, 0);
});

test('los perfiles de velocidad cubren el rango sin huecos absurdos', () => {
  for (const p of PERFILES) {
    assert.ok(p.minMediana < p.maxMediana, `${p.modo}: rango invertido`);
    assert.ok(p.maxPico >= p.maxMediana, `${p.modo}: pico menor que la mediana maxima`);
  }
});
