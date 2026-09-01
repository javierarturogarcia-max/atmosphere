/** nube.js — Sincronizacion opcional, grupos y ranking con personas reales. */
import { el, num, co2, litros, toast, modal, tarjetaMetrica, vacio, esc } from '../componentes.js';
import * as api from '../../core/nube.js';
import { accion } from '../../data/acciones.js';

let vistaGrupo = null;

export function vistaNube(ctx) {
  const raiz = el('div');
  const cuerpo = el('div');

  raiz.appendChild(el('h1', { texto: 'Nube y grupos' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Opcional y desactivada por defecto. La app funciona entera sin cuenta: esto solo anade lo que en local es imposible, comparar con personas reales y no perder el historial al cambiar de movil. Tus fotos, notas y coordenadas nunca se envian.' }));
  raiz.appendChild(cuerpo);

  // "Cambiar de proyecto" no puede depender de que estaConfigurada() pase a
  // false: desde que la app trae un proyecto de serie, eso no ocurre nunca y
  // el formulario quedaba inalcanzable. Es una decision de la vista, no del
  // estado de la nube.
  let cambiando = false;

  const pintar = async () => {
    cuerpo.innerHTML = '';
    if (cambiando || !api.estaConfigurada()) {
      paso1Configurar(cuerpo, () => { cambiando = false; pintar(); });
      return;
    }
    if (!api.haySesion()) {
      paso2Cuenta(cuerpo, (o) => { if (o?.cambiar) cambiando = true; pintar(); }, ctx);
      return;
    }
    await paso3Panel(cuerpo, pintar, ctx);
  };

  pintar();
  return raiz;
}

// ---------------------------------------------------------------- paso 1
function paso1Configurar(cuerpo, repintar) {
  const url = el('input', { type: 'url', placeholder: 'https://xxxxxxxx.supabase.co' });
  const clave = el('input', { type: 'password', placeholder: 'sb_publishable_... (o eyJ... si es antigua)' });

  cuerpo.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('h2', { texto: '1. Conecta tu proyecto de Supabase' }),
    el('ol', { estilo: 'margin:0 0 15px 19px;font-size:13px;color:var(--texto-2);line-height:1.9' }, [
      el('li', { texto: 'Crea una cuenta gratuita en supabase.com y un proyecto nuevo.' }),
      el('li', { texto: 'Abre SQL Editor, pega el contenido de db/esquema.sql del repositorio y pulsa Run.' }),
      el('li', { texto: 'Ve a Project Settings → API Keys y copia la URL del proyecto y la "Publishable key" (empieza por sb_publishable_). Si tu proyecto aun usa el formato antiguo, es la clave "anon public" que empieza por eyJ.' }),
    ]),
    el('div', { clase: 'col' }, [
      el('label', { clase: 'campo' }, ['URL del proyecto', url]),
      el('label', { clase: 'campo' }, ['Clave publica (Publishable key)', clave]),
      el('button', {
        clase: 'btn primario', texto: 'Conectar',
        onclick: () => {
          try {
            api.configurar({ url: url.value, anonKey: clave.value });
            toast({ titulo: 'Proyecto conectado', icono: '☁️' });
            repintar();
          } catch (e) {
            toast({ titulo: 'Configuracion invalida', texto: e.message, tipo: 'error', icono: '⛔' });
          }
        },
      }),
    ]),
    el('div', { clase: 'aviso info', estilo: 'margin-top:15px' }, [
      el('span', { texto: '🔑' }),
      el('div', { texto: 'La clave publica esta pensada para vivir en el navegador: no es un secreto. Lo que protege los datos son las politicas de seguridad por fila del esquema, no ocultar la clave. La clave SECRETA (sb_secret_ o service_role) no se acepta aqui: la app la detecta y la rechaza, porque publicarla daria control total de tu base de datos.' }),
    ]),
  ]));
}

