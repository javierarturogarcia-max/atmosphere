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

## 9. Limitaciones que asumimos por escrito

1. **Los factores son promedios.** Tu coche, tu red y tu supermercado concretos difieren. Las cifras son órdenes de magnitud correctos, no contabilidad.
2. **El efecto rebote es real.** Quien ahorra en energía a veces gasta ese dinero en algo más intensivo. La reducción neta suele ser menor que la suma de las acciones.
3. **La acción individual es necesaria pero insuficiente.** Alrededor del 70 % de las emisiones depende de decisiones sistémicas de empresas y gobiernos. Por eso el catálogo incluye acciones comunitarias, formativas y de incidencia: son las que tienen efecto multiplicador.
4. **Plantar árboles no compensa emitir hoy.** Un árbol tarda décadas en alcanzar su ritmo de captura y puede liberarlo entero en un incendio. El orden correcto siempre es evitar → reducir → sustituir → y solo al final compensar.
5. **El transporte de los alimentos pesa poco** (~6 % de la huella alimentaria). Lo decisivo es *qué* comes, no de dónde viene. La app lo dice explícitamente en la acción "comprar local" para no propagar un mito cómodo.
6. **La cohorte del ranking es sintética.** Se genera con una distribución log-normal, que es la forma real de la participación voluntaria, pero no son personas reales mientras no exista backend. La app lo declara en pantalla.
