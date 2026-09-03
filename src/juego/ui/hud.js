/**
 * hud.js — Lo que se ve mientras se juega: reloj, clima, necesidades,
 * objetivos del capitulo, avisos y el menu de lo que hay a mano.
 *
 * El HUD no sabe reglas: recibe datos ya masticados y los pinta.
 */
import { el, vaciar, anillo, pct } from './base.js';
import { describirClima } from '../mundo/clima.js';
import { nombreFecha } from '../mundo/clima.js';

const ICONO_CLIMA = {
  despejado: '☀️', 'medio nublado': '🌤️', nublado: '⛅', encapotado: '☁️',
  llovizna: '🌦️', lluvia: '🌧️', aguacero: '🌧️', tormenta: '⛈️',
};

export class Hud {
  constructor(raiz) {
    this.raiz = raiz;
    this.capa = el('div', { clase: 'capa', id: 'capa-hud' });

    // reloj
    this.esfera = el('div', { clase: 'esfera' });
    this.iconoFase = el('div', { clase: 'icono', texto: '🌅' });
    this.esfera.appendChild(this.iconoFase);
    this.hora = el('div', { clase: 'hora', texto: '06:00' });
    this.fecha = el('div', { clase: 'fecha', texto: 'Día 1' });
    this.clima = el('div', { clase: 'clima', texto: '' });
    this.reloj = el('div', { clase: 'tarjeta', id: 'reloj' }, [
      this.esfera,
      el('div', { clase: 'datos' }, [this.hora, this.fecha, this.clima]),
    ]);

    // objetivos
    this.tituloCap = el('h3', { texto: 'Sin capítulo' });
    this.subCap = el('p', { clase: 'sub', texto: '' });
    this.listaObj = el('ul');
    this.objetivos = el('div', { clase: 'tarjeta', id: 'objetivos' }, [this.tituloCap, this.subCap, this.listaObj]);

    // necesidades
    this.barras = {};
    const filas = [
      ['hambre', '🍽️'], ['sed', '💧'], ['aguante', '⚡'], ['animo', '✨'],
    ].map(([id, icono]) => {
      const relleno = el('div', { clase: 'relleno', estilo: 'width:100%' });
      const barra = el('div', { clase: `barra ${id}` }, [
        el('div', { clase: 'icono', texto: icono }),
        el('div', { clase: 'riel' }, [relleno]),
      ]);
      this.barras[id] = { barra, relleno };
      return barra;
    });
    this.carga = el('div', { id: 'carga', texto: '0,0 / 14 kg' });
    this.necesidades = el('div', { clase: 'tarjeta', id: 'necesidades' }, [...filas, this.carga]);

    this.avisos = el('div', { id: 'aviso' });
    this.contexto = el('div', { id: 'contexto' });
    this.botones = el('div', { id: 'botones' });

    this.capa.append(this.reloj, this.objetivos, this.necesidades, this.avisos, this.contexto, this.botones);
    raiz.appendChild(this.capa);
    this._ultimoContexto = '';
  }

  /** Botones de arriba (inventario, habilidades, diario, pausa). */
  ponerBotones(lista) {
    vaciar(this.botones);
    for (const b of lista) {
      this.botones.appendChild(el('button', {
        clase: `boton ${b.clase || ''}`, texto: b.texto, titulo: b.titulo, alPulsar: b.alPulsar,
      }));
    }
  }

  actualizar(d) {
    // --- reloj
    this.hora.textContent = d.reloj.texto;
    this.fecha.textContent = `Día ${d.dia} · ${nombreFecha(d.dia)}`;
    const desc = describirClima(d.clima);
    this.clima.textContent = `${ICONO_CLIMA[desc] || '🌤️'} ${desc} · ${Math.round(d.clima.temperatura)}°`;
    const fase = d.reloj.fase.id;
    this.iconoFase.textContent = { madrugada: '🌙', amanecer: '🌅', manana: '🌤️', mediodia: '☀️',
      tarde: '🌤️', atardecer: '🌇', noche: '🌙' }[fase] || '☀️';
    vaciar(this.esfera).append(anillo(d.reloj.hora / 24, { radio: 19, grosor: 3, color: d.reloj.esNoche ? '#8fb8e8' : '#f0b95c' }), this.iconoFase);

    // --- necesidades
    for (const [id, { barra, relleno }] of Object.entries(this.barras)) {
      const v = (d.necesidades[id] ?? 100) / 100;
      relleno.style.width = pct(v);
      barra.classList.toggle('baja', v < 0.22);
    }
    const kg = d.peso.toFixed(1).replace('.', ',');
    this.carga.textContent = `🎒 ${kg} / ${d.cargaMaxima.toFixed(0)} kg`;
    this.carga.classList.toggle('pasado', d.peso > d.cargaMaxima * 0.92);

    // --- objetivos del capitulo
    if (d.capitulo) {
      this.objetivos.classList.remove('oculto');
      this.tituloCap.textContent = d.capitulo.capitulo.titulo;
      this.subCap.textContent = d.capitulo.capitulo.subtitulo;
      const firma = d.capitulo.objetivos.map((o) => `${o.id}${o.valor}${o.hecho}`).join('|');
      if (firma !== this._firmaObj) {
        this._firmaObj = firma;
        vaciar(this.listaObj);
        for (const o of d.capitulo.objetivos) {
          this.listaObj.appendChild(el('li', { clase: o.hecho ? 'hecho' : '' }, [
            el('div', { clase: 'marca', texto: o.hecho ? '✓' : '' }),
            el('span', { texto: o.texto }),
            el('div', { clase: 'cuenta', texto: o.meta > 1 ? `${o.valor}/${o.meta}` : '' }),
          ]));
        }
      }
    } else {
      this.objetivos.classList.add('oculto');
    }
  }

  /** Menu de acciones a mano. `alElegir(opcion)` se llama al pulsar. */
  mostrarContexto(opciones, alElegir) {
    const firma = opciones.map((o) => o.id + o.etiqueta + (o.desactivada ? '0' : '1')).join('|');
    if (firma === this._ultimoContexto) return;
    this._ultimoContexto = firma;
    vaciar(this.contexto);
    this.contexto.classList.toggle('visible', opciones.length > 0);
    opciones.slice(0, 4).forEach((o, i) => {
      const nodo = el('div', {
        clase: `opcion ${i === 0 ? 'principal' : ''} ${o.desactivada ? 'desactivada' : ''}`,
        alPulsar: () => !o.desactivada && alElegir(o),
      }, [
        el('div', { clase: 'tecla', texto: i === 0 ? 'E' : String(i) }),
        el('div', { texto: `${o.icono || ''} ${o.etiqueta}`.trim() }),
        o.sub ? el('div', { clase: 'sub', texto: o.sub }) : null,
      ]);
      this.contexto.appendChild(nodo);
    });
  }

  ocultarContexto() {
    this._ultimoContexto = '';
    vaciar(this.contexto);
    this.contexto.classList.remove('visible');
  }

  /** Mensaje pasajero. tipo: bueno | malo | premio | neutro */
  aviso(texto, tipo = 'neutro', duracion = 3200) {
    if (!texto) return;
    const nodo = el('div', { clase: `mensaje ${tipo}`, texto });
    this.avisos.appendChild(nodo);
    while (this.avisos.children.length > 4) this.avisos.removeChild(this.avisos.firstChild);
    setTimeout(() => {
      nodo.classList.add('saliendo');
      setTimeout(() => nodo.remove(), 400);
    }, duracion);
  }

  visible(si) { this.capa.style.display = si ? '' : 'none'; }
}
