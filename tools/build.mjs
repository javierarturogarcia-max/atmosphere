/**
 * build.mjs — Empaquetador minimo sin dependencias.
 *
 * Produce dos artefactos en dist/:
 *   atmosphere.html  — la aplicacion entera en un unico archivo (CSS + JS en linea)
 *   artifact.html    — la misma app sin <!doctype>/<html>/<head>/<body>, para
 *                      publicarla como Artifact (el contenedor aporta el esqueleto)
 *
 * Estrategia: cada modulo se envuelve en su propia funcion factoria y se conecta
 * mediante un registro __req(), asi no hay colisiones de nombres entre modulos
 * (varios declaran `INDICE`, `safe`, etc.). Solo admite las formas de import y
 * export que usa este proyecto, y falla ruidosamente ante cualquier otra.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = resolve(RAIZ, 'src/main.js');

const RE_IMPORT = /^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/;
const RE_IMPORT_SIMPLE = /^import\s*['"]([^'"]+)['"];?\s*$/;
const RE_EXPORT_LLAVES = /^export\s*\{([^}]+)\}\s*;?\s*$/;

const modulos = new Map();

function id(ruta) { return relative(RAIZ, ruta).replace(/\\/g, '/'); }

/** Lee un modulo, extrae dependencias y transforma import/export. */
function analizar(ruta) {
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
      const nombres = mImp[1].split(',').map((s) => s.trim()).filter(Boolean);
      if (nombres.some((n) => n.includes(' as '))) {
        throw new Error(`${clave}: "import ... as" no esta soportado por este empaquetador`);
      }
      const destino = resolve(dirname(ruta), mImp[2]);
      deps.push(destino);
      salida.push(`const { ${nombres.join(', ')} } = __req(${JSON.stringify(id(destino))});`);
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
  for (const d of deps) analizar(d);
  return registro;
}

/** Orden topologico por profundidad (el proyecto es aciclico por diseno). */
function ordenar(entradaClave) {
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

analizar(ENTRADA);
const orden = ordenar(id(ENTRADA));

const cuerpoJS = orden.map((clave) => {
  const m = modulos.get(clave);
  const exps = m.exportados.map((n) => `  __exp.${n} = ${n};`).join('\n');
  return `__def(${JSON.stringify(clave)}, function (__exp, __req) {
${m.cuerpo}
${exps}
});`;
}).join('\n\n');

const runtime = `(function () {
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

__req(${JSON.stringify(id(ENTRADA))});
})();`;

const css = readFileSync(resolve(RAIZ, 'assets/styles.css'), 'utf8');
const pkg = JSON.parse(readFileSync(resolve(RAIZ, 'package.json'), 'utf8'));

const CARGADOR = `<div id="app">
  <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;flex-direction:column;gap:14px">
    <div style="font-size:52px">🌍</div>
    <div style="color:#93a4b8;font-family:system-ui,sans-serif">Cargando Atmosphere...</div>
  </div>
</div>`;

const FUENTE = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

if (!existsSync(resolve(RAIZ, 'dist'))) mkdirSync(resolve(RAIZ, 'dist'));

// --- Archivo autonomo completo -------------------------------------------
const html = `<!DOCTYPE html>
<html lang="es" data-tema="bosque">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Atmosphere — Accion climatica gamificada</title>
<meta name="description" content="${pkg.description}">
<meta name="theme-color" content="#05090f">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌍</text></svg>">
${FUENTE}
<style>
${css}
</style>
</head>
<body>
${CARGADOR}
<script>
${runtime}
</script>
</body>
</html>`;
writeFileSync(resolve(RAIZ, 'dist/atmosphere.html'), html);

// --- Fragmento para publicar como Artifact --------------------------------
const fragmento = `<title>Atmosphere</title>
${FUENTE}
<style>
${css}
</style>
${CARGADOR}
<script>
${runtime}
</script>`;
writeFileSync(resolve(RAIZ, 'dist/artifact.html'), fragmento);

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} kB`;
console.log(`Modulos empaquetados: ${orden.length}`);
console.log(`  dist/atmosphere.html  ${kb(html)}`);
console.log(`  dist/artifact.html    ${kb(fragmento)}`);
