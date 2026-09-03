/**
 * build.mjs — Genera los archivos autonomos de dist/.
 *
 * Produce cuatro artefactos:
 *   atmosphere.html      la aplicacion entera en un unico archivo
 *   artifact.html        la misma app sin esqueleto HTML, para publicarla
 *   juego.html           Monte Adentro completo en un unico archivo
 *   juego-artifact.html  el juego sin esqueleto, para publicarlo
 *
 * El empaquetado lo hace tools/empaquetar.mjs, que comparten los dos.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { empaquetar, RAIZ } from './empaquetar.mjs';

const pkg = JSON.parse(readFileSync(resolve(RAIZ, 'package.json'), 'utf8'));
const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} kB`;
if (!existsSync(resolve(RAIZ, 'dist'))) mkdirSync(resolve(RAIZ, 'dist'));

const FUENTE = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

// ========================================================== la aplicacion
const app = empaquetar(resolve(RAIZ, 'src/main.js'));
const css = readFileSync(resolve(RAIZ, 'assets/styles.css'), 'utf8');

const CARGADOR = `<div id="app">
  <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;flex-direction:column;gap:14px">
    <div style="font-size:52px">🌍</div>
    <div style="color:#93a4b8;font-family:system-ui,sans-serif">Cargando Atmosphere...</div>
  </div>
</div>`;

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
${app.codigo}
</script>
</body>
</html>`;
writeFileSync(resolve(RAIZ, 'dist/atmosphere.html'), html);

const fragmento = `<title>Atmosphere</title>
${FUENTE}
<style>
${css}
</style>
${CARGADOR}
<script>
${app.codigo}
</script>`;
writeFileSync(resolve(RAIZ, 'dist/artifact.html'), fragmento);

// ============================================================== el juego
const juego = empaquetar(resolve(RAIZ, 'src/juego/main.js'));
const cssJuego = readFileSync(resolve(RAIZ, 'assets/juego.css'), 'utf8');

// El juego se monta solo dentro de #app (ver src/juego/main.js).
const ARRANQUE = `<div id="app"></div>
<script>
${juego.codigo}
</script>`;

const htmlJuego = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Monte Adentro — el juego del niño del campo</title>
<meta name="description" content="Juego 3D de supervivencia, estrategia y superacion: un nino que se cria en el campo aprende a cazar, pescar, buscar en el monte, sembrar su milpa y traer agua y lena a una casa sin luz ni agua corriente.">
<meta name="theme-color" content="#14100c">
<meta name="color-scheme" content="dark">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌄</text></svg>">
${FUENTE}
<style>
${cssJuego}
</style>
</head>
<body>
${ARRANQUE}
</body>
</html>`;
writeFileSync(resolve(RAIZ, 'dist/juego.html'), htmlJuego);

const fragmentoJuego = `<title>Monte Adentro</title>
${FUENTE}
<style>
${cssJuego}
</style>
${ARRANQUE}`;
writeFileSync(resolve(RAIZ, 'dist/juego-artifact.html'), fragmentoJuego);

console.log(`Aplicacion: ${app.modulos} modulos`);
console.log(`  dist/atmosphere.html      ${kb(html)}`);
console.log(`  dist/artifact.html        ${kb(fragmento)}`);
console.log(`Juego: ${juego.modulos} modulos`);
console.log(`  dist/juego.html           ${kb(htmlJuego)}`);
console.log(`  dist/juego-artifact.html  ${kb(fragmentoJuego)}`);
