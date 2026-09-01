/**
 * componentes.js — Primitivas de interfaz y graficos SVG sin dependencias.
 * Todos los graficos se dibujan a mano: cero librerias, cero peticiones de red,
 * y funcionan sin conexion dentro de la PWA.
 */

/** Constructor de elementos DOM conciso. */
export function el(tag, props = {}, hijos = []) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'clase') nodo.className = v;
    else if (k === 'html') nodo.innerHTML = v;
    else if (k === 'texto') nodo.textContent = v;
    else if (k === 'estilo') nodo.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') nodo.addEventListener(k.slice(2), v);
    else if (k === 'datos') for (const [dk, dv] of Object.entries(v)) nodo.dataset[dk] = dv;
    else nodo.setAttribute(k, v);
  }
  for (const h of [].concat(hijos)) {
    if (h === null || h === undefined || h === false) continue;
    nodo.appendChild(typeof h === 'string' ? document.createTextNode(h) : h);
  }
  return nodo;
}

/** Escapa texto para insercion segura en HTML. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const NF = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const NF0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

/** Formato numerico con separadores en espanol y notacion compacta. */
export function num(n, decimales = null) {
  const v = Number(n) || 0;
  if (decimales !== null) {
    return new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
  }
  if (Math.abs(v) >= 1000000) return `${NF.format(v / 1000000)} M`;
  if (Math.abs(v) >= 10000) return NF0.format(v);
  return NF.format(v);
}

/** Formato de kg CO2e escalando a toneladas cuando procede. */
export function co2(kg) {
  const v = Number(kg) || 0;
  if (Math.abs(v) >= 1000) return `${num(v / 1000)} t`;
  if (Math.abs(v) < 1 && v !== 0) return `${num(v, 2)} kg`;
  return `${num(v)} kg`;
}

/** Formato de litros escalando a m3. */
export function litros(L) {
  const v = Number(L) || 0;
  if (v >= 1000) return `${num(v / 1000)} m³`;
  return `${num(v)} L`;
}

