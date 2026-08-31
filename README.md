# 🌍 Atmosphere

**Plataforma gamificada de acción climática con motor de impacto científico, analítica estadística avanzada y sistema de recompensas.**

Atmosphere convierte lo que ya haces bien por el planeta en **impacto físico medido** —kg de CO₂e, litros de agua, kg de residuo desviado— y, a partir de ahí, en progresión de juego. No al revés. Esa inversión del orden habitual es la decisión de diseño central del proyecto.

> Sin cuenta. Sin servidor. Sin telemetría. Todo se calcula y se guarda en tu dispositivo.

---

## Por qué existe

La mayoría de las apps de sostenibilidad fallan por una de estas tres razones:

| Fallo habitual | Cómo lo resuelve Atmosphere |
|---|---|
| Puntos arbitrarios sin relación con el impacto | Los puntos derivan de kg CO₂e, litros y kg de residuo evitados, con factores citados |
| No declaran la línea base contrafactual | Cada acción declara explícitamente **frente a qué** ahorra (`base`) |
| Cifras falsamente exactas | Se propaga la incertidumbre del ACV y se muestran intervalos de confianza al 95 % |
| Se pueden "farmear" repitiendo una acción | Saturación logarítmica por categoría y día + topes de plausibilidad + detección de anomalías |
| Proyecciones desbocadas a partir de un pico | Estimadores robustos (Theil-Sen, Mann-Kendall) y proyecciones marcadas como no fiables cuando la serie no las sostiene |

---

## Qué incluye

**Motor de impacto** — 51 acciones en 8 categorías (movilidad, energía, agua, residuos, alimentación, consumo, biodiversidad, comunidad), cada una con factor, unidad, línea base, dificultad, rareza, tope diario y fuente.

**Sistema de juego** — XP con curva superlineal, 10 rangos, 47 insignias evaluadas por predicados puros, misiones diarias/semanales/mensuales generadas de forma determinista, rachas con congelaciones, 6 ligas, 16 recompensas canjeables.

**Sincronización opcional en la nube** — Postgres (Supabase) con seguridad por fila, grupos por clase o centro, y ranking con personas reales. Desactivada por defecto: la app funciona entera sin cuenta. **El cliente nunca escribe su propia puntuación** — solo inserta registros inmutables, y el servidor deriva los totales con un disparador. El esquema se verifica contra un PostgreSQL real con `npm run test:db` (30 comprobaciones del núcleo + 19 de la capa social). Puesta en marcha en [`db/INSTALACION.md`](db/INSTALACION.md).

**Analítica** — regresión OLS y Theil-Sen, test de tendencia de Mann-Kendall con corrección por empates, media móvil, EWMA, bootstrap, índices de Shannon/Pielou/Gini, perfiles circadiano y semanal, mapa de calor de constancia.

**Calculadora de huella** — método híbrido ACV + EEIO, mix eléctrico de 38 países, forzamiento radiativo de la aviación, 8 escenarios contrafactuales ordenados por ahorro.

**Calidad del aire en tiempo real** — datos de Open-Meteo (modelos CAMS de Copernicus y GEOS-CF de la NASA) por geolocalización o búsqueda de ciudad, sin clave de API y sin servidor. AQI de la EPA (revisión 2024 de PM2,5), contraste con las guías OMS 2021, riesgo relativo de mortalidad y años de vida perdidos según el modelo log-lineal del GBD.

**El juego reacciona al entorno** — cuando el aire de tu zona está mal, las acciones de movilidad y energía puntúan hasta el doble durante 3 horas, y aparece una misión contextual (*«AQI 117: deja el coche hoy»*). Es lo que separa una app de hábitos de una herramienta de salud pública.

**Puntos extra por prueba gráfica** — foto o vídeo de la acción, con la cámara abriéndose directamente en el móvil. El multiplicador no depende de *adjuntar* algo, sino de lo **comprobable** de ese algo: se leen los metadatos EXIF (cuándo y dónde se tomó), se compara con tu ubicación, y un hash perceptual detecta la misma foto reenviada aunque venga reescalada o recomprimida.

