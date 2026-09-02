# Metodología científica

Este documento explica de dónde sale cada número de Atmosphere y, sobre todo, qué **no** puede afirmar. Una aplicación de sostenibilidad sin este documento es una lista de buenas intenciones con animaciones.

---

## 1. Principio: impacto antes que puntos

El error estructural de la mayoría de apps del sector es diseñar primero la mecánica de juego y después inventar una equivalencia ambiental que la justifique. Aquí el orden es el inverso:

```
cantidad registrada → impacto físico (kg CO₂e, L, kg) → puntos
```

El impacto se calcula en `src/core/impacto.js` y no conoce la existencia del sistema de puntos. Si mañana se sustituye toda la capa de juego, las cifras ambientales siguen siendo válidas.

---

## 2. La línea base es obligatoria

**No existe impacto evitado sin un contrafactual explícito.** Ir en bicicleta solo evita emisiones si sustituye un trayecto que se habría hecho en coche. Si ese trayecto no iba a existir, el ahorro real es cero.

Por eso toda acción del catálogo declara un campo `base` visible en la interfaz. Ejemplos:

| Acción | Línea base declarada |
|---|---|
| Ir en bicicleta | Sustituye un trayecto en coche de gasolina (0,171 kg CO₂e/km) |
| Usar transporte público | Coche gasolina (0,171) − metro/bus medio (0,033–0,102) |
| Reciclar aluminio | Reciclado frente a producción primaria (−95 % de energía) |
| Compostar | Evita el metano anaerobio de vertedero (GWP-100 de 27) |
| Cambiar vuelo por tren | Avión corto con RFI 1,9 (0,467) frente a alta velocidad (0,041) |

---

## 3. Fuentes de los factores

| Ámbito | Fuente | Año |
|---|---|---|
| Potenciales de calentamiento (GWP-100) | IPCC AR6 WG1, cap. 7 | 2021 |
| Movilidad terrestre y aérea | UK DEFRA/BEIS GHG Conversion Factors; EEA TERM; US EPA | 2023 |
| Forzamiento no-CO₂ de la aviación | Lee et al., *Atmospheric Environment* | 2021 |
| Alimentos (CO₂e por kg) | Poore & Nemecek, *Science* 360:987 (38.700 granjas, 119 países) | 2018 |
| Dietas (CO₂e por día) | Scarborough et al., *Nature Food* 4:565 (EPIC-Oxford, n=55.504) | 2023 |
| Huella hídrica | Mekonnen & Hoekstra | 2011 |
| Residuos y reciclaje | US EPA WARM v15; Eunomia | 2021–2023 |
| Mix eléctrico por país | Ember Electricity Data Explorer; IEA Emissions Factors | 2023–2024 |
| Factores de gasto (EEIO) | EXIOBASE v3.8 | — |
| Secuestro por arbolado | US EPA GHG Equivalencies Calculator | 2024 |
| AQI | US EPA, revisión de PM2,5 | 2024 |
| Guías de calidad del aire | OMS Air Quality Guidelines | 2021 |
| Riesgo por PM2,5 | GBD / Pope et al.; AQLI (U. de Chicago) | 2002–2024 |
| Límites planetarios | Richardson et al., *Science Advances* | 2023 |

---

## 4. Tratamiento de la incertidumbre

Un análisis de ciclo de vida tiene una incertidumbre típica del **20–50 %**. Publicar "has evitado 168,93 kg" sin más es engañoso.

Cada factor lleva su incertidumbre relativa (`inc`) y la agregación aplica la ley de propagación de errores para términos independientes:

```
σ_total = √( Σ (valor_i · inc_i)² )
IC 95 % = valor ± 1,96 σ
```

Consecuencia interesante: **la incertidumbre relativa disminuye al agregar**. Dos registros de 100 kg con un 30 % de incertidumbre cada uno no dan 200 ± 60, sino 200 ± 42,4 (21 %). Es la misma razón por la que las medias de muchas mediciones son más fiables que una sola.

---

## 5. Estadística: por qué estimadores robustos

Las series de conducta humana tienen valores atípicos (el día que plantaste 20 árboles) y no son normales. Usar mínimos cuadrados sobre ellas produce disparates.

| Herramienta | Para qué | Por qué esa y no otra |
|---|---|---|
| **Theil-Sen** | Pendiente de tendencia | Punto de ruptura del 29 %: aguanta atípicos que descolocan a OLS |
| **Mann-Kendall** | ¿Hay tendencia real? | No asume normalidad; estándar en series ambientales. Con corrección por empates |
| **z robusta (MAD)** | Detectar registros fraudulentos | Un solo valor absurdo infla la σ clásica y se oculta a sí mismo |
| **Bootstrap percentil** | Intervalos de confianza | No asume distribución alguna |
| **Shannon / Pielou** | Diversidad de la conducta | Un perfil que solo recicla no cambia su huella; la diversidad sí |
| **Gini** | Concentración del esfuerzo | Detecta el perfil de una sola palanca |

