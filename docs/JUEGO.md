# Monte Adentro — guía del juego

**Un niño que se cría en el campo.** Aprende a cazar, a pescar, a rebuscar en el
monte, a sembrar su milpa y a traer agua y leña a una casa donde no hay luz ni
tubería. Cada día que la casa tiene lo que necesita cuenta; cada cosa que
aprende le abre algo que ayer no podía hacer.

Se juega en `juego.html` (o en `dist/juego.html`, que es el juego entero en un
solo archivo, sin ninguna dependencia externa).

---

## 1. Cómo se juega

| Acción | Teclado | Mando | Móvil |
|---|---|---|---|
| Moverse | WASD o flechas | palanca izquierda | palanca (mitad izquierda) |
| Mirar | arrastrar el ratón | palanca derecha | arrastrar (mitad derecha) |
| Correr | Shift | L2 / L3 | botón 🏃 |
| Agacharse | C o Ctrl | B | — |
| Interactuar | E o Enter | X | botón ✋ |
| Acción / minijuego | Espacio | A | botón ⚡ |
| Canasta · Diario · Pausa | I · J · Esc | Y · Start | botones de arriba |
| Segunda y tercera opción | 1, 2, 3 | — | tocar la opción |

El bucle del día: levantarse, ver qué falta en la casa, ir al río, subir agua,
juntar leña, buscar comida (monte, río o milpa), cocinar en el fogón, entregar
en casa y dormir. Al cerrar el día se puntúa con estrellas.

**Lo que decide una partida no es la puntería, es el peso.** Un cántaro lleno
son diez kilos y el niño aguanta diecisiete: cada viaje al río es una decisión.

---

## 2. Mapa del código

```
juego.html                  página del juego
assets/juego.css            sistema de diseño de la interfaz
src/juego/
  main.js                   portada, partida nueva / continuar
  partida.js                orquestador: une mundo, reglas, render e interfaz
  nucleo/
    mate.js                 matrices, vectores, ruido
    bucle.js                bucle de paso fijo (1/60 s) + dibujado por cuadro
    reloj.js                hora, día, fases del día
    entrada.js              teclado, ratón, táctil y mando en una sola interfaz
    estado.js               la partida guardada (localStorage, con migraciones)
  mundo/
    terreno.js              el valle: relieve, río tallado, zonas, lugares
    dispersion.js           reparto determinista de árboles, piedras y recursos
    clima.js                estaciones, chubascos, viento, temperatura
    fauna.js                animales: dónde aparecen y cuándo te descubren
  reglas/                   TODO ESTO ES CÓDIGO PURO Y TESTEABLE (sin DOM)
    inventario.js           qué se lleva y cuánto pesa
    necesidades.js          hambre, sed, aguante, ánimo
    habilidades.js          siete oficios, niveles y desbloqueos
    cultivo.js              la milpa: arar, sembrar, regar, plaga, cosecha
    recoleccion.js          rebuscar en el monte y juntar leña
    pesca.js                calidad del sitio, picada y pulso con el pez
    caza.js                 apuntado, viento, desvío y trampas
    cocina.js               fogón y taller
    hogar.js                lo que la casa consume y el aporte del niño
    progresion.js           capítulos: cuándo se ofrecen y cómo se comprueban
    acciones.js             qué se puede hacer aquí y qué pasa al hacerlo
  contenido/                LOS DATOS: ampliar el juego es tocar esta carpeta
    objetos.js  cultivos.js  plantas.js  peces.js  recetas.js
    capitulos.js  dialogos.js
  render/
    renderizador.js         elige WebGPU y cae a WebGL2
    webgpu.js  wgsl.js      camino principal
    webgl2.js  glsl.js      respaldo
    malla.js  modelos.js    geometría procedural (no hay archivos de arte)
    escena.js  camara.js  cielo.js
  vista/
    mundo3d.js              convierte la simulación en instancias que dibujar
    personaje.js            el niño, animado por piezas
  ui/
    hud.js  paneles.js  dialogo.js  minijuegos.js  tacto.js  base.js
test/
  juego-reglas.test.js      43 pruebas de las reglas
  juego-mundo.test.js       25 pruebas del valle y del motor
```

