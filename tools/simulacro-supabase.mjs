/**
 * simulacro-supabase.mjs — Las piezas que Supabase pone y un PostgreSQL
 * desnudo no tiene: el esquema `auth`, la funcion `auth.uid()`, los roles
 * `anon` y `authenticated`, y el trozo de `storage` que usa la capa social.
 *
 * Vive en un solo sitio a proposito. Las tres baterias de pruebas de base de
 * datos lo usaban copiado, y una copia que se queda atras convierte un fallo
 * del esquema en un fallo del andamio, o —peor— al reves: da por buena una
 * comprobacion que en Supabase real no se sostiene.
 *
 * Lo que NO va aqui son los GRANT sobre las tablas del proyecto: cada bateria
 * necesita unos distintos y esa diferencia es deliberada.
 */
import { PGlite } from '@electric-sql/pglite';

export const PREPARACION = `
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- En Supabase auth.uid() lee el JWT. Aqui se lee una variable de sesion, que
-- es lo que permite a las pruebas actuar como una persona concreta.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('atmosphere.usuario', true), '')::uuid;
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;

grant usage on schema public to anon, authenticated;

-- ESTO ES IMPORTANTE Y SE NOS PASO UNA VEZ. Todo proyecto de Supabase trae
-- puesta esta linea, de modo que cada tabla o vista creada en public NACE con
-- todos los permisos concedidos a anon y authenticated. Sin ella el simulacro
-- daba por buenos unos esquemas que en Supabase dejaban permisos de UPDATE
-- colgando, porque aqui las tablas nacian sin ningun permiso.
alter default privileges in schema public grant all on tables to anon, authenticated;

-- Trozo minimo del esquema storage, suficiente para db/social.sql.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid, created_at timestamptz default now()
);
alter table storage.objects enable row level security;

-- En Supabase real estos permisos ya vienen dados; en el simulacro hay que
-- concederlos o la prueba falla por el andamio, no por el esquema.
grant usage on schema storage to anon, authenticated;
grant select on storage.buckets to anon, authenticated;

-- storage.foldername('uuid/foto.jpg') -> {uuid}. Es la que sostiene la
-- politica de "cada quien escribe solo en su carpeta".
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1 : greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)];
$$;
`;

/** Crea una base nueva ya con el simulacro puesto. */
export async function baseSimulada() {
  const db = await PGlite.create();
  await db.exec(PREPARACION);
  return db;
}
