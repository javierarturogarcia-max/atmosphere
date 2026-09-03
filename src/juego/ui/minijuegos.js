/**
 * minijuegos.js — Los momentos de accion: el pulso con el pez, el tiro con la
 * hondilla y el hacha rajando lena.
 *
 * Cada uno se abre con `iniciar*`, se avanza desde el bucle con `actualizar` y
 * avisa por callback cuando termina. La logica de reglas vive en reglas/pesca.js
 * y reglas/caza.js; aqui solo esta la presentacion y la lectura del mando.
 */
import { el, vaciar, pct } from './base.js';
import { avanzarLance, cobrar } from '../reglas/pesca.js';
import { posicionMira, disparar, probabilidadEstimada } from '../reglas/caza.js';
import { limitar } from '../nucleo/mate.js';

export class Minijuegos {
  constructor(raiz) {
    this.capa = el('div', { id: 'minijuego' });
    this.panel = el('div', { clase: 'tarjeta panel-mini' });
    this.mira = el('div', { clase: 'mira' });
    this.capa.append(this.mira, this.panel);
    raiz.appendChild(this.capa);
    this.modo = null;
  }

  get activo() { return !!this.modo; }

  _abrir(modo) {
    this.modo = modo;
    this.capa.classList.add('visible');
    vaciar(this.panel);
    vaciar(this.mira);
  }

  cerrar() {
    this.modo = null;
    this.capa.classList.remove('visible');
    vaciar(this.panel);
    vaciar(this.mira);
  }

  // ------------------------------------------------------------- pesca
  iniciarPesca(lance, alTerminar) {
    this._abrir('pesca');
    this.lance = lance;
    this.alTerminar = alTerminar;
    this.tituloMini = el('div', { clase: 'titulo', texto: 'Esperando que pique...' });
    this.ayuda = el('div', { clase: 'ayuda', texto: 'Cuando pique, pulsá para clavar el anzuelo.' });
    this.rellenoTension = el('div', { clase: 'relleno', estilo: 'width:0%' });
    this.rellenoProgreso = el('div', { clase: 'relleno', estilo: 'width:0%' });
    this.panel.append(
      this.tituloMini, this.ayuda,
      el('div', { clase: 'etiquetas' }, [el('span', { texto: 'Tensión de la línea' }), el('span', { texto: '¡No la revientes!' })]),
      el('div', { clase: 'medidor tension' }, [this.rellenoTension]),
      el('div', { clase: 'etiquetas' }, [el('span', { texto: 'Pez acercándose' }), el('span', { texto: '' })]),
      el('div', { clase: 'medidor progreso' }, [this.rellenoProgreso]),
    );
  }

