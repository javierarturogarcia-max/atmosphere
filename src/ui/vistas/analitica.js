/** analitica.js — Analisis estadistico del historial personal. */
import { el, num, co2, tarjetaMetrica, graficoLinea, graficoBarras, graficoDonut, mapaCalor, vacio, esc } from '../componentes.js';
import { serieDiaria, analizarSerie, compararPeriodos, perfilHorario, perfilSemanal } from '../../core/analitica.js';
import { CATEGORIAS, accion } from '../../data/acciones.js';
import { regresionLineal } from '../../core/estadistica.js';
import { indiceConfianza } from '../../core/validacion.js';
import { equivalencias } from '../../core/impacto.js';

let metrica = 'co2e';
let ventana = 30;

const METRICAS = {
  co2e: { etiqueta: 'CO2e evitado', unidad: 'kg', color: 'var(--verde)' },
  agua: { etiqueta: 'Agua ahorrada', unidad: 'L', color: 'var(--cian)' },
  residuo: { etiqueta: 'Residuo desviado', unidad: 'kg', color: 'var(--verde-2)' },
  puntos: { etiqueta: 'Puntos', unidad: 'pts', color: 'var(--ambar)' },
  n: { etiqueta: 'Numero de acciones', unidad: '', color: 'var(--morado)' },
};

