/** ranking.js — Clasificacion, ligas y comparacion social. */
import { el, num, co2, tarjetaMetrica, progreso, medidor } from '../componentes.js';
import { clasificacion, progresoLiga, LIGAS } from '../../core/ranking.js';
import { claveSemana } from '../../core/misiones.js';

export function vistaRanking(ctx) {
  const estado = ctx.almacen.get();
  const r = ctx.almacen.resumen();
  const semana = claveSemana(new Date());
  const liga = progresoLiga(estado.perfil.puntos);

  const cl = clasificacion({
    nombre: estado.perfil.nombre, puntos: estado.perfil.puntos,
    xp: estado.perfil.xp, co2e: r.co2eTotal, racha: r.rachaActual,
  }, { semilla: `${liga.actual.id}|${semana}`, n: 39 });

  const raiz = el('div');
  raiz.appendChild(el('h1', { texto: 'Clasificacion' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'La cohorte de comparacion se genera con una distribucion log-normal, que es la forma real que tiene la participacion en cualquier comunidad voluntaria: pocos muy activos y una mayoria moderada. Al conectar un servidor, estos datos se sustituyen por personas reales sin cambiar nada mas.' }));

  raiz.appendChild(el('div', { clase: 'rejilla c4 seccion' }, [
    tarjetaMetrica({ etiqueta: 'Tu posicion', valor: `#${cl.posicion}`, icono: '🏆',
      color: cl.posicion <= 3 ? 'var(--ambar)' : null, pie: `de ${cl.total} participantes` }),
    tarjetaMetrica({ etiqueta: 'Percentil', valor: `${num(cl.percentil, 0)}`, icono: '📊',
      pie: `Superas al ${num(cl.percentil, 0)} % de la cohorte` }),
    tarjetaMetrica({ etiqueta: 'Liga actual', valor: `${liga.actual.icono} ${liga.actual.nombre}`, icono: '🎖️',
      pie: liga.siguiente ? `Faltan ${num(liga.faltan)} pts para ${liga.siguiente.nombre}` : 'Liga maxima alcanzada' }),
    tarjetaMetrica({ etiqueta: 'Para subir un puesto', valor: cl.faltanParaSubir ? `+${num(cl.faltanParaSubir)}` : '—', unidad: 'pts', icono: '⬆️' }),
  ]));

  raiz.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('div', { clase: 'fila entre', estilo: 'margin-bottom:11px' }, [
      el('h2', { estilo: 'margin:0', texto: 'Progreso de liga' }),
      el('span', { clase: 'mini', texto: `${num(estado.perfil.puntos)} puntos` }),
    ]),
    progreso(liga.progreso, {
      color: liga.actual.color,
      texto: liga.siguiente
        ? `${liga.actual.icono} ${liga.actual.nombre} → ${liga.siguiente.icono} ${liga.siguiente.nombre} (${num(liga.siguiente.min)} pts)`
        : 'Has llegado a la cima del sistema de ligas.',
    }),
    el('div', { clase: 'fila envuelve', estilo: 'margin-top:15px;gap:7px' }, LIGAS.map((l) =>
      el('span', {
        clase: 'chip estatico',
        estilo: l.id === liga.actual.id ? `border-color:${l.color};color:${l.color}` : 'opacity:.5',
        texto: `${l.icono} ${l.nombre} · ${num(l.min)}`,
      }))),
  ]));

  raiz.appendChild(el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [
    el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: `Tabla semanal · ${semana}` }),
      el('div', { clase: 'tabla-scroll', estilo: 'max-height:460px;overflow-y:auto' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { texto: '#' }), el('th', { texto: 'Participante' }),
            el('th', { texto: 'Puntos' }), el('th', { texto: 'CO2e' }), el('th', { texto: 'Racha' }),
          ])]),
          el('tbody', {}, cl.tabla.slice(0, 25).map((p) => el('tr', { clase: p.esUsuario ? 'destacada' : '' }, [
            el('td', { clase: 'mono', texto: p.posicion <= 3 ? ['🥇', '🥈', '🥉'][p.posicion - 1] : String(p.posicion) }),
            el('td', {}, [
              el('div', { estilo: 'font-weight:600', texto: p.esUsuario ? `${p.nombre} (tu)` : p.nombre }),
              el('div', { clase: 'mini', estilo: 'font-size:10.5px', texto: `${p.rango.icono} ${p.rango.nombre} · nv ${p.nivel}` }),
            ]),
            el('td', { clase: 'mono', texto: num(p.puntos) }),
            el('td', { clase: 'mono mini', texto: co2(p.co2e) }),
            el('td', { clase: 'mono mini', texto: p.racha > 0 ? `🔥 ${p.racha}` : '—' }),
          ]))),
        ]),
      ]),
    ]),
    el('div', { clase: 'col' }, [
      el('div', { clase: 'tarjeta centrado' }, [
        el('h2', { texto: 'Tu percentil' }),
        medidor(Math.round(cl.percentil), { max: 100, color: 'var(--verde)', sufijo: 'percentil' }),
        el('div', { clase: 'mini', estilo: 'margin-top:9px',
          texto: cl.percentil >= 90 ? 'Estas en el 10 % mas activo de tu liga.'
            : cl.percentil >= 50 ? 'Por encima de la mediana de tu liga.'
            : 'Por debajo de la mediana: hay mucho margen por delante.' }),
      ]),
      el('div', { clase: 'tarjeta' }, [
        el('h2', { texto: 'Estadisticas de la cohorte' }),
        el('div', { clase: 'tabla-scroll' }, [
          el('table', {}, [el('tbody', {}, [
            fila('Mediana de puntos', num(cl.estadisticasCohorte.mediana)),
            fila('Percentil 90', num(cl.estadisticasCohorte.p90)),
            fila('Coeficiente de Gini', num(cl.estadisticasCohorte.gini, 3)),
            fila('Participantes', String(cl.total)),
          ])]),
        ]),
        el('div', { clase: 'mini', estilo: 'margin-top:11px' },
          [`Un Gini de ${num(cl.estadisticasCohorte.gini, 2)} indica ${cl.estadisticasCohorte.gini > 0.5 ? 'una participacion muy concentrada en pocas personas' : 'un reparto relativamente equilibrado del esfuerzo'}.`]),
      ]),
    ]),
  ]));

  raiz.appendChild(el('div', { clase: 'aviso info' }, [
    el('span', { texto: '🔒' }),
    el('div', { texto: 'Tus datos nunca salen de este dispositivo. La comparacion es local y sintetica: no se envia nada a ningun servidor y no hay telemetria.' }),
  ]));

  return raiz;
}

function fila(k, v) {
  return el('tr', {}, [
    el('td', { estilo: 'font-size:13px', texto: k }),
    el('td', { clase: 'mono', estilo: 'text-align:right;font-weight:700', texto: v }),
  ]);
}
