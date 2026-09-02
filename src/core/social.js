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
  porPublicarSinMedio: 3,
  porMeGusta: 2,
  porEvidenciaVerificada: 5,
});

const VERIFICADOS = ['fechada', 'situada', 'video', 'envivo'];

/**
 * Aura que produciria una publicacion. El valor real lo calcula Postgres; esto
 * solo sirve para ensenarlo antes de pulsar.
 */
export function auraDe({ likes = 0, nivelEvidencia = null, conMedio = true } = {}) {
  return (conMedio ? AURA.porPublicar : AURA.porPublicarSinMedio)
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

  // El medio es OPCIONAL. Exigirlo dejaba fuera casi todo lo que se registra
  // —beber agua del grifo, ir en bus, apagar el aire— y el espacio de cada
  // persona salia medio vacio no por falta de acciones sino por falta de camara.
  const ruta = blob ? await subirMedio(blob) : null;
  const fila = {
    perfil_id: s.perfilId,
    registro_id: registro.id,
    accion_id: registro.accionId,
    categoria,
    descripcion: String(descripcion || '').slice(0, 200),
    ruta_medio: ruta,
    tipo_medio: blob ? ((blob.type || '').startsWith('video/') ? 'video' : 'foto') : null,
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

/** Publicaciones de un perfil concreto, de lo mas reciente a lo mas antiguo. */
export async function publicacionesDe(perfilId, limite = 60) {
  return llamarAPI(
    `/rest/v1/muro?perfil_id=eq.${perfilId}&select=*&limit=${Math.min(120, limite)}`);
}

/**
 * El espacio de una persona: su ficha y todo lo que ha publicado.
 *
 * Se busca por MOTE porque es lo que se ve y lo que se dice en voz alta; el
 * identificador interno no lo conoce nadie. Si el perfil no es publico, la RLS
 * no devuelve la ficha y aqui se traduce a un mensaje en vez de a una pantalla
 * en blanco.
 *
 * @param {string} mote sin la arroba
 */
export async function espacioDe(mote) {
  const m = String(mote || '').trim().toLowerCase();
  if (!m) throw new ErrorNube('Falta el mote.', 'entrada');
  const fichas = await llamarAPI(
    `/rest/v1/perfiles?mote=eq.${encodeURIComponent(m)}`
    + '&select=id,nombre,mote,avatar,aura,puntos,nivel,co2e_total,registros_n,dias_activos,pais,creado');
  const ficha = fichas?.[0];
  if (!ficha) {
    throw new ErrorNube(
      `No hay ningun espacio en @${m}, o su perfil no es publico.`, 'no_encontrado');
  }
  return { ficha, publicaciones: await publicacionesDe(ficha.id) };
}

/** Mi propio espacio, sin tener que saberme el mote. */
export async function miEspacio() {
  const s = sesion();
  if (!s?.perfilId) throw new ErrorNube('No has iniciado sesion.', 'sin_sesion');
  const fichas = await llamarAPI(
    `/rest/v1/perfiles?id=eq.${s.perfilId}`
    + '&select=id,nombre,mote,avatar,aura,puntos,nivel,co2e_total,registros_n,dias_activos,pais,creado');
  const ficha = fichas?.[0];
  if (!ficha) throw new ErrorNube('Tu perfil todavia no esta en la nube.', 'no_encontrado');
  return { ficha, publicaciones: await publicacionesDe(ficha.id), esMio: true };
}

/** Identificadores de las publicaciones a las que YA di me gusta. */
/**
 * Reacciones posibles.
 *
 * TODAS VALEN LO MISMO EN AURA, y no es un descuido. Si el corazon puntuara mas
 * que el me gusta, la gente elegiria por lo que suma y no por lo que siente, y
 * el dato dejaria de decir nada sobre la publicacion. Lo que cambia es el
 * matiz que se expresa, no el precio.
 */
export const REACCIONES = Object.freeze([
  { tipo: 'me_gusta',   icono: '👍', etiqueta: 'Me gusta' },
  { tipo: 'me_encanta', icono: '😍', etiqueta: 'Me encanta' },
  { tipo: 'corazon',    icono: '❤️', etiqueta: 'Corazón' },
  { tipo: 'aplauso',    icono: '👏', etiqueta: 'Bien hecho' },
  { tipo: 'inspira',    icono: '🌱', etiqueta: 'Me inspira' },
]);

export const TIPOS_REACCION = Object.freeze(REACCIONES.map((r) => r.tipo));

/** Datos de una reaccion por su tipo, con respaldo si llega uno desconocido. */
export function reaccion(tipo) {
  return REACCIONES.find((r) => r.tipo === tipo) || REACCIONES[0];
}

/** Mis reacciones, como mapa publicacion -> tipo. */
export async function misReacciones() {
  const s = sesion();
  if (!s?.perfilId) return new Map();
  const filas = await llamarAPI(
    `/rest/v1/megusta?perfil_id=eq.${s.perfilId}&select=publicacion_id,tipo`);
  return new Map((filas || []).map((f) => [f.publicacion_id, f.tipo || 'me_gusta']));
}

/** Compatibilidad: solo el conjunto de publicaciones a las que reaccione. */
export async function misMeGusta() {
  return new Set((await misReacciones()).keys());
}

export async function darMeGusta(publicacionId, tipo = 'me_gusta') {
  const s = sesion();
  return llamarAPI('/rest/v1/megusta', {
    metodo: 'POST',
    cuerpo: { publicacion_id: publicacionId, perfil_id: s.perfilId, tipo: normalizar(tipo) },
    cabeceras: { Prefer: 'return=minimal' },
  });
}

/** Cambia el matiz sin quitar y volver a poner: el aura no parpadea. */
export async function cambiarReaccion(publicacionId, tipo) {
  const s = sesion();
  return llamarAPI(
    `/rest/v1/megusta?publicacion_id=eq.${publicacionId}&perfil_id=eq.${s.perfilId}`, {
      metodo: 'PATCH', cuerpo: { tipo: normalizar(tipo) },
      cabeceras: { Prefer: 'return=minimal' },
    });
}

export async function quitarMeGusta(publicacionId) {
  const s = sesion();
  return llamarAPI(`/rest/v1/megusta?publicacion_id=eq.${publicacionId}&perfil_id=eq.${s.perfilId}`,
    { metodo: 'DELETE' });
}

function normalizar(tipo) {
  return TIPOS_REACCION.includes(tipo) ? tipo : 'me_gusta';
}

/**
 * Aplica una reaccion y devuelve el tipo resultante, o null si se retiro.
 *
 * Pulsar la misma que ya tenias la quita; pulsar otra la cambia. Es el gesto
 * que la gente ya conoce, y evita el estado raro de "reaccione dos veces".
 *
 * @param {string} publicacionId
 * @param {string|null} actual la reaccion que ya tenias, o null
 * @param {string} elegida
 * @returns {Promise<string|null>}
 */
export async function aplicarReaccion(publicacionId, actual, elegida) {
  const nueva = normalizar(elegida);
  if (actual === nueva) { await quitarMeGusta(publicacionId); return null; }
  if (actual) { await cambiarReaccion(publicacionId, nueva); return nueva; }
  await darMeGusta(publicacionId, nueva);
  return nueva;
}

/** Compatibilidad con el alternar simple de antes. */
export async function alternarMeGusta(publicacionId, teGusta) {
  return (await aplicarReaccion(publicacionId, teGusta ? 'me_gusta' : null, 'me_gusta')) !== null;
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

/**
 * Sube la foto de perfil y la deja apuntada en el perfil.
 *
 * Va al mismo cubo que las pruebas y bajo la carpeta del propio perfil, asi que
 * la reutiliza la politica que ya existe: cada quien escribe solo en lo suyo.
 * En la fila se guarda la RUTA, no la imagen: meter la foto en el perfil la
 * haria viajar entera en cada consulta del ranking y del muro.
 *
 * @param {Blob} blob imagen ya reescalada
 * @returns {Promise<string>} ruta dentro del cubo
 */
export async function subirAvatar(blob) {
  const s = sesion();
  if (!s?.perfilId) throw new ErrorNube('No has iniciado sesion.', 'sin_sesion');
  const anterior = (await llamarAPI(
    `/rest/v1/perfiles?id=eq.${s.perfilId}&select=avatar`))?.[0]?.avatar || null;

  const ruta = await subirMedio(blob);
  await llamarAPI(`/rest/v1/perfiles?id=eq.${s.perfilId}`, {
    metodo: 'PATCH', cuerpo: { avatar: ruta }, cabeceras: { Prefer: 'return=minimal' },
  });

  // La anterior se borra DESPUES de apuntar la nueva. Al reves, un corte de red
  // en medio dejaria el perfil apuntando a un archivo que ya no existe.
  if (anterior && anterior !== ruta) await borrarMedioAlmacen(anterior).catch(() => {});
  return ruta;
}

/** Quita la foto del perfil y borra el archivo. */
export async function quitarAvatar() {
  const s = sesion();
  if (!s?.perfilId) throw new ErrorNube('No has iniciado sesion.', 'sin_sesion');
  const anterior = (await llamarAPI(
    `/rest/v1/perfiles?id=eq.${s.perfilId}&select=avatar`))?.[0]?.avatar || null;
  await llamarAPI(`/rest/v1/perfiles?id=eq.${s.perfilId}`, {
    metodo: 'PATCH', cuerpo: { avatar: null }, cabeceras: { Prefer: 'return=minimal' },
  });
  if (anterior) await borrarMedioAlmacen(anterior).catch(() => {});
}

/** Borra un archivo del cubo. La politica solo deja borrar lo propio. */
async function borrarMedioAlmacen(ruta) {
  const cfg = configuracion();
  const s = sesion();
  if (!cfg || !s?.access_token || !ruta) return;
  await fetch(`${cfg.url}/storage/v1/object/${CUBO}/${encodeURI(ruta)}`, {
    method: 'DELETE',
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${s.access_token}` },
  });
}

/**
 * Mote reservado durante un alta que quedo pendiente de confirmar el correo.
 *
 * Cuando el proyecto exige confirmacion, el alta no devuelve sesion y todavia
 * no hay perfil al que ponerle el mote. Guardarlo aqui evita que la persona
 * tenga que acordarse de volver a elegirlo tres dias despues, cuando por fin
 * abra el correo.
 */
const CLAVE_MOTE_PENDIENTE = 'atmosphere.mote.pendiente.v1';

/**
 * Respaldo en memoria cuando no hay localStorage: navegacion privada, ajustes
 * que bloquean el almacenamiento, o Node durante las pruebas. Sin esto, el
 * mote reservado se perdia en silencio justo para quien mas cuesta recuperar.
 */
const almacen = (() => {
  try {
    if (typeof localStorage !== 'undefined') {
      const sonda = '__atmosphere__';
      localStorage.setItem(sonda, '1');
      localStorage.removeItem(sonda);
      return localStorage;
    }
  } catch { /* bloqueado: se usa el respaldo */ }
  const mapa = new Map();
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
  };
})();

export function guardarMotePendiente(mote) {
  try {
    if (mote) almacen.setItem(CLAVE_MOTE_PENDIENTE, String(mote));
    else almacen.removeItem(CLAVE_MOTE_PENDIENTE);
  } catch { /* sin almacenamiento */ }
}

export function motePendiente() {
  try { return almacen.getItem(CLAVE_MOTE_PENDIENTE) || null; } catch { return null; }
}

/**
 * Quien ya esta dentro, para ensenarlo en la portada A QUIEN AUN NO TIENE
 * CUENTA. Va contra la vista publica ranking_global y sin token, porque en ese
 * momento no hay sesion: una portada de app social que no ensena a nadie no
 * invita a entrar.
 *
 * Si el proyecto no le ha dado permiso de lectura al rol anonimo, esto falla y
 * la portada lo asume sin romperse: es un adorno, no un requisito.
 */
export async function vecindario(limite = 8) {
  return llamarAPI('/rest/v1/rpc/vecindario', {
    metodo: 'POST', autenticado: false, cuerpo: { n: Math.min(20, Math.max(1, limite)) },
  });
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
