import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPercepcion, distanciaHamming, buscarDuplicado, evaluarEvidencia,
  leerEXIF, parsearFechaEXIF, gradosDesdeGPS,
  NIVELES_EVIDENCIA, TIPOS, UMBRAL_DUPLICADO, FRESCURA_MS, RADIO_COHERENTE_KM,
} from '../src/core/evidencia.js';

// --------------------------------------------------------------- hash perceptual
test('el hash perceptual tiene 16 digitos hexadecimales (64 bits)', () => {
  const grises = Array.from({ length: 64 }, (_, i) => i * 4);
  const h = hashPercepcion(grises);
  assert.equal(typeof h, 'string');
  assert.equal(h.length, 16);
  assert.match(h, /^[0-9a-f]{16}$/);
  assert.equal(hashPercepcion([1, 2, 3]), null, 'exige exactamente 64 valores');
  assert.equal(hashPercepcion(null), null);
});

test('el hash es estable ante cambios pequenos de brillo', () => {
  const base = Array.from({ length: 64 }, (_, i) => (i % 8) * 30);
  const masClara = base.map((v) => Math.min(255, v + 12));
  assert.equal(hashPercepcion(base), hashPercepcion(masClara),
    'subir el brillo no cambia que pixeles superan la media');
});

test('imagenes distintas producen hashes lejanos', () => {
  const a = hashPercepcion(Array.from({ length: 64 }, (_, i) => (i < 32 ? 0 : 255)));
  const b = hashPercepcion(Array.from({ length: 64 }, (_, i) => (i % 2 ? 0 : 255)));
  assert.ok(distanciaHamming(a, b) > UMBRAL_DUPLICADO, `distancia=${distanciaHamming(a, b)}`);
});

test('la distancia de Hamming cuenta bits, no caracteres', () => {
  assert.equal(distanciaHamming('0000000000000000', '0000000000000000'), 0);
  assert.equal(distanciaHamming('0000000000000000', '0000000000000001'), 1);
  assert.equal(distanciaHamming('0000000000000000', 'ffffffffffffffff'), 64);
  assert.equal(distanciaHamming('abc', 'abcd'), Infinity, 'longitudes distintas no se comparan');
  assert.equal(distanciaHamming(null, 'abcd'), Infinity);
});

test('buscarDuplicado tolera la recompresion pero no una foto nueva', () => {
  const original = 'ff00ff00ff00ff00';
  const casiIgual = 'ff00ff00ff00ff01';   // 1 bit de diferencia
  const distinta = '0f0f0f0f0f0f0f0f';
  assert.ok(buscarDuplicado(casiIgual, [original]), 'un bit de diferencia sigue siendo la misma foto');
  assert.equal(buscarDuplicado(distinta, [original]), null);
  assert.equal(buscarDuplicado(null, [original]), null);
  assert.equal(buscarDuplicado(original, []), null);
  const conRegistro = buscarDuplicado(original, [{ hash: original, registroId: 'r_1' }]);
  assert.equal(conRegistro.registroId, 'r_1', 'devuelve donde se uso antes');
});

// -------------------------------------------------------------- evaluacion
const AHORA = new Date('2026-08-27T15:00:00').getTime();

test('sin prueba no hay bonus', () => {
  const r = evaluarEvidencia({});
  assert.equal(r.nivel, 'ninguna');
  assert.equal(r.factor, 1);
});

test('una foto sin metadatos vale poco', () => {
  const r = evaluarEvidencia({ tipo: 'foto', hash: 'aaaaaaaaaaaaaaaa', ahora: AHORA });
  assert.equal(r.nivel, 'debil');
  assert.equal(r.factor, 1.10);
  assert.ok(r.motivos.some((m) => /no conserva fecha/.test(m)));
});

test('una foto de hoy con fecha sube el multiplicador', () => {
  const r = evaluarEvidencia({
    tipo: 'foto', hash: 'aaaaaaaaaaaaaaaa', ahora: AHORA,
    exif: { fecha: AHORA - 3600000 },
  });
  assert.equal(r.nivel, 'fechada');
  assert.equal(r.factor, 1.25);
});

