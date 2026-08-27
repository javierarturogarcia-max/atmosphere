/**
 * gps.js — Verificacion de trayectos con datos del dispositivo.
 *
 * POR QUE NO GOOGLE FIT NI APPLE HEALTH: ninguna de las dos es alcanzable desde
 * una web estatica. Las APIs de Google Fit cerraron el registro de nuevas
 * aplicaciones en mayo de 2024 y se apagan a lo largo de 2026; su sustituto,
 * Health Connect, es nativo de Android. HealthKit de Apple es nativo de iOS y
 * nunca ha tenido interfaz web. Las que si tienen API web (Fitbit, Strava)
 * exigen intercambiar un secreto de cliente en servidor, imposible en GitHub
 * Pages sin backend.
 *
 * La alternativa que SI funciona hoy, en el navegador y sin cuentas ni
 * servidores, son las dos fuentes que este modulo implementa:
 *   1. GPS en vivo mediante la Geolocation API del propio navegador.
 *   2. Importacion de trazas GPX/TCX exportadas desde cualquier app.
 * Ambas producen distancia medida por el dispositivo, no declarada por la
 * persona, que es exactamente el objetivo: convertir el autorreporte en dato.
 */

/** Radio medio de la Tierra en metros (WGS-84). */
const RADIO_TIERRA = 6371008.8;

/** Descarta puntos cuya incertidumbre horizontal supere esto (metros). */
const PRECISION_MAXIMA = 60;

/** Velocidad por encima de la cual el salto es error de GPS, no movimiento (km/h). */
const VELOCIDAD_IMPOSIBLE = 200;

