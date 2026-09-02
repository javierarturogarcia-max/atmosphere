/** comunidad.js — Muro de buenas acciones: clips cortos, me gusta y aura. */
import { el, num, co2, toast, modal, vacio, esc, tarjetaMetrica, logoMutuu, avatar } from '../componentes.js';
import * as social from '../../core/social.js';
import * as api from '../../core/nube.js';
import { accion, CATEGORIAS } from '../../data/acciones.js';
import { NIVELES_EVIDENCIA } from '../../core/evidencia.js';
import { leerMedio } from '../medios.js';

let pestana = 'virales';

export function vistaComunidad(ctx) {
  const raiz = el('div');
  const cuerpo = el('div');

  raiz.appendChild(el('h1', { texto: 'Comunidad' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Enseña lo que haces y contagia el habito. Los me gusta dan aura, que es reconocimiento social y se cuenta APARTE de los puntos: los puntos solo salen de la fisica, para que un video gracioso nunca valga mas que plantar un arbol.' }));
  raiz.appendChild(cuerpo);

  const pintar = async () => {
    cuerpo.innerHTML = '';
    if (!api.haySesion()) {
      cuerpo.appendChild(el('div', { clase: 'tarjeta centrado' }, [
        logoMutuu(52),
        el('h2', { estilo: 'margin:11px 0 5px', texto: 'Únete para entrar en la comunidad' }),
        el('p', { clase: 'mini', estilo: 'margin-bottom:15px' },
          ['El muro necesita cuenta: es lo unico de la app que no puede funcionar solo en tu dispositivo. Se tarda menos de un minuto.']),
        el('div', { clase: 'fila centrada envuelve' }, [
          el('button', { clase: 'btn primario', texto: '✨ Crear mi cuenta', onclick: () => ctx.ir('bienvenida') }),
          el('button', { clase: 'btn', texto: 'Ya tengo cuenta', onclick: () => ctx.ir('bienvenida') }),
        ]),
      ]));
      return;
    }
    await pintarMuro(cuerpo, ctx, pintar);
  };

  pintar();
  return raiz;
}

async function pintarMuro(cuerpo, ctx, repintar) {
  const cargando = el('div', { clase: 'tarjeta pulso', texto: 'Cargando el muro...' });
  cuerpo.appendChild(cargando);

  const errores = [];
  const intentar = async (fn, q) => { try { return await fn(); } catch (e) { errores.push(`${q}: ${e.message}`); return null; } };

  const perfil = await intentar(api.miPerfil, 'perfil');
  const gustadas = (await intentar(social.misReacciones, 'reacciones')) || new Map();
  const publicaciones = (await intentar(
    () => (pestana === 'virales' ? social.virales() : social.muro(30)), 'muro')) || [];
  cargando.remove();

  if (errores.length) {
    cuerpo.appendChild(el('div', { clase: 'aviso alerta seccion' }, [
      el('span', { texto: '⚠️' }),
      el('div', {}, [
        el('strong', { texto: 'No se pudo cargar todo' }),
        el('div', { clase: 'mini', estilo: 'margin-top:3px;color:inherit', texto: errores.join(' · ') }),
        el('div', { clase: 'mini', estilo: 'margin-top:3px;color:inherit;opacity:.8',
          texto: 'Si es la primera vez, comprueba que ejecutaste db/social.sql en el editor SQL.' }),
      ]),
    ]));
  }

  // ------------------------------------------------------------- cabecera
  cuerpo.appendChild(el('div', { clase: 'rejilla c3 seccion' }, [
    tarjetaMetrica({ etiqueta: 'Tu aura', valor: num(perfil?.aura ?? 0), icono: '✨', color: 'var(--morado)',
      pie: perfil?.mote ? `@${perfil.mote}` : 'sin mote todavia' }),
    tarjetaMetrica({ etiqueta: 'Tus puntos de impacto', valor: num(perfil?.puntos ?? 0), icono: '⭐', color: 'var(--ambar)',
      pie: 'Del impacto fisico, no del muro' }),
    tarjetaMetrica({ etiqueta: 'En el muro', valor: String(publicaciones.length), icono: '🎬',
      pie: pestana === 'virales' ? 'lo mas gustado de 7 dias' : 'lo mas reciente' }),
  ]));

  // ------------------------------------------------------- mote y publicar
  cuerpo.appendChild(el('div', { clase: 'fila entre envuelve seccion', estilo: 'gap:9px' }, [
    el('div', { clase: 'fila', estilo: 'gap:7px' }, [
      el('button', { clase: `chip${pestana === 'virales' ? ' activo' : ''}`, texto: '🔥 Virales',
        onclick: () => { pestana = 'virales'; repintar(); } }),
      el('button', { clase: `chip${pestana === 'reciente' ? ' activo' : ''}`, texto: '🕐 Reciente',
        onclick: () => { pestana = 'reciente'; repintar(); } }),
    ]),
    el('div', { clase: 'fila', estilo: 'gap:7px' }, [
      el('button', { clase: 'btn s', texto: perfil?.mote ? `@${perfil.mote}` : '✏️ Elegir mote',
        onclick: () => dialogoMote(perfil, repintar) }),
      el('button', { clase: 'btn primario s', texto: '🎬 Publicar accion',
        onclick: () => dialogoPublicar(ctx, repintar) }),
    ]),
  ]));

  // ---------------------------------------------------------------- muro
  if (!publicaciones.length) {
    cuerpo.appendChild(vacio('🎬', 'Todavia no hay nada aqui',
      'Publica tu primera accion y se la primera persona del muro'));
  } else {
    cuerpo.appendChild(el('div', { clase: 'rejilla ancha' },
      publicaciones.map((p) => tarjetaPublicacion(p, gustadas.get(p.id) || null, ctx, repintar))));
  }

  cuerpo.appendChild(el('div', { clase: 'aviso info', estilo: 'margin-top:20px' }, [
    el('span', { texto: '🛡️' }),
    el('div', { texto: 'Nadie puede darse me gusta a si mismo ni repetirlo: lo impide la base de datos, no el navegador. Tres reportes de personas distintas ocultan una publicacion automaticamente y su aura deja de contar.' }),
  ]));
}

export function tarjetaPublicacion(p, reaccionMia, ctx, repintar) {
  let meGusta = reaccionMia;
  const a = accion(p.accion_id);
  const cat = CATEGORIAS[p.categoria];
  const url = social.urlMedio(p.ruta_medio);
  const nivel = NIVELES_EVIDENCIA[p.nivel_evidencia];
  const mio = p.perfil_id === api.sesion()?.perfilId;

  // `meGusta` llega como el TIPO de reaccion o null: una persona reacciona una
  // sola vez a cada publicacion y elige el matiz.
  const contador = el('span', { clase: 'mono', texto: String(p.likes_n ?? 0) });
  const cara = el('span', { texto: meGusta ? social.reaccion(meGusta).icono : '🤍' });
  const boton = el('button', {
    clase: `chip${meGusta ? ' activo' : ''}`,
    estilo: mio ? 'opacity:.45;cursor:not-allowed' : '',
    title: mio ? 'No puedes reaccionar a lo tuyo' : 'Reacciona (manten pulsado para elegir)',
  }, [cara, contador]);

  if (!mio) {
    let ocupado = false;
    const aplicar = async (tipo) => {
      if (ocupado) return;
      ocupado = true;
      const antes = meGusta;
      try {
        meGusta = await social.aplicarReaccion(p.id, antes, tipo);
        // El contador solo cambia al entrar o salir; cambiar de matiz no suma.
        if (!antes && meGusta) p.likes_n = (p.likes_n ?? 0) + 1;
        if (antes && !meGusta) p.likes_n = Math.max(0, (p.likes_n ?? 0) - 1);
        contador.textContent = String(p.likes_n ?? 0);
        boton.className = `chip${meGusta ? ' activo' : ''}`;
        cara.textContent = meGusta ? social.reaccion(meGusta).icono : '🤍';
      } catch (e) {
        toast({ titulo: 'No se pudo registrar la reaccion', texto: e.message, tipo: 'error', icono: '⛔' });
      } finally { ocupado = false; }
    };

    // Pulsar da la reaccion por defecto; mantener pulsado abre el abanico. Es
    // el gesto que la gente ya conoce de otras aplicaciones, y deja el caso
    // frecuente en un solo toque.
    let abanico = null;
    // Soltar tras una pulsacion larga dispara un `click`. Sin tragarselo, ese
    // click cerraba el abanico en el mismo instante en que se abria y nadie
    // llegaba a verlo.
    let tragarClic = false;
    const cerrarAbanico = () => { abanico?.remove(); abanico = null; };
    const abrirAbanico = () => {
      if (abanico) return;
      tragarClic = true;
      abanico = el('div', { clase: 'abanico' }, social.REACCIONES.map((r) => el('button', {
        clase: `abanico-op${meGusta === r.tipo ? ' activo' : ''}`,
        title: r.etiqueta, texto: r.icono,
        onclick: (ev) => { ev.stopPropagation(); cerrarAbanico(); aplicar(r.tipo); },
      })));
      (boton.closest('.ancla-reaccion') || boton.parentElement).appendChild(abanico);
      // Se espera a que pase el click de soltar antes de escuchar el de fuera.
      setTimeout(() => document.addEventListener('click', cerrarAbanico, { once: true }), 350);
    };

    let temporizador = null;
    const empezar = () => { temporizador = setTimeout(abrirAbanico, 420); };
    const soltar = () => { clearTimeout(temporizador); };
    boton.addEventListener('pointerdown', empezar);
    boton.addEventListener('pointerup', soltar);
    boton.addEventListener('pointerleave', soltar);
    boton.addEventListener('contextmenu', (ev) => { ev.preventDefault(); abrirAbanico(); });
    boton.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (tragarClic) { tragarClic = false; return; }
      if (abanico) { cerrarAbanico(); return; }
      aplicar(meGusta || 'me_gusta');
    });
  }

  return el('div', { clase: 'tarjeta', estilo: 'padding:0;overflow:hidden' }, [
    // ---- medio
    el('div', { estilo: 'position:relative;background:#000;aspect-ratio:4/5;overflow:hidden' }, [
      // Si el medio no carga —borrado, red lenta, formato no admitido— se
      // sustituye por un marcador limpio en vez de dejar el texto alternativo
      // suelto encima de las etiquetas.
      (() => {
        const respaldo = () => el('div', {
          estilo: 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;'
            + 'justify-content:center;gap:7px;background:var(--fondo-2);color:var(--texto-3)',
        }, [
          el('div', { estilo: 'font-size:42px', texto: a?.icono || cat?.icono || '🌍' }),
          el('div', { clase: 'mini', texto: 'Medio no disponible' }),
        ]);
        const medio = p.tipo_medio === 'video'
          ? el('video', {
            src: url, autoplay: 'true', muted: 'true', loop: 'true', playsinline: 'true',
            estilo: 'width:100%;height:100%;object-fit:cover;background:#000',
          })
          : el('img', { src: url, alt: esc(p.descripcion || a?.titulo || 'Accion'), loading: 'lazy',
            estilo: 'width:100%;height:100%;object-fit:cover' });
        medio.addEventListener('error', () => medio.replaceWith(respaldo()), { once: true });
        return url ? medio : respaldo();
      })(),
      el('span', {
        clase: 'pastilla',
        estilo: `position:absolute;top:9px;left:9px;background:rgba(5,9,15,.82);color:${cat?.color || 'var(--verde)'}`,
        texto: `${a?.icono || cat?.icono || '🌍'} ${a?.titulo || p.accion_id}`,
      }),
      nivel ? el('span', {
        clase: 'pastilla',
        estilo: `position:absolute;top:9px;right:9px;background:rgba(5,9,15,.82);color:${nivel.color}`,
        texto: '✓ verificada',
        title: nivel.etiqueta,
      }) : null,
    ]),
    // ---- cuerpo
    el('div', { estilo: 'padding:13px' }, [
      el('div', { clase: 'fila entre', estilo: 'margin-bottom:7px' }, [
        el('div', { clase: 'fila', estilo: 'gap:7px;min-width:0' }, [
          el('button', {
            clase: 'enlace-autor',
            title: p.autor_mote ? `Ver el espacio de @${p.autor_mote}` : 'Sin mote todavia',
            disabled: p.autor_mote ? null : '',
            onclick: () => p.autor_mote && ctx.ir('espacio', p.autor_mote),
          }, [
            avatar({ url: social.urlMedio(p.autor_avatar), nombre: p.autor_nombre, mote: p.autor_mote }, 26),
            el('strong', { estilo: 'font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
              texto: p.autor_mote ? `@${p.autor_mote}` : (p.autor_nombre || 'Alguien') }),
          ]),
          el('span', { clase: 'pastilla', estilo: 'background:rgba(192,132,252,.16);color:var(--morado)',
            texto: `✨ ${num(p.autor_aura ?? 0)}` }),
        ]),
        el('span', { clase: 'mini', texto: social.haceRato(p.creado) }),
      ]),
      p.descripcion
        ? el('div', { estilo: 'font-size:13px;color:var(--texto-2);margin-bottom:9px;line-height:1.5', texto: p.descripcion })
        : null,
      el('div', { clase: 'fila entre', estilo: 'padding-top:9px;border-top:1px solid var(--borde)' }, [
        el('span', { clase: 'mono mini', estilo: 'color:var(--verde)', texto: `${co2(p.co2e || 0)} evitados` }),
        el('div', { clase: 'fila', estilo: 'gap:5px' }, [
          el('span', { clase: 'ancla-reaccion' }, [boton]),
          mio
            ? el('button', { clase: 'chip', texto: '🗑️', title: 'Borrar mi publicacion',
              onclick: async () => {
                try {
                  await social.borrarPublicacion(p.id);
                  toast({ titulo: 'Publicacion borrada', icono: '🗑️' });
                  repintar();
                } catch (e) { toast({ titulo: 'No se pudo borrar', texto: e.message, tipo: 'error', icono: '⛔' }); }
              } })
            : el('button', { clase: 'chip', texto: '⚑', title: 'Reportar',
              onclick: async () => {
                try {
                  await social.reportar(p.id);
                  toast({ titulo: 'Reporte enviado', texto: 'Con tres reportes se oculta automaticamente.', icono: '⚑' });
                } catch (e) { toast({ titulo: 'No se pudo reportar', texto: e.message, tipo: 'error', icono: '⛔' }); }
              } }),
        ]),
      ]),
    ]),
  ]);
}

function dialogoMote(perfil, repintar) {
  const campo = el('input', { type: 'text', maxlength: '15', value: perfil?.mote || '',
    placeholder: 'ana_verde', estilo: 'text-transform:lowercase' });
  const aviso = el('div', { clase: 'mini', estilo: 'min-height:18px' });
  campo.addEventListener('input', () => {
    const v = social.validarMote(campo.value);
    aviso.textContent = v.ok ? `Quedaras como @${v.mote}` : v.motivo;
    aviso.style.color = v.ok ? 'var(--verde)' : 'var(--texto-3)';
  });

  const cerrar = modal(el('div', { clase: 'col' }, [
    el('p', { clase: 'mini' },
      ['Tu mote es el apodo con el que apareces en el muro. Minusculas, numeros y guion bajo; de 3 a 15 caracteres.']),
    el('label', { clase: 'campo' }, ['Mote', campo]),
    aviso,
    el('button', {
      clase: 'btn primario', texto: 'Guardar mote',
      onclick: async () => {
        try {
          const m = await social.fijarMote(campo.value);
          cerrar();
          toast({ titulo: `Ahora eres @${m}`, icono: '✨' });
          repintar();
        } catch (e) {
          toast({ titulo: 'No se pudo guardar', texto: e.message, tipo: 'error', icono: '⛔' });
        }
      },
    }),
  ]), { titulo: 'Elige tu mote', ancho: 400 });
}

/**
 * Publicar: se eligen entre los registros propios que YA tienen prueba grafica.
 * No se puede publicar una accion sin evidencia, ni una que no sea tuya: eso
 * ultimo lo impide ademas la propia base de datos.
 */
function dialogoPublicar(ctx, repintar) {
  const estado = ctx.almacen.get();
  const candidatos = [...estado.registros].reverse().filter((r) => r.medio?.id);

  if (!candidatos.length) {
    modal(el('div', {}, [
      el('div', { clase: 'aviso info' }, [
        el('span', { texto: '📷' }),
        el('div', { texto: 'Para publicar necesitas una accion con foto o video. Ve a Registrar, elige una accion y pulsa "Hacer foto o video" antes de guardarla.' }),
      ]),
      el('button', { clase: 'btn primario bloque', estilo: 'margin-top:15px', texto: 'Ir a Registrar',
        onclick: () => { document.querySelector('.modal-fondo')?.remove(); ctx.ir('registrar'); } }),
    ]), { titulo: 'Publicar una accion', ancho: 420 });
    return;
  }

  let elegido = candidatos[0];
  const descripcion = el('input', { type: 'text', maxlength: '200', placeholder: 'Cuenta que hiciste (opcional)' });
  const lista = el('div', { clase: 'col', estilo: 'max-height:220px;overflow-y:auto;margin-bottom:13px' });
  const previa = el('div', { clase: 'mini', estilo: 'margin-bottom:11px' });

  const refrescar = () => {
    lista.innerHTML = '';
    for (const r of candidatos.slice(0, 20)) {
      const a = accion(r.accionId);
      lista.appendChild(el('button', {
        clase: `chip${elegido === r ? ' activo' : ''}`,
        estilo: 'justify-content:flex-start;width:100%;text-align:left',
        texto: `${a?.icono || ''} ${a?.titulo || r.accionId} · ${num(r.cantidad)} ${r.unidad} · ${r.medio.tipo === 'video' ? '🎥' : '📷'}`,
        onclick: () => { elegido = r; refrescar(); },
      }));
    }
    const aura = social.auraDe({ likes: 0, nivelEvidencia: elegido.medio?.nivel });
    previa.textContent = `Ganaras ${aura} de aura al publicar`
      + (['fechada', 'situada', 'video'].includes(elegido.medio?.nivel)
        ? ' (incluye +5 por evidencia verificada), y 2 mas por cada me gusta.'
        : ', y 2 mas por cada me gusta.');
  };
  refrescar();

  const cerrar = modal(el('div', {}, [
    el('p', { clase: 'mini', estilo: 'margin-bottom:11px' },
      ['Elige una accion tuya que ya tenga prueba. Solo se subira el medio de ESA accion; el resto sigue sin salir de tu dispositivo.']),
    lista,
    el('label', { clase: 'campo', estilo: 'margin-bottom:9px' }, ['Descripcion', descripcion]),
    previa,
    el('button', {
      clase: 'btn primario bloque', texto: '🎬 Publicar en el muro',
      onclick: async (e) => {
        const boton = e.target;
        boton.disabled = true; boton.textContent = 'Subiendo...';
        try {
          const guardado = await leerMedio(elegido.medio.id);
          if (!guardado?.blob) throw new Error('La prueba ya no esta en este dispositivo.');
          await social.publicar(elegido, guardado.blob, {
            descripcion: descripcion.value,
            categoria: accion(elegido.accionId)?.cat || 'otras',
          });
          cerrar();
          toast({ titulo: 'Publicado en el muro', texto: 'Tu aura ha subido', icono: '✨', tipo: 'logro' });
          repintar();
        } catch (err) {
          toast({ titulo: 'No se pudo publicar', texto: err.message, tipo: 'error', icono: '⛔', duracion: 7000 });
          boton.disabled = false; boton.textContent = '🎬 Publicar en el muro';
        }
      },
    }),
  ]), { titulo: 'Publicar una accion', ancho: 460 });
}