  // -------------------------------------------------------------- caza
  iniciarCaza(apuntado, animal, alTerminar) {
    this._abrir('caza');
    this.apuntado = apuntado;
    this.animal = animal;
    this.alTerminar = alTerminar;
    this.tiempoMini = 0;
    this.mira.innerHTML = `<svg viewBox="0 0 96 96" width="96" height="96">
      <circle cx="48" cy="48" r="30" fill="none" stroke="rgba(246,239,227,.5)" stroke-width="1.5" stroke-dasharray="6 8"/>
      <circle cx="48" cy="48" r="3" fill="rgba(246,239,227,.9)"/>
      <path d="M48 10v12M48 74v12M10 48h12M74 48h12" stroke="rgba(246,239,227,.75)" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    const prob = probabilidadEstimada(apuntado, animal.perfil);
    this.tituloMini = el('div', { clase: 'titulo', texto: `Apuntando al ${animal.perfil.nombre}` });
    this.ayuda = el('div', { clase: 'ayuda',
      texto: `A ${apuntado.distancia.toFixed(0)} m · ${prob > 0.7 ? 'buen tiro' : prob > 0.4 ? 'tiro justo' : 'muy lejos'}. Soltá cuando la mira esté en el centro.` });
    this.panel.append(this.tituloMini, this.ayuda,
      el('div', { clase: 'etiquetas' }, [el('span', { texto: 'Pulso' }), el('span', { texto: apuntado.deriva > 0.25 ? '🌬️ el viento desvía' : 'sin viento' })]),
      el('div', { clase: 'medidor progreso' }, [el('div', { clase: 'relleno', estilo: `width:${pct(prob)}` })]),
      el('div', { clase: 'ayuda', estilo: 'margin:8px 0 0', texto: 'Espacio o el botón para tirar · Esc para dejarlo' }));
  }

  // -------------------------------------------------------------- lena
  iniciarLena(golpes, alTerminar) {
    this._abrir('lena');
    this.golpes = golpes;
    this.dados = 0;
    this.aciertos = 0;
    this.marcador = 0;
    this.direccion = 1;
    this.alTerminar = alTerminar;
    this.marca = el('div', { clase: 'marca', estilo: 'left:0%' });
    this.tituloMini = el('div', { clase: 'titulo', texto: 'Rajando leña' });
    this.ayuda = el('div', { clase: 'ayuda', texto: 'Pulsá cuando la marca pase por la zona verde.' });
    this.panel.append(this.tituloMini, this.ayuda,
      el('div', { clase: 'medidor' }, [
        el('div', { clase: 'zona', estilo: 'left:42%;width:16%' }),
        this.marca,
      ]));
  }

  /**
   * Avanza el minijuego activo.
   * @param {number} dt
   * @param {object} mando {accion: bool mantenido, pulso: bool recien pulsado, cancelar}
   */
  actualizar(dt, mando) {
    if (!this.modo) return;
    if (mando.cancelar) { const r = { cancelado: true }; this._fin(r); return; }

    if (this.modo === 'pesca') {
      const l = this.lance;
      const antes = l.estado;
      avanzarLance(l, dt, mando.accion, mando.pulso);
      if (l.estado !== antes) {
        if (l.estado === 'picando') {
          this.tituloMini.textContent = '¡PICÓ!';
          this.tituloMini.classList.add('picada');
          this.ayuda.textContent = 'Pulsá ya para clavar.';
        } else if (l.estado === 'luchando') {
          this.tituloMini.classList.remove('picada');
          this.tituloMini.textContent = `Peleando con un ${l.pez.nombre.toLowerCase()}`;
          this.ayuda.textContent = 'Mantené pulsado para recoger; soltá cuando la tensión suba.';
        }
      }
      this.rellenoTension.style.width = pct(l.tension);
      this.rellenoProgreso.style.width = pct(l.progreso);
      if (['cobrado', 'roto', 'escapado', 'fallado'].includes(l.estado)) {
        this._fin(l.estado === 'cobrado' ? { ...cobrar(l), ok: true } : { ok: false, texto: l.motivo || 'Se escapó.' });
      }
      return;
    }

    if (this.modo === 'caza') {
      this.tiempoMini += dt;
      const m = posicionMira(this.apuntado, this.tiempoMini);
      const escala = 34;
      this.mira.style.transform = `translate(${m.x * escala}px, ${m.y * escala}px)`;
      if (mando.pulso) {
        const tiro = disparar(this.apuntado, this.tiempoMini);
        this._fin({ disparo: true, ...tiro });
      } else if (this.tiempoMini > 9) {
        this._fin({ ok: false, texto: 'Se te fue el tiempo y el animal se movió.' });
      }
      return;
    }

    if (this.modo === 'lena') {
      this.marcador += this.direccion * dt * 1.35;
      if (this.marcador > 1) { this.marcador = 1; this.direccion = -1; }
      if (this.marcador < 0) { this.marcador = 0; this.direccion = 1; }
      this.marca.style.left = pct(this.marcador);
      if (mando.pulso) {
        const bueno = this.marcador > 0.42 && this.marcador < 0.58;
        if (bueno) this.aciertos++;
        this.dados++;
        this.tituloMini.textContent = bueno ? '¡Buen hachazo!' : 'Se te fue el golpe';
        if (this.dados >= this.golpes) {
          this._fin({ ok: true, aciertos: this.aciertos, golpes: this.golpes });
        }
      }
      return;
    }
  }

  _fin(resultado) {
    const cb = this.alTerminar;
    this.cerrar();
    cb?.(resultado);
  }
}
