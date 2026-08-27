/** aire.js — Calculadora de calidad del aire y riesgo sanitario. */
import { el, num, medidor, tarjetaMetrica, graficoBarras, toast, esc } from '../componentes.js';
import { calcularAQI, riesgoPM25, CONTAMINANTES, CATEGORIAS_AQI, GUIA_OMS, aqiContaminante } from '../../core/aire.js';

let lecturas = { pm25: 12, pm10: 28, o3: 35, no2: 22, so2: 4, co: 0.6 };

export function vistaAire(ctx) {
  const raiz = el('div');
  const salida = el('div');

  raiz.appendChild(el('h1', { texto: 'Calidad del aire' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Indice AQI de la EPA (revision de 2024 para PM2,5) por interpolacion lineal por tramos, contrastado con las guias de la OMS de 2021, mucho mas estrictas. La contaminacion del aire mata a 8,1 millones de personas al anio.' }));

  const entradas = el('div', { clase: 'rejilla c3' }, Object.entries(CONTAMINANTES).map(([clave, meta]) => {
    const input = el('input', { type: 'number', min: '0', step: '0.1', value: String(lecturas[clave] ?? ''), inputmode: 'decimal' });
    input.addEventListener('input', () => { lecturas = { ...lecturas, [clave]: input.value === '' ? null : Number(input.value) }; pintar(); });
    return el('label', { clase: 'campo' }, [`${meta.nombre} (${meta.unidad})`, input]);
  }));

  raiz.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('h2', { texto: 'Introduce las concentraciones medidas' }),
    entradas,
    el('div', { clase: 'mini', estilo: 'margin-top:11px' },
      ['Puedes tomarlas de la estacion oficial de tu ciudad, de un sensor domestico o de servicios abiertos como OpenAQ o el Copernicus Atmosphere Monitoring Service.']),
  ]));

  raiz.appendChild(salida);

  function pintar() {
    const r = calcularAQI(lecturas);
    salida.innerHTML = '';
    if (!r) {
      salida.appendChild(el('div', { clase: 'aviso info' }, ['Introduce al menos una concentracion para calcular el indice.']));
      return;
    }
    const riesgo = riesgoPM25(lecturas.pm25 || 0);

    salida.appendChild(el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [
      el('div', { clase: 'tarjeta centrado' }, [
        el('h2', { texto: 'Indice AQI' }),
        medidor(r.aqi, { max: 300, color: r.color, sufijo: r.categoria }),
        el('div', { clase: 'pastilla', estilo: `background:${r.color}22;color:${r.color};margin-top:9px`, texto: r.categoria }),
        el('div', { clase: 'mini', estilo: 'margin-top:11px', texto: r.consejo }),
        el('div', { clase: 'mini', estilo: 'margin-top:7px' },
          [`Contaminante dominante: ${CONTAMINANTES[r.dominante].nombre}. El AQI global es el maximo de los subindices, no su media: asi lo define la EPA para no diluir un pico peligroso.`]),
      ]),
      el('div', { clase: 'tarjeta' }, [
        el('h2', { texto: 'Subindices por contaminante' }),
        graficoBarras(r.subindices.map((s) => ({
          etiqueta: CONTAMINANTES[s.contaminante].nombre,
          valor: s.aqi,
          color: CATEGORIAS_AQI.find((c) => s.aqi <= c.max)?.color,
        })), { unidad: 'AQI' }),
        el('div', { clase: 'divisor' }),
        el('div', { clase: 'mini', texto: CONTAMINANTES[r.dominante].origen }),
      ]),
    ]));

    salida.appendChild(el('div', { clase: 'rejilla c4 seccion' }, [
      tarjetaMetrica({ etiqueta: 'Riesgo relativo de mortalidad', valor: num(riesgo.riesgoRelativo, 3), icono: '🫁',
        color: riesgo.excesoMortalidadPct > 10 ? 'var(--rojo)' : 'var(--ambar)',
        pie: `+${num(riesgo.excesoMortalidadPct, 1)} % frente al aire limpio` }),
      tarjetaMetrica({ etiqueta: 'Esperanza de vida', valor: `-${num(riesgo.anosVidaPerdidos, 2)}`, unidad: 'anios', icono: '⏳',
        pie: 'Metodo AQLI (Universidad de Chicago)' }),
      tarjetaMetrica({ etiqueta: 'PM2,5 frente a guia OMS', valor: `x${num(riesgo.vecesGuiaOMS, 1)}`, icono: '📏',
        color: riesgo.vecesGuiaOMS > 1 ? 'var(--naranja)' : 'var(--verde)',
        pie: `Guia anual: ${GUIA_OMS.pm25.anual} ug/m³` }),
      tarjetaMetrica({ etiqueta: 'Excesos sobre guia diaria', valor: String(r.excesosOMS.filter((e) => e.supera).length), icono: '⚠️',
        pie: `de ${r.excesosOMS.length} contaminantes evaluados` }),
    ]));

    salida.appendChild(el('div', { clase: 'tarjeta seccion' }, [
      el('h2', { texto: 'Contraste con las guias de la OMS (2021)' }),
      el('div', { clase: 'tabla-scroll' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { texto: 'Contaminante' }), el('th', { texto: 'Tu lectura' }),
            el('th', { texto: 'Guia OMS 24 h' }), el('th', { texto: 'Veces la guia' }), el('th', { texto: 'Estado' }),
          ])]),
          el('tbody', {}, r.excesosOMS.map((e) => el('tr', {}, [
            el('td', { texto: CONTAMINANTES[e.contaminante].nombre }),
            el('td', { clase: 'mono', texto: num(e.valor) }),
            el('td', { clase: 'mono', texto: num(e.guia) }),
            el('td', { clase: 'mono', estilo: e.supera ? 'color:var(--rojo);font-weight:700' : 'color:var(--verde)', texto: `x${num(e.veces, 2)}` }),
            el('td', {}, [el('span', {
              clase: 'pastilla',
              estilo: e.supera ? 'background:rgba(248,113,113,.16);color:var(--rojo)' : 'background:rgba(52,211,153,.16);color:var(--verde)',
              texto: e.supera ? 'Supera' : 'Cumple',
            })]),
          ]))),
        ]),
      ]),
      el('div', { clase: 'aviso alerta', estilo: 'margin-top:15px' }, [
        el('span', { texto: '🌍' }),
        el('div', { texto: 'El 99 % de la poblacion mundial respira aire que supera la guia de la OMS. En 2021 la contaminacion atmosferica causo 8,1 millones de muertes, de las cuales 700.000 fueron de menores de cinco anios (State of Global Air 2024).' }),
      ]),
    ]));

    salida.appendChild(el('div', { clase: 'tarjeta seccion' }, [
      el('h2', { texto: 'Escala AQI y que hacer en cada tramo' }),
      el('div', { clase: 'tabla-scroll' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { texto: 'AQI' }), el('th', { texto: 'Categoria' }), el('th', { texto: 'PM2,5 (ug/m³)' }), el('th', { texto: 'Recomendacion' }),
          ])]),
          el('tbody', {}, CATEGORIAS_AQI.map((c, i) => {
            const previo = i === 0 ? 0 : CATEGORIAS_AQI[i - 1].max + 1;
            const tramos = [['0,0–9,0'], ['9,1–35,4'], ['35,5–55,4'], ['55,5–125,4'], ['125,5–225,4'], ['225,5+']][i];
            return el('tr', { clase: r.aqi >= previo && r.aqi <= c.max ? 'destacada' : '' }, [
              el('td', { clase: 'mono', texto: `${previo}–${c.max}` }),
              el('td', {}, [el('span', { clase: 'pastilla', estilo: `background:${c.color}22;color:${c.color}`, texto: c.nombre })]),
              el('td', { clase: 'mono mini', texto: tramos[0] }),
              el('td', { clase: 'mini', texto: c.consejo }),
            ]);
          })),
        ]),
      ]),
    ]));

    salida.appendChild(el('div', { clase: 'fila', estilo: 'gap:9px' }, [
      el('button', {
        clase: 'btn primario', texto: 'Guardar lectura',
        onclick: () => {
          ctx.almacen.guardarLecturaAire({ ...lecturas, aqi: r.aqi, categoria: r.categoria });
          toast({ titulo: 'Lectura guardada', texto: `AQI ${r.aqi} · ${r.categoria}`, icono: '💨' });
        },
      }),
    ]));
  }

  pintar();
  return raiz;
}
