/**
 * probar-esquema.mjs — Ejecuta db/esquema.sql contra un PostgreSQL real.
 *
 * Usa PGlite (Postgres compilado a WebAssembly), asi que no hace falta un
 * servidor: se comprueba que el esquema es SQL valido y, sobre todo, que los
 * disparadores y las restricciones se comportan como dicen los comentarios.
 *
 * Las piezas que aporta Supabase y no existen en un Postgres desnudo —el
 * esquema `auth`, `auth.uid()`, los roles y el trozo de `storage`— salen de
 * ./simulacro-supabase.mjs, compartido con las otras dos baterias.
 */
import { readFileSync } from 'node:fs';
import { baseSimulada } from './simulacro-supabase.mjs';

const db = await baseSimulada();
const fallos = [];
const ok = (n) => console.log(`  ✅ ${n}`);
const mal = (n, e) => { fallos.push(`${n}: ${e}`); console.log(`  ❌ ${n}\n     ${e}`); };

async function prueba(nombre, fn) {
  try { await fn(); ok(nombre); } catch (e) { mal(nombre, e.message.split('\n')[0]); }
}
const comoUsuario = (id) => db.exec(`set atmosphere.usuario = '${id}';`);

console.log('PostgreSQL:', (await db.query('select version()')).rows[0].version.split(',')[0]);
console.log('\n── 1. El esquema se ejecuta entero ──');
try {
  await db.exec(readFileSync('db/esquema.sql', 'utf8'));
  ok('db/esquema.sql se ejecuta sin errores');
} catch (e) {
  mal('db/esquema.sql', e.message);
  console.log('\nNo se puede continuar.'); process.exit(1);
}
// Los permisos por columna se conceden despues de crear las tablas.
await db.exec(`grant select, insert on public.registros to authenticated;
               grant select on public.perfiles, public.grupos, public.miembros to authenticated;`);

console.log('\n── 2. Estructura creada ──');
const tablas = (await db.query(
  `select tablename from pg_tables where schemaname='public' order by tablename`)).rows.map((r) => r.tablename);
const vistas = (await db.query(
  `select viewname from pg_views where schemaname='public' order by viewname`)).rows.map((r) => r.viewname);
console.log('  tablas:', tablas.join(', '));
console.log('  vistas:', vistas.join(', '));
for (const t of ['perfiles', 'registros', 'grupos', 'miembros']) {
  await prueba(`tabla ${t} existe`, async () => { if (!tablas.includes(t)) throw new Error('no existe'); });
}
for (const v of ['ranking_global', 'ranking_grupos', 'impacto_comunidad']) {
  await prueba(`vista ${v} existe`, async () => { if (!vistas.includes(v)) throw new Error('no existe'); });
}

console.log('\n── 3. RLS activada en todas las tablas ──');
const rls = (await db.query(
  `select relname, relrowsecurity from pg_class
    where relname in ('perfiles','registros','grupos','miembros') order by relname`)).rows;
for (const r of rls) {
  await prueba(`RLS activa en ${r.relname}`, async () => {
    if (!r.relrowsecurity) throw new Error('row level security desactivada');
  });
}
const politicas = (await db.query(`select tablename, cmd, policyname from pg_policies where schemaname='public'`)).rows;
console.log(`  politicas definidas: ${politicas.length}`);
await prueba('registros NO admite UPDATE ni DELETE (append-only)', async () => {
  const malas = politicas.filter((p) => p.tablename === 'registros' && ['UPDATE', 'DELETE'].includes(p.cmd));
  if (malas.length) throw new Error(`existen politicas ${malas.map((m) => m.cmd).join('/')}`);
});

