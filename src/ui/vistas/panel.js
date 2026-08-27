/** panel.js — Vista principal: estado del jugador y del planeta de un vistazo. */
import { el, num, co2, litros, tarjetaMetrica, graficoLinea, graficoDonut, mapaCalor, progreso, haceCuanto, vacio, modal } from '../componentes.js';
import { leerMedio } from '../medios.js';
import { NIVELES_EVIDENCIA } from '../../core/evidencia.js';
import { CATEGORIAS, accion } from '../../data/acciones.js';
import { progresion, siguienteRango } from '../../core/nivel.js';
import { serieDiaria, compararPeriodos, recomendarPalanca } from '../../core/analitica.js';
import { evaluarLogros, proximosLogros } from '../../core/logros.js';
import { misionesVigentes, evaluarMision } from '../../core/misiones.js';
import { equivalencias, frasEquivalencia } from '../../core/impacto.js';
import { progresoLiga } from '../../core/ranking.js';
import { regresionLineal } from '../../core/estadistica.js';
import { claveDia } from '../../core/rachas.js';

export function vistaPanel(ctx) {
  const estado = ctx.almacen.get();
  const r = ctx.almacen.resumen();
  const prog = progresion(estado.perfil.xp);
  const sig = siguienteRango(prog.nivel);
  const serie = serieDiaria(estado.registros, 'co2e', 30);
  const comp = compararPeriodos(estado.registros, 'co2e', 7);
  const eq = equivalencias(r.co2eTotal);
  const liga = progresoLiga(estado.perfil.puntos);
  const misiones = misionesVigentes(estado.perfil.id, new Date(), { nivel: prog.nivel })
    .map((m) => ({ m, ev: evaluarMision(m, estado.registros) }));
  const activas = misiones.filter((x) => !x.ev.completada).slice(0, 3);
  const ev = evaluarLogros(r, estado.logros);
  const cercanos = proximosLogros(ev.estado, 3);

  const raiz = el('div');

  // --------------------------------------------------------------- cabecera
  raiz.appendChild(el('div', { clase: 'fila entre envuelve', estilo: 'margin-bottom:20px;gap:15px' }, [
    el('div', {}, [
      el('h1', { texto: `Hola, ${estado.perfil.nombre}` }),
      el('div', { clase: 'sub', estilo: 'margin:0' },
        [`${prog.rango.icono} ${prog.rango.nombre} · Nivel ${prog.nivel}${estado.perfil.titulo ? ` · ${estado.perfil.titulo}` : ''}`]),
    ]),
    el('div', { clase: 'fila', estilo: 'gap:9px' }, [
      el('span', { clase: 'chip estatico', texto: `${liga.actual.icono} Liga ${liga.actual.nombre}` }),
      r.rachaActual > 0
        ? el('span', { clase: 'chip estatico', estilo: 'color:var(--naranja);border-color:rgba(251,146,60,.4)', texto: `🔥 ${r.rachaActual} dias` })
        : null,
      estado.perfil.congelaciones > 0
        ? el('span', { clase: 'chip estatico', texto: `🧊 ${estado.perfil.congelaciones}` }) : null,
    ]),
  ]));

  // ------------------------------------------------------------- progresion
  raiz.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('div', { clase: 'fila entre', estilo: 'margin-bottom:10px' }, [
      el('span', { clase: 'etiqueta', texto: `Nivel ${prog.nivel} → ${prog.nivel + 1}` }),
      el('span', { clase: 'mini mono', texto: `${num(prog.xpEnNivel)} / ${num(prog.xpSiguienteNivel - prog.xpInicioNivel)} XP` }),
    ]),
    progreso(prog.progreso, {
      texto: sig
        ? `Faltan ${num(prog.xpRestante)} XP para el nivel ${prog.nivel + 1}. Proximo rango: ${sig.icono} ${sig.nombre} (nivel ${sig.min}).`
        : 'Has alcanzado el rango maximo. Ahora el reto es sostenerlo.',
    }),
  ]));

  // ---------------------------------------------------------------- metricas
  raiz.appendChild(el('div', { clase: 'rejilla c4 seccion' }, [
    tarjetaMetrica({
      etiqueta: 'CO2e evitado', valor: co2(r.co2eTotal), icono: '🌬️',
      delta: comp.sinBase ? null : comp.variacion, color: 'var(--verde)',
      pie: `IC 95 %: ${num(r.co2eIC?.inferior || 0)}–${num(r.co2eIC?.superior || 0)} kg`,
    }),
    tarjetaMetrica({ etiqueta: 'Agua ahorrada', valor: litros(r.aguaTotal), icono: '💧', color: 'var(--cian)',
      pie: `${num(r.aguaTotal / 95, 1)} duchas de 10 min` }),
    tarjetaMetrica({ etiqueta: 'Residuo desviado', valor: `${num(r.residuoTotal)} kg`, icono: '♻️', color: 'var(--verde-2)',
      pie: `${num(r.kwhTotal)} kWh ahorrados` }),
    tarjetaMetrica({ etiqueta: 'Puntos disponibles', valor: num(estado.perfil.puntos), icono: '⭐', color: 'var(--ambar)',
      pie: `${num(estado.perfil.puntosHistoricos)} acumulados en total` }),
  ]));

  // ------------------------------------------------------------ equivalencia
  if (r.co2eTotal > 0) {
    raiz.appendChild(el('div', { clase: 'aviso exito seccion' }, [
      el('span', { texto: '🌍' }),
      el('div', {}, [
        el('strong', { texto: frasEquivalencia(r.co2eTotal) }),
        el('div', { clase: 'mini', estilo: 'margin-top:3px;color:inherit;opacity:.8',
          texto: `Equivale a ${num(eq.kmCoche)} km en coche, ${num(eq.cargasMovil)} cargas de movil o ${num(eq.botellas)} botellas de plastico.` }),
      ]),
    ]));
  }

  // ------------------------------------------------------- serie + categorias
  const izq = el('div', { clase: 'tarjeta' }, [
    el('div', { clase: 'fila entre', estilo: 'margin-bottom:13px' }, [
      el('h2', { estilo: 'margin:0', texto: 'CO2e evitado · 30 dias' }),
      el('span', { clase: 'mini', texto: comp.sinBase ? 'primera semana' : comp.variacion >= 0 ? '▲ mejorando' : '▼ bajando' }),
    ]),
    graficoLinea(serie, { tendencia: regresionLineal(serie.map((p) => p.valor)) }),
    el('div', { clase: 'mini', estilo: 'margin-top:9px' },
      ['Linea continua: impacto diario. Discontinua ambar: tendencia por minimos cuadrados.']),
  ]);

  const datosCat = r.porCategoria.map((c) => ({
    etiqueta: CATEGORIAS[c.cat]?.etiqueta || c.cat,
    valor: c.co2e,
    color: CATEGORIAS[c.cat]?.color || 'var(--verde)',
  }));
  const der = el('div', { clase: 'tarjeta' }, [
    el('h2', { texto: 'Reparto por categoria' }),
    datosCat.length
      ? graficoDonut(datosCat, { centro: { valor: co2(r.co2eTotal), etiqueta: 'total' } })
      : vacio('📊', 'Aun no hay reparto', 'Registra acciones de varias categorias'),
  ]);

  raiz.appendChild(el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [izq, der]));

  // -------------------------------------------------------------- misiones
  raiz.appendChild(el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [
    el('div', { clase: 'tarjeta' }, [
      el('div', { clase: 'fila entre', estilo: 'margin-bottom:13px' }, [
        el('h2', { estilo: 'margin:0', texto: 'Misiones activas' }),
        el('button', { clase: 'btn s', texto: 'Ver todas', onclick: () => ctx.ir('misiones') }),
      ]),
      ...(activas.length ? activas.map(({ m, ev: e }) => el('div', { estilo: 'margin-bottom:14px' }, [
        el('div', { clase: 'fila entre', estilo: 'margin-bottom:5px' }, [
          el('span', { estilo: 'font-size:13px;font-weight:600' , texto: `${m.icono} ${m.titulo}` }),
          el('span', { clase: 'mini mono', texto: `${num(e.actual)}/${num(e.objetivo)}` }),
        ]),
        progreso(e.progreso, { fina: true }),
      ])) : [vacio('🎯', 'Todas las misiones completadas', 'Vuelve manana para nuevos retos')]),
    ]),
    el('div', { clase: 'tarjeta' }, [
      el('div', { clase: 'fila entre', estilo: 'margin-bottom:13px' }, [
        el('h2', { estilo: 'margin:0', texto: 'Insignias a tiro' }),
        el('span', { clase: 'mini', texto: `${ev.desbloqueados}/${ev.total}` }),
      ]),
      ...(cercanos.length ? cercanos.map((l) => el('div', { estilo: 'margin-bottom:14px' }, [
        el('div', { clase: 'fila entre', estilo: 'margin-bottom:5px' }, [
          el('span', { estilo: 'font-size:13px;font-weight:600', texto: `${l.icono} ${l.titulo}` }),
          el('span', { clase: 'mini mono', texto: `${Math.round(l.progreso * 100)} %` }),
        ]),
        progreso(l.progreso, { fina: true, color: l.meta?.color }),
      ])) : [vacio('🏅', 'Sin insignias en curso', 'Registra tu primera accion')]),
    ]),
  ]));

  // ------------------------------------------------------- constancia + tip
  raiz.appendChild(el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [
    el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: 'Constancia · 12 semanas' }),
      mapaCalor(serieDiaria(estado.registros, 'puntos', 84)),
      el('div', { clase: 'fila entre mini', estilo: 'margin-top:9px' }, [
        el('span', { texto: `Racha actual: ${r.rachaActual} d · Mejor: ${r.rachaMejor} d` }),
        el('span', { texto: `${r.diasActivos} dias activos` }),
      ]),
    ]),
    el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: 'Tu siguiente palanca' }),
      (() => {
        const rec = recomendarPalanca(r);
        return el('div', {}, [
          el('div', { estilo: 'font-size:31px;margin-bottom:7px', texto: rec.meta.icono }),
          el('div', { estilo: 'font-weight:700;margin-bottom:5px', texto: rec.meta.etiqueta }),
          el('div', { clase: 'mini', estilo: 'margin-bottom:13px', texto: rec.motivo }),
          el('button', { clase: 'btn primario s', texto: 'Registrar una accion', onclick: () => ctx.ir('registrar') }),
        ]);
      })(),
    ]),
  ]));

  // ------------------------------------------------------ ultimos registros
  const ultimos = [...estado.registros].reverse().slice(0, 6);
  raiz.appendChild(el('div', { clase: 'tarjeta' }, [
    el('h2', { texto: 'Actividad reciente' }),
    ultimos.length ? el('div', { clase: 'tabla-scroll' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, [
          el('th', { texto: 'Accion' }), el('th', { texto: 'Cantidad' }),
          el('th', { texto: 'CO2e' }), el('th', { texto: 'Puntos' }),
          el('th', { texto: 'Prueba' }), el('th', { texto: 'Cuando' }),
        ])]),
        el('tbody', {}, ultimos.map((reg) => {
          const a = accion(reg.accionId);
          return el('tr', {}, [
            el('td', { texto: `${a?.icono || ''} ${a?.titulo || reg.accionId}` }),
            el('td', { clase: 'mono', texto: `${num(reg.cantidad)} ${reg.unidad}` }),
            el('td', { clase: 'mono', estilo: 'color:var(--verde)', texto: co2(reg.impacto.co2e) }),
            el('td', { clase: 'mono', texto: `+${reg.puntos}` }),
            el('td', {}, [
              reg.medio
                ? el('button', {
                  clase: 'chip',
                  estilo: `border-color:${NIVELES_EVIDENCIA[reg.medio.nivel]?.color || 'var(--borde)'}`,
                  texto: `${reg.medio.tipo === 'video' ? '🎥' : '📷'} ×${reg.medio.factor}`,
                  title: NIVELES_EVIDENCIA[reg.medio.nivel]?.etiqueta || 'Prueba adjunta',
                  onclick: () => verPrueba(reg),
                })
                : reg.evidencia === 'gps'
                  ? el('span', { clase: 'chip estatico', texto: '📍 GPS' })
                  : el('span', { clase: 'mini', texto: '—' }),
            ]),
            el('td', { clase: 'mini', texto: haceCuanto(reg.fecha) }),
          ]);
        })),
      ]),
    ]) : vacio('📝', 'Sin actividad todavia', 'Empieza registrando lo que ya haces bien'),
  ]));

  return raiz;
}


