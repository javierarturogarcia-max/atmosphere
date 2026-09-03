/**
 * juego-mundo.test.js — El valle, el clima, la fauna y el motor geometrico.
 * Todo lo que se comprueba aqui es determinista a proposito: la misma semilla
 * tiene que dar el mismo valle en cualquier maquina.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Terreno, LUGARES, NIVEL_AGUA, CAUCE } from '../src/juego/mundo/terreno.js';
import { repartir, cuadrosMilpa, puntosPesca } from '../src/juego/mundo/dispersion.js';
import { Fauna, PERFILES } from '../src/juego/mundo/fauna.js';
import { climaDelDia, climaEn, aguaDelDia, estacionDe, mesDe, nombreFecha, describirClima } from '../src/juego/mundo/clima.js';
import { Reloj } from '../src/juego/nucleo/reloj.js';
import { m4, multiplicar, invertir, perspectiva, mirarA, componer, transformar, fbm, limitar } from '../src/juego/nucleo/mate.js';
import { construir, Constructor, FLOTANTES_VERTICE } from '../src/juego/render/malla.js';
import { Escena, FLOTANTES_INSTANCIA } from '../src/juego/render/escena.js';
import { estadoCielo } from '../src/juego/render/cielo.js';
import * as MODELOS from '../src/juego/render/modelos.js';

// ------------------------------------------------------------------- mate
test('las matrices se multiplican e invierten bien', () => {
  const vista = mirarA([0, 5, 10], [0, 0, 0], [0, 1, 0]);
  const inv = invertir(vista);
  const ida = transformar(multiplicar(inv, vista), [1.5, -2, 3]);
  for (const [i, v] of [1.5, -2, 3].entries()) assert.ok(Math.abs(ida[i] - v) < 1e-4, `componente ${i}`);
});

test('la proyeccion deja la profundidad en [0,1]', () => {
  const p = perspectiva(1.1, 1.6, 0.1, 100);
  const cerca = transformar(p, [0, 0, -0.1]);
  const lejos = transformar(p, [0, 0, -100]);
  assert.ok(Math.abs(cerca[2] - 0) < 1e-3, `cerca=${cerca[2]}`);
  assert.ok(Math.abs(lejos[2] - 1) < 1e-3, `lejos=${lejos[2]}`);
});

test('componer coloca, gira y escala', () => {
  const m = componer([3, 4, 5], [0, Math.PI / 2, 0], 2);
  const p = transformar(m, [1, 0, 0]);
  assert.ok(Math.abs(p[0] - 3) < 1e-4);
  assert.ok(Math.abs(p[2] - (5 - 2)) < 1e-4, `z=${p[2]}`);
});

test('el ruido fbm es estable y esta acotado', () => {
  assert.equal(fbm(1.5, 2.5, 4, 7), fbm(1.5, 2.5, 4, 7));
  for (let i = 0; i < 200; i++) {
    const v = fbm(i * 0.37, i * 0.11, 5, 3);
    assert.ok(v >= 0 && v <= 1, `fuera de rango: ${v}`);
  }
});

// ----------------------------------------------------------------- mallas
test('el constructor de mallas produce buffers coherentes', () => {
  const m = construir('prueba', (c) => {
    c.caja({ ancho: 1, alto: 2, fondo: 1 });
    c.esfera({ radio: 0.5, en: [0, 2, 0] });
  });
  assert.equal(m.vertices.length % FLOTANTES_VERTICE, 0);
  assert.equal(m.cuenta % 3, 0);
  assert.ok(m.cuenta > 0 && m.radio > 0);
  const vertices = m.vertices.length / FLOTANTES_VERTICE;
  for (const i of m.indices) assert.ok(i < vertices, 'indice fuera de rango');
  for (const v of m.vertices) assert.ok(Number.isFinite(v), 'vertice no finito');
});

test('las normales salen normalizadas', () => {
  const m = construir('n', (c) => c.cilindro({ radio: 0.4, alto: 2, lados: 8 }));
  for (let k = 0; k < m.vertices.length; k += FLOTANTES_VERTICE) {
    const l = Math.hypot(m.vertices[k + 3], m.vertices[k + 4], m.vertices[k + 5]);
    assert.ok(Math.abs(l - 1) < 1e-3, `normal de longitud ${l}`);
  }
});

test('todo el catalogo de modelos se construye sin romperse', () => {
  const nombres = ['arbolCeiba', 'arbolPino', 'arbolMango', 'arbolJocote', 'arbolSeco', 'palmera',
    'matorral', 'matorralMora', 'helecho', 'hierba', 'roca', 'troncoCaido', 'pilaLena', 'parcela',
    'casa', 'fogon', 'gallinero', 'cerca', 'cantaro', 'canasta', 'senal', 'venado', 'conejo',
    'gallina', 'perro', 'pajaro', 'pez', 'quad'];
  for (const n of nombres) {
    const malla = MODELOS[n]();
    assert.ok(malla.cuenta > 0, `${n} sin triangulos`);
    assert.ok(Number.isFinite(malla.radio), `${n} con radio invalido`);
  }
  for (let e = 0; e < 4; e++) {
    for (const f of ['mataMaiz', 'mataFrijol', 'mataArroz', 'mataTrigo']) {
      assert.ok(MODELOS[f](e).cuenta > 0, `${f} etapa ${e}`);
    }
  }
  const piezas = MODELOS.piezasNino();
  assert.deepEqual(Object.keys(piezas).sort(),
    ['nino_brazo', 'nino_cabeza', 'nino_pierna', 'nino_sombrero', 'nino_torso']);
});

test('un lote guarda 24 flotantes por instancia y crece solo', () => {
  const esc = new Escena();
  const lote = esc.lote('r', MODELOS.roca(), { capacidad: 2 });
  const m = componer([1, 2, 3], [0, 0, 0], 1);
  for (let i = 0; i < 50; i++) lote.agregar(m, [1, 1, 1], 1, 0.5, 0, i);
  assert.equal(lote.n, 50);
  assert.ok(lote.datos.length >= 50 * FLOTANTES_INSTANCIA);
  assert.equal(lote.datos[12], 1, 'la matriz se copio en su sitio');
  assert.equal(esc.instancias, 50);
  esc.reiniciarDinamicos();
  assert.equal(lote.n, 0);
});

// ---------------------------------------------------------------- terreno
test('el valle es el mismo con la misma semilla', () => {
  const a = new Terreno({ semilla: 99 });
  const b = new Terreno({ semilla: 99 });
  const c = new Terreno({ semilla: 100 });
  for (const [x, z] of [[0, 0], [30, -20], [-60, 44]]) {
    assert.equal(a.altura(x, z), b.altura(x, z));
  }
  assert.notEqual(a.altura(12, 34), c.altura(12, 34));
});

test('el rio esta por debajo del nivel del agua y el resto del valle por encima', () => {
  const t = new Terreno({ semilla: 7 });
  for (const [x, z] of CAUCE.slice(1, -1)) {
    assert.ok(t.altura(x, z) < NIVEL_AGUA, `el cauce en ${x},${z} no esta hundido`);
  }
  let secos = 0, total = 0;
  for (let x = -100; x <= 100; x += 7) {
    for (let z = -100; z <= 100; z += 7) {
      total++;
      if (t.altura(x, z) > NIVEL_AGUA) secos++;
    }
  }
  assert.ok(secos / total > 0.85, `demasiada agua: ${(1 - secos / total).toFixed(2)}`);
});

test('la casa y la milpa quedan llanas y secas', () => {
  const t = new Terreno({ semilla: 3 });
  for (const clave of ['casa', 'milpa']) {
    const l = LUGARES[clave];
    assert.ok(!t.enAgua(l.x, l.z), `${clave} bajo el agua`);
    assert.ok(t.pendiente(l.x, l.z) < 0.05, `${clave} en cuesta`);
  }
  assert.equal(t.zona(LUGARES.casa.x, LUGARES.casa.z), 'casa');
  assert.equal(t.zona(LUGARES.milpa.x, LUGARES.milpa.z), 'milpa');
  assert.equal(t.zona(LUGARES.poza.x, LUGARES.poza.z), 'rio');
});

test('la poza es honda y la orilla mas cercana esta en el cauce', () => {
  const t = new Terreno({ semilla: 11 });
  assert.ok(t.profundidadAgua(LUGARES.poza.x, LUGARES.poza.z) > 3, 'la poza no es honda');
  const orilla = t.orillaCercana(LUGARES.casa.x, LUGARES.casa.z);
  assert.ok(Array.isArray(orilla) && orilla.length === 2);
  assert.ok(t.distanciaCauce(orilla[0], orilla[1]).d < 1.5);
});

test('fuera del valle no se puede andar', () => {
  const t = new Terreno({ semilla: 5 });
  assert.ok(t.dentro(0, 0));
  assert.ok(!t.dentro(t.mitad + 10, 0));
  assert.ok(!t.dentro(0, -t.mitad - 3));
});

// ------------------------------------------------------------- dispersion
test('el reparto de vegetacion es reproducible y respeta el agua', () => {
  const t = new Terreno({ semilla: 21 });
  const a = repartir(t);
  const b = repartir(t);
  assert.equal(a.plantas.length, b.plantas.length);
  assert.deepEqual(a.plantas[5], b.plantas[5]);
  assert.ok(a.plantas.length > 200, 'valle pelado');
  for (const p of a.plantas) assert.ok(!t.enAgua(p.x, p.z), 'planta dentro del rio');
  for (const r of a.recursos) assert.ok(['frutal', 'mata', 'lena', 'tronco'].includes(r.tipo));
  assert.ok(new Set(a.recursos.map((r) => r.id)).size === a.recursos.length, 'ids repetidos');
});

test('la milpa tiene cuadros y el rio puntos de pesca', () => {
  const t = new Terreno({ semilla: 4 });
  const cuadros = cuadrosMilpa(t);
  assert.equal(cuadros.length, LUGARES.milpa.filas * LUGARES.milpa.columnas);
  assert.ok(cuadros.every((c) => !t.enAgua(c.x, c.z)));
  const pesca = puntosPesca(t);
  assert.ok(pesca.length >= 5);
  assert.ok(pesca.every((p) => p.hondura > 0 && p.hondura <= 1));
});

// ------------------------------------------------------------------ clima
test('llueve en invierno y no en la seca', () => {
  let lluviaSeca = 0, lluviaInvierno = 0;
  for (let d = 1; d <= 360; d++) {
    const plan = climaDelDia(1234, d);
    const agua = aguaDelDia(plan);
    if (estacionDe(d) === 'seca') lluviaSeca += agua; else lluviaInvierno += agua;
  }
  assert.ok(lluviaInvierno > lluviaSeca * 4, `seca=${lluviaSeca.toFixed(1)} lluvias=${lluviaInvierno.toFixed(1)}`);
});

test('el clima del dia es determinista y coherente hora a hora', () => {
  const a = climaDelDia(8, 150);
  const b = climaDelDia(8, 150);
  assert.deepEqual(a.chubascos, b.chubascos);
  for (let h = 0; h < 24; h += 0.5) {
    const e = climaEn(a, h);
    assert.ok(e.lluvia >= 0 && e.lluvia <= 1.01, `lluvia ${e.lluvia}`);
    assert.ok(e.nubosidad >= 0 && e.nubosidad <= 1.01);
    assert.ok(e.viento.fuerza > 0);
    assert.ok(typeof describirClima(e) === 'string');
  }
});

test('el calendario cuadra', () => {
  assert.equal(mesDe(1), 0);
  assert.equal(mesDe(31), 1);
  assert.equal(estacionDe(150), 'lluvias');
  assert.equal(estacionDe(20), 'seca');
  assert.equal(nombreFecha(1), '1 de enero');
});

// ------------------------------------------------------------------ reloj
test('el reloj avanza y cambia de dia', () => {
  const r = new Reloj({ minutosPorDia: 16, hora: 23.9 });
  const paso = r.avanzar(10);
  assert.ok(paso.cambioDia);
  assert.equal(r.dia, 2);
  assert.ok(r.hora < 1);
  assert.equal(new Reloj({ hora: 12 }).esNoche, false);
  assert.equal(new Reloj({ hora: 23 }).esNoche, true);
  assert.equal(new Reloj({ hora: 8, minutosPorDia: 16 }).texto, '08:00');
});

test('dormir salta a la manana siguiente', () => {
  const r = new Reloj({ hora: 21, dia: 3 });
  const horas = r.saltarA(5.5);
  assert.ok(Math.abs(horas - 8.5) < 1e-6);
  assert.equal(r.dia, 4);
});

// ------------------------------------------------------------------ cielo
test('la luz sigue al sol y las estrellas solo salen de noche', () => {
  const dia = estadoCielo(12, { nubosidad: 0 });
  const noche = estadoCielo(0, { nubosidad: 0 });
  const alba = estadoCielo(6.5, { nubosidad: 0 });
  assert.ok(dia.intensidad > noche.intensidad * 5);
  assert.ok(dia.dirSol[1] > 0.75 && noche.dirSol[1] < 0);
  assert.ok(noche.estrellas > 0.5 && dia.estrellas === 0);
  assert.ok(alba.colorSol[0] > alba.colorSol[2], 'el amanecer tiene que tirar a naranja');
  const cubierto = estadoCielo(12, { nubosidad: 1 });
  assert.ok(cubierto.intensidad < dia.intensidad);
  for (const c of [dia, noche, alba, cubierto]) {
    assert.ok(c.niebla.densidad > 0 && Number.isFinite(c.niebla.densidad));
    assert.ok(c.ambiente.every((v) => v >= 0 && v <= 1));
  }
});

// ------------------------------------------------------------------ fauna
test('la fauna aparece segun la hora y solo donde puede vivir', () => {
  const t = new Terreno({ semilla: 6 });
  const f = new Fauna(t, 6);
  const clima = climaEn(climaDelDia(6, 100), 6.5);
  f.poblar(6.5, clima);
  const tipos = new Set(f.animales.map((a) => a.tipo));
  assert.ok(tipos.has('venado') && tipos.has('pez'));
  for (const a of f.animales) {
    if (a.perfil.nada) assert.ok(t.profundidadAgua(a.x, a.z) > 0, 'pez fuera del agua');
    else if (!a.perfil.vuela) assert.ok(!t.enAgua(a.x, a.z), `${a.tipo} dentro del rio`);
  }
  f.poblar(13, clima);
  assert.equal(f.animales.filter((a) => a.tipo === 'venado').length, 0, 'el venado no sale a mediodia');
});

test('el animal huye si haces ruido y no si vas agachado y sin viento', () => {
  const t = new Terreno({ semilla: 6 });
  const f = new Fauna(t, 6);
  const clima = climaEn(climaDelDia(6, 100), 6.5);
  f.poblar(6.5, clima);
  const venados = f.animales.filter((a) => a.tipo === 'venado');
  assert.ok(venados.length >= 2, 'hacen falta dos venados para la prueba');
  const [uno, otro] = venados;
  const ruidoso = { x: uno.x + 12, z: uno.z, ruido: 1, agachado: false };
  const sigiloso = { x: otro.x + 12, z: otro.z, ruido: 0.05, agachado: true };
  const vientoFuerte = { ...clima, viento: { x: 1, z: 0, fuerza: 1, direccion: 0 } };
  const sinViento = { ...clima, lluvia: 0, viento: { x: 0, z: 0, fuerza: 0, direccion: 0 } };
  const lejosAntes = Math.hypot(uno.x - ruidoso.x, uno.z - ruidoso.z);
  let huyo = false;
  for (let i = 0; i < 20; i++) {
    f.actualizar(0.25, { jugador: ruidoso, clima: vientoFuerte, tiempo: i });
    if (uno.estado === 'huir') huyo = true;
  }
  assert.ok(huyo, 'el venado no se asusto con ruido a 12 m');
  assert.ok(Math.hypot(uno.x - ruidoso.x, uno.z - ruidoso.z) > lejosAntes, 'no se alejo');

  let asustoSigiloso = false;
  for (let i = 0; i < 20; i++) {
    f.actualizar(0.25, { jugador: sigiloso, clima: sinViento, tiempo: i });
    if (otro.estado === 'huir') asustoSigiloso = true;
  }
  assert.ok(!asustoSigiloso, 'el sigiloso no deberia espantar al venado');
  assert.ok(otro.sospecha < 0.6, `el sigiloso levanto sospecha ${otro.sospecha}`);
});

test('el olfato depende de la direccion del viento', () => {
  const t = new Terreno({ semilla: 6 });
  const f = new Fauna(t, 6);
  const a = f.crear('venado', 0, 0);
  const jugador = { x: -8, z: 0, ruido: 0.1, agachado: true };
  const aFavor = f.percepcion(a, jugador, { viento: { x: 1, z: 0, fuerza: 1 } });   // hacia el animal
  const enContra = f.percepcion(a, jugador, { viento: { x: -1, z: 0, fuerza: 1 } });
  assert.ok(aFavor > enContra * 1.5, `a favor=${aFavor} en contra=${enContra}`);
});

test('cobrar una pieza la retira del mundo', () => {
  const t = new Terreno({ semilla: 6 });
  const f = new Fauna(t, 6);
  const a = f.crear('conejo', 5, 5);
  const antes = f.vivos;
  const presa = f.cobrar(a);
  assert.equal(presa.objeto, PERFILES.conejo.presa.objeto);
  assert.equal(f.vivos, antes - 1);
});
