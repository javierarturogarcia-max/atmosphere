/**
 * app.js — Carcasa de la aplicacion: navegacion, enrutado y arranque.
 */
import { el, toast, modal, num } from './componentes.js';
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
import { vistaCiencia } from './vistas/ciencia.js';
import { vistaPerfil } from './vistas/perfil.js';

const RUTAS = [
  { id: 'panel',     etiqueta: 'Panel',      icono: '🏠', vista: vistaPanel,     movil: true },
  { id: 'registrar', etiqueta: 'Registrar',  icono: '➕', vista: vistaRegistrar, movil: true },
  { id: 'misiones',  etiqueta: 'Misiones',   icono: '🎯', vista: vistaMisiones,  movil: true },
  { id: 'logros',    etiqueta: 'Insignias',  icono: '🏅', vista: vistaLogros },
  { id: 'tienda',    etiqueta: 'Recompensas', icono: '🎁', vista: vistaTienda },
  { separador: true },
  { id: 'analitica', etiqueta: 'Analitica',  icono: '📊', vista: vistaAnalitica, movil: true },
  { id: 'huella',    etiqueta: 'Huella',     icono: '🌍', vista: vistaHuella },
  { id: 'aire',      etiqueta: 'Aire',       icono: '💨', vista: vistaAire },
  { id: 'ranking',   etiqueta: 'Ranking',    icono: '🏆', vista: vistaRanking },
  { separador: true },
  { id: 'ciencia',   etiqueta: 'Ciencia',    icono: '🔬', vista: vistaCiencia },
  { id: 'perfil',    etiqueta: 'Perfil',     icono: '⚙️', vista: vistaPerfil, movil: true },
];

export function iniciar(raiz) {
  const guardado = cargar();
  const almacen = crearAlmacen(guardado || estadoInicial());
  let rutaActual = (location.hash || '#panel').slice(1);
  if (!RUTAS.some((r) => r.id === rutaActual)) rutaActual = 'panel';

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
      el('span', { clase: 'marca-icono', texto: '🌍' }),
      el('div', {}, [
        el('div', { clase: 'marca-texto', html: 'Atmos<span>phere</span>' }),
        el('div', { clase: 'marca-sub', texto: 'Accion climatica' }),
      ]),
    ]));
    for (const r of RUTAS) {
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

    inferior.innerHTML = '';
    for (const r of RUTAS.filter((x) => x.movil)) inferior.appendChild(botonNav(r, true));
  }

  function pintar() {
    pintarNav();
    const ruta = RUTAS.find((r) => r.id === rutaActual) || RUTAS[0];
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
    const nueva = location.hash.slice(1);
    if (nueva && nueva !== rutaActual && RUTAS.some((r) => r.id === nueva)) {
      rutaActual = nueva;
      pintar();
    }
  });

  raiz.appendChild(el('div', { clase: 'app' }, [lateral, contenido]));
  raiz.appendChild(inferior);
  pintar();

  if (!guardado) setTimeout(() => bienvenida(ctx), 350);

  return ctx;
}

/** Onboarding de primera ejecucion. */
function bienvenida(ctx) {
  const nombre = el('input', { type: 'text', placeholder: 'Como quieres que te llamemos', maxlength: '24' });
  const selPais = el('select', {}, paisesOrdenados().map((p) =>
    el('option', { value: p.cod, selected: p.cod === 'WW', texto: `${p.nombre} — ${p.red} g CO2e/kWh` })));

  const cerrar = modal(el('div', {}, [
    el('div', { clase: 'centrado', estilo: 'margin-bottom:19px' }, [
      el('div', { estilo: 'font-size:52px', texto: '🌍' }),
      el('h2', { estilo: 'margin:9px 0 5px', texto: 'Bienvenido a Atmosphere' }),
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
      el('div', { texto: 'Sin cuenta, sin servidor, sin telemetria. Todo se guarda solo en este navegador.' }),
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