Regla de oro: **`reglas/` y `contenido/` no tocan el DOM ni el motor gráfico.**
Por eso se pueden probar con `node --test` y por eso el juego se puede seguir
ampliando sin miedo a romper lo que ya funciona.

---

## 3. Añadir un capítulo (lo más habitual)

Todo vive en `src/juego/contenido/capitulos.js`. Un capítulo es un objeto:

```js
{
  id: 'tormenta',                       // único
  titulo: 'La noche del rayo',
  subtitulo: 'Lo que hay que salvar antes de que caiga',
  requiere: ['aguacero'],               // capítulos previos
  dia: 12,                              // opcional: día mínimo de partida
  intro: [
    { quien: 'abuela', texto: 'Ese trueno viene del cerro. Meté todo.' },
    { quien: 'nino',   texto: '¿Y los animales?' },
  ],
  objetivos: [
    { id: 'lena',  texto: 'Guardar 8 leñas',        tipo: 'entregar', objeto: 'lena', meta: 8 },
    { id: 'techo', texto: 'Dormir bajo techo',      tipo: 'accion',   accion: 'dormir', meta: 1 },
  ],
  premio: {
    xp: { fuerza: 60, espiritu: 40 },
    objetos: [{ id: 'candil', cantidad: 1 }],
    sabe: ['reparar'],                  // desbloquea recetas o hallazgos
  },
  cierre: [{ quien: 'papa', texto: 'Aguantó el techo. Aguantaste vos.' }],
  consejo: 'Con el candil se ve algo de noche; sin él, hay que esperar la luna.',
}
```

**Tipos de objetivo** (los evalúa `reglas/progresion.js`):

| tipo | campos | qué mide |
|---|---|---|
| `entregar` | `objeto`, `meta` | unidades llevadas a la casa |
| `entregarCategoria` | `categoria` (`alimento`…), `meta` | idem, por familia |
| `juntar` | `objeto`, `meta` | lo que hay en canasta + despensa |
| `accion` | `accion`, `meta` | veces que se hizo algo (`pescar`, `cazar`, `buscar`, `sembrar`, `regar`, `cosechar`, `lena`, `agua`, `banar`, `jugar_lluvia`, `trampa`, `dormir`) |
| `cocinar` | `receta`, `meta` | veces que se cocinó esa receta |
| `sembrar` | `cultivo`, `meta` | cuadros sembrados de ese cultivo |
| `cosechar` | `meta` | cosechas levantadas |
| `habilidad` | `habilidad`, `meta` | nivel alcanzado |
| `dias` | `meta` | días seguidos cubriendo la casa |
| `estrellas` | `meta` | estrellas acumuladas |
| `valor` | `meta` | valor de cambio de lo que se tiene |

Los contadores se miden **desde que empieza el capítulo**, no desde el principio
de la partida: lo que ya habías hecho antes no cuenta.

Después de añadirlo, `npm test` comprueba solo que el capítulo esté bien
formado (ids que existen, personajes definidos, tipos válidos).

### Personajes

Están en `PERSONAJES`, en el mismo archivo. Para añadir uno:

```js
tio: { nombre: 'Tío Goyo', color: '#c9b26e' },
```

---

## 4. Añadir cosas

**Un objeto** → `contenido/objetos.js`. Una línea basta; el inventario, la
cocina, el aporte a la casa y las misiones lo recogen solos.

```js
guineo: { nombre: 'Guineo', icono: '🍌', tipo: 'comida', peso: 0.2,
          valor: 3, hambre: 8, animo: 4 },
```

**Que se pueda encontrar** → `contenido/plantas.js`:

