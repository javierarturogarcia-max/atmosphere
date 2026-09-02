/** perfil.js — Perfil, ajustes, datos y privacidad. */
import { el, num, co2, litros, toast, modal, tarjetaMetrica, progreso, haceCuanto, avatar } from '../componentes.js';
import { paisesOrdenados, pais } from '../../data/paises.js';
import { progresion, RANGOS } from '../../core/nivel.js';
import { indiceConfianza } from '../../core/validacion.js';
import { accion } from '../../data/acciones.js';
import { descargar } from '../descargas.js';
import { procesarAvatar, selectorMedio, guardarMedio, leerMedio, borrarMedio } from '../medios.js';
import { capturar, hayCamaraEnApp } from '../camara.js';
import * as api from '../../core/nube.js';
import * as social from '../../core/social.js';

export function vistaPerfil(ctx) {
  const estado = ctx.almacen.get();
  const r = ctx.almacen.resumen();
  const prog = progresion(estado.perfil.xp);
  const conf = indiceConfianza(estado.registros);
  const raiz = el('div');

  raiz.appendChild(el('h1', { texto: 'Perfil y ajustes' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Todos tus datos viven unicamente en este navegador. No hay cuenta, ni servidor, ni telemetria: puedes exportarlos o borrarlos cuando quieras.' }));

  // ------------------------------------------------------------- identidad
  const nombre = el('input', { type: 'text', value: estado.perfil.nombre, maxlength: '24' });
  const selPais = el('select', {}, paisesOrdenados().map((p) =>
    el('option', { value: p.cod, selected: p.cod === estado.perfil.pais, texto: `${p.nombre} — ${p.red} g CO2e/kWh` })));
  const selTema = el('select', {}, [
    ['bosque', 'Bosque (verde)'], ['oceano', 'Oceano (azul)'], ['claro', 'Claro'],
  ].map(([v, t]) => el('option', { value: v, selected: estado.perfil.tema === v, texto: t })));

  raiz.appendChild(el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [
    el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: 'Identidad' }),
      seccionFoto(ctx),
      el('div', { clase: 'col' }, [
        el('label', { clase: 'campo' }, ['Nombre', nombre]),
        el('label', { clase: 'campo' }, ['Pais (determina el mix electrico de tus calculos)', selPais]),
        el('label', { clase: 'campo' }, ['Tema visual', selTema]),
        interruptorCompartir(ctx),
        el('button', {
          clase: 'btn primario', texto: 'Guardar cambios',
          onclick: () => {
            ctx.almacen.actualizarPerfil({ nombre: nombre.value.trim() || 'Guardian', pais: selPais.value, tema: selTema.value });
            document.documentElement.dataset.tema = selTema.value;
            toast({ titulo: 'Perfil actualizado', icono: '✅' });
            ctx.refrescar();
          },
        }),
      ]),
      el('div', { clase: 'aviso info', estilo: 'margin-top:15px' }, [
        el('span', { texto: '⚡' }),
        el('div', { texto: `Con la red de ${pais(estado.perfil.pais).nombre} (${pais(estado.perfil.pais).red} g CO2e/kWh), cada kWh que ahorras evita ${num(pais(estado.perfil.pais).red / 1000, 3)} kg de CO2e. En Polonia ese mismo kWh evitaria 0,662 kg; en Noruega, 0,029.` }),
      ]),
    ]),
    el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: 'Progresion' }),
      el('div', { clase: 'centrado', estilo: 'margin-bottom:15px' }, [
        el('div', { estilo: 'font-size:48px', texto: prog.rango.icono }),
        el('div', { estilo: 'font-weight:800;font-size:19px', texto: prog.rango.nombre }),
        el('div', { clase: 'mini', estilo: 'font-style:italic', texto: `"${prog.rango.lema}"` }),
      ]),
      progreso(prog.progreso, { texto: `Nivel ${prog.nivel} · ${num(prog.xpEnNivel)} / ${num(prog.xpSiguienteNivel - prog.xpInicioNivel)} XP` }),
      el('div', { clase: 'fila envuelve', estilo: 'margin-top:15px;gap:5px' }, RANGOS.map((rg) =>
        el('span', {
          clase: 'chip estatico',
          estilo: prog.nivel >= rg.min ? `border-color:${rg.color};color:${rg.color}` : 'opacity:.35',
          texto: `${rg.icono} ${rg.min}`,
          title: rg.nombre,
        }))),
    ]),
  ]));

  // -------------------------------------------------------------- resumen
  raiz.appendChild(el('div', { clase: 'rejilla c4 seccion' }, [
    tarjetaMetrica({ etiqueta: 'Registros', valor: num(r.registros), icono: '📝',
      pie: `${r.accionesDistintas} acciones distintas` }),
    tarjetaMetrica({ etiqueta: 'Dias activos', valor: num(r.diasActivos), icono: '📅',
      pie: `Mejor racha: ${r.rachaMejor} dias` }),
    tarjetaMetrica({ etiqueta: 'Indice de confianza', valor: num(conf.valor, 2), icono: '🛡️',
      color: conf.valor > 0.7 ? 'var(--verde)' : 'var(--ambar)', pie: conf.etiqueta }),
    tarjetaMetrica({ etiqueta: 'Miembro desde', valor: new Date(estado.perfil.creado).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }), icono: '🌱' }),
  ]));

  raiz.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('h2', { texto: 'Como se calcula tu indice de confianza' }),
    el('div', { clase: 'rejilla c4' }, [
      ['Con evidencia', conf.detalle.conEvidencia, 'peso 35 %'],
      ['Sin sospechas', 1 - (conf.detalle.sospechosos || 0), 'peso 30 %'],
      ['Diversidad', conf.detalle.diversidad, 'peso 20 %'],
      ['Constancia', conf.detalle.constancia, 'peso 15 %'],
    ].map(([k, v, peso]) => el('div', {}, [
      el('div', { clase: 'fila entre', estilo: 'margin-bottom:5px' }, [
        el('span', { clase: 'mini', estilo: 'font-weight:600', texto: k }),
        el('span', { clase: 'mono mini', texto: num((v || 0) * 100, 0) + ' %' }),
      ]),
      progreso(v || 0, { fina: true }),
      el('div', { clase: 'mini', estilo: 'font-size:10px;margin-top:3px', texto: peso }),
    ]))),
    el('div', { clase: 'mini', estilo: 'margin-top:13px' },
      ['Un indice alto es lo que permitiria participar en rankings verificados o canjear recompensas de impacto real cuando exista una entidad que las financie.']),
  ]));

  // ------------------------------------------------------------------ datos
  raiz.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('h2', { texto: 'Tus datos' }),
    el('p', { clase: 'mini', estilo: 'margin-bottom:15px' },
      ['Exporta un JSON completo con todo tu historial para llevartelo a otro dispositivo, hacer copia de seguridad o analizarlo con tus propias herramientas.']),
    el('div', { clase: 'fila envuelve', estilo: 'gap:9px' }, [
      el('button', {
        clase: 'btn', texto: '⬇️ Exportar JSON',
        onclick: async () => {
          const res = await descargar({
            nombre: `atmosphere-${new Date().toISOString().slice(0, 10)}.json`,
            contenido: ctx.almacen.exportar(),
            tipo: 'application/json',
          });
          toast(res.ok
            ? { titulo: 'Datos exportados', texto: `${estado.registros.length} registros`, icono: '⬇️' }
            : { titulo: 'No se pudo exportar', texto: res.motivo, tipo: 'error', icono: '⛔' });
        },
      }),
      el('button', {
        clase: 'btn', texto: '⬆️ Importar JSON',
        onclick: () => {
          const input = el('input', { type: 'file', accept: 'application/json' });
          input.addEventListener('change', async () => {
            const f = input.files?.[0];
            if (!f) return;
            const res = ctx.almacen.importar(await f.text());
            toast(res.ok
              ? { titulo: 'Datos importados', icono: '✅' }
              : { titulo: 'Importacion fallida', texto: res.motivo, tipo: 'error', icono: '⛔' });
            if (res.ok) ctx.refrescar();
          });
          input.click();
        },
      }),
      el('button', {
        clase: 'btn', texto: '📊 Exportar CSV de registros',
        onclick: async () => {
          const filas = [['fecha', 'accion', 'categoria', 'cantidad', 'unidad', 'co2e_kg', 'agua_l', 'residuo_kg', 'puntos']];
          for (const reg of estado.registros) {
            const a = accion(reg.accionId);
            filas.push([reg.fecha, a?.titulo || reg.accionId, a?.cat || '', reg.cantidad, reg.unidad,
              reg.impacto.co2e, reg.impacto.agua, reg.impacto.residuo, reg.puntos]);
          }
          const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
          const res = await descargar({
            nombre: `atmosphere-registros-${new Date().toISOString().slice(0, 10)}.csv`,
            contenido: csv,
            tipo: 'text/csv;charset=utf-8',
          });
          toast(res.ok
            ? { titulo: 'CSV exportado', texto: `${estado.registros.length} registros`, icono: '📊' }
            : { titulo: 'No se pudo exportar', texto: res.motivo, tipo: 'error', icono: '⛔' });
        },
      }),
      el('button', {
        clase: 'btn peligro', texto: '🗑️ Borrar todo',
        onclick: () => {
          const cerrar = modal(el('div', {}, [
            el('div', { clase: 'aviso error', estilo: 'margin-bottom:15px' },
              ['Se borraran definitivamente tu perfil, los ' + estado.registros.length + ' registros, las insignias y los canjes. Esta accion no se puede deshacer. Exporta antes si quieres conservarlos.']),
            el('div', { clase: 'fila', estilo: 'gap:9px' }, [
              el('button', { clase: 'btn crece', texto: 'Cancelar', onclick: () => cerrar() }),
              el('button', {
                clase: 'btn peligro crece', texto: 'Si, borrar todo',
                onclick: () => { ctx.almacen.reiniciar(); cerrar(); toast({ titulo: 'Datos borrados', icono: '🗑️' }); ctx.refrescar(); },
              }),
            ]),
          ]), { titulo: '¿Seguro?', ancho: 420 });
        },
      }),
    ]),
  ]));

  // ------------------------------------------------------------- privacidad
  raiz.appendChild(el('div', { clase: 'tarjeta' }, [
    el('h2', { texto: 'Privacidad por diseno' }),
    el('ul', { estilo: 'margin:0 0 0 19px;font-size:13px;color:var(--texto-2);line-height:1.8' }, [
      el('li', { texto: 'Los datos se guardan en localStorage: nunca salen de este navegador.' }),
      el('li', { texto: 'No hay peticiones de red: la aplicacion funciona entera sin conexion.' }),
      el('li', { texto: 'No hay cookies de terceros, analitica ni identificadores publicitarios.' }),
      el('li', { texto: 'El identificador de perfil es aleatorio y local; solo sirve para generar tus misiones de forma determinista.' }),
      el('li', { texto: 'Si borras los datos del navegador, se borra todo. Por eso conviene exportar de vez en cuando.' }),
    ]),
  ]));

  return raiz;
}