export function vistaAnalitica(ctx) {
  const estado = ctx.almacen.get();
  const r = ctx.almacen.resumen();
  const raiz = el('div');

  raiz.appendChild(el('h1', { texto: 'Analitica' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Estimadores robustos (Theil-Sen, Mann-Kendall) en vez de una simple recta: las series de conducta tienen valores atipicos y no son normales.' }));

  if (!estado.registros.length) {
    raiz.appendChild(vacio('📊', 'Sin datos que analizar', 'Registra unos cuantos dias de actividad y vuelve'));
    return raiz;
  }

  // ------------------------------------------------------------- controles
  const controles = el('div', { clase: 'fila envuelve seccion', estilo: 'gap:7px' });
  const cuerpo = el('div');

  const pintarControles = () => {
    controles.innerHTML = '';
    for (const [id, m] of Object.entries(METRICAS)) {
      controles.appendChild(el('button', {
        clase: `chip${metrica === id ? ' activo' : ''}`, texto: m.etiqueta,
        onclick: () => { metrica = id; pintar(); },
      }));
    }
    controles.appendChild(el('span', { estilo: 'width:14px' }));
    for (const v of [14, 30, 90, 180]) {
      controles.appendChild(el('button', {
        clase: `chip${ventana === v ? ' activo' : ''}`, texto: `${v} d`,
        onclick: () => { ventana = v; pintar(); },
      }));
    }
  };

  function pintar() {
    pintarControles();
    cuerpo.innerHTML = '';
    const meta = METRICAS[metrica];
    const serie = serieDiaria(estado.registros, metrica, ventana);
    const a = analizarSerie(serie, { horizonte: 30 });
    const comp = compararPeriodos(estado.registros, metrica, Math.min(14, Math.floor(ventana / 2)));
    const ols = regresionLineal(serie.map((p) => p.valor));

    // Metricas descriptivas
    cuerpo.appendChild(el('div', { clase: 'rejilla c4 seccion' }, [
      tarjetaMetrica({ etiqueta: `Total ${ventana} d`, valor: num(a.total), unidad: meta.unidad, color: meta.color,
        delta: comp.sinBase ? null : comp.variacion, pie: comp.sinBase ? 'Sin periodo previo con el que comparar' : '' }),
      tarjetaMetrica({ etiqueta: 'Media diaria', valor: num(a.media), unidad: meta.unidad,
        pie: `Mediana ${num(a.mediana)} · sigma ${num(a.desviacion)}` }),
      tarjetaMetrica({ etiqueta: 'Dias con actividad', valor: `${a.diasActivos}/${a.n}`,
        pie: `Tasa ${(a.tasaActividad * 100).toFixed(0)} %` }),
      tarjetaMetrica({
        etiqueta: 'Proyeccion 30 d',
        valor: a.proyeccion.fiable ? num(a.proyeccion.porTendencia) : num(a.proyeccion.porMedia),
        unidad: meta.unidad,
        color: a.proyeccion.fiable ? null : 'var(--texto-2)',
        pie: a.proyeccion.fiable
          ? `Tendencia robusta · por media constante: ${num(a.proyeccion.porMedia)}`
          : a.proyeccion.motivo,
      }),
    ]));

    // Serie principal
    cuerpo.appendChild(el('div', { clase: 'tarjeta seccion' }, [
      el('div', { clase: 'fila entre', estilo: 'margin-bottom:13px' }, [
        el('h2', { estilo: 'margin:0', texto: `${meta.etiqueta} · ultimos ${ventana} dias` }),
        el('span', { clase: 'pastilla', estilo: `background:${a.tendencia.significativa ? 'rgba(52,211,153,.16)' : 'var(--superficie-2)'};color:${a.tendencia.significativa ? 'var(--verde)' : 'var(--texto-3)'}`,
          texto: a.tendencia.mannKendall.texto }),
      ]),
      graficoLinea(serie, { alto: 190, color: meta.color, tendencia: ols }),
    ]));

    // Panel estadistico
    cuerpo.appendChild(el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [
      el('div', { clase: 'tarjeta' }, [
        el('h2', { texto: 'Contraste de tendencia' }),
        tablaEstadistica([
          ['Pendiente OLS', `${num(a.tendencia.ols, 4)} ${meta.unidad}/dia`, 'Minimos cuadrados: sensible a atipicos'],
          ['Pendiente Theil-Sen', `${num(a.tendencia.theilSen, 4)} ${meta.unidad}/dia`, 'Mediana de pendientes por pares: robusta'],
          ['R² del ajuste', num(a.tendencia.r2, 3), 'Varianza explicada por la recta'],
          ['tau de Kendall', num(a.tendencia.mannKendall.tau, 3), 'Concordancia monotona en [-1, 1]'],
          ['p (bilateral)', num(a.tendencia.mannKendall.p, 4), a.tendencia.significativa ? 'Significativa a alfa = 0,05' : 'No significativa a alfa = 0,05'],
          ['Coef. de variacion', num(a.coefVariacion, 3), 'Dispersion relativa: constancia del habito'],
        ]),
        el('div', { clase: `aviso ${a.tendencia.significativa ? 'exito' : 'info'}`, estilo: 'margin-top:13px' }, [
          el('span', { texto: a.tendencia.significativa ? '📈' : 'ℹ️' }),
          el('div', { texto: interpretacion(a, meta) }),
        ]),
      ]),
      el('div', { clase: 'tarjeta' }, [
        el('h2', { texto: 'Diversidad de conducta' }),
        tablaEstadistica([
          ['Indice de Shannon (H)', num(r.shannon, 3), 'Entropia del reparto entre categorias'],
          ['Equidad de Pielou', num(r.pielou, 3), '1 = esfuerzo perfectamente repartido'],
          ['Gini de categorias', num(r.gini, 3), '0 = igualdad, 1 = concentracion total'],
          ['Categorias activas', `${r.categoriasUsadas}/8`, 'Amplitud de tu accion ambiental'],
          ['Acciones distintas', String(r.accionesDistintas), 'Exploracion del catalogo'],
          ['Indice de confianza', num(indiceConfianza(estado.registros).valor, 2), indiceConfianza(estado.registros).etiqueta],
        ]),
        el('div', { clase: 'aviso info', estilo: 'margin-top:13px' }, [
          el('span', { texto: '🧭' }),
          el('div', { texto: r.pielou > 0.8
            ? 'Tu esfuerzo esta muy bien repartido: es el perfil que mas reduce la huella total.'
            : 'Concentras el esfuerzo en pocas categorias. Diversificar suele dar mas reduccion por unidad de esfuerzo.' }),
        ]),
      ]),
    ]));

    // Descomposicion por categoria y accion
    const porCat = r.porCategoria.map((c) => ({
      etiqueta: CATEGORIAS[c.cat]?.etiqueta || c.cat,
      valor: metrica === 'puntos' ? c.puntos : (c[metrica] ?? c.co2e),
      color: CATEGORIAS[c.cat]?.color,
    })).filter((d) => d.valor > 0);

    const topAcciones = Object.entries(r.conteoAcciones)
      .map(([id, n]) => ({ etiqueta: `${accion(id)?.icono || ''} ${accion(id)?.titulo || id}`, valor: n, color: CATEGORIAS[accion(id)?.cat]?.color }))
      .sort((x, y) => y.valor - x.valor).slice(0, 8);

    cuerpo.appendChild(el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [
      el('div', { clase: 'tarjeta' }, [el('h2', { texto: 'Aportacion por categoria' }),
        porCat.length ? graficoDonut(porCat, { centro: { valor: num(porCat.reduce((s, d) => s + d.valor, 0)), etiqueta: meta.unidad || 'total' } }) : vacio('📊', 'Sin datos')]),
      el('div', { clase: 'tarjeta' }, [el('h2', { texto: 'Acciones mas repetidas' }),
        topAcciones.length ? graficoBarras(topAcciones, { unidad: 'x' }) : vacio('📊', 'Sin datos')]),
    ]));

    // Patrones temporales
    const ph = perfilHorario(estado.registros);
    const ps = perfilSemanal(estado.registros);
    cuerpo.appendChild(el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [
      el('div', { clase: 'tarjeta' }, [
        el('h2', { texto: 'Ritmo circadiano de tus acciones' }),
        graficoBarras(ph.horas.map((v, i) => ({ etiqueta: `${String(i).padStart(2, '0')}:00`, valor: v }))
          .filter((d) => d.valor > 0).slice(0, 10), { unidad: '' }),
        el('div', { clase: 'mini', estilo: 'margin-top:9px', texto: `Hora punta: ${String(ph.pico).padStart(2, '0')}:00. Encadenar el habito a una rutina fija a esa hora es lo que mas eleva la adherencia.` }),
      ]),
      el('div', { clase: 'tarjeta' }, [
        el('h2', { texto: 'Reparto semanal' }),
        graficoBarras(ps.dias.map((v, i) => ({ etiqueta: ps.etiquetas[i], valor: v })), { unidad: '' }),
        el('div', { clase: 'mini', estilo: 'margin-top:9px', texto: `Tu dia mas activo es ${ps.pico}. Los valles del fin de semana son el hueco tipico donde se rompen las rachas.` }),
      ]),
    ]));

    // Calendario e impacto acumulado
    const eq = equivalencias(r.co2eTotal);
    cuerpo.appendChild(el('div', { clase: 'tarjeta seccion' }, [
      el('h2', { texto: 'Huella evitada acumulada' }),
      el('div', { clase: 'rejilla c4', estilo: 'margin-bottom:15px' }, [
        equiv('🌳', num(eq.arbolesAnio), 'arboles-anio'),
        equiv('🚗', num(eq.kmCoche), 'km en coche'),
        equiv('📱', num(eq.cargasMovil), 'cargas de movil'),
        equiv('🍔', num(eq.hamburguesas), 'hamburguesas de res'),
      ]),
      mapaCalor(serieDiaria(estado.registros, metrica, 168), { color: '52, 211, 153' }),
      el('div', { clase: 'mini', estilo: 'margin-top:9px', texto: '24 semanas. Cada columna es una semana; cada fila, un dia. La intensidad es proporcional al valor de la metrica seleccionada.' }),
    ]));
  }

  raiz.appendChild(controles);
  raiz.appendChild(cuerpo);
  pintar();
  return raiz;
}

