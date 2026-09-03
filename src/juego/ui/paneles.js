/**
 * paneles.js — Pantallas que se abren encima del juego: la canasta, las
 * habilidades, el diario de capitulos, el fogon, el taller, la siembra, la
 * pausa y el resumen de la noche.
 *
 * Todas comparten la misma hoja con pestanas; el juego solo dice "abre esto
 * con estos datos" y recibe callbacks cuando el jugador elige algo.
 */
import { el, boton, vaciar, pct } from './base.js';
import { OBJETOS } from '../contenido/objetos.js';
import { HABILIDADES, nivelDesde, DESBLOQUEOS } from '../reglas/habilidades.js';
import { listar, peso, cargaMaxima } from '../reglas/inventario.js';
import { CULTIVOS } from '../contenido/cultivos.js';
import { disponibles as recetasDisponibles, puedeCocinar } from '../reglas/cocina.js';
import { humorFamilia, faltantes, CONSUMO } from '../reglas/hogar.js';

export class Paneles {
  constructor(raiz, acciones = {}) {
    this.acciones = acciones;
    this.fondo = el('div', { id: 'panel' });
    this.hoja = el('div', { clase: 'hoja' });
    this.titulo = el('h2', { texto: '' });
    this.cabecera = el('header', {}, [
      this.titulo,
      el('button', { clase: 'boton fantasma cerrar', texto: 'Cerrar ✕', alPulsar: () => this.cerrar() }),
    ]);
    this.pestanas = el('div', { clase: 'pestanas' });
    this.cuerpo = el('div', { clase: 'cuerpo' });
    this.hoja.append(this.cabecera, this.pestanas, this.cuerpo);
    this.fondo.appendChild(this.hoja);
    this.fondo.addEventListener('click', (e) => { if (e.target === this.fondo) this.cerrar(); });
    raiz.appendChild(this.fondo);
    this.tipo = null;
  }

  get abierto() { return !!this.tipo; }

  cerrar() {
    this.tipo = null;
    this.fondo.classList.remove('visible');
    this.acciones.alCerrar?.();
  }

  abrir(tipo, datos = {}) {
    this.tipo = tipo;
    this.datos = datos;
    this.fondo.classList.add('visible');
    vaciar(this.pestanas);
    vaciar(this.cuerpo);
    const pintores = {
      inventario: () => this._inventario(datos),
      habilidades: () => this._habilidades(datos),
      diario: () => this._diario(datos),
      cocina: () => this._recetas(datos, 'fogon', 'El fogón'),
      taller: () => this._recetas(datos, 'taller', 'El taller'),
      sembrar: () => this._sembrar(datos),
      despensa: () => this._despensa(datos),
      pausa: () => this._pausa(datos),
      resumen: () => this._resumen(datos),
      fin: () => this._fin(datos),
    };
    (pintores[tipo] || (() => {}))();
  }

  _pestanasDe(actual, lista) {
    vaciar(this.pestanas);
    for (const [id, nombre] of lista) {
      this.pestanas.appendChild(el('button', {
        clase: `pestana ${id === actual ? 'activa' : ''}`, texto: nombre,
        alPulsar: () => this.abrir(id, this.datos),
      }));
    }
  }

