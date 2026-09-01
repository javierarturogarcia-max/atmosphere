/**
 * cadencia.js — Que dice el acelerometro sobre lo que estabas haciendo.
 *
 * QUE VALIDA ESTO Y QUE NO. Un acelerometro ve MOVIMIENTO, no intenciones ni
 * objetos. Puede distinguir con bastante fiabilidad estar quieto de caminar y
 * caminar de correr, porque son regimenes de cadencia y de intensidad muy
 * separados. No puede saber si la botella es de plastico o de vidrio, ni si
 * bebiste agua. Cualquier sistema que diga lo contrario esta adivinando, y este
 * proyecto prefiere declarar lo que no sabe.
 *
 * COMO. Se muestrea el modulo de la aceleracion durante unos segundos mientras
 * se graba la prueba. Se le quita la media —que es basicamente la gravedad y la
 * orientacion del telefono, constantes en una ventana corta— y lo que queda es
 * la oscilacion de los pasos. Contando picos con periodo refractario sale la
 * cadencia; la RMS de la senal da la intensidad.
 *
 * RANGOS. Caminar humano se concentra en 90-130 pasos/min y correr en 150-190,
 * con la marcha rapida y el trote lento solapandose alrededor de 140. La
 * separacion no es un umbral limpio, asi que el solape se declara como
 * 'indeterminado' en vez de inventar una respuesta.
 *
 * Todo son funciones puras sobre un vector de muestras: se prueban sin
 * telefono, sin permisos y sin navegador.
 */

/**
 * Regimenes de movimiento.
 *
 * MANDA LA CADENCIA, no la intensidad. La cadencia es la magnitud con
 * significado fisico —cuantos pasos por minuto da una persona— y esta bien
 * documentada: la marcha humana se concentra en 90-130 y la carrera en 150-190.
 * La intensidad depende de donde lleves el telefono (mano, bolsillo, brazalete)
 * y varia mucho mas entre personas, asi que solo se usa para CONFIRMAR, nunca
 * para vetar: usarla como filtro dejaba sin clasificar a quien corre con el
 * movil en un bolsillo ajustado.
 */
export const REGIMENES = Object.freeze({
  reposo:     { cadencia: [0, 40],    rmsTipica: [0, 0.8],  etiqueta: 'Quieto',    icono: '🧍' },
  caminando:  { cadencia: [80, 135],  rmsTipica: [0.6, 7],  etiqueta: 'Caminando', icono: '🚶' },
  corriendo:  { cadencia: [145, 220], rmsTipica: [2, 40],   etiqueta: 'Corriendo', icono: '🏃' },
});

/** Franja donde marcha rapida y trote lento son indistinguibles de verdad. */
export const FRANJA_AMBIGUA = Object.freeze([135, 145]);

/** Periodo refractario entre pasos: 250 ms = tope de 240 pasos/min. */
export const REFRACTARIO_MS = 250;

/** Muestras minimas para que el analisis signifique algo (~3 s a 50 Hz). */
export const MUESTRAS_MINIMAS = 150;

/**
 * Modulo de la aceleracion de cada muestra.
 * @param {Array<{x:number,y:number,z:number}>} muestras
 * @returns {number[]}
 */
export function modulos(muestras) {
  return (muestras || [])
    .filter((m) => m && Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.z))
    .map((m) => Math.sqrt(m.x * m.x + m.y * m.y + m.z * m.z));
}