function equiv(icono, valor, etiqueta) {
  return el('div', { clase: 'centrado' }, [
    el('div', { estilo: 'font-size:25px', texto: icono }),
    el('div', { clase: 'metrica-valor s', texto: valor }),
    el('div', { clase: 'mini', texto: etiqueta }),
  ]);
}

function tablaEstadistica(filas) {
  return el('div', { clase: 'tabla-scroll' }, [
    el('table', {}, [
      el('tbody', {}, filas.map(([k, v, nota]) => el('tr', {}, [
        el('td', {}, [
          el('div', { estilo: 'font-weight:600;font-size:13px', texto: k }),
          el('div', { clase: 'mini', estilo: 'font-size:10.5px', texto: nota }),
        ]),
        el('td', { clase: 'mono', estilo: 'text-align:right;font-weight:700;white-space:nowrap', texto: v }),
      ]))),
    ]),
  ]);
}

function interpretacion(a, meta) {
  const { direccion, significativa, mannKendall, theilSen } = a.tendencia;
  if (!significativa) {
    return `No hay evidencia estadistica de tendencia (p = ${num(mannKendall.p, 3)} > 0,05). Tu ${meta.etiqueta.toLowerCase()} se mantiene estable dentro del ruido normal.`;
  }
  const sentido = direccion === 'al alza' ? 'aumentando' : 'disminuyendo';
  return `Tendencia ${sentido} de forma significativa (p = ${num(mannKendall.p, 4)}). El estimador robusto marca ${num(theilSen, 4)} ${meta.unidad}/dia, es decir ${num(theilSen * 30, 2)} ${meta.unidad} al mes.`;
}
