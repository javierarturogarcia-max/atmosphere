# Hoja de ruta e ideas

Lo construido es una base sólida y funcional. Esto es lo que la convertiría en un producto con impacto real a escala, ordenado por relación impacto/esfuerzo.

---

## Nivel 1 — Alto impacto, esfuerzo moderado

### 1.1 Verificación automática en lugar de honor system

El talón de Aquiles de todo sistema de puntos es el autorreporte. Cuatro vías, de menor a mayor fricción:

| Vía | Qué verifica | Coste técnico |
|---|---|---|
| **Geolocalización + acelerómetro** | Trayectos en bici, a pie o en transporte, con detección de modo | Medio: API `Geolocation` + heurística de velocidad/cadencia |
| **Google Fit / Apple Health / Strava** | Distancia y modo ya validados por el dispositivo | Bajo: OAuth y lectura |
| **OCR de facturas** | kWh, m³ de gas, litros de agua reales del recibo | Medio: Tesseract.js en el propio dispositivo |
| **Foto con metadatos EXIF** | Compostaje, plantaciones, limpiezas (hora y lugar) | Bajo |

Recomendación: empezar por la integración con salud/fitness, que da la mayor cobertura por el menor esfuerzo, y usar el índice de confianza ya implementado para separar **ranking abierto** de **ranking verificado**.

### 1.2 Lectura de calidad del aire en tiempo real

La vista de aire ya calcula el AQI correctamente; solo le falta la fuente de datos. **OpenAQ** (gratuita, global) y el **Copernicus Atmosphere Monitoring Service** dan lecturas por coordenadas. Con eso:

- Alerta automática cuando el PM2,5 de tu zona supera la guía de la OMS.
- Misiones contextuales: *"Hoy el AQI está en 130. Deja el coche en casa: doble puntuación en movilidad."* Vincular el juego a una condición real del entorno es lo que separa una app de hábitos de una herramienta de salud pública.
- Serie histórica local y correlación entre tus acciones y el aire de tu barrio.

### 1.3 Grupos y competición por equipos

La evidencia conductual es contundente: las **normas sociales descriptivas** ("el 72 % de tu edificio ya recicla") superan a cualquier incentivo individual. Implementar:

- Equipos por centro educativo, empresa, barrio o edificio.
- Retos cooperativos con objetivo agregado ("entre todos, 1 tonelada este mes").
- Ranking por *ritmo* (puntos/día activo), no por acumulado: así quien entra hoy puede competir con quien lleva un año.
- El módulo `ranking.js` ya está preparado: solo hay que sustituir `cohorteSimulada` por datos reales.

### 1.4 Recordatorios inteligentes basados en tu propio patrón

La app ya calcula tu perfil circadiano y semanal. Con eso puede avisar **cuando tú sueles actuar**, no a una hora arbitraria, y detectar el valle de fin de semana donde se rompen las rachas. Notificaciones push vía service worker: la infraestructura PWA ya está.

---

## Nivel 2 — Diferenciales de producto

### 2.1 Predicción de abandono y rescate proactivo

Con la serie temporal de cada usuario se puede entrenar un modelo simple (regresión logística sobre días desde el último registro, tendencia de la racha, caída del ritmo respecto a su propia mediana) que detecte el riesgo de abandono **antes** de que ocurra, y dispare una intervención suave: una misión fácil, un recordatorio de lo ya conseguido, una congelación regalada.

En apps de hábito esta única función suele mover la retención a 30 días más que cualquier rediseño visual.

### 2.2 Gemelo digital del hogar

Convertir la calculadora de huella en un modelo vivo:

- Serie mensual de facturas → detección automática de anomalías de consumo (la z robusta ya está implementada).
- Simulador: *"¿qué pasa si cambio la caldera / pongo placas / me mudo?"* con periodo de amortización económico **y** climático.
- Alerta de fuga: un salto sostenido en el consumo de agua sin cambio de hábitos.

### 2.3 Mercado de impacto verificado