/** Fecha relativa legible. */
export function haceCuanto(iso) {
  const d = new Date(iso);
  const seg = (Date.now() - d.getTime()) / 1000;
  if (seg < 60) return 'ahora mismo';
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
  if (seg < 604800) return `hace ${Math.floor(seg / 86400)} d`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// ============================================================== graficos SVG

/**
 * Grafico de linea con area, opcionalmente con recta de tendencia superpuesta.
 * @param {Array<{dia:string, valor:number}>} serie
 */
export function graficoLinea(serie, {
  alto = 160, color = 'var(--verde)', tendencia = null, etiquetas = true, relleno = true,
} = {}) {
  const n = serie.length;
  if (!n) return el('div', { clase: 'vacio mini', texto: 'Sin datos todavia' });
  const W = 1000, H = alto, pad = { t: 12, r: 8, b: etiquetas ? 22 : 8, l: 8 };
  const max = Math.max(...serie.map((p) => p.valor), 0.0001);
  const ancho = W - pad.l - pad.r;
  const altoUtil = H - pad.t - pad.b;
  const px = (i) => pad.l + (n === 1 ? ancho / 2 : (i / (n - 1)) * ancho);
  const py = (v) => pad.t + altoUtil - (v / max) * altoUtil;

  const puntos = serie.map((p, i) => `${px(i).toFixed(1)},${py(p.valor).toFixed(1)}`).join(' ');
  const area = `${pad.l},${pad.t + altoUtil} ${puntos} ${px(n - 1)},${pad.t + altoUtil}`;
  const id = `g${Math.random().toString(36).slice(2, 8)}`;

  let extra = '';
  if (tendencia && n > 2) {
    const y0 = py(Math.max(0, tendencia.intercepto));
    const y1 = py(Math.max(0, tendencia.intercepto + tendencia.pendiente * (n - 1)));
    extra = `<line x1="${pad.l}" y1="${y0.toFixed(1)}" x2="${px(n - 1)}" y2="${y1.toFixed(1)}"
      stroke="var(--ambar)" stroke-width="2" stroke-dasharray="7 5" opacity="0.85"/>`;
  }

  const marcas = etiquetas ? serie.map((p, i) => {
    if (n > 12 && i % Math.ceil(n / 6) !== 0 && i !== n - 1) return '';
    return `<text x="${px(i).toFixed(1)}" y="${H - 4}" fill="var(--texto-3)" font-size="19"
      text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${p.dia.slice(5).replace('-', '/')}</text>`;
  }).join('') : '';

  return el('div', {
    html: `<svg class="svg-grafico" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Serie temporal">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.42"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${relleno ? `<polygon points="${area}" fill="url(#${id})"/>` : ''}
      <polyline points="${puntos}" fill="none" stroke="${color}" stroke-width="2.5"
        stroke-linejoin="round" stroke-linecap="round"/>
      ${extra}${marcas}
    </svg>`,
  });
}

/** Barras verticales comparativas. */
export function graficoBarras(datos, { alto = 170, color = 'var(--cian)', unidad = '' } = {}) {
  if (!datos.length) return el('div', { clase: 'vacio mini', texto: 'Sin datos' });
  const max = Math.max(...datos.map((d) => d.valor), 0.0001);
  const filas = datos.map((d) => `
    <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px">
      <span style="width:112px;font-size:12.5px;color:var(--texto-2);overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap">${esc(d.etiqueta)}</span>
      <div style="flex:1;height:20px;background:var(--superficie-2);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${((d.valor / max) * 100).toFixed(1)}%;
          background:${d.color || color};border-radius:5px;transition:width 600ms"></div>
      </div>
      <span class="mono" style="width:74px;text-align:right;font-size:12.5px;font-weight:650">
        ${num(d.valor)}${unidad ? ` ${unidad}` : ''}</span>
    </div>`).join('');
  return el('div', { html: filas, estilo: `min-height:${Math.min(alto, datos.length * 27)}px` });
}

/** Anillo de proporciones con leyenda. */
export function graficoDonut(datos, { tamano = 168, grosor = 22, centro = null } = {}) {
  const total = datos.reduce((s, d) => s + d.valor, 0);
  if (total <= 0) return el('div', { clase: 'vacio mini', texto: 'Sin datos' });
  const R = tamano / 2, r = R - grosor / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcos = datos.map((d) => {
    const frac = d.valor / total;
    const seg = `<circle cx="${R}" cy="${R}" r="${r}" fill="none" stroke="${d.color}"
      stroke-width="${grosor}" stroke-dasharray="${(frac * circ).toFixed(2)} ${circ.toFixed(2)}"
      stroke-dashoffset="${(-offset * circ).toFixed(2)}" transform="rotate(-90 ${R} ${R})"
      stroke-linecap="butt"><title>${esc(d.etiqueta)}: ${num(d.valor)}</title></circle>`;
    offset += frac;
    return seg;
  }).join('');

  const leyenda = datos.map((d) => `
    <div style="display:flex;align-items:center;gap:7px;font-size:12.5px;margin-bottom:5px">
      <span style="width:9px;height:9px;border-radius:2px;background:${d.color};flex-shrink:0"></span>
      <span style="flex:1;color:var(--texto-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.etiqueta)}</span>
      <span class="mono" style="font-weight:650">${((d.valor / total) * 100).toFixed(0)} %</span>
    </div>`).join('');

  return el('div', {
    clase: 'fila envuelve',
    html: `<div style="position:relative;flex-shrink:0">
      <svg width="${tamano}" height="${tamano}" viewBox="0 0 ${tamano} ${tamano}" role="img">
        <circle cx="${R}" cy="${R}" r="${r}" fill="none" stroke="var(--superficie-2)" stroke-width="${grosor}"/>
        ${arcos}
      </svg>
      ${centro ? `<div style="position:absolute;inset:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;pointer-events:none">
        <div style="font-size:21px;font-weight:800;letter-spacing:-0.6px">${esc(centro.valor)}</div>
        <div style="font-size:10.5px;color:var(--texto-3);text-transform:uppercase;letter-spacing:0.9px">${esc(centro.etiqueta)}</div>
      </div>` : ''}
    </div>
    <div style="flex:1;min-width:150px">${leyenda}</div>`,
  });
}

/** Medidor semicircular para indices acotados (AQI, confianza, progreso). */
export function medidor(valor, { min = 0, max = 100, color = 'var(--verde)', etiqueta = '', sufijo = '' } = {}) {
  const frac = Math.max(0, Math.min(1, (valor - min) / (max - min)));
  const W = 200, H = 116, cx = 100, cy = 100, r = 78;
  const ang = Math.PI * (1 - frac);
  const x = cx + r * Math.cos(ang), y = cy - r * Math.sin(ang);
  const largo = frac > 0.5 ? 1 : 0;
  return el('div', {
    html: `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:210px" role="img" aria-label="${esc(etiqueta)}">
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none"
        stroke="var(--superficie-2)" stroke-width="15" stroke-linecap="round"/>
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 ${largo} 1 ${x.toFixed(2)} ${y.toFixed(2)}" fill="none"
        stroke="${color}" stroke-width="15" stroke-linecap="round"/>
      <text x="${cx}" y="${cy - 16}" text-anchor="middle" font-size="34" font-weight="800" fill="var(--texto)">${esc(String(valor))}</text>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12" fill="var(--texto-3)">${esc(sufijo || etiqueta)}</text>
    </svg>`,
  });
}

/** Mapa de calor tipo contribuciones: 7 filas (dias) x N columnas (semanas). */
export function mapaCalor(serie, { color = '52, 211, 153' } = {}) {
  const max = Math.max(...serie.map((p) => p.valor), 0.0001);
  const celdas = serie.map((p) => {
    const intensidad = p.valor <= 0 ? 0 : 0.18 + 0.82 * Math.min(1, p.valor / max);
    return `<div class="mapa-celda" title="${p.dia}: ${num(p.valor)}"
      style="background:${p.valor > 0 ? `rgba(${color}, ${intensidad.toFixed(2)})` : 'var(--superficie-2)'}"></div>`;
  }).join('');
  return el('div', { clase: 'scroll-x', html: `<div class="mapa-calor">${celdas}</div>` });
}

/** Linea comparativa horizontal con marcadores de referencia. */
export function barraComparativa(valor, referencias, { max = null, unidad = '', color = 'var(--verde)' } = {}) {
  const tope = max || Math.max(valor, ...referencias.map((r) => r.valor)) * 1.15;
  const marcas = referencias.map((r) => `
    <div style="position:absolute;left:${Math.min(98, (r.valor / tope) * 100).toFixed(1)}%;top:-4px;bottom:-4px;
      border-left:2px dashed ${r.color || 'var(--texto-3)'}">
      <span style="position:absolute;top:-19px;left:4px;font-size:10px;color:${r.color || 'var(--texto-3)'};
        white-space:nowrap;font-weight:650">${esc(r.etiqueta)}</span>
    </div>`).join('');
  return el('div', {
    estilo: 'margin:26px 0 10px',
    html: `<div style="position:relative;height:22px;background:var(--superficie-2);border-radius:6px">
      <div style="height:100%;width:${Math.min(100, (valor / tope) * 100).toFixed(1)}%;
        background:linear-gradient(90deg, ${color}, var(--cian));border-radius:6px"></div>
      ${marcas}
    </div>
    <div class="mini" style="margin-top:5px">Tu valor: <strong class="mono" style="color:var(--texto)">${num(valor)} ${esc(unidad)}</strong></div>`,
  });
}

/** Tarjeta de metrica reutilizable. */
export function tarjetaMetrica({ etiqueta, valor, unidad = '', pie = '', delta = null, color = null, icono = null }) {
  const d = delta === null ? null : el('span', {
    clase: `delta ${delta > 0 ? 'sube' : delta < 0 ? 'baja' : 'neutro'}`,
    texto: `${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${Math.abs(delta * 100).toFixed(0)} %`,
  });
  return el('div', { clase: 'tarjeta' }, [
    el('div', { clase: 'fila entre' }, [
      el('span', { clase: 'etiqueta', texto: etiqueta }),
      icono ? el('span', { estilo: 'font-size:17px', texto: icono }) : null,
    ]),
    el('div', { clase: 'fila', estilo: 'margin-top:7px;align-items:baseline' }, [
      el('span', { clase: 'metrica-valor', estilo: color ? `color:${color}` : '', texto: valor }),
      unidad ? el('span', { clase: 'metrica-unidad', texto: unidad }) : null,
    ]),
    pie || d ? el('div', { clase: 'fila', estilo: 'margin-top:5px;gap:7px' }, [
      d, pie ? el('span', { clase: 'metrica-pie', texto: pie }) : null,
    ]) : null,
  ]);
}

/** Barra de progreso con texto. */
export function progreso(fraccion, { texto = '', color = null, fina = false } = {}) {
  return el('div', {}, [
    el('div', { clase: `barra${fina ? ' fina' : ''}` }, [
      el('i', { estilo: `width:${Math.min(100, Math.max(0, fraccion * 100)).toFixed(1)}%${color ? `;background:${color}` : ''}` }),
    ]),
    texto ? el('div', { clase: 'mini', estilo: 'margin-top:5px', texto }) : null,
  ]);
}

// ================================================================ overlays

let contenedorToasts = null;

/** Notificacion efimera. */
export function toast({ titulo, texto = '', tipo = 'exito', icono = '✅', duracion = 4200 }) {
  if (!contenedorToasts) {
    contenedorToasts = el('div', { clase: 'toasts', 'aria-live': 'polite' });
    document.body.appendChild(contenedorToasts);
  }
  const t = el('div', { clase: `toast ${tipo}` }, [
    el('div', { clase: 'toast-icono', texto: icono }),
    el('div', { clase: 'crece' }, [
      el('div', { clase: 'toast-titulo', texto: titulo }),
      texto ? el('div', { clase: 'toast-texto', texto }) : null,
    ]),
  ]);
  contenedorToasts.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 280ms, transform 280ms';
    t.style.opacity = '0';
    t.style.transform = 'translateX(24px)';
    setTimeout(() => t.remove(), 300);
  }, duracion);
  return t;
}