/** Media aritmetica; 0 si no hay datos. */
export function media(v) {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

/**
 * Raiz del valor cuadratico medio de la senal SIN su media.
 *
 * Quitar la media es lo que separa "cuanto se mueve" de "hacia donde apunta el
 * telefono": la gravedad aporta ~9,81 constantes que, sin restarlas, dominarian
 * la medida y darian la misma intensidad quieto que corriendo.
 */
export function intensidad(serie) {
  if (!serie.length) return 0;
  const m = media(serie);
  return Math.sqrt(media(serie.map((x) => (x - m) ** 2)));
}

/**
 * Instantes de los picos de la senal, con periodo refractario.
 *
 * Un paso produce un pico claro, pero el ruido produce muchos pequenos. Se
 * exige superar la media mas media desviacion y respetar 250 ms desde el pico
 * anterior: sin lo segundo, un solo paso con rebote se contaria dos o tres
 * veces y la cadencia saldria al doble.
 *
 * @param {number[]} serie modulos
 * @param {number[]} tiempos milisegundos de cada muestra
 * @returns {number[]} instantes de los picos
 */
export function picos(serie, tiempos) {
  if (serie.length < 3) return [];
  const m = media(serie);
  const umbral = m + 0.5 * intensidad(serie);
  const salida = [];
  let ultimo = -Infinity;
  for (let i = 1; i < serie.length - 1; i++) {
    const esCumbre = serie[i] > serie[i - 1] && serie[i] >= serie[i + 1];
    if (!esCumbre || serie[i] < umbral) continue;
    const t = tiempos[i];
    if (t - ultimo < REFRACTARIO_MS) continue;
    salida.push(t);
    ultimo = t;
  }
  return salida;
}

/**
 * Regularidad del paso: 1 = metronomo, 0 = caotico.
 *
 * Es el coeficiente de variacion de los intervalos entre picos, invertido. Un
 * humano caminando marca intervalos muy parejos; agitar el telefono en la mano
 * para simular pasos no, y ahi es donde se nota. Sirve de confianza, no de
 * veredicto: nadie queda descalificado por tener un paso irregular.
 */
export function regularidad(instantes) {
  if (instantes.length < 4) return 0;
  const int = [];
  for (let i = 1; i < instantes.length; i++) int.push(instantes[i] - instantes[i - 1]);
  const m = media(int);
  if (m <= 0) return 0;
  const cv = Math.sqrt(media(int.map((x) => (x - m) ** 2))) / m;
  return Math.max(0, Math.min(1, 1 - cv));
}

/**
 * Analiza una ventana de muestras y dice que regimen de movimiento hubo.
 *
 * @param {Array<{x:number,y:number,z:number,t:number}>} muestras
 * @returns {{regimen:string, cadencia:number, intensidad:number,
 *            regularidad:number, confianza:number, segundos:number,
 *            etiqueta:string, icono:string, motivo:string}}
 */
export function analizarMovimiento(muestras) {
  const buenas = (muestras || []).filter((m) => m && Number.isFinite(m.t));
  const serie = modulos(buenas);
  const tiempos = buenas.slice(0, serie.length).map((m) => m.t);
  const segundos = tiempos.length > 1 ? (tiempos[tiempos.length - 1] - tiempos[0]) / 1000 : 0;

  const vacio = (motivo) => ({
    regimen: 'desconocido', cadencia: 0, intensidad: 0, regularidad: 0,
    confianza: 0, segundos, etiqueta: 'Sin datos de movimiento', icono: '❔', motivo,
  });

  if (serie.length < MUESTRAS_MINIMAS || segundos < 2) {
    return vacio('El sensor de movimiento dio muy pocas muestras.');
  }

  const rms = intensidad(serie);
  const p = picos(serie, tiempos);
  const cadencia = segundos > 0 ? (p.length / segundos) * 60 : 0;
  const reg = regularidad(p);

  const spm = Math.round(cadencia);
  const enBanda = (nombre) => cadencia >= REGIMENES[nombre].cadencia[0]
                           && cadencia <= REGIMENES[nombre].cadencia[1];

  let regimen = 'indeterminado';
  let motivo = '';
  if (rms < REGIMENES.reposo.rmsTipica[1] && cadencia < REGIMENES.reposo.cadencia[1]) {
    regimen = 'reposo';
    motivo = 'Casi no hubo movimiento.';
  } else if (cadencia > FRANJA_AMBIGUA[0] && cadencia < FRANJA_AMBIGUA[1]) {
    // Marcha rapida y trote lento se parecen de verdad alrededor de 140 spm.
    // Fingir certeza justo ahi seria el error mas facil de cometer.
    motivo = `${spm} pasos por minuto: entre marcha rapida y trote.`;
  } else if (enBanda('corriendo')) {
    regimen = 'corriendo';
    motivo = `${spm} pasos por minuto: ritmo de carrera.`;
  } else if (enBanda('caminando')) {
    regimen = 'caminando';
    motivo = `${spm} pasos por minuto: ritmo de marcha.`;
  } else {
    motivo = `${spm} pasos por minuto: no encaja con caminar ni con correr.`;
  }

  // La intensidad no veta, pero si esta fuera de lo tipico del regimen se resta
  // confianza: es la senal de un telefono en un sitio raro o de un movimiento
  // que imita la cadencia sin serlo.
  const tipica = REGIMENES[regimen]?.rmsTipica;
  const rmsCoherente = !tipica || (rms >= tipica[0] && rms <= tipica[1]);

  const conocido = regimen !== 'indeterminado' && regimen !== 'desconocido';
  const etiqueta = REGIMENES[regimen]?.etiqueta || 'Movimiento no clasificable';
  const icono = REGIMENES[regimen]?.icono || '❔';

  // La confianza baja con el paso irregular y con las ventanas cortas: cuatro
  // segundos dan una estimacion mucho mas fragil que doce.
  const porTiempo = Math.min(1, segundos / 8);
  const bruta = conocido
    ? 0.30 + 0.45 * reg + 0.25 * porTiempo
    : 0.30 * porTiempo;
  const confianza = Math.round(100 * bruta * (rmsCoherente ? 1 : 0.6)) / 100;

  return { regimen, cadencia, intensidad: rms, regularidad: reg, confianza, segundos, etiqueta, icono, motivo };
}

/**
 * Contrasta lo que dice el sensor con lo que la persona declaro.
 *
 * NO SIRVE PARA DESCALIFICAR, y esa es la decision de diseno importante. Alguien
 * puede reciclar de pie y quieto, grabar el video con el telefono en un tripode,
 * o simplemente tener el sensor bloqueado por el navegador. Lo que hace es
 * CONFIRMAR cuando el movimiento respalda la accion, que es lo unico que se
 * puede afirmar con honestidad.
 *
 * @param {string} regimenEsperado 'caminando' | 'corriendo' | null
 * @param {object} analisis salida de analizarMovimiento
 */
export function contrastar(regimenEsperado, analisis) {
  if (!regimenEsperado || !REGIMENES[regimenEsperado]) {
    return { veredicto: 'no_aplica', texto: 'Esta accion no se comprueba con el movimiento.' };
  }
  if (!analisis || analisis.regimen === 'desconocido') {
    return { veredicto: 'sin_datos', texto: 'No hubo datos de movimiento; la prueba vale igual.' };
  }
  if (analisis.regimen === regimenEsperado) {
    return {
      veredicto: 'confirma',
      texto: `El movimiento concuerda: ${Math.round(analisis.cadencia)} pasos por minuto.`,
    };
  }
  if (analisis.regimen === 'indeterminado') {
    return { veredicto: 'ambiguo', texto: analisis.motivo };
  }
  return {
    veredicto: 'discrepa',
    texto: `Declaraste ${REGIMENES[regimenEsperado].etiqueta.toLowerCase()} y el sensor midio ${analisis.etiqueta.toLowerCase()}.`,
  };
}