| Prueba | Multiplicador |
|---|---|
| Sin evidencia | ×1 |
| Foto sin metadatos | ×1,10 |
| Foto tomada hoy | ×1,25 |
| Foto de hoy con GPS coherente | ×1,40 |
| Vídeo del momento | ×1,45 |
| Imagen ya usada antes | ×1 y marcada |

**Verificación con el dispositivo** — GPS en vivo o importación de trazas GPX/TCX desde Strava, Garmin, Komoot o Apple Salud. La distancia la mide el aparato, no la teclea la persona: se infiere el modo de transporte del perfil de velocidad, se descartan los saltos de GPS y se comprueba que la traza respalde la acción declarada.

**Red social de buenas acciones** — cada prueba puede publicarse en el muro de la comunidad con un **mote** (`@sembradora`, 3-15 caracteres). Los vídeos cortos se reproducen en bucle y sin sonido, hay pestaña de **🔥 Virales** y de **🕐 Reciente**, y los me gusta alimentan el **aura**, una reputación pública de buenas acciones.

El aura **no se mezcla con los puntos**: los puntos son impacto físico, el aura es reconocimiento social. Un vídeo gracioso nunca vale más que plantar un árbol. Y el aura **la deriva el servidor**, no el navegador: `+8` por publicar, `+2` por me gusta recibido, `+5` si la prueba venía verificada. Nadie puede darse me gusta a sí mismo —lo impide la política de la base de datos, no una comprobación del cliente— y tres reportes de personas distintas ocultan una publicación y dejan de contarle el aura.

**Antifraude** — cuatro capas: topes físicos, tiempos de espera, z robusta con degradación a desviación absoluta media, y coherencia temporal del día (nadie declara más de 24 h de actividad).

---

## Arranque rápido

```bash
npm run dev      # servidor local en http://localhost:4173
npm test         # 161 pruebas del motor
npm run test:db  # ejecuta el SQL contra un PostgreSQL real (PGlite): 30 + 19 comprobaciones
npm run build    # genera dist/atmosphere.html (un solo archivo, sin dependencias)
npm run verify   # pruebas + esquema + build
```

No hay dependencias de producción; la única de desarrollo es PGlite, que sirve
para verificar el esquema SQL y no llega al navegador. `index.html` funciona directamente sobre cualquier servidor estático, y `dist/atmosphere.html` funciona incluso abierto desde el sistema de archivos.

---

## Arquitectura

```
src/
├── data/          Datos científicos (sin lógica)
│   ├── factores.js       Factores de emisión con fuente, año e incertidumbre
│   ├── acciones.js       Catálogo de 51 acciones registrables
│   ├── paises.js         Mix eléctrico y huella per cápita de 38 países
│   ├── logros.js         45 insignias con condición pura
│   ├── recompensas.js    16 canjes en 4 familias
│   └── indicadores.js    Estado del sistema Tierra + límites planetarios
│
├── core/          Motor (puro, sin DOM, 100 % testeable)
│   ├── impacto.js        Cantidad → impacto físico
│   ├── puntos.js         Impacto → puntos (saturación, multiplicadores, topes)
│   ├── validacion.js     Antifraude en cuatro capas
│   ├── estadistica.js    Caja de herramientas estadística
│   ├── analitica.js      Series temporales y resumen del perfil
│   ├── nivel.js          XP, niveles, rangos
│   ├── rachas.js         Rachas y congelaciones
│   ├── misiones.js       Generador determinista de retos
│   ├── logros.js         Evaluación de insignias
│   ├── huella.js         Calculadora ACV + EEIO
│   ├── aire.js           AQI, guías OMS, riesgo sanitario y conversión de unidades
│   ├── openmeteo.js      Fuente de datos reales de calidad del aire
│   ├── gps.js            Trazas, inferencia de modo y verificación
│   ├── gpx.js            Lectura de archivos GPX y TCX
│   ├── evidencia.js      EXIF, hash perceptual y credibilidad de pruebas
│   ├── nube.js           Cliente REST de Supabase, sin dependencias
│   ├── social.js         Muro, motes, aura, me gusta y subida de medios
│   ├── ranking.js        Ligas y cohorte log-normal
│   ├── rng.js            Aleatoriedad determinista (mulberry32)
│   └── estado.js         Almacén, persistencia y transacciones
│
├── db/            esquema.sql (núcleo), social.sql (muro y aura) e INSTALACION.md
│
└── ui/            Interfaz (sin dependencias, gráficos SVG a mano)
    ├── app.js            Navegación y enrutado
    ├── componentes.js    Primitivas y gráficos
    ├── medios.js         Cámara, miniaturas e IndexedDB
    └── vistas/           13 vistas
```

