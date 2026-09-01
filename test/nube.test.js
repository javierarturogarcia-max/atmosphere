import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configurar, configuracion, estaConfigurada, desconectar, olvidarTodo,
  pendientesDeSubir, aFilaRegistro, enLotes, situarEnRanking, generarCodigo,
  esClaveSecreta, ErrorNube, configuracionPropia, NUBE_POR_DEFECTO,
} from '../src/core/nube.js';
import { generador } from '../src/core/rng.js';

const PUBLICA = 'sb_publishable_mU-ALe_ht0qx84oWwvGEnQ_rBMzXRu0';
/** JWT de juguete con rol service_role, para probar el rechazo. */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT_SERVICIO = `eyJhbGciOiJIUzI1NiJ9.${b64({ role: 'service_role' })}.firma`;
const JWT_ANON = `eyJhbGciOiJIUzI1NiJ9.${b64({ role: 'anon' })}.firma`;

test('la configuracion valida la forma de la URL', () => {
  assert.throws(() => configurar({ url: 'http://inseguro.supabase.co', anonKey: PUBLICA }), ErrorNube);
  assert.throws(() => configurar({ url: 'https://ejemplo.com', anonKey: PUBLICA }), ErrorNube);
  const r = configurar({ url: 'https://abcdefg.supabase.co/', anonKey: PUBLICA });
  assert.equal(r.url, 'https://abcdefg.supabase.co', 'quita la barra final');
  assert.equal(estaConfigurada(), true);
  olvidarTodo();
});

test('admite los dos formatos de clave publica que conviven', () => {
  assert.equal(configurar({ url: 'https://a.supabase.co', anonKey: PUBLICA }).formato, 'publishable');
  assert.equal(configurar({ url: 'https://a.supabase.co', anonKey: JWT_ANON }).formato, 'anon-jwt');
  olvidarTodo();
});

test('RECHAZA una clave secreta en los dos formatos', () => {
  // Es el fallo mas grave posible: la clave secreta salta todas las politicas RLS.
  assert.equal(esClaveSecreta('sb_secret_abc123'), 'formato nuevo (sb_secret_)');
  assert.equal(esClaveSecreta(JWT_SERVICIO), 'JWT con rol service_role');
  assert.equal(esClaveSecreta(PUBLICA), null);
  assert.equal(esClaveSecreta(JWT_ANON), null);

  for (const mala of ['sb_secret_mU-ALe_ht0qx84oWwvGEnQ', JWT_SERVICIO]) {
    assert.throws(
      () => configurar({ url: 'https://a.supabase.co', anonKey: mala }),
      (e) => e instanceof ErrorNube && e.codigo === 'clave_secreta' && /SECRETA/.test(e.message),
      `deberia rechazar ${mala.slice(0, 20)}`);
  }
  assert.equal(configuracionPropia(), null, 'una clave secreta nunca se guarda');
});

test('corrige la clave pegada dos veces seguidas', () => {
  const r = configurar({ url: 'https://a.supabase.co', anonKey: PUBLICA + PUBLICA });
  assert.equal(r.formato, 'publishable');
  assert.equal(configuracion().anonKey, PUBLICA, 'guarda una sola copia');
  olvidarTodo();
});

test('ignora espacios y saltos de linea al pegar', () => {
  configurar({ url: 'https://a.supabase.co', anonKey: `  ${PUBLICA}\n ` });
  assert.equal(configuracion().anonKey, PUBLICA);
  olvidarTodo();
});

test('rechaza cualquier cosa que no sea una clave reconocible', () => {
  for (const basura of ['corta', 'x'.repeat(60), 'https://a.supabase.co', '']) {
    assert.throws(
      () => configurar({ url: 'https://a.supabase.co', anonKey: basura }),
      (e) => e instanceof ErrorNube && e.codigo === 'clave',
      `deberia rechazar ${JSON.stringify(basura.slice(0, 15))}`);
  }
});

test('solo se suben los registros que faltan', () => {
  const locales = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(pendientesDeSubir(locales, ['b']).map((r) => r.id), ['a', 'c']);
  assert.equal(pendientesDeSubir(locales, ['a', 'b', 'c']).length, 0);
  assert.equal(pendientesDeSubir(locales, []).length, 3);
  assert.equal(pendientesDeSubir(null, null).length, 0);
  assert.equal(pendientesDeSubir([{ sinId: 1 }], []).length, 0, 'un registro sin id no se sube');
});

test('la fila enviada NO lleva pruebas graficas, notas ni coordenadas', () => {
  const registro = {
    id: 'r_1', accionId: 'mov_bici', cantidad: 12, unidad: 'km',
    impacto: { co2e: 2.052, agua: 0, residuo: 0, kwh: 0 },
    puntos: 34, fecha: '2026-08-27T09:00:00.000Z',
    evidencia: 'foto', nota: 'Fui con Marta por el parque',
    medio: { id: 'm_1', tipo: 'foto', hash: 'ff00ff00ff00ff00', nivel: 'situada', factor: 1.4 },
    desglose: { base: 20.5 }, sospecha: 0,
  };
  const fila = aFilaRegistro(registro, 'movilidad', 'uuid-del-perfil');

  assert.equal(fila.id, 'r_1');
  assert.equal(fila.perfil_id, 'uuid-del-perfil');
  assert.equal(fila.categoria, 'movilidad');
  assert.equal(fila.co2e, 2.052);
  assert.equal(fila.puntos, 34);
  assert.equal(fila.nivel_evidencia, 'situada', 'el NIVEL si viaja: sirve para auditar');

  // Lo que no debe salir nunca del dispositivo
  assert.equal('nota' in fila, false, 'la nota puede contener nombres de terceros');
  assert.equal('medio' in fila, false, 'la foto se queda en el dispositivo');
  assert.equal('desglose' in fila, false);
  assert.equal(JSON.stringify(fila).includes('ff00ff00ff00ff00'), false, 'ni el hash de la imagen');
  assert.equal(JSON.stringify(fila).includes('Marta'), false);
});