test('fecha mas GPS coherente da el maximo para fotos', () => {
  const r = evaluarEvidencia({
    tipo: 'foto', hash: 'bbbbbbbbbbbbbbbb', ahora: AHORA,
    exif: { fecha: AHORA - 600000, lat: 13.6929, lon: -89.2182 },
    ubicacion: { lat: 13.70, lon: -89.22 },
  });
  assert.equal(r.nivel, 'situada');
  assert.equal(r.factor, 1.40);
  assert.ok(r.motivos.some((m) => /coherentes con tu ubicacion/.test(m)));
});

test('una foto tomada lejos de ti no cuenta como situada', () => {
  const r = evaluarEvidencia({
    tipo: 'foto', hash: 'cccccccccccccccc', ahora: AHORA,
    exif: { fecha: AHORA - 600000, lat: 40.4168, lon: -3.7038 }, // Madrid
    ubicacion: { lat: 13.6929, lon: -89.2182 },                   // San Salvador
  });
  assert.equal(r.nivel, 'fechada', 'la fecha sigue valiendo, la ubicacion no');
  assert.ok(r.motivos.some((m) => /km de tu ubicacion/.test(m)));
});

test('una foto vieja no acredita una accion de hoy', () => {
  const r = evaluarEvidencia({
    tipo: 'foto', hash: 'dddddddddddddddd', ahora: AHORA,
    exif: { fecha: AHORA - 5 * 86400000 },
  });
  assert.equal(r.nivel, 'debil');
  assert.ok(r.motivos.some((m) => /hace 5 dias/.test(m)));
  assert.ok(FRESCURA_MS < 5 * 86400000);
});

test('una foto con fecha futura se senala', () => {
  const r = evaluarEvidencia({
    tipo: 'foto', hash: 'eeeeeeeeeeeeeeee', ahora: AHORA,
    exif: { fecha: AHORA + 10 * 86400000 },
  });
  assert.ok(r.motivos.some((m) => /futuro/.test(m)));
  assert.equal(r.nivel, 'debil');
});

test('el video fechado vale mas que cualquier foto', () => {
  const v = evaluarEvidencia({ tipo: 'video', fechaArchivo: AHORA - 300000, ahora: AHORA });
  assert.equal(v.nivel, 'video');
  assert.equal(v.factor, 1.45);
  assert.ok(v.factor > NIVELES_EVIDENCIA.situada.factor);
  const sinFecha = evaluarEvidencia({ tipo: 'video', ahora: AHORA });
  assert.equal(sinFecha.nivel, 'debil');
});

test('reenviar la misma foto no da puntos extra', () => {
  const usado = 'ff00ff00ff00ff00';
  const r = evaluarEvidencia({
    tipo: 'foto', hash: 'ff00ff00ff00ff00', ahora: AHORA,
    exif: { fecha: AHORA, lat: 13.69, lon: -89.21 },
    hashesPrevios: [{ hash: usado, registroId: 'r_viejo' }],
  });
  assert.equal(r.nivel, 'sospechosa');
  assert.equal(r.factor, 1, 'ni siquiera con fecha y GPS perfectos');
  assert.equal(r.duplicado.registroId, 'r_viejo');
  assert.ok(r.sospecha > 0.9);
});

test('una miniatura descargada se marca por resolucion', () => {
  const r = evaluarEvidencia({
    tipo: 'foto', hash: '1111111111111111', ahora: AHORA,
    exif: { fecha: AHORA }, ancho: 320, alto: 240,
  });
  assert.ok(r.motivos.some((m) => /Resolucion baja/.test(m)));
});

test('la fecha del archivo sirve de respaldo cuando no hay EXIF', () => {
  const r = evaluarEvidencia({ tipo: 'foto', hash: '2222222222222222', ahora: AHORA, fechaArchivo: AHORA - 60000 });
  assert.equal(r.nivel, 'fechada');
  assert.ok(r.motivos.some((m) => /sin metadatos de camara/.test(m)));
});

test('todos los niveles declarados tienen factor y etiqueta', () => {
  for (const [k, v] of Object.entries(NIVELES_EVIDENCIA)) {
    assert.ok(v.factor >= 1, `${k} no puede penalizar por debajo de 1`);
    assert.ok(v.etiqueta.length > 0);
  }
  assert.ok(Object.keys(TIPOS).includes('foto'));
  assert.ok(RADIO_COHERENTE_KM > 0);
});