console.log('\n── 4. Alta automatica de perfil ──');
const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
  values ('${U1}', 'javier@clases.edu.sv', '{"nombre":"Javier","pais":"SV"}'::jsonb),
         ('${U2}', 'ana@ejemplo.com', '{}'::jsonb);`);
await prueba('el disparador crea el perfil al registrarse', async () => {
  const p = (await db.query(`select nombre, pais, puntos, nivel from public.perfiles where id='${U1}'`)).rows[0];
  if (!p) throw new Error('no se creo el perfil');
  if (p.nombre !== 'Javier' || p.pais !== 'SV') throw new Error(`metadatos mal leidos: ${JSON.stringify(p)}`);
  if (p.puntos !== 0 || p.nivel !== 1) throw new Error('deberia empezar a cero');
});
await prueba('sin metadatos usa los valores por defecto', async () => {
  const p = (await db.query(`select nombre, pais from public.perfiles where id='${U2}'`)).rows[0];
  if (p.nombre !== 'Guardian' || p.pais !== 'WW') throw new Error(JSON.stringify(p));
});

console.log('\n── 5. El servidor DERIVA los totales de los registros ──');
await comoUsuario(U1);
await db.exec(`insert into public.registros
  (id, perfil_id, accion_id, categoria, cantidad, unidad, co2e, agua, residuo, puntos, fecha) values
  ('r1','${U1}','mov_bici','movilidad',12,'km',2.052,0,0,34, now() - interval '2 days'),
  ('r2','${U1}','res_compostar','residuos',3,'kg',1.65,0,3,28, now() - interval '1 day'),
  ('r3','${U1}','agu_ducha','agua',2,'ud',0,95,0,15, now());`);
await prueba('puntos y totales recalculados por el disparador', async () => {
  const p = (await db.query(`select puntos, xp, co2e_total, agua_total, residuo_total, registros_n, dias_activos
                             from public.perfiles where id='${U1}'`)).rows[0];
  if (Number(p.puntos) !== 77) throw new Error(`puntos=${p.puntos}, esperado 77`);
  if (Number(p.registros_n) !== 3) throw new Error(`registros_n=${p.registros_n}`);
  if (Number(p.dias_activos) !== 3) throw new Error(`dias_activos=${p.dias_activos}, esperado 3`);
  if (Math.abs(Number(p.co2e_total) - 3.702) > 0.001) throw new Error(`co2e=${p.co2e_total}`);
  if (Math.abs(Number(p.agua_total) - 95) > 0.1) throw new Error(`agua=${p.agua_total}`);
  if (Number(p.xp) !== Math.round(77 * 0.7)) throw new Error(`xp=${p.xp}`);
});

console.log('\n── 6. La curva de nivel del servidor coincide con la del cliente ──');
const { nivelDesdeXP } = await import('../src/core/nivel.js');
for (const puntos of [0, 100, 500, 1000, 5000, 20000, 100000]) {
  await prueba(`nivel con ${puntos} puntos coincide con el cliente`, async () => {
    const r = (await db.query(
      `select greatest(1, floor(power($1::numeric * 0.7 / 80.0, 1/1.55)) + 1)::int as nivel`, [puntos])).rows[0];
    const cliente = nivelDesdeXP(Math.round(puntos * 0.7));
    if (Math.abs(r.nivel - cliente) > 1) {
      throw new Error(`servidor=${r.nivel} cliente=${cliente} (diferencia > 1 nivel)`);
    }
  });
}

console.log('\n── 7. El tope diario se aplica en el servidor ──');
await prueba('rechaza superar 2500 puntos en un dia', async () => {
  try {
    await db.exec(`insert into public.registros
      (id, perfil_id, accion_id, categoria, cantidad, unidad, puntos, fecha)
      values ('r_abuso','${U1}','mov_bici','movilidad',1,'km',2490, now());`);
  } catch (e) {
    if (/Tope diario/.test(e.message)) return; // rechazado como debe
    throw new Error(`rechazado por otro motivo: ${e.message.split('\n')[0]}`);
  }
  throw new Error('acepto un registro que supera el tope diario');
});
await prueba('un registro dentro del tope si se acepta', async () => {
  await db.exec(`insert into public.registros
    (id, perfil_id, accion_id, categoria, cantidad, unidad, puntos, fecha)
    values ('r4','${U1}','ali_sin_carne','alimentacion',1,'ud',40, now());`);
});

console.log('\n── 8. Restricciones de integridad ──');
await prueba('rechaza cantidad negativa', async () => {
  try {
    await db.exec(`insert into public.registros (id, perfil_id, accion_id, categoria, cantidad, unidad, fecha)
                   values ('r_neg','${U1}','x','y',-5,'km', now());`);
  } catch { return; }
  throw new Error('acepto cantidad negativa');
});
await prueba('rechaza una fecha en el futuro', async () => {
  try {
    await db.exec(`insert into public.registros (id, perfil_id, accion_id, categoria, cantidad, unidad, fecha)
                   values ('r_fut','${U1}','x','y',1,'km', now() + interval '5 days');`);
  } catch { return; }
  throw new Error('acepto una fecha futura');
});
await prueba('el mismo id no se duplica (subida idempotente)', async () => {
  try {
    await db.exec(`insert into public.registros (id, perfil_id, accion_id, categoria, cantidad, unidad, fecha)
                   values ('r1','${U1}','x','y',1,'km', now());`);
  } catch { return; }
  throw new Error('permitio duplicar la clave primaria');
});
await prueba('rechaza un codigo de grupo con formato invalido', async () => {
  try {
    await db.exec(`insert into public.grupos (nombre, codigo, creador) values ('X','abc','${U1}');`);
  } catch { return; }
  throw new Error('acepto un codigo en minusculas');
});

console.log('\n── 9. Permisos por columna: el cliente no escribe su puntuacion ──');
const permisos = (await db.query(`
  select column_name, privilege_type from information_schema.column_privileges
   where table_name='perfiles' and grantee='authenticated' and privilege_type='UPDATE'
   order by column_name`)).rows.map((r) => r.column_name);
console.log('  columnas actualizables por "authenticated":', permisos.join(', ') || '(ninguna)');
await prueba('puede actualizar nombre, pais y publico', async () => {
  for (const c of ['nombre', 'pais', 'publico']) {
    if (!permisos.includes(c)) throw new Error(`falta permiso sobre ${c}`);
  }
});
await prueba('NO puede actualizar puntos, xp ni nivel', async () => {
  for (const c of ['puntos', 'xp', 'nivel', 'co2e_total']) {
    if (permisos.includes(c)) throw new Error(`tiene permiso indebido sobre ${c}`);
  }
});

console.log('\n── 10. Grupos y vistas ──');
await prueba('crear grupo y unirse por codigo', async () => {
  await db.exec(`insert into public.grupos (id, nombre, codigo, tipo, creador)
                 values ('33333333-3333-3333-3333-333333333333','Quinto B','K7M2PQ','clase','${U1}');`);
  await db.exec(`insert into public.miembros (grupo_id, perfil_id, rol)
                 values ('33333333-3333-3333-3333-333333333333','${U1}','gestor');`);
  await comoUsuario(U2);
  const r = (await db.query(`select public.unirse_por_codigo('k7m2pq') as g`)).rows[0];
  if (!r.g) throw new Error('no devolvio el grupo');
  const n = (await db.query(`select count(*)::int as n from public.miembros
                             where grupo_id='33333333-3333-3333-3333-333333333333'`)).rows[0].n;
  if (n !== 2) throw new Error(`miembros=${n}, esperado 2`);
});
await prueba('unirse con un codigo inexistente falla con mensaje claro', async () => {
  try { await db.query(`select public.unirse_por_codigo('ZZZZZZ')`); }
  catch (e) { if (/No existe/.test(e.message)) return; throw new Error(e.message.split('\n')[0]); }
  throw new Error('acepto un codigo inexistente');
});
await prueba('ranking_global solo muestra perfiles publicos', async () => {
  await db.exec(`update public.perfiles set publico=false where id='${U2}';`);
  const ids = (await db.query(`select id from public.ranking_global`)).rows.map((r) => r.id);
  if (ids.includes(U2)) throw new Error('un perfil oculto aparece en el ranking');
  if (!ids.includes(U1)) throw new Error('falta el perfil publico');
  await db.exec(`update public.perfiles set publico=true where id='${U2}';`);
});
await prueba('impacto_comunidad agrega correctamente', async () => {
  const r = (await db.query(`select * from public.impacto_comunidad`)).rows[0];
  if (Number(r.participantes) !== 2) throw new Error(`participantes=${r.participantes}`);
  if (Number(r.acciones) !== 4) throw new Error(`acciones=${r.acciones}`);
});

console.log(`\n${'═'.repeat(60)}`);
if (fallos.length) {
  console.log(`RESULTADO: ${fallos.length} fallo(s)\n`);
  for (const f of fallos) console.log('  •', f);
  process.exit(1);
}
console.log('RESULTADO: el esquema funciona entero contra PostgreSQL real ✅');
