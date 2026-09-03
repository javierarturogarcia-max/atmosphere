/**
 * tacto.js — Botones grandes para jugar con el dedo.
 *
 * Aparecen solos cuando el aparato es tactil. La palanca de la izquierda la
 * gestiona nucleo/entrada.js (cualquier dedo en la mitad izquierda); aqui solo
 * estan los botones y la guia visual.
 */
import { el } from './base.js';

export class Tacto {
  constructor(raiz, entrada) {
    this.entrada = entrada;
    this.capa = el('div', { id: 'tacto' });
    this.palanca = el('div', { clase: 'palanca' }, [el('div', { clase: 'centro' })]);
    this.capa.appendChild(this.palanca);

    this.botones = {};
    const definir = (clase, icono, accion, mantenido) => {
      const b = el('div', { clase: `boton-tacto ${clase}`, texto: icono });
      const abajo = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (mantenido) entrada.mantener(accion, true);
        entrada.pulsar(accion);
        b.style.transform = 'scale(0.9)';
      };
      const arriba = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (mantenido) entrada.mantener(accion, false);
        b.style.transform = '';
      };
      b.addEventListener('pointerdown', abajo);
      b.addEventListener('pointerup', arriba);
      b.addEventListener('pointercancel', arriba);
      b.addEventListener('pointerleave', arriba);
      this.capa.appendChild(b);
      this.botones[accion] = b;
      return b;
    };
    definir('accion', '⚡', 'accion', true);
    definir('interactuar', '✋', 'interactuar', false);
    definir('correr', '🏃', 'correr', true);
    raiz.appendChild(this.capa);
  }

  mostrar(si) { this.capa.classList.toggle('visible', !!si); }

  /** Cambia el icono del boton principal segun lo que toque hacer. */
  iconoAccion(icono) {
    if (this.botones.accion) this.botones.accion.textContent = icono || '⚡';
  }
}