Un detalle que salió al probar: cuando el historial es perfectamente constante (habito muy regular), la MAD vale cero y la z robusta cegaría al detector. Se degrada entonces a la desviación absoluta media escalada por 1,253314, según Iglewicz & Hoaglin (1993).

**Las proyecciones se declaran no fiables** cuando la serie tiene menos de 7 puntos o menos de 5 días activos, y se calculan siempre con el estimador robusto, no con OLS.

---

## 6. Antifraude

Cuatro capas, de la más barata a la más cara:

1. **Topes físicos** por acción y día (`maxDiario`). No se puede recorrer 500 km en bici en un día.
2. **Tiempos de espera** entre registros idénticos (`cooldownMin`).
3. **Anomalía estadística** frente al historial propio: |z robusta| > 3,5 marca el registro para revisión.
4. **Coherencia temporal**: la suma de minutos declarados en un día no puede superar 1.440. Es la capa que atrapa el fraude compuesto, donde ninguna acción individual es sospechosa pero el conjunto es imposible.

El **índice de confianza** del perfil (0–1) pondera evidencia aportada (35 %), ausencia de sospechas (30 %), diversidad (20 %) y constancia (15 %).

---

## 7. La calculadora de huella

Método híbrido:

- **Factores de proceso (ACV)** para electricidad, combustibles, movilidad y dieta: preciso donde hay datos físicos.
- **Factores input-output (EEIO)** para bienes y servicios: es la única manera de cerrar el hueco de las emisiones incorporadas en lo que compramos.

Detalles que cambian el resultado y casi ninguna calculadora aplica:

- **El mix eléctrico del país.** Ahorrar 1 kWh en Polonia (662 g CO₂e/kWh) evita 23 veces más que en Noruega (29 g).
- **El forzamiento no-CO₂ de la aviación** (RFI ≈ 1,9): estelas de condensación, NOx y cirros inducidos casi duplican el impacto de un vuelo frente a su CO₂ puro.
- **El reparto del hogar** entre convivientes: la electricidad de una casa de cuatro no es la huella de cada uno.
- **Emisiones públicas per cápita** (1,1 t): infraestructura, sanidad y educación. No son reducibles individualmente, pero omitirlas falsea el total a la baja.

---

## 8. Calidad del aire

El AQI se calcula por interpolación lineal por tramos:

```
AQI = (I_alto − I_bajo)/(C_alto − C_bajo) · (C − C_bajo) + I_bajo
```

El índice global es el **máximo** de los subíndices, no su media: así lo define la EPA para no diluir un pico peligroso de un contaminante en el promedio de los demás.

El riesgo sanitario usa el modelo log-lineal del Global Burden of Disease:

```
RR = exp(β · max(0, C − C₀))     con β = 0,0059 por µg/m³ y C₀ = 5 µg/m³
```

Equivale a un +6 % de mortalidad por cada 10 µg/m³, coherente con Pope et al. (2002). Los años de vida perdidos siguen la relación del AQLI: 0,098 años por µg/m³ sobre el contrafactual.

---


## 8bis. Datos reales de calidad del aire

### Por qué Open-Meteo y no OpenAQ

La elección obvia era OpenAQ, pero no sirve para este proyecto por dos razones
verificadas, no supuestas:

1. **Exige clave de API.** En un sitio estático la clave viaja al navegador y es
   pública de todas formas, así que no protege nada y sí añade fricción.
2. **No admite CORS.** El navegador no puede llamarla directamente; haría falta
   un servidor intermediario, lo que rompe la arquitectura sin backend.

Open-Meteo no pide clave, admite CORS y sirve los modelos **CAMS** (Copernicus,
europeo) y **GEOS-CF** (NASA), con cobertura mundial por coordenadas en vez de
solo donde hay estación oficial.

### El AQI se calcula aquí, no se copia

Open-Meteo publica su propio `us_aqi`, pero **no se usa como valor final**. Se
toman las concentraciones crudas y se pasan por el motor de `aire.js`,
contrastado contra los tramos publicados por la EPA. La API es una fuente de
datos; la ciencia sigue siendo propia y auditable. Su `us_aqi` se conserva solo
para poder contrastar ambos cálculos: en la verificación con datos de San
Salvador, el índice propio dio **117** frente al **116** de la fuente. Esa
coincidencia independiente es la mejor prueba de que la implementación es
correcta.

