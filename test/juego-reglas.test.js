/**
 * juego-reglas.test.js — Las reglas de Monte Adentro.
 *
 * Todas las reglas del juego son funciones puras sobre el estado, asi que se
 * pueden comprobar sin navegador: si estas pruebas pasan, el juego es justo
 * aunque el motor grafico cambie entero.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OBJETOS, esComida, valorObjeto } from '../src/juego/contenido/objetos.js';
import { RECETAS, receta } from '../src/juego/contenido/recetas.js';
import { CULTIVOS } from '../src/juego/contenido/cultivos.js';
import { HALLAZGOS } from '../src/juego/contenido/plantas.js';
import { PECES } from '../src/juego/contenido/peces.js';
import { CAPITULOS, PERSONAJES } from '../src/juego/contenido/capitulos.js';
import { AMBIENTE, frasePara } from '../src/juego/contenido/dialogos.js';
import { crearInventario, agregar, quitar, cuenta, peso, cargaMaxima, listar, transferir, valorTotal, CARGA_BASE } from '../src/juego/reglas/inventario.js';
import { crearNecesidades, actualizar, comer, beber, banarse, dormir, penalizaciones, ACTIVIDADES } from '../src/juego/reglas/necesidades.js';
import { crearHabilidades, ganar, nivelDesde, xpParaNivel, desbloqueado, bono, nivel, HABILIDADES } from '../src/juego/reglas/habilidades.js';
import { crearCuadro, arar, sembrar, regar, deshierbar, avanzarDia, cosechar, etapaDe, listoParaCosechar, diagnostico } from '../src/juego/reglas/cultivo.js';
import { buscar, posibles, juntarLena, disponible, agotar } from '../src/juego/reglas/recoleccion.js';
import { crearLance, avanzarLance, calidadPunto, elegirPez, cobrar, tirarAtarraya } from '../src/juego/reglas/pesca.js';
import { crearApuntado, posicionMira, disparar, resolverTiro, revisarTrampa, probabilidadEstimada, ARMAS } from '../src/juego/reglas/caza.js';
import { disponibles as recetasDisponibles, puedeCocinar, cocinar } from '../src/juego/reglas/cocina.js';
import { crearHogar, entregar, entregarTodo, faltantes, cerrarDia, racionesDisponibles, valorAporte, humorFamilia, CONSUMO } from '../src/juego/reglas/hogar.js';
import { partidaNueva, guardar, cargar, contar, contarEntrega, contarReceta, conocimientos, contadoresNuevos } from '../src/juego/nucleo/estado.js';
import { disponibles as capitulosDisponibles, activar, evaluarObjetivo, evaluarCapitulo, intentarCompletar, resumen, hechos } from '../src/juego/reglas/progresion.js';
import { interaccionesCerca, ejecutar, cargaRelativa } from '../src/juego/reglas/acciones.js';
import { Terreno, LUGARES } from '../src/juego/mundo/terreno.js';
import { repartir, cuadrosMilpa } from '../src/juego/mundo/dispersion.js';
import { Fauna, PERFILES } from '../src/juego/mundo/fauna.js';

/** Generador determinista para que las pruebas no dependan del azar. */
function dado(semilla = 1) {
  let s = semilla;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// ------------------------------------------------------------- contenido
test('el catalogo de objetos esta completo y es coherente', () => {
  for (const [id, o] of Object.entries(OBJETOS)) {
    assert.ok(o.nombre && o.icono, `${id} sin nombre o icono`);
    assert.ok(o.peso > 0, `${id} sin peso`);
    assert.ok(['recurso', 'comida', 'crudo', 'semilla', 'herramienta', 'material'].includes(o.tipo), `${id} con tipo raro: ${o.tipo}`);
  }
  assert.ok(esComida('tortilla') && !esComida('pescado'));
  assert.ok(valorObjeto('cuero') > valorObjeto('mora'));
});

test('todas las recetas usan ingredientes y producen objetos que existen', () => {
  for (const r of RECETAS) {
    assert.ok(OBJETOS[r.produce.id], `${r.id} produce algo inexistente: ${r.produce.id}`);
    for (const id of Object.keys(r.ingredientes)) assert.ok(OBJETOS[id], `${r.id} pide ${id}, que no existe`);
    if (r.herramienta) assert.ok(OBJETOS[r.herramienta], `${r.id} pide herramienta inexistente`);
    assert.ok(r.minutos > 0 && r.xp > 0);
  }
});

test('los cultivos, hallazgos y peces apuntan a objetos reales', () => {
  for (const [id, c] of Object.entries(CULTIVOS)) {
    assert.ok(OBJETOS[c.semilla] && OBJETOS[c.grano], `cultivo ${id} mal enlazado`);
    assert.ok(c.dias > 0 && c.rendimiento[1] > c.rendimiento[0]);
  }
  for (const h of HALLAZGOS) assert.ok(OBJETOS[h.objeto], `hallazgo ${h.id} da ${h.objeto}`);
  for (const p of PECES) assert.ok(OBJETOS[p.objeto], `pez ${p.id} da ${p.objeto}`);
});

test('los capitulos forman una cadena valida y sin objetivos imposibles', () => {
  const ids = new Set(CAPITULOS.map((c) => c.id));
  const tipos = new Set(['entregar', 'entregarCategoria', 'juntar', 'accion', 'cocinar', 'sembrar',
    'cosechar', 'habilidad', 'dias', 'estrellas', 'valor', 'lugar']);
  for (const c of CAPITULOS) {
    assert.ok(c.titulo && c.subtitulo && c.consejo, `${c.id} incompleto`);
    for (const r of c.requiere) assert.ok(ids.has(r), `${c.id} depende de ${r}, que no existe`);
    assert.ok(c.objetivos.length > 0);
    for (const o of c.objetivos) {
      assert.ok(tipos.has(o.tipo), `${c.id}/${o.id} usa el tipo desconocido ${o.tipo}`);
      assert.ok(o.texto, `${c.id}/${o.id} sin texto`);
      if (o.objeto) assert.ok(OBJETOS[o.objeto], `${c.id}/${o.id} pide ${o.objeto}`);
      if (o.receta) assert.ok(receta(o.receta), `${c.id}/${o.id} pide la receta ${o.receta}`);
      if (o.habilidad) assert.ok(HABILIDADES[o.habilidad], `${c.id}/${o.id} pide la habilidad ${o.habilidad}`);
    }
    for (const linea of [...c.intro, ...c.cierre]) {
      assert.ok(PERSONAJES[linea.quien], `${c.id} habla un personaje desconocido: ${linea.quien}`);
      assert.ok(linea.texto.length > 0);
    }
  }
  assert.equal(CAPITULOS.filter((c) => c.requiere.length === 0).length, 1, 'tiene que haber un unico comienzo');
});

test('los dialogos de ambiente estan bien formados', () => {
  for (const d of AMBIENTE) assert.ok(PERSONAJES[d.quien] && d.texto);
  const f = frasePara({ hora: 6, clima: { lluvia: 0, nubosidad: 0.1 }, necesidades: { aguante: 100, higiene: 90 }, aguaEnCasa: 0 }, () => 0);
  assert.ok(f && f.texto);
});

// ------------------------------------------------------------ inventario
test('el inventario respeta el peso y no admite herramientas repetidas', () => {
  const inv = crearInventario({ cantaro: 1 });
  assert.equal(cargaMaxima(inv, 1), CARGA_BASE);
  const r = agregar(inv, 'agua', 10, 1);
  assert.equal(r.anadido, 10);
  assert.equal(agregar(inv, 'lena', 3, 1).anadido, 3);
  assert.ok(peso(inv) <= cargaMaxima(inv, 1), 'se paso de peso');
  assert.equal(agregar(inv, 'lena', 5, 1).anadido, 0, 'deberia estar lleno');
  assert.ok(agregar(inv, 'cantaro', 1, 1).repetido, 'no se pueden llevar dos cantaros');
  assert.equal(quitar(inv, 'agua', 4), 4);
  assert.equal(cuenta(inv, 'agua'), 6);
  assert.equal(quitar(inv, 'agua', 99), 6);
  assert.equal(cuenta(inv, 'agua'), 0);
});

test('la canasta y la fuerza suben la carga', () => {
  const sin = crearInventario({});
  const con = crearInventario({ canasta: 1 });
  assert.ok(cargaMaxima(con, 1) > cargaMaxima(sin, 1));
  assert.ok(cargaMaxima(sin, 4) > cargaMaxima(sin, 1));
});

test('transferir mueve cosas entre inventarios', () => {
  const a = crearInventario({ maiz: 5 });
  const b = crearInventario({});
  assert.equal(transferir(a, b, 'maiz', 3, 99), 3);
  assert.equal(cuenta(a, 'maiz'), 2);
  assert.equal(cuenta(b, 'maiz'), 3);
  assert.ok(valorTotal(b) > 0);
  assert.equal(listar(b)[0].id, 'maiz');
});

// ----------------------------------------------------------- necesidades
test('trabajar cansa, comer alimenta y dormir repone', () => {
  const n = crearNecesidades();
  const hambreInicial = n.hambre;
  actualizar(n, 3, { actividad: 'trabajar', temperatura: 32, cargaRelativa: 0.9 });
  assert.ok(n.hambre < hambreInicial && n.sed < 74);
  assert.ok(n.aguante < 100, 'trabajar tiene que cansar');
  comer(n, OBJETOS.tortilla);
  assert.ok(n.hambre > hambreInicial - 20);
  beber(n, 2);
  const antesBano = n.animo;
  banarse(n);
  assert.equal(n.higiene, 100);
  assert.ok(n.animo > antesBano);
  dormir(n, 8);
  assert.equal(n.aguante, 100);
});

test('quedarse quieto recupera el aguante', () => {
  const n = crearNecesidades();
  n.aguante = 20;
  actualizar(n, 0.5, { actividad: 'quieto' });
  assert.ok(n.aguante > 20, 'descansar deberia reponer');
});

test('el cansancio y el hambre penalizan', () => {
  const n = crearNecesidades();
  n.aguante = 5; n.hambre = 10; n.sed = 8;
  const p = penalizaciones(n);
  assert.ok(p.velocidad < 0.8 && p.punteria < 0.8);
  assert.ok(p.aviso, 'tendria que avisar de algo');
  const sano = penalizaciones(crearNecesidades());
  assert.ok(sano.velocidad > p.velocidad);
});

// ----------------------------------------------------------- habilidades
test('la experiencia sube de nivel y desbloquea cosas', () => {
  const h = crearHabilidades();
  assert.equal(nivelDesde(0).nivel, 1);
  assert.ok(xpParaNivel(5) > xpParaNivel(4), 'la curva tiene que ser creciente');
  let subidas = 0;
  for (let i = 0; i < 20; i++) { if (ganar(h, 'pesca', 30).subio) subidas++; }
  assert.ok(subidas >= 3);
  const set = desbloqueado(h);
  assert.ok(set.has('cebo'), 'pesca 2 deberia dar el cebo');
  assert.ok(bono(h, 'pesca') > 1);
  assert.equal(nivel(crearHabilidades(), 'caza'), 1);
  assert.throws(() => ganar(h, 'inventada', 10));
});

// --------------------------------------------------------------- cultivo
test('un cuadro pide arado antes de sembrar', () => {
  const q = crearCuadro('p1');
  assert.equal(sembrar(q, 'maiz', 1).ok, false);
  assert.ok(arar(q).ok);
  assert.ok(sembrar(q, 'maiz', 1).ok);
  assert.equal(sembrar(q, 'frijol', 1).ok, false, 'no caben dos cultivos');
});

test('el maiz cuidado rinde y el abandonado en seca se pierde', () => {
  const rnd = dado(3);
  const cuidado = crearCuadro('a'); arar(cuidado); sembrar(cuidado, 'maiz', 1);
  for (let d = 0; d < 20 && !listoParaCosechar(cuidado); d++) {
    regar(cuidado, 6);
    if (cuidado.maleza > 0.4) deshierbar(cuidado);
    avanzarDia(cuidado, { agua: 0, temperatura: 28, estacion: 'seca', rnd });
  }
  const bueno = cosechar(cuidado, { rnd });
  assert.ok(bueno.ok && bueno.cantidad >= 4, `cosecha floja: ${JSON.stringify(bueno)}`);
  assert.ok(bueno.semillas >= 1, 'siempre tiene que quedar semilla');

  const abandonado = crearCuadro('b'); arar(abandonado); sembrar(abandonado, 'maiz', 1);
  for (let d = 0; d < 20; d++) avanzarDia(abandonado, { agua: 0, temperatura: 32, estacion: 'seca', rnd });
  assert.equal(etapaDe(abandonado), 'perdido');
});

test('el arroz necesita agua y el frijol perdona', () => {
  const rnd = dado(9);
  const salud = (cultivo) => {
    const q = crearCuadro('x'); arar(q); sembrar(q, cultivo, 1);
    for (let d = 0; d < 10; d++) avanzarDia(q, { agua: 0.35, temperatura: 28, estacion: 'lluvias', rnd });
    return q.salud;
  };
  assert.ok(salud('frijol') > salud('arroz'), 'el frijol tiene que aguantar mejor la falta de agua');
});

test('la maleza y la plaga bajan la calidad', () => {
  const rnd = dado(5);
  const q = crearCuadro('c'); arar(q); sembrar(q, 'maiz', 1);
  q.maleza = 1; q.plaga = 1;
  for (let d = 0; d < 15; d++) { regar(q, 6); avanzarDia(q, { agua: 0.6, temperatura: 27, estacion: 'lluvias', rnd }); }
  assert.ok(q.salud < 0.6, `salud ${q.salud}`);
  assert.ok(diagnostico(q).includes('maleza') || etapaDe(q) === 'perdido');
});

// ------------------------------------------------------------ recoleccion
test('el monte da segun el mes y lo que se sabe', () => {
  const base = { fuente: 'monte', zona: 'monte', lluviaReciente: true };
  const sinSaber = posibles({ ...base, mes: 4, sabe: new Set() }).map((h) => h.id);
  const sabiendo = posibles({ ...base, mes: 4, sabe: new Set(['hongos', 'colmena']) }).map((h) => h.id);
  assert.ok(!sinSaber.includes('hongos') && sabiendo.includes('hongos'));
  assert.ok(sabiendo.includes('miel'));
  const enero = posibles({ ...base, mes: 0, sabe: new Set(['hongos']) }).map((h) => h.id);
  assert.ok(!enero.includes('hongos'), 'en enero no hay hongos');
  const sinLluvia = posibles({ ...base, mes: 4, sabe: new Set(['hongos']), lluviaReciente: false }).map((h) => h.id);
  assert.ok(!sinLluvia.includes('hongos'), 'sin lluvia no salen hongos');
});

test('rebuscar da cosas y a veces nada', () => {
  const rnd = dado(11);
  let conAlgo = 0;
  for (let i = 0; i < 200; i++) {
    const r = buscar({ fuente: 'frutal', especie: 'mango', mes: 3, sabe: new Set(), rnd, bono: 1 });
    if (!r.vacio) { conAlgo++; assert.ok(r.objetos.every((o) => OBJETOS[o.id])); }
  }
  assert.ok(conAlgo > 120 && conAlgo < 200, `hallazgos: ${conAlgo}/200`);
});

test('rajar un tronco pide machete', () => {
  assert.equal(juntarLena('rajar', {}).ok, false);
  const r = juntarLena('rajar', { tieneMachete: true, rnd: dado(2) });
  assert.ok(r.ok && r.objetos[0].id === 'lena' && r.objetos[0].cantidad === 3);
});

test('un recurso agotado tarda dias en volver', () => {
  const r = {};
  agotar(r, 10, 'frutal');
  assert.equal(disponible(r, 11), false);
  assert.equal(disponible(r, 13), true);
});

// ---------------------------------------------------------------- pesca
test('la poza honda al amanecer es mejor que el remanso a mediodia', () => {
  const buena = calidadPunto({ hondura: 0.85, hora: 5.5, cebo: true, bono: 1.4 });
  const mala = calidadPunto({ hondura: 0.1, hora: 13, bono: 1 });
  assert.ok(buena > mala * 2, `buena=${buena} mala=${mala}`);
  assert.ok(buena <= 1 && mala > 0);
});

test('los peces grandes solo salen en poza honda', () => {
  const rnd = dado(4);
  const enCharco = new Set();
  const enPoza = new Set();
  for (let i = 0; i < 200; i++) {
    enCharco.add(elegirPez({ hondura: 0.05, hora: 12, bono: 1 }, rnd).id);
    enPoza.add(elegirPez({ hondura: 0.9, hora: 5.5, bono: 1.8 }, rnd).id);
  }
  assert.ok(!enCharco.has('tepemechin'), 'el tepemechin no puede salir en un charco');
  assert.ok(enPoza.size > enCharco.size);
});

test('la linea se revienta si se tira sin soltar', () => {
  const rnd = dado(7);
  const lance = crearLance({ hondura: 0.8, hora: 6, bono: 1 }, rnd);
  lance.estado = 'luchando'; lance.tiempo = 0;
  for (let t = 0; t < 400 && lance.estado === 'luchando'; t++) avanzarLance(lance, 0.05, true);
  assert.ok(['roto', 'cobrado'].includes(lance.estado));
  const bien = crearLance({ hondura: 0.8, hora: 6, bono: 1 }, rnd);
  bien.estado = 'luchando'; bien.tiempo = 0;
  for (let t = 0; t < 800 && bien.estado === 'luchando'; t++) avanzarLance(bien, 0.05, bien.tension < 0.6);
  assert.equal(bien.estado, 'cobrado', 'soltando a tiempo se tiene que cobrar');
  const premio = cobrar(bien);
  assert.ok(premio.ok && premio.objetos[0].id === 'pescado' && premio.xp > 0);
});

test('si no se clava a tiempo, el pez se lleva el cebo', () => {
  const lance = crearLance({ hondura: 0.5, hora: 6, bono: 1 }, dado(13));
  lance.espera = 0.1;
  avanzarLance(lance, 0.2, false, false);
  assert.equal(lance.estado, 'picando');
  avanzarLance(lance, 3, false, false);
  assert.equal(lance.estado, 'escapado');
});

test('la atarraya saca varios de una vez', () => {
  const rnd = dado(6);
  let total = 0;
  for (let i = 0; i < 30; i++) total += tirarAtarraya({ hondura: 0.8, hora: 6, bono: 1.3 }, rnd).objetos[0]?.cantidad || 0;
  assert.ok(total > 30, `la atarraya rindio ${total} en 30 tiradas`);
});

// ----------------------------------------------------------------- caza
test('la mira se mueve mas cuanto mas lejos y mas cansado', () => {
  const cerca = crearApuntado({ arma: 'hondilla', distancia: 5, punteria: 1, bono: 1 });
  const lejos = crearApuntado({ arma: 'hondilla', distancia: 14, punteria: 1, bono: 1 });
  const cansado = crearApuntado({ arma: 'hondilla', distancia: 5, punteria: 0.4, bono: 1 });
  const agachado = crearApuntado({ arma: 'hondilla', distancia: 5, punteria: 1, bono: 1, agachado: true });
  assert.ok(lejos.oscilacion > cerca.oscilacion);
  assert.ok(cansado.oscilacion > cerca.oscilacion);
  assert.ok(agachado.oscilacion < cerca.oscilacion);
  const m = posicionMira(cerca, 1.3);
  assert.ok(Number.isFinite(m.x) && Number.isFinite(m.y));
});

test('el viento desvia el tiro', () => {
  const conViento = crearApuntado({ arma: 'hondilla', distancia: 12, punteria: 1, bono: 1, viento: { fuerza: 1, direccion: 0 } });
  const sinViento = crearApuntado({ arma: 'hondilla', distancia: 12, punteria: 1, bono: 1, viento: { fuerza: 0, direccion: 0 } });
  assert.ok(conViento.deriva > sinViento.deriva);
  assert.ok(disparar(conViento, 0.4).desvio > 0);
  assert.ok(probabilidadEstimada(sinViento, PERFILES.venado) > probabilidadEstimada(conViento, PERFILES.venado));
});

test('un tiro centrado cobra y uno desviado espanta', () => {
  const rnd = dado(8);
  const centrado = resolverTiro({ animal: PERFILES.venado, desvio: 0.05, distancia: 8, arma: 'hondilla', rnd });
  assert.ok(centrado.acierto && centrado.limpio && centrado.presa.objeto === 'carne_venado');
  const fallo = resolverTiro({ animal: PERFILES.venado, desvio: 3, distancia: 8, arma: 'hondilla', rnd });
  assert.ok(!fallo.acierto && fallo.huye);
  const lejisimos = resolverTiro({ animal: PERFILES.venado, desvio: 0.01, distancia: 40, arma: 'hondilla', rnd });
  assert.ok(!lejisimos.acierto, 'a 40 m la piedra no llega');
  assert.ok(ARMAS.hondilla_larga.alcance > ARMAS.hondilla.alcance);
});

test('la trampa hay que dejarla la noche entera', () => {
  const rnd = dado(12);
  assert.equal(revisarTrampa({ dia: 3 }, 3, { rnd }).ok, false);
  let cayo = 0;
  for (let i = 0; i < 100; i++) if (!revisarTrampa({ dia: 3 }, 4, { rnd }).vacia) cayo++;
  assert.ok(cayo > 20 && cayo < 90, `cayo algo el ${cayo}% de las veces`);
});

// --------------------------------------------------------------- cocina
test('cocinar gasta ingredientes y lena, y produce comida', () => {
  const inv = crearInventario({ maiz: 6, agua: 4, lena: 3 });
  assert.ok(puedeCocinar('tortilla', inv).ok);
  const r = cocinar('tortilla', inv, { nivelFuerza: 3 });
  assert.ok(r.ok);
  assert.equal(cuenta(inv, 'maiz'), 3);
  assert.equal(cuenta(inv, 'lena'), 2);
  assert.equal(cuenta(inv, 'tortilla'), 2);
  assert.ok(r.xp > 0 && r.minutos > 0);
});

test('sin saber cocinar no hay guisos, y sin lena no hay fuego', () => {
  const inv = crearInventario({ agua: 4, hierbas: 2, ayote: 2, lena: 4 });
  assert.equal(puedeCocinar('sopa', inv, { sabe: new Set() }).ok, false);
  assert.ok(puedeCocinar('sopa', inv, { sabe: new Set(['cocina']) }).ok);
  const sinLena = crearInventario({ maiz: 6, agua: 4 });
  const fallo = puedeCocinar('tortilla', sinLena);
  assert.equal(fallo.ok, false);
  assert.ok(fallo.faltan.some((f) => f.id === 'lena'));
  assert.ok(recetasDisponibles('fogon', new Set()).length < recetasDisponibles('fogon', new Set(['cocina'])).length);
});

test('la despensa de la casa completa lo que falta en la canasta', () => {
  const inv = crearInventario({ maiz: 3, lena: 2 });
  const despensa = crearInventario({ agua: 5 });
  const r = cocinar('tortilla', inv, { despensa, nivelFuerza: 2 });
  assert.ok(r.ok);
  assert.equal(cuenta(despensa, 'agua'), 4);
});

// ---------------------------------------------------------------- hogar
test('la casa consume cada dia y lo puntua', () => {
  const h = crearHogar();
  const f = faltantes(h);
  assert.deepEqual(f, { agua: CONSUMO.agua, lena: CONSUMO.lena, raciones: CONSUMO.raciones });
  const inv = crearInventario({ agua: 10, lena: 4, tortilla: 3, pescado_asado: 2 });
  const entregas = entregarTodo(h, inv);
  assert.ok(entregas.length >= 3);
  assert.equal(Object.keys(inv).length, 0, 'tendria que haber entregado todo');
  assert.ok(racionesDisponibles(h.despensa) >= CONSUMO.raciones);
  const parte = cerrarDia(h, 1);
  assert.equal(parte.faltas, 0);
  assert.ok(parte.estrellas >= 2);
  assert.equal(h.diasSeguidos, 1);
  assert.ok(cuenta(h.despensa, 'agua') < 10, 'la casa tiene que haber bebido');
});

test('un dia sin traer nada cuesta estrellas y animo', () => {
  const h = crearHogar();
  const animo = h.animoFamilia;
  const parte = cerrarDia(h, 1);
  assert.equal(parte.estrellas, 0);
  assert.ok(parte.texto.includes('Faltó'));
  assert.ok(h.animoFamilia < animo);
  assert.equal(h.diasSeguidos, 0);
  assert.ok(humorFamilia(h).length > 0);
});

test('las herramientas no se entregan y el agua vale mas que un material', () => {
  const h = crearHogar();
  const inv = crearInventario({ machete: 1, agua: 3 });
  entregarTodo(h, inv);
  assert.equal(cuenta(inv, 'machete'), 1, 'el machete se queda con el nino');
  assert.equal(cuenta(h.despensa, 'agua'), 3);
  assert.ok(valorAporte('agua', 3) > valorAporte('fibra', 3));
});

// ------------------------------------------------------------ progresion
test('los capitulos se desbloquean en cadena', () => {
  const e = partidaNueva({ semilla: 1 });
  assert.deepEqual(capitulosDisponibles(e).map((c) => c.id), ['agua']);
  assert.ok(activar(e, 'agua').ok);
  assert.equal(activar(e, 'agua').ok, true, 'reactivar el activo no rompe');
  contarEntrega(e, 'agua', 9, 'recurso');
  contarEntrega(e, 'lena', 3, 'recurso');
  const ev = evaluarCapitulo(e.capitulos.activo ? CAPITULOS[0] : CAPITULOS[0], e);
  assert.ok(ev.completado);
  const fin = intentarCompletar(e);
  assert.ok(fin && fin.capitulo.id === 'agua');
  assert.ok(cuenta(e.jugador.inventario, 'canasta') === 1, 'el premio se entrega');
  assert.ok(hechos(e).has('agua'));
  const ahora = capitulosDisponibles(e).map((c) => c.id);
  assert.ok(ahora.includes('monte') && ahora.includes('rio'));
  const r = resumen(e);
  assert.equal(r.completados, 1);
  assert.equal(r.total, CAPITULOS.length);
});

test('los objetivos cuentan desde que empieza el capitulo, no desde siempre', () => {
  const e = partidaNueva({ semilla: 2 });
  contarEntrega(e, 'agua', 20, 'recurso');   // trabajo anterior
  activar(e, 'agua');
  const ev = evaluarObjetivo({ tipo: 'entregar', objeto: 'agua', meta: 9 }, e);
  assert.equal(ev.valor, 0, 'lo de antes no deberia contar');
  contarEntrega(e, 'agua', 9, 'recurso');
  assert.ok(evaluarObjetivo({ tipo: 'entregar', objeto: 'agua', meta: 9 }, e).hecho);
});

test('los objetivos por habilidad, dias y valor se miden bien', () => {
  const e = partidaNueva({ semilla: 3 });
  ganar(e.jugador.habilidades, 'fuerza', xpParaNivel(3));
  assert.ok(evaluarObjetivo({ tipo: 'habilidad', habilidad: 'fuerza', meta: 3 }, e).hecho);
  e.hogar.diasSeguidos = 4;
  assert.ok(evaluarObjetivo({ tipo: 'dias', meta: 4 }, e).hecho);
  agregar(e.jugador.inventario, 'cuero', 3, 9);
  assert.ok(evaluarObjetivo({ tipo: 'valor', meta: 40 }, e).hecho);
  contarReceta(e, 'tortilla');
  assert.ok(evaluarObjetivo({ tipo: 'cocinar', receta: 'tortilla', meta: 1 }, e).hecho);
});

// ---------------------------------------------------------------- estado
test('la partida se guarda y se recupera entera', () => {
  const alm = { d: {}, setItem(k, v) { this.d[k] = v; }, getItem(k) { return this.d[k] || null; }, removeItem(k) { delete this.d[k]; } };
  const e = partidaNueva({ semilla: 42, nombre: 'Chepe' });
  contar(e, 'pescar', 3);
  agregar(e.jugador.inventario, 'pescado', 2, 3);
  ganar(e.jugador.habilidades, 'pesca', 120);
  assert.ok(guardar(e, alm));
  const vuelta = cargar(alm);
  assert.equal(vuelta.nombre, 'Chepe');
  assert.equal(vuelta.contadores.pescar, 3);
  assert.equal(cuenta(vuelta.jugador.inventario, 'pescado'), 2);
  assert.equal(vuelta.jugador.habilidades.pesca, 120);
  assert.equal(cargar({ getItem: () => 'esto no es json' }), null, 'una partida rota no debe romper el arranque');
});

test('lo que el nino sabe suma habilidades e historia', () => {
  const e = partidaNueva({ semilla: 1 });
  e.sabe.push('cocina');
  ganar(e.jugador.habilidades, 'pesca', 400);
  const set = conocimientos(e);
  assert.ok(set.has('cocina') && set.has('cebo'));
});

// -------------------------------------------------------------- acciones
test('en el rio se puede beber, llenar y banarse; en la milpa se ara', () => {
  const terreno = new Terreno({ semilla: 77 });
  const reparto = repartir(terreno);
  const e = partidaNueva({ semilla: 77 });
  e.cuadros = cuadrosMilpa(terreno).map((c) => crearCuadro(c.id, c.x, c.y, c.z));
  const fauna = new Fauna(terreno, 77);
  const base = { estado: e, terreno, fauna, recursos: reparto.recursos, clima: { lluvia: 0, nubosidad: 0.2 },
    hora: 9, dia: 1, mes: 4, sabe: new Set(), rnd: dado(1) };

  const orilla = terreno.orillaCercana(LUGARES.casa.x, LUGARES.casa.z);
  const enRio = { ...base, jugador: { x: orilla[0], z: orilla[1] } };
  const ids = interaccionesCerca(enRio).map((o) => o.id);
  assert.ok(ids.includes('beber') && ids.includes('llenar') && ids.includes('banar'));

  const r = ejecutar({ id: 'llenar' }, enRio);
  assert.ok(r.ok && cuenta(e.jugador.inventario, 'agua') === OBJETOS.cantaro.capacidadAgua);
  assert.ok(cargaRelativa(e) > 0.5, 'con el cantaro lleno se va cargado');

  const enMilpa = { ...base, jugador: { x: LUGARES.milpa.x, z: LUGARES.milpa.z } };
  const ops = interaccionesCerca(enMilpa);
  assert.ok(ops.some((o) => o.id === 'arar'));
  const cuadro = ops.find((o) => o.id === 'arar').objetivo;
  assert.ok(ejecutar({ id: 'arar', objetivo: cuadro }, enMilpa).ok);
  const sinSemilla = ejecutar({ id: 'sembrar', objetivo: cuadro, cultivo: 'maiz' }, enMilpa);
  assert.equal(sinSemilla.ok, false, 'sin semilla no se siembra');
  agregar(e.jugador.inventario, 'semilla_maiz', 2, 9);
  assert.ok(ejecutar({ id: 'sembrar', objetivo: cuadro, cultivo: 'maiz' }, enMilpa).ok);
  assert.equal(cuenta(e.jugador.inventario, 'semilla_maiz'), 1);
});

test('en la casa se entrega y de noche se duerme', () => {
  const terreno = new Terreno({ semilla: 78 });
  const e = partidaNueva({ semilla: 78 });
  agregar(e.jugador.inventario, 'agua', 5, 9);
  const ctx = { estado: e, terreno, fauna: new Fauna(terreno, 1), recursos: [], clima: { lluvia: 0 },
    hora: 21, dia: 1, mes: 4, sabe: new Set(), rnd: dado(1),
    jugador: { x: LUGARES.casa.x, z: LUGARES.casa.z } };
  const ids = interaccionesCerca(ctx).map((o) => o.id);
  assert.ok(ids.includes('entregar') && ids.includes('dormir'));
  const r = ejecutar({ id: 'entregar' }, ctx);
  assert.ok(r.ok && r.aporte > 0);
  assert.equal(cuenta(e.hogar.despensa, 'agua'), 5);
  assert.ok(ejecutar({ id: 'dormir' }, ctx).dormir);
});

test('jugar bajo la lluvia solo se puede cuando llueve', () => {
  const terreno = new Terreno({ semilla: 79 });
  const e = partidaNueva({ semilla: 79 });
  const jugador = { x: LUGARES.potrero.x, z: LUGARES.potrero.z };
  const seco = { estado: e, terreno, fauna: new Fauna(terreno, 1), recursos: [], jugador,
    clima: { lluvia: 0, nubosidad: 0.1 }, hora: 14, dia: 1, mes: 4, sabe: new Set(), rnd: dado(1) };
  assert.ok(!interaccionesCerca(seco).some((o) => o.id === 'jugar_lluvia'));
  const mojado = { ...seco, clima: { lluvia: 0.8, nubosidad: 1 } };
  assert.ok(interaccionesCerca(mojado).some((o) => o.id === 'jugar_lluvia'));
  const r = ejecutar({ id: 'jugar_lluvia' }, mojado);
  assert.ok(r.ok && r.habilidad === 'espiritu' && r.xp > 10);
});
