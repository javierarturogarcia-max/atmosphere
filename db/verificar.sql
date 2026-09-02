-- =============================================================================
-- Atmosphere — comprobacion del esquema instalado
--
-- Pegar entero en Supabase -> SQL Editor -> New query -> Run.
-- No modifica nada: solo lee el catalogo del sistema y reporta.
--
-- Toda fila debe salir con OK. Si alguna sale MAL, vuelve a ejecutar
-- db/esquema.sql completo: es idempotente y se puede repetir sin dano.
--
-- Las filas del bloque 'Social' cubren db/social.sql, que es OPCIONAL. Si no
-- lo has instalado saldran en '--' (no instalado), que no es un fallo.
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
  -- OJO: la misma lista blanca aparece tambien en la comprobacion 10.5, que
  -- vigila el esquema entero. Al anadir una columna escribible hay que tocar
  -- las dos, y esta prueba se pone en MAL si se olvida una.
  select 9, 'Antifraude',
         'El cliente SOLO puede escribir columnas inocuas del perfil',
         -- Lista blanca: 'mote' se anade con db/social.sql y tambien es inocua.
         -- Se comprueba que no haya NINGUNA columna fuera de ella y que esten
         -- las tres basicas; asi la comprobacion vale con capa social y sin ella.
         coalesce(bool_and(column_name::text in ('nombre','pais','publico','mote','avatar')), false)
           and count(*) filter (where column_name::text in ('nombre','pais','publico')) = 3,
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
     and column_name in ('puntos','xp','nivel','co2e_total','agua_total','residuo_total','registros_n','dias_activos','aura')

  -- 7bis. Ningun permiso de escritura suelto en todo el esquema -------------
  -- Supabase concede TODO sobre cada tabla nueva de public por privilegios por
  -- defecto, asi que los guiones tienen que revocar antes de conceder. Esta
  -- fila vigila el esquema entero, no una tabla concreta: es la que detecta un
  -- UPDATE olvidado en una tabla que se anada manana.
  union all
  select 10.5, 'Antifraude',
         'Ningun UPDATE suelto en el resto del esquema',
         count(*) = 0,
         case when count(*) = 0 then 'solo el perfil es actualizable, y por columnas'
              else 'PERMISO INDEBIDO sobre ' || string_agg(distinct table_name::text, ', ') end
    from information_schema.column_privileges
   where table_schema = 'public' and grantee in ('anon','authenticated')
     and privilege_type = 'UPDATE'
     and not (table_name = 'perfiles'
              and column_name::text in ('nombre','pais','publico','mote','avatar'))
     and not (table_name = 'megusta' and column_name::text = 'tipo')

  -- 8. Estado de los datos --------------------------------------------------
  union all
  select 11, 'Datos',
         'Perfiles registrados',
         true,
         count(*) || ' perfiles, ' || count(*) filter (where publico) || ' publicos'
    from public.perfiles


  -- 9. Capa social (db/social.sql, opcional) --------------------------------
  -- Estas filas salen en '--' si no se ha instalado la capa social; solo se
  -- ponen en MAL si esta instalada a medias, que es el caso que importa.
  union all
  select 13, 'Social',
         'Las 3 tablas de la comunidad existen',
         count(*) = 3,
         case when count(*) = 0 then 'capa social no instalada (opcional)'
              else string_agg(tablename, ', ' order by tablename) end
    from pg_tables
   where schemaname = 'public'
     and tablename in ('publicaciones','megusta','reportes')

  union all
  select 14, 'Social',
         'RLS activada en las 3 tablas de la comunidad',
         count(*) filter (where c.relrowsecurity) = count(*),
         case when count(*) = 0 then 'capa social no instalada (opcional)'
              else string_agg(c.relname || case when c.relrowsecurity then ' ✓' else ' ✗' end,
                              ', ' order by c.relname) end
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('publicaciones','megusta','reportes')

  union all
  select 15, 'Social',
         'El cliente NO puede escribir aura ni likes_n',
         count(*) = 0,
         case when count(*) = 0 then 'reputacion protegida'
              else 'PERMISO INDEBIDO sobre ' || string_agg(table_name::text || '.' || column_name::text, ', ') end
    from information_schema.column_privileges
   where table_schema = 'public'
     and grantee = 'authenticated' and privilege_type = 'UPDATE'
     and ((table_name = 'perfiles' and column_name = 'aura')
       or (table_name = 'publicaciones' and column_name in ('likes_n','reportes_n','oculto','aura_generada')))

  union all
  select 16, 'Social',
         'publicaciones es append-only (sin UPDATE)',
         count(*) = 0,
         case when count(*) = 0 then 'nadie edita una publicacion ya hecha'
              else 'HAY politica UPDATE' end
    from pg_policies
   where schemaname = 'public' and tablename = 'publicaciones' and cmd = 'UPDATE'

  -- Las politicas del almacen se ponen a menudo A MANO, porque social.sql no
  -- puede crearlas cuando storage.objects pertenece a supabase_storage_admin.
  -- Comprobar solo que el cubo existe dejaba fuera justo la parte manual: se
  -- podia tener todo en OK y fallar al subir el primer video.
  union all
  select 17.5, 'Social',
         'El almacen tiene sus politicas de acceso',
         count(*) >= 3,
         case when count(*) = 0
              then 'FALTAN las 3: ponlas en Storage -> Policies (estan en db/INSTALACION.md)'
              when count(*) < 3
              then 'solo ' || count(*) || ' de 3: ' || string_agg(policyname, ', ')
              else string_agg(policyname, ', ' order by policyname) end
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and coalesce(qual, '') || coalesce(with_check, '') like '%evidencias%'

  union all
  select 17, 'Social',
         'El cubo de medios existe y es publico',
         count(*) = 1,
         case when count(*) = 0 then 'falta el cubo evidencias — crealo en Storage'
              else 'evidencias, ' || (select case when public then 'publico' else 'PRIVADO (deberia ser publico)' end
                                        from storage.buckets where id = 'evidencias') end
    from storage.buckets where id = 'evidencias'

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
       case when bloque = 'Social' and to_regclass('public.publicaciones') is null then '--'
            when correcto then 'OK'
            else 'MAL' end as estado,
       case when bloque = 'Social' and to_regclass('public.publicaciones') is null
            then 'capa social no instalada (opcional)'
            else detalle end as detalle
  from comprobaciones
 order by orden;
