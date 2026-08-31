/**
 * probar-social.mjs — Ejecuta db/social.sql contra un PostgreSQL real y, sobre
 * todo, comprueba que sus candados CIERRAN: las pruebas de escritura se hacen
 * con `set role authenticated`, porque el superusuario se salta la RLS y
 * probar con el seria enganarse.
 */
import { readFileSync } from 'node:fs';
import { baseSimulada } from './simulacro-supabase.mjs';


const db = await baseSimulada();
const fallos = [];
const ok = (n) => console.log(`  ✅ ${n}`);
const mal = (n, e) => { fallos.push(n); console.log(`  ❌ ${n}\n     ${e}`); };
async function prueba(nombre, fn) {
  try { await fn(); ok(nombre); } catch (e) { mal(nombre, e.message.split('\n')[0]); }
}
/** Actua como una persona autenticada concreta, con RLS y permisos reales. */
async function como(id, fn) {
  await db.exec(`reset role; set atmosphere.usuario = '${id}'; set role authenticated;`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}
async function aura(id) {
  await db.exec('reset role;');
  return Number((await db.query(`select aura from public.perfiles where id='${id}'`)).rows[0].aura);
}

console.log('── 1. Los dos esquemas se ejecutan enteros ──');
try {
  await db.exec(readFileSync('db/esquema.sql', 'utf8'));
  await db.exec(`grant select, insert on public.registros to authenticated;
                 grant select on public.perfiles, public.grupos, public.miembros to authenticated;`);
  await db.exec(readFileSync('db/social.sql', 'utf8'));
  ok('esquema.sql + social.sql sin errores');
} catch (e) { mal('carga de esquemas', e.message); process.exit(1); }

const ANA = '11111111-1111-1111-1111-111111111111';
const LUIS = '22222222-2222-2222-2222-222222222222';
const EVA = '33333333-3333-3333-3333-333333333333';
const OTTO = '44444444-4444-4444-4444-444444444444';
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${ANA}','ana@x.sv','{"nombre":"Ana"}'), ('${LUIS}','luis@x.sv','{"nombre":"Luis"}'),
  ('${EVA}','eva@x.sv','{"nombre":"Eva"}'), ('${OTTO}','otto@x.sv','{"nombre":"Otto"}');`);
// Un registro real de Ana sobre el que publicar.
await db.exec(`reset role; set atmosphere.usuario='${ANA}';`);
await db.exec(`insert into public.registros (id, perfil_id, accion_id, categoria, cantidad, unidad, co2e, puntos, fecha)
  values ('r_ana','${ANA}','bio_plantar_arbol','biodiversidad',1,'ud',21.77,120, now());`);

console.log('\n── 2. Mote: apodo publico unico ──');
await prueba('Ana fija su mote', () => como(ANA, () =>
  db.exec(`update public.perfiles set mote='ana_verde' where id='${ANA}'`)));
await prueba('el mote duplicado se rechaza aunque cambie de mayusculas', async () => {
  try { await como(LUIS, () => db.exec(`update public.perfiles set mote='ANA_VERDE' where id='${LUIS}'`)); }
  catch { return; }
  const m = (await db.query(`select mote from public.perfiles where id='${LUIS}'`)).rows[0].mote;
  if (m) throw new Error(`acepto el duplicado: ${m}`);
});
await prueba('un mote con formato invalido se rechaza', async () => {
  for (const malMote of ['ab', 'Con Espacios', 'ñoño', 'x'.repeat(16)]) {
    try { await como(LUIS, () => db.exec(`update public.perfiles set mote='${malMote}' where id='${LUIS}'`)); }
    catch { continue; }
    throw new Error(`acepto "${malMote}"`);
  }
});
await como(LUIS, () => db.exec(`update public.perfiles set mote='luis_eco' where id='${LUIS}'`));

console.log('\n── 3. Publicar sella al autor y da aura ──');
await prueba('Ana publica su arbol (evidencia verificada)', () => como(ANA, () =>
  db.exec(`insert into public.publicaciones
    (id, perfil_id, registro_id, accion_id, categoria, descripcion, ruta_medio, tipo_medio, nivel_evidencia, co2e, puntos)
    values ('aaaaaaaa-0000-0000-0000-000000000001','${ANA}','r_ana','bio_plantar_arbol','biodiversidad',
            'Mi primer arbol del anio','${ANA}/arbol.jpg','foto','situada',21.77,120)`)));
await prueba('los datos del autor quedan sellados en la publicacion', async () => {
  await db.exec('reset role;');
  const p = (await db.query(`select autor_nombre, autor_mote from public.publicaciones limit 1`)).rows[0];
  if (p.autor_nombre !== 'Ana' || p.autor_mote !== 'ana_verde') throw new Error(JSON.stringify(p));
});
await prueba('aura de Ana = 8 (publicar) + 5 (evidencia verificada) = 13', async () => {
  const a = await aura(ANA);
  if (a !== 13) throw new Error(`aura=${a}`);
});
await prueba('el mismo registro no puede publicarse dos veces', async () => {
  try {
    await como(ANA, () => db.exec(`insert into public.publicaciones
      (perfil_id, registro_id, accion_id, categoria, ruta_medio, tipo_medio)
      values ('${ANA}','r_ana','bio_plantar_arbol','biodiversidad','${ANA}/otra.jpg','foto')`));
  } catch { return; }
  throw new Error('acepto el duplicado');
});
await prueba('no se puede publicar sobre un registro ajeno', async () => {
  try {
    await como(LUIS, () => db.exec(`insert into public.publicaciones
      (perfil_id, registro_id, accion_id, categoria, ruta_medio, tipo_medio)
      values ('${LUIS}','r_ana','bio_plantar_arbol','biodiversidad','${LUIS}/robo.jpg','foto')`));
  } catch { return; }
  throw new Error('Luis publico el registro de Ana');
});

console.log('\n── 4. Me gusta: imposible hacer trampa ──');
const PUB = 'aaaaaaaa-0000-0000-0000-000000000001';
await prueba('AUTO-LIKE RECHAZADO: Ana no puede gustarse a si misma', async () => {
  try { await como(ANA, () => db.exec(`insert into public.megusta values ('${PUB}','${ANA}')`)); }
  catch { return; }
  throw new Error('el candado no cerro');
});
await prueba('Luis y Eva dan me gusta; likes_n=2 y aura de Ana sube a 17', async () => {
  await como(LUIS, () => db.exec(`insert into public.megusta (publicacion_id, perfil_id) values ('${PUB}','${LUIS}')`));
  await como(EVA, () => db.exec(`insert into public.megusta (publicacion_id, perfil_id) values ('${PUB}','${EVA}')`));
  await db.exec('reset role;');
  const n = Number((await db.query(`select likes_n from public.publicaciones where id='${PUB}'`)).rows[0].likes_n);
  if (n !== 2) throw new Error(`likes_n=${n}`);
  const a = await aura(ANA);
  if (a !== 17) throw new Error(`aura=${a}, esperado 13+2*2`);
});
await prueba('el doble me gusta lo impide la clave primaria', async () => {
  try { await como(LUIS, () => db.exec(`insert into public.megusta (publicacion_id, perfil_id) values ('${PUB}','${LUIS}')`)); }
  catch { return; }
  throw new Error('acepto el segundo like');
});
await prueba('quitar el me gusta recuenta y baja el aura', async () => {
  await como(EVA, () => db.exec(`delete from public.megusta where publicacion_id='${PUB}' and perfil_id='${EVA}'`));
  await db.exec('reset role;');
  const n = Number((await db.query(`select likes_n from public.publicaciones where id='${PUB}'`)).rows[0].likes_n);
  if (n !== 1) throw new Error(`likes_n=${n}`);
  if (await aura(ANA) !== 15) throw new Error('el aura no bajo');
});

console.log('\n── 5. El aura y los contadores no se pueden escribir ──');
await prueba('authenticated NO puede escribir su aura', async () => {
  try { await como(ANA, () => db.exec(`update public.perfiles set aura=99999 where id='${ANA}'`)); }
  catch { return; }
  await db.exec('reset role;');
  if (await aura(ANA) === 99999) throw new Error('escribio el aura');
});
await prueba('authenticated NO puede inflar likes_n', async () => {
  try { await como(ANA, () => db.exec(`update public.publicaciones set likes_n=9999 where id='${PUB}'`)); }
  catch { return; }
  await db.exec('reset role;');
  const n = Number((await db.query(`select likes_n from public.publicaciones where id='${PUB}'`)).rows[0].likes_n);
  if (n === 9999) throw new Error('escribio likes_n');
});

console.log('\n── 6. Moderacion comunitaria ──');
await prueba('tres reportes ocultan la publicacion y el aura cae', async () => {
  for (const quien of [LUIS, EVA, OTTO]) {
    await como(quien, () => db.exec(
      `insert into public.reportes (publicacion_id, perfil_id, motivo) values ('${PUB}','${quien}','inapropiado')`));
  }
  await db.exec('reset role;');
  const oculto = (await db.query(`select oculto from public.publicaciones where id='${PUB}'`)).rows[0].oculto;
  if (!oculto) throw new Error('sigue visible');
  if (await aura(ANA) !== 0) throw new Error('el aura de lo oculto sigue contando');
});
await prueba('lo oculto desaparece del muro y de los virales', async () => {
  await db.exec('reset role;');
  const muro = (await db.query('select count(*)::int as n from public.muro')).rows[0].n;
  const vir = (await db.query('select count(*)::int as n from public.virales')).rows[0].n;
  if (muro !== 0 || vir !== 0) throw new Error(`muro=${muro} virales=${vir}`);
});
await prueba('pero su autor si sigue viendola (para poder borrarla)', () => como(ANA, async () => {
  const n = Number((await db.query(`select count(*)::int as n from public.publicaciones`)).rows[0].n);
  if (n !== 1) throw new Error(`Ana ve ${n} publicaciones`);
}));

console.log('\n── 7. Almacen de medios ──');
await prueba('el cubo de evidencias existe y es publico', async () => {
  await db.exec('reset role;');
  const b = (await db.query(`select public from storage.buckets where id='evidencias'`)).rows[0];
  if (!b?.public) throw new Error('no existe o no es publico');
});
await prueba('cada quien solo escribe dentro de su carpeta', async () => {
  await db.exec(`grant select, insert, delete on storage.objects to authenticated;`);
  await como(ANA, () => db.exec(
    `insert into storage.objects (bucket_id, name) values ('evidencias','${ANA}/video.webm')`));
  try {
    await como(LUIS, () => db.exec(
      `insert into storage.objects (bucket_id, name) values ('evidencias','${ANA}/intruso.webm')`));
  } catch { return; }
  throw new Error('Luis escribio en la carpeta de Ana');
});

console.log(`\n${'═'.repeat(62)}`);
if (fallos.length) { console.log(`RESULTADO: ${fallos.length} fallo(s)`); process.exit(1); }
console.log('RESULTADO: la capa social cierra todos sus candados ✅');