La separación **impacto ≠ puntos** es deliberada: el impacto es física y no debe contaminarse con reglas de juego; los puntos son una capa motivacional construida encima y sustituible.

---

## La fórmula de puntuación

```
base     = 10·CO₂e + 0,01·agua + 5·residuo        (con suelo mínimo de 3)
bruto    = base × f_dificultad × f_rareza × f_racha × f_misión × f_evento
S(x)     = 160 · ln(1 + x/160)                     (saturación por categoría y día)
puntos   = S(acumulado + bruto) − S(acumulado)
tope     = 2.500 pts/día
```

`S(x)` es cóncava y creciente: la décima acción de la misma categoría en un día rinde una fracción de la primera. Es lo que impide convertir el sistema en una máquina de repetir la acción más cómoda.

---

## Publicación

El sitio es estático: cualquier alojamiento de archivos estáticos sirve, sin
configuración especial y sin variables de entorno. Todas las rutas son
relativas, así que funciona igual en la raíz de un dominio que en una
subcarpeta de proyecto.

### GitHub Pages (configurado en este repositorio)

El flujo de trabajo `.github/workflows/pages.yml` ejecuta las 161 pruebas,
comprueba que `dist/` no esté desfasado respecto a `src/` y publica. Para
activarlo una sola vez:

**Settings → Pages → Build and deployment → Source: _GitHub Actions_**

A partir de ahí, cada `push` a la rama publica automáticamente en
`https://<usuario>.github.io/atmosphere/`.

### Alternativas equivalentes

| Alojamiento | Ancho de banda gratuito | Configuración |
|---|---|---|
| GitHub Pages | 100 GB/mes | Ninguna: el código ya está aquí |
| Cloudflare Pages | Ilimitado | Conectar el repositorio; carpeta de salida `/`, sin comando de compilación |
| Netlify | 100 GB/mes | Igual: sin comando de compilación, directorio `.` |

En los tres casos el comando de compilación se deja **vacío**: no hay nada que
compilar. `npm run build` solo genera el archivo único de `dist/`, que es un
extra, no un requisito para servir el sitio.

## Documentación

- **[CIENCIA.md](CIENCIA.md)** — metodología completa, factores, fuentes y limitaciones asumidas.
- **[IDEAS.md](IDEAS.md)** — hoja de ruta y propuestas de evolución (v2, v3, modelos de sostenibilidad económica).

---

## Privacidad

Por defecto los datos viven exclusivamente en `localStorage` y las fotos y vídeos en IndexedDB, ambos en tu dispositivo. No hay cookies de terceros ni identificadores publicitarios, y la aplicación funciona entera sin conexión.

Solo hay tres peticiones de red, y **ninguna ocurre sin que la pidas**:

| Petición | Cuándo | Qué se envía |
|---|---|---|
| Fuentes tipográficas | Al cargar | Nada tuyo |
| Open-Meteo (aire) | Si consultas la calidad del aire | Coordenadas redondeadas o el nombre de la ciudad. Sin cuenta ni clave |
| Supabase (nube) | Si conectas un proyecto y creas cuenta | Acción, categoría, cantidad, impacto, puntos y fecha |
| Supabase (comunidad) | Solo al pulsar **Publicar** en una prueba concreta | Ese vídeo o foto, su mote y el texto que escribas |

La sincronización **no** sube fotos, vídeos, notas ni coordenadas: eso solo sale de tu dispositivo si publicas una prueba a propósito, una por una. Y lo publicado se puede borrar desde la propia tarjeta. Puedes exportar todo tu historial en JSON o CSV y borrarlo cuando quieras.

## Licencia

MIT.
