import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = await PGlite.create();
await db.exec(`
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('atmosphere.usuario', true), '')::uuid; $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
grant usage on schema public to anon, authenticated;
`);
await db.exec(readFileSync('db/esquema.sql', 'utf8'));
await db.exec(`grant select, insert on public.registros to authenticated;
               grant select on public.perfiles, public.grupos, public.miembros to authenticated;`);
const resultados = await db.exec(readFileSync('db/verificar.sql', 'utf8'));
const r = resultados[resultados.length - 1];
const anchos = [12, 52, 7];
console.log('BLOQUE'.padEnd(anchos[0]) + 'COMPROBACION'.padEnd(anchos[1]) + 'ESTADO'.padEnd(anchos[2]) + 'DETALLE');
console.log('─'.repeat(110));
let mal = 0;
for (const f of r.rows) {
  if (f.estado !== 'OK') mal++;
  console.log(
    String(f.bloque).padEnd(anchos[0]) +
    String(f.comprobacion).slice(0, 50).padEnd(anchos[1]) +
    String(f.estado).padEnd(anchos[2]) +
    String(f.detalle ?? '').slice(0, 46));
}
console.log('─'.repeat(110));
console.log(mal ? `${mal} comprobacion(es) en MAL` : 'Todas las comprobaciones en OK');
process.exit(mal ? 1 : 0);