  // ------------------------------------------------------------ canasta
  _inventario(d) {
    this.titulo.textContent = 'Lo que llevás';
    this._pestanasDe('inventario', [['inventario', 'Canasta'], ['habilidades', 'Habilidades'], ['diario', 'Diario']]);
    const inv = d.estado.jugador.inventario;
    const lista = listar(inv);
    const kg = peso(inv), max = cargaMaxima(inv, d.nivelFuerza || 1);
    this.cuerpo.appendChild(el('div', { clase: 'nota', estilo: 'margin-bottom:12px' },
      [el('span', { texto: `Cargás ${kg.toFixed(1).replace('.', ',')} de ${max.toFixed(0)} kg. ` }),
        el('span', { texto: kg > max * 0.9 ? 'Vas al límite: te vas a cansar antes.' : 'Todavía te cabe más.' })]));
    if (!lista.length) {
      this.cuerpo.appendChild(el('div', { clase: 'vacio', texto: 'No llevás nada encima.' }));
      return;
    }
    const rejilla = el('div', { clase: 'rejilla-obj' });
    for (const x of lista) {
      const comestible = (x.objeto.hambre || 0) > 0 || (x.objeto.sed || 0) > 0;
      const puede = comestible && x.objeto.tipo !== 'crudo';
      rejilla.appendChild(el('button', {
        clase: `obj ${puede ? 'pulsable' : ''}`,
        titulo: x.objeto.descripcion || '',
        alPulsar: puede ? () => { this.acciones.alComer?.(x.id); this.abrir('inventario', this.datos); } : null,
      }, [
        el('div', { clase: 'emoji', texto: x.objeto.icono }),
        el('div', {}, [
          el('div', { clase: 'nombre', texto: x.objeto.nombre }),
          el('div', { clase: 'detalle', texto: puede ? 'Pulsá para comer' : `${x.peso.toFixed(1)} kg` }),
        ]),
        el('div', { clase: 'cantidad', texto: `×${x.cantidad}` }),
      ]));
    }
    this.cuerpo.appendChild(rejilla);
  }

  // -------------------------------------------------------- habilidades
  _habilidades(d) {
    this.titulo.textContent = 'Lo que vas aprendiendo';
    this._pestanasDe('habilidades', [['inventario', 'Canasta'], ['habilidades', 'Habilidades'], ['diario', 'Diario']]);
    const hab = d.estado.jugador.habilidades;
    for (const [id, def] of Object.entries(HABILIDADES)) {
      const info = nivelDesde(hab[id] || 0);
      const desbloqueos = Object.entries(DESBLOQUEOS[id] || {});
      this.cuerpo.appendChild(el('div', { clase: 'hab' }, [
        el('div', { clase: 'fila' }, [
          el('div', { texto: def.icono, estilo: 'font-size:19px' }),
          el('div', { clase: 'nombre', texto: def.nombre }),
          el('div', { clase: 'nivel', texto: `nivel ${info.nivel}` }),
        ]),
        el('div', { clase: 'desc', texto: def.descripcion }),
        el('div', { clase: 'riel' }, [el('div', { clase: 'relleno', estilo: `width:${pct(info.progreso)}` })]),
        el('div', { clase: 'lista' }, desbloqueos.map(([n, x]) => el('div', {
          clase: `pildora ${info.nivel >= Number(n) ? '' : 'bloqueada'}`,
          texto: info.nivel >= Number(n) ? x.texto : `Nivel ${n}: ${x.texto}`,
        }))),
      ]));
    }
  }

