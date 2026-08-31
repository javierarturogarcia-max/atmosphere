// Prueba de db/verificar.sql: el guion que la persona pega en el editor SQL de
// Supabase para comprobar que su instalacion quedo bien.
//
// Se ejecuta dos veces contra bases distintas, porque la capa social es
// opcional y el guion tiene que servir en los dos casos:
//
//   1. Solo el nucleo  -> las filas 'Social' salen en '--', ninguna en MAL.
//   2. Nucleo + social -> todas en OK.
//
// El caso 1 no es un adorno: una referencia directa a una tabla de la capa
// social haria fallar el guion entero por error de analisis en las
// instalaciones que no la tienen, y eso solo se ve probandolo sin ella.

import { readFileSync } from 'node:fs';
import { baseSimulada } from './simulacro-supabase.mjs';

const esquema   = readFileSync('db/esquema.sql', 'utf8');
const social    = readFileSync('db/social.sql', 'utf8');
const verificar = readFileSync('db/verificar.sql', 'utf8');


const PERMISOS = `
grant select, insert on public.registros to authenticated;
grant select on public.perfiles, public.grupos, public.miembros to authenticated;
`;

async function correr(conSocial) {
  const db = await baseSimulada();
  await db.exec(esquema);
  await db.exec(PERMISOS);
  if (conSocial) await db.exec(social);
  const resultados = await db.exec(verificar);
  await db.close();
  return resultados[resultados.length - 1].rows;
}

function pintar(titulo, filas) {
  const anchos = [12, 52, 7];
  console.log(`\n══ ${titulo} ══`);
  console.log('BLOQUE'.padEnd(anchos[0]) + 'COMPROBACION'.padEnd(anchos[1]) + 'ESTADO'.padEnd(anchos[2]) + 'DETALLE');
  console.log('─'.repeat(110));
  for (const f of filas) {
    console.log(
      String(f.bloque).padEnd(anchos[0]) +
      String(f.comprobacion).slice(0, 50).padEnd(anchos[1]) +
      String(f.estado).padEnd(anchos[2]) +
      String(f.detalle ?? '').slice(0, 46));
  }
  console.log('─'.repeat(110));
}

let fallos = 0;
const reprobar = (m) => { console.error(`  ✗ ${m}`); fallos++; };

// ── Caso 1: instalacion sin capa social ─────────────────────────────────────
const soloNucleo = await correr(false);
pintar('Solo el nucleo (capa social sin instalar)', soloNucleo);

for (const f of soloNucleo) {
  if (f.bloque === 'Social') {
    if (f.estado !== '--') reprobar(`sin capa social, "${f.comprobacion}" deberia salir en -- y sale en ${f.estado}`);
  } else if (f.estado !== 'OK') {
    reprobar(`"${f.comprobacion}" en ${f.estado}: ${f.detalle}`);
  }
}
if (!soloNucleo.some((f) => f.bloque === 'Social')) reprobar('no hay ninguna fila del bloque Social');

// ── Caso 2: instalacion completa ────────────────────────────────────────────
const completa = await correr(true);
pintar('Nucleo + capa social', completa);

for (const f of completa) {
  if (f.estado !== 'OK') reprobar(`con capa social, "${f.comprobacion}" en ${f.estado}: ${f.detalle}`);
}

// La comprobacion antifraude del perfil tiene que seguir en OK despues de que
// social.sql anada 'mote' al GRANT UPDATE: es justo el caso que la rompia.
const antifraude = completa.find((f) => f.comprobacion.startsWith('El cliente SOLO'));
if (!antifraude) reprobar('falta la comprobacion antifraude de columnas escribibles');
else if (!/mote/.test(String(antifraude.detalle))) reprobar(`el detalle antifraude no menciona mote: ${antifraude.detalle}`);

console.log(fallos ? `\n${fallos} comprobacion(es) en MAL` : '\nTodas las comprobaciones en OK, con y sin capa social');
process.exit(fallos ? 1 : 0);
