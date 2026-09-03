/**
 * dialogo.js — La caja de dialogo, con texto que se escribe solo.
 *
 * Se usa para la historia (intros y cierres de capitulo) y para lo que dice la
 * gente de la casa al pasar. Cualquier tecla o toque adelanta; si el texto
 * todavia se esta escribiendo, lo termina de golpe.
 */
import { el, vaciar } from './base.js';
import { PERSONAJES } from '../contenido/capitulos.js';

const VELOCIDAD = 34;   // caracteres por segundo

export class Dialogo {
  constructor(raiz) {
    this.quien = el('div', { clase: 'quien' });
    this.texto = el('div', { clase: 'texto' });
    this.puntos = el('div', { clase: 'puntos' });
    this.pie = el('div', { clase: 'pie' }, [
      el('span', { texto: 'Pulsá para seguir' }),
      this.puntos,
    ]);
    this.caja = el('div', { clase: 'tarjeta', id: 'dialogo' }, [this.quien, this.texto, this.pie]);
    this.caja.addEventListener('click', () => this.avanzar());
    raiz.appendChild(this.caja);
    this.lineas = [];
    this.indice = 0;
    this.escrito = 0;
    this.alTerminar = null;
  }

  get activo() { return this.lineas.length > 0; }

  mostrar(lineas, alTerminar) {
    if (!lineas || !lineas.length) { alTerminar?.(); return; }
    this.lineas = lineas.slice();
    this.indice = 0;
    this.escrito = 0;
    this.alTerminar = alTerminar;
    this.caja.classList.add('visible');
    this._pintar();
  }

  _pintar() {
    const l = this.lineas[this.indice];
    if (!l) return;
    const p = PERSONAJES[l.quien] || { nombre: '', color: '#cfd8e3' };
    vaciar(this.quien);
    if (p.nombre) {
      this.quien.append(
        el('div', { clase: 'ficha', texto: p.nombre[0], estilo: `background:${p.color}` }),
        el('span', { texto: p.nombre, estilo: `color:${p.color}` }),
      );
    }
    vaciar(this.puntos);
    for (let i = 0; i < this.lineas.length; i++) {
      this.puntos.appendChild(el('div', { clase: `punto ${i <= this.indice ? 'activo' : ''}` }));
    }
    this.texto.textContent = '';
  }

  /** Se llama desde el bucle: escribe el texto poco a poco. */
  actualizar(dt) {
    if (!this.activo) return;
    const l = this.lineas[this.indice];
    if (!l) return;
    if (this.escrito < l.texto.length) {
      this.escrito = Math.min(l.texto.length, this.escrito + dt * VELOCIDAD);
      this.texto.textContent = l.texto.slice(0, Math.floor(this.escrito));
    }
  }

  avanzar() {
    if (!this.activo) return false;
    const l = this.lineas[this.indice];
    if (this.escrito < l.texto.length) {
      this.escrito = l.texto.length;
      this.texto.textContent = l.texto;
      return true;
    }
    this.indice++;
    this.escrito = 0;
    if (this.indice >= this.lineas.length) {
      this.cerrar();
      this.alTerminar?.();
      return true;
    }
    this._pintar();
    return true;
  }

  cerrar() {
    this.lineas = [];
    this.indice = 0;
    this.caja.classList.remove('visible');
  }
}
