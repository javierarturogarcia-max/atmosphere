/**
 * empaquetar.mjs — Empaquetador minimo sin dependencias, compartido por la
 * aplicacion y por el juego.
 *
 * Cada modulo se envuelve en su propia funcion factoria y se conecta mediante
 * un registro __req(), asi no hay colisiones de nombres entre modulos (varios
 * declaran `INDICE`, `safe`, `el`, etc.). Solo admite las formas de import y
 * export que usa este proyecto, y falla ruidosamente ante cualquier otra.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const RE_IMPORT = /^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/;
const RE_IMPORT_SIMPLE = /^import\s*['"]([^'"]+)['"];?\s*$/;
const RE_IMPORT_NS = /^import\s*\*\s*as\s+([A-Za-z0-9_$]+)\s+from\s*['"]([^'"]+)['"];?\s*$/;
const RE_EXPORT_LLAVES = /^export\s*\{([^}]+)\}\s*;?\s*$/;


function id(ruta) { return relative(RAIZ, ruta).replace(/\\/g, '/'); }

/** Lee un modulo, extrae dependencias y transforma import/export. */
function analizar(ruta, modulos) {
  const clave = id(ruta);
  if (modulos.has(clave)) return modulos.get(clave);

  // Los import pueden ocupar varias lineas: se colapsan a una sola antes de
  // escanear, para que el analisis por lineas siga siendo valido.
  const fuente = readFileSync(ruta, 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/g, (m) => m.replace(/\s+/g, ' '));
  const lineas = fuente.split('\n');
  const deps = [];
  const exportados = new Set();
  const salida = [];

  for (const linea of lineas) {
    const mImp = linea.match(RE_IMPORT);
    if (mImp) {
      // "import { a as b }" se traduce a desestructuracion con renombre,
      // que es exactamente lo mismo: const { a: b } = modulo.
      const nombres = mImp[1].split(',').map((s) => s.trim()).filter(Boolean)
        .map((n) => (n.includes(' as ') ? n.split(/\s+as\s+/).map((x) => x.trim()).join(': ') : n));
      const destino = resolve(dirname(ruta), mImp[2]);
      deps.push(destino);
      salida.push(`const { ${nombres.join(', ')} } = __req(${JSON.stringify(id(destino))});`);
      continue;
    }
    // import * as ns from './x.js'  ->  const ns = __req('x')
    // El objeto de exportaciones ya es un espacio de nombres plano, asi que el
    // acceso ns.funcion() funciona sin envoltorio adicional.
    const mNS = linea.match(RE_IMPORT_NS);
    if (mNS) {
      const destino = resolve(dirname(ruta), mNS[2]);
      deps.push(destino);
      salida.push(`const ${mNS[1]} = __req(${JSON.stringify(id(destino))});`);
      continue;
    }
    const mSimple = linea.match(RE_IMPORT_SIMPLE);
    if (mSimple) {
      const destino = resolve(dirname(ruta), mSimple[1]);
      deps.push(destino);
      salida.push(`__req(${JSON.stringify(id(destino))});`);
      continue;
    }
    const mExp = linea.match(RE_EXPORT_LLAVES);
    if (mExp) {
      for (const n of mExp[1].split(',').map((s) => s.trim()).filter(Boolean)) exportados.add(n);
      continue;
    }
    if (/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s/.test(linea)) {
      const nombre = linea.match(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z0-9_$]+)/)?.[1];
      if (!nombre) throw new Error(`${clave}: no se pudo extraer el nombre exportado de: ${linea}`);
      exportados.add(nombre);
      salida.push(linea.replace(/^export\s+/, ''));
      continue;
    }
    if (/^export\s/.test(linea)) {
      throw new Error(`${clave}: forma de export no soportada -> ${linea.trim()}`);
    }
    salida.push(linea);
  }

  const cuerpo = salida.join('\n');
  // Red de seguridad: ningun import/export puede sobrevivir a la transformacion.
  // Sin esto, un import no reconocido produciria un bundle que falla en runtime.
  const superviviente = cuerpo.match(/^\s*(import|export)\s/m);
  if (superviviente) {
    throw new Error(`${clave}: quedo un ${superviviente[1]} sin transformar -> ${
      cuerpo.split('\n').find((l) => /^\s*(import|export)\s/.test(l)).trim()}`);
  }

  const registro = {
    clave, deps: [...new Set(deps.map(id))],
    cuerpo,
    exportados: [...exportados],
  };
  modulos.set(clave, registro);
  for (const d of deps) analizar(d, modulos);
  return registro;
}

/** Orden topologico por profundidad (el proyecto es aciclico por diseno). */
function ordenar(entradaClave, modulos) {
  const visto = new Set();
  const orden = [];
  const visitando = new Set();
  (function visita(clave) {
    if (visto.has(clave)) return;
    if (visitando.has(clave)) throw new Error(`Dependencia circular detectada en ${clave}`);
    visitando.add(clave);
    for (const d of modulos.get(clave).deps) visita(d);
    visitando.delete(clave);
    visto.add(clave);
    orden.push(clave);
  })(entradaClave);
  return orden;
}

/**
 * Empaqueta un punto de entrada en un unico bloque de JavaScript.
 * @param {string} rutaEntrada ruta absoluta del modulo de entrada
 * @returns {{codigo:string, modulos:number}}
 */
export function empaquetar(rutaEntrada) {
  const modulos = new Map();
  const entrada = resolve(rutaEntrada);
  analizar(entrada, modulos);
  const orden = ordenar(id(entrada), modulos);

  const cuerpoJS = orden.map((clave) => {
    const m = modulos.get(clave);
    const exps = m.exportados.map((n) => `  __exp.${n} = ${n};`).join('\n');
    return `__def(${JSON.stringify(clave)}, function (__exp, __req) {
${m.cuerpo}
${exps}
});`;
  }).join('\n\n');

  const codigo = `(function () {
'use strict';
var __mods = {};
function __def(id, fn) { __mods[id] = { fn: fn, exports: null }; }
function __req(id) {
  var m = __mods[id];
  if (!m) throw new Error('Modulo no encontrado: ' + id);
  if (!m.exports) { m.exports = {}; m.fn(m.exports, __req); }
  return m.exports;
}

${cuerpoJS}

__req(${JSON.stringify(id(entrada))});
})();`;

  return { codigo, modulos: orden.length };
}