// ------------------------------------------------------------------- la foto

/**
 * Foto de perfil: ponerla, cambiarla y quitarla.
 *
 * DOS SITIOS, A PROPOSITO. La copia local vive en IndexedDB y hace que la app
 * siga teniendo cara sin cuenta y sin conexion. Cuando hay sesion se sube
 * ademas al almacen, porque una foto que solo tu ves no es una foto de perfil
 * en una red social: la gracia es que aparezca junto a tu mote en el muro.
 *
 * Si la subida falla —sin red, sin permisos en el cubo— la foto local se queda
 * puesta igual y se avisa. Perder la foto por un corte de red seria peor que
 * tenerla solo en este dispositivo.
 */
function seccionFoto(ctx) {
  const caja = el('div', { clase: 'fila seccion', estilo: 'gap:15px;align-items:center' });
  const estado = ctx.almacen.get();
  let urlLocal = null;

  const pintar = () => {
    caja.innerHTML = '';
    const cara = avatar({
      url: urlLocal || (estado.perfil.avatarRemoto ? social.urlMedio(estado.perfil.avatarRemoto) : null),
      nombre: estado.perfil.nombre, mote: estado.perfil.mote,
    }, 84);
    cara.classList.add('avatar-grande');

    const puestaYa = !!(urlLocal || estado.perfil.avatarRemoto);
    caja.appendChild(cara);
    caja.appendChild(el('div', { clase: 'crece' }, [
      el('div', { clase: 'etiqueta', texto: 'Tu foto' }),
      el('div', { clase: 'fila envuelve', estilo: 'gap:6px;margin-top:7px' }, [
        hayCamaraEnApp() ? el('button', {
          clase: 'btn s', texto: '📸 Hacer foto',
          onclick: async () => {
            const r = await capturar({ modo: 'foto' });
            if (r) aplicar(r.blob);
          },
        }) : null,
        el('button', { clase: 'btn s', texto: '🖼️ Elegir imagen', onclick: () => selector.click() }),
        puestaYa ? el('button', { clase: 'btn s peligro', texto: 'Quitar', onclick: quitar }) : null,
        selector,
      ]),
      el('div', { clase: 'mini', estilo: 'margin-top:6px', texto: api.haySesion()
        ? 'Se ve junto a tu mote en el muro. Puedes cambiarla cuando quieras.'
        : 'Sin cuenta se guarda solo en este dispositivo. Al entrar en la comunidad se subira para que aparezca en el muro.' }),
    ]));
  };

  const selector = selectorMedio((f) => aplicar(f), { video: false, camara: false });

  async function aplicar(origen) {
    let recortada;
    try {
      recortada = await procesarAvatar(origen);
    } catch (e) {
      toast({ titulo: 'No se pudo usar esa imagen', texto: e.message, tipo: 'error', icono: '⛔' });
      return;
    }

    // Primero lo local: es lo que hace que la cara aparezca al instante y lo
    // que sobrevive si la red falla.
    const id = `av_${Date.now().toString(36)}`;
    const previo = estado.perfil.avatarLocal;
    await guardarMedio({ id, blob: recortada, tipo: 'foto' });
    if (previo) await borrarMedio(previo).catch(() => {});
    if (urlLocal) URL.revokeObjectURL(urlLocal);
    urlLocal = URL.createObjectURL(recortada);
    ctx.almacen.actualizarPerfil({ avatarLocal: id });
    estado.perfil.avatarLocal = id;
    pintar();

    if (!api.haySesion()) {
      toast({ titulo: 'Foto guardada', icono: '🖼️', texto: 'Se ve solo en este dispositivo hasta que entres en la comunidad.' });
      return;
    }
    try {
      const ruta = await social.subirAvatar(recortada);
      ctx.almacen.actualizarPerfil({ avatarRemoto: ruta });
      estado.perfil.avatarRemoto = ruta;
      toast({ titulo: 'Foto actualizada', icono: '🎉', texto: 'Ya aparece junto a tu mote en el muro.' });
    } catch (e) {
      toast({ titulo: 'Guardada aqui, pero no subida', tipo: 'alerta', icono: '⚠️',
        texto: `${e.message} La foto sigue puesta en este dispositivo.` });
    }
    pintar();
  }

  async function quitar() {
    if (estado.perfil.avatarLocal) await borrarMedio(estado.perfil.avatarLocal).catch(() => {});
    if (urlLocal) { URL.revokeObjectURL(urlLocal); urlLocal = null; }
    ctx.almacen.actualizarPerfil({ avatarLocal: null, avatarRemoto: null });
    estado.perfil.avatarLocal = null;
    estado.perfil.avatarRemoto = null;
    if (api.haySesion()) await social.quitarAvatar().catch(() => {});
    pintar();
    toast({ titulo: 'Foto quitada', icono: '🗑️', texto: 'Vuelve a mostrarse tu inicial.' });
  }

  // La copia local se lee de IndexedDB, que es asincrono: se pinta primero con
  // lo que haya y se repinta cuando llega.
  pintar();
  if (estado.perfil.avatarLocal) {
    leerMedio(estado.perfil.avatarLocal).then((m) => {
      if (!m?.blob) return;
      urlLocal = URL.createObjectURL(m.blob);
      pintar();
    }).catch(() => {});
  }
  return caja;
}