```js
{ id: 'guineo', objeto: 'guineo', fuente: 'monte', zonas: ['ribera'],
  meses: [6, 7, 8], peso: 4, cantidad: [1, 3], xp: 4 },
```

`fuente` puede ser `frutal`, `mata`, `monte`, `ribera` o `casa`; `meses` vacío
significa todo el año; `requiere` pide un desbloqueo; `trasLluvia: true` lo
limita a los días siguientes a un aguacero.

**Una receta** → `contenido/recetas.js` (`tipo: 'fogon'` o `'taller'`).

**Un cultivo** → `contenido/cultivos.js` + una malla por etapa en
`render/modelos.js` (mira `mataMaiz` como plantilla) + engancharla en
`vista/mundo3d.js` (mapa `fn` dentro de `construir`).

**Un animal** → `PERFILES` en `mundo/fauna.js` (horas activas, zonas, olfato,
oído, presa que deja) + su malla en `render/modelos.js` + su lote en
`vista/mundo3d.js` (`lotesFauna`).

**Una acción nueva** → dos sitios en `reglas/acciones.js`: ofrecerla en
`interaccionesCerca` y resolverla en `ejecutar`. Devuelve
`{ ok, texto, objetos, xp, habilidad, tiempo, actividad, contador, minijuego }`
y `partida.js` se encarga del resto (añadir al inventario, subir nivel, avanzar
el reloj, comprobar el capítulo).

---

## 5. Perillas de equilibrio

| Qué | Dónde |
|---|---|
| Duración del día (16 min reales) | `nucleo/reloj.js`, `minutosPorDia` |
| Carga que aguanta el niño | `reglas/inventario.js`, `CARGA_BASE` |
| Gasto de hambre, sed y aguante | `reglas/necesidades.js`, `ACTIVIDADES` |
| Consumo diario de la casa | `reglas/hogar.js`, `CONSUMO` |
| Curva de niveles | `reglas/habilidades.js`, `xpParaNivel` |
| Días y agua de cada cultivo | `contenido/cultivos.js` |
| Probabilidad de lluvia por mes | `mundo/clima.js`, `LLUVIA_MES` |
| Dificultad de la caza | `mundo/fauna.js` (`radioVista`, `olfato`) y `reglas/caza.js` |
| Densidad del monte | `mundo/dispersion.js`, `FLORA` y `repartir(t, { densidad })` |
| Sitio de la casa, la milpa y la poza | `mundo/terreno.js`, `LUGARES` |

---

## 6. Motor gráfico

Dos caminos, mismo resultado:

- **WebGPU** (`render/webgpu.js` + `wgsl.js`) — el camino preferente. Pases de
  sombra y de color, MSAA ×4, instancias en buffer de almacenamiento.
- **WebGL2** (`render/webgl2.js` + `glsl.js`) — respaldo automático.

Ambos hacen lo mismo: mapa de sombras direccional de 2048² con PCF 3×3, viento
que mueve la vegetación en el vertex shader, agua con olas y espuma de orilla,
cielo procedural con nubes y estrellas, niebla aérea con dispersión hacia el sol
y tonemapping ACES. Los colores se escriben en sRGB y se linealizan al sombrear.

**No hay ni un archivo de arte**: cada árbol, animal, casa y planta se construye
con código en `render/modelos.js`. Eso es lo que hace que el juego entero pese
menos de 400 kB en un solo archivo.

Si algo se ve mal en un equipo concreto: Pausa → *Motor* alterna entre
automático, WebGL2 y WebGPU, y *Calidad* baja la hierba y el mapa de sombras.

---

## 7. Pruebas

```bash
npm test                    # toda la batería, incluidas las 68 del juego
node --test test/juego-*.test.js
npm run build               # regenera dist/juego.html y dist/juego-artifact.html
npm run dev                 # servidor local en http://localhost:4173/juego.html
```

Las reglas son puras a propósito: si estas pruebas pasan, el juego es justo
aunque el motor gráfico cambie entero.