Las recompensas de la familia "impacto real" necesitan una contraparte que las financie. Modelo de tres bandas:

1. **Empresas** compran packs de retos para su plantilla (objetivo ESG real y medible, no un informe de intenciones).
2. **Ayuntamientos** financian bonos de transporte y talleres de reparación como política de movilidad y residuos.
3. **Usuarios** canjean puntos por esas recompensas.

Requisito ético innegociable: nada de lo canjeable debe incentivar consumo nuevo. El catálogo actual ya cumple esa regla.

### 2.4 Ciencia ciudadana con dato aprovechable

Integrar **iNaturalist** (biodiversidad), **GLOBE** (observaciones ambientales) o **Sensor.Community** (sensores caseros de PM). Las observaciones de los usuarios acabarían en conjuntos de datos usados en publicaciones revisadas por pares. Es la recompensa más barata y la más motivadora para el perfil que ya se preocupa: *tu dato sirve para algo*.

---

## Nivel 3 — Escala e infraestructura

### 3.1 Backend con privacidad diferencial

Cuando haya cuentas, no replicar el modelo extractivo:

- Solo se sincronizan agregados y hashes, no el detalle de conducta.
- Ruido calibrado (ε ≈ 1) en las estadísticas agregadas que se publiquen.
- Exportación e importación completas ya implementadas: la portabilidad debe ser un derecho, no una función escondida.

### 3.2 API pública de factores

La base de `src/data/factores.js` —factores con fuente, año e incertidumbre declarada— tiene valor por sí sola. Publicarla como API abierta y versionada la convierte en infraestructura para otros proyectos, y atrae revisión externa que mejora su calidad.

### 3.3 Internacionalización y equidad

- Traducción a inglés, portugués y lenguas locales.
- **Factores regionalizados**: el mix eléctrico ya lo está, pero la dieta, los residuos y el transporte varían enormemente entre países.
- Cuidado con el sesgo del Norte global: una app que premia "comprar de segunda mano" o "cambiar a coche eléctrico" no significa lo mismo en San Salvador que en Oslo. La versión regional debería reordenar el catálogo según qué palancas son realmente accesibles.

### 3.4 Modo educativo

Panel de docente con grupos, retos de aula, seguimiento por estudiante y exportación de informes. La vista de Ciencia y el documento de metodología ya son material didáctico: falta el envoltorio de gestión. Es, probablemente, el canal de adopción más rápido y el de mayor efecto multiplicador a largo plazo.

---

## Ideas de mecánica de juego

- **Árbol vivo**: una visualización que crece con tu impacto acumulado y se marchita visiblemente si abandonas. La pérdida percibida motiva más que la ganancia equivalente.
- **Duelos 1v1** por ritmo semanal (`duelo()` ya existe en `ranking.js`).
- **Eventos estacionales**: Día de la Tierra, Semana de la Movilidad, Hora del Planeta con multiplicadores temporales (el `factorEvento` ya está en el motor).
- **Cofres de temporada** con recompensas deterministas por semilla: emoción sin azar manipulable.
- **Modo historia**: capítulos narrativos sobre un ecosistema concreto que se desbloquean por impacto acumulado.
- **Impacto colectivo visible**: un contador global de toneladas evitadas por toda la comunidad. La sensación de formar parte de algo que funciona es el mayor antídoto contra la ecoansiedad paralizante.

---

## Lo que deliberadamente NO se debería hacer

- **Rachas que castiguen duro.** La culpa desmoviliza. Las congelaciones existen por eso.
- **Compensación como atajo.** Si comprar créditos de carbono sube el nivel igual que reducir, el sistema premia lo contrario de lo que dice defender.
- **Vender datos de conducta ambiental.** Es la información más íntima que existe sobre los hábitos de una persona.
- **Notificaciones diarias sin contenido.** Cada aviso irrelevante acerca la desinstalación.
- **Prometer precisión que no se tiene.** El intervalo de confianza no es una debilidad: es lo que hace creíble el resto.
