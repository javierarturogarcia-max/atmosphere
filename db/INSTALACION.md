# Poner la base de datos en marcha

El esquema está escrito y **verificado contra un PostgreSQL real** (50
comprobaciones, ver `npm run test:db`). Lo único que falta es tu proyecto de
Supabase, porque crear una cuenta a tu nombre no lo puede hacer nadie más.

Son unos diez minutos.

---

## 1 · Crear el proyecto (5 min)

1. Entra en **[supabase.com](https://supabase.com)** → *Start your project* →
   entra con tu cuenta de GitHub.
2. **New project**:
   - *Name*: `atmosphere`
   - *Database Password*: genera una y **guárdala** (no la necesitarás para la
     app, pero sí para acceso directo a la base)
   - *Region*: `East US (North Virginia)` es la más cercana a El Salvador
   - *Plan*: Free
3. Espera 2-3 minutos mientras se aprovisiona.

> El plan gratuito **pausa el proyecto tras una semana sin uso**. Se reactiva
> con un clic desde el panel; no se pierde nada. Conviene saberlo antes de una
> demostración en clase: entra el día anterior y compruébalo.

---

## 2 · Ejecutar el esquema (1 min)

1. En el menú lateral: **SQL Editor** → **New query**.
2. Abre [`db/esquema.sql`](esquema.sql), copia **todo** el contenido y pégalo.
3. Pulsa **Run** (o `Ctrl+Enter`).

Debe terminar con *Success. No rows returned*. Eso crea las 4 tablas, las 3
vistas, las 10 políticas de seguridad y los 3 disparadores.

Si vuelves a ejecutarlo no pasa nada: el guion es idempotente (`create table if
not exists`, `drop policy if exists`).

### Comprobar que quedó bien instalado

Pega también [`db/verificar.sql`](verificar.sql) en una consulta nueva y pulsa
**Run**. Devuelve una tabla de 18 filas:

| bloque | comprobacion | estado |
|---|---|---|
| Tablas | Las 4 tablas existen | OK |
| Seguridad | RLS activada en las 4 tablas | OK |
| Antifraude | El cliente NO puede escribir puntos, xp ni nivel | OK |
| … | | |
| Social | Las 3 tablas de la comunidad existen | -- |

No modifica nada: solo lee el catálogo del sistema. Si alguna sale `MAL`,
vuelve a ejecutar `esquema.sql` entero — es idempotente y se puede repetir.

Los estados son tres:

- **`OK`** — correcto.
- **`MAL`** — hay que reejecutar el guion correspondiente.
- **`--`** — la capa social todavía no está instalada. **No es un fallo**: es
  opcional y se instala en el paso siguiente. En cuanto la pongas, esas cinco
  filas pasan a `OK`.

Las dos filas del bloque `Datos` son informativas, no comprobaciones: te dicen
cuántos perfiles y registros hay, útil para confirmar que la sincronización
llegó.

---

## 3 · Ejecutar la capa social (1 min)

El muro de la comunidad —motes, vídeos, me gusta y aura— vive en un segundo
guion, aparte del núcleo. Se instala igual:

1. **SQL Editor** → **New query**.
2. Abre [`db/social.sql`](social.sql), copia **todo** y pégalo.
3. **Run**.

Debe terminar con *Success. No rows returned*. Crea las 3 tablas nuevas
(`publicaciones`, `megusta`, `reportes`), añade las columnas `mote` y `aura` a
`perfiles`, las vistas `muro` y `virales`, y el cubo de almacenamiento
`evidencias` para los vídeos.

También es idempotente: puedes reejecutarlo sin miedo.

> **Requiere haber ejecutado antes `esquema.sql`**, porque amplía la tabla
> `perfiles` que aquel crea. Si lo ejecutas primero, dará error de tabla
> inexistente; no rompe nada, solo ejecútalos en orden.

Si prefieres **no** tener capa social, sáltate este paso: la app detecta que las
tablas no existen y la pestaña 🎬 Comunidad se queda inactiva. Todo lo demás
funciona igual.

### El almacén de vídeos (esto casi seguro lo tendrás que hacer a mano)

`social.sql` intenta crear el cubo y sus políticas, pero **en la mayoría de
proyectos no puede**: la tabla `storage.objects` pertenece a
`supabase_storage_admin`, no al rol con el que corre el editor SQL, así que
crear políticas sobre ella da *«must be owner of table objects»*.

El guion lo tiene previsto: esa parte va en un bloque que captura el error,
avisa por **NOTICE** y sigue. Mira el panel *Results* / *Logs* debajo de la
consulta — si aparece una línea que empieza por `ATMOSPHERE:`, te dice
exactamente qué faltó.

> Esto es también la razón de que el guion no sea un simple `create policy`
> suelto: el editor SQL de Supabase ejecuta **todo lo que le pegas como una
> sola transacción**, así que un error al final deshace todo lo de arriba y la
> instalación queda vacía, aparentando que nunca se ejecutó.

**1 · El cubo.** Storage → **New bucket**:

- *Name*: `evidencias`
- **Public bucket**: marcado
- *File size limit*: `25 MB`

**2 · Las tres políticas.** Storage → **Policies** → sobre el cubo
`evidencias` → **New policy** → *For full customization*. Crea estas tres:

| Nombre | Operación | Rol | Expresión |
|---|---|---|---|
| `leer evidencias` | SELECT | `public` | `bucket_id = 'evidencias'` |
| `subir a mi carpeta` | INSERT | `authenticated` | `bucket_id = 'evidencias' and (storage.foldername(name))[1] = auth.uid()::text` |
| `borrar lo mio del almacen` | DELETE | `authenticated` | `bucket_id = 'evidencias' and (storage.foldername(name))[1] = auth.uid()::text` |

En INSERT la expresión va en **WITH CHECK**; en SELECT y DELETE, en **USING**.

La de INSERT es la que importa: `storage.foldername('<uuid>/video.webm')`
devuelve `{<uuid>}`, así que compararlo con `auth.uid()` impide escribir en la
carpeta de otra persona. Sin ella, cualquiera podría subir archivos al nombre
de quien quisiera.

**Cómo saber si faltan:** la app te lo dice. Al publicar, si falta el cubo el
mensaje nombra *New bucket*; si faltan las políticas, nombra *Policies*.

El plan gratuito incluye **1 GB** de almacenamiento: entre 300 y 900 vídeos
cortos. Suficiente para un aula durante un curso.

---

## 4 · Copiar las credenciales (1 min)

**Project Settings** (el engranaje) → **API Keys**. Necesitas dos cosas:

| Campo | Aspecto |
|---|---|
| **Project URL** | `https://xxxxxxxxxxxx.supabase.co` |
| **Publishable key** | `sb_publishable_...` |

Supabase migró de las claves JWT (`eyJ...`) al formato `sb_publishable_...`. Si
tu proyecto todavía muestra la antigua **anon public**, también sirve: la app
admite los dos formatos.

> ⚠️ **Nunca uses la clave secreta** (`sb_secret_...` o `service_role`). Esa salta todas las políticas de
> seguridad y daría control total a cualquiera que abriese la consola del
> navegador. La `anon public` está diseñada para vivir en el cliente: no es un
> secreto, y lo que protege los datos son las políticas RLS.

---

## 5 · Conectar la app (1 min)

1. Abre Atmosphere → pestaña **☁️ Nube y grupos**.
2. Pega la URL y la clave anon → **Conectar**.
3. **Crear cuenta** con tu correo.
4. **Sincronizar ahora**: sube tus registros locales y el servidor recalcula
   los totales.
5. Pestaña **🎬 Comunidad** → elige tu **mote** (3-15 caracteres, letras
   minúsculas, números y guion bajo). Es único y no se puede repetir.

---

## 6 · Para usarlo con tu clase

1. En **Nube y grupos** → **➕ Crear grupo** → por ejemplo *«Quinto B —
   Ciencias»*, tipo `clase`.
2. Aparecerá un **código de 6 caracteres**. Repártelo.
3. Cada persona: crea su cuenta → **🔗 Unirme con código** → lo escribe.
4. El ranking del grupo se llena solo conforme cada quien sincroniza.

Los códigos no usan `0`, `O`, `1` ni `I` a propósito: son los caracteres que se
confunden al dictarlos en voz alta.

---

## Detalles que quizá te pregunten

**¿Puede alguien inflar su puntuación?** No por la API. El cliente solo puede
insertar registros individuales, que son inmutables, y un disparador del
servidor recalcula los totales a partir de ellos. Además, `GRANT UPDATE
(nombre, pais, publico, mote)` deja las columnas de puntuación fuera de su
alcance:
no es una comprobación que se pueda evitar, es un permiso que no existe.

**¿Qué ve el resto de la gente?** Solo lo que expone la vista `ranking_global`,
y únicamente de quien haya marcado su perfil como público. Los registros
individuales son privados: ni los compañeros de grupo ven tu detalle.

**¿Qué se envía al sincronizar?** Acción, categoría, cantidad, impacto, puntos
y fecha. **No** se envían fotos, vídeos, notas ni coordenadas: la sincronización
nunca sube medios. Un vídeo o una foto sale de tu dispositivo únicamente cuando
pulsas **Publicar** sobre esa prueba concreta, una por una, y se puede borrar
después desde la propia tarjeta.

**¿Pueden inflar su aura?** Tampoco. El aura no se envía nunca desde el
navegador: la deriva una función del servidor sumando publicaciones visibles y
me gusta recibidos, y la columna `aura` está fuera del `GRANT UPDATE`. Darse me
gusta a uno mismo lo rechaza una política de la base de datos, y el doble me
gusta lo impide la clave primaria.

**¿Y si alguien publica algo inapropiado?** Tres reportes de personas distintas
lo ocultan automáticamente del muro y dejan de contarle el aura. Su autor sigue
viéndolo para poder borrarlo.

**¿El aura da puntos?** No, y es a propósito. Los puntos miden impacto físico;
el aura mide reconocimiento. Un vídeo gracioso nunca vale más que plantar un
árbol. Están en tablas distintas y en rankings distintos.

**¿Y si quiero borrar todo?** En Supabase: `delete from auth.users where id =
'...'`. El borrado en cascada se lleva el perfil, los registros y las
pertenencias a grupos.

---

## Si ya lo habías instalado antes

Las versiones anteriores de `esquema.sql` y `social.sql` no revocaban los
privilegios por defecto de Supabase, así que dejaban permisos de `UPDATE`
colgando sobre tablas que no debían tenerlos. Si tu verificación muestra
`MAL` en alguna fila de antifraude, se arregla **reejecutando los dos guiones**
en orden — son idempotentes:

1. **SQL Editor** → pega `db/esquema.sql` entero → **Run**
2. **SQL Editor** → pega `db/social.sql` entero → **Run**
3. Pega `db/verificar.sql` → todas las filas deben salir en `OK`

No se pierde ningún dato: `create table if not exists` respeta lo que ya
existe, y lo único que cambia son los permisos.

---

## Comprobarlo sin Supabase

```bash
npm run test:db
```

Ejecuta `db/esquema.sql` y `db/social.sql` contra un PostgreSQL real (PGlite,
Postgres compilado a WebAssembly) simulando las piezas que aporta Supabase.

- **30 comprobaciones del núcleo**: que los disparadores recalculan bien, que el
  tope diario rechaza, que los permisos por columna son los que deben ser, y que
  la curva de nivel del servidor coincide con la del cliente.
- **20 comprobaciones de la capa social**: que el autolike se rechaza, que el
  doble me gusta lo impide la clave primaria, que nadie escribe su propia aura
  ni infla `likes_n`, que tres reportes ocultan una publicación y el aura cae,
  que cada quien solo puede subir archivos a su propia carpeta, y que un error
  de permisos en el almacén no deshace el resto del guion.

Las pruebas de seguridad hacen `set role authenticated` antes de intentar el
abuso: como superusuario, PostgreSQL salta las políticas RLS y las
comprobaciones pasarían siempre, que es la forma más común de tener una batería
de pruebas RLS que en realidad no prueba nada.
