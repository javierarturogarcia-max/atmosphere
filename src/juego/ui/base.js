/** base.js — Ayudas minimas de DOM para la interfaz del juego. */

export function el(etiqueta, opciones = {}, hijos = []) {
  const n = document.createElement(etiqueta);
  if (opciones.clase) n.className = opciones.clase;
  if (opciones.texto != null) n.textContent = opciones.texto;
  if (opciones.html != null) n.innerHTML = opciones.html;
  if (opciones.estilo) n.setAttribute('style', opciones.estilo);
  if (opciones.id) n.id = opciones.id;
  if (opciones.titulo) n.title = opciones.titulo;
  for (const [k, v] of Object.entries(opciones.attr || {})) n.setAttribute(k, v);
  if (opciones.alPulsar) n.addEventListener('click', opciones.alPulsar);
  for (const h of hijos) if (h) n.appendChild(h);
  return n;
}

export function boton(texto, opciones = {}) {
  return el('button', {
    clase: `boton ${opciones.clase || ''}`.trim(),
    texto,
    alPulsar: opciones.alPulsar,
    attr: opciones.desactivado ? { disabled: 'true' } : {},
    titulo: opciones.titulo,
  });
}

export function vaciar(nodo) { while (nodo.firstChild) nodo.removeChild(nodo.firstChild); return nodo; }

/** Anillo de progreso en SVG (reloj del dia y medidores redondos). */
export function anillo(progreso, { radio = 20, grosor = 3.5, color = '#f0b95c', fondo = 'rgba(255,255,255,.16)' } = {}) {
  const c = 2 * Math.PI * radio;
  const tam = (radio + grosor) * 2;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', tam); svg.setAttribute('height', tam);
  svg.setAttribute('viewBox', `0 0 ${tam} ${tam}`);
  const base = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const arco = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  for (const [nodo, trazo, dash] of [[base, fondo, null], [arco, color, `${c * progreso} ${c}`]]) {
    nodo.setAttribute('cx', tam / 2); nodo.setAttribute('cy', tam / 2); nodo.setAttribute('r', radio);
    nodo.setAttribute('fill', 'none'); nodo.setAttribute('stroke', trazo);
    nodo.setAttribute('stroke-width', grosor); nodo.setAttribute('stroke-linecap', 'round');
    if (dash) nodo.setAttribute('stroke-dasharray', dash);
    svg.appendChild(nodo);
  }
  return svg;
}

/** Escala un valor 0..1 a porcentaje con dos decimales. */
export function pct(v) { return `${Math.max(0, Math.min(1, v)) * 100}%`; }
