-- =============================================================================
-- Atmosphere — capa social: comunidad, publicaciones, me gusta y aura
--
-- Se ejecuta DESPUES de esquema.sql, en el mismo SQL Editor. Es idempotente.
--
-- DOS MONEDAS, DOS ORIGENES:
--   puntos = impacto fisico medido  -> lo deriva el servidor de los registros
--   aura   = reconocimiento social  -> lo deriva el servidor de publicaciones
--            y me gusta, con las mismas garantias: el cliente no puede
--            escribirla, ni darse me gusta a si mismo, ni repetir un me gusta.
--
-- PRIVACIDAD: publicar es una decision explicita por accion. Solo sale del
-- dispositivo el video o la foto de la accion que la persona elige compartir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PERFIL SOCIAL: mote y aura
-- -----------------------------------------------------------------------------
alter table public.perfiles
  add column if not exists mote text,
  add column if not exists aura integer not null default 0 check (aura >= 0);

-- El mote es el apodo publico: corto, minusculas, sin espacios y unico.
alter table public.perfiles
  drop constraint if exists perfiles_mote_formato;
alter table public.perfiles
  add constraint perfiles_mote_formato
  check (mote is null or mote ~ '^[a-z0-9_]{3,15}$');

create unique index if not exists perfiles_mote_unico
  on public.perfiles (lower(mote)) where mote is not null;

-- El cliente puede elegir su mote; el aura sigue siendo del servidor.
grant update (nombre, pais, publico, mote) on public.perfiles to authenticated;

-- -----------------------------------------------------------------------------
-- 2. PUBLICACIONES — el muro de buenas acciones
-- -----------------------------------------------------------------------------
-- Los datos del autor se DESNORMALIZAN al publicar (disparador del punto 6):
-- asi el muro no necesita leer la tabla de perfiles, cuyas filas no publicas
-- son invisibles por RLS, y publicar sigue siendo un consentimiento explicito
-- a mostrar tu nombre en esa publicacion concreta.
create table if not exists public.publicaciones (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.perfiles on delete cascade,
  registro_id   text not null,
  accion_id     text not null,
  categoria     text not null,
  descripcion   text not null default '' check (char_length(descripcion) <= 200),
  ruta_medio    text not null,
  tipo_medio    text not null check (tipo_medio in ('foto','video')),
  nivel_evidencia text,
  co2e          numeric(12,4) not null default 0,
  puntos        integer not null default 0,
  likes_n       integer not null default 0 check (likes_n >= 0),
  oculto        boolean not null default false,
  autor_nombre  text not null default '',
  autor_mote    text,
  autor_aura    integer not null default 0,
  creado        timestamptz not null default now(),
  -- Cada registro solo puede publicarse una vez: sin clones del mismo video.
  unique (perfil_id, registro_id)
);

create index if not exists publicaciones_muro on public.publicaciones (oculto, creado desc);
create index if not exists publicaciones_likes on public.publicaciones (oculto, likes_n desc, creado desc);

create table if not exists public.megusta (
  publicacion_id uuid not null references public.publicaciones on delete cascade,
  perfil_id      uuid not null references public.perfiles on delete cascade,
  creado         timestamptz not null default now(),
  -- La clave primaria compuesta hace fisicamente imposible el doble me gusta.
  primary key (publicacion_id, perfil_id)
);

create table if not exists public.reportes (
  publicacion_id uuid not null references public.publicaciones on delete cascade,
  perfil_id      uuid not null references public.perfiles on delete cascade,
  motivo         text not null default 'inapropiado'
                 check (motivo in ('inapropiado','falso','spam','otro')),
  creado         timestamptz not null default now(),
  primary key (publicacion_id, perfil_id)
);

-- -----------------------------------------------------------------------------
-- 3. SEGURIDAD POR FILA
-- -----------------------------------------------------------------------------
alter table public.publicaciones enable row level security;
alter table public.megusta enable row level security;
alter table public.reportes enable row level security;

-- El muro es publico para la comunidad autenticada; lo oculto solo lo ve su autor.
drop policy if exists "leer publicaciones visibles" on public.publicaciones;
create policy "leer publicaciones visibles" on public.publicaciones
  for select using (oculto = false or perfil_id = auth.uid());

-- Solo se publica en nombre propio y sobre un registro que de verdad es tuyo:
-- la subconsulta corre bajo la RLS de registros, que solo muestra los propios.
drop policy if exists "publicar lo propio" on public.publicaciones;
create policy "publicar lo propio" on public.publicaciones
  for insert with check (
    perfil_id = auth.uid()
    and exists (select 1 from public.registros r
                 where r.id = registro_id and r.perfil_id = auth.uid())
  );

drop policy if exists "borrar lo propio" on public.publicaciones;
create policy "borrar lo propio" on public.publicaciones
  for delete using (perfil_id = auth.uid());
-- Sin politica de UPDATE: likes_n, aura del autor y oculto los mueve el servidor.

-- Me gusta: en nombre propio y nunca sobre una publicacion tuya.
drop policy if exists "ver mis megusta" on public.megusta;
create policy "ver mis megusta" on public.megusta
  for select using (perfil_id = auth.uid());

drop policy if exists "dar megusta" on public.megusta;
create policy "dar megusta" on public.megusta
  for insert with check (
    perfil_id = auth.uid()
    and not exists (select 1 from public.publicaciones p
                     where p.id = publicacion_id and p.perfil_id = auth.uid())
  );

