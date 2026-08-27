/**
 * acciones.js — Catalogo de acciones ecologicas registrables.
 *
 * Modelo de impacto: toda accion declara el ahorro por unidad frente a una
 * LINEA BASE explicita (`base`). Sin linea base no hay impacto evitado: es el
 * error metodologico mas comun en las apps de sostenibilidad.
 *
 * Campos:
 *  - unidad       : magnitud que introduce la persona (km, kWh, min, kg, ud, dia)
 *  - co2e         : kg CO2e evitados por unidad (0 si depende de la red electrica)
 *  - kwh          : kWh ahorrados por unidad -> se multiplican por la intensidad
 *                   de la red del pais para obtener CO2e (dependeRed = true)
 *  - agua         : litros de agua ahorrados por unidad
 *  - residuo      : kg de residuo desviado de vertedero por unidad
 *  - dificultad   : 1 (trivial) a 5 (compromiso alto) -> multiplicador de puntos
 *  - rareza       : comun | poco_comun | raro | epico
 *  - maxDiario    : tope de plausibilidad diario (control antifraude)
 *  - cooldownMin  : minutos minimos entre registros de la misma accion
 *  - evidencia    : tipo de prueba sugerida (foto, gps, factura, ninguna)
 */

export const CATEGORIAS = Object.freeze({
  movilidad:     { etiqueta: 'Movilidad',     icono: '🚲', color: '#38bdf8' },
  energia:       { etiqueta: 'Energia',       icono: '⚡', color: '#fbbf24' },
  agua:          { etiqueta: 'Agua',          icono: '💧', color: '#22d3ee' },
  residuos:      { etiqueta: 'Residuos',      icono: '♻️', color: '#34d399' },
  alimentacion:  { etiqueta: 'Alimentacion',  icono: '🥗', color: '#a3e635' },
  consumo:       { etiqueta: 'Consumo',       icono: '🛒', color: '#f472b6' },
  biodiversidad: { etiqueta: 'Biodiversidad', icono: '🌳', color: '#4ade80' },
  comunidad:     { etiqueta: 'Comunidad',     icono: '🤝', color: '#c084fc' },
});

export const RAREZAS = Object.freeze({
  comun:      { etiqueta: 'Comun',      mult: 1.0,  color: '#94a3b8' },
  poco_comun: { etiqueta: 'Poco comun', mult: 1.15, color: '#34d399' },
  raro:       { etiqueta: 'Raro',       mult: 1.35, color: '#38bdf8' },
  epico:      { etiqueta: 'Epico',      mult: 1.6,  color: '#c084fc' },
});