/** Distancia del circulo maximo entre dos coordenadas, en metros. */
export function haversine(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Perfiles de velocidad por modo de transporte, en km/h.
 * Se comparan contra la MEDIANA de las velocidades por tramo, no contra la
 * media: un semaforo largo o un pico de GPS no deben cambiar el diagnostico.
 */
export const PERFILES = Object.freeze([
  { modo: 'mov_caminar', etiqueta: 'A pie', icono: '🚶', tipica: 4.8, minMediana: 1.5, maxMediana: 7.5, maxPico: 14 },
  { modo: 'mov_correr', etiqueta: 'Corriendo', icono: '🏃', tipica: 10, minMediana: 7.5, maxMediana: 16, maxPico: 26 },
  { modo: 'mov_bici', etiqueta: 'En bicicleta', icono: '🚲', tipica: 16, minMediana: 8, maxMediana: 32, maxPico: 60 },
  { modo: 'mov_transporte', etiqueta: 'Vehiculo', icono: '🚗', tipica: 40, minMediana: 20, maxMediana: 130, maxPico: VELOCIDAD_IMPOSIBLE },
]);

/** Mediana sin dependencias (el modulo debe poder usarse aislado). */
function mediana(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Analiza una traza de puntos y devuelve metricas verificables.
 * @param {Array<{lat:number, lon:number, t:number|string, precision?:number}>} puntos
 * @returns {{valida:boolean, motivo?:string, distanciaKm:number, duracionMin:number,
 *            velocidadMedia:number, velocidadMediana:number, velocidadMaxima:number,
 *            modo:object|null, puntosUsados:number, puntosDescartados:number}}
 */
export function analizarTraza(puntos) {
  const vacio = {
    valida: false, distanciaKm: 0, duracionMin: 0, velocidadMedia: 0,
    velocidadMediana: 0, velocidadMaxima: 0, modo: null,
    puntosUsados: 0, puntosDescartados: 0,
  };

  const limpios = (puntos || [])
    .map((p) => ({
      lat: Number(p.lat), lon: Number(p.lon),
      t: typeof p.t === 'number' ? p.t : new Date(p.t).getTime(),
      precision: Number.isFinite(p.precision) ? p.precision : 0,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.t)
      && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180
      && (p.precision === 0 || p.precision <= PRECISION_MAXIMA))
    .sort((a, b) => a.t - b.t);

  const descartadosPorFiltro = (puntos || []).length - limpios.length;

  if (limpios.length < 2) {
    return { ...vacio, motivo: 'La traza necesita al menos dos puntos validos.', puntosDescartados: descartadosPorFiltro };
  }

  let distancia = 0;
  let saltos = 0;
  const velocidades = [];

  for (let i = 1; i < limpios.length; i++) {
    const a = limpios[i - 1], b = limpios[i];
    const dt = (b.t - a.t) / 1000; // segundos
    const d = haversine(a.lat, a.lon, b.lat, b.lon);
    if (dt <= 0) continue;

    const kmh = (d / dt) * 3.6;
    // Un salto imposible es error del sensor: se descarta el tramo entero,
    // no se promedia. Promediarlo contaminaria distancia y velocidad a la vez.
    if (kmh > VELOCIDAD_IMPOSIBLE) { saltos++; continue; }
    // Ruido en parado: por debajo de 0,5 km/h el GPS deriva sin que nadie ande.
    if (kmh < 0.5) continue;

    distancia += d;
    velocidades.push(kmh);
  }

  if (!velocidades.length) {
    return { ...vacio, motivo: 'No se detecto movimiento real en la traza.', puntosDescartados: descartadosPorFiltro + saltos };
  }

  const duracionSeg = (limpios[limpios.length - 1].t - limpios[0].t) / 1000;
  const distanciaKm = distancia / 1000;
  const duracionMin = duracionSeg / 60;
  const vMediana = mediana(velocidades);
  const vMaxima = Math.max(...velocidades);
  const vMedia = duracionSeg > 0 ? (distanciaKm / (duracionSeg / 3600)) : 0;

  return {
    valida: true,
    distanciaKm: Math.round(distanciaKm * 1000) / 1000,
    duracionMin: Math.round(duracionMin * 10) / 10,
    velocidadMedia: Math.round(vMedia * 10) / 10,
    velocidadMediana: Math.round(vMediana * 10) / 10,
    velocidadMaxima: Math.round(vMaxima * 10) / 10,
    modo: inferirModo(vMediana, vMaxima),
    puntosUsados: limpios.length,
    puntosDescartados: descartadosPorFiltro + saltos,
  };
}

/**
 * Deduce el modo de transporte del perfil de velocidades.
 * Devuelve tambien una confianza, porque los rangos se solapan: 10 km/h puede
 * ser una bici lenta o una carrera rapida, y fingir certeza seria deshonesto.
 */
export function inferirModo(mediana_, maxima) {
  const candidatos = PERFILES.filter(
    (p) => mediana_ >= p.minMediana && mediana_ <= p.maxMediana && maxima <= p.maxPico
  );
  if (!candidatos.length) {
    return { modo: null, etiqueta: 'No determinado', icono: '❓', confianza: 0,
      nota: 'El perfil de velocidad no encaja con ningun modo conocido.' };
  }
  // Con solapamiento, gana el modo cuya velocidad TIPICA esta mas cerca, no el
  // centro del rango: el centro es un artefacto de donde se trazaron los limites.
  // A 15 km/h ambos rangos encajan, pero eso es una bici tranquila y una carrera
  // de nivel casi profesional; la velocidad tipica recoge esa asimetria real.
  const elegido = candidatos.reduce((mejor, p) =>
    Math.abs(mediana_ - p.tipica) < Math.abs(mediana_ - mejor.tipica) ? p : mejor);
  const confianza = candidatos.length === 1 ? 0.9 : Math.round((1 / candidatos.length) * 100) / 100;
  return {
    modo: elegido.modo,
    etiqueta: elegido.etiqueta,
    icono: elegido.icono,
    confianza,
    nota: candidatos.length > 1
      ? `Compatible tambien con: ${candidatos.filter((c) => c !== elegido).map((c) => c.etiqueta).join(', ')}.`
      : '',
  };
}

/**
 * Seguimiento en vivo. Devuelve un controlador con detener() y estado actual.
 * No hace nada por su cuenta: quien llama decide cuando parar y que registrar.
 */
export function iniciarSeguimiento({ alActualizar = () => {} } = {}) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Este navegador no ofrece geolocalizacion.');
  }
  const puntos = [];
  let error = null;

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      puntos.push({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        t: pos.timestamp,
        precision: pos.coords.accuracy,
      });
      alActualizar(analizarTraza(puntos), puntos.length);
    },
    (err) => {
      error = err.code === 1
        ? 'Permiso de ubicacion denegado.'
        : 'No se pudo seguir la posicion.';
      alActualizar(analizarTraza(puntos), puntos.length, error);
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );

  return {
    detener() {
      navigator.geolocation.clearWatch(id);
      return { resumen: analizarTraza(puntos), puntos, error };
    },
    puntos,
  };
}

/**
 * Coherencia entre lo que la traza mide y lo que la persona quiere registrar.
 * Es el nucleo de la verificacion: no basta con tener GPS, hay que comprobar
 * que el GPS respalda ESA accion y ESA cantidad.
 */
export function verificarContra(resumen, accionId, cantidadDeclarada) {
  if (!resumen?.valida) {
    return { verificado: false, motivo: resumen?.motivo || 'Traza no valida.', cantidadSugerida: null };
  }
  const medida = resumen.distanciaKm;
  const declarada = Number(cantidadDeclarada);

  if (resumen.modo?.modo && resumen.modo.modo !== accionId && resumen.modo.confianza >= 0.9) {
    return {
      verificado: false,
      motivo: `La traza parece "${resumen.modo.etiqueta}" (mediana ${resumen.velocidadMediana} km/h), no la accion elegida.`,
      cantidadSugerida: medida,
    };
  }
  if (!Number.isFinite(declarada) || declarada <= 0) {
    return { verificado: true, motivo: '', cantidadSugerida: medida };
  }
  // Se tolera un 15 % de diferencia: el GPS tiene error propio y las trazas
  // urbanas se acortan bajo tuneles y edificios altos.
  const desvio = Math.abs(declarada - medida) / Math.max(medida, 0.001);
  if (desvio > 0.15) {
    return {
      verificado: false,
      motivo: `Has declarado ${declarada} km pero el GPS midio ${medida.toFixed(2)} km.`,
      cantidadSugerida: medida,
    };
  }
  return { verificado: true, motivo: '', cantidadSugerida: medida };
}