// -------------------------------------------------------------------- EXIF
/** Construye un JPEG minimo con un bloque EXIF real, byte a byte. */
function jpegConExif({ fecha = '2026:08:27 14:30:00', lat = [13, 41, 34.44], lon = [89, 13, 5.52], marca = 'TestCam' } = {}) {
  const TAM = 198;
  const tiff = new Uint8Array(TAM);
  const dv = new DataView(tiff.buffer);
  const u16 = (o, v) => dv.setUint16(o, v, true);
  const u32 = (o, v) => dv.setUint32(o, v, true);
  const rat = (o, valor) => { // racional con denominador 100
    u32(o, Math.round(valor * 100)); u32(o + 4, 100);
  };
  const ascii = (o, s) => { for (let i = 0; i < s.length; i++) tiff[o + i] = s.charCodeAt(i); tiff[o + s.length] = 0; };

  // Cabecera TIFF little-endian
  tiff[0] = 0x49; tiff[1] = 0x49; u16(2, 0x002a); u32(4, 8);

  const OFF_MARCA = 122, OFF_FECHA = 130, OFF_LAT = 150, OFF_LON = 174;

  // IFD0: 3 entradas
  u16(8, 3);
  u16(10, 0x010f); u16(12, 2); u32(14, marca.length + 1); u32(18, OFF_MARCA);   // Make
  u16(22, 0x8769); u16(24, 4); u32(26, 1); u32(30, 50);                          // puntero Exif
  u16(34, 0x8825); u16(36, 4); u32(38, 1); u32(42, 68);                          // puntero GPS
  u32(46, 0);                                                                     // no hay IFD1

  // Sub-IFD Exif: 1 entrada (DateTimeOriginal)
  u16(50, 1);
  u16(52, 0x9003); u16(54, 2); u32(56, 20); u32(60, OFF_FECHA);
  u32(64, 0);

  // Sub-IFD GPS: 4 entradas
  u16(68, 4);
  u16(70, 0x0001); u16(72, 2); u32(74, 2); tiff[78] = 0x4e; tiff[79] = 0;        // N
  u16(82, 0x0002); u16(84, 5); u32(86, 3); u32(90, OFF_LAT);
  u16(94, 0x0003); u16(96, 2); u32(98, 2); tiff[102] = 0x57; tiff[103] = 0;      // W
  u16(106, 0x0004); u16(108, 5); u32(110, 3); u32(114, OFF_LON);
  u32(118, 0);

  ascii(OFF_MARCA, marca);
  ascii(OFF_FECHA, fecha);
  lat.forEach((v, i) => rat(OFF_LAT + i * 8, v));
  lon.forEach((v, i) => rat(OFF_LON + i * 8, v));

  // Envoltura JPEG: SOI + APP1(Exif) + EOI
  const largoAPP1 = 2 + 6 + TAM;
  const jpeg = new Uint8Array(2 + 2 + largoAPP1 + 2);
  let o = 0;
  jpeg[o++] = 0xff; jpeg[o++] = 0xd8;                       // SOI
  jpeg[o++] = 0xff; jpeg[o++] = 0xe1;                       // APP1
  jpeg[o++] = (largoAPP1 >> 8) & 0xff; jpeg[o++] = largoAPP1 & 0xff;
  for (const c of 'Exif') jpeg[o++] = c.charCodeAt(0);
  jpeg[o++] = 0; jpeg[o++] = 0;
  jpeg.set(tiff, o); o += TAM;
  jpeg[o++] = 0xff; jpeg[o++] = 0xd9;                       // EOI
  return jpeg;
}

test('leerEXIF extrae fecha, coordenadas y camara de un JPEG real', () => {
  const r = leerEXIF(jpegConExif());
  assert.ok(r, 'debe reconocer el JPEG');
  assert.equal(r.marca, 'TestCam');
  assert.equal(new Date(r.fecha).getFullYear(), 2026);
  assert.equal(new Date(r.fecha).getHours(), 14);
  assert.ok(Math.abs(r.lat - 13.6929) < 0.0001, `lat=${r.lat}`);
  assert.ok(Math.abs(r.lon - (-89.2182)) < 0.0001, `lon=${r.lon}`);
});