export const ACCIONES = Object.freeze([
  // ---------------------------------------------------------------- MOVILIDAD
  { id: 'mov_bici', cat: 'movilidad', titulo: 'Ir en bicicleta', icono: '🚲',
    unidad: 'km', co2e: 0.171, agua: 0, residuo: 0, dificultad: 2, rareza: 'comun',
    maxDiario: 60, cooldownMin: 30, evidencia: 'gps',
    base: 'Sustituye un trayecto en coche de gasolina (0,171 kg CO2e/km, DEFRA 2023)',
    consejo: 'Por debajo de 5 km la bici es mas rapida que el coche puerta a puerta en la mayoria de ciudades.' },

  { id: 'mov_caminar', cat: 'movilidad', titulo: 'Ir caminando', icono: '🚶',
    unidad: 'km', co2e: 0.171, agua: 0, residuo: 0, dificultad: 2, rareza: 'comun',
    maxDiario: 25, cooldownMin: 30, evidencia: 'gps',
    base: 'Sustituye un trayecto corto en coche de gasolina',
    consejo: 'Caminar 30 min diarios reduce un 20-30 % el riesgo cardiovascular (OMS).' },

  { id: 'mov_transporte', cat: 'movilidad', titulo: 'Usar transporte publico', icono: '🚇',
    unidad: 'km', co2e: 0.138, agua: 0, residuo: 0, dificultad: 2, rareza: 'comun',
    maxDiario: 120, cooldownMin: 20, evidencia: 'foto',
    base: 'Coche gasolina (0,171) menos metro/bus medio (0,033-0,102 kg CO2e/pkm)',
    consejo: 'Un autobus lleno saca de la via a unos 40 coches y libera 800 m2 de asfalto.' },

  { id: 'mov_compartir', cat: 'movilidad', titulo: 'Compartir coche', icono: '🚗',
    unidad: 'km', co2e: 0.110, agua: 0, residuo: 0, dificultad: 2, rareza: 'poco_comun',
    maxDiario: 200, cooldownMin: 60, evidencia: 'ninguna',
    base: 'Pasar de 1 a 2,8 ocupantes reparte las emisiones del vehiculo',
    consejo: 'La ocupacion media en Europa es de 1,4 personas: el potencial de mejora es enorme.' },

  { id: 'mov_teletrabajo', cat: 'movilidad', titulo: 'Teletrabajar un dia', icono: '🏠',
    unidad: 'dia', co2e: 3.6, agua: 0, residuo: 0, dificultad: 1, rareza: 'comun',
    maxDiario: 1, cooldownMin: 720, evidencia: 'ninguna',
    base: 'Evita un desplazamiento medio de ida y vuelta de 21 km en coche',
    consejo: 'Descontando el consumo extra del hogar, el ahorro neto ronda el 54 % (IEA).' },

  { id: 'mov_evitar_vuelo', cat: 'movilidad', titulo: 'Cambiar vuelo por tren', icono: '🚆',
    unidad: 'km', co2e: 0.426, agua: 0, residuo: 0, dificultad: 4, rareza: 'epico',
    maxDiario: 1500, cooldownMin: 1440, evidencia: 'factura',
    base: 'Avion corto con RFI 1,9 (0,467) frente a tren de alta velocidad (0,041)',
    consejo: 'Un vuelo Madrid-Barcelona emite por pasajero lo mismo que 8 meses de calefaccion eficiente.' },

  { id: 'mov_conduccion', cat: 'movilidad', titulo: 'Conduccion eficiente', icono: '🛞',
    unidad: 'km', co2e: 0.026, agua: 0, residuo: 0, dificultad: 2, rareza: 'comun',
    maxDiario: 300, cooldownMin: 60, evidencia: 'ninguna',
    base: 'Ahorro del 15 % por velocidad estable, marchas largas y presion correcta',
    consejo: 'Bajar de 120 a 100 km/h reduce el consumo un 15-20 %.' },

  // ------------------------------------------------------------------ ENERGIA
  { id: 'ene_led', cat: 'energia', titulo: 'Cambiar bombilla a LED', icono: '💡',
    unidad: 'ud', kwh: 51, dependeRed: true, agua: 0, residuo: 0, dificultad: 1, rareza: 'poco_comun',
    maxDiario: 12, cooldownMin: 5, evidencia: 'foto',
    base: 'Ahorro anual de 51 kWh por bombilla (60 W -> 9 W, 1.000 h/anio)',
    consejo: 'Un LED dura 25.000 h: 25 veces mas que una incandescente.' },

  { id: 'ene_standby', cat: 'energia', titulo: 'Eliminar consumo fantasma', icono: '🔌',
    unidad: 'dia', kwh: 1.08, dependeRed: true, agua: 0, residuo: 0, dificultad: 1, rareza: 'comun',
    maxDiario: 1, cooldownMin: 720, evidencia: 'ninguna',
    base: 'El standby supone el 5-10 % del consumo domestico (IEA 4E)',
    consejo: 'Una regleta con interruptor amortiza su precio en menos de 6 meses.' },

  { id: 'ene_termostato', cat: 'energia', titulo: 'Bajar el termostato 1 C', icono: '🌡️',
    unidad: 'dia', kwh: 2.4, dependeRed: true, agua: 0, residuo: 0, dificultad: 2, rareza: 'comun',
    maxDiario: 1, cooldownMin: 720, evidencia: 'ninguna',
    base: 'Cada grado menos ahorra ~7 % de la energia de climatizacion',
    consejo: '19-21 C en invierno y 25-27 C en verano son las consignas recomendadas.' },

  { id: 'ene_tender', cat: 'energia', titulo: 'Tender ropa al aire', icono: '🧺',
    unidad: 'ud', kwh: 2.5, dependeRed: true, agua: 0, residuo: 0, dificultad: 1, rareza: 'comun',
    maxDiario: 3, cooldownMin: 120, evidencia: 'foto',
    base: 'Evita un ciclo de secadora (2,5 kWh)',
    consejo: 'La secadora es el segundo electrodomestico que mas consume tras la climatizacion.' },

  { id: 'ene_lavado_frio', cat: 'energia', titulo: 'Lavar en frio (30 C)', icono: '🫧',
    unidad: 'ud', kwh: 0.55, dependeRed: true, agua: 0, residuo: 0, dificultad: 1, rareza: 'comun',
    maxDiario: 4, cooldownMin: 60, evidencia: 'ninguna',
    base: 'Diferencia entre ciclo a 60 C (0,7 kWh) y a 30 C (0,15 kWh)',
    consejo: 'El 90 % de la energia de un lavado se va en calentar el agua.' },

  { id: 'ene_renovable', cat: 'energia', titulo: 'Contratar energia 100 % renovable', icono: '🌞',
    unidad: 'ud', co2e: 380, agua: 0, residuo: 0, dificultad: 3, rareza: 'epico',
    maxDiario: 1, cooldownMin: 525600, evidencia: 'factura',
    base: 'Hogar medio de 2.500 kWh/anio con garantia de origen renovable',
    consejo: 'Exige garantias de origen certificadas: evita el greenwashing de comercializadoras.' },

  { id: 'ene_solar', cat: 'energia', titulo: 'Autoconsumo solar (1 mes)', icono: '🔆',
    unidad: 'mes', kwh: 300, dependeRed: true, agua: 0, residuo: 0, dificultad: 5, rareza: 'epico',
    maxDiario: 1, cooldownMin: 43200, evidencia: 'factura',
    base: 'Instalacion domestica de 3 kWp con 3,3 h solares pico equivalentes',
    consejo: 'El coste de la fotovoltaica ha caido un 89 % desde 2010 (IRENA).' },

  { id: 'ene_ducha_corta_e', cat: 'energia', titulo: 'Reducir 5 min de agua caliente', icono: '🚿',
    unidad: 'ud', kwh: 1.62, dependeRed: true, agua: 47.5, residuo: 0, dificultad: 2, rareza: 'comun',
    maxDiario: 2, cooldownMin: 240, evidencia: 'ninguna',
    base: '47,5 L a 0,0342 kWh/L de calentamiento (salto termico de 25 K)',
    consejo: 'Doble impacto: ahorra agua y la energia de calentarla, que es lo mas costoso.' },

  // --------------------------------------------------------------------- AGUA
  { id: 'agu_ducha', cat: 'agua', titulo: 'Ducha de 5 minutos o menos', icono: '⏱️',
    unidad: 'ud', co2e: 0, agua: 47.5, residuo: 0, dificultad: 2, rareza: 'comun',
    maxDiario: 2, cooldownMin: 240, evidencia: 'ninguna',
    base: 'Ducha media de 10 min (95 L) frente a 5 min (47,5 L)',
    consejo: 'Un cabezal eficiente baja de 9,5 a 6 L/min sin perder sensacion de presion.' },

  { id: 'agu_grifo', cat: 'agua', titulo: 'Cerrar el grifo al enjabonarse', icono: '🚰',
    unidad: 'min', co2e: 0, agua: 8, residuo: 0, dificultad: 1, rareza: 'comun',
    maxDiario: 20, cooldownMin: 30, evidencia: 'ninguna',
    base: 'Caudal medio de grifo domestico: 8 L/min',
    consejo: 'Cerrar el grifo al lavarse los dientes ahorra 24 L al dia por persona.' },

  { id: 'agu_fuga', cat: 'agua', titulo: 'Reparar una fuga', icono: '🔧',
    unidad: 'ud', co2e: 0, agua: 10000, residuo: 0, dificultad: 3, rareza: 'raro',
    maxDiario: 2, cooldownMin: 1440, evidencia: 'foto',
    base: 'Un goteo constante pierde ~27 L/dia -> 10.000 L/anio (EPA WaterSense)',
    consejo: 'Las fugas domesticas suponen el 12 % del consumo de agua en el hogar.' },

  { id: 'agu_lluvia', cat: 'agua', titulo: 'Recoger agua de lluvia', icono: '🌧️',
    unidad: 'L', co2e: 0.0003, agua: 1, residuo: 0, dificultad: 3, rareza: 'raro',
    maxDiario: 500, cooldownMin: 720, evidencia: 'foto',
    base: 'Agua no potabilizada ni bombeada (0,3 kWh/m3 evitados)',
    consejo: '1 mm de lluvia sobre 100 m2 de tejado son 100 L aprovechables.' },

  { id: 'agu_lavavajillas', cat: 'agua', titulo: 'Lavavajillas lleno en vez de a mano', icono: '🍽️',
    unidad: 'ud', co2e: 0, agua: 28, residuo: 0, dificultad: 1, rareza: 'comun',
    maxDiario: 2, cooldownMin: 240, evidencia: 'ninguna',
    base: 'Lavado a mano (40 L) frente a lavavajillas eficiente lleno (12 L)',
    consejo: 'Solo si va lleno: media carga anula la ventaja.' },

  { id: 'agu_riego', cat: 'agua', titulo: 'Riego por goteo o al amanecer', icono: '🌱',
    unidad: 'min', co2e: 0, agua: 9, residuo: 0, dificultad: 2, rareza: 'poco_comun',
    maxDiario: 60, cooldownMin: 240, evidencia: 'ninguna',
    base: 'Reduce un 60 % la evaporacion frente a riego por aspersion al mediodia',
    consejo: 'La agricultura consume el 70 % del agua dulce extraida del planeta (FAO).' },

  // ----------------------------------------------------------------- RESIDUOS
  { id: 'res_reciclar_plastico', cat: 'residuos', titulo: 'Reciclar plastico', icono: '🥤',
    unidad: 'kg', co2e: 1.8, agua: 0, residuo: 1, dificultad: 1, rareza: 'comun',
    maxDiario: 10, cooldownMin: 60, evidencia: 'foto',
    base: 'EPA WARM v15: reciclar PET/HDPE frente a vertedero + resina virgen',
    consejo: 'Solo se recicla el 9 % del plastico producido en la historia (OCDE).' },

  { id: 'res_reciclar_aluminio', cat: 'residuos', titulo: 'Reciclar aluminio', icono: '🥫',
    unidad: 'kg', co2e: 8.9, agua: 0, residuo: 1, dificultad: 1, rareza: 'poco_comun',
    maxDiario: 5, cooldownMin: 60, evidencia: 'foto',
    base: 'El aluminio reciclado usa un 95 % menos de energia que el primario',
    consejo: 'Una lata reciclada vuelve a estar en el lineal en 60 dias.' },

  { id: 'res_reciclar_papel', cat: 'residuos', titulo: 'Reciclar papel y carton', icono: '📦',
    unidad: 'kg', co2e: 0.9, agua: 0, residuo: 1, dificultad: 1, rareza: 'comun',
    maxDiario: 20, cooldownMin: 60, evidencia: 'foto',
    base: 'Evita fabricacion de pasta virgen y metano de vertedero',
    consejo: 'La fibra de celulosa aguanta entre 5 y 7 ciclos de reciclaje.' },

  { id: 'res_reciclar_vidrio', cat: 'residuos', titulo: 'Reciclar vidrio', icono: '🍾',
    unidad: 'kg', co2e: 0.31, agua: 0, residuo: 1, dificultad: 1, rareza: 'comun',
    maxDiario: 20, cooldownMin: 60, evidencia: 'foto',
    base: 'Menor temperatura de fusion con calcin frente a materia prima virgen',
    consejo: 'El vidrio es reciclable infinitas veces sin perder calidad.' },

  { id: 'res_compostar', cat: 'residuos', titulo: 'Compostar organico', icono: '🪱',
    unidad: 'kg', co2e: 0.55, agua: 0, residuo: 1, dificultad: 3, rareza: 'raro',
    maxDiario: 8, cooldownMin: 120, evidencia: 'foto',
    base: 'Evita metano anaerobio de vertedero (GWP-100 de 27, IPCC AR6)',
    consejo: 'El compost devuelve carbono al suelo y sustituye fertilizante sintetico.' },

  { id: 'res_raee', cat: 'residuos', titulo: 'Llevar electronicos a punto limpio', icono: '📱',
    unidad: 'kg', co2e: 12, agua: 0, residuo: 1, dificultad: 3, rareza: 'raro',
    maxDiario: 10, cooldownMin: 1440, evidencia: 'foto',
    base: 'Recuperacion de metales criticos frente a mineria primaria',
    consejo: 'Se generan 62 Mt de RAEE al anio y solo se recoge formalmente el 22 %.' },

  { id: 'res_cero_desechable', cat: 'residuos', titulo: 'Dia sin plastico de un solo uso', icono: '🚫',
    unidad: 'dia', co2e: 0.42, agua: 12, residuo: 0.12, dificultad: 3, rareza: 'raro',
    maxDiario: 1, cooldownMin: 720, evidencia: 'ninguna',
    base: 'Evita ~5 envases desechables diarios (botella, bolsa, vaso, cubiertos, film)',
    consejo: 'Lleva botella, bolsa y taza reutilizables: cubre el 80 % de los casos.' },

  { id: 'res_reparar', cat: 'residuos', titulo: 'Reparar en vez de tirar', icono: '🛠️',
    unidad: 'ud', co2e: 25, agua: 800, residuo: 1.5, dificultad: 4, rareza: 'epico',
    maxDiario: 3, cooldownMin: 1440, evidencia: 'foto',
    base: 'Evita fabricar un objeto nuevo de complejidad media',
    consejo: 'Alargar 1 anio la vida de los electrodomesticos de la UE ahorraria 4 Mt CO2e/anio.' },

  { id: 'res_limpieza', cat: 'residuos', titulo: 'Recoger basura del entorno', icono: '🧤',
    unidad: 'kg', co2e: 0.3, agua: 0, residuo: 1, dificultad: 3, rareza: 'raro',
    maxDiario: 15, cooldownMin: 240, evidencia: 'foto',
    base: 'Retira residuos antes de que se fragmenten en microplasticos',
    consejo: 'Una colilla contamina hasta 50 L de agua: es el residuo mas recogido del mundo.' },

  // ------------------------------------------------------------- ALIMENTACION
  { id: 'ali_sin_carne', cat: 'alimentacion', titulo: 'Comida sin carne', icono: '🥦',
    unidad: 'ud', co2e: 1.9, agua: 1500, residuo: 0, dificultad: 2, rareza: 'comun',
    maxDiario: 3, cooldownMin: 180, evidencia: 'foto',
    base: 'Diferencia media entre plato con carne y plato vegetal (Poore & Nemecek 2018)',
    consejo: 'La ganaderia genera el 14,5 % de los gases de efecto invernadero mundiales (FAO).' },

  { id: 'ali_sin_res', cat: 'alimentacion', titulo: 'Sustituir carne de res', icono: '🐄',
    unidad: 'ud', co2e: 6.3, agua: 2500, residuo: 0, dificultad: 3, rareza: 'raro',
    maxDiario: 2, cooldownMin: 240, evidencia: 'foto',
    base: 'Una hamburguesa de res (150 g) frente a alternativa vegetal',
    consejo: 'La res emite 10 veces mas que el pollo y 100 veces mas que las legumbres por proteina.' },

  { id: 'ali_local', cat: 'alimentacion', titulo: 'Comprar local y de temporada', icono: '🧺',
    unidad: 'kg', co2e: 0.35, agua: 0, residuo: 0.05, dificultad: 2, rareza: 'poco_comun',
    maxDiario: 15, cooldownMin: 120, evidencia: 'foto',
    base: 'Evita transporte refrigerado y cultivo en invernadero climatizado',
    consejo: 'Ojo: el transporte solo pesa un 6 % de la huella alimentaria; lo decisivo es QUE comes, no de donde viene.' },

  { id: 'ali_no_desperdiciar', cat: 'alimentacion', titulo: 'Aprovechar sobras', icono: '🍲',
    unidad: 'kg', co2e: 2.5, agua: 1000, residuo: 1, dificultad: 2, rareza: 'poco_comun',
    maxDiario: 5, cooldownMin: 120, evidencia: 'foto',
    base: 'Huella media del alimento desperdiciado mas el metano evitado',
    consejo: 'Si el desperdicio alimentario fuera un pais seria el tercer emisor mundial.' },

  { id: 'ali_granel', cat: 'alimentacion', titulo: 'Comprar a granel', icono: '🫙',
    unidad: 'ud', co2e: 0.25, agua: 5, residuo: 0.08, dificultad: 3, rareza: 'raro',
    maxDiario: 10, cooldownMin: 60, evidencia: 'foto',
    base: 'Elimina el envase primario de un producto envasado medio',
    consejo: 'El envase supone hasta el 5 % de la huella del producto y el 100 % de su residuo.' },

  { id: 'ali_agua_grifo', cat: 'alimentacion', titulo: 'Beber agua del grifo', icono: '🚰',
    unidad: 'ud', co2e: 0.083, agua: 3, residuo: 0.025, dificultad: 1, rareza: 'comun',
    maxDiario: 8, cooldownMin: 30, evidencia: 'ninguna',
    base: 'Sustituye una botella PET de 500 ml (0,083 kg CO2e de ciclo de vida)',
    consejo: 'El agua embotellada puede emitir hasta 1.000 veces mas que la del grifo.' },

  // ------------------------------------------------------------------ CONSUMO
  { id: 'con_segunda_mano', cat: 'consumo', titulo: 'Comprar de segunda mano', icono: '👕',
    unidad: 'ud', co2e: 7, agua: 2700, residuo: 0.25, dificultad: 2, rareza: 'poco_comun',
    maxDiario: 5, cooldownMin: 120, evidencia: 'foto',
    base: 'Evita fabricar una prenda de algodon nueva (Quantis 2018)',
    consejo: 'La moda genera entre el 2 % y el 8 % de las emisiones mundiales.' },

  { id: 'con_no_comprar', cat: 'consumo', titulo: 'Renunciar a una compra impulsiva', icono: '🧠',
    unidad: 'ud', co2e: 5, agua: 500, residuo: 0.4, dificultad: 3, rareza: 'raro',
    maxDiario: 3, cooldownMin: 180, evidencia: 'ninguna',
    base: 'Estimacion conservadora de un producto de consumo medio no adquirido',
    consejo: 'La regla de las 72 horas elimina la mayoria de compras impulsivas.' },

  { id: 'con_alargar_movil', cat: 'consumo', titulo: 'Alargar la vida del movil 1 anio', icono: '📵',
    unidad: 'ud', co2e: 20.7, agua: 1067, residuo: 0.06, dificultad: 4, rareza: 'epico',
    maxDiario: 1, cooldownMin: 525600, evidencia: 'ninguna',
    base: 'Amortiza los 62 kg CO2e de fabricacion sobre un anio adicional de uso',
    consejo: 'El 80 % de la huella de un smartphone esta en su fabricacion, no en su uso.' },

  { id: 'con_digital', cat: 'consumo', titulo: 'Limpieza digital (correos y nube)', icono: '☁️',
    unidad: 'GB', co2e: 0.02, agua: 0, residuo: 0, dificultad: 1, rareza: 'comun',
    maxDiario: 100, cooldownMin: 1440, evidencia: 'ninguna',
    base: 'Almacenamiento en centro de datos: ~0,02 kg CO2e por GB y anio',
    consejo: 'Los centros de datos consumen ya el 1,5 % de la electricidad mundial (IEA 2024).' },

  { id: 'con_streaming', cat: 'consumo', titulo: 'Bajar la calidad de streaming', icono: '📺',
    unidad: 'h', kwh: 0.05, dependeRed: true, agua: 0, residuo: 0, dificultad: 1, rareza: 'comun',
    maxDiario: 8, cooldownMin: 60, evidencia: 'ninguna',
    base: 'Diferencia entre 4K y HD en una hora de reproduccion',
    consejo: 'En pantalla de movil la diferencia visual entre 4K y HD es practicamente nula.' },

  // ------------------------------------------------------------ BIODIVERSIDAD
  { id: 'bio_plantar_arbol', cat: 'biodiversidad', titulo: 'Plantar un arbol', icono: '🌳',
    unidad: 'ud', co2e: 21.77, agua: 0, residuo: 0, dificultad: 4, rareza: 'epico',
    maxDiario: 20, cooldownMin: 60, evidencia: 'foto',
    base: 'Secuestro anual de un arbol urbano maduro (EPA 2024)',
    consejo: 'Especie autoctona y cuidado 3 anios: sin eso, la mortalidad supera el 50 %.' },

  { id: 'bio_planta_nativa', cat: 'biodiversidad', titulo: 'Plantar especie nativa o polinizadora', icono: '🌻',
    unidad: 'ud', co2e: 1.2, agua: 0, residuo: 0, dificultad: 2, rareza: 'raro',
    maxDiario: 30, cooldownMin: 30, evidencia: 'foto',
    base: 'Captura de una planta perenne mas servicio de polinizacion',
    consejo: 'El 75 % de los cultivos alimentarios depende en algun grado de polinizadores.' },

  { id: 'bio_huerto', cat: 'biodiversidad', titulo: 'Cultivar alimento propio', icono: '🍅',
    unidad: 'kg', co2e: 0.7, agua: 0, residuo: 0.1, dificultad: 4, rareza: 'raro',
    maxDiario: 10, cooldownMin: 120, evidencia: 'foto',
    base: 'Evita produccion industrial, envase y cadena de frio',
    consejo: 'Un metro cuadrado bien gestionado da hasta 20 kg de hortalizas al anio.' },

  { id: 'bio_sin_pesticida', cat: 'biodiversidad', titulo: 'Jardin sin pesticidas', icono: '🐝',
    unidad: 'mes', co2e: 2, agua: 0, residuo: 0, dificultad: 3, rareza: 'raro',
    maxDiario: 1, cooldownMin: 43200, evidencia: 'ninguna',
    base: 'Evita produccion y aplicacion de agroquimicos de sintesis',
    consejo: 'La biomasa de insectos voladores ha caido un 76 % en 27 anios en areas protegidas (Hallmann 2017).' },

  { id: 'bio_agua_fauna', cat: 'biodiversidad', titulo: 'Poner agua o refugio para fauna', icono: '🐦',
    unidad: 'ud', co2e: 0.1, agua: 0, residuo: 0, dificultad: 2, rareza: 'poco_comun',
    maxDiario: 5, cooldownMin: 1440, evidencia: 'foto',
    base: 'Servicio ecosistemico local (sin equivalencia directa en CO2e)',
    consejo: 'En olas de calor, un bebedero limpio salva mas aves que cualquier otra ayuda urbana.' },

  // ---------------------------------------------------------------- COMUNIDAD
  { id: 'com_voluntariado', cat: 'comunidad', titulo: 'Voluntariado ambiental', icono: '🤝',
    unidad: 'h', co2e: 5, agua: 0, residuo: 0.5, dificultad: 4, rareza: 'epico',
    maxDiario: 8, cooldownMin: 60, evidencia: 'foto',
    base: 'Impacto medio agregado por hora de accion colectiva',
    consejo: 'El efecto social contagioso multiplica por 4 el impacto individual (Nolan et al. 2008).' },

  { id: 'com_ensenar', cat: 'comunidad', titulo: 'Ensenar a alguien una practica sostenible', icono: '🎓',
    unidad: 'ud', co2e: 3, agua: 0, residuo: 0, dificultad: 2, rareza: 'raro',
    maxDiario: 5, cooldownMin: 120, evidencia: 'ninguna',
    base: 'Adopcion parcial estimada de la practica por la persona formada',
    consejo: 'Hablar del clima es la accion con mayor efecto multiplicador segun Yale CCC.' },

  { id: 'com_ciencia_ciudadana', cat: 'comunidad', titulo: 'Aportar dato de ciencia ciudadana', icono: '🔬',
    unidad: 'ud', co2e: 0.5, agua: 0, residuo: 0, dificultad: 2, rareza: 'raro',
    maxDiario: 20, cooldownMin: 10, evidencia: 'foto',
    base: 'Valor cientifico del dato (sin equivalencia directa en CO2e)',
    consejo: 'Plataformas como iNaturalist o GLOBE usan estos datos en publicaciones revisadas por pares.' },

  { id: 'com_denuncia', cat: 'comunidad', titulo: 'Reportar un problema ambiental', icono: '📢',
    unidad: 'ud', co2e: 2, agua: 0, residuo: 0, dificultad: 3, rareza: 'raro',
    maxDiario: 3, cooldownMin: 240, evidencia: 'foto',
    base: 'Vertidos, fugas o quemas corregidas por aviso ciudadano',
    consejo: 'Documenta con foto, fecha y ubicacion: sin eso el aviso rara vez prospera.' },

  { id: 'com_reto_amigo', cat: 'comunidad', titulo: 'Invitar a alguien al reto', icono: '🫂',
    unidad: 'ud', co2e: 4, agua: 0, residuo: 0, dificultad: 2, rareza: 'poco_comun',
    maxDiario: 5, cooldownMin: 60, evidencia: 'ninguna',
    base: 'Impacto esperado del primer mes de actividad de la persona invitada',
    consejo: 'Las normas sociales descriptivas son el mayor predictor de cambio de habitos.' },
]);

const INDICE = new Map(ACCIONES.map((a) => [a.id, a]));

export function accion(id) {
  return INDICE.get(id) || null;
}

export function accionesPorCategoria(cat) {
  return ACCIONES.filter((a) => a.cat === cat);
}

export function categoriasConAcciones() {
  return Object.entries(CATEGORIAS).map(([id, meta]) => ({
    id, ...meta, acciones: accionesPorCategoria(id),
  }));
}