/**
 * Interruptor de compartir automatico.
 *
 * APAGADO POR DEFECTO, y esto no es negociable en una app que promete que los
 * registros son privados. Encenderlo es una decision consciente y reversible:
 * lo que se compartio antes sigue compartido, pero se puede borrar
 * publicacion por publicacion desde el espacio.
 */
function interruptorCompartir(ctx) {
  const estado = ctx.almacen.get();
  const casilla = el('input', { type: 'checkbox' });
  casilla.checked = !!estado.perfil.compartirAuto;
  casilla.addEventListener('change', () => {
    ctx.almacen.actualizarPerfil({ compartirAuto: casilla.checked });
    toast(casilla.checked
      ? { titulo: 'Compartir activado', icono: '🪪',
          texto: 'Cada accion que registres aparecera en tu espacio.' }
      : { titulo: 'Compartir desactivado', icono: '🔒',
          texto: 'Lo ya publicado sigue ahi; puedes borrarlo desde tu espacio.' });
  });

  return el('div', { clase: 'campo' }, [
    el('label', { clase: 'fila', estilo: 'gap:9px;cursor:pointer;align-items:flex-start' }, [
      casilla,
      el('div', {}, [
        el('div', { estilo: 'font-weight:600;color:var(--texto)',
          texto: 'Compartir mis acciones en mi espacio' }),
        el('div', { clase: 'mini', estilo: 'margin-top:2px' },
          ['Cada accion que registres se publica sola y otras personas pueden verla y reaccionar. '
           + 'Sin esto, tus registros siguen siendo privados y solo se publica lo que elijas a mano.']),
      ]),
    ]),
  ]);
}
