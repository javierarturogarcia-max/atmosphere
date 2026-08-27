/** ciencia.js — Estado del planeta: indicadores, limites planetarios y metodologia. */
import { el, num, tarjetaMetrica, progreso, esc } from '../componentes.js';
import { INDICADORES, LIMITES_PLANETARIOS } from '../../data/indicadores.js';
import { GWP100, MOVILIDAD, ALIMENTOS, RESIDUOS, SUMIDEROS } from '../../data/factores.js';
import { PESOS, K_SATURACION, TOPE_DIARIO } from '../../core/puntos.js';

export function vistaCiencia(ctx) {
  const raiz = el('div');
  raiz.appendChild(el('h1', { texto: 'Ciencia' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Los datos que sostienen la aplicacion, con fuente y anio. Sin esto, una app de sostenibilidad es solo una lista de buenas intenciones.' }));

  // ------------------------------------------------------- limites planetarios
  const transgredidos = LIMITES_PLANETARIOS.filter((l) => l.estado === 'transgredido').length;
  raiz.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('div', { clase: 'fila entre', estilo: 'margin-bottom:13px' }, [
      el('h2', { estilo: 'margin:0', texto: 'Limites planetarios' }),
      el('span', { clase: 'pastilla', estilo: 'background:rgba(248,113,113,.16);color:var(--rojo)',
        texto: `${transgredidos} de 9 transgredidos` }),
    ]),
    el('div', { clase: 'rejilla c3' }, LIMITES_PLANETARIOS.map((l) => {
      const color = l.estado === 'transgredido' ? 'var(--rojo)' : l.estado === 'en el limite' ? 'var(--ambar)' : 'var(--verde)';
      return el('div', { estilo: `padding:11px;border-radius:10px;background:var(--superficie);border-left:3px solid ${color}` }, [
        el('div', { estilo: 'font-size:13px;font-weight:650;margin-bottom:3px', texto: l.nombre }),
        el('div', { clase: 'mini', estilo: `color:${color};text-transform:capitalize`, texto: l.estado }),
      ]);
    })),
    el('div', { clase: 'mini', estilo: 'margin-top:13px' },
      ['Marco de Rockström y Richardson et al. (2023), Science Advances. Define el "espacio operativo seguro" de la humanidad. Seis de los nueve limites ya estan fuera de esa zona.']),
  ]));

  // ----------------------------------------------------------- indicadores
  raiz.appendChild(el('h2', { estilo: 'margin-bottom:13px', texto: 'Indicadores del sistema Tierra' }));
  raiz.appendChild(el('div', { clase: 'rejilla ancha seccion' }, INDICADORES.map((i) => el('div', {
    clase: 'tarjeta',
    estilo: i.critico ? 'border-left:3px solid var(--rojo)' : i.positivo ? 'border-left:3px solid var(--verde)' : '',
  }, [
    el('div', { clase: 'fila entre', estilo: 'margin-bottom:7px' }, [
      el('span', { clase: 'etiqueta', texto: i.titulo }),
      el('span', { clase: 'mini mono', texto: String(i.anio) }),
    ]),
    el('div', { clase: 'fila', estilo: 'align-items:baseline;gap:5px' }, [
      el('span', { clase: 'metrica-valor s', estilo: i.critico ? 'color:var(--rojo)' : i.positivo ? 'color:var(--verde)' : '', texto: num(i.valor) }),
      el('span', { clase: 'metrica-unidad', texto: i.unidad }),
    ]),
    i.tendencia ? el('div', { clase: 'mini', estilo: 'margin-top:3px',
      texto: `${i.tendencia > 0 ? '▲' : '▼'} ${num(Math.abs(i.tendencia))} ${i.unidadTendencia}` }) : null,
    el('div', { clase: 'mini', estilo: 'margin-top:7px;font-weight:600;color:var(--texto-2)', texto: i.referencia }),
    el('div', { clase: 'mini', estilo: 'margin-top:7px;line-height:1.45', texto: i.detalle }),
    el('div', { clase: 'mini', estilo: 'margin-top:9px;padding-top:9px;border-top:1px solid var(--borde);font-size:10.5px;opacity:.75', texto: `Fuente: ${i.fuente}` }),
  ]))));

  // ------------------------------------------------------------- metodologia
  raiz.appendChild(el('h2', { estilo: 'margin-bottom:13px', texto: 'Metodologia de la aplicacion' }));
  raiz.appendChild(el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [
    el('div', { clase: 'tarjeta' }, [
      el('h3', { texto: 'Como se calculan los puntos' }),
      el('pre', {
        estilo: 'font-family:var(--mono);font-size:11.5px;background:var(--fondo-2);padding:13px;border-radius:9px;overflow-x:auto;line-height:1.65;border:1px solid var(--borde)',
        texto: `base    = ${PESOS.porKgCO2e}·CO2e + ${PESOS.porLitroAgua}·agua + ${PESOS.porKgResiduo}·residuo
bruto   = base × f_dificultad × f_rareza
                × f_racha × f_mision × f_evento
S(x)    = ${K_SATURACION} · ln(1 + x/${K_SATURACION})
puntos  = S(acum + bruto) − S(acum)
tope    = ${TOPE_DIARIO} pts/dia`,
      }),
      el('div', { clase: 'mini', estilo: 'margin-top:11px' },
        ['Los puntos derivan del impacto fisico, no del capricho del diseno. La funcion de saturacion S(x) es concava: repetir la misma categoria el mismo dia rinde cada vez menos, lo que impide "farmear" una accion facil.']),
    ]),
    el('div', { clase: 'tarjeta' }, [
      el('h3', { texto: 'Potenciales de calentamiento (GWP-100)' }),
      tabla(Object.entries(GWP100).map(([gas, v]) => [gas.replace(/_/g, ' '), num(v)])),
      el('div', { clase: 'mini', estilo: 'margin-top:11px' },
        ['IPCC AR6 (2021). Un kilo de metano fosil calienta 29,8 veces mas que un kilo de CO2 en un horizonte de 100 anios: por eso el compostaje evita tanto impacto pese a mover poca masa.']),
    ]),
  ]));

  raiz.appendChild(el('div', { clase: 'rejilla c3 seccion', estilo: 'align-items:start' }, [
    el('div', { clase: 'tarjeta' }, [
      el('h3', { texto: 'Movilidad (kg CO2e/pkm)' }),
      tabla(Object.entries(MOVILIDAD).slice(0, 12).map(([, v]) => [v.etiqueta, num(v.co2e, 3)])),
      el('div', { clase: 'mini', estilo: 'margin-top:9px', texto: 'DEFRA/BEIS 2023 y EEA.' }),
    ]),
    el('div', { clase: 'tarjeta' }, [
      el('h3', { texto: 'Alimentos (kg CO2e/kg)' }),
      tabla(Object.entries(ALIMENTOS).slice(0, 12).map(([, v]) => [v.etiqueta, num(v.co2e)])),
      el('div', { clase: 'mini', estilo: 'margin-top:9px', texto: 'Poore & Nemecek (2018), Science: 38.700 granjas de 119 paises.' }),
    ]),
    el('div', { clase: 'tarjeta' }, [
      el('h3', { texto: 'Residuos (kg CO2e evitados/kg)' }),
      tabla(Object.entries(RESIDUOS).map(([, v]) => [v.etiqueta, num(v.co2e_evitado)])),
      el('div', { clase: 'mini', estilo: 'margin-top:9px', texto: 'EPA WARM v15 (2023).' }),
    ]),
  ]));

  raiz.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('h3', { texto: 'Advertencias metodologicas honestas' }),
    el('ul', { estilo: 'margin:9px 0 0 19px;font-size:13px;color:var(--texto-2);line-height:1.75' }, [
      el('li', { texto: 'Los factores son promedios globales o regionales; un analisis de ciclo de vida tiene una incertidumbre tipica del 20-50 %. La app propaga esa incertidumbre y muestra intervalos de confianza en vez de cifras falsamente exactas.' }),
      el('li', { texto: 'El impacto "evitado" siempre depende de una linea base contrafactual. Ir en bici solo evita emisiones si sustituye un trayecto en coche: si ese trayecto no iba a existir, el ahorro es cero.' }),
      el('li', { texto: 'El efecto rebote es real: quien ahorra en energia a veces gasta ese dinero en algo mas intensivo. La reduccion neta suele ser menor que la suma de las acciones individuales.' }),
      el('li', { texto: 'La accion individual es necesaria pero no suficiente. Aproximadamente el 70 % de las emisiones depende de decisiones sistemicas de empresas y gobiernos: por eso el catalogo incluye acciones comunitarias y de incidencia.' }),
      el('li', { texto: `Un arbol maduro absorbe unos ${SUMIDEROS.arbol_anio} kg de CO2 al anio, pero tarda decadas en llegar a ese ritmo y puede liberarlo entero en un incendio. Plantar arboles no compensa emitir hoy.` }),
    ]),
  ]));

  return raiz;
}

function tabla(filas) {
  return el('div', { clase: 'tabla-scroll' }, [
    el('table', {}, [el('tbody', {}, filas.map(([k, v]) => el('tr', {}, [
      el('td', { estilo: 'font-size:12.5px', texto: k }),
      el('td', { clase: 'mono', estilo: 'text-align:right;font-weight:650;white-space:nowrap', texto: v }),
    ])))]),
  ]);
}
