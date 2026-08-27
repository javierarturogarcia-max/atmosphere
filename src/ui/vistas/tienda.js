/** tienda.js — Canje de puntos por recompensas. */
import { el, num, toast, modal, tarjetaMetrica, vacio } from '../componentes.js';
import { recompensasPorFamilia, puedeCanjear, recompensa, FAMILIAS } from '../../data/recompensas.js';
import { nivelDesdeXP } from '../../core/nivel.js';

export function vistaTienda(ctx) {
  const estado = ctx.almacen.get();
  const nivel = nivelDesdeXP(estado.perfil.xp);
  const raiz = el('div');

  raiz.appendChild(el('h1', { texto: 'Recompensas' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Ninguna recompensa incentiva consumo nuevo: eso seria contraproducente. Se financia impacto real, se mejora la herramienta o se reconoce el esfuerzo.' }));

  raiz.appendChild(el('div', { clase: 'rejilla c3 seccion' }, [
    tarjetaMetrica({ etiqueta: 'Puntos disponibles', valor: num(estado.perfil.puntos), icono: '⭐', color: 'var(--ambar)' }),
    tarjetaMetrica({ etiqueta: 'Nivel actual', valor: String(nivel), icono: '🎖️',
      pie: 'Algunas recompensas exigen nivel minimo' }),
    tarjetaMetrica({ etiqueta: 'Canjes realizados', valor: String((estado.canjes || []).length), icono: '🧾',
      pie: `${num((estado.canjes || []).reduce((s, c) => s + c.coste, 0))} pts invertidos` }),
  ]));

  for (const familia of recompensasPorFamilia()) {
    raiz.appendChild(el('div', { clase: 'seccion' }, [
      el('div', { clase: 'fila', estilo: 'margin-bottom:11px' }, [
        el('span', { estilo: 'font-size:19px', texto: familia.icono }),
        el('h2', { estilo: 'margin:0', texto: familia.etiqueta }),
      ]),
      el('div', { clase: 'rejilla ancha' }, familia.items.map((rec) => tarjetaRecompensa(rec, ctx, estado, nivel))),
    ]));
  }

  if ((estado.canjes || []).length) {
    raiz.appendChild(el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: 'Historial de canjes' }),
      el('div', { clase: 'tabla-scroll' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [el('th', { texto: 'Recompensa' }), el('th', { texto: 'Coste' }), el('th', { texto: 'Fecha' })])]),
          el('tbody', {}, [...estado.canjes].reverse().map((c) => {
            const rec = recompensa(c.recompensaId);
            return el('tr', {}, [
              el('td', { texto: `${rec?.icono || ''} ${rec?.titulo || c.recompensaId}` }),
              el('td', { clase: 'mono', texto: `${num(c.coste)} pts` }),
              el('td', { clase: 'mini', texto: new Date(c.fecha).toLocaleDateString('es-ES') }),
            ]);
          })),
        ]),
      ]),
    ]));
  }

  return raiz;
}

function tarjetaRecompensa(rec, ctx, estado, nivel) {
  const permiso = puedeCanjear(rec, { puntos: estado.perfil.puntos, nivel, canjesPrevios: estado.canjes });
  const familia = FAMILIAS[rec.familia];
  const usados = (estado.canjes || []).filter((c) => c.recompensaId === rec.id).length;

  return el('div', { clase: 'tarjeta', estilo: permiso.ok ? '' : 'opacity:.62' }, [
    el('div', { clase: 'fila entre', estilo: 'margin-bottom:9px' }, [
      el('span', { estilo: 'font-size:25px', texto: rec.icono }),
      el('span', { clase: 'pastilla', estilo: `background:${familia.color}22;color:${familia.color}`, texto: familia.etiqueta }),
    ]),
    el('div', { estilo: 'font-weight:700;font-size:14.5px;margin-bottom:5px', texto: rec.titulo }),
    el('div', { clase: 'mini', estilo: 'margin-bottom:9px;min-height:44px', texto: rec.desc }),
    rec.nota ? el('div', { clase: 'mini', estilo: 'font-style:italic;opacity:.75;margin-bottom:11px', texto: rec.nota }) : null,
    el('div', { clase: 'fila entre', estilo: 'padding-top:11px;border-top:1px solid var(--borde)' }, [
      el('div', {}, [
        el('div', { clase: 'mono', estilo: 'font-weight:800;color:var(--ambar);font-size:15px', texto: `${num(rec.coste)} pts` }),
        el('div', { clase: 'mini', estilo: 'font-size:10.5px',
          texto: rec.stock ? `${Math.max(0, rec.stock - usados)} disponibles` : 'Sin limite' }),
      ]),
      el('button', {
        clase: `btn s ${permiso.ok ? 'primario' : ''}`,
        texto: permiso.ok ? 'Canjear' : permiso.motivo,
        disabled: !permiso.ok,
        onclick: () => confirmar(rec, ctx),
      }),
    ]),
  ]);
}

function confirmar(rec, ctx) {
  const cerrar = modal(el('div', {}, [
    el('div', { clase: 'centrado', estilo: 'margin-bottom:15px' }, [
      el('div', { estilo: 'font-size:44px', texto: rec.icono }),
      el('div', { estilo: 'font-weight:700;font-size:17px;margin-top:7px', texto: rec.titulo }),
      el('div', { clase: 'mini', estilo: 'margin-top:5px', texto: rec.desc }),
    ]),
    el('div', { clase: 'aviso info', estilo: 'margin-bottom:15px' },
      [`Se descontaran ${num(rec.coste)} puntos de tu saldo. Esta accion no se puede deshacer.`]),
    el('div', { clase: 'fila', estilo: 'gap:9px' }, [
      el('button', { clase: 'btn crece', texto: 'Cancelar', onclick: () => cerrar() }),
      el('button', {
        clase: 'btn primario crece', texto: 'Confirmar canje',
        onclick: () => {
          const res = ctx.almacen.canjear(rec.id);
          cerrar();
          if (res.ok) {
            toast({ titulo: 'Canje realizado', texto: rec.titulo, icono: rec.icono, tipo: 'logro' });
            ctx.refrescar();
          } else {
            toast({ titulo: 'No se pudo canjear', texto: res.motivo, tipo: 'error', icono: '⛔' });
          }
        },
      }),
    ]),
  ]), { titulo: 'Confirmar canje', ancho: 420 });
}
