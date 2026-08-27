/** logros.js — Galeria de insignias con progreso. */
import { el, num, progreso, tarjetaMetrica } from '../componentes.js';
import { evaluarLogros, resumenPorNivel, completitud } from '../../core/logros.js';
import { NIVELES_LOGRO } from '../../data/logros.js';

let filtro = 'todos';

export function vistaLogros(ctx) {
  const estado = ctx.almacen.get();
  const r = ctx.almacen.resumen();
  const ev = evaluarLogros(r, estado.logros);
  const porNivel = resumenPorNivel(ev.estado);
  const comp = completitud(ev.estado);

  const raiz = el('div');
  raiz.appendChild(el('h1', { texto: 'Insignias' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Cada insignia evalua una condicion medible sobre tu historial. No se pueden comprar ni regalar: se ganan con impacto verificable.' }));

  raiz.appendChild(el('div', { clase: 'rejilla c4 seccion' }, [
    tarjetaMetrica({ etiqueta: 'Desbloqueadas', valor: `${ev.desbloqueados}/${ev.total}`, icono: '🏅', color: 'var(--ambar)' }),
    tarjetaMetrica({ etiqueta: 'Completitud ponderada', valor: `${comp} %`, icono: '📈', color: 'var(--verde)',
      pie: 'El platino pesa 8 veces mas que el bronce' }),
    tarjetaMetrica({ etiqueta: 'XP por insignias', valor: num(ev.estado.filter((e) => e.desbloqueado).reduce((s, e) => s + (e.meta?.xp || 0), 0)), icono: '⚡' }),
    tarjetaMetrica({ etiqueta: 'Mas cercana', valor: `${Math.round((ev.estado.filter((e) => !e.desbloqueado).sort((a, b) => b.progreso - a.progreso)[0]?.progreso || 0) * 100)} %`, icono: '🎯' }),
  ]));

  const chips = el('div', { clase: 'fila envuelve scroll-x', estilo: 'margin-bottom:20px;gap:7px' });
  const opciones = [['todos', 'Todas', '🌐'], ...Object.entries(NIVELES_LOGRO).map(([k, v]) => [k, v.etiqueta, '●'])];
  const galeria = el('div', { clase: 'rejilla auto' });

  const pintar = () => {
    [...chips.children].forEach((c, i) => { c.className = `chip${filtro === opciones[i][0] ? ' activo' : ''}`; });
    galeria.innerHTML = '';
    const items = ev.estado
      .filter((e) => filtro === 'todos' || e.nivel === filtro)
      .sort((a, b) => (b.desbloqueado - a.desbloqueado) || (b.progreso - a.progreso));
    for (const l of items) galeria.appendChild(tarjetaLogro(l));
  };

  for (const [id, etiqueta, icono] of opciones) {
    chips.appendChild(el('button', {
      clase: 'chip', texto: `${icono} ${etiqueta}`,
      estilo: NIVELES_LOGRO[id] ? `color:${NIVELES_LOGRO[id].color}` : '',
      onclick: () => { filtro = id; pintar(); },
    }));
  }

  raiz.appendChild(chips);
  raiz.appendChild(el('div', { clase: 'rejilla c4 seccion' }, Object.entries(porNivel).map(([nivel, d]) =>
    el('div', { clase: 'tarjeta' }, [
      el('div', { clase: 'fila entre', estilo: 'margin-bottom:7px' }, [
        el('span', { clase: 'etiqueta', estilo: `color:${d.meta.color}`, texto: d.meta.etiqueta }),
        el('span', { clase: 'mono mini', texto: `${d.hechos}/${d.total}` }),
      ]),
      progreso(d.total ? d.hechos / d.total : 0, { fina: true, color: d.meta.color }),
    ]))));
  raiz.appendChild(galeria);
  pintar();

  return raiz;
}

function tarjetaLogro(l) {
  return el('div', {
    clase: `insignia ${l.desbloqueado ? 'desbloqueada' : 'bloqueada'}`,
    estilo: l.desbloqueado ? `box-shadow:inset 0 0 0 1px ${l.meta.color}55` : '',
    title: l.desc,
  }, [
    el('div', { clase: 'insignia-icono', texto: l.icono }),
    el('div', { clase: 'insignia-titulo', texto: l.titulo }),
    el('div', { clase: 'insignia-nivel', estilo: `color:${l.meta.color}`, texto: l.meta.etiqueta }),
    el('div', { clase: 'mini', estilo: 'font-size:10.5px;line-height:1.35;min-height:28px', texto: l.desc }),
    !l.desbloqueado
      ? el('div', { estilo: 'width:100%;margin-top:3px' }, [
        progreso(l.progreso, { fina: true, color: l.meta.color }),
        el('div', { clase: 'mini', estilo: 'font-size:10px;margin-top:3px', texto: `${num(l.actual)} / ${num(l.objetivo)}` }),
      ])
      : el('div', { clase: 'mini', estilo: `color:${l.meta.color};font-weight:700`, texto: `+${l.meta.xp} XP` }),
  ]);
}
