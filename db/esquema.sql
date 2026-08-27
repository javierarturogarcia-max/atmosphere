-- =============================================================================
-- Atmosphere — esquema de sincronizacion en la nube (PostgreSQL / Supabase)
--
-- PRINCIPIO RECTOR: el cliente NUNCA escribe su propia puntuacion.
--
-- Es el error que arruina el 90 % de los rankings en linea. Si la aplicacion
-- envia "tengo 50.000 puntos", cualquiera con la consola del navegador abierta
-- envia lo mismo y la tabla pierde todo sentido. Aqui el cliente solo puede
-- insertar REGISTROS individuales (inmutables), y un disparador del servidor
-- recalcula los totales a partir de ellos. Los permisos por columna impiden
-- fisicamente tocar puntos, xp o nivel.
--
-- Ejecutar entero en: Supabase -> SQL Editor -> New query -> Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PERFILES
-- -----------------------------------------------------------------------------
create table if not exists public.perfiles (
  id            uuid primary key references auth.users on delete cascade,
  nombre        text        not null check (char_length(nombre) between 1 and 24),
  pais          text        not null default 'WW' check (char_length(pais) = 2),
  publico       boolean     not null default true,

  -- Columnas derivadas: las escribe SOLO el servidor (ver punto 5).
  puntos        integer     not null default 0 check (puntos >= 0),
  xp            integer     not null default 0 check (xp >= 0),
  nivel         integer     not null default 1,
  co2e_total    numeric(12,3) not null default 0,
  agua_total    numeric(14,1) not null default 0,
  residuo_total numeric(12,3) not null default 0,
  registros_n   integer     not null default 0,
  dias_activos  integer     not null default 0,
  confianza     numeric(4,3) not null default 0.5,

  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);

comment on column public.perfiles.publico is
  'Si es falso, el perfil no aparece en ningun ranking. Consentimiento explicito.';

-- -----------------------------------------------------------------------------
-- 2. REGISTROS — inmutables y append-only
-- -----------------------------------------------------------------------------
-- La clave primaria es el id generado en el dispositivo. Eso hace la subida
-- IDEMPOTENTE: reenviar el mismo registro tras un corte de red no lo duplica.
create table if not exists public.registros (
  id          text        primary key,
  perfil_id   uuid        not null references public.perfiles on delete cascade,
  accion_id   text        not null,
  categoria   text        not null,
  cantidad    numeric(12,3) not null check (cantidad > 0),
  unidad      text        not null,
  co2e        numeric(12,4) not null default 0 check (co2e >= 0),
  agua        numeric(12,2) not null default 0 check (agua >= 0),
  residuo     numeric(12,4) not null default 0 check (residuo >= 0),
  puntos      integer     not null default 0 check (puntos between 0 and 2500),
  evidencia   text,
  nivel_evidencia text,
  fecha       timestamptz not null check (fecha <= now() + interval '1 hour'),
  creado      timestamptz not null default now()
);

create index if not exists registros_perfil_fecha on public.registros (perfil_id, fecha desc);
create index if not exists registros_categoria on public.registros (categoria);

-- -----------------------------------------------------------------------------
-- 3. GRUPOS — clase, centro, empresa o barrio
-- -----------------------------------------------------------------------------
create table if not exists public.grupos (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null check (char_length(nombre) between 2 and 60),
  codigo  text not null unique check (codigo ~ '^[A-Z0-9]{6}$'),
  tipo    text not null default 'clase' check (tipo in ('clase','centro','empresa','barrio','amigos')),
  creador uuid references auth.users on delete set null,
  creado  timestamptz not null default now()
);

create table if not exists public.miembros (
  grupo_id  uuid not null references public.grupos   on delete cascade,
  perfil_id uuid not null references public.perfiles on delete cascade,
  rol       text not null default 'miembro' check (rol in ('miembro','gestor')),
  unido     timestamptz not null default now(),
  primary key (grupo_id, perfil_id)
);

-- -----------------------------------------------------------------------------
-- 4. SEGURIDAD A NIVEL DE FILA
-- -----------------------------------------------------------------------------
alter table public.perfiles  enable row level security;
alter table public.registros enable row level security;
alter table public.grupos    enable row level security;
alter table public.miembros  enable row level security;

-- Perfiles: se leen los publicos y el propio; solo se escribe el propio.
drop policy if exists "leer perfiles publicos" on public.perfiles;
create policy "leer perfiles publicos" on public.perfiles
  for select using (publico = true or auth.uid() = id);

drop policy if exists "crear perfil propio" on public.perfiles;
create policy "crear perfil propio" on public.perfiles
  for insert with check (auth.uid() = id);

drop policy if exists "actualizar perfil propio" on public.perfiles;
create policy "actualizar perfil propio" on public.perfiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Registros: PRIVADOS. Ni siquiera los companeros de grupo ven tu detalle.
-- Al ranking solo llegan los agregados de la tabla de perfiles.
drop policy if exists "leer registros propios" on public.registros;
create policy "leer registros propios" on public.registros
  for select using (auth.uid() = perfil_id);

drop policy if exists "insertar registros propios" on public.registros;
create policy "insertar registros propios" on public.registros
  for insert with check (auth.uid() = perfil_id);

-- Sin politicas de UPDATE ni DELETE: un registro, una vez subido, es historia.
-- Poder reescribirlo permitiria inflar totales a posteriori.

-- Grupos: visibles para sus miembros; cualquiera puede crear uno.
drop policy if exists "ver grupos propios" on public.grupos;
create policy "ver grupos propios" on public.grupos
  for select using (
    exists (select 1 from public.miembros m where m.grupo_id = id and m.perfil_id = auth.uid())
  );

