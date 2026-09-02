/** registrar.js — Catalogo de acciones y formulario de registro. */
import { el, num, co2, toast, modal, esc, vacio } from '../componentes.js';
import { CATEGORIAS, RAREZAS, categoriasConAcciones, accion } from '../../data/acciones.js';
import { calcularImpacto } from '../../core/impacto.js';
import { calcularPuntos } from '../../core/puntos.js';
import { validarRegistro, NIVELES } from '../../core/validacion.js';
import { claveDia } from '../../core/rachas.js';
import { iniciarSeguimiento, analizarTraza, verificarContra } from '../../core/gps.js';
import { parsearTraza, metadatosTraza } from '../../core/gpx.js';
import { procesarMedio, selectorMedio, guardarMedio, LIMITE_ARCHIVO_MB } from '../medios.js';
import { capturar, hayCamaraEnApp, SEGUNDOS_CLIP } from '../camara.js';
import { evaluarEvidencia, NIVELES_EVIDENCIA } from '../../core/evidencia.js';
import * as api from '../../core/nube.js';
import * as social from '../../core/social.js';

let filtroCat = 'todas';
let busqueda = '';

export function vistaRegistrar(ctx) {
  const estado = ctx.almacen.get();
  const raiz = el('div');

  raiz.appendChild(el('h1', { texto: 'Registrar accion' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Cada accion se convierte en impacto fisico medible y, a partir de ahi, en puntos. Todos los factores llevan fuente cientifica: pulsa una tarjeta para verla.' }));

  // ------------------------------------------------------------- buscador
  const entrada = el('input', {
    type: 'search', placeholder: 'Buscar accion... (bici, compostar, ducha)', value: busqueda,
    oninput: (e) => { busqueda = e.target.value.toLowerCase(); pintar(); },
  });
  raiz.appendChild(el('div', { estilo: 'margin-bottom:15px' }, [entrada]));

  // --------------------------------------------------------------- filtros
  const chips = el('div', { clase: 'fila envuelve scroll-x', estilo: 'margin-bottom:20px;gap:7px' });
  const mkChip = (id, etiqueta, icono) => el('button', {
    clase: `chip${filtroCat === id ? ' activo' : ''}`,
    texto: `${icono} ${etiqueta}`,
    onclick: () => { filtroCat = id; pintar(); },
  });
  chips.appendChild(mkChip('todas', 'Todas', '🌐'));
  for (const [id, meta] of Object.entries(CATEGORIAS)) chips.appendChild(mkChip(id, meta.etiqueta, meta.icono));
  raiz.appendChild(chips);

  const lista = el('div');
  raiz.appendChild(lista);

  function pintar() {
    // Refresca el estado visual de los chips sin reconstruir la vista entera.
    [...chips.children].forEach((c, i) => {
      const id = i === 0 ? 'todas' : Object.keys(CATEGORIAS)[i - 1];
      c.className = `chip${filtroCat === id ? ' activo' : ''}`;
    });
    lista.innerHTML = '';
    const grupos = categoriasConAcciones()
      .filter((g) => filtroCat === 'todas' || g.id === filtroCat)
      .map((g) => ({
        ...g,
        acciones: g.acciones.filter((a) => !busqueda
          || a.titulo.toLowerCase().includes(busqueda)
          || a.consejo.toLowerCase().includes(busqueda)),
      }))
      .filter((g) => g.acciones.length);

    if (!grupos.length) {
      lista.appendChild(vacio('🔍', 'Sin resultados', 'Prueba con otro termino'));
      return;
    }

    for (const g of grupos) {
      lista.appendChild(el('div', { clase: 'seccion' }, [
        el('div', { clase: 'fila', estilo: 'margin-bottom:11px' }, [
          el('span', { estilo: 'font-size:19px', texto: g.icono }),
          el('h2', { estilo: 'margin:0', texto: g.etiqueta }),
          el('span', { clase: 'mini', texto: `${g.acciones.length} acciones` }),
        ]),
        el('div', { clase: 'rejilla auto' }, g.acciones.map((a) => tarjetaAccion(a, ctx))),
      ]));
    }
  }

  pintar();
  return raiz;
}

/** Tarjeta de una accion con estimacion de impacto para 1 unidad. */
function tarjetaAccion(a, ctx) {
  const estado = ctx.almacen.get();
  const impacto = calcularImpacto(a.id, 1, { pais: estado.perfil.pais });
  const pts = calcularPuntos({ accionId: a.id, impacto }).puntos;
  const rareza = RAREZAS[a.rareza];

  return el('div', {
    clase: 'tarjeta interactiva',
    onclick: () => abrirFormulario(a, ctx),
    role: 'button', tabindex: '0',
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirFormulario(a, ctx); } },
  }, [
    el('div', { clase: 'fila entre', estilo: 'margin-bottom:9px' }, [
      el('span', { estilo: 'font-size:25px', texto: a.icono }),
      el('span', { clase: 'pastilla', estilo: `background:${rareza.color}22;color:${rareza.color}`, texto: rareza.etiqueta }),
    ]),
    el('div', { estilo: 'font-weight:700;font-size:14.5px;margin-bottom:5px', texto: a.titulo }),
    el('div', { clase: 'mini', estilo: 'margin-bottom:11px;min-height:32px', texto: a.consejo }),
    el('div', { clase: 'fila entre', estilo: 'padding-top:9px;border-top:1px solid var(--borde)' }, [
      el('span', { clase: 'mini mono', texto: impacto.co2e > 0 ? `${co2(impacto.co2e)} / ${a.unidad}` : `${num(impacto.agua)} L / ${a.unidad}` }),
      el('span', { clase: 'mono', estilo: 'color:var(--ambar);font-weight:700;font-size:13px', texto: `+${pts} pts` }),
    ]),
  ]);
}

/** Formulario modal de registro con vista previa en vivo del impacto. */
function abrirFormulario(a, ctx) {
  const estado = ctx.almacen.get();
  const hoy = claveDia();
  const yaHoy = estado.registros
    .filter((r) => r.accionId === a.id && claveDia(new Date(r.fecha)) === hoy)
    .reduce((s, r) => s + r.cantidad, 0);
  const restante = Math.max(0, a.maxDiario - yaHoy);

  const inicial = Math.min(restante || 1, a.unidad === 'km' ? 5 : a.unidad === 'min' ? 5 : 1);
  const campo = el('input', { type: 'number', min: '0.1', step: '0.1', value: String(inicial), inputmode: 'decimal' });
  const deslizador = el('input', {
    type: 'range', min: '0.5', max: String(Math.max(1, a.maxDiario)), step: '0.5', value: String(inicial),
  });
  const nota = el('input', { type: 'text', placeholder: 'Nota opcional (donde, con quien...)' });
  const evidencia = el('input', { type: 'checkbox' });
  const previa = el('div', { clase: 'tarjeta', estilo: 'margin:15px 0' });

  // Se declara aqui, antes de 'actualizar', porque esa funcion lee 'medio' para
  // mostrar el multiplicador por evidencia y se invoca nada mas definirse.
  let medio = null;

  const actualizar = (valor) => {
    const q = Math.max(0, Number(valor) || 0);
    const imp = calcularImpacto(a.id, q, { pais: estado.perfil.pais });
    const { puntos, desglose } = calcularPuntos({ accionId: a.id, impacto: imp });
    const val = validarRegistro({ accionId: a.id, cantidad: q }, estado.registros);
    previa.innerHTML = `
      <div class="etiqueta">Impacto estimado</div>
      <div class="rejilla c3" style="margin-top:11px">
        <div><div class="metrica-valor s" style="color:var(--verde)">${esc(co2(imp.co2e))}</div><div class="mini">CO2e evitado</div></div>
        <div><div class="metrica-valor s" style="color:var(--cian)">${esc(num(imp.agua))} L</div><div class="mini">agua</div></div>
        <div><div class="metrica-valor s" style="color:var(--ambar)">+${puntos}</div><div class="mini">puntos</div></div>
      </div>
      <div class="divisor"></div>
      <div class="mini"><strong>Linea base:</strong> ${esc(a.base)}</div>
      <div class="mini" style="margin-top:5px"><strong>Formula:</strong> ${desglose.porCO2e} (CO2e) + ${desglose.porAgua} (agua) + ${desglose.porResiduo} (residuo)
        × dificultad ${desglose.factores.dificultad} × rareza ${desglose.factores.rareza}${
          medio ? ` × evidencia ${evaluarEvidencia({ tipo: medio.tipo, exif: medio.exif, fechaArchivo: medio.fechaArchivo, hash: medio.hash, hashesPrevios: estado.medios || [], ancho: medio.ancho, alto: medio.alto }).factor}` : ''}</div>
      ${val.mensajes.length ? `<div class="aviso ${val.nivel === 'bloqueo' ? 'error' : 'alerta'}" style="margin-top:11px">
        <span>${val.nivel === 'bloqueo' ? '⛔' : '⚠️'}</span><div>${val.mensajes.map(esc).join('<br>')}</div></div>` : ''}`;
  };

  campo.addEventListener('input', () => { deslizador.value = campo.value; actualizar(campo.value); });
  deslizador.addEventListener('input', () => { campo.value = deslizador.value; actualizar(deslizador.value); });
  actualizar(inicial);

  // Prueba aportada por el dispositivo, si la hay.
  let prueba = null;
  const aplicarMedida = (km, detalle) => {
    const v = Math.max(0.01, Math.round(km * 100) / 100);
    campo.value = String(v);
    deslizador.value = String(Math.min(Number(deslizador.max), v));
    prueba = detalle;
    actualizar(v);
  };
  const bloqueGPS = a.cat === 'movilidad' && a.unidad === 'km'
    ? construirVerificacion(a, aplicarMedida)
    : null;

  // Prueba grafica: solo para acciones que se pueden fotografiar de verdad.
  const bloqueMedios = a.evidencia !== 'ninguna'
    ? construirMedios(a, estado, (m) => { medio = m; actualizar(campo.value); })
    : null;

  const contenido = el('div', {}, [
    el('div', { clase: 'fila', estilo: 'margin-bottom:15px' }, [
      el('span', { estilo: 'font-size:33px', texto: a.icono }),
      el('div', {}, [
        el('div', { estilo: 'font-weight:700;font-size:16px', texto: a.titulo }),
        el('div', { clase: 'mini', texto: `${CATEGORIAS[a.cat].etiqueta} · dificultad ${a.dificultad}/5 · ${RAREZAS[a.rareza].etiqueta}` }),
      ]),
    ]),
    restante <= 0
      ? el('div', { clase: 'aviso error' }, ['⛔ Ya has alcanzado el maximo diario de esta accion. Vuelve manana.'])
      : el('div', {}, [
        el('label', { clase: 'campo' }, [
          `Cantidad en ${a.unidad} (maximo hoy: ${num(restante)})`,
          el('div', { clase: 'fila' }, [campo, el('span', { clase: 'mini', estilo: 'width:38px', texto: a.unidad })]),
        ]),
        el('div', { estilo: 'margin:11px 0' }, [deslizador]),
        el('label', { clase: 'campo', estilo: 'margin-bottom:9px' }, ['Nota', nota]),
        a.evidencia !== 'ninguna'
          ? el('label', { clase: 'fila', estilo: 'gap:7px;font-size:13px;color:var(--texto-2);cursor:pointer' },
            [evidencia, `Tengo evidencia (${a.evidencia}) — sube el indice de confianza`])
          : null,
        bloqueGPS,
        bloqueMedios,
        previa,
        el('button', {
          clase: 'btn primario bloque',
          texto: 'Registrar',
          onclick: async () => {
            const res = ctx.almacen.registrar(a.id, Number(campo.value), {
              nota: [nota.value, prueba?.resumen].filter(Boolean).join(' · '),
              evidencia: prueba ? 'gps' : (evidencia.checked ? a.evidencia : null),
              prueba: prueba || null,
              medio,
            });
            if (!res.ok) {
              toast({ titulo: 'No se pudo registrar', texto: res.mensajes.join(' '), tipo: 'error', icono: '⛔' });
              return;
            }
            // El binario solo se guarda si el registro salio adelante, para no
            // dejar archivos huerfanos ocupando espacio.
            if (medio?.blob && medio.id) {
              try {
                await guardarMedio({
                  id: medio.id, registroId: res.registro.id, blob: medio.blob,
                  tipo: medio.tipo, portada: medio.portada || null, fecha: new Date().toISOString(),
                });
              } catch (e) {
                toast({ titulo: 'La prueba no se pudo guardar', texto: 'El registro si se guardo.', tipo: 'error', icono: '⚠️' });
              }
            }
            cerrar();
            celebrar(res, a);
            compartirSiProcede(ctx, res.registro, a, medio?.blob || null);
            ctx.refrescar();
          },
        }),
      ]),
    el('div', { clase: 'divisor' }),
    el('div', { clase: 'mini' }, [el('strong', { texto: 'Base cientifica: ' }), a.base]),
  ]);

  const cerrar = modal(contenido, { titulo: 'Nuevo registro' });
}

/** Cascada de notificaciones tras un registro correcto. */
function celebrar(res, a) {
  toast({
    titulo: `+${res.puntos} puntos`,
    texto: `${a.titulo} · ${co2(res.registro.impacto.co2e)} CO2e evitados`,
    icono: a.icono, tipo: 'exito',
  });
  if (res.mensajes?.length) {
    toast({ titulo: 'Registro ajustado', texto: res.mensajes.join(' '), tipo: 'error', icono: '⚠️', duracion: 6000 });
  }
  for (const l of res.logrosNuevos || []) {
    toast({ titulo: `Insignia: ${l.titulo}`, texto: l.desc, icono: l.icono, tipo: 'logro', duracion: 6500 });
  }
  for (const m of res.misionesCompletadas || []) {
    toast({ titulo: `Mision completada: ${m.titulo}`, texto: `+${m.recompensa.puntos} pts · +${m.recompensa.xp} XP`, icono: '🎯', tipo: 'logro', duracion: 6500 });
  }
  if (res.ascenso?.subioNivel) {
    toast({ titulo: `¡Nivel ${res.ascenso.nivelNuevo}!`, texto: res.ascenso.subioRango ? `Nuevo rango: ${res.ascenso.rangoNuevo.nombre}` : 'Sigue asi', icono: '🚀', tipo: 'logro', duracion: 6500 });
  }
  if (res.congelacionesGanadas > 0) {
    toast({ titulo: 'Congelacion de racha ganada', texto: 'Te protege un dia perdido', icono: '🧊', tipo: 'exito' });
  }
  if (res.bonusDiversidad?.factor > 1) {
    toast({ titulo: res.bonusDiversidad.etiqueta, texto: 'Por repartir el esfuerzo entre categorias', icono: '🧭', tipo: 'exito' });
  }
}


/**
 * Bloque de verificacion con datos del dispositivo.
 *
 * Convierte el autorreporte en medicion: o el GPS del navegador sigue el
 * trayecto en vivo, o la persona suelta una traza exportada desde la app que
 * ya use. En ambos casos la distancia la mide el dispositivo, no la teclea
 * quien registra, y el resultado se contrasta contra la accion elegida.
 */
function construirVerificacion(a, aplicarMedida) {
  const salida = el('div', { clase: 'tarjeta', estilo: 'margin-top:13px' });
  let seguimiento = null;

  const pintar = (estado = {}) => {
    salida.innerHTML = '';
    salida.appendChild(el('div', { clase: 'etiqueta', texto: 'Verificacion con tu dispositivo' }));

    if (seguimiento) {
      const r = estado.resumen || {};
      salida.appendChild(el('div', { estilo: 'margin:11px 0' }, [
        el('div', { clase: 'fila entre' }, [
          el('span', { clase: 'metrica-valor s pulso', texto: `${num(r.distanciaKm || 0, 2)} km` }),
          el('span', { clase: 'mini', texto: `${estado.puntos || 0} puntos GPS` }),
        ]),
        el('div', { clase: 'mini', estilo: 'margin-top:5px',
          texto: r.velocidadMediana
            ? `${num(r.velocidadMediana, 1)} km/h de mediana · ${r.modo?.etiqueta || 'analizando'}`
            : 'Buscando senal... manten esta pantalla abierta.' }),
      ]));
      salida.appendChild(el('button', {
        clase: 'btn bloque', texto: '⏹️ Detener y usar esta medicion',
        onclick: () => {
          const { resumen } = seguimiento.detener();
          seguimiento = null;
          if (!resumen.valida) { pintar({ error: resumen.motivo }); return; }
          const v = verificarContra(resumen, a.id, null);
          aplicarMedida(resumen.distanciaKm, {
            via: 'gps-vivo',
            resumen: `GPS: ${num(resumen.distanciaKm, 2)} km en ${num(resumen.duracionMin, 0)} min`,
            modo: resumen.modo?.etiqueta,
            confianza: resumen.modo?.confianza ?? 0,
          });
          pintar({ hecho: resumen, aviso: v.verificado ? '' : v.motivo });
        },
      }));
      return;
    }

    if (estado.hecho) {
      const r = estado.hecho;
      salida.appendChild(el('div', { clase: 'aviso exito', estilo: 'margin:11px 0' }, [
        el('span', { texto: '✅' }),
        el('div', {}, [
          el('strong', { texto: `${num(r.distanciaKm, 2)} km medidos por el dispositivo` }),
          el('div', { clase: 'mini', estilo: 'margin-top:3px;color:inherit;opacity:.85',
            texto: `${num(r.velocidadMediana, 1)} km/h de mediana · ${r.modo?.etiqueta || '—'}${
              r.modo?.confianza ? ` (confianza ${Math.round(r.modo.confianza * 100)} %)` : ''}${
              r.puntosDescartados ? ` · ${r.puntosDescartados} puntos descartados por ruido` : ''}` }),
        ]),
      ]));
      if (estado.aviso) {
        salida.appendChild(el('div', { clase: 'aviso alerta', estilo: 'margin-bottom:11px' }, ['⚠️ ' + estado.aviso]));
      }
    }

    if (estado.error) {
      salida.appendChild(el('div', { clase: 'aviso error', estilo: 'margin:11px 0' }, ['⚠️ ' + estado.error]));
    }

    salida.appendChild(el('div', { clase: 'fila envuelve', estilo: 'gap:7px;margin-top:11px' }, [
      el('button', {
        clase: 'btn s', texto: '📍 Seguir con GPS',
        onclick: () => {
          try {
            seguimiento = iniciarSeguimiento({
              alActualizar: (resumen, puntos, err) => pintar(err ? { error: err } : { resumen, puntos }),
            });
            pintar({ resumen: {}, puntos: 0 });
          } catch (e) { pintar({ error: e.message }); }
        },
      }),
      (() => {
        const archivo = el('input', { type: 'file', accept: '.gpx,.tcx,application/gpx+xml,text/xml', estilo: 'display:none' });
        archivo.addEventListener('change', async () => {
          const f = archivo.files?.[0];
          if (!f) return;
          try {
            const texto = await f.text();
            const { puntos, formato, conTiempo, total } = parsearTraza(texto, f.name);
            if (!total) { pintar({ error: 'El archivo no contiene puntos de traza legibles.' }); return; }
            if (!conTiempo) { pintar({ error: `Se leyeron ${total} puntos ${formato}, pero ninguno trae hora: sin tiempos no se puede calcular velocidad ni verificar el modo.` }); return; }
            const resumen = analizarTraza(puntos);
            if (!resumen.valida) { pintar({ error: resumen.motivo }); return; }
            const meta = metadatosTraza(texto);
            const v = verificarContra(resumen, a.id, null);
            aplicarMedida(resumen.distanciaKm, {
              via: `archivo-${formato.toLowerCase()}`,
              resumen: `${formato}${meta.aplicacion ? ` de ${meta.aplicacion}` : ''}: ${num(resumen.distanciaKm, 2)} km`,
              modo: resumen.modo?.etiqueta,
              confianza: resumen.modo?.confianza ?? 0,
            });
            pintar({ hecho: resumen, aviso: v.verificado ? '' : v.motivo });
          } catch (e) {
            pintar({ error: 'No se pudo leer el archivo.' });
          }
        });
        const boton = el('button', { clase: 'btn s', texto: '📂 Importar GPX / TCX', onclick: () => archivo.click() });
        return el('span', {}, [boton, archivo]);
      })(),
    ]));

    salida.appendChild(el('div', { clase: 'mini', estilo: 'margin-top:9px' },
      ['Exporta la actividad desde Strava, Garmin, Komoot o Apple Salud y sueltala aqui. El archivo se analiza en tu navegador y no se envia a ningun sitio.']));
  };

  pintar();
  return salida;
}


/**
 * Bloque de prueba grafica.
 *
 * Que la persona adjunte una foto no verifica nada por si solo: cualquiera
 * descarga una imagen. Lo que suma puntos es lo COMPROBABLE de esa foto —que
 * se tomo hoy, cerca de ti, y que no se ha usado antes—, y eso se evalua aqui
 * mismo, en el navegador, mostrando el razonamiento completo.
 */
function construirMedios(a, estado, alAdjuntar) {
  const caja = el('div', { clase: 'tarjeta', estilo: 'margin-top:13px' });
  let actual = null;

  const pintar = (error = null, cargando = false) => {
    caja.innerHTML = '';
    caja.appendChild(el('div', { clase: 'fila entre', estilo: 'margin-bottom:9px' }, [
      el('span', { clase: 'etiqueta', texto: 'Prueba con foto o video' }),
      actual ? el('button', {
        clase: 'btn s', texto: 'Quitar',
        onclick: () => { if (actual?.url) URL.revokeObjectURL(actual.url); actual = null; alAdjuntar(null); pintar(); },
      }) : null,
    ]));

    if (cargando) {
      caja.appendChild(el('div', { clase: 'aviso info pulso' }, ['⏳ Procesando la prueba...']));
      return;
    }
    if (error) {
      caja.appendChild(el('div', { clase: 'aviso error', estilo: 'margin-bottom:11px' }, ['⚠️ ' + error]));
    }

    if (actual) {
      const ev = evaluarEvidencia({
        tipo: actual.tipo, exif: actual.exif, fechaArchivo: actual.fechaArchivo,
        hash: actual.hash, hashesPrevios: estado.medios || [],
        ancho: actual.ancho, alto: actual.alto, bytes: actual.bytes,
        enVivo: actual.enVivo, movimiento: actual.movimiento,
      });
      const meta = NIVELES_EVIDENCIA[ev.nivel];

      caja.appendChild(el('div', { clase: 'fila', estilo: 'gap:13px;align-items:flex-start;margin-bottom:11px' }, [
        actual.tipo === 'video'
          ? el('video', { src: actual.url, controls: 'true', playsinline: 'true', muted: 'true',
              estilo: 'width:150px;border-radius:9px;background:#000' })
          : el('img', { src: actual.url, alt: 'Prueba adjunta',
              estilo: 'width:150px;border-radius:9px;object-fit:cover' }),
        el('div', { clase: 'crece' }, [
          el('div', { clase: 'pastilla', estilo: `background:${meta.color}22;color:${meta.color};margin-bottom:7px`,
            texto: `${meta.etiqueta} · ×${ev.factor}` }),
          el('ul', { estilo: 'margin:0 0 0 17px;padding:0;font-size:11.5px;color:var(--texto-2);line-height:1.6' },
            ev.motivos.map((m) => el('li', { texto: m }))),
          actual.tipo === 'video' && actual.duracion
            ? el('div', { clase: 'mini', estilo: 'margin-top:5px', texto: `${actual.duracion} s de video` })
            : null,
        ]),
      ]));
    }

    const input = selectorMedio(async (file) => {
      pintar(null, true);
      try {
        const m = await procesarMedio(file);
        m.id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        if (actual?.url) URL.revokeObjectURL(actual.url);
        actual = m;
        alAdjuntar(m);
        pintar();
      } catch (e) {
        actual = null;
        alAdjuntar(null);
        pintar(e.message || 'No se pudo procesar el archivo.');
      }
    });

    // Grabar dentro de la app abre la camara en cualquier dispositivo y, sobre
    // todo, hace imposible elegir un archivo de la galeria. Por eso va primero
    // y adjuntar queda como alternativa, no al reves.
    const grabar = async (modo) => {
      const r = await capturar({ modo, segundos: SEGUNDOS_CLIP });
      if (!r) return;
      pintar(null, true);
      try {
        const archivo = new File([r.blob], `prueba.${modo === 'foto' ? 'jpg' : 'webm'}`, { type: r.tipo });
        const m = await procesarMedio(archivo);
        m.id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        m.enVivo = true;
        m.movimiento = r.analisis;
        if (actual?.url) URL.revokeObjectURL(actual.url);
        actual = m;
        alAdjuntar(m);
        pintar();
      } catch (e) {
        pintar(e.message || 'No se pudo procesar lo grabado.');
      }
    };

    const enApp = hayCamaraEnApp();
    caja.appendChild(el('div', { clase: 'fila envuelve', estilo: 'gap:7px' }, [
      enApp ? el('button', {
        clase: `btn s${actual ? '' : ' primario'}`,
        texto: `🎥 Grabar ${SEGUNDOS_CLIP} s ahora`,
        onclick: () => grabar('video'),
      }) : null,
      enApp ? el('button', { clase: 'btn s', texto: '📸 Foto ahora', onclick: () => grabar('foto') }) : null,
      el('button', {
        clase: `btn s${!enApp && !actual ? ' primario' : ''}`,
        texto: '📎 Adjuntar archivo',
        onclick: () => input.click(),
      }),
      input,
    ]));

    caja.appendChild(el('div', { clase: 'mini', estilo: 'margin-top:9px' }, [
      enApp
        ? `Grabar aqui abre la camara directamente y vale mas (×${NIVELES_EVIDENCIA.envivo.factor}): lo que graba la app no puede venir de la galeria. Mientras grabas se mide el movimiento, asi que caminar o correr quedan confirmados por el sensor. Adjuntar un archivo sigue valiendo, con su nivel segun los metadatos.`
        : `Este navegador no permite grabar aqui; en el movil el boton de adjuntar abre la camara. Limite ${LIMITE_ARCHIVO_MB} MB por archivo.`,
      ' Se guarda una miniatura, no el original, y nada sale de tu dispositivo salvo que publiques la accion.',
    ]));
  };

  pintar();
  return caja;
}


/**
 * Comparte la accion recien registrada en el espacio de la persona, si lo tiene
 * activado.
 *
 * VA DETRAS DEL REGISTRO, NO DENTRO. La accion ya esta guardada en el
 * dispositivo cuando esto empieza: si falla la red, el permiso o la nube, no se
 * pierde nada y el aviso es discreto. Un registro que fallara porque no hay
 * cobertura seria un fallo mucho peor que una publicacion que no sale.
 *
 * Y hace falta sincronizar antes: la politica del servidor solo deja publicar
 * sobre un registro que ya existe alli, precisamente para que nadie publique en
 * nombre de acciones inventadas.
 */
async function compartirSiProcede(ctx, registro, accionInfo, blob) {
  const estado = ctx.almacen.get();
  if (!estado.perfil?.compartirAuto || !api.haySesion()) return;
  try {
    await api.sincronizar(estado.registros, (id) => accion(id)?.categoria || 'otras');
    await social.publicar(registro, blob, {
      categoria: accionInfo.categoria,
      descripcion: registro.nota || '',
    });
    toast({ titulo: 'Compartido en tu espacio', icono: '🪪',
      texto: blob ? 'Con tu prueba.' : 'Sin foto: puedes anadirla publicandola a mano.' });
  } catch (e) {
    // Duplicado = ya estaba publicada. No es un fallo que merezca avisar.
    if (/duplicate|unique|23505/i.test(e.message || '')) return;
    toast({ titulo: 'No se pudo compartir', tipo: 'alerta', icono: '⚠️',
      texto: `${e.message} El registro si se guardo.` });
  }
}