// ---------------------------------------------------------------- paso 2
function paso2Cuenta(cuerpo, repintar, ctx) {
  const email = el('input', { type: 'email', placeholder: 'tu@correo.com' });
  const pass = el('input', { type: 'password', placeholder: 'Contrasena (min. 6 caracteres)' });
  const perfil = ctx.almacen.get().perfil;

  const accionCuenta = async (crear) => {
    try {
      if (crear) {
        const r = await api.crearCuenta(email.value, pass.value, { nombre: perfil.nombre, pais: perfil.pais });
        toast(r.confirmacionPendiente
          ? { titulo: 'Revisa tu correo', texto: 'Confirma la cuenta y vuelve a entrar.', icono: '📧' }
          : { titulo: 'Cuenta creada', icono: '✅' });
      } else {
        await api.entrar(email.value, pass.value);
        toast({ titulo: 'Sesion iniciada', icono: '✅' });
      }
      repintar();
    } catch (e) {
      toast({ titulo: 'No se pudo continuar', texto: e.message, tipo: 'error', icono: '⛔' });
    }
  };

  cuerpo.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('h2', { texto: '2. Crea tu cuenta o entra' }),
    el('div', { clase: 'col' }, [
      el('label', { clase: 'campo' }, ['Correo', email]),
      el('label', { clase: 'campo' }, ['Contrasena', pass]),
      el('div', { clase: 'fila', estilo: 'gap:9px' }, [
        el('button', { clase: 'btn primario crece', texto: 'Crear cuenta', onclick: () => accionCuenta(true) }),
        el('button', { clase: 'btn crece', texto: 'Ya tengo cuenta', onclick: () => accionCuenta(false) }),
      ]),
    ]),
    el('div', { clase: 'divisor' }),
    el('button', { clase: 'btn s', texto: 'Cambiar de proyecto',
      onclick: () => { api.olvidarTodo(); repintar({ cambiar: true }); } }),
  ]));
}

