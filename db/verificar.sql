-- =============================================================================
-- Atmosphere — comprobacion del esquema instalado
--
-- Pegar entero en Supabase -> SQL Editor -> New query -> Run.
-- No modifica nada: solo lee el catalogo del sistema y reporta.
--
-- Toda fila debe salir con OK. Si alguna sale MAL, vuelve a ejecutar
-- db/esquema.sql completo: es idempotente y se puede repetir sin dano.
-- =============================================================================

with comprobaciones as (

  -- 1. Tablas ---------------------------------------------------------------
  select 1 as orden, 'Tablas' as bloque,
         'Las 4 tablas existen' as comprobacion,
         count(*) = 4 as correcto,
         string_agg(tablename, ', ' order by tablename) as detalle
    from pg_tables
   where schemaname = 'public'
     and tablename in ('perfiles','registros','grupos','miembros')

  -- 2. Vistas ---------------------------------------------------------------
  union all
  select 2, 'Vistas',
         'Las 3 vistas existen',
         count(*) = 3,
         string_agg(viewname, ', ' order by viewname)
    from pg_views
   where schemaname = 'public'
     and viewname in ('ranking_global','ranking_grupos','impacto_comunidad')

  -- 3. Seguridad por fila ---------------------------------------------------
  union all
  select 3, 'Seguridad',
         'RLS activada en las 4 tablas',
         count(*) filter (where c.relrowsecurity) = 4,
         coalesce(string_agg(c.relname || case when c.relrowsecurity then ' ✓' else ' ✗' end,
                             ', ' order by c.relname), 'ninguna tabla encontrada')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('perfiles','registros','grupos','miembros')

  union all
  select 4, 'Seguridad',
         'Hay al menos 10 politicas definidas',
         count(*) >= 10,
         count(*) || ' politicas'
    from pg_policies where schemaname = 'public'

  -- 4. Registros inmutables -------------------------------------------------
  union all
  select 5, 'Integridad',
         'registros es append-only (sin UPDATE ni DELETE)',
         count(*) = 0,
         case when count(*) = 0 then 'ninguna politica de escritura destructiva'
              else 'HAY politicas ' || string_agg(cmd, '/') end
    from pg_policies
   where schemaname = 'public' and tablename = 'registros'
     and cmd in ('UPDATE','DELETE')

  -- 5. Funciones ------------------------------------------------------------
  union all
  select 6, 'Logica',
         'Las 4 funciones del servidor existen',
         count(*) = 4,
         string_agg(p.proname, ', ' order by p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('recalcular_perfil','al_insertar_registro','al_crear_usuario','unirse_por_codigo')

  -- 6. Disparadores ---------------------------------------------------------
  union all
  select 7, 'Logica',
         'Disparador que recalcula los totales al insertar',
         count(*) = 1,
         coalesce(string_agg(tgname, ', '), 'NO EXISTE')
    from pg_trigger
   where not tgisinternal and tgname = 'tras_insertar_registro'

  union all
  select 8, 'Logica',
         'Disparador que crea el perfil al registrarse',
         count(*) = 1,
         coalesce(string_agg(tgname, ', '), 'NO EXISTE — revisa que se ejecuto el bloque 8 del esquema')
    from pg_trigger
   where not tgisinternal and tgname = 'al_crear_usuario'

  -- 7. LA COMPROBACION CLAVE: permisos por columna --------------------------
  -- Si esto falla, cualquiera puede escribir sus propios puntos desde la
  -- consola del navegador y el ranking deja de significar nada.
  union all
  select 9, 'Antifraude',
         'El cliente SOLO puede escribir nombre, pais y publico',
         coalesce(array_agg(column_name::text order by column_name::text), '{}') = array['nombre','pais','publico']::text[],
         coalesce(string_agg(column_name::text, ', ' order by column_name::text), '(ninguna)')
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'perfiles'
     and grantee = 'authenticated' and privilege_type = 'UPDATE'

  union all
  select 10, 'Antifraude',
         'El cliente NO puede escribir puntos, xp ni nivel',
         count(*) = 0,
         case when count(*) = 0 then 'columnas de puntuacion protegidas'
              else 'PERMISO INDEBIDO sobre ' || string_agg(column_name::text, ', ') end
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'perfiles'
     and grantee = 'authenticated' and privilege_type = 'UPDATE'
     and column_name in ('puntos','xp','nivel','co2e_total','agua_total','residuo_total','registros_n','dias_activos')

  -- 8. Estado de los datos --------------------------------------------------
  union all
  select 11, 'Datos',
         'Perfiles registrados',
         true,
         count(*) || ' perfiles, ' || count(*) filter (where publico) || ' publicos'
    from public.perfiles

  union all
  select 12, 'Datos',
         'Registros sincronizados',
         true,
         count(*) || ' registros, ' || coalesce(sum(puntos), 0) || ' puntos, ' ||
         round(coalesce(sum(co2e), 0), 2) || ' kg CO2e'
    from public.registros
)
select bloque,
       comprobacion,
       case when correcto then 'OK' else 'MAL' end as estado,
       detalle
  from comprobaciones
 order by orden;