/** Abre la prueba grafica guardada en IndexedDB. Sin ella, la evidencia es un acto de fe. */
async function verPrueba(registro) {
  const meta = NIVELES_EVIDENCIA[registro.medio?.nivel];
  const cuerpo = el('div', { clase: 'centrado' }, [el('div', { clase: 'pulso', texto: 'Cargando prueba...' })]);
  modal(cuerpo, { titulo: 'Prueba adjunta', ancho: 520 });
  try {
    const m = await leerMedio(registro.medio.id);
    cuerpo.innerHTML = '';
    if (!m?.blob) {
      cuerpo.appendChild(el('div', { clase: 'aviso alerta' }, ['La prueba ya no esta disponible en este dispositivo.']));
      return;
    }
    const url = URL.createObjectURL(m.blob);
    cuerpo.appendChild(m.tipo === 'video'
      ? el('video', { src: url, controls: 'true', playsinline: 'true', estilo: 'width:100%;border-radius:11px;background:#000' })
      : el('img', { src: url, alt: 'Prueba', estilo: 'width:100%;border-radius:11px' }));
    cuerpo.appendChild(el('div', { clase: 'fila entre', estilo: 'margin-top:13px' }, [
      el('span', { clase: 'pastilla', estilo: `background:${meta?.color || '#888'}22;color:${meta?.color || '#888'}`,
        texto: `${meta?.etiqueta || 'Prueba'} · ×${registro.medio.factor}` }),
      el('span', { clase: 'mini', texto: haceCuanto(registro.fecha) }),
    ]));
  } catch (e) {
    cuerpo.innerHTML = '';
    cuerpo.appendChild(el('div', { clase: 'aviso error' }, ['No se pudo abrir la prueba guardada.']));
  }
}