  // -------------------------------------------------------------- diario
  _diario(d) {
    this.titulo.textContent = 'Diario';
    this._pestanasDe('diario', [['inventario', 'Canasta'], ['habilidades', 'Habilidades'], ['diario', 'Diario']]);
    const r = d.progreso;
    if (r.activo) {
      const c = r.activo.capitulo;
      this.cuerpo.appendChild(el('div', { clase: 'capitulo activo' }, [
        el('h4', { texto: `${c.titulo}` }),
        el('div', { clase: 'sub', texto: c.subtitulo }),
        el('ul', { estilo: 'list-style:none;padding:0;margin:0;display:grid;gap:6px' },
          r.activo.objetivos.map((o) => el('li', { estilo: 'display:flex;gap:8px;font-size:12.5px;align-items:center' }, [
            el('span', { texto: o.hecho ? '✅' : '⬜' }),
            el('span', { texto: o.texto, estilo: o.hecho ? 'opacity:.6;text-decoration:line-through' : '' }),
            el('span', { estilo: 'margin-left:auto;color:var(--j-maiz)', texto: o.meta > 1 ? `${o.valor}/${o.meta}` : '' }),
          ]))),
        c.consejo ? el('div', { clase: 'consejo', texto: `💡 ${c.consejo}` }) : null,
      ]));
    }
    if (r.disponibles.length) {
      this.cuerpo.appendChild(el('h3', { texto: 'Se puede empezar', estilo: 'font-size:13px;margin:16px 0 8px;color:var(--j-hueso-2)' }));
      for (const c of r.disponibles) {
        this.cuerpo.appendChild(el('div', { clase: 'capitulo' }, [
          el('h4', { texto: c.titulo }),
          el('div', { clase: 'sub', texto: c.subtitulo }),
          boton('Empezar este capítulo', { clase: 'primario', alPulsar: () => { this.acciones.alEmpezarCapitulo?.(c.id); this.cerrar(); } }),
        ]));
      }
    }
    if (r.hechos.length) {
      this.cuerpo.appendChild(el('h3', { texto: `Terminados (${r.completados}/${r.total})`, estilo: 'font-size:13px;margin:16px 0 8px;color:var(--j-hueso-2)' }));
      for (const c of r.hechos) {
        this.cuerpo.appendChild(el('div', { clase: 'capitulo hecho' }, [
          el('h4', { texto: `✔ ${c.titulo}` }),
          el('div', { clase: 'sub', texto: c.subtitulo }),
        ]));
      }
    }
    if (!r.activo && !r.disponibles.length && r.completados === r.total) {
      this.cuerpo.appendChild(el('div', { clase: 'vacio', texto: 'Terminaste la historia. El valle sigue ahí: seguí viviendo en él.' }));
    }
  }

  // ------------------------------------------------------- fogon y taller
  _recetas(d, tipo, titulo) {
    this.titulo.textContent = titulo;
    this._pestanasDe(tipo, [['cocina', 'Fogón'], ['taller', 'Taller']]);
    const inv = d.estado.jugador.inventario;
    const sabe = d.sabe;
    const lista = recetasDisponibles(tipo, sabe);
    const rejilla = el('div', { clase: 'rejilla-obj', estilo: 'grid-template-columns:repeat(auto-fill,minmax(220px,1fr))' });
    for (const r of lista) {
      const chequeo = puedeCocinar(r.id, inv, { sabe, despensa: d.estado.hogar.despensa });
      const ingredientes = Object.entries(r.ingredientes)
        .map(([id, n]) => `${n} ${OBJETOS[id]?.nombre || id}`).join(', ')
        + (r.lena ? `, ${r.lena} leña` : '');
      rejilla.appendChild(el('button', {
        clase: `obj ${chequeo.ok ? 'pulsable' : 'no'}`,
        alPulsar: chequeo.ok ? () => { this.acciones.alCocinar?.(r.id); this.abrir(tipo, this.datos); } : null,
      }, [
        el('div', { clase: 'emoji', texto: r.icono }),
        el('div', { estilo: 'min-width:0' }, [
          el('div', { clase: 'nombre', texto: r.nombre }),
          el('div', { clase: 'detalle', texto: ingredientes }),
          el('div', { clase: 'detalle', estilo: 'color:var(--j-maiz)',
            texto: chequeo.ok ? `→ ${r.produce.cantidad} × ${OBJETOS[r.produce.id]?.nombre}` : (chequeo.motivo || `Falta: ${chequeo.faltan.map((f) => `${f.cantidad} ${f.nombre}`).join(', ')}`) }),
        ]),
      ]));
    }
    if (!lista.length) this.cuerpo.appendChild(el('div', { clase: 'vacio', texto: 'Todavía no sabés hacer nada aquí.' }));
    else this.cuerpo.appendChild(rejilla);
  }

