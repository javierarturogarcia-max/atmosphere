# Conectar `atmosphereapp.me` a GitHub Pages

Guía para pasar de `javierarturogarcia-max.github.io/atmosphere/` a
`https://atmosphereapp.me`.

> **El orden importa.** Si activas el dominio en GitHub antes de configurar el
> DNS, la URL de `github.io` empieza a redirigir a un dominio que todavía no
> resuelve, y tu sitio queda inaccesible hasta que el DNS propague. Haz los
> pasos en este orden y no habrá ningún corte.

---

## Paso 1 · Reclamar el dominio en Namecheap

Desde el [Student Developer Pack](https://education.github.com/pack) →
Namecheap → *Get access*. Registra `atmosphereapp.me` (gratis el primer año).

Si aparece con precio de tres cifras es un dominio **premium** y la oferta no lo
cubre; elige otra variante.

---

## Paso 2 · Configurar el DNS en Namecheap

Panel de Namecheap → **Domain List** → *Manage* junto a `atmosphereapp.me` →
pestaña **Advanced DNS**.

**Primero borra los registros que Namecheap crea por defecto**, en particular el
`CNAME` de `www` que apunta a `parkingpage.namecheap.com` y cualquier
`URL Redirect`. Si los dejas, entran en conflicto y el dominio seguirá
mostrando la página de aparcamiento.

Después añade estos registros:

| Tipo | Host | Valor | TTL |
|---|---|---|---|
| A Record | `@` | `185.199.108.153` | Automatic |
| A Record | `@` | `185.199.109.153` | Automatic |
| A Record | `@` | `185.199.110.153` | Automatic |
| A Record | `@` | `185.199.111.153` | Automatic |
| CNAME Record | `www` | `javierarturogarcia-max.github.io.` | Automatic |

Los cuatro registros `A` son obligatorios: GitHub sirve las páginas desde esas
cuatro direcciones y reparte la carga entre ellas.

**IPv6 (opcional pero recomendable).** Añade también los `AAAA`, sin quitar los
`A` — la adopción de IPv6 todavía es parcial y hacen falta ambos:

| Tipo | Host | Valor |
|---|---|---|
| AAAA Record | `@` | `2606:50c0:8000::153` |
| AAAA Record | `@` | `2606:50c0:8001::153` |
| AAAA Record | `@` | `2606:50c0:8002::153` |
| AAAA Record | `@` | `2606:50c0:8003::153` |

El punto final en `javierarturogarcia-max.github.io.` no es una errata: indica
un nombre absoluto. Namecheap lo añade solo si lo omites.

---

## Paso 3 · Comprobar que el DNS ya responde

Antes de tocar nada en GitHub, verifica desde tu terminal:

```bash
dig +short atmosphereapp.me
# Debe devolver las cuatro IP 185.199.10x.153

dig +short www.atmosphereapp.me
# Debe terminar en javierarturogarcia-max.github.io
```

Sin `dig` a mano, usa [dnschecker.org](https://dnschecker.org). La propagación
suele tardar entre 10 minutos y una hora en un dominio recién registrado.

**No sigas al paso 4 hasta que esto responda.**

---

## Paso 4 · Activar el dominio en GitHub

Repositorio → **Settings → Pages** → sección **Custom domain** → escribe
`atmosphereapp.me` → **Save**.

GitHub comprueba el DNS al guardar. Si el paso 3 salió bien, aparecerá un check
verde en cuestión de segundos.

---

## Paso 5 · Forzar HTTPS

En la misma pantalla, marca **Enforce HTTPS**.

La casilla puede tardar **hasta 24 horas** en habilitarse: GitHub emite un
certificado de Let's Encrypt para tu dominio y necesita que el DNS esté estable.
Si aparece en gris, vuelve más tarde. No es un error.

---

## Qué cambia en el proyecto

Nada del código. Todas las rutas de la aplicación son relativas, así que
funciona igual en la raíz de un dominio que en una subcarpeta de proyecto. El
flujo de trabajo de despliegue tampoco necesita cambios.

Lo único recomendable es añadir un archivo `CNAME` en la raíz del repositorio
con una sola línea:

```
atmosphereapp.me
```

Con despliegue por GitHub Actions, el dominio queda guardado en la
configuración de Pages, pero tener el archivo en el repositorio deja la
configuración explícita y versionada: si algún día se reconstruye el sitio
desde cero, el dominio viaja con el código.

**Añádelo solo después de completar el paso 3.**

---

## Si algo va mal

| Síntoma | Causa habitual |
|---|---|
| Sigue viendo la página de aparcamiento | Quedan registros por defecto de Namecheap sin borrar |
| `DNS check unsuccessful` en GitHub | El DNS aún no ha propagado; espera y pulsa *Check again* |
| El sitio carga pero sin estilos | Alguna ruta absoluta; en este proyecto no las hay |
| *Enforce HTTPS* en gris | Normal las primeras horas: el certificado se está emitiendo |
| Certificado con error tras cambiar el DNS | Quita el dominio en Settings, guarda, y vuelve a ponerlo para forzar la reemisión |
