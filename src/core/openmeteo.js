/**
 * openmeteo.js — Fuente de datos reales de calidad del aire.
 *
 * Se usa Open-Meteo (modelos CAMS de Copernicus y GEOS-CF de la NASA) por tres
 * razones concretas, no por costumbre:
 *   - No exige clave de API. Una clave en un sitio estatico es publica igualmente.
 *   - Permite CORS, asi que el navegador puede llamarla directamente. OpenAQ,
 *     la alternativa obvia, NO lo permite y obligaria a montar un servidor.
 *   - Cobertura mundial por coordenadas, no solo donde hay estacion oficial.
 *
 * DECISION DE DISENO: la API devuelve su propio `us_aqi`, pero NO se usa como
 * valor final. Se toman las concentraciones crudas y se pasan por el motor de
 * aire.js, que esta contrastado contra los tramos publicados por la EPA. La API
 * es una fuente de datos; la ciencia sigue siendo nuestra y verificable. Su
 * us_aqi se conserva solo para poder contrastar ambos calculos.
 */
import { calcularAQI, normalizarDesdeUgm3 } from './aire.js';

const BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';

/** Variables solicitadas. Open-Meteo las devuelve todas en ug/m3. */
const VARIABLES = [
  'pm10', 'pm2_5', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'us_aqi',
];

/** Correspondencia entre los nombres de Open-Meteo y los nuestros. */
const MAPA = Object.freeze({
  pm2_5: 'pm25',
  pm10: 'pm10',
  ozone: 'o3',
  nitrogen_dioxide: 'no2',
  sulphur_dioxide: 'so2',
  carbon_monoxide: 'co',
});

/** Vigencia de la cache: los modelos se actualizan cada hora. */
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map();

class ErrorAire extends Error {
  constructor(mensaje, codigo) { super(mensaje); this.codigo = codigo; }
}

async function pedirJSON(url, { timeoutMs = 12000 } = {}) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: control.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new ErrorAire(`El servicio respondio ${res.status}.`, res.status === 429 ? 'limite' : 'http');
    }
    const datos = await res.json();
    // Open-Meteo senala los errores con {error: true, reason: "..."}
    if (datos && datos.error) throw new ErrorAire(datos.reason || 'Peticion rechazada.', 'api');
    return datos;
  } catch (e) {
    if (e.name === 'AbortError') throw new ErrorAire('El servicio tardo demasiado en responder.', 'timeout');
    if (e instanceof ErrorAire) throw e;
    throw new ErrorAire('No se pudo conectar con el servicio de calidad del aire.', 'red');
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Consulta la calidad del aire de unas coordenadas.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{aqi:object, lecturas:object, crudas:object, meta:object}>}
 */
export async function consultarAire(lat, lon, { forzar = false } = {}) {
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
    throw new ErrorAire('Coordenadas no validas.', 'entrada');
  }

  const clave = `${la.toFixed(3)},${lo.toFixed(3)}`;
  const guardado = cache.get(clave);
  if (!forzar && guardado && Date.now() - guardado.momento < CACHE_MS) return guardado.datos;

  const url = `${BASE}?latitude=${la}&longitude=${lo}&current=${VARIABLES.join(',')}&timezone=auto`;
  const datos = await pedirJSON(url);

  const actual = datos.current;
  if (!actual || typeof actual !== 'object') {
    throw new ErrorAire('La respuesta no trae mediciones actuales.', 'formato');
  }

  // Concentraciones crudas en ug/m3, tal cual las publica la fuente.
  const crudas = {};
  for (const [origen, propio] of Object.entries(MAPA)) {
    const v = actual[origen];
    if (Number.isFinite(v)) crudas[propio] = v;
  }
  if (!Object.keys(crudas).length) {
    throw new ErrorAire('No hay datos de contaminantes para esta ubicacion.', 'sin_datos');
  }

  // Conversion a las unidades de los tramos de la EPA y calculo con nuestro motor.
  const lecturas = normalizarDesdeUgm3(crudas);
  const aqi = calcularAQI(lecturas);
  if (!aqi) throw new ErrorAire('No se pudo calcular el indice con los datos recibidos.', 'calculo');

  const resultado = {
    aqi,
    lecturas,
    crudas,
    meta: {
      lat: datos.latitude ?? la,
      lon: datos.longitude ?? lo,
      zona: datos.timezone || null,
      medidoEn: actual.time || null,
      elevacion: datos.elevation ?? null,
      aqiDeLaFuente: Number.isFinite(actual.us_aqi) ? actual.us_aqi : null,
      fuente: 'Open-Meteo (CAMS / GEOS-CF)',
      consultadoEn: new Date().toISOString(),
    },
  };

  cache.set(clave, { momento: Date.now(), datos: resultado });
  return resultado;
}

/** Pide la posicion del navegador. Requiere HTTPS y permiso del usuario. */
export function ubicacionActual({ timeoutMs = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new ErrorAire('Este navegador no ofrece geolocalizacion.', 'no_soportado'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, precision: pos.coords.accuracy }),
      (err) => {
        const motivos = {
          1: 'Has denegado el permiso de ubicacion. Puedes buscar tu ciudad a mano.',
          2: 'No se pudo determinar tu posicion.',
          3: 'La localizacion tardo demasiado.',
        };
        reject(new ErrorAire(motivos[err.code] || 'No se pudo obtener la ubicacion.', 'geo'));
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300000 }
    );
  });
}

/** Busca ciudades por nombre (geocodificacion de Open-Meteo, tambien sin clave). */
export async function buscarCiudad(nombre) {
  const q = String(nombre || '').trim();
  if (q.length < 2) return [];
  const url = `${GEO}?name=${encodeURIComponent(q)}&count=8&language=es&format=json`;
  const datos = await pedirJSON(url);
  return (datos.results || []).map((r) => ({
    nombre: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
    pais: r.country_code,
  }));
}

/** Ciudades de arranque rapido, con peso en Iberoamerica. */
export const CIUDADES = Object.freeze([
  { nombre: 'San Salvador', region: 'El Salvador', lat: 13.6929, lon: -89.2182, pais: 'SV' },
  { nombre: 'Guatemala', region: 'Guatemala', lat: 14.6349, lon: -90.5069, pais: 'GT' },
  { nombre: 'Tegucigalpa', region: 'Honduras', lat: 14.0723, lon: -87.1921, pais: 'HN' },
  { nombre: 'San Jose', region: 'Costa Rica', lat: 9.9281, lon: -84.0907, pais: 'CR' },
  { nombre: 'Ciudad de Mexico', region: 'Mexico', lat: 19.4326, lon: -99.1332, pais: 'MX' },
  { nombre: 'Bogota', region: 'Colombia', lat: 4.7110, lon: -74.0721, pais: 'CO' },
  { nombre: 'Lima', region: 'Peru', lat: -12.0464, lon: -77.0428, pais: 'PE' },
  { nombre: 'Santiago', region: 'Chile', lat: -33.4489, lon: -70.6693, pais: 'CL' },
  { nombre: 'Buenos Aires', region: 'Argentina', lat: -34.6037, lon: -58.3816, pais: 'AR' },
  { nombre: 'Sao Paulo', region: 'Brasil', lat: -23.5505, lon: -46.6333, pais: 'BR' },
  { nombre: 'Madrid', region: 'Espana', lat: 40.4168, lon: -3.7038, pais: 'ES' },
  { nombre: 'Nueva Delhi', region: 'India', lat: 28.6139, lon: 77.2090, pais: 'IN' },
]);

export { ErrorAire };
