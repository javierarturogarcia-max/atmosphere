/**
 * app.js — Carcasa de la aplicacion: navegacion, enrutado y arranque.
 */
import { el, toast, modal, num, logoMutuu } from './componentes.js';
import { crearAlmacen, cargar, estadoInicial } from '../core/estado.js';
import { paisesOrdenados } from '../data/paises.js';
import { vistaPanel } from './vistas/panel.js';
import { vistaRegistrar } from './vistas/registrar.js';
import { vistaMisiones } from './vistas/misiones.js';
import { vistaLogros } from './vistas/logros.js';
import { vistaTienda } from './vistas/tienda.js';
import { vistaAnalitica } from './vistas/analitica.js';
import { vistaHuella } from './vistas/huella.js';
import { vistaAire } from './vistas/aire.js';
import { vistaRanking } from './vistas/ranking.js';
import { vistaNube } from './vistas/nube.js';
import { vistaComunidad } from './vistas/comunidad.js';
import { vistaCiencia } from './vistas/ciencia.js';
import { vistaPerfil } from './vistas/perfil.js';
import { vistaBienvenida, tocaBienvenida, marcarVisto } from './vistas/bienvenida.js';
import { recogerSesionDeURL } from '../core/nube.js';
import { motePendiente, guardarMotePendiente, fijarMote } from '../core/social.js';

const RUTAS = [
  { id: 'bienvenida', etiqueta: 'Bienvenida', icono: '👋', vista: vistaBienvenida, oculta: true },
  { id: 'panel',     etiqueta: 'Panel',      icono: '🏠', vista: vistaPanel },
  { id: 'registrar', etiqueta: 'Registrar',  icono: '➕', vista: vistaRegistrar },
  { id: 'misiones',  etiqueta: 'Misiones',   icono: '🎯', vista: vistaMisiones },
  { id: 'logros',    etiqueta: 'Insignias',  icono: '🏅', vista: vistaLogros },
  { id: 'tienda',    etiqueta: 'Recompensas', icono: '🎁', vista: vistaTienda },
  { separador: true },
  { id: 'analitica', etiqueta: 'Analitica',  icono: '📊', vista: vistaAnalitica },
  { id: 'huella',    etiqueta: 'Huella',     icono: '🌍', vista: vistaHuella },
  { id: 'aire',      etiqueta: 'Aire',       icono: '💨', vista: vistaAire },
  { id: 'ranking',   etiqueta: 'Ranking',    icono: '🏆', vista: vistaRanking },
  { id: 'comunidad', etiqueta: 'Comunidad',  icono: '🎬', vista: vistaComunidad },
  { id: 'nube',      etiqueta: 'Nube y grupos', icono: '☁️', vista: vistaNube },
  { separador: true },
  { id: 'ciencia',   etiqueta: 'Ciencia',    icono: '🔬', vista: vistaCiencia },
  { id: 'perfil',    etiqueta: 'Perfil',     icono: '⚙️', vista: vistaPerfil },
];