/** Modal con contenido arbitrario. Devuelve una funcion para cerrarlo. */
export function modal(contenido, { titulo = '', ancho = null } = {}) {
  const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', onTecla); };
  const onTecla = (e) => { if (e.key === 'Escape') cerrar(); };
  const caja = el('div', { clase: 'modal', estilo: ancho ? `max-width:${ancho}px` : '' }, [
    titulo ? el('div', { clase: 'fila entre', estilo: 'margin-bottom:15px' }, [
      el('h2', { estilo: 'margin:0', texto: titulo }),
      el('button', { clase: 'btn s', texto: '✕', onclick: cerrar, 'aria-label': 'Cerrar' }),
    ]) : null,
    contenido,
  ]);
  const fondo = el('div', {
    clase: 'modal-fondo', role: 'dialog', 'aria-modal': 'true',
    onclick: (e) => { if (e.target === fondo) cerrar(); },
  }, [caja]);
  document.body.appendChild(fondo);
  document.addEventListener('keydown', onTecla);
  return cerrar;
}

/** Estado vacio reutilizable. */
export function vacio(icono, titulo, texto = '') {
  return el('div', { clase: 'vacio' }, [
    el('span', { clase: 'ico', texto: icono }),
    el('div', { estilo: 'font-weight:650;color:var(--texto-2)', texto: titulo }),
    texto ? el('div', { clase: 'mini', estilo: 'margin-top:5px', texto }) : null,
  ]);
}