// ---------------------------------------------------------------- paso 3
async function paso3Panel(cuerpo, repintar, ctx) {
  const estado = ctx.almacen.get();
  const cargando = el('div', { clase: 'tarjeta pulso', texto: 'Consultando el servidor...' });
  cuerpo.appendChild(cargando);

  let perfil = null; let comunidad = null; let grupos = []; let ranking = [];
  const errores = [];
  const intentar = async (fn, nombre) => {
    try { return await fn(); } catch (e) { errores.push(`${nombre}: ${e.message}`); return null; }
  };

  perfil = await intentar(api.miPerfil, 'perfil');
  comunidad = await intentar(api.impactoComunidad, 'comunidad');
  grupos = (await intentar(api.misGrupos, 'grupos')) || [];
  ranking = (await intentar(() => api.rankingGlobal(50), 'ranking')) || [];
  cargando.remove();

  if (errores.length) {
    cuerpo.appendChild(el('div', { clase: 'aviso alerta seccion' }, [
      el('span', { texto: '⚠️' }),
      el('div', {}, [
        el('strong', { texto: 'Algunas consultas fallaron' }),
        el('div', { clase: 'mini', estilo: 'margin-top:3px;color:inherit', texto: errores.join(' · ') }),
        el('div', { clase: 'mini', estilo: 'margin-top:3px;color:inherit;opacity:.8',
          texto: 'Si es la primera vez, comprueba que ejecutaste db/esquema.sql entero en el editor SQL.' }),
      ]),
    ]));
  }

  // ------------------------------------------------------------- sincronizar
  const pendientes = api.pendientesDeSubir(estado.registros, []).length;
  cuerpo.appendChild(el('div', { clase: 'rejilla c4 seccion' }, [
    tarjetaMetrica({ etiqueta: 'Registros locales', valor: num(estado.registros.length), icono: '📱' }),
    tarjetaMetrica({ etiqueta: 'En el servidor', valor: num(perfil?.registros_n ?? 0), icono: '☁️',
      color: 'var(--cian)', pie: perfil ? `${num(perfil.puntos)} puntos verificados` : 'sin datos' }),
    tarjetaMetrica({ etiqueta: 'CO2e sincronizado', valor: co2(perfil?.co2e_total ?? 0), icono: '🌬️', color: 'var(--verde)' }),
    tarjetaMetrica({ etiqueta: 'Comunidad', valor: num(comunidad?.participantes ?? 0), icono: '👥',
      pie: comunidad ? `${co2(comunidad.co2e_total || 0)} entre todos` : '' }),
  ]));

  cuerpo.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('div', { clase: 'fila entre envuelve', estilo: 'gap:11px' }, [
      el('div', {}, [
        el('h2', { estilo: 'margin:0 0 3px', texto: 'Sincronizacion' }),
        el('div', { clase: 'mini', texto: `Sesion: ${esc(api.sesion()?.email || '')}` }),
      ]),
      el('div', { clase: 'fila', estilo: 'gap:7px' }, [
        el('button', {
          clase: 'btn primario', texto: '☁️ Sincronizar ahora',
          onclick: async (e) => {
            e.target.disabled = true; e.target.textContent = 'Subiendo...';
            try {
              const r = await api.sincronizar(estado.registros, (id) => accion(id)?.cat || 'otras');
              toast({
                titulo: `${r.subidos} registros subidos`,
                texto: r.rechazados.length ? `${r.rechazados.length} lotes rechazados por el servidor` : 'Totales recalculados por el servidor',
                icono: '☁️', tipo: r.rechazados.length ? 'error' : 'exito',
              });
              repintar();
            } catch (err) {
              toast({ titulo: 'No se pudo sincronizar', texto: err.message, tipo: 'error', icono: '⛔' });
              e.target.disabled = false; e.target.textContent = '☁️ Sincronizar ahora';
            }
          },
        }),
        el('button', { clase: 'btn peligro s', texto: 'Cerrar sesion', onclick: () => { api.desconectar(); repintar(); } }),
      ]),
    ]),
    perfil && perfil.registros_n < estado.registros.length
      ? el('div', { clase: 'aviso info', estilo: 'margin-top:13px' },
        [`Tienes ${estado.registros.length - perfil.registros_n} registros locales que aun no estan en el servidor.`])
      : el('div', { clase: 'aviso exito', estilo: 'margin-top:13px' }, ['Todo sincronizado.']),
    el('div', { clase: 'divisor' }),
    el('div', { clase: 'fila entre' }, [
      el('span', { clase: 'mini', texto: 'Aparecer en los rankings publicos' }),
      el('button', {
        clase: `chip${perfil?.publico ? ' activo' : ''}`,
        texto: perfil?.publico ? 'Visible' : 'Oculto',
        onclick: async () => {
          try { await api.actualizarPerfil({ publico: !perfil?.publico }); repintar(); }
          catch (e) { toast({ titulo: 'No se pudo cambiar', texto: e.message, tipo: 'error', icono: '⛔' }); }
        },
      }),
    ]),
  ]));

  // ------------------------------------------------------------------ grupos
  const listaGrupos = grupos.map((g) => g.grupos).filter(Boolean);
  cuerpo.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('div', { clase: 'fila entre envuelve', estilo: 'margin-bottom:13px;gap:9px' }, [
      el('h2', { estilo: 'margin:0', texto: 'Tus grupos' }),
      el('div', { clase: 'fila', estilo: 'gap:7px' }, [
        el('button', { clase: 'btn s', texto: '➕ Crear grupo', onclick: () => dialogoCrear(repintar) }),
        el('button', { clase: 'btn s', texto: '🔗 Unirme con codigo', onclick: () => dialogoUnirse(repintar) }),
      ]),
    ]),
    listaGrupos.length
      ? el('div', { clase: 'rejilla ancha' }, listaGrupos.map((g) => el('div', {
        clase: 'tarjeta interactiva',
        onclick: async () => { vistaGrupo = vistaGrupo === g.id ? null : g.id; repintar(); },
      }, [
        el('div', { clase: 'fila entre' }, [
          el('strong', { texto: g.nombre }),
          el('span', { clase: 'pastilla', estilo: 'background:var(--superficie-2)', texto: g.tipo }),
        ]),
        el('div', { clase: 'mono mini', estilo: 'margin-top:7px', texto: `Codigo: ${g.codigo}` }),
        el('div', { clase: 'mini', estilo: 'margin-top:3px', texto: 'Comparte ese codigo para que se unan.' }),
      ])))
      : vacio('👥', 'Aun no perteneces a ningun grupo', 'Crea uno para tu clase o unete con un codigo'),
  ]));

  if (vistaGrupo) {
    const filas = (await intentar(() => api.rankingGrupo(vistaGrupo), 'ranking del grupo')) || [];
    cuerpo.appendChild(tablaRanking(filas, api.sesion()?.perfilId, `Ranking del grupo · ${filas[0]?.grupo || ''}`));
  }

  // ----------------------------------------------------------- ranking global
  cuerpo.appendChild(tablaRanking(ranking, api.sesion()?.perfilId, 'Ranking global · personas reales'));

  cuerpo.appendChild(el('div', { clase: 'aviso info' }, [
    el('span', { texto: '🔒' }),
    el('div', { texto: 'El servidor no acepta puntuaciones: solo registros individuales. Los totales los recalcula el propio Postgres a partir de ellos, y los permisos por columna impiden que ningun cliente escriba sus puntos. Por eso esta tabla significa algo.' }),
  ]));
}