  // ------------------------------------------------------------ sembrar
  _sembrar(d) {
    this.titulo.textContent = 'Qué sembrar en este cuadro';
    vaciar(this.pestanas);
    const inv = d.estado.jugador.inventario;
    const rejilla = el('div', { clase: 'rejilla-obj', estilo: 'grid-template-columns:repeat(auto-fill,minmax(220px,1fr))' });
    for (const [id, c] of Object.entries(CULTIVOS)) {
      const semillas = inv[c.semilla] || 0;
      const buenaEpoca = c.estaciones.includes(d.estacion);
      rejilla.appendChild(el('button', {
        clase: `obj ${semillas ? 'pulsable' : 'no'}`,
        alPulsar: semillas ? () => { this.acciones.alSembrar?.(id); this.cerrar(); } : null,
      }, [
        el('div', { clase: 'emoji', texto: c.icono }),
        el('div', {}, [
          el('div', { clase: 'nombre', texto: c.nombre }),
          el('div', { clase: 'detalle', texto: `${c.dias} días · agua ${c.aguaDia < 0.5 ? 'poca' : c.aguaDia < 0.8 ? 'normal' : 'mucha'}` }),
          el('div', { clase: 'detalle', estilo: `color:${buenaEpoca ? 'var(--j-verde)' : 'var(--j-rojo)'}`,
            texto: buenaEpoca ? 'Es su temporada' : 'Fuera de temporada: rinde poco' }),
        ]),
        el('div', { clase: 'cantidad', texto: `×${semillas}` }),
      ]));
    }
    this.cuerpo.appendChild(rejilla);
  }

  // ----------------------------------------------------------- despensa
  _despensa(d) {
    this.titulo.textContent = 'La despensa de la casa';
    vaciar(this.pestanas);
    const falta = faltantes(d.estado.hogar);
    this.cuerpo.appendChild(el('div', { clase: 'cifras', estilo: 'margin-bottom:14px' }, [
      cifra(`${CONSUMO.agua - falta.agua}/${CONSUMO.agua}`, 'litros de agua'),
      cifra(`${CONSUMO.lena - falta.lena}/${CONSUMO.lena}`, 'leñas'),
      cifra(`${CONSUMO.raciones - falta.raciones}/${CONSUMO.raciones}`, 'raciones'),
    ]));
    this.cuerpo.appendChild(el('div', { clase: 'nota', estilo: 'margin-bottom:14px' },
      [el('span', { texto: humorFamilia(d.estado.hogar) })]));
    const lista = listar(d.estado.hogar.despensa);
    if (!lista.length) {
      this.cuerpo.appendChild(el('div', { clase: 'vacio', texto: 'La despensa está vacía.' }));
      return;
    }
    const rejilla = el('div', { clase: 'rejilla-obj' });
    for (const x of lista) {
      rejilla.appendChild(el('button', {
        clase: 'obj pulsable', titulo: 'Tomar de la despensa',
        alPulsar: () => { this.acciones.alTomar?.(x.id); this.abrir('despensa', this.datos); },
      }, [
        el('div', { clase: 'emoji', texto: x.objeto.icono }),
        el('div', {}, [el('div', { clase: 'nombre', texto: x.objeto.nombre }),
          el('div', { clase: 'detalle', texto: 'Pulsá para llevártelo' })]),
        el('div', { clase: 'cantidad', texto: `×${x.cantidad}` }),
      ]));
    }
    this.cuerpo.appendChild(rejilla);
  }

