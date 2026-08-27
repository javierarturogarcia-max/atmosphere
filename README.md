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

**Sistema de juego** — XP con curva superlineal, 10 rangos, 45 insignias evaluadas por predicados puros, misiones diarias/semanales/mensuales generadas de forma determinista, rachas con congelaciones, 6 ligas, 16 recompensas canjeables.

**Analítica** — regresión OLS y Theil-Sen, test de tendencia de Mann-Kendall con corrección por empates, media móvil, EWMA, bootstrap, índices de Shannon/Pielou/Gini, perfiles circadiano y semanal, mapa de calor de constancia.

**Calculadora de huella** — método híbrido ACV + EEIO, mix eléctrico de 38 países, forzamiento radiativo de la aviación, 8 escenarios contrafactuales ordenados por ahorro.

**Calidad del aire** — AQI de la EPA (revisión 2024 de PM2,5), contraste con las guías OMS 2021, riesgo relativo de mortalidad y años de vida perdidos según el modelo log-lineal del GBD.

**Antifraude** — cuatro capas: topes físicos, tiempos de espera, z robusta con degradación a desviación absoluta media, y coherencia temporal del día (nadie declara más de 24 h de actividad).

---

## Arranque rápido

```bash
npm run dev      # servidor local en http://localhost:4173
npm test         # 85 pruebas del motor
npm run build    # genera dist/atmosphere.html (un solo archivo, sin dependencias)
npm run verify   # pruebas + build
```

No hay dependencias de producción. `index.html` funciona directamente sobre cualquier servidor estático, y `dist/atmosphere.html` funciona incluso abierto desde el sistema de archivos.

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
│   ├── aire.js           AQI, guías OMS y riesgo sanitario
│   ├── ranking.js        Ligas y cohorte log-normal
│   ├── rng.js            Aleatoriedad determinista (mulberry32)
│   └── estado.js         Almacén, persistencia y transacciones
│
└── ui/            Interfaz (sin dependencias, gráficos SVG a mano)
    ├── app.js            Navegación y enrutado
    ├── componentes.js    Primitivas y gráficos
    └── vistas/           11 vistas
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

## Documentación

- **[CIENCIA.md](CIENCIA.md)** — metodología completa, factores, fuentes y limitaciones asumidas.
- **[IDEAS.md](IDEAS.md)** — hoja de ruta y propuestas de evolución (v2, v3, modelos de sostenibilidad económica).

---

## Privacidad

Los datos viven exclusivamente en `localStorage`. No hay peticiones de red salvo la hoja de fuentes tipográficas, no hay cookies de terceros ni identificadores publicitarios, y la aplicación funciona entera sin conexión. Puedes exportar todo tu historial en JSON o CSV y borrarlo cuando quieras.

## Licencia

MIT.
