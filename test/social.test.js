import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validarMote, extensionDe, rutaMedio, urlMedio, auraDe, haceRato,
  diagnosticoAlmacen, AURA, CUBO, LIMITE_MB,
} from '../src/core/social.js';
import { configurar, olvidarTodo } from '../src/core/nube.js';

const PUBLICA = 'sb_publishable_mU-ALe_ht0qx84oWwvGEnQ_rBMzXRu0';
const PERFIL = '11111111-1111-1111-1111-111111111111';

test('el mote solo admite minusculas, digitos y guion bajo', () => {
  assert.equal(validarMote('ana_verde').ok, true);
  assert.equal(validarMote('  Ana_Verde  ').mote, 'ana_verde', 'normaliza espacios y mayusculas');
  assert.equal(validarMote('eco2026').ok, true);

  for (const malo of ['ab', 'x'.repeat(16), 'con espacios', 'ñoño', 'con-guion', 'ana@verde', '']) {
    const r = validarMote(malo);
    assert.equal(r.ok, false, `deberia rechazar ${JSON.stringify(malo)}`);
    assert.ok(r.motivo.length > 0, 'todo rechazo explica el motivo');
  }
});

test('el mote rechazado nunca devuelve un valor usable', () => {
  assert.equal(validarMote('AB').mote, undefined);
  assert.equal(validarMote(null).ok, false);
});

test('la extension sale del tipo MIME, con respaldo sensato', () => {
  assert.equal(extensionDe('image/jpeg'), 'jpg');
  assert.equal(extensionDe('video/webm'), 'webm');
  assert.equal(extensionDe('video/quicktime'), 'mov');
  assert.equal(extensionDe('video/desconocido'), 'mp4', 'un video raro cae en mp4');
  assert.equal(extensionDe('cualquier/cosa'), 'jpg');
  assert.equal(extensionDe(null), 'jpg');
});

test('la ruta del medio empieza SIEMPRE por el uuid del perfil', () => {
  // Es lo que hace cumplir la politica del almacen: cada quien en su carpeta.
  for (const mime of ['image/jpeg', 'video/webm']) {
    const r = rutaMedio(PERFIL, mime);
    assert.ok(r.startsWith(`${PERFIL}/`), `ruta fuera de la carpeta propia: ${r}`);
    assert.equal(r.split('/').length, 2, 'sin subcarpetas que despisten a la politica');
  }
});

test('dos rutas seguidas nunca coinciden', () => {
  const vistas = new Set();
  for (let i = 0; i < 500; i++) vistas.add(rutaMedio(PERFIL, 'image/jpeg'));
  assert.equal(vistas.size, 500, 'una colision sobrescribiria la prueba de otra accion');
});

test('la URL publica apunta al cubo correcto', () => {
  configurar({ url: 'https://proyecto.supabase.co', anonKey: PUBLICA });
  assert.equal(urlMedio(`${PERFIL}/clip.webm`),
    `https://proyecto.supabase.co/storage/v1/object/public/${CUBO}/${PERFIL}/clip.webm`);
  assert.equal(urlMedio(null), null);
  olvidarTodo();
});

test('el aura previsualizada coincide con la formula del servidor', () => {
  // 8 por publicar, 2 por me gusta, 5 si la evidencia estaba verificada.
  assert.equal(auraDe({}), AURA.porPublicar);
  assert.equal(auraDe({ likes: 2 }), 8 + 4);
  assert.equal(auraDe({ likes: 2, nivelEvidencia: 'situada' }), 8 + 4 + 5);
  assert.equal(auraDe({ likes: 0, nivelEvidencia: 'video' }), 13);
  assert.equal(auraDe({ nivelEvidencia: 'debil' }), 8, 'una prueba sin verificar no suma extra');
  assert.equal(auraDe({ likes: -5 }), 8, 'los me gusta negativos no restan');
});

test('el aura NO se mezcla con los puntos', () => {
  // Separarlas es la decision que impide que un video gracioso valga mas que
  // plantar un arbol. Si algun dia se sumaran, esta prueba debe fallar.
  const soloSocial = auraDe({ likes: 100 });
  assert.equal(soloSocial, 8 + 200);
  assert.ok(!Object.keys(AURA).some((k) => /punto/i.test(k) && k !== 'porPublicar'),
    'la tabla de aura no debe referirse a los puntos de impacto');
});

test('haceRato produce etiquetas cortas y legibles', () => {
  const ahora = Date.now();
  assert.equal(haceRato(new Date(ahora - 10000).toISOString()), 'ahora');
  assert.equal(haceRato(new Date(ahora - 300000).toISOString()), '5 min');
  assert.equal(haceRato(new Date(ahora - 7200000).toISOString()), '2 h');
  assert.equal(haceRato(new Date(ahora - 3 * 86400000).toISOString()), '3 d');
  assert.match(haceRato(new Date(ahora - 30 * 86400000).toISOString()), /\w/);
  assert.equal(haceRato('no es fecha'), '');
});

test('los limites publicos son coherentes', () => {
  assert.ok(LIMITE_MB > 0 && LIMITE_MB <= 50);
  assert.equal(CUBO, 'evidencias');
});

// Los dos fallos de instalacion que de verdad ocurren: el guion de la base de
// datos omite el cubo o sus politicas cuando el rol del editor SQL no es dueno
// de storage.objects, y entonces publicar falla. El mensaje tiene que decir
// que hacer, no devolver el codigo HTTP.
test('el diagnostico del almacen nombra el cubo que falta', () => {
  const m = diagnosticoAlmacen(404, '{"error":"Bucket not found"}');
  assert.match(m, /New bucket/);
  assert.match(m, /evidencias/);
});

test('el diagnostico distingue cubo ausente de politicas ausentes', () => {
  const sinCubo = diagnosticoAlmacen(404, 'Bucket not found');
  const sinPolitica = diagnosticoAlmacen(400, 'new row violates row-level security policy');
  assert.match(sinPolitica, /Policies/);
  assert.notEqual(sinCubo, sinPolitica);
});

test('lo que el diagnostico no reconoce conserva el codigo y el texto', () => {
  const m = diagnosticoAlmacen(507, 'Insufficient Storage');
  assert.match(m, /507/);
  assert.match(m, /Insufficient Storage/);
});

// El aura tiene que distinguir publicar una linea de texto de ensenar algo.
// Sin esa diferencia, activar el compartir automatico llenaria el aura de
// registros y dejaria de medir lo que dice medir: contagiar el habito.
test('publicar sin medio da menos aura que publicar con medio', () => {
  assert.equal(auraDe({ conMedio: false }), AURA.porPublicarSinMedio);
  assert.equal(auraDe({ conMedio: true }), AURA.porPublicar);
  assert.ok(auraDe({ conMedio: false }) < auraDe({ conMedio: true }));
});

test('la prueba grabada en vivo cuenta como verificada', () => {
  // Es el nivel mas fuerte de todos y se habia quedado fuera de la lista al
  // anadirlo: un video grabado en la app no sumaba el extra de verificacion.
  assert.equal(auraDe({ nivelEvidencia: 'envivo' }),
    AURA.porPublicar + AURA.porEvidenciaVerificada);
  assert.equal(auraDe({ nivelEvidencia: 'debil' }), AURA.porPublicar);
});
