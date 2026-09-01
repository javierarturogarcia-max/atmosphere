/**
 * bienvenida.js — La puerta de entrada.
 *
 * Antes, para tener cuenta habia que ir a "Nube y grupos", pegar una URL, pegar
 * una clave y despues crear la cuenta. Eso funciona para quien construyo la
 * app y para nadie mas: a la companera a la que le pasas el enlace le aparecia
 * un formulario de configuracion donde esperaba un "crear cuenta".
 *
 * Aqui el orden es el de cualquier aplicacion social: se ve quien hay dentro,
 * se elige un mote y se entra. La configuracion tecnica sigue existiendo, pero
 * en Perfil y para quien la necesite.
 */
import { el, toast, esc } from '../componentes.js';
import * as api from '../../core/nube.js';
import * as social from '../../core/social.js';
import { paisesOrdenados } from '../../data/paises.js';

/** Sugiere un mote a partir del nombre: "Ana Garcia" -> "ana_garcia". */
export function moteSugerido(nombre) {
  const limpio = String(nombre || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (limpio.length <= 15) return limpio.length >= 3 ? limpio : '';

  // Recortar a 15 a pelo parte la ultima palabra por la mitad ("jose_maria_nune").
  // Se corta por el ultimo guion bajo que quepa, si lo que queda sigue siendo
  // un mote valido; solo si no lo hay se recorta a secas.
  const corte = limpio.slice(0, 15);
  const enPalabra = corte.slice(0, corte.lastIndexOf('_'));
  const base = enPalabra.length >= 3 ? enPalabra : corte.replace(/_+$/, '');
  return base.length >= 3 ? base : '';
}

/**
 * Mensaje humano para un fallo de alta o de entrada.
 *
 * GoTrue responde en ingles y con matices que no ayudan a nadie ("Invalid
 * login credentials" cuando el correo no esta confirmado, por ejemplo). Sin
 * esta traduccion, el primer tropiezo de alguien que se acaba de registrar es
 * un mensaje que no le dice que hacer.
 */
export function mensajeDeAcceso(error) {
  const m = String(error?.message || error || '').toLowerCase();
  if (/already registered|already been registered|user already/.test(m)) {
    return { texto: 'Ese correo ya tiene cuenta. Entra con tu contraseña.', ir: 'entrar' };
  }
  if (/invalid login|invalid credentials|credenciales/.test(m)) {
    return { texto: 'Correo o contraseña incorrectos. Si acabas de registrarte, confirma antes el correo que te enviamos.' };
  }
  if (/email not confirmed|not confirmed/.test(m)) {
    return { texto: 'Te falta confirmar el correo. Busca el mensaje de Supabase en tu bandeja (y en spam).' };
  }
  if (/password.*(6|short|least)/.test(m)) {
    return { texto: 'La contraseña necesita al menos 6 caracteres.' };
  }
  if (/rate limit|too many/.test(m)) {
    return { texto: 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.' };
  }
  if (/failed to fetch|network|red/.test(m)) {
    return { texto: 'No se pudo contactar con el servidor. Revisa tu conexión.' };
  }
  return { texto: String(error?.message || 'No se pudo completar la operación.') };
}

// ---------------------------------------------------------------- la vista

export function vistaBienvenida(ctx) {
  const raiz = el('div', { clase: 'bienvenida' });
  let modo = api.haySesion() ? 'dentro' : 'inicio';

  const pintar = () => {
    raiz.innerHTML = '';
    if (modo === 'dentro') raiz.appendChild(panelDentro(ctx, () => { modo = 'inicio'; pintar(); }));
    else if (modo === 'crear') raiz.appendChild(formulario(ctx, 'crear', ir));
    else if (modo === 'entrar') raiz.appendChild(formulario(ctx, 'entrar', ir));
    else raiz.appendChild(portada(ctx, ir));
  };
  const ir = (m) => { modo = m; pintar(); };

  pintar();
  return raiz;
}

// ------------------------------------------------------------------ portada

function portada(ctx, ir) {
  const caja = el('div');

  caja.appendChild(el('div', { clase: 'tarjeta centrado hero-bienvenida' }, [
    el('div', { estilo: 'font-size:60px;line-height:1', texto: '🌍' }),
    el('h1', { estilo: 'margin:14px 0 6px;font-size:30px', texto: 'Bienvenida a Atmosphere' }),
    el('p', { clase: 'sub', estilo: 'max-width:44ch;margin:0 auto 20px' },
      ['Convierte lo que ya haces bien por el planeta en impacto medido — y en algo que se comparte.']),
    el('div', { clase: 'fila centrada envuelve' }, [
      el('button', { clase: 'btn primario grande', texto: '✨ Crear mi cuenta', onclick: () => ir('crear') }),
      el('button', { clase: 'btn grande', texto: 'Ya tengo cuenta', onclick: () => ir('entrar') }),
    ]),
    el('button', {
      clase: 'btn plano s', estilo: 'margin-top:14px',
      texto: 'Explorar sin cuenta →',
      onclick: () => { marcarVisto(); ctx.ir('panel'); ctx.ajusteLocal?.(); },
    }),
  ]));

  caja.appendChild(el('div', { clase: 'rejilla c3', estilo: 'margin-top:16px' }, [
    reclamo('🎬', 'Un muro de buenas acciones', 'Graba un clip corto de lo que haces y llega a la comunidad.'),
    reclamo('🔥', 'Farmea aura', 'Los me gusta dan aura: reputación por hacer las cosas, no por decirlas.'),
    reclamo('🔬', 'Con ciencia detrás', 'Cada acción se mide en kg de CO₂e evitados, con su fuente citada.'),
  ]));

  caja.appendChild(quienHay());
  return caja;
}

function reclamo(icono, titulo, texto) {
  return el('div', { clase: 'tarjeta' }, [
    el('div', { estilo: 'font-size:26px', texto: icono }),
    el('h3', { estilo: 'margin:8px 0 4px;font-size:15px', texto: titulo }),
    el('p', { clase: 'mini', texto }),
  ]);
}

/**
 * Quien ya esta dentro. Una app social vacia no invita a entrar; ver caras
 * —aunque sean motes— es lo que convierte un formulario en una comunidad.
 */
function quienHay() {
  const caja = el('div', { clase: 'tarjeta', estilo: 'margin-top:16px' });
  caja.appendChild(el('h3', { estilo: 'margin:0 0 10px;font-size:15px', texto: '🌱 Ya están dentro' }));
  const lista = el('div', { clase: 'mini', texto: 'Cargando…' });
  caja.appendChild(lista);

  social.vecindario(8).then((filas) => {
    lista.innerHTML = '';
    if (!filas?.length) {
      lista.appendChild(el('p', { clase: 'mini',
        texto: 'Nadie todavía. Puedes ser la primera persona en publicar algo.' }));
      return;
    }
    lista.appendChild(el('div', { clase: 'fila-avatares' },
      filas.map((f) => el('div', { clase: 'avatar-chip', title: `${f.puntos || 0} puntos` }, [
        el('span', { clase: 'avatar-inicial', texto: (f.mote || f.nombre || '?').slice(0, 1).toUpperCase() }),
        el('span', { texto: f.mote ? `@${esc(f.mote)}` : esc(f.nombre || 'Guardián') }),
      ]))));
  }).catch(() => {
    lista.textContent = '';
    lista.appendChild(el('p', { clase: 'mini', texto: 'Sé la primera persona en entrar.' }));
  });

  return caja;
}

// -------------------------------------------------------------- formularios

function formulario(ctx, tipo, ir) {
  const crear = tipo === 'crear';
  const caja = el('div', { clase: 'tarjeta caja-acceso' });

  caja.appendChild(el('button', {
    clase: 'btn plano s', texto: '← Volver', onclick: () => ir('inicio'),
  }));
  caja.appendChild(el('h2', { estilo: 'margin:10px 0 4px',
    texto: crear ? 'Crea tu cuenta' : 'Entra en tu cuenta' }));
  caja.appendChild(el('p', { clase: 'mini', estilo: 'margin-bottom:16px',
    texto: crear
      ? 'Con esto guardas tu progreso, entras en el muro y puedes unirte a tu clase.'
      : 'Tu progreso te está esperando.' }));

  const nombre = entrada('Tu nombre', 'text', 'Ana García', 'nombre');
  const mote = entrada('Tu mote', 'text', 'ana_verde', 'username');
  const correo = entrada('Correo', 'email', 'ana@ejemplo.com', 'email');
  const pais = el('select', { clase: 'entrada' }, paisesOrdenados().map((p) =>
    el('option', { value: p.cod, selected: p.cod === 'SV', texto: `${p.nombre} — ${p.red} g CO2e/kWh` })));
  const cajaPais = el('label', { clase: 'campo' }, [
    el('span', { clase: 'mini', texto: 'Tu país' }), pais,
    el('span', { clase: 'pista', texto: 'Fija la intensidad de carbono de tu red eléctrica.' }),
  ]);
  const clave = entrada('Contraseña', 'password', 'mínimo 6 caracteres',
    crear ? 'new-password' : 'current-password');

  const avisoMote = el('p', { clase: 'pista' });
  if (crear) {
    // El mote se propone solo a partir del nombre, pero deja de proponerse en
    // cuanto la persona lo toca: sobrescribir lo que alguien acaba de escribir
    // es de las cosas que mas molestan de un formulario.
    let tocado = false;
    mote.campo.addEventListener('input', () => { tocado = true; revisarMote(); });
    nombre.campo.addEventListener('input', () => {
      if (tocado) return;
      mote.campo.value = moteSugerido(nombre.campo.value);
      revisarMote();
    });
    function revisarMote() {
      const v = social.validarMote(mote.campo.value);
      avisoMote.textContent = mote.campo.value && !v.ok ? v.motivo
        : (v.ok ? `Quedarás como @${v.mote}` : '');
      avisoMote.className = v.ok ? 'pista ok' : 'pista mal';
    }
  }

  caja.appendChild(el('div', { clase: 'campos' }, crear
    ? [nombre.caja, mote.caja, avisoMote, cajaPais, correo.caja, clave.caja]
    : [correo.caja, clave.caja]));

  const error = el('p', { clase: 'pista mal', estilo: 'min-height:18px' });
  caja.appendChild(error);

  const enviar = el('button', { clase: 'btn primario grande bloque',
    texto: crear ? 'Crear cuenta' : 'Entrar' });
  caja.appendChild(enviar);

  caja.appendChild(el('button', {
    clase: 'btn plano s', estilo: 'margin-top:12px',
    texto: crear ? '¿Ya tienes cuenta? Entra' : '¿No tienes cuenta? Créala',
    onclick: () => ir(crear ? 'entrar' : 'crear'),
  }));

  const accion = async () => {
    error.textContent = '';
    const datos = {
      nombre: nombre.campo.value.trim() || 'Guardián',
      mote: mote.campo.value.trim().toLowerCase(),
      correo: correo.campo.value.trim(),
      clave: clave.campo.value,
      pais: pais.value,
    };
    if (crear) {
      const v = social.validarMote(datos.mote);
      if (!v.ok) { error.textContent = `Mote: ${v.motivo}`; mote.campo.focus(); return; }
      datos.mote = v.mote;
    }
    if (!datos.correo.includes('@')) { error.textContent = 'Escribe un correo válido.'; correo.campo.focus(); return; }
    if (datos.clave.length < 6) { error.textContent = 'La contraseña necesita al menos 6 caracteres.'; clave.campo.focus(); return; }

    enviar.disabled = true;
    enviar.textContent = crear ? 'Creando…' : 'Entrando…';
    try {
      if (crear) await altaCompleta(ctx, datos);
      else await entradaCompleta(ctx, datos);
    } catch (e) {
      const m = mensajeDeAcceso(e);
      error.textContent = m.texto;
      if (m.ir) setTimeout(() => ir(m.ir), 1800);
    } finally {
      enviar.disabled = false;
      enviar.textContent = crear ? 'Crear cuenta' : 'Entrar';
    }
  };

  enviar.addEventListener('click', accion);
  for (const c of [nombre, mote, correo, clave]) {
    c.campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') accion(); });
  }
  return caja;
}

function entrada(etiqueta, tipo, marcador, autocomplete) {
  const campo = el('input', { type: tipo, placeholder: marcador, autocomplete, clase: 'entrada' });
  const caja = el('label', { clase: 'campo' }, [
    el('span', { clase: 'mini', texto: etiqueta }),
    campo,
  ]);
  return { caja, campo };
}

// ------------------------------------------------------------------ acciones

/**
 * Alta: cuenta y mote en un solo paso desde fuera.
 *
 * El mote no siempre se puede poner al momento: si el proyecto exige confirmar
 * el correo, el alta no devuelve sesion y todavia no hay a quien ponerselo. En
 * ese caso se guarda y se aplica solo en la primera entrada, para que la
 * persona no tenga que acordarse de volver a elegirlo.
 */
export async function altaCompleta(ctx, { nombre, mote, correo, clave, pais = 'WW' }, deps = {}) {
  const crearCuenta = deps.crearCuenta || api.crearCuenta;
  const fijarMote = deps.fijarMote || social.fijarMote;
  const avisar = deps.avisar || toast;
  const r = await crearCuenta(correo, clave, { nombre, pais });

  // El perfil local es el que lee toda la app: el motor de impacto saca de
  // aqui la intensidad de la red electrica. Guardarlo solo en el servidor
  // dejaria los calculos con el valor mundial por defecto hasta la primera
  // sincronizacion.
  ctx?.almacen?.actualizarPerfil?.({ nombre, pais });

  if (r?.confirmacionPendiente) {
    social.guardarMotePendiente(mote);
    avisar({
      titulo: 'Revisa tu correo', icono: '📬', duracion: 9000,
      texto: `Te enviamos un mensaje a ${correo}. Confírmalo y vuelve a entrar: tu mote @${mote} te está reservado.`,
    });
    return { confirmacionPendiente: true };
  }

  try {
    await fijarMote(mote);
  } catch (e) {
    // La cuenta ya existe; el mote es lo unico que fallo. Se dice y se sigue.
    avisar({ titulo: 'Cuenta creada', tipo: 'aviso', icono: '⚠️',
      texto: `${e.message} Puedes elegir otro desde Comunidad.` });
    ctx?.refrescar?.();
    return { confirmacionPendiente: false, mote: null };
  }

  avisar({ titulo: `¡Hola, @${mote}!`, icono: '🎉',
    texto: 'Ya eres parte de Atmosphere. Registra tu primera acción.' });
  ctx?.ir?.('registrar');
  return { confirmacionPendiente: false, mote };
}

/** Entrada: aplica el mote reservado si el alta lo dejo pendiente. */
export async function entradaCompleta(ctx, { correo, clave }, deps = {}) {
  const entrar = deps.entrar || api.entrar;
  const fijarMote = deps.fijarMote || social.fijarMote;
  const avisar = deps.avisar || toast;
  await entrar(correo, clave);

  const pendiente = social.motePendiente();
  if (pendiente) {
    try { await fijarMote(pendiente); } catch { /* lo elegira en Comunidad */ }
    social.guardarMotePendiente(null);
  }
  avisar({ titulo: '¡Bienvenida de vuelta!', icono: '👋', texto: 'Tu progreso sigue aquí.' });
  ctx?.ir?.('panel');
  return { ok: true };
}

// --------------------------------------------------------------- ya dentro

function panelDentro(ctx, salir) {
  const caja = el('div', { clase: 'tarjeta centrado' });
  const s = api.sesion();
  caja.appendChild(el('div', { estilo: 'font-size:44px', texto: '✅' }));
  caja.appendChild(el('h2', { estilo: 'margin:10px 0 4px', texto: 'Ya has entrado' }));
  caja.appendChild(el('p', { clase: 'mini', texto: s?.email || '' }));
  caja.appendChild(el('div', { clase: 'fila centrada envuelve', estilo: 'margin-top:16px' }, [
    el('button', { clase: 'btn primario', texto: '🎬 Ir a la comunidad', onclick: () => ctx.ir('comunidad') }),
    el('button', { clase: 'btn', texto: 'Cerrar sesión', onclick: () => { api.desconectar(); salir(); } }),
  ]));
  return caja;
}

// ------------------------------------------------------- primera visita

const CLAVE_VISTO = 'atmosphere.bienvenida.vista.v1';

/** Si toca enseñar la portada: sin sesion y sin haberla saltado antes. */
export function tocaBienvenida(hayS = api.haySesion(), leer = leerVisto) {
  return !hayS && !leer();
}

export function marcarVisto() {
  try { localStorage.setItem(CLAVE_VISTO, '1'); } catch { /* sin almacenamiento */ }
}

function leerVisto() {
  try { return localStorage.getItem(CLAVE_VISTO) === '1'; } catch { return false; }
}