drop policy if exists "crear grupo" on public.grupos;
create policy "crear grupo" on public.grupos
  for insert with check (auth.uid() = creador);

drop policy if exists "ver miembros de mis grupos" on public.miembros;
create policy "ver miembros de mis grupos" on public.miembros
  for select using (
    exists (select 1 from public.miembros m2 where m2.grupo_id = grupo_id and m2.perfil_id = auth.uid())
  );

drop policy if exists "unirme a un grupo" on public.miembros;
create policy "unirme a un grupo" on public.miembros
  for insert with check (auth.uid() = perfil_id);

drop policy if exists "salirme de un grupo" on public.miembros;
create policy "salirme de un grupo" on public.miembros
  for delete using (auth.uid() = perfil_id);

-- -----------------------------------------------------------------------------
-- 5. LA PIEZA CLAVE: permisos por columna
-- -----------------------------------------------------------------------------
-- Aunque la politica RLS permita actualizar el perfil propio, estos permisos
-- impiden que el cliente escriba las columnas de puntuacion. Puede cambiar su
-- nombre, su pais y si aparece en el ranking. Nada mas.
revoke update on public.perfiles from authenticated;
grant  update (nombre, pais, publico) on public.perfiles to authenticated;

-- -----------------------------------------------------------------------------
-- 6. RECALCULO SERVIDOR: los totales se DERIVAN, no se declaran
-- -----------------------------------------------------------------------------
create or replace function public.recalcular_perfil(p_perfil uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.perfiles p
     set puntos        = coalesce(a.puntos, 0),
         xp            = round(coalesce(a.puntos, 0) * 0.7),
         -- Curva de nivel identica a la del cliente: 80 * (n-1)^1.55
         nivel         = greatest(1, floor(power(coalesce(a.puntos, 0) * 0.7 / 80.0, 1/1.55)) + 1),
         co2e_total    = coalesce(a.co2e, 0),
         agua_total    = coalesce(a.agua, 0),
         residuo_total = coalesce(a.residuo, 0),
         registros_n   = coalesce(a.n, 0),
         dias_activos  = coalesce(a.dias, 0),
         actualizado   = now()
    from (
      select sum(puntos)::int                        as puntos,
             sum(co2e)                               as co2e,
             sum(agua)                               as agua,
             sum(residuo)                            as residuo,
             count(*)::int                           as n,
             count(distinct date_trunc('day', fecha))::int as dias
        from public.registros
       where perfil_id = p_perfil
    ) a
   where p.id = p_perfil;
end;
$$;

create or replace function public.al_insertar_registro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dia_puntos int;
begin
  -- Tope diario tambien en el servidor: la validacion del cliente se puede
  -- saltar llamando a la API directamente.
  select coalesce(sum(puntos), 0) into v_dia_puntos
    from public.registros
   where perfil_id = new.perfil_id
     and fecha >= date_trunc('day', new.fecha)
     and fecha <  date_trunc('day', new.fecha) + interval '1 day';

  if v_dia_puntos + new.puntos > 2500 then
    raise exception 'Tope diario de 2500 puntos superado (llevas %)', v_dia_puntos
      using errcode = 'check_violation';
  end if;

  perform public.recalcular_perfil(new.perfil_id);
  return new;
end;
$$;

drop trigger if exists tras_insertar_registro on public.registros;
create trigger tras_insertar_registro
  after insert on public.registros
  for each row execute function public.al_insertar_registro();

-- -----------------------------------------------------------------------------
-- 7. VISTAS DE RANKING
-- -----------------------------------------------------------------------------
-- security_invoker = true hace que la vista respete las politicas RLS de quien
-- consulta, en vez de las del propietario. Sin esto, la vista seria una puerta
-- trasera que expondria tambien los perfiles marcados como no publicos.
create or replace view public.ranking_global
with (security_invoker = true) as
  select id, nombre, pais, puntos, nivel, co2e_total, dias_activos, confianza, actualizado
    from public.perfiles
   where publico = true
   order by puntos desc
   limit 200;

create or replace view public.ranking_grupos
with (security_invoker = true) as
  select m.grupo_id,
         g.nombre as grupo,
         p.id, p.nombre, p.pais, p.puntos, p.nivel, p.co2e_total, p.dias_activos
    from public.miembros m
    join public.grupos   g on g.id = m.grupo_id
    join public.perfiles p on p.id = m.perfil_id
   order by p.puntos desc;

-- Impacto agregado de toda la comunidad: la cifra que combate la ecoansiedad.
create or replace view public.impacto_comunidad
with (security_invoker = true) as
  select count(*)::int         as participantes,
         sum(co2e_total)       as co2e_total,
         sum(agua_total)       as agua_total,
         sum(residuo_total)    as residuo_total,
         sum(registros_n)::int as acciones
    from public.perfiles
   where publico = true;

-- -----------------------------------------------------------------------------
-- 8. ALTA AUTOMATICA DE PERFIL AL REGISTRARSE
-- -----------------------------------------------------------------------------
create or replace function public.al_crear_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, pais)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), 'Guardian'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'pais'), ''), 'WW')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.al_crear_usuario();

-- -----------------------------------------------------------------------------
-- 9. UNIRSE A UN GRUPO POR CODIGO
-- -----------------------------------------------------------------------------
create or replace function public.unirse_por_codigo(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo uuid;
begin
  select id into v_grupo from public.grupos where codigo = upper(trim(p_codigo));
  if v_grupo is null then
    raise exception 'No existe ningun grupo con ese codigo';
  end if;
  insert into public.miembros (grupo_id, perfil_id)
  values (v_grupo, auth.uid())
  on conflict do nothing;
  return v_grupo;
end;
$$;

grant execute on function public.unirse_por_codigo(text) to authenticated;
