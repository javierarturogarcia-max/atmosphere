/**
 * evidencia.js — Credibilidad de las pruebas graficas.
 *
 * Aceptar una foto sin mas no verifica nada: cualquiera descarga una imagen de
 * internet. Lo que hace creible una prueba es lo que se puede COMPROBAR sobre
 * ella, y en el navegador se puede comprobar bastante:
 *
 *   1. Metadatos EXIF: cuando y donde se tomo realmente la foto.
 *   2. Frescura: una foto de hace dos anos no prueba lo que hiciste hoy.
 *   3. Coherencia geografica: si la foto se tomo a 800 km de ti, algo falla.
 *   4. Duplicados: la trampa mas comun es reenviar la misma foto una y otra vez.
 *      Se detecta con un hash perceptual, que sobrevive al reescalado y a la
 *      recompresion, cosas que un hash criptografico no toleraria.
 *
 * Todo el modulo es puro y sin DOM: recibe datos ya extraidos y decide. Asi es
 * testeable y la parte de navegador (canvas, camara) queda aislada en ui/medios.js.
 */

/** Tipos de medio admitidos y su credibilidad base. */
export const TIPOS = Object.freeze({
  foto: { etiqueta: 'Foto', icono: '📷', base: 1.10 },
  video: { etiqueta: 'Video', icono: '🎥', base: 1.25 },
});

/** Multiplicadores maximos por calidad de la prueba. */
export const NIVELES_EVIDENCIA = Object.freeze({
  ninguna:     { factor: 1.00, etiqueta: 'Sin evidencia',              color: '#94a3b8' },
  debil:       { factor: 1.10, etiqueta: 'Evidencia sin metadatos',    color: '#94a3b8' },
  fechada:     { factor: 1.25, etiqueta: 'Evidencia fechada',          color: '#38bdf8' },
  situada:     { factor: 1.40, etiqueta: 'Evidencia fechada y situada', color: '#34d399' },
  video:       { factor: 1.45, etiqueta: 'Video verificado',           color: '#c084fc' },
  sospechosa:  { factor: 1.00, etiqueta: 'Evidencia no valida',        color: '#f87171' },
});

/** Antiguedad maxima de una prueba para considerarla del momento: 24 h. */
export const FRESCURA_MS = 24 * 60 * 60 * 1000;

/** Distancia maxima entre la foto y la persona para considerarla coherente: 50 km. */
export const RADIO_COHERENTE_KM = 50;

/** Distancia de Hamming entre dos hashes hexadecimales de igual longitud. */
export function distanciaHamming(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/**
 * Hash perceptual medio (aHash) de una miniatura de 8x8 en escala de grises.
 * Cada bit dice si el pixel supera la media. Sobrevive a reescalados y cambios
 * de calidad, que es justo lo que hace falta para pillar una foto reenviada.
 * @param {number[]|Uint8ClampedArray} grises 64 valores de 0 a 255
 */
export function hashPercepcion(grises) {
  const v = Array.from(grises || []);
  if (v.length !== 64) return null;
  const media = v.reduce((s, x) => s + x, 0) / 64;
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) if (v[i + j] > media) nibble |= 1 << (3 - j);
    hex += nibble.toString(16);
  }
  return hex;
}

/** Dos imagenes se consideran la misma si difieren en 5 bits o menos de 64. */
export const UMBRAL_DUPLICADO = 5;

/** Busca un duplicado perceptual entre hashes ya registrados. */
export function buscarDuplicado(hash, previos = []) {
  if (!hash) return null;
  for (const p of previos) {
    const h = typeof p === 'string' ? p : p?.hash;
    if (!h) continue;
    const d = distanciaHamming(hash, h);
    if (d <= UMBRAL_DUPLICADO) return { hash: h, distancia: d, registroId: p?.registroId ?? null };
  }
  return null;
}

