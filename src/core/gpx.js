/**
 * gpx.js — Lectura de trazas exportadas desde cualquier aplicacion.
 *
 * Es la via de verificacion que funciona con TODOS los ecosistemas, incluidos
 * los que no ofrecen API web: Strava, Garmin, Komoot, Apple Salud y Google Fit
 * exportan GPX o TCX. La persona descarga su archivo y lo suelta aqui; el
 * analisis ocurre entero en el navegador y el archivo no sale del dispositivo.
 *
 * Se analiza con expresiones regulares en vez de DOMParser a proposito: asi el
 * modulo es puro, funciona igual en Node y en el navegador, y se puede probar
 * sin simular un DOM.
 */

/** Extrae los puntos de una traza GPX. */
export function parsearGPX(texto) {
  const xml = String(texto || '');
  const puntos = [];

  // <trkpt lat="..." lon="..."> ... </trkpt>  (tambien <rtept> y <wpt>)
  const re = /<(?:trkpt|rtept|wpt)\b[^>]*?\blat\s*=\s*"([-\d.]+)"[^>]*?\blon\s*=\s*"([-\d.]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/(?:trkpt|rtept|wpt)>)/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    const cuerpo = m[3] || '';
    const tiempo = cuerpo.match(/<time>([^<]+)<\/time>/i);
    puntos.push({
      lat,
      lon,
      t: tiempo ? new Date(tiempo[1]).getTime() : NaN,
      precision: 0,
    });
  }
  return puntos;
}

/** Extrae los puntos de un archivo TCX (Garmin). */
export function parsearTCX(texto) {
  const xml = String(texto || '');
  const puntos = [];
  const re = /<Trackpoint>([\s\S]*?)<\/Trackpoint>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const lat = b.match(/<LatitudeDegrees>([-\d.]+)<\/LatitudeDegrees>/i);
    const lon = b.match(/<LongitudeDegrees>([-\d.]+)<\/LongitudeDegrees>/i);
    const t = b.match(/<Time>([^<]+)<\/Time>/i);
    if (lat && lon) {
      puntos.push({
        lat: parseFloat(lat[1]),
        lon: parseFloat(lon[1]),
        t: t ? new Date(t[1]).getTime() : NaN,
        precision: 0,
      });
    }
  }
  return puntos;
}

/** Detecta el formato y devuelve los puntos, sea cual sea. */
export function parsearTraza(texto, nombreArchivo = '') {
  const t = String(texto || '');
  const esTCX = /<TrainingCenterDatabase|<Trackpoint>/i.test(t) || /\.tcx$/i.test(nombreArchivo);
  const puntos = esTCX ? parsearTCX(t) : parsearGPX(t);
  return {
    formato: esTCX ? 'TCX' : 'GPX',
    puntos,
    conTiempo: puntos.filter((p) => Number.isFinite(p.t)).length,
    total: puntos.length,
  };
}

/**
 * Metadatos utiles del archivo: nombre de la actividad y fecha.
 * Sirven para que el registro conserve de donde salio la prueba.
 */
export function metadatosTraza(texto) {
  const xml = String(texto || '');
  const nombre = xml.match(/<name>([^<]+)<\/name>/i);
  const primeraFecha = xml.match(/<time>([^<]+)<\/time>/i);
  const creador = xml.match(/\bcreator\s*=\s*"([^"]+)"/i);
  return {
    nombre: nombre ? nombre[1].trim() : null,
    fecha: primeraFecha ? primeraFecha[1] : null,
    aplicacion: creador ? creador[1] : null,
  };
}