### La conversión de unidades que casi nadie hace

Este es el error silencioso más común al integrar datos de calidad del aire:

> Los tramos del AQI de la EPA están definidos en **ppb** para O₃, NO₂ y SO₂, y
> en **ppm** para CO. Pero casi todas las fuentes —Open-Meteo, CAMS, la mayoría
> de sensores— publican en **µg/m³**.

Aplicar los tramos directamente sobre µg/m³ da un número plausible y
completamente equivocado. La conversión usa el volumen molar del gas ideal a
25 °C y 1013,25 hPa:

```
ppb = µg/m³ × 24,45 / masa molar
```

El efecto está medido en las pruebas del proyecto. Con las mismas lecturas
(PM2,5 12; PM10 30; O₃ 100; NO₂ 40; SO₂ 10; CO 500 µg/m³):

| | AQI | Dominante | Categoría |
|---|---|---|---|
| Sin convertir | **500** | CO | Peligrosa (emergencia sanitaria) |
| Convertido | **56** | PM2,5 | Moderada |

El mismo aire. Sin la conversión, el CO de 500 µg/m³ se lee como 500 ppm, que
es una concentración letal.

### El multiplicador por aire

Cuando la calidad del aire está mal, las acciones de movilidad y energía
puntúan más (×1,25 a ×2 según el tramo del AQI), durante 3 horas desde la
lectura. No es un truco de juego: las emisiones evitadas durante un episodio de
contaminación tienen un efecto sanitario **inmediato** sobre quienes están
respirando ese aire, no solo un efecto climático difuso a décadas vista.

Solo se aplica a movilidad y energía. Reciclar no limpia el aire de hoy, y
fingir que sí sería exactamente el tipo de equivalencia falsa que este documento
existe para evitar.

## 8ter. Verificación con el dispositivo

### Por qué no Google Fit ni Apple Health

Ninguna de las dos es alcanzable desde una web estática, y conviene dejarlo por
escrito porque es la petición más frecuente:

| Plataforma | Estado |
|---|---|
| **Google Fit** | Cerró el registro de nuevas aplicaciones en mayo de 2024 y sus APIs se apagan a lo largo de 2026 |
| **Health Connect** | Su sustituto, pero es nativo de Android: no tiene interfaz web |
| **Apple HealthKit** | Nativo de iOS. Nunca ha tenido API web |
| **Fitbit / Strava** | Sí tienen API web, pero exigen intercambiar un secreto de cliente en servidor: imposible sin backend |

Construir sobre Google Fit hoy sería construir sobre algo que se apaga en meses.

### Lo que sí funciona

Dos fuentes, ambas sin cuentas ni servidores, y ambas producen distancia
**medida por el dispositivo** en lugar de declarada por la persona:

1. **GPS en vivo** con la Geolocation API del navegador.
2. **Importación de trazas GPX/TCX**, que exporta prácticamente cualquier
   aplicación deportiva, incluidas las que no ofrecen API. El archivo se
   analiza en el navegador y no se envía a ningún sitio.

### Cómo se valida una traza

- Se descartan los puntos con incertidumbre horizontal superior a 60 m.
- Se descartan los tramos que implican más de 200 km/h: son saltos del sensor,
  y promediarlos contaminaría a la vez la distancia y la velocidad.
- Se ignora la deriva por debajo de 0,5 km/h: estar parado no es un trayecto.
- La distancia se acumula con la fórmula del haversine sobre la esfera media
  WGS-84 (R = 6.371.008,8 m).

### Inferencia del modo de transporte

Se compara la **mediana** de las velocidades por tramo —no la media, que un
semáforo o un pico de GPS distorsionan— contra un perfil por modo. Cuando los
rangos se solapan, gana el modo cuya velocidad **típica** está más cerca, no el
centro del rango: a 15 km/h ambos rangos encajan, pero eso es una bicicleta
tranquila y una carrera de nivel casi profesional. Ese detalle salió de una
prueba que fallaba, y corregirlo cambió el diagnóstico de «corriendo» a «en
bicicleta».

Cuando varios modos siguen encajando, se declara la ambigüedad con una
confianza menor en vez de fingir certeza.

Por último, se contrasta la traza contra lo que la persona quiere registrar: si
el GPS mide 5 km y se declaran 40, o si el perfil de velocidad dice «vehículo»
y la acción elegida es «bicicleta», la verificación se rechaza. Se tolera un
15 % de diferencia, porque el GPS tiene error propio y las trazas urbanas se
acortan bajo túneles y edificios altos.


