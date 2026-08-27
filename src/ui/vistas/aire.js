/** aire.js — Calculadora de calidad del aire y riesgo sanitario. */
import { el, num, medidor, tarjetaMetrica, graficoBarras, toast, esc, progreso, vacio } from '../componentes.js';
import { calcularAQI, riesgoPM25, CONTAMINANTES, CATEGORIAS_AQI, GUIA_OMS, aqiContaminante } from '../../core/aire.js';
import { consultarAire, ubicacionActual, buscarCiudad, CIUDADES } from '../../core/openmeteo.js';
import { misionesPorAire } from '../../core/misiones.js';
import { factorAire } from '../../core/puntos.js';

let lecturas = { pm25: 12, pm10: 28, o3: 35, no2: 22, so2: 4, co: 0.6 };
let ultimaConsulta = null;
let cargando = false;

export function vistaAire(ctx) {
  const raiz = el('div');
  const salida = el('div');

  raiz.appendChild(el('h1', { texto: 'Calidad del aire' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Indice AQI de la EPA (revision de 2024 para PM2,5) por interpolacion lineal por tramos, contrastado con las guias de la OMS de 2021, mucho mas estrictas. La contaminacion del aire mata a 8,1 millones de personas al anio.' }));

  // ------------------------------------------------------------ datos en vivo
  const panelVivo = el('div', { clase: 'tarjeta seccion' });
  raiz.appendChild(panelVivo);

  const buscador = el('input', { type: 'search', placeholder: 'Busca tu ciudad...' });
  const resultados = el('div', { clase: 'fila envuelve', estilo: 'gap:7px;margin-top:9px' });

  async function consultar(lat, lon, etiqueta) {
    if (cargando) return;
    cargando = true;
    pintarVivo(`Consultando ${etiqueta}...`);
    try {
      const r = await consultarAire(lat, lon);
      ultimaConsulta = { ...r, etiqueta };
      // Se vuelcan las lecturas convertidas al formulario manual, para que
      // la persona vea de donde sale cada numero y pueda ajustarlo.
      lecturas = { ...r.lecturas };
      ctx.almacen.guardarLecturaAire({
        aqi: r.aqi.aqi, categoria: r.aqi.categoria, lugar: etiqueta,
        lat, lon, dominante: r.aqi.dominante, fuente: r.meta.fuente,
      });
      toast({ titulo: `AQI ${r.aqi.aqi} en ${etiqueta}`, texto: r.aqi.categoria, icono: '💨' });
      ctx.refrescar();
    } catch (e) {
      ultimaConsulta = null;
      pintarVivo(null, e.message || 'No se pudo consultar la calidad del aire.');
    } finally {
      cargando = false;
    }
  }

  function pintarVivo(mensajeCarga = null, error = null) {
    panelVivo.innerHTML = '';
    panelVivo.appendChild(el('div', { clase: 'fila entre envuelve', estilo: 'margin-bottom:13px;gap:9px' }, [
      el('h2', { estilo: 'margin:0', texto: '📡 Datos reales de tu zona' }),
      el('button', {
        clase: 'btn primario s', texto: cargando ? 'Consultando...' : '📍 Usar mi ubicacion',
        disabled: cargando,
        onclick: async () => {
          try {
            const pos = await ubicacionActual();
            await consultar(pos.lat, pos.lon, 'tu ubicacion');
          } catch (e) { pintarVivo(null, e.message); }
        },
      }),
    ]));

    if (mensajeCarga) {
      panelVivo.appendChild(el('div', { clase: 'aviso info pulso' }, ['⏳ ' + mensajeCarga]));
      return;
    }
    if (error) {
      panelVivo.appendChild(el('div', { clase: 'aviso error', estilo: 'margin-bottom:13px' }, ['⚠️ ' + error]));
    }

    if (ultimaConsulta) {
      const r = ultimaConsulta;
      const mision = misionesPorAire(r.aqi.aqi, r.etiqueta)[0];
      const fac = factorAire(r.aqi.aqi, 'movilidad');
      panelVivo.appendChild(el('div', { clase: 'rejilla c3', estilo: 'margin-bottom:15px' }, [
        el('div', {}, [
          el('div', { clase: 'metrica-valor', estilo: `color:${r.aqi.color}`, texto: String(r.aqi.aqi) }),
          el('div', { clase: 'mini', texto: `AQI · ${r.aqi.categoria}` }),
        ]),
        el('div', {}, [
          el('div', { clase: 'metrica-valor s', texto: CONTAMINANTES[r.aqi.dominante].nombre }),
          el('div', { clase: 'mini', texto: 'contaminante dominante' }),
        ]),
        el('div', {}, [
          el('div', { clase: 'metrica-valor s', texto: r.meta.medidoEn ? r.meta.medidoEn.slice(11, 16) : '—' }),
          el('div', { clase: 'mini', texto: `medicion en ${r.etiqueta}` }),
        ]),
      ]));

      if (mision) {
        panelVivo.appendChild(el('div', {
          clase: `aviso ${mision.urgencia === 'alta' ? 'error' : mision.urgencia === 'media' ? 'alerta' : 'exito'}`,
          estilo: 'margin-bottom:13px',
        }, [
          el('span', { texto: mision.icono }),
          el('div', {}, [
            el('strong', { texto: mision.titulo }),
            el('div', { clase: 'mini', estilo: 'margin-top:3px;color:inherit;opacity:.85', texto: mision.detalle }),
            fac.factor > 1
              ? el('div', { clase: 'mini', estilo: 'margin-top:5px;font-weight:700;color:inherit',
                  texto: `⚡ ${fac.etiqueta} · activo durante 3 h` })
              : null,
          ]),
        ]));
      }

      panelVivo.appendChild(el('div', { clase: 'mini' }, [
        `Fuente: ${r.meta.fuente}. `,
        r.meta.aqiDeLaFuente !== null
          ? `El servicio publica un AQI de ${r.meta.aqiDeLaFuente}; el ${r.aqi.aqi} de arriba lo calculamos aqui con los tramos de la EPA a partir de las concentraciones crudas, tras convertirlas de µg/m³ a ppb. Si ambos coinciden, mejor senal.`
          : 'Calculado aqui a partir de las concentraciones crudas.',
      ]));
    } else if (!error) {
      panelVivo.appendChild(el('div', { clase: 'mini', estilo: 'margin-bottom:13px' },
        ['Sin clave de API y sin servidor: la consulta sale directa de tu navegador. Cuando el aire esta mal, las acciones de movilidad y energia puntuan mas durante 3 horas.']));
    }

    panelVivo.appendChild(el('div', { clase: 'divisor' }));
    panelVivo.appendChild(el('div', { clase: 'fila envuelve', estilo: 'gap:7px' },
      CIUDADES.map((c) => el('button', {
        clase: 'chip', texto: c.nombre, title: c.region, disabled: cargando,
        onclick: () => consultar(c.lat, c.lon, c.nombre),
      }))));
    panelVivo.appendChild(el('div', { estilo: 'margin-top:11px' }, [buscador, resultados]));
  }

  let temporizador = null;
  buscador.addEventListener('input', () => {
    clearTimeout(temporizador);
    const q = buscador.value;
    temporizador = setTimeout(async () => {
      resultados.innerHTML = '';
      if (q.trim().length < 2) return;
      try {
        const ciudades = await buscarCiudad(q);
        if (!ciudades.length) {
          resultados.appendChild(el('span', { clase: 'mini', texto: 'Sin resultados.' }));
          return;
        }
        for (const c of ciudades) {
          resultados.appendChild(el('button', {
            clase: 'chip', texto: `${c.nombre} · ${c.region}`,
            onclick: () => consultar(c.lat, c.lon, c.nombre),
          }));
        }
      } catch (e) {
        resultados.appendChild(el('span', { clase: 'mini', texto: e.message }));
      }
    }, 350);
  });

  pintarVivo();

  // --------------------------------------------------------- entrada manual
  const entradas = el('div', { clase: 'rejilla c3' }, Object.entries(CONTAMINANTES).map(([clave, meta]) => {
    const input = el('input', { type: 'number', min: '0', step: '0.1', value: String(lecturas[clave] ?? ''), inputmode: 'decimal' });
    input.addEventListener('input', () => { lecturas = { ...lecturas, [clave]: input.value === '' ? null : Number(input.value) }; pintar(); });
    return el('label', { clase: 'campo' }, [`${meta.nombre} (${meta.unidad})`, input]);
  }));

  raiz.appendChild(el('div', { clase: 'tarjeta seccion' }, [
    el('h2', { texto: '✍️ O introduce las concentraciones a mano' }),
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
