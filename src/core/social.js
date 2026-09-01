/**
 * social.js — Comunidad: publicaciones, me gusta y aura.
 *
 * DOS MONEDAS DISTINTAS, A PROPOSITO:
 *   puntos = impacto fisico medido (kg CO2e, litros, residuo)
 *   aura   = reconocimiento de la comunidad
 *
 * Separarlas evita el peor riesgo de una app ambiental con capa social: que un
 * video gracioso valga mas que plantar un arbol. Los puntos siguen saliendo
 * solo de la fisica; el aura mide otra cosa —contagiar el habito— y se muestra
 * aparte. Nunca se suman.
 *
 * El aura tampoco la escribe el cliente: la deriva el servidor de las
 * publicaciones y los me gusta, con los mismos candados que los puntos. Ni
 * auto-me-gusta, ni me gusta repetido, ni publicar sobre un registro ajeno.
 *
 * PRIVACIDAD: publicar es una decision explicita POR ACCION. La promesa de que
 * las pruebas no salen del dispositivo sigue en pie para todo lo demas; solo
 * viaja el medio de la accion concreta que la persona elige compartir.
 */
import { configuracion, sesion, llamarAPI, ErrorNube } from './nube.js';

/** Cubo de Supabase Storage donde viven los medios publicados. */
export const CUBO = 'evidencias';

/** Tamano maximo de un medio publicado. Un clip corto cabe de sobra. */
export const LIMITE_MB = 25;

/** Puntuacion de aura, identica a la del servidor (solo para previsualizar). */
export const AURA = Object.freeze({
  porPublicar: 8,
  porMeGusta: 2,
  porEvidenciaVerificada: 5,
});

const VERIFICADOS = ['fechada', 'situada', 'video'];

/** Aura que produciria una publicacion. El valor real lo calcula Postgres. */
export function auraDe({ likes = 0, nivelEvidencia = null } = {}) {
  return AURA.porPublicar
    + AURA.porMeGusta * Math.max(0, likes)
    + (VERIFICADOS.includes(nivelEvidencia) ? AURA.porEvidenciaVerificada : 0);
}

/**
 * Valida un mote antes de gastar una peticion.
 * Minusculas, digitos y guion bajo; de 3 a 15. Sin mayusculas ni acentos para
 * que sea inequivoco al dictarlo y no existan dos motes visualmente iguales.
 */
export function validarMote(mote) {
  const m = String(mote || '').trim().toLowerCase();
  if (!m) return { ok: false, motivo: 'Escribe un mote.' };
  if (m.length < 3) return { ok: false, motivo: 'Mínimo 3 caracteres.' };
  if (m.length > 15) return { ok: false, motivo: 'Máximo 15 caracteres.' };
  if (!/^[a-z0-9_]+$/.test(m)) {
    return { ok: false, motivo: 'Solo letras sin acentos, números y guion bajo.' };
  }
  return { ok: true, mote: m };
}

/** Extension del archivo a partir de su tipo MIME. */
export function extensionDe(tipoMime) {
  const mapa = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  };
  return mapa[String(tipoMime || '').toLowerCase()] || (String(tipoMime).startsWith('video/') ? 'mp4' : 'jpg');
}

/** Ruta dentro del cubo: cada quien escribe solo en su carpeta (su uuid). */
export function rutaMedio(perfilId, tipoMime) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${perfilId}/${id}.${extensionDe(tipoMime)}`;
}

/** URL publica de un medio ya subido. */
export function urlMedio(ruta) {
  const cfg = configuracion();
  if (!cfg || !ruta) return null;
  return `${cfg.url}/storage/v1/object/public/${CUBO}/${encodeURI(ruta)}`;
}

/**
 * Sube un medio al almacen. No pasa por llamarAPI porque el cuerpo es binario
 * y la cabecera Content-Type debe ser la del propio archivo, no JSON.
 */
export async function subirMedio(blob) {
  const cfg = configuracion();
  const s = sesion();
  if (!cfg) throw new ErrorNube('La nube no esta configurada.', 'sin_configurar');
  if (!s?.access_token) throw new ErrorNube('No has iniciado sesion.', 'sin_sesion');
  if (!blob || !blob.size) throw new ErrorNube('No hay archivo que subir.', 'entrada');
  if (blob.size > LIMITE_MB * 1048576) {
    throw new ErrorNube(`El archivo pesa ${(blob.size / 1048576).toFixed(1)} MB y el limite es ${LIMITE_MB} MB.`, 'tamano');
  }

  const ruta = rutaMedio(s.perfilId, blob.type);
  let res;
  try {
    res = await fetch(`${cfg.url}/storage/v1/object/${CUBO}/${ruta}`, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${s.access_token}`,
        'Content-Type': blob.type || 'application/octet-stream',
        'x-upsert': 'false',
      },
      body: blob,
    });
  } catch {
    throw new ErrorNube('No se pudo subir el archivo.', 'red');
  }
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new ErrorNube(diagnosticoAlmacen(res.status, texto), 'almacen');
  }
  return ruta;
}

/**
 * Traduce el rechazo del almacen a algo que se pueda arreglar.
 *
 * Los dos fallos habituales no son del codigo sino de la instalacion, porque
 * el guion de la base de datos omite el cubo o sus politicas cuando el rol del
 * editor SQL no es dueno de storage.objects. Sin este mensaje, lo que ve la
 * persona es un numero y un texto en ingles del servidor.
 *
 * @param {number} estado codigo HTTP
 * @param {string} texto cuerpo de la respuesta
 * @returns {string} mensaje con el siguiente paso concreto
 */