## 8quater. Puntos extra por prueba gráfica

Adjuntar una foto no verifica nada por sí solo: cualquiera descarga una imagen.
Lo que merece puntos extra es lo **comprobable** de esa foto, y en el navegador
se puede comprobar bastante sin enviar nada a ningún servidor.

### Qué se comprueba

| Señal | Cómo | Qué demuestra |
|---|---|---|
| **Fecha de captura** | EXIF `DateTimeOriginal`, con la fecha del archivo como respaldo | Que la prueba es de hoy y no de hace dos años |
| **Coordenadas** | EXIF GPS (grados, minutos, segundos + referencia N/S/E/W) | Que la foto se tomó donde dices estar (tolerancia de 50 km) |
| **Originalidad** | Hash perceptual de 64 bits sobre una miniatura de 8×8 en gris | Que no es una foto ya usada en otro registro |
| **Resolución** | Dimensiones del original | Una imagen de 320×240 suele ser una miniatura descargada |

### Por qué un hash perceptual y no uno criptográfico

Un SHA-256 cambia por completo si se recomprime la imagen o se le quita un
píxel, así que sería trivial de burlar: basta reenviar la foto por WhatsApp para
obtener un hash distinto. El **aHash** compara la estructura visual —qué píxeles
superan el brillo medio en una rejilla de 8×8— y sobrevive al reescalado, al
cambio de calidad y a variaciones de brillo. Dos imágenes se consideran la misma
si difieren en **5 bits o menos de 64** (distancia de Hamming).

En la verificación end-to-end, reenviar la misma foto dio una distancia de
**0 bits** y la evidencia pasó de ×1,4 a ×1 con el motivo explícito en pantalla.

### El multiplicador

Se aplica sobre los puntos ya calculados, junto al resto de factores, y es
**visible en la fórmula** antes de registrar. Un vídeo puntúa más que cualquier
foto porque es mucho más costoso de falsificar: muestra la acción ocurriendo,
no un instante que pudo capturarse en cualquier parte.

Una imagen duplicada nunca penaliza por debajo de ×1. Restar puntos por
sospecha castigaría a quien se equivoca de archivo igual que a quien hace
trampa; basta con no premiar.

### Dónde se guardan las pruebas

En **IndexedDB**, no en localStorage, y como miniatura de 1.024 px al 72 % de
calidad, no como original. Una foto de móvil pesa entre 3 y 8 MB y localStorage
admite unos 5 MB **en total**: guardar originales reventaría la aplicación al
tercer registro. La miniatura ronda los 120 kB y sigue siendo prueba visual
válida. Los metadatos EXIF se leen del archivo original **antes** de reescalar,
porque el canvas los descarta al redibujar.


## 8quinquies. Sincronización: por qué el cliente no puede escribir su puntuación

La sincronización con Postgres es **opcional y está desactivada por defecto**.
La app sigue funcionando entera sin cuenta; la nube solo añade lo que en local
es imposible: comparar con personas reales y conservar el historial al cambiar
de dispositivo.

### El error que arruina el 90 % de los rankings

Si la aplicación envía *«tengo 50.000 puntos»*, cualquiera con la consola del
navegador abierta envía lo mismo, y la tabla deja de significar nada. El diseño
aquí lo impide por construcción, en tres capas:

1. **El cliente solo inserta registros individuales**, nunca totales. Los
   registros son inmutables: no hay políticas de `UPDATE` ni `DELETE`.
2. **Un disparador del servidor recalcula** puntos, XP, nivel y totales a
   partir de esos registros, con la misma curva de nivel que el cliente.
3. **Permisos por columna.** Aunque la política de seguridad por fila permita
   actualizar el perfil propio, `GRANT UPDATE (nombre, pais, publico)` deja
   fuera físicamente las columnas de puntuación. No es una comprobación que se
   pueda saltar: es un permiso que no existe.

Además, el tope diario de 2.500 puntos se replica en el servidor, porque la
validación del cliente se evita llamando a la API directamente.

### Qué viaja y qué no

Verificado en la prueba de integración inspeccionando el cuerpo HTTP real:

| Se envía | No se envía |
|---|---|
| Acción, categoría, cantidad, unidad | Fotos y vídeos de prueba |
| Impacto (CO₂e, agua, residuo) | Notas personales (pueden citar a terceros) |
| Puntos y fecha | Coordenadas y trazas GPS |
| Nivel de evidencia (para auditar) | El hash perceptual de las imágenes |

Los registros son **privados en el servidor**: ni siquiera los compañeros de
grupo ven tu detalle. Al ranking solo llegan los agregados del perfil, y
únicamente si marcas el perfil como público.

