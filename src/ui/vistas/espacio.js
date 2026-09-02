/**
 * espacio.js — El espacio de una persona: su ficha y todo lo que ha publicado.
 *
 * Es la pagina a la que se llega pulsando un mote en el muro, y la que cada
 * quien puede repartir como suya. Reutiliza la misma tarjeta que el muro a
 * proposito: dos tarjetas distintas para lo mismo acaban divergiendo, y las
 * reacciones tienen que funcionar igual aqui que alli.
 */
import { el, num, co2, toast, vacio, avatar, tarjetaMetrica } from '../componentes.js';
import * as social from '../../core/social.js';
import * as api from '../../core/nube.js';
import { tarjetaPublicacion } from './comunidad.js';
import { progresion } from '../../core/nivel.js';

export function vistaEspacio(ctx, mote = null) {
  // El mote viene de la ruta (#espacio/javi_eco), asi que cada espacio tiene
  // URL propia y se puede repartir. Sin argumento, es el mio.
  const motePedido = mote ? String(mote).replace(/^@/, '').toLowerCase() : null;

  const raiz = el('div');
  const cuerpo = el('div');
  raiz.appendChild(cuerpo);

  const pintar = async () => {
    cuerpo.innerHTML = '';
    if (!api.haySesion()) {
      cuerpo.appendChild(el('div', { clase: 'tarjeta centrado' }, [
        el('h2', { texto: 'Los espacios necesitan cuenta' }),
        el('p', { clase: 'mini', estilo: 'margin:6px 0 15px' },
          ['Tu espacio guarda lo que publicas y otras personas pueden verlo y reaccionar.']),
        el('button', { clase: 'btn primario', texto: '✨ Crear mi cuenta', onclick: () => ctx.ir('bienvenida') }),
      ]));
      return;
    }

    const cargando = el('div', { clase: 'tarjeta pulso', texto: 'Cargando el espacio...' });
    cuerpo.appendChild(cargando);

    let datos;
    try {
      datos = motePedido ? await social.espacioDe(motePedido) : await social.miEspacio();
    } catch (e) {
      cargando.remove();
      cuerpo.appendChild(el('div', { clase: 'tarjeta centrado' }, [
        el('div', { estilo: 'font-size:38px', texto: '🔍' }),
        el('h2', { estilo: 'margin:9px 0 5px', texto: 'Espacio no encontrado' }),
        el('p', { clase: 'mini', estilo: 'margin-bottom:14px', texto: e.message }),
        el('button', { clase: 'btn', texto: '← Volver a la comunidad', onclick: () => ctx.ir('comunidad') }),
      ]));
      return;
    }
    cargando.remove();

    const mio = datos.esMio || datos.ficha.id === api.sesion()?.perfilId;
    const reacciones = mio ? new Map() : (await social.misReacciones().catch(() => new Map()));
    pintarEspacio(cuerpo, datos, mio, ctx, pintar, reacciones);
  };

  pintar();
  return raiz;
}

function pintarEspacio(cuerpo, { ficha, publicaciones }, mio, ctx, repintar, reacciones) {
  const prog = progresion(ficha.puntos || 0);

  // ------------------------------------------------------------------ ficha
  cuerpo.appendChild(el('div', { clase: 'tarjeta seccion ficha-espacio' }, [
    (() => {
      const cara = avatar({ url: social.urlMedio(ficha.avatar), nombre: ficha.nombre, mote: ficha.mote }, 92);
      cara.classList.add('avatar-grande');
      return cara;
    })(),
    el('div', { clase: 'crece' }, [
      el('h1', { estilo: 'margin:0;font-size:24px',
        texto: ficha.mote ? `@${ficha.mote}` : (ficha.nombre || 'Guardián') }),
      ficha.mote
        ? el('div', { clase: 'mini', texto: ficha.nombre || '' })
        : null,
      el('div', { clase: 'fila envuelve', estilo: 'gap:6px;margin-top:9px' }, [
        el('span', { clase: 'pastilla', estilo: 'background:rgba(192,132,252,.16);color:var(--morado)',
          texto: `✨ ${num(ficha.aura ?? 0)} de aura` }),
        el('span', { clase: 'pastilla', estilo: 'background:rgba(251,191,36,.16);color:var(--ambar)',
          texto: `⭐ ${num(ficha.puntos ?? 0)} puntos` }),
        el('span', { clase: 'pastilla', texto: `${prog.rango.icono} ${prog.rango.nombre}` }),
      ]),
    ]),
    mio ? el('button', {
      clase: 'btn s', texto: '🎬 Publicar accion', onclick: () => ctx.ir('comunidad'),
    }) : null,
  ]));

  // --------------------------------------------------------------- metricas
  cuerpo.appendChild(el('div', { clase: 'rejilla c4 seccion' }, [
    tarjetaMetrica({ etiqueta: 'CO₂e evitado', valor: co2(ficha.co2e_total ?? 0), icono: '🌍', color: 'var(--verde)' }),
    tarjetaMetrica({ etiqueta: 'Acciones', valor: num(ficha.registros_n ?? 0), icono: '✅' }),
    tarjetaMetrica({ etiqueta: 'Dias activos', valor: num(ficha.dias_activos ?? 0), icono: '🔥', color: 'var(--naranja)' }),
    tarjetaMetrica({ etiqueta: 'Publicadas', valor: String(publicaciones.length), icono: '🎬', color: 'var(--cian)' }),
  ]));

  // ------------------------------------------------------------ el historial
  cuerpo.appendChild(el('h2', { texto: mio ? 'Todo lo que has publicado' : 'Sus buenas acciones' }));

  if (!publicaciones.length) {
    cuerpo.appendChild(vacio('🎬', mio ? 'Tu espacio esta vacio' : 'Todavia no ha publicado nada',
      mio ? 'Publica una accion desde Comunidad y aparecera aqui para siempre' : ''));
    return;
  }

  cuerpo.appendChild(el('div', { clase: 'rejilla ancha' },
    publicaciones.map((p) => tarjetaPublicacion(p, reacciones.get(p.id) || null, ctx, repintar))));
}