  // -------------------------------------------------------------- pausa
  _pausa(d) {
    this.titulo.textContent = 'Pausa';
    vaciar(this.pestanas);
    const a = d.estado.ajustes;
    this.cuerpo.append(
      el('div', { clase: 'nota', estilo: 'margin-bottom:14px',
        texto: `Motor gráfico: ${d.motor}. Partida guardada automáticamente al terminar cada día.` }),
      el('div', { clase: 'fila-botones' }, [
        boton(a.sombras ? 'Sombras: sí' : 'Sombras: no', { alPulsar: () => { this.acciones.alAjustar?.('sombras', !a.sombras); this.abrir('pausa', this.datos); } }),
        boton(`Calidad: ${a.calidad}`, { alPulsar: () => { this.acciones.alAjustar?.('calidad', a.calidad === 'alta' ? 'media' : a.calidad === 'media' ? 'baja' : 'alta'); this.abrir('pausa', this.datos); } }),
        boton(`Motor: ${a.motor}`, { alPulsar: () => { this.acciones.alAjustar?.('motor', a.motor === 'auto' ? 'webgl2' : a.motor === 'webgl2' ? 'webgpu' : 'auto'); this.abrir('pausa', this.datos); } }),
      ]),
      el('div', { clase: 'fila-botones', estilo: 'margin-top:18px' }, [
        boton('Seguir jugando', { clase: 'primario', alPulsar: () => this.cerrar() }),
        boton('Guardar ahora', { alPulsar: () => { this.acciones.alGuardar?.(); this.cerrar(); } }),
        boton('Empezar de nuevo', { clase: 'fantasma', alPulsar: () => this.acciones.alReiniciar?.() }),
      ]),
      el('div', { clase: 'nota', estilo: 'margin-top:18px' }, [el('span', {
        texto: 'Teclas: WASD moverse · Shift correr · C agacharse · E interactuar · Espacio acción · I canasta · J diario · Esc pausa. También funciona con mando y con el dedo.',
      })]),
    );
  }

  // ------------------------------------------------------- resumen del dia
  _resumen(d) {
    this.titulo.textContent = `Se acabó el día ${d.parte.dia}`;
    vaciar(this.pestanas);
    const estrellas = '★'.repeat(d.parte.estrellas) + '☆'.repeat(3 - d.parte.estrellas);
    this.cuerpo.appendChild(el('div', { clase: 'resumen-dia' }, [
      el('div', { clase: 'estrellas', texto: estrellas, estilo: 'color:var(--j-maiz)' }),
      el('div', { clase: 'frase', texto: d.parte.texto }),
      el('div', { clase: 'cifras' }, [
        cifra(String(Math.round(d.parte.aporte)), 'de aporte'),
        cifra(String(d.hogar.diasSeguidos), 'días seguidos'),
        cifra(String(Math.round(d.hogar.animoFamilia)), 'ánimo de la casa'),
      ]),
      el('div', { clase: 'nota' }, [el('span', { texto: humorFamilia(d.hogar) })]),
      d.aprendido?.length ? el('div', { clase: 'fila-botones', estilo: 'justify-content:center' },
        d.aprendido.map((x) => el('div', { clase: 'pildora', texto: `${x.icono || '✨'} ${x.texto}` }))) : null,
      el('div', { clase: 'fila-botones', estilo: 'justify-content:center;margin-top:6px' }, [
        boton('Amanecer', { clase: 'primario', alPulsar: () => { this.cerrar(); this.acciones.alAmanecer?.(); } }),
      ]),
    ]));
  }

  _fin(d) {
    this.titulo.textContent = 'Fin del primer año';
    vaciar(this.pestanas);
    this.cuerpo.appendChild(el('div', { clase: 'resumen-dia' }, [
      el('div', { clase: 'estrellas', texto: '★★★', estilo: 'color:var(--j-maiz)' }),
      el('div', { clase: 'frase', texto: d.texto || 'Se acabó la historia que había escrita. El valle sigue.' }),
      el('div', { clase: 'fila-botones', estilo: 'justify-content:center' }, [
        boton('Seguir viviendo aquí', { clase: 'primario', alPulsar: () => this.cerrar() }),
      ]),
    ]));
  }
}

function cifra(n, t) {
  return el('div', { clase: 'cifra' }, [el('div', { clase: 'n', texto: n }), el('div', { clase: 't', texto: t })]);
}