### Por qué sin la biblioteca oficial

Se habla directamente con la API REST (PostgREST y GoTrue) mediante `fetch`.
Son cuatro llamadas HTTP: `@supabase/supabase-js` pesaría más que todo el
módulo, rompería el empaquetador de archivo único y añadiría la primera
dependencia de producción del proyecto.

La subida es **idempotente**: la clave primaria de `registros` es el id
generado en el dispositivo, así que reenviar un lote tras un corte de red no
duplica nada.

## 8quinquies-bis. Qué se puede validar de verdad, y qué no

La pregunta natural de cualquiera que use esto es: *¿se puede comprobar que la
acción es real?* La respuesta honesta tiene dos mitades muy distintas, y
mezclarlas es el error que comete casi todo el sector.

| Acción declarada | ¿Lo ve un sensor? | Qué se puede afirmar |
|---|---|---|
| Correr, caminar | **Sí** | Cadencia de pasos del acelerómetro + velocidad del GPS |
| Ir en bici | **Sí** | Perfil de velocidad del GPS |
| Plantar un árbol | **A medias** | El cuándo y el dónde, no el qué |
| Reciclar plástico | **No** | Distinguir plástico de vidrio exige un modelo de visión |
| Beber agua del grifo | **No** | Ningún sensor del teléfono lo ve |

Por eso la verificación se separa en **dos ejes independientes**, y ninguno
pretende ser el otro.

### Eje 1 — Autenticidad de la prueba (aplica a todo)

La pregunta aquí no es *qué* hiciste, sino *si este archivo se produjo aquí y
ahora*. Todo el aparato de EXIF, hash perceptual y coherencia GPS existe porque
un archivo elegido con un selector puede venir de la galería, de un grupo de
mensajería o de una búsqueda de imágenes.

Grabar dentro de la aplicación cambia la naturaleza del problema en vez de
afinar la heurística: **no hay archivo previo que elegir**. La cámara se abre
con `getUserMedia`, el clip lo produce `MediaRecorder`, y lo que se guarda es
esa captura. No es una pista sobre el origen del archivo; es el origen.

Por eso `envivo` (×1,60) está por encima de `video` (×1,45): el vídeo adjuntado
sigue siendo un archivo del que solo sabemos lo que sus metadatos dicen, y los
metadatos se editan con herramientas comunes.

Tiene además una ventaja práctica que no es menor: el atributo `capture` de un
`<input file>` abre la cámara en muchos móviles, pero no en todos, y en el
escritorio no hace nada. `getUserMedia` la abre siempre.

### Eje 2 — Coherencia con la acción (solo donde hay sensor)

Mientras se graba, se muestrea el acelerómetro. El módulo de la aceleración
menos su media —que en una ventana de segundos es esencialmente la gravedad—
deja la oscilación de los pasos. Contando picos con un periodo refractario de
250 ms sale la cadencia.

```
cadencia (pasos/min)   régimen
      < 40             quieto
     80 – 135          caminando
    135 – 145          zona ambigua: no se decide
    145 – 220          corriendo
```

La franja de 135 a 145 no es una imprecisión que haya que pulir: la marcha
rápida y el trote lento **se parecen de verdad**, y ahí el sistema dice
*«entre marcha rápida y trote»* en lugar de escoger. Es la misma disciplina que
rige la proyección de emisiones, que se marca como no fiable cuando la serie no
la sostiene.

**Manda la cadencia, no la intensidad.** La cadencia tiene significado
fisiológico y está acotada entre personas; la intensidad depende de si llevas el
teléfono en la mano, en el bolsillo o en un brazalete. Usarla como filtro dejaba
sin clasificar a quien corre con el móvil bien sujeto, así que solo modula la
confianza.

### La regla que evita el sistema punitivo

El contraste entre lo declarado y lo medido **confirma, nunca descalifica**.
Alguien puede reciclar de pie y quieto, grabar con el teléfono apoyado, o tener
el sensor bloqueado por el navegador. Un sistema que castigue esos casos
castiga a quien no hizo nada malo, que es peor error que dejar pasar una trampa.

La regularidad del paso —el coeficiente de variación de los intervalos,
invertido— alimenta la confianza, no el veredicto. Agitar el teléfono puede
imitar una cadencia; imitar además un ritmo humano sostenido es bastante más
trabajo que hacer la acción.

### Y lo que no se puede validar

Para reciclar, beber agua o comer verduras no hay sensor, y no lo habrá en un
teléfono. Podría entrenarse un clasificador de imágenes, pero acertaría a medias
y añadiría megabytes de modelo a una aplicación que presume de no tener
dependencias — y un clasificador que se equivoca acusando es peor que no tener
ninguno.

