/**
 * Pruebas de la puerta de entrada. Lo que se prueba aqui es la LOGICA que no
 * depende del DOM: sugerir el mote, traducir los errores de GoTrue y decidir
 * el camino del alta. La parte visual se comprueba en el navegador.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { moteSugerido, mensajeDeAcceso, altaCompleta, entradaCompleta, tocaBienvenida }
  from '../src/ui/vistas/bienvenida.js';
import { validarMote, guardarMotePendiente, motePendiente } from '../src/core/social.js';

test('el mote se sugiere a partir del nombre y siempre sale valido', () => {
  assert.equal(moteSugerido('Ana García'), 'ana_garcia');
  assert.equal(moteSugerido('José-María  Núñez'), 'jose_maria',
    'se corta por palabra entera, no a media palabra');
  assert.equal(moteSugerido('Ëcö Wärrior'), 'eco_warrior');
  // Un nombre larguisimo se recorta sin dejar el guion bajo colgando al final.
  const largo = moteSugerido('Maximiliano Fernandez de la Torre');
  assert.ok(largo.length <= 15, `${largo} mide ${largo.length}`);
  assert.ok(!largo.endsWith('_'), `${largo} termina en guion bajo`);
  // Y lo que sugiere tiene que pasar el mismo validador que el formulario.
  for (const n of ['Ana García', 'José-María Núñez', 'Maximiliano Fernandez de la Torre']) {
    assert.equal(validarMote(moteSugerido(n)).ok, true, n);
  }
});

test('un nombre sin letras utiles no inventa un mote invalido', () => {
  // Preferimos no sugerir nada a sugerir algo que el validador rechaza: un
  // campo que se autorrellena con un valor invalido es peor que uno vacio.
  for (const n of ['', '   ', '!!', 'Al', '中文']) {
    const m = moteSugerido(n);
    assert.ok(m === '' || validarMote(m).ok, `"${n}" produjo "${m}"`);
  }
});

test('los errores de GoTrue se traducen a algo accionable', () => {
  const yaExiste = mensajeDeAcceso(new Error('User already registered'));
  assert.match(yaExiste.texto, /ya tiene cuenta/);
  assert.equal(yaExiste.ir, 'entrar', 'y lleva sola a la pantalla de entrar');

  assert.match(mensajeDeAcceso(new Error('Invalid login credentials')).texto, /incorrectos/);
  assert.match(mensajeDeAcceso(new Error('Email not confirmed')).texto, /confirmar el correo/);
  assert.match(mensajeDeAcceso(new Error('Password should be at least 6 characters')).texto, /6 caracteres/);
  assert.match(mensajeDeAcceso(new Error('Failed to fetch')).texto, /conexión/);
  // Lo que no reconoce se muestra tal cual en vez de tragarselo.
  assert.match(mensajeDeAcceso(new Error('Algo muy raro')).texto, /Algo muy raro/);
});

test('el alta pone el mote en el mismo paso cuando hay sesion', async () => {
  const puestos = [];
  const r = await altaCompleta(null, { nombre: 'Ana', mote: 'ana_verde', correo: 'a@b.sv', clave: '123456' }, {
    crearCuenta: async () => ({ ok: true, confirmacionPendiente: false }),
    fijarMote: async (m) => { puestos.push(m); return m; },
    avisar: () => {},
  });
  assert.deepEqual(puestos, ['ana_verde']);
  assert.equal(r.mote, 'ana_verde');
});

test('si falta confirmar el correo, el mote queda reservado para la primera entrada', async () => {
  guardarMotePendiente(null);
  const r = await altaCompleta(null, { nombre: 'Luis', mote: 'luis_bici', correo: 'l@b.sv', clave: '123456' }, {
    crearCuenta: async () => ({ ok: true, confirmacionPendiente: true }),
    fijarMote: async () => { throw new Error('no deberia intentarse sin sesion'); },
    avisar: () => {},
  });
  assert.equal(r.confirmacionPendiente, true);
  assert.equal(motePendiente(), 'luis_bici', 'se guarda para no tener que volver a elegirlo');

  const puestos = [];
  await entradaCompleta(null, { correo: 'l@b.sv', clave: '123456' }, {
    entrar: async () => ({ perfilId: 'x' }),
    fijarMote: async (m) => { puestos.push(m); return m; },
    avisar: () => {},
  });
  assert.deepEqual(puestos, ['luis_bici'], 'se aplica solo al entrar');
  assert.equal(motePendiente(), null, 'y se limpia para no repetirlo');
});

test('un mote ocupado no tumba el alta: la cuenta ya existe', async () => {
  // Si se lanzara el error, la persona veria "fallo el registro" cuando en
  // realidad su cuenta se creo. Volver a intentarlo daria "correo ya usado".
  const r = await altaCompleta(null, { nombre: 'Ana', mote: 'ocupado', correo: 'a@b.sv', clave: '123456' }, {
    crearCuenta: async () => ({ ok: true, confirmacionPendiente: false }),
    fijarMote: async () => { throw new Error('El mote "ocupado" ya esta cogido.'); },
    avisar: () => {},
  });
  assert.equal(r.confirmacionPendiente, false);
  assert.equal(r.mote, null, 'se avisa de que el mote quedo sin poner');
});

test('la portada solo se impone en la primera visita sin cuenta', () => {
  assert.equal(tocaBienvenida(false, () => false), true, 'sin sesion y sin haberla visto');
  assert.equal(tocaBienvenida(false, () => true), false, 'ya la salto una vez');
  assert.equal(tocaBienvenida(true, () => false), false, 'con sesion se va al panel');
});