export function diagnosticoAlmacen(estado, texto) {
  const t = String(texto || '').toLowerCase();
  if (estado === 404 || t.includes('bucket not found')) {
    return 'Falta el cubo "evidencias" en tu proyecto. Crealo en Supabase: '
         + 'Storage -> New bucket -> nombre "evidencias", marca Public bucket.';
  }
  if (estado === 403 || estado === 400 || t.includes('row-level security') || t.includes('unauthorized')) {
    return 'El almacen existe pero le faltan las politicas de acceso. '
         + 'Ponlas en Supabase: Storage -> Policies sobre el cubo "evidencias" '
         + '(estan copiadas en db/INSTALACION.md).';
  }
  return `El almacen rechazo el archivo (${estado}). ${String(texto || '').slice(0, 120)}`;
}

/**
 * Publica una accion en el muro.
 * @param {object} registro registro local ya sincronizado
 * @param {Blob} blob foto o video de la accion
 * @param {{descripcion?:string, categoria?:string}} extra
 */
export async function publicar(registro, blob, { descripcion = '', categoria = 'otras' } = {}) {
  const s = sesion();
  if (!s?.perfilId) throw new ErrorNube('No has iniciado sesion.', 'sin_sesion');

  const ruta = await subirMedio(blob);
  const fila = {
    perfil_id: s.perfilId,
    registro_id: registro.id,
    accion_id: registro.accionId,
    categoria,
    descripcion: String(descripcion || '').slice(0, 200),
    ruta_medio: ruta,
    tipo_medio: (blob.type || '').startsWith('video/') ? 'video' : 'foto',
    nivel_evidencia: registro.medio?.nivel || null,
    co2e: Number(registro.impacto?.co2e) || 0,
    puntos: Math.max(0, Math.round(Number(registro.puntos) || 0)),
  };
  const creado = await llamarAPI('/rest/v1/publicaciones', {
    metodo: 'POST', cuerpo: fila, cabeceras: { Prefer: 'return=representation' },
  });
  return Array.isArray(creado) ? creado[0] : creado;
}

export async function borrarPublicacion(id) {
  return llamarAPI(`/rest/v1/publicaciones?id=eq.${id}`, { metodo: 'DELETE' });
}

/** Muro: lo mas reciente de toda la comunidad. */
export async function muro(limite = 30, desde = 0) {
  return llamarAPI(`/rest/v1/muro?select=*&limit=${Math.min(60, limite)}&offset=${Math.max(0, desde)}`);
}

/** Virales: lo mas gustado de los ultimos siete dias. */
export async function virales() {
  return llamarAPI('/rest/v1/virales?select=*');
}

/** Publicaciones de un perfil concreto, para su pagina publica. */
export async function publicacionesDe(perfilId) {
  return llamarAPI(`/rest/v1/muro?perfil_id=eq.${perfilId}&select=*`);
}

/** Identificadores de las publicaciones a las que YA di me gusta. */
export async function misMeGusta() {
  const s = sesion();
  if (!s?.perfilId) return new Set();
  const filas = await llamarAPI(`/rest/v1/megusta?perfil_id=eq.${s.perfilId}&select=publicacion_id`);
  return new Set((filas || []).map((f) => f.publicacion_id));
}

export async function darMeGusta(publicacionId) {
  const s = sesion();
  return llamarAPI('/rest/v1/megusta', {
    metodo: 'POST',
    cuerpo: { publicacion_id: publicacionId, perfil_id: s.perfilId },
    cabeceras: { Prefer: 'return=minimal' },
  });
}

export async function quitarMeGusta(publicacionId) {
  const s = sesion();
  return llamarAPI(`/rest/v1/megusta?publicacion_id=eq.${publicacionId}&perfil_id=eq.${s.perfilId}`,
    { metodo: 'DELETE' });
}

/** Alterna el me gusta y devuelve el estado resultante. */
export async function alternarMeGusta(publicacionId, teGusta) {
  if (teGusta) { await quitarMeGusta(publicacionId); return false; }
  await darMeGusta(publicacionId);
  return true;
}

export async function reportar(publicacionId, motivo = 'inapropiado') {
  const s = sesion();
  return llamarAPI('/rest/v1/reportes', {
    metodo: 'POST',
    cuerpo: { publicacion_id: publicacionId, perfil_id: s.perfilId, motivo },
    cabeceras: { Prefer: 'return=minimal' },
  });
}

/** Fija el mote publico. El servidor rechaza duplicados con un error propio. */
export async function fijarMote(mote) {
  const v = validarMote(mote);
  if (!v.ok) throw new ErrorNube(v.motivo, 'mote');
  const s = sesion();
  try {
    await llamarAPI(`/rest/v1/perfiles?id=eq.${s.perfilId}`, {
      metodo: 'PATCH', cuerpo: { mote: v.mote }, cabeceras: { Prefer: 'return=minimal' },
    });
  } catch (e) {
    if (/duplicate|unique|23505/i.test(e.message)) {
      throw new ErrorNube(`El mote "${v.mote}" ya esta cogido. Prueba otro.`, 'mote_ocupado');
    }
    throw e;
  }
  return v.mote;
}

/** Ranking por aura: quien mas contagia el habito. */
export async function rankingAura(limite = 30) {
  return llamarAPI(
    `/rest/v1/perfiles?publico=eq.true&aura=gt.0&select=id,nombre,mote,aura,puntos,nivel,co2e_total`
    + `&order=aura.desc&limit=${Math.min(60, limite)}`);
}

/** Tiempo transcurrido en formato corto, para las tarjetas del muro. */
export function haceRato(iso) {
  const seg = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(seg) || seg < 0) return '';
  if (seg < 60) return 'ahora';
  if (seg < 3600) return `${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `${Math.floor(seg / 3600)} h`;
  if (seg < 604800) return `${Math.floor(seg / 86400)} d`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