Ahí la verificación es de otra clase, y es la razón de que la capa social exista:
**lo ve la comunidad**. Un vídeo de ocho segundos separando plástico, grabado en
vivo, visto por la clase entera, tiene una forma de validación que ningún
acelerómetro da. No es criptográfica, es social, y para este problema es la
adecuada.


## 8sexies. La capa social: por qué el aura no son puntos

La comunidad es la parte del proyecto donde la gamificación puede estropear la
ciencia. Si los me gusta dieran puntos, el sistema empezaría a premiar
producción de vídeo en lugar de reducción de emisiones, y en pocas semanas
tendría un catálogo de acciones ordenado por fotogenia. Eso es exactamente lo
que se quiso evitar desde la primera línea del motor de impacto.

La solución es que hay **dos monedas y no se cambian entre sí**:

| | Puntos | Aura |
|---|---|---|
| Qué mide | Impacto físico evitado | Reconocimiento de la comunidad |
| De dónde sale | kg CO₂e, litros, kg de residuo | Publicar y recibir me gusta |
| Quién la calcula | Disparador del servidor sobre `registros` | Función del servidor sobre `publicaciones` |
| Afecta a | Nivel, ligas, misiones, recompensas | Solo al perfil público y al ranking de aura |
| Se puede convertir | — | **No** |

Un vídeo gracioso puede acumular mucha aura y **cero** puntos, porque los
puntos ya se concedieron —o no— cuando se registró la acción, con sus factores
y su línea base. Publicar no vuelve a puntuar. La aura vive en otra columna, en
otra tabla y en otro ranking.

### El reparto de aura

```
aura = Σ  ( 8  por publicación
          + 2  × me gusta recibidos
          + 5  si la prueba era fechada, situada o vídeo )
```

Es una **suma sobre las publicaciones visibles**, no un contador incremental.
Esa diferencia importa: un contador que solo sube no puede deshacer nada, así
que un me gusta retirado o una publicación oculta por reportes dejarían aura
fantasma. Al derivarla de cero cada vez, la aura siempre refleja el estado
actual del muro. Es el mismo principio que rige los puntos: el servidor no
guarda lo que le mandan, recalcula lo que se deduce de los hechos.

Las cinco reacciones —me gusta, me encanta, corazón, bien hecho, me inspira—
**valen exactamente lo mismo en aura**, y no es un descuido. Si el corazón
puntuara más que el me gusta, la gente elegiría por lo que suma y no por lo que
siente, y el dato dejaría de decir nada sobre la publicación. Lo que cambia es
el matiz que se expresa, no el precio. Una persona reacciona una sola vez a cada
publicación —lo garantiza la clave primaria— y puede cambiar de matiz sin que el
recuento se mueva.

El `+5` por prueba verificada es deliberado: hace que la publicación más
rentable en aura sea, precisamente, la que trae metadatos coherentes. La
credibilidad y la popularidad apuntan en la misma dirección en lugar de
competir.

### Los tres candados están en la base de datos, no en el navegador

Cualquiera puede abrir la consola del navegador y llamar a la API directamente,
así que una comprobación en JavaScript no es una comprobación. Las tres reglas
que sostienen la capa social son políticas de PostgreSQL:

1. **Nadie se da me gusta a sí mismo.** La política de `insert` sobre `megusta`
   exige `not exists (select 1 from publicaciones p where p.id = publicacion_id
   and p.perfil_id = auth.uid())`.
2. **Nadie publica el registro de otra persona.** La política comprueba que el
   `registro_id` pertenezca a quien publica.
3. **Nadie escribe su propia aura ni su propio recuento de me gusta.** No es
   una validación: es un `GRANT UPDATE (nombre, pais, publico, mote)` que
   sencillamente no incluye esas columnas. Un permiso que no existe no se puede
   sortear.

El doble me gusta lo impide la clave primaria compuesta `(publicacion_id,
perfil_id)`, no un `if`.

### La puerta: por que la clave publica viaja en el codigo

Durante un tiempo, crear una cuenta exigia pegar la URL del proyecto y su clave
antes de poder registrarse. Eso funciona para quien construyo la aplicacion y
para nadie mas: a la persona a la que le pasas el enlace le aparece un
formulario de configuracion donde esperaba un boton de *crear cuenta*, y ahi se
acaba la comunidad.

La solucion es incomoda de leer la primera vez: **la clave publica del proyecto
va escrita en el codigo fuente**. Conviene explicar por que no es una fuga.

