/** huella.js — Calculadora de huella de carbono personal. */
import { el, num, co2, toast, tarjetaMetrica, graficoDonut, graficoBarras, barraComparativa, esc } from '../componentes.js';
import { calcularHuella, escenarios, entradasPorDefecto, COMBUSTIBLES } from '../../core/huella.js';
import { paisesOrdenados, OBJETIVO_2030_TCO2E, MEDIA_MUNDIAL_TCO2E, pais } from '../../data/paises.js';
import { MOVILIDAD, DIETAS } from '../../data/factores.js';

export function vistaHuella(ctx) {
  const estado = ctx.almacen.get();
  let entradas = estado.huellaEntradas || entradasPorDefecto(estado.perfil.pais);
  const raiz = el('div');

  raiz.appendChild(el('h1', { texto: 'Huella de carbono' }));
  raiz.appendChild(el('p', { clase: 'sub',
    texto: 'Metodo hibrido: factores de proceso (ACV) para energia, movilidad y dieta, y factores input-output (EEIO) para bienes y servicios. La aviacion incluye el forzamiento no-CO2, que casi duplica su impacto.' }));

  const resultado = el('div');
  const campos = {};

  const campo = (clave, etiqueta, tipo, opciones = null, extra = {}) => {
    const input = opciones
      ? el('select', {}, Object.entries(opciones).map(([v, t]) =>
        el('option', { value: v, selected: String(entradas[clave]) === v, texto: t })))
      : el('input', { type: tipo, value: String(entradas[clave] ?? ''), min: '0', step: extra.step || '1', inputmode: 'decimal' });
    input.addEventListener('input', () => {
      entradas = { ...entradas, [clave]: tipo === 'number' ? Number(input.value) : input.value };
      pintarResultado();
    });
    campos[clave] = input;
    return el('label', { clase: 'campo' }, [etiqueta, input]);
  };

  const formulario = el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [
    el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: '🏠 Hogar y energia' }),
      el('div', { clase: 'col' }, [
        campo('pais', 'Pais (define el mix electrico)', 'text',
          Object.fromEntries(paisesOrdenados().map((p) => [p.cod, `${p.nombre} — ${p.red} g CO2e/kWh`]))),
        campo('personasHogar', 'Personas en el hogar', 'number'),
        campo('electricidadKwhMes', 'Electricidad (kWh/mes)', 'number'),
        campo('combustible', 'Combustible de calefaccion', 'text', {
          gas_natural_m3: 'Gas natural (m³)', glp_litro: 'GLP / butano (L)',
          gasoleo_litro: 'Gasoleo (L)', lena_kg: 'Lena (kg)', ninguno: 'Ninguno',
        }),
        campo('combustibleUnidadesMes', 'Consumo de combustible al mes', 'number'),
      ]),
    ]),
    el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: '🚗 Movilidad' }),
      el('div', { clase: 'col' }, [
        campo('tipoCoche', 'Tipo de vehiculo', 'text',
          Object.fromEntries(Object.entries(MOVILIDAD)
            .filter(([k]) => k.startsWith('coche') || k === 'motocicleta')
            .map(([k, v]) => [k, `${v.etiqueta} — ${v.co2e} kg/km`]))),
        campo('kmCocheSemana', 'Km en coche por semana', 'number'),
        campo('kmTransporteSemana', 'Km en transporte publico por semana', 'number'),
        campo('vuelosCortosAnio', 'Vuelos cortos al anio (< 1.500 km)', 'number'),
        campo('vuelosLargosAnio', 'Vuelos largos al anio (> 3.700 km)', 'number'),
      ]),
    ]),
    el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: '🍽️ Alimentacion' }),
      el('div', { clase: 'col' }, [
        campo('dieta', 'Patron alimentario', 'text',
          Object.fromEntries(Object.entries(DIETAS).map(([k, v]) => [k, `${v.etiqueta} — ${v.co2e_dia} kg CO2e/dia`]))),
        el('div', { clase: 'mini' }, ['Fuente: Scarborough et al. (2023), Nature Food, sobre 55.504 personas del estudio EPIC-Oxford.']),
      ]),
    ]),
    el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: '🛍️ Consumo y residuos' }),
      el('div', { clase: 'col' }, [
        campo('gastoBienesMes', 'Gasto en bienes (unidad monetaria/mes)', 'number'),
        campo('gastoServiciosMes', 'Gasto en servicios (unidad monetaria/mes)', 'number'),
        campo('reciclajePct', 'Porcentaje de residuos que reciclas', 'number'),
        el('div', { clase: 'mini' }, ['Los factores EEIO (0,35 kg CO2e por unidad de gasto en bienes) proceden de EXIOBASE v3.8.']),
      ]),
    ]),
  ]);

  function pintarResultado() {
    const h = calcularHuella(entradas);
    const esc_ = escenarios(entradas);
    const p = pais(entradas.pais);
    resultado.innerHTML = '';

    resultado.appendChild(el('div', { clase: 'rejilla c4 seccion' }, [
      tarjetaMetrica({ etiqueta: 'Tu huella anual', valor: num(h.totalToneladas), unidad: 't CO2e',
        color: h.veredicto.color, icono: '🌍' }),
      tarjetaMetrica({ etiqueta: `Media de ${p.nombre}`, valor: num(p.huella), unidad: 't',
        pie: `Estas ${h.comparativa.pais.ratio > 1 ? 'por encima' : 'por debajo'} (x${h.comparativa.pais.ratio})` }),
      tarjetaMetrica({ etiqueta: 'Objetivo 1,5 C (2030)', valor: String(OBJETIVO_2030_TCO2E), unidad: 't',
        color: 'var(--verde)', pie: h.comparativa.objetivo.exceso > 0 ? `Exceso de ${num(h.comparativa.objetivo.exceso)} t` : 'Objetivo cumplido' }),
      tarjetaMetrica({ etiqueta: 'Equivalente en arboles', valor: num(h.equivalenteArboles), unidad: 'arboles/anio',
        icono: '🌳', pie: 'Para neutralizar tu huella' }),
    ]));

    resultado.appendChild(el('div', { clase: `aviso ${h.veredicto.nivel === 'compatible' ? 'exito' : h.veredicto.nivel === 'muy_alto' ? 'error' : 'alerta'} seccion` }, [
      el('span', { texto: h.veredicto.nivel === 'compatible' ? '✅' : '⚠️' }),
      el('div', {}, [
        el('strong', { texto: h.veredicto.texto }),
        el('div', { clase: 'mini', estilo: 'margin-top:3px;color:inherit;opacity:.85',
          texto: `Si toda la humanidad viviera como tu harian falta ${num(h.planetas)} planetas para mantenerse dentro del limite de 1,5 C.` }),
      ]),
    ]));

    resultado.appendChild(el('div', { clase: 'tarjeta seccion' }, [
      el('h2', { texto: 'Tu posicion frente a las referencias' }),
      barraComparativa(h.totalToneladas, [
        { valor: OBJETIVO_2030_TCO2E, etiqueta: 'Objetivo 1,5 C', color: 'var(--verde)' },
        { valor: MEDIA_MUNDIAL_TCO2E, etiqueta: 'Media mundial', color: 'var(--ambar)' },
        { valor: p.huella, etiqueta: p.nombre, color: 'var(--azul)' },
      ], { unidad: 't CO2e/anio' }),
    ]));

    resultado.appendChild(el('div', { clase: 'rejilla c2 seccion', estilo: 'align-items:start' }, [
      el('div', { clase: 'tarjeta' }, [
        el('h2', { texto: 'De donde vienen tus emisiones' }),
        graficoDonut(h.categorias.filter((c) => c.kg > 0).map((c) => ({
          etiqueta: c.etiqueta, valor: c.kg,
          color: ['#34d399', '#fbbf24', '#f87171', '#38bdf8', '#c084fc', '#a3e635', '#f472b6', '#22d3ee', '#fb923c', '#94a3b8'][h.categorias.indexOf(c) % 10],
        })), { centro: { valor: `${num(h.totalToneladas)} t`, etiqueta: 'anual' } }),
      ]),
      el('div', { clase: 'tarjeta' }, [
        el('h2', { texto: 'Que hacer: escenarios ordenados por impacto' }),
        graficoBarras(esc_.filter((e) => e.ahorroT > 0).map((e) => ({
          etiqueta: `${e.icono} ${e.etiqueta}`, valor: e.ahorroT, color: 'var(--verde)',
        })), { unidad: 't' }),
        el('div', { clase: 'mini', estilo: 'margin-top:11px' },
          [`Aplicando las tres primeras palancas tu huella bajaria a ${num(Math.max(0, h.totalToneladas - esc_.slice(0, 3).reduce((s, e) => s + e.ahorroT, 0)))} t CO2e/anio.`]),
      ]),
    ]));

    resultado.appendChild(el('div', { clase: 'fila', estilo: 'gap:9px;margin-bottom:26px' }, [
      el('button', {
        clase: 'btn primario', texto: 'Guardar en mi perfil',
        onclick: () => {
          const nuevos = ctx.almacen.guardarHuella(entradas, h);
          toast({ titulo: 'Huella guardada', texto: `${num(h.totalToneladas)} t CO2e/anio`, icono: '🌍' });
          for (const l of nuevos) toast({ titulo: `Insignia: ${l.titulo}`, texto: l.desc, icono: l.icono, tipo: 'logro' });
          ctx.refrescar();
        },
      }),
      el('button', { clase: 'btn', texto: 'Restablecer valores', onclick: () => { entradas = entradasPorDefecto(estado.perfil.pais); ctx.refrescar(); } }),
    ]));

    resultado.appendChild(el('div', { clase: 'tarjeta' }, [
      el('h2', { texto: 'Desglose detallado' }),
      el('div', { clase: 'tabla-scroll' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { texto: 'Categoria' }), el('th', { texto: 'kg CO2e/anio' }),
            el('th', { texto: 't CO2e/anio' }), el('th', { texto: '% del total' }),
          ])]),
          el('tbody', {}, h.categorias.map((c) => el('tr', {}, [
            el('td', { texto: `${c.icono} ${c.etiqueta}` }),
            el('td', { clase: 'mono', texto: num(c.kg) }),
            el('td', { clase: 'mono', texto: num(c.t, 3) }),
            el('td', { clase: 'mono', texto: `${num(c.pct, 1)} %` }),
          ]))),
        ]),
      ]),
      el('div', { clase: 'mini', estilo: 'margin-top:13px' },
        ['Los "servicios publicos" (1,1 t) son la parte de infraestructura, sanidad y educacion que corresponde a cada habitante: no es reducible individualmente, pero forma parte honesta del total.']),
    ]));
  }

  raiz.appendChild(formulario);
  raiz.appendChild(resultado);
  pintarResultado();
  return raiz;
}
