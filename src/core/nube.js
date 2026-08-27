/**
 * nube.js — Sincronizacion opcional con Supabase.
 *
 * ARQUITECTURA LOCAL-FIRST. El almacen del dispositivo sigue siendo la fuente
 * de verdad: la aplicacion funciona entera sin conexion y sin cuenta, igual que
 * antes. La nube es un espejo que se activa por decision explicita del usuario
 * y sirve para lo unico que no se puede hacer en local: comparar con personas
 * reales y no perder el historial al cambiar de dispositivo.
 *
 * SIN DEPENDENCIAS. Se habla directamente con la API REST de Supabase
 * (PostgREST + GoTrue) mediante fetch, en vez de instalar @supabase/supabase-js.
 * Son cuatro llamadas HTTP: la biblioteca pesaria mas que todo este modulo y
 * romperia el empaquetador de archivo unico.
 *
 * QUE SE ENVIA Y QUE NO:
 *   - Se envian registros de accion (accion, cantidad, impacto, puntos, fecha).
 *   - NO se envian fotos ni videos: las pruebas se quedan en el dispositivo.
 *   - NO se envian coordenadas ni trazas GPS.
 *   - Los registros son PRIVADOS en el servidor: al ranking solo llegan los
 *     totales agregados del perfil.
 */

const CLAVE_CONFIG = 'atmosphere.nube.config.v1';
const CLAVE_SESION = 'atmosphere.nube.sesion.v1';
const CLAVE_SUBIDOS = 'atmosphere.nube.subidos.v1';

const almacen = (() => {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* entorno sin almacenamiento */ }
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
})();

const leerJSON = (clave, porDefecto) => {
  try { const v = almacen.getItem(clave); return v ? JSON.parse(v) : porDefecto; } catch { return porDefecto; }
};
const guardarJSON = (clave, valor) => {
  try { almacen.setItem(clave, JSON.stringify(valor)); return true; } catch { return false; }
};

export class ErrorNube extends Error {
  constructor(mensaje, codigo = 'desconocido') { super(mensaje); this.codigo = codigo; }
}

// ============================================================== configuracion

/** Guarda la URL del proyecto y la clave anonima. */
export function configurar({ url, anonKey }) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  const k = String(anonKey || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(u)) {
    throw new ErrorNube('La URL debe tener la forma https://xxxxx.supabase.co', 'url');
  }
  if (k.length < 40) throw new ErrorNube('La clave anonima no parece valida.', 'clave');
  guardarJSON(CLAVE_CONFIG, { url: u, anonKey: k });
  return { url: u };
}

export function configuracion() { return leerJSON(CLAVE_CONFIG, null); }
export function estaConfigurada() { return !!configuracion(); }
export function sesion() { return leerJSON(CLAVE_SESION, null); }
export function haySesion() { const s = sesion(); return !!(s && s.access_token && s.perfilId); }

export function desconectar() {
  almacen.removeItem(CLAVE_SESION);
  almacen.removeItem(CLAVE_SUBIDOS);
}

export function olvidarTodo() {
  desconectar();
  almacen.removeItem(CLAVE_CONFIG);
}

// ================================================================== transporte