Supabase la llama *publishable* precisamente porque esta pensada para vivir en
el navegador. En cualquier aplicacion que use Supabase —las suyas propias
incluidas— basta abrir las herramientas de desarrollo para verla: no hay forma
de esconder una clave que el navegador tiene que enviar en cada peticion. Lo
que protege los datos no es esa clave, sino las politicas RLS, que es donde
esta puesto todo el esfuerzo de este esquema. La clave secreta es otra cosa
completamente distinta —salta todas las politicas— y por eso `esClaveSecreta()`
la rechaza si alguien la pega por error.

El coste real es otro y conviene decirlo: cualquiera que encuentre el
repositorio puede crearse una cuenta en el proyecto. Para un trabajo de clase
eso es lo que se busca. Para algo abierto al publico, la contencion no seria
esconder la clave sino limitar el alta —confirmacion por correo, dominio
restringido a un centro educativo, o un limite de altas por hora—, que es donde
esas defensas funcionan de verdad.

### El permiso que se concede solo

Hay un detalle de Supabase que convierte en falso todo lo anterior si no se
conoce. Cada proyecto trae puesta esta línea:

```sql
alter default privileges in schema public grant all on tables to anon, authenticated;
```

Es decir: **toda tabla o vista que se cree en `public` nace con todos los
permisos concedidos**, `UPDATE` incluido. Y un `grant` es aditivo: escribir
`grant select, insert, delete` no quita el `update` que ya estaba. Hay que
revocar primero.

Este proyecto no lo hacía, y la consecuencia fue exactamente la que cabía
esperar: `authenticated` conservaba permiso de `UPDATE` sobre `likes_n`, sobre
`oculto`, y sobre las catorce columnas de `registros` —la tabla que se
describe a sí misma como *append-only*—.

No llegó a ser explotable, y eso también merece decirse con precisión: la RLS
no tiene ninguna política de `UPDATE` sobre esas tablas, y en PostgreSQL un
comando sin política no afecta a ninguna fila. Se comprobó intentándolo. Pero
la defensa que quedaba era una sola, y el día en que alguien añada una política
de `UPDATE` por un motivo razonable —permitir editar la descripción de una
publicación, pongamos— el permiso olvidado se convierte en el agujero, sin que
nada avise.

Ahora los dos guiones revocan antes de conceder, y `db/verificar.sql` vigila el
esquema **entero**, no una tabla concreta: cualquier `UPDATE` que aparezca
fuera de las cuatro columnas inocuas del perfil sale en `MAL`, incluso en una
tabla que se añada en el futuro.

La lección de método es la que más vale: el simulacro de pruebas modelaba que
las tablas de Supabase *existían*, pero no los privilegios por defecto ni de
quién eran. Un simulacro que se parece al original en lo que miras y no en lo
que olvidas mirar da luz verde a los fallos que más importan.

### El espacio personal y el compartir automático

La petición natural —*«que se guarden todas mis acciones y otros puedan
verlas»*— choca de frente con una promesa que este proyecto lleva escrita desde
el principio: **los registros son privados y publicar es una decisión por
acción**. Resolverlo cambiando el comportamiento por defecto habría sido
traicionar esa promesa para todos los demás.

La solución es un interruptor, **apagado de fábrica**, en Perfil. Quien lo
enciende publica automáticamente cada acción que registre; quien no lo toca
sigue exactamente como antes. Y apagarlo no borra lo ya compartido —eso sería
sorprender en la otra dirección— pero cada publicación se puede borrar una a
una.

Para que eso funcione hubo que quitar un requisito que parecía inofensivo: la
publicación **exigía foto o vídeo**. Casi todo lo que se registra no tiene
cámara detrás —beber agua del grifo, ir en bus, apagar el aire—, así que el
espacio de cada persona salía medio vacío no por falta de acciones sino por
falta de cámara.

Eso obligó a retocar el aura. Si una línea de texto valiera lo mismo que un
vídeo, activar el compartir automático llenaría el aura de registros y dejaría
de medir lo que dice medir. Ahora publicar sin medio vale **3** y con medio
**8**, más el `+5` de evidencia verificada. La escala sigue apuntando a lo
mismo: contagiar el hábito, no acumular filas.

De paso salió un error de esa lista: `envivo` —el nivel más fuerte, el vídeo
grabado dentro de la app— no estaba entre los que suman el `+5`. Se quedó fuera
al añadirlo, así que la prueba más costosa de falsificar era la única que no
cobraba el extra por serlo.

### Moderación sin moderadores

