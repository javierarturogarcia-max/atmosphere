/** misiones.js — Retos diarios, semanales y de temporada. */
import { el, num, progreso, vacio, tarjetaMetrica } from '../componentes.js';
import { misionesVigentes, evaluarMision, diasRestantes } from '../../core/misiones.js';
import { progresion } from '../../core/nivel.js';

export function vistaMisiones(ctx) {
  const estado = ctx.almacen.get();
  const nivel = progresion(estado.perfil.xp).nivel;
  const todas = misionesVigentes(estado.perfil.id, new Date(), { nivel })
    .map((m) => ({ m, ev: evaluarMision(m, estado.registros) }));
  const completadas = estado.misionesCompletadas || [];
  const hechasIds = new Set(completadas.map((c) => c.id));

  const raiz = el('div');
  raiz.appendChild(el('h1', { texto: 'Misiones' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Los retos se generan de forma determinista a partir de tu perfil y la fecha: mismo dia, mismas misiones, sin servidor. La dificultad escala con tu nivel.' }));

  const activas = todas.filter((x) => !x.ev.completada && !hechasIds.has(x.m.id));
  const listas = todas.filter((x) => x.ev.completada || hechasIds.has(x.m.id));

  raiz.appendChild(el('div', { clase: 'rejilla c3 seccion' }, [
    tarjetaMetrica({ etiqueta: 'Activas', valor: String(activas.length), icono: '🎯' }),
    tarjetaMetrica({ etiqueta: 'Completadas hoy', valor: String(listas.length), icono: '✅', color: 'var(--verde)' }),
    tarjetaMetrica({ etiqueta: 'Historico', valor: num(completadas.length), icono: '🏆', color: 'var(--ambar)',
      pie: `${num(completadas.reduce((s, c) => s + (c.recompensa?.puntos || 0), 0))} pts ganados` }),
  ]));

  for (const [tipo, titulo, desc] of [
    ['diaria', 'Diarias', 'Se renuevan cada dia a medianoche'],
    ['semanal', 'Semanales', 'Ventana de lunes a domingo'],
    ['temporada', 'Reto del mes', 'El objetivo mas ambicioso'],
  ]) {
    const grupo = todas.filter((x) => x.m.tipo === tipo);
    if (!grupo.length) continue;
    raiz.appendChild(el('div', { clase: 'seccion' }, [
      el('div', { clase: 'fila entre', estilo: 'margin-bottom:11px' }, [
        el('h2', { estilo: 'margin:0', texto: titulo }),
        el('span', { clase: 'mini', texto: desc }),
      ]),
      el('div', { clase: 'rejilla ancha' }, grupo.map(({ m, ev }) => tarjetaMision(m, ev, hechasIds.has(m.id)))),
    ]));
  }

  if (completadas.length) {
    raiz.appendChild(el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: 'Ultimas misiones superadas' }),
      el('div', { clase: 'tabla-scroll' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { texto: 'Mision' }), el('th', { texto: 'Tipo' }),
            el('th', { texto: 'Recompensa' }), el('th', { texto: 'Fecha' }),
          ])]),
          el('tbody', {}, [...completadas].reverse().slice(0, 12).map((c) => el('tr', {}, [
            el('td', { texto: c.titulo }),
            el('td', { clase: 'mini', texto: c.tipo }),
            el('td', { clase: 'mono', estilo: 'color:var(--ambar)', texto: `+${c.recompensa?.puntos || 0} pts` }),
            el('td', { clase: 'mini', texto: new Date(c.fecha).toLocaleDateString('es-ES') }),
          ]))),
        ]),
      ]),
    ]));
  }

  return raiz;
}

function tarjetaMision(m, ev, yaCobrada) {
  const dias = diasRestantes(m);
  const completa = ev.completada || yaCobrada;
  return el('div', {
    clase: 'tarjeta',
    estilo: completa ? 'border-color:rgba(52,211,153,.42);background:rgba(52,211,153,.07)' : '',
  }, [
    el('div', { clase: 'fila entre', estilo: 'margin-bottom:9px' }, [
      el('span', { estilo: 'font-size:23px', texto: m.icono }),
      el('span', { clase: 'pastilla', estilo: completa
        ? 'background:rgba(52,211,153,.2);color:var(--verde)'
        : 'background:var(--superficie-2);color:var(--texto-3)',
        texto: completa ? 'Completada' : dias === 0 ? 'Ultimo dia' : `${dias} d restantes` }),
    ]),
    el('div', { estilo: 'font-weight:700;font-size:14.5px;margin-bottom:11px', texto: m.titulo }),
    progreso(ev.progreso, { texto: `${num(ev.actual)} de ${num(ev.objetivo)} ${m.objetivo.unidad || ''}` }),
    el('div', { clase: 'fila entre', estilo: 'margin-top:13px;padding-top:11px;border-top:1px solid var(--borde)' }, [
      el('span', { clase: 'mono', estilo: 'color:var(--ambar);font-weight:700;font-size:13px', texto: `+${m.recompensa.puntos} pts` }),
      el('span', { clase: 'mono mini', texto: `+${m.recompensa.xp} XP` }),
    ]),
  ]);
}