async function llamar(ruta, { metodo = 'GET', cuerpo = null, autenticado = true, cabeceras = {} } = {}) {
  const cfg = configuracion();
  if (!cfg) throw new ErrorNube('La nube no esta configurada.', 'sin_configurar');

  const s = sesion();
  const h = {
    apikey: cfg.anonKey,
    'Content-Type': 'application/json',
    ...cabeceras,
  };
  if (autenticado) {
    if (!s?.access_token) throw new ErrorNube('No has iniciado sesion.', 'sin_sesion');
    h.Authorization = `Bearer ${s.access_token}`;
  }

  let res;
  try {
    res = await fetch(`${cfg.url}${ruta}`, {
      method: metodo,
      headers: h,
      body: cuerpo === null ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorNube('Sin conexion con el servidor.', 'red');
  }

  if (res.status === 401 || res.status === 403) {
    throw new ErrorNube('La sesion ha caducado. Vuelve a entrar.', 'sesion_caducada');
  }
  const texto = await res.text();
  let datos = null;
  if (texto) { try { datos = JSON.parse(texto); } catch { datos = texto; } }

  if (!res.ok) {
    const msg = datos?.message || datos?.error_description || datos?.msg || `Error ${res.status}`;
    throw new ErrorNube(msg, res.status >= 500 ? 'servidor' : 'peticion');
  }
  return datos;
}

// ==================================================================== cuenta

export async function crearCuenta(email, contrasena, { nombre = 'Guardian', pais = 'WW' } = {}) {
  const datos = await llamar('/auth/v1/signup', {
    metodo: 'POST', autenticado: false,
    cuerpo: { email, password: contrasena, data: { nombre, pais } },
  });
  // Con confirmacion por correo activada, todavia no hay token.
  if (datos?.access_token) {
    guardarJSON(CLAVE_SESION, { access_token: datos.access_token, refresh_token: datos.refresh_token, perfilId: datos.user?.id, email });
    return { ok: true, confirmacionPendiente: false };
  }
  return { ok: true, confirmacionPendiente: true };
}

export async function entrar(email, contrasena) {
  const datos = await llamar('/auth/v1/token?grant_type=password', {
    metodo: 'POST', autenticado: false,
    cuerpo: { email, password: contrasena },
  });
  if (!datos?.access_token) throw new ErrorNube('Credenciales incorrectas.', 'credenciales');
  guardarJSON(CLAVE_SESION, {
    access_token: datos.access_token, refresh_token: datos.refresh_token,
    perfilId: datos.user?.id, email,
  });
  return { perfilId: datos.user?.id };
}

// ============================================================ sincronizacion

/**
 * Registros locales que aun no se han subido.
 * Funcion pura para poder probarla sin red.
 */
export function pendientesDeSubir(registrosLocales, idsSubidos) {
  const ya = new Set(idsSubidos || []);
  return (registrosLocales || []).filter((r) => r && r.id && !ya.has(r.id));
}

/**
 * Traduce un registro local a la fila que espera la base de datos.
 * Deja fuera a proposito la prueba grafica, la nota y cualquier coordenada:
 * al servidor solo va lo que necesita el ranking.
 */
export function aFilaRegistro(registro, categoria, perfilId) {
  return {
    id: registro.id,
    perfil_id: perfilId,
    accion_id: registro.accionId,
    categoria: categoria || 'otras',
    cantidad: Number(registro.cantidad) || 0,
    unidad: registro.unidad || 'ud',
    co2e: Number(registro.impacto?.co2e) || 0,
    agua: Number(registro.impacto?.agua) || 0,
    residuo: Number(registro.impacto?.residuo) || 0,
    puntos: Math.max(0, Math.round(Number(registro.puntos) || 0)),
    evidencia: registro.evidencia || null,
    nivel_evidencia: registro.medio?.nivel || null,
    fecha: registro.fecha,
  };
}

/** Divide una lista en lotes, para no enviar miles de filas de golpe. */
export function enLotes(items, tamano = 100) {
  const lotes = [];
  for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
  return lotes;
}

function idsSubidos() { return leerJSON(CLAVE_SUBIDOS, []); }
function marcarSubidos(ids) {
  guardarJSON(CLAVE_SUBIDOS, [...new Set([...idsSubidos(), ...ids])]);
}

/**
 * Sube los registros pendientes y devuelve el perfil recalculado por el servidor.
 * @param {Array} registros registros locales
 * @param {(id:string)=>string} categoriaDe funcion que da la categoria de una accion
 */
export async function sincronizar(registros, categoriaDe) {
  const s = sesion();
  if (!s?.perfilId) throw new ErrorNube('No has iniciado sesion.', 'sin_sesion');

  const pendientes = pendientesDeSubir(registros, idsSubidos());
  let subidos = 0;
  const rechazados = [];

  for (const lote of enLotes(pendientes, 100)) {
    const filas = lote.map((r) => aFilaRegistro(r, categoriaDe(r.accionId), s.perfilId));
    try {
      // merge-duplicates hace la subida idempotente: reenviar tras un corte de
      // red no duplica nada, porque la clave primaria es el id del dispositivo.
      await llamar('/rest/v1/registros', {
        metodo: 'POST', cuerpo: filas,
        cabeceras: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
      marcarSubidos(lote.map((r) => r.id));
      subidos += lote.length;
    } catch (e) {
      rechazados.push({ n: lote.length, motivo: e.message });
    }
  }

  const perfil = await miPerfil();
  return { subidos, pendientes: pendientes.length - subidos, rechazados, perfil };
}

/** Perfil propio, con los totales que ha calculado el servidor. */
export async function miPerfil() {
  const s = sesion();
  const filas = await llamar(`/rest/v1/perfiles?id=eq.${s.perfilId}&select=*`);
  return Array.isArray(filas) ? filas[0] || null : null;
}

/** Cambia los unicos campos que el cliente tiene permiso de escribir. */
export async function actualizarPerfil({ nombre, pais, publico }) {
  const s = sesion();
  const cambios = {};
  if (nombre !== undefined) cambios.nombre = nombre;
  if (pais !== undefined) cambios.pais = pais;
  if (publico !== undefined) cambios.publico = publico;
  if (!Object.keys(cambios).length) return null;
  return llamar(`/rest/v1/perfiles?id=eq.${s.perfilId}`, {
    metodo: 'PATCH', cuerpo: cambios, cabeceras: { Prefer: 'return=representation' },
  });
}

// ======================================================================= social

export async function rankingGlobal(limite = 50) {
  return llamar(`/rest/v1/ranking_global?select=*&limit=${Math.min(200, limite)}`);
}

export async function impactoComunidad() {
  const filas = await llamar('/rest/v1/impacto_comunidad?select=*');
  return Array.isArray(filas) ? filas[0] || null : null;
}

export async function misGrupos() {
  const s = sesion();
  return llamar(`/rest/v1/miembros?perfil_id=eq.${s.perfilId}&select=rol,unido,grupos(id,nombre,codigo,tipo)`);
}

export async function rankingGrupo(grupoId) {
  return llamar(`/rest/v1/ranking_grupos?grupo_id=eq.${grupoId}&select=*`);
}

/** Codigo de grupo legible: 6 caracteres sin los que se confunden (0/O, 1/I). */
export function generarCodigo(rnd = Math.random) {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += alfabeto[Math.floor(rnd() * alfabeto.length)];
  return c;
}

export async function crearGrupo(nombre, tipo = 'clase') {
  const s = sesion();
  const codigo = generarCodigo();
  const creado = await llamar('/rest/v1/grupos', {
    metodo: 'POST', cuerpo: { nombre, codigo, tipo, creador: s.perfilId },
    cabeceras: { Prefer: 'return=representation' },
  });
  const grupo = Array.isArray(creado) ? creado[0] : creado;
  await llamar('/rest/v1/miembros', {
    metodo: 'POST', cuerpo: { grupo_id: grupo.id, perfil_id: s.perfilId, rol: 'gestor' },
    cabeceras: { Prefer: 'return=minimal' },
  });
  return grupo;
}

export async function unirseAGrupo(codigo) {
  return llamar('/rest/v1/rpc/unirse_por_codigo', {
    metodo: 'POST', cuerpo: { p_codigo: String(codigo || '').toUpperCase().trim() },
  });
}

/**
 * Mezcla el ranking del servidor con el perfil propio y calcula la posicion.
 * Pura: se puede probar sin red.
 */
export function situarEnRanking(filas, miId) {
  const tabla = [...(filas || [])]
    .sort((a, b) => (b.puntos || 0) - (a.puntos || 0))
    .map((f, i) => ({ ...f, posicion: i + 1, esUsuario: f.id === miId }));
  const yo = tabla.find((f) => f.esUsuario) || null;
  const siguiente = yo && yo.posicion > 1 ? tabla[yo.posicion - 2] : null;
  return {
    tabla,
    posicion: yo?.posicion ?? null,
    total: tabla.length,
    faltanParaSubir: siguiente && yo ? Math.max(0, (siguiente.puntos || 0) - (yo.puntos || 0) + 1) : 0,
  };
}
