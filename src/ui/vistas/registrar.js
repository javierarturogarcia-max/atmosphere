/** registrar.js — Catalogo de acciones y formulario de registro. */
import { el, num, co2, toast, modal, esc, vacio } from '../componentes.js';
import { CATEGORIAS, RAREZAS, categoriasConAcciones, accion } from '../../data/acciones.js';
import { calcularImpacto } from '../../core/impacto.js';
import { calcularPuntos } from '../../core/puntos.js';
import { validarRegistro, NIVELES } from '../../core/validacion.js';
import { claveDia } from '../../core/rachas.js';

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
        × dificultad ${desglose.factores.dificultad} × rareza ${desglose.factores.rareza}</div>
      ${val.mensajes.length ? `<div class="aviso ${val.nivel === 'bloqueo' ? 'error' : 'alerta'}" style="margin-top:11px">
        <span>${val.nivel === 'bloqueo' ? '⛔' : '⚠️'}</span><div>${val.mensajes.map(esc).join('<br>')}</div></div>` : ''}`;
  };

  campo.addEventListener('input', () => { deslizador.value = campo.value; actualizar(campo.value); });
  deslizador.addEventListener('input', () => { campo.value = deslizador.value; actualizar(deslizador.value); });
  actualizar(inicial);

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
        previa,
        el('button', {
          clase: 'btn primario bloque',
          texto: 'Registrar',
          onclick: () => {
            const res = ctx.almacen.registrar(a.id, Number(campo.value), {
              nota: nota.value, evidencia: evidencia.checked ? a.evidencia : null,
            });
            if (!res.ok) {
              toast({ titulo: 'No se pudo registrar', texto: res.mensajes.join(' '), tipo: 'error', icono: '⛔' });
              return;
            }
            cerrar();
            celebrar(res, a);
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