/**
 * Marca de mutu_u: prisma hexagonal con su anillo orbital.
 *
 * Va como SVG y no como imagen a proposito. La aplicacion se empaqueta en un
 * unico archivo HTML sin recursos externos, asi que un PNG habria que
 * incrustarlo en base64: cientos de kilobytes para un hueco de 28 px en la
 * barra lateral, y borroso en pantallas densas. Este vector pesa un kilobyte,
 * se ve nitido de 20 px a 200 px y hereda los colores del tema.
 *
 * @param {number} tamano lado en pixeles
 * @param {string} [clase] clase CSS adicional
 */
export function logoMutuu(tamano = 28, clase = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('width', String(tamano));
  svg.setAttribute('height', String(tamano));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'mutu_u');
  if (clase) svg.setAttribute('class', clase);

  // Identificadores unicos: puede haber varios logos en la misma pagina y los
  // id de un <defs> son globales. Sin esto, el segundo logo reutilizaria los
  // degradados del primero y bastaria quitar uno para romper los demas.
  const uid = `mu${Math.random().toString(36).slice(2, 8)}`;
  svg.innerHTML = `
    <defs>
      <linearGradient id="${uid}c" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="#7dd3fc"/>
        <stop offset="45%"  stop-color="#22d3ee"/>
        <stop offset="100%" stop-color="#a78bfa"/>
      </linearGradient>
      <linearGradient id="${uid}i" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%"   stop-color="#0e7490"/>
        <stop offset="55%"  stop-color="#0c4a6e"/>
        <stop offset="100%" stop-color="#1e3a8a"/>
      </linearGradient>
      <radialGradient id="${uid}g">
        <stop offset="0%"   stop-color="#22d3ee" stop-opacity=".38"/>
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <circle cx="50" cy="50" r="46" fill="url(#${uid}g)"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="#38bdf8" stroke-opacity=".28" stroke-width="1"/>
    <circle cx="50" cy="50" r="30" fill="none" stroke="#22d3ee" stroke-opacity=".55" stroke-width="2"
            stroke-dasharray="112 76" stroke-linecap="round" transform="rotate(-28 50 50)"/>
    <path d="M26 68a28 28 0 0 0 48 0" fill="none" stroke="#fb923c" stroke-opacity=".75"
          stroke-width="2.4" stroke-linecap="round"/>

    <path d="M84 50 67 79.4H33L16 50l17-29.4h34z" fill="url(#${uid}i)"
          stroke="url(#${uid}c)" stroke-width="3" stroke-linejoin="round"/>
    <g stroke="#bae6fd" stroke-opacity=".85" stroke-width="1.8" stroke-linecap="round">
      <path d="M50 50 84 50M50 50 33 79.4M50 50 33 20.6"/>
    </g>
    <circle cx="50" cy="50" r="3.4" fill="#e0f2fe"/>`;
  return svg;
}