test('la fila tolera registros incompletos sin generar nulos', () => {
  const fila = aFilaRegistro({ id: 'x', accionId: 'a', fecha: '2026-01-01T00:00:00Z' }, null, 'p');
  assert.equal(fila.cantidad, 0);
  assert.equal(fila.co2e, 0);
  assert.equal(fila.puntos, 0);
  assert.equal(fila.categoria, 'otras');
  assert.equal(fila.unidad, 'ud');
});

test('los puntos enviados nunca son negativos ni decimales', () => {
  assert.equal(aFilaRegistro({ id: 'x', puntos: -50 }, 'c', 'p').puntos, 0);
  assert.equal(aFilaRegistro({ id: 'x', puntos: 12.7 }, 'c', 'p').puntos, 13);
});

test('los lotes trocean sin perder ni duplicar', () => {
  const items = Array.from({ length: 250 }, (_, i) => i);
  const lotes = enLotes(items, 100);
  assert.equal(lotes.length, 3);
  assert.deepEqual(lotes.map((l) => l.length), [100, 100, 50]);
  assert.deepEqual(lotes.flat(), items);
  assert.deepEqual(enLotes([], 100), []);
});

test('el ranking situa al usuario y calcula lo que le falta', () => {
  const filas = [
    { id: 'a', nombre: 'Ana', puntos: 900 },
    { id: 'yo', nombre: 'Javier', puntos: 500 },
    { id: 'b', nombre: 'Luis', puntos: 700 },
  ];
  const r = situarEnRanking(filas, 'yo');
  assert.deepEqual(r.tabla.map((f) => f.nombre), ['Ana', 'Luis', 'Javier']);
  assert.equal(r.posicion, 3);
  assert.equal(r.total, 3);
  assert.equal(r.faltanParaSubir, 201, 'para pasar a Luis con 700');
  assert.equal(r.tabla[2].esUsuario, true);
});

test('el ranking aguanta que el usuario no aparezca', () => {
  const r = situarEnRanking([{ id: 'a', puntos: 10 }], 'yo');
  assert.equal(r.posicion, null);
  assert.equal(r.faltanParaSubir, 0);
  assert.deepEqual(situarEnRanking(null, 'yo').tabla, []);
});

test('quien va primero no tiene a nadie por delante', () => {
  const r = situarEnRanking([{ id: 'yo', puntos: 999 }, { id: 'a', puntos: 1 }], 'yo');
  assert.equal(r.posicion, 1);
  assert.equal(r.faltanParaSubir, 0);
});

test('el codigo de grupo evita caracteres que se confunden al dictarlo', () => {
  const rnd = generador('codigos');
  for (let i = 0; i < 200; i++) {
    const c = generarCodigo(rnd);
    assert.match(c, /^[A-HJ-NP-Z2-9]{6}$/, `codigo ambiguo: ${c}`);
    assert.equal(c.includes('O'), false);
    assert.equal(c.includes('0'), false);
    assert.equal(c.includes('I'), false);
    assert.equal(c.includes('1'), false);
  }
});

test('sin configuracion, las operaciones fallan con un codigo claro', async () => {
  olvidarTodo();
  const { sincronizar } = await import('../src/core/nube.js');
  await assert.rejects(() => sincronizar([], () => 'x'), (e) => e instanceof ErrorNube && e.codigo === 'sin_sesion');
});

test('desconectar borra la sesion pero conserva la configuracion', () => {
  configurar({ url: 'https://proj.supabase.co', anonKey: PUBLICA });
  desconectar();
  assert.equal(configuracionPropia().url, 'https://proj.supabase.co',
    'la URL del proyecto se conserva para volver a entrar');
  olvidarTodo();
  assert.equal(configuracionPropia(), null, 'olvidarTodo si borra la configuracion propia');
});

// La app trae un proyecto puesto para que quien abre el enlace pueda crear su
// cuenta sin pegar nada. Sin esto, el primer paso de una app social seria un
// formulario de configuracion.
test('sin configuracion propia se usa el proyecto por defecto', () => {
  olvidarTodo();
  const cfg = configuracion();
  assert.equal(cfg.url, NUBE_POR_DEFECTO.url);
  assert.equal(cfg.porDefecto, true, 'se distingue de una configurada a mano');
  assert.equal(estaConfigurada(), true, 'la app arranca conectada');

  configurar({ url: 'https://mio.supabase.co', anonKey: PUBLICA });
  assert.equal(configuracion().url, 'https://mio.supabase.co', 'lo propio tiene preferencia');
  assert.equal(configuracion().porDefecto, undefined);
  olvidarTodo();
  assert.equal(configuracion().url, NUBE_POR_DEFECTO.url, 'y al olvidarlo se vuelve al de serie');
});

// La clave que se publica tiene que ser publishable. Si algun dia alguien pega
// la secreta en la constante, esta prueba lo para antes de que se despliegue.
test('el proyecto por defecto nunca lleva una clave secreta', () => {
  assert.equal(esClaveSecreta(NUBE_POR_DEFECTO.anonKey), null);
  assert.match(NUBE_POR_DEFECTO.url, /^https:\/\/[a-z0-9-]+\.supabase\.co$/);
});