test('la referencia S y W invierte el signo de las coordenadas', () => {
  assert.ok(gradosDesdeGPS([13, 41, 34.44], 'N', 'S') > 0);
  assert.ok(gradosDesdeGPS([13, 41, 34.44], 'S', 'S') < 0);
  assert.ok(gradosDesdeGPS([89, 13, 5.52], 'W', 'W') < 0);
  assert.equal(gradosDesdeGPS([200, 0, 0], 'N', 'S'), null, 'rechaza grados imposibles');
  assert.equal(gradosDesdeGPS(null, 'N', 'S'), null);
});

test('la fecha EXIF usa dos puntos, no guiones', () => {
  assert.equal(new Date(parsearFechaEXIF('2026:08:27 14:30:00')).getMonth(), 7);
  assert.equal(parsearFechaEXIF('2026-08-27 14:30:00'), null);
  assert.equal(parsearFechaEXIF('basura'), null);
  assert.equal(parsearFechaEXIF(null), null);
});

test('leerEXIF no revienta con datos corruptos o ajenos', () => {
  assert.equal(leerEXIF(new Uint8Array([1, 2, 3])), null, 'no es JPEG');
  assert.equal(leerEXIF(new Uint8Array(0)), null);
  assert.equal(leerEXIF(null), null);
  // JPEG valido pero sin bloque EXIF
  const sinExif = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const r = leerEXIF(sinExif);
  assert.ok(r && r.fecha === null && r.lat === null, 'devuelve estructura vacia, no null');
  // JPEG con APP1 truncado
  const truncado = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x40, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49]);
  assert.doesNotThrow(() => leerEXIF(truncado));
});

test('una foto sin GPS sigue dando fecha', () => {
  const jpeg = jpegConExif();
  // Se anula el puntero al IFD de GPS dejando el resto intacto.
  const i = jpeg.indexOf(0x49, 12);
  const dv = new DataView(jpeg.buffer, i);
  dv.setUint32(42, 0, true);
  const r = leerEXIF(jpeg);
  assert.ok(Number.isFinite(r.fecha));
  assert.equal(r.lat, null);
});

// El nivel "en vivo" es el unico que no deduce nada: la app misma grabo.
test('grabar dentro de la app supera a cualquier archivo adjuntado', () => {
  const enVivo = evaluarEvidencia({ tipo: 'video', enVivo: true });
  assert.equal(enVivo.nivel, 'envivo');
  assert.ok(enVivo.factor > NIVELES_EVIDENCIA.video.factor,
    'tiene que valer mas que un video elegido del carrete');
  assert.equal(enVivo.sospecha, 0);
  assert.match(enVivo.motivos.join(' '), /no se pudo elegir de la galeria/);
});

test('lo grabado en vivo no necesita EXIF ni pasa por el detector de duplicados', () => {
  // Un video grabado ahora mismo no tiene EXIF de camara, y compararlo con
  // hashes previos no tendria sentido: no existia antes de pulsar el boton.
  const r = evaluarEvidencia({
    tipo: 'video', enVivo: true, exif: null, fechaArchivo: null,
    hash: '0000000000000000', hashesPrevios: ['0000000000000000'],
  });
  assert.equal(r.nivel, 'envivo', 'un hash repetido no lo degrada');
  assert.equal(r.duplicado, null);
});

test('el analisis de movimiento se cuenta como motivo cuando existe', () => {
  const r = evaluarEvidencia({
    tipo: 'video', enVivo: true,
    movimiento: { regimen: 'corriendo', etiqueta: 'Corriendo', motivo: '168 pasos por minuto: ritmo de carrera.' },
  });
  assert.match(r.motivos.join(' '), /corriendo/i);
  assert.match(r.motivos.join(' '), /168 pasos/);

  // Y si el sensor no dijo nada, no se inventa una linea.
  const sin = evaluarEvidencia({ tipo: 'video', enVivo: true, movimiento: { regimen: 'desconocido' } });
  assert.equal(sin.motivos.length, 1);
});