export function iniciar(raiz) {
  // Lo PRIMERO, antes de mirar la ruta: si venimos del enlace de confirmacion
  // del correo, GoTrue deja los tokens en el fragmento, que es tambien el
  // enrutador de esta app. Recogerlos aqui evita dos cosas: aterrizar sin
  // sesion despues de haber confirmado, y que un "#access_token=..." se
  // interprete como una ruta.
  const vueltaDelCorreo = recogerSesionDeURL();

  const guardado = cargar();
  const almacen = crearAlmacen(guardado || estadoInicial());
  let rutaActual = (location.hash || '').slice(1);
  if (!RUTAS.some((r) => r.id === rutaActual)) rutaActual = '';

  // Primera visita sin cuenta: se entra por la portada, no por el panel. Es la
  // diferencia entre una herramienta y una comunidad — y sin ella, crear una
  // cuenta seguia escondido detras de una pantalla de configuracion.
  if (!rutaActual) rutaActual = tocaBienvenida() ? 'bienvenida' : 'panel';
  if (rutaActual === 'bienvenida') marcarVisto();

  document.documentElement.dataset.tema = almacen.get().perfil.tema || 'bosque';

  const contenido = el('main', { clase: 'principal', id: 'contenido' });
  const lateral = el('aside', { clase: 'lateral' });
  const inferior = el('nav', { clase: 'nav-inferior', 'aria-label': 'Navegacion principal' });

  const ctx = {
    almacen,
    ir(ruta) {
      rutaActual = ruta;
      location.hash = `#${ruta}`;
      pintar();
      contenido.scrollIntoView({ block: 'start', behavior: 'instant' });
      window.scrollTo(0, 0);
    },
    refrescar() { pintar(); },
    ajusteLocal() { ajusteLocal(ctx); },
  };

  function botonNav(r, compacto = false) {
    return el('button', {
      clase: `nav-item${rutaActual === r.id ? ' activo' : ''}`,
      onclick: () => ctx.ir(r.id),
      'aria-current': rutaActual === r.id ? 'page' : null,
    }, [
      el('span', { clase: 'ico', texto: r.icono }),
      el('span', { texto: r.etiqueta }),
    ]);
  }

  function pintarNav() {
    lateral.innerHTML = '';
    lateral.appendChild(el('div', { clase: 'marca' }, [
      logoMutuu(30, 'marca-icono'),
      el('div', {}, [
        el('div', { clase: 'marca-texto', html: 'Atmos<span>phere</span>' }),
        el('div', { clase: 'marca-sub', texto: 'mutu_u' }),
      ]),
    ]));
    for (const r of RUTAS) {
      if (r.oculta) continue;
      lateral.appendChild(r.separador ? el('div', { clase: 'nav-sep' }) : botonNav(r));
    }

    const est = almacen.get();
    lateral.appendChild(el('div', { estilo: 'margin-top:auto;padding:13px 11px 0' }, [
      el('div', { clase: 'etiqueta', texto: 'Saldo' }),
      el('div', { clase: 'fila entre', estilo: 'margin-top:5px' }, [
        el('span', { clase: 'mono', estilo: 'font-weight:800;color:var(--ambar);font-size:17px', texto: num(est.perfil.puntos) }),
        el('span', { clase: 'mini', texto: 'puntos' }),
      ]),
    ]));

    // El menu inferior lleva TODAS las vistas y se desplaza en horizontal.
    // Antes solo mostraba cinco, asi que en el movil habia siete pantallas
    // —entre ellas la nube y los grupos— a las que no habia forma de llegar.
    inferior.innerHTML = '';
    for (const r of RUTAS.filter((x) => !x.separador && !x.oculta)) inferior.appendChild(botonNav(r, true));
    // Deja siempre a la vista la pestana activa, aunque este fuera de pantalla.
    requestAnimationFrame(() => {
      inferior.querySelector('.nav-item.activo')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
  }

  function pintar() {
    pintarNav();
    const ruta = RUTAS.find((r) => r.id === rutaActual) || RUTAS.find((r) => r.id === 'panel');
    contenido.innerHTML = '';
    try {
      contenido.appendChild(ruta.vista(ctx));
    } catch (e) {
      console.error(e);
      contenido.appendChild(el('div', { clase: 'aviso error' },
        [`Error al dibujar la vista "${ruta.id}": ${e.message}`]));
    }
  }

  window.addEventListener('hashchange', () => {
    const vuelta = recogerSesionDeURL();
    if (vuelta.estado !== 'nada') { anunciarVuelta(vuelta, ctx); return; }
    const nueva = location.hash.slice(1);
    if (nueva && nueva !== rutaActual && RUTAS.some((r) => r.id === nueva)) {
      rutaActual = nueva;
      pintar();
    }
  });

  raiz.appendChild(el('div', { clase: 'app' }, [lateral, contenido]));
  raiz.appendChild(inferior);
  pintar();

  // El ajuste local (nombre y pais) solo se pregunta a quien decide explorar
  // sin cuenta. Quien crea cuenta ya lo dice en el alta, y sacarle un modal
  // encima de la portada dejaba sus botones sin poder pulsarse.
  if (!guardado && rutaActual !== 'bienvenida') setTimeout(() => ajusteLocal(ctx), 350);

  anunciarVuelta(vueltaDelCorreo, ctx);

  return ctx;
}

/**
 * Cierra el circulo del correo de confirmacion: avisa de como fue y aplica el
 * mote que quedo reservado en el alta, para que nadie tenga que volver a
 * elegirlo tres dias despues de haberlo escrito.
 */
function anunciarVuelta(vuelta, ctx) {
  if (!vuelta || vuelta.estado === 'nada') return;

  if (vuelta.estado === 'error') {
    toast({ titulo: 'El enlace no valia', texto: vuelta.mensaje, tipo: 'alerta', icono: '⚠️', duracion: 9000 });
    ctx.ir('bienvenida');
    return;
  }

  const pendiente = motePendiente();
  const saludar = (mote) => {
    toast({
      titulo: mote ? `¡Correo confirmado, @${mote}!` : 'Correo confirmado',
      texto: 'Ya estas dentro. Registra tu primera accion.',
      icono: '🎉', duracion: 7000,
    });
    ctx.ir('registrar');
  };

  if (!pendiente) { saludar(null); return; }
  fijarMote(pendiente)
    .then(() => { guardarMotePendiente(null); saludar(pendiente); })
    .catch(() => { guardarMotePendiente(null); saludar(null); });
}

/**
 * Ajuste local de primera ejecucion: nombre y pais para quien usa la app sin
 * cuenta. El pais no es un adorno — determina la intensidad de carbono de la
 * red electrica, y de ahi salen los kg de CO2e de media app.
 */
export function ajusteLocal(ctx) {
  const nombre = el('input', { type: 'text', placeholder: 'Como quieres que te llamemos', maxlength: '24' });
  const selPais = el('select', {}, paisesOrdenados().map((p) =>
    el('option', { value: p.cod, selected: p.cod === 'WW', texto: `${p.nombre} — ${p.red} g CO2e/kWh` })));

  const cerrar = modal(el('div', {}, [
    el('div', { clase: 'centrado', estilo: 'margin-bottom:19px' }, [
      logoMutuu(56),
      el('h2', { estilo: 'margin:9px 0 5px', texto: 'Empecemos' }),
      el('p', { clase: 'mini' },
        ['Convierte lo que ya haces bien por el planeta en impacto medido y en progreso visible. Cada accion se traduce a kilos de CO2e, litros de agua y kilos de residuo con factores cientificos citados.']),
    ]),
    el('div', { clase: 'col', estilo: 'margin-bottom:19px' }, [
      el('label', { clase: 'campo' }, ['Tu nombre', nombre]),
      el('label', { clase: 'campo' }, ['Tu pais', selPais]),
      el('div', { clase: 'mini' }, ['El pais determina la intensidad de carbono de tu red electrica: ahorrar un kWh en Polonia evita 23 veces mas CO2 que en Noruega.']),
    ]),
    el('div', { clase: 'aviso info', estilo: 'margin-bottom:15px' }, [
      el('span', { texto: '🔒' }),
      el('div', { texto: 'Sin cuenta y sin servidor: todo se guarda solo en este navegador. Puedes crear cuenta cuando quieras, desde Perfil.' }),
    ]),
    el('button', {
      clase: 'btn primario bloque', texto: 'Empezar',
      onclick: () => {
        ctx.almacen.actualizarPerfil({ nombre: nombre.value.trim() || 'Guardian', pais: selPais.value });
        cerrar();
        ctx.refrescar();
        toast({ titulo: 'Todo listo', texto: 'Registra tu primera accion en la pestana Registrar', icono: '🌱' });
      },
    }),
  ]), { ancho: 460 });
}