/** Distancia aproximada en km entre dos coordenadas (haversine). */
function kmEntre(lat1, lon1, lat2, lon2) {
  const R = 6371.0088, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Evalua una prueba y devuelve el multiplicador que merece.
 *
 * @param {object} p
 * @param {'foto'|'video'} p.tipo
 * @param {{fecha?:number, lat?:number, lon?:number, marca?:string}} [p.exif]
 * @param {number} [p.fechaArchivo] marca de tiempo del archivo (respaldo del EXIF)
 * @param {string} [p.hash] hash perceptual (solo fotos)
 * @param {Array} [p.hashesPrevios] hashes ya usados por este perfil
 * @param {number} [p.ahora] momento del registro
 * @param {{lat:number, lon:number}} [p.ubicacion] posicion declarada del usuario
 * @param {number} [p.bytes] tamano del archivo
 * @param {number} [p.ancho]
 * @param {number} [p.alto]
 */
export function evaluarEvidencia(p = {}) {
  const motivos = [];
  const ahora = p.ahora ?? Date.now();
  const tipo = TIPOS[p.tipo] ? p.tipo : null;

  if (!tipo) {
    return { nivel: 'ninguna', ...NIVELES_EVIDENCIA.ninguna, motivos: ['No se adjunto ninguna prueba.'], sospecha: 0, duplicado: null };
  }

  // --- Duplicado: descalifica antes que nada -------------------------------
  const duplicado = buscarDuplicado(p.hash, p.hashesPrevios);
  if (duplicado) {
    return {
      nivel: 'sospechosa', ...NIVELES_EVIDENCIA.sospechosa, duplicado, sospecha: 0.95,
      motivos: [`Esta imagen ya se uso en otro registro (diferencia de ${duplicado.distancia} bits de 64). No suma puntos extra.`],
    };
  }

  // --- Imagen demasiado pequena: probable miniatura descargada -------------
  if (p.tipo === 'foto' && Number.isFinite(p.ancho) && Number.isFinite(p.alto)
      && p.ancho > 0 && p.alto > 0 && p.ancho * p.alto < 160000) {
    motivos.push(`Resolucion baja (${p.ancho}x${p.alto}): las camaras actuales producen imagenes mucho mayores.`);
  }

  // --- Fecha: EXIF primero, marca del archivo como respaldo ---------------
  const fechaExif = Number.isFinite(p.exif?.fecha) ? p.exif.fecha : null;
  const fechaArchivo = Number.isFinite(p.fechaArchivo) ? p.fechaArchivo : null;
  const fecha = fechaExif ?? fechaArchivo;
  let fechada = false;

  if (fecha === null) {
    motivos.push('El archivo no conserva fecha de captura. Muchas apps de mensajeria la eliminan al reenviar.');
  } else {
    const edad = ahora - fecha;
    if (edad < -60 * 60 * 1000) {
      motivos.push('La fecha del archivo esta en el futuro.');
    } else if (edad > FRESCURA_MS) {
      const dias = Math.round(edad / 86400000);
      motivos.push(`La prueba es de hace ${dias} dia${dias === 1 ? '' : 's'}: no acredita una accion de hoy.`);
    } else {
      fechada = true;
      motivos.push(fechaExif !== null
        ? 'Tomada hoy segun los metadatos de la camara.'
        : 'Archivo creado hoy (sin metadatos de camara, se usa la fecha del archivo).');
    }
  }

  // --- Ubicacion: solo cuenta si viene del EXIF ---------------------------
  let situada = false;
  if (Number.isFinite(p.exif?.lat) && Number.isFinite(p.exif?.lon)) {
    if (Number.isFinite(p.ubicacion?.lat) && Number.isFinite(p.ubicacion?.lon)) {
      const d = kmEntre(p.exif.lat, p.exif.lon, p.ubicacion.lat, p.ubicacion.lon);
      if (d <= RADIO_COHERENTE_KM) {
        situada = true;
        motivos.push(`Coordenadas coherentes con tu ubicacion (${d.toFixed(1)} km de distancia).`);
      } else {
        motivos.push(`La foto se tomo a ${Math.round(d)} km de tu ubicacion declarada.`);
      }
    } else {
      situada = true;
      motivos.push('La foto conserva coordenadas GPS.');
    }
  }

  // --- Nivel resultante ----------------------------------------------------
  let nivel;
  if (p.tipo === 'video') {
    nivel = fechada ? 'video' : 'debil';
    if (fechada) motivos.push('Un video del momento es mucho mas costoso de falsificar que una foto.');
  } else if (fechada && situada) {
    nivel = 'situada';
  } else if (fechada) {
    nivel = 'fechada';
  } else {
    nivel = 'debil';
  }

  return {
    nivel, ...NIVELES_EVIDENCIA[nivel], motivos, duplicado: null,
    sospecha: nivel === 'debil' ? 0.15 : 0,
    detalle: { fechada, situada, tieneExif: fechaExif !== null, tipo: p.tipo },
  };
}

// ============================================================== lectura de EXIF

/** Etiquetas EXIF que interesan. */
const TAG = {
  MARCA: 0x010f, MODELO: 0x0110, ORIENTACION: 0x0112,
  PTR_EXIF: 0x8769, PTR_GPS: 0x8825,
  FECHA_ORIGINAL: 0x9003, FECHA_DIGITAL: 0x9004, FECHA: 0x0132,
  ANCHO: 0xa002, ALTO: 0xa003,
  GPS_LAT_REF: 0x0001, GPS_LAT: 0x0002, GPS_LON_REF: 0x0003, GPS_LON: 0x0004,
};

/** Bytes por componente segun el tipo EXIF. */
const TAM_TIPO = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

/**
 * Extrae los metadatos EXIF de un JPEG.
 * Implementado a mano para no arrastrar dependencias: son unas pocas decenas de
 * lineas y el formato lleva estable desde 1998.
 * @param {ArrayBuffer|Uint8Array} datos
 * @returns {{fecha:number|null, lat:number|null, lon:number|null, marca:string|null,
 *            modelo:string|null, ancho:number|null, alto:number|null}|null}
 */
export function leerEXIF(datos) {
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos || []);
  const vacio = { fecha: null, lat: null, lon: null, marca: null, modelo: null, ancho: null, alto: null };
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null; // no es JPEG

  // Recorre los segmentos hasta encontrar APP1 con cabecera "Exif\0\0".
  let i = 2;
  let inicioTIFF = -1;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marcador = bytes[i + 1];
    if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) { i += 2; continue; }
    if (marcador === 0xda || marcador === 0xd9) break; // inicio de imagen: ya no hay metadatos
    const largo = (bytes[i + 2] << 8) | bytes[i + 3];
    if (largo < 2) break;
    if (marcador === 0xe1 && i + 10 < bytes.length
        && bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78 && bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66) {
      inicioTIFF = i + 10;
      break;
    }
    i += 2 + largo;
  }
  if (inicioTIFF < 0 || inicioTIFF + 8 > bytes.length) return vacio;

  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const orden = String.fromCharCode(bytes[inicioTIFF], bytes[inicioTIFF + 1]);
  if (orden !== 'II' && orden !== 'MM') return vacio;
  const le = orden === 'II';
  const u16 = (o) => vista.getUint16(o, le);
  const u32 = (o) => vista.getUint32(o, le);

  if (u16(inicioTIFF + 2) !== 0x002a) return vacio;
  const offsetIFD0 = u32(inicioTIFF + 4);

  const salida = { ...vacio };
  const punteros = {};

  const leerValor = (offEntrada) => {
    const tipo = u16(offEntrada + 2);
    const cuenta = u32(offEntrada + 4);
    const tam = (TAM_TIPO[tipo] || 1) * cuenta;
    const off = tam > 4 ? inicioTIFF + u32(offEntrada + 8) : offEntrada + 8;
    if (off < 0 || off + tam > bytes.length) return null;

    if (tipo === 2) { // ASCII
      let s = '';
      for (let k = 0; k < cuenta; k++) {
        const c = bytes[off + k];
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s.trim();
    }
    if (tipo === 3) return cuenta === 1 ? u16(off) : Array.from({ length: cuenta }, (_, k) => u16(off + k * 2));
    if (tipo === 4) return cuenta === 1 ? u32(off) : Array.from({ length: cuenta }, (_, k) => u32(off + k * 4));
    if (tipo === 5) { // RATIONAL
      const r = Array.from({ length: cuenta }, (_, k) => {
        const num = u32(off + k * 8), den = u32(off + k * 8 + 4);
        return den === 0 ? 0 : num / den;
      });
      return cuenta === 1 ? r[0] : r;
    }
    return null;
  };

  const recorrerIFD = (offIFD, destino) => {
    const base = inicioTIFF + offIFD;
    if (base + 2 > bytes.length) return;
    const n = u16(base);
    if (n > 512) return; // proteccion frente a archivos corruptos
    for (let e = 0; e < n; e++) {
      const off = base + 2 + e * 12;
      if (off + 12 > bytes.length) return;
      destino[u16(off)] = leerValor(off);
    }
  };

  const ifd0 = {};
  recorrerIFD(offsetIFD0, ifd0);
  salida.marca = typeof ifd0[TAG.MARCA] === 'string' ? ifd0[TAG.MARCA] : null;
  salida.modelo = typeof ifd0[TAG.MODELO] === 'string' ? ifd0[TAG.MODELO] : null;
  punteros.exif = ifd0[TAG.PTR_EXIF];
  punteros.gps = ifd0[TAG.PTR_GPS];

  const exif = {};
  if (Number.isFinite(punteros.exif)) recorrerIFD(punteros.exif, exif);
  const cadenaFecha = exif[TAG.FECHA_ORIGINAL] || exif[TAG.FECHA_DIGITAL] || ifd0[TAG.FECHA];
  salida.fecha = parsearFechaEXIF(cadenaFecha);
  salida.ancho = Number.isFinite(exif[TAG.ANCHO]) ? exif[TAG.ANCHO] : null;
  salida.alto = Number.isFinite(exif[TAG.ALTO]) ? exif[TAG.ALTO] : null;

  const gps = {};
  if (Number.isFinite(punteros.gps)) recorrerIFD(punteros.gps, gps);
  salida.lat = gradosDesdeGPS(gps[TAG.GPS_LAT], gps[TAG.GPS_LAT_REF], 'S');
  salida.lon = gradosDesdeGPS(gps[TAG.GPS_LON], gps[TAG.GPS_LON_REF], 'W');

  return salida;
}

/** "2026:08:27 14:30:00" -> milisegundos. El EXIF usa dos puntos en la fecha. */
export function parsearFechaEXIF(cadena) {
  if (typeof cadena !== 'string') return null;
  const m = cadena.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Convierte [grados, minutos, segundos] + referencia a grados decimales. */
export function gradosDesdeGPS(dms, ref, negativo) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const [g, m, s] = dms.map(Number);
  if (![g, m, s].every(Number.isFinite)) return null;
  const grados = g + m / 60 + s / 3600;
  if (!Number.isFinite(grados) || Math.abs(grados) > 180) return null;
  return String(ref).toUpperCase().startsWith(negativo) ? -grados : grados;
}