drop policy if exists "quitar mi megusta" on public.megusta;
create policy "quitar mi megusta" on public.megusta
  for delete using (perfil_id = auth.uid());

drop policy if exists "reportar" on public.reportes;
create policy "reportar" on public.reportes
  for insert with check (perfil_id = auth.uid());

drop policy if exists "ver mis reportes" on public.reportes;
create policy "ver mis reportes" on public.reportes
  for select using (perfil_id = auth.uid());

grant select, insert, delete on public.publicaciones to authenticated;
grant select, insert, delete on public.megusta to authenticated;
grant select, insert on public.reportes to authenticated;

-- -----------------------------------------------------------------------------
-- 4. EL AURA LA DERIVA EL SERVIDOR
-- -----------------------------------------------------------------------------
-- Formula, por publicacion visible:
--   8 puntos de aura por publicar
--   + 2 por cada me gusta recibido
--   + 5 si la evidencia estaba verificada (fechada, situada o video)
create or replace function public.recalcular_aura(p_perfil uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aura integer;
begin
  select coalesce(sum(
           8 + 2 * likes_n
           + case when nivel_evidencia in ('fechada','situada','video') then 5 else 0 end
         ), 0)
    into v_aura
    from public.publicaciones
   where perfil_id = p_perfil and oculto = false;

  update public.perfiles set aura = v_aura, actualizado = now() where id = p_perfil;
  -- El aura desnormalizada de sus publicaciones se refresca para el muro.
  update public.publicaciones set autor_aura = v_aura where perfil_id = p_perfil;
end;
$$;

-- Al publicar: sella los datos del autor y recalcula su aura.
create or replace function public.al_publicar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select nombre, mote, aura into new.autor_nombre, new.autor_mote, new.autor_aura
    from public.perfiles where id = new.perfil_id;
  return new;
end;
$$;

drop trigger if exists antes_de_publicar on public.publicaciones;
create trigger antes_de_publicar
  before insert on public.publicaciones
  for each row execute function public.al_publicar();

create or replace function public.tras_publicacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalcular_aura(coalesce(new.perfil_id, old.perfil_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists tras_publicacion on public.publicaciones;
create trigger tras_publicacion
  after insert or delete on public.publicaciones
  for each row execute function public.tras_publicacion();

-- Al dar o quitar un me gusta: recuenta y recalcula el aura del AUTOR.
create or replace function public.tras_megusta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pub uuid := coalesce(new.publicacion_id, old.publicacion_id);
  v_autor uuid;
begin
  update public.publicaciones p
     set likes_n = (select count(*) from public.megusta m where m.publicacion_id = v_pub)
   where p.id = v_pub
   returning p.perfil_id into v_autor;
  if v_autor is not null then
    perform public.recalcular_aura(v_autor);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists tras_megusta on public.megusta;
create trigger tras_megusta
  after insert or delete on public.megusta
  for each row execute function public.tras_megusta();

-- Moderacion comunitaria: tres reportes de personas distintas ocultan la
-- publicacion y su aura deja de contar, sin esperar a ningun administrador.
create or replace function public.tras_reporte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autor uuid;
begin
  if (select count(*) from public.reportes where publicacion_id = new.publicacion_id) >= 3 then
    update public.publicaciones set oculto = true where id = new.publicacion_id
      returning perfil_id into v_autor;
    if v_autor is not null then
      perform public.recalcular_aura(v_autor);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tras_reporte on public.reportes;
create trigger tras_reporte
  after insert on public.reportes
  for each row execute function public.tras_reporte();

-- -----------------------------------------------------------------------------
-- 5. VISTAS DEL MURO
-- -----------------------------------------------------------------------------
create or replace view public.muro
with (security_invoker = true) as
  select id, perfil_id, accion_id, categoria, descripcion, ruta_medio, tipo_medio,
         nivel_evidencia, co2e, puntos, likes_n, autor_nombre, autor_mote, autor_aura, creado
    from public.publicaciones
   where oculto = false
   order by creado desc;

-- Lo viral: lo mas gustado de la ultima semana.
create or replace view public.virales
with (security_invoker = true) as
  select id, perfil_id, accion_id, categoria, descripcion, ruta_medio, tipo_medio,
         nivel_evidencia, co2e, puntos, likes_n, autor_nombre, autor_mote, autor_aura, creado
    from public.publicaciones
   where oculto = false
     and likes_n > 0
     and creado > now() - interval '7 days'
   order by likes_n desc, creado desc
   limit 12;

-- -----------------------------------------------------------------------------
-- 6. ALMACEN DE VIDEOS Y FOTOS (Supabase Storage)
-- -----------------------------------------------------------------------------
-- Cubo publico de solo lectura: lo que se publica en el muro es, por decision
-- explicita de su autor, visible para la comunidad. Cada quien solo puede
-- escribir dentro de su propia carpeta (su uuid) y borrar lo suyo.
insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', true)
on conflict (id) do nothing;

drop policy if exists "subir a mi carpeta" on storage.objects;
create policy "subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "borrar lo mio del almacen" on storage.objects;
create policy "borrar lo mio del almacen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidencias' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "leer evidencias" on storage.objects;
create policy "leer evidencias" on storage.objects
  for select using (bucket_id = 'evidencias');
