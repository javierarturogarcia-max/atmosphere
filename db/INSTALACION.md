# Poner la base de datos en marcha

El esquema está escrito y **verificado contra un PostgreSQL real** (30
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

---

## 3 · Copiar las credenciales (1 min)

**Project Settings** (el engranaje) → **API**. Necesitas dos cosas:

| Campo | Dónde aparece |
|---|---|
| **Project URL** | `https://xxxxxxxxxxxx.supabase.co` |
| **anon public** | Una clave larga que empieza por `eyJ...` |

> ⚠️ **Nunca uses la clave `service_role`.** Esa salta todas las políticas de
> seguridad y daría control total a cualquiera que abriese la consola del
> navegador. La `anon public` está diseñada para vivir en el cliente: no es un
> secreto, y lo que protege los datos son las políticas RLS.

---

## 4 · Conectar la app (1 min)

1. Abre Atmosphere → pestaña **☁️ Nube y grupos**.
2. Pega la URL y la clave anon → **Conectar**.
3. **Crear cuenta** con tu correo.
4. **Sincronizar ahora**: sube tus registros locales y el servidor recalcula
   los totales.

---

## 5 · Para usarlo con tu clase

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
(nombre, pais, publico)` deja las columnas de puntuación fuera de su alcance:
no es una comprobación que se pueda evitar, es un permiso que no existe.

**¿Qué ve el resto de la gente?** Solo lo que expone la vista `ranking_global`,
y únicamente de quien haya marcado su perfil como público. Los registros
individuales son privados: ni los compañeros de grupo ven tu detalle.

**¿Qué se envía?** Acción, categoría, cantidad, impacto, puntos y fecha. **No**
se envían fotos, vídeos, notas ni coordenadas.

**¿Y si quiero borrar todo?** En Supabase: `delete from auth.users where id =
'...'`. El borrado en cascada se lleva el perfil, los registros y las
pertenencias a grupos.

---

## Comprobarlo sin Supabase

```bash
npm run test:db
```

Ejecuta `db/esquema.sql` contra un PostgreSQL real (PGlite, Postgres compilado
a WebAssembly) simulando las piezas que aporta Supabase, y comprueba 30 cosas:
que los disparadores recalculan bien, que el tope diario rechaza, que los
permisos por columna son los que deben ser, y que la curva de nivel del
servidor coincide con la del cliente.