function tablaRanking(filas, miId, titulo) {
  const r = api.situarEnRanking(filas, miId);
  return el('div', { clase: 'tarjeta seccion' }, [
    el('div', { clase: 'fila entre', estilo: 'margin-bottom:11px' }, [
      el('h2', { estilo: 'margin:0', texto: titulo }),
      r.posicion ? el('span', { clase: 'chip estatico', texto: `#${r.posicion} de ${r.total}` }) : null,
    ]),
    r.tabla.length
      ? el('div', { clase: 'tabla-scroll' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { texto: '#' }), el('th', { texto: 'Participante' }),
            el('th', { texto: 'Puntos' }), el('th', { texto: 'CO2e' }), el('th', { texto: 'Dias' }),
          ])]),
          el('tbody', {}, r.tabla.slice(0, 30).map((f) => el('tr', { clase: f.esUsuario ? 'destacada' : '' }, [
            el('td', { clase: 'mono', texto: f.posicion <= 3 ? ['🥇', '🥈', '🥉'][f.posicion - 1] : String(f.posicion) }),
            el('td', { texto: f.esUsuario ? `${f.nombre} (tu)` : f.nombre }),
            el('td', { clase: 'mono', texto: num(f.puntos) }),
            el('td', { clase: 'mono mini', texto: co2(f.co2e_total || 0) }),
            el('td', { clase: 'mono mini', texto: String(f.dias_activos ?? '—') }),
          ]))),
        ]),
      ])
      : vacio('🏆', 'Todavia no hay nadie aqui', 'Sincroniza y comparte el proyecto con tu clase'),
  ]);
}

function dialogoCrear(repintar) {
  const nombre = el('input', { type: 'text', placeholder: 'Ej.: Quinto B — Ciencias' });
  const tipo = el('select', {}, ['clase', 'centro', 'empresa', 'barrio', 'amigos'].map(
    (t) => el('option', { value: t, texto: t })));
  const cerrar = modal(el('div', { clase: 'col' }, [
    el('label', { clase: 'campo' }, ['Nombre del grupo', nombre]),
    el('label', { clase: 'campo' }, ['Tipo', tipo]),
    el('button', {
      clase: 'btn primario', texto: 'Crear',
      onclick: async () => {
        try {
          const g = await api.crearGrupo(nombre.value.trim(), tipo.value);
          cerrar();
          toast({ titulo: `Grupo creado: ${g.nombre}`, texto: `Codigo: ${g.codigo}`, icono: '👥', duracion: 9000 });
          repintar();
        } catch (e) {
          toast({ titulo: 'No se pudo crear', texto: e.message, tipo: 'error', icono: '⛔' });
        }
      },
    }),
  ]), { titulo: 'Crear grupo', ancho: 420 });
}

function dialogoUnirse(repintar) {
  const codigo = el('input', { type: 'text', placeholder: 'ABC234', maxlength: '6', estilo: 'text-transform:uppercase' });
  const cerrar = modal(el('div', { clase: 'col' }, [
    el('label', { clase: 'campo' }, ['Codigo del grupo (6 caracteres)', codigo]),
    el('button', {
      clase: 'btn primario', texto: 'Unirme',
      onclick: async () => {
        try {
          await api.unirseAGrupo(codigo.value);
          cerrar();
          toast({ titulo: 'Te has unido al grupo', icono: '🎉' });
          repintar();
        } catch (e) {
          toast({ titulo: 'No se pudo unir', texto: e.message, tipo: 'error', icono: '⛔' });
        }
      },
    }),
  ]), { titulo: 'Unirse a un grupo', ancho: 380 });
}