**Tres reportes de tres personas distintas** ocultan una publicación
automáticamente: desaparece del muro y de los virales, y su aura deja de
contar, porque `recalcular_aura()` solo suma lo que no está oculto. Su autor
sigue viéndola —marcada— para poder borrarla. La regla es simple a propósito:
un umbral fijo y verificable en el esquema es mejor que un criterio
discrecional que nadie puede auditar, y el proyecto no tiene equipo de
moderación 24/7.

Es un compromiso conocido: tres personas coordinadas pueden ocultar una
publicación legítima. Para un aula o un centro educativo —el caso de uso real—
el coste de ese abuso es bajo y reversible; el de no tener moderación ninguna,
no.

### La foto de perfil

Va al mismo cubo y bajo la misma carpeta que las pruebas, así que reutiliza la
política que ya existía: cada quien escribe solo dentro de la carpeta con su
identificador. En la fila del perfil se guarda **la ruta, no la imagen** —meter
la foto en la fila la haría viajar entera en cada consulta del ranking y del
muro, que es justo donde más filas se piden a la vez.

Dos detalles de orden que importan más de lo que parece:

- **Se apunta la nueva antes de borrar la anterior.** Al revés, un corte de red
  entre las dos operaciones dejaría el perfil apuntando a un archivo que ya no
  existe.
- **La copia local se guarda primero**, en IndexedDB. Si la subida falla, la
  foto sigue puesta en el dispositivo y se avisa. Perder la foto por un fallo de
  red sería peor que tenerla solo aquí.

El muro **no copia** la foto en la publicación, aunque sí copia el mote y el
aura. Copiarla haría que al cambiarla las tarjetas viejas siguieran mostrando la
antigua, así que las vistas la leen con un `left join` sobre `perfiles`. El join
es externo a propósito: si el perfil del autor no es público, la RLS lo deja
invisible y un join normal haría desaparecer su publicación del muro entero.

### Los medios

Los vídeos y fotos publicados van a un cubo de Storage llamado `evidencias`,
donde **cada persona solo puede escribir dentro de la carpeta que lleva su
propio identificador** (`${perfil_id}/...`), comprobado por una política sobre
`storage.objects`. Límite de 25 MB por archivo. Lo no publicado sigue donde
estaba: en IndexedDB, en el dispositivo, sin salir nunca.

Las 19 comprobaciones de `tools/probar-social.mjs` ejecutan `db/social.sql`
contra un PostgreSQL real y verifican precisamente los intentos de abuso:
autolike, doble me gusta, escribir aura ajena, inflar `likes_n`, publicar el
registro de otro y subir un archivo a la carpeta de otra persona. Todos deben
fallar; si alguno pasara, la prueba se pone en rojo.


## 9. Limitaciones que asumimos por escrito

1. **Los factores son promedios.** Tu coche, tu red y tu supermercado concretos difieren. Las cifras son órdenes de magnitud correctos, no contabilidad.
2. **El efecto rebote es real.** Quien ahorra en energía a veces gasta ese dinero en algo más intensivo. La reducción neta suele ser menor que la suma de las acciones.
3. **La acción individual es necesaria pero insuficiente.** Alrededor del 70 % de las emisiones depende de decisiones sistémicas de empresas y gobiernos. Por eso el catálogo incluye acciones comunitarias, formativas y de incidencia: son las que tienen efecto multiplicador.
4. **Plantar árboles no compensa emitir hoy.** Un árbol tarda décadas en alcanzar su ritmo de captura y puede liberarlo entero en un incendio. El orden correcto siempre es evitar → reducir → sustituir → y solo al final compensar.
5. **El transporte de los alimentos pesa poco** (~6 % de la huella alimentaria). Lo decisivo es *qué* comes, no de dónde viene. La app lo dice explícitamente en la acción "comprar local" para no propagar un mito cómodo.
6. **La prueba gráfica eleva la credibilidad, no la certeza.** Los metadatos
   EXIF se pueden editar con herramientas comunes, y una foto real de un árbol
   ajeno sigue siendo una foto real. El sistema encarece la trampa y detecta la
   más habitual —reenviar la misma imagen—, pero no la hace imposible. Por eso
   la evidencia alimenta un *índice de confianza* gradual en lugar de un sello
   binario de "verificado".
7. **El aura es popularidad, y la popularidad tiene sesgos.** Premia a quien
   tiene mejor cámara, mejor luz y más contactos en el grupo, no a quien más
   reduce. Por eso no toca los puntos, el nivel ni las recompensas: es un
   ranking aparte, declarado como tal. Quien no quiera participar no publica
   nada y su experiencia de juego es idéntica.
8. **La cohorte del ranking es sintética.** Se genera con una distribución log-normal, que es la forma real de la participación voluntaria, pero no son personas reales mientras no exista backend. La app lo declara en pantalla.
