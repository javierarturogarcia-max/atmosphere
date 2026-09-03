/**
 * reloj.js — El tiempo del juego.
 *
 * Un dia completo dura por defecto 16 minutos reales, asi que una hora de
 * juego son 40 segundos: lo bastante largo para que amanecer y anochecer se
 * noten, y lo bastante corto para que en una sesion quepan varios dias.
 */
import { limitar } from './mate.js';

export const FASES = [
  { id: 'madrugada', desde: 0,    hasta: 4.8,  nombre: 'Madrugada' },
  { id: 'amanecer',  desde: 4.8,  hasta: 6.8,  nombre: 'Amanecer' },
  { id: 'manana',    desde: 6.8,  hasta: 11.5, nombre: 'Mañana' },
  { id: 'mediodia',  desde: 11.5, hasta: 14.5, nombre: 'Mediodía' },
  { id: 'tarde',     desde: 14.5, hasta: 17.5, nombre: 'Tarde' },
  { id: 'atardecer', desde: 17.5, hasta: 19.3, nombre: 'Atardecer' },
  { id: 'noche',     desde: 19.3, hasta: 24,   nombre: 'Noche' },
];

export class Reloj {
  constructor(op = {}) {
    this.minutosPorDia = op.minutosPorDia ?? 16;
    this.dia = op.dia ?? 1;
    this.hora = op.hora ?? 6.2;
    this.pausado = false;
    this.escala = 1;
  }

  /** Horas de juego por segundo real. */
  get ritmo() { return 24 / (this.minutosPorDia * 60); }

  /**
   * @param {number} dtReal segundos
   * @returns {{horas, cambioHora, cambioDia, hora, dia}}
   */
  avanzar(dtReal) {
    if (this.pausado) return { horas: 0, cambioHora: false, cambioDia: false, hora: this.hora, dia: this.dia };
    const horas = dtReal * this.ritmo * this.escala;
    const antes = Math.floor(this.hora);
    this.hora += horas;
    let cambioDia = false;
    while (this.hora >= 24) { this.hora -= 24; this.dia++; cambioDia = true; }
    return {
      horas, cambioDia,
      cambioHora: Math.floor(this.hora) !== antes || cambioDia,
      hora: this.hora, dia: this.dia,
    };
  }

  /** Salta hasta una hora concreta (dormir). Devuelve las horas saltadas. */
  saltarA(hora, mismoDia = false) {
    let saltadas = hora - this.hora;
    if (saltadas <= 0 && !mismoDia) { saltadas += 24; this.dia++; }
    this.hora = hora;
    return saltadas;
  }

  get fase() {
    return FASES.find((f) => this.hora >= f.desde && this.hora < f.hasta) || FASES[FASES.length - 1];
  }

  get esNoche() {
    return this.hora < 5.2 || this.hora > 18.9;
  }

  /** "06:12" */
  get texto() {
    const h = Math.floor(this.hora);
    const m = Math.floor((this.hora - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  serializar() { return { dia: this.dia, hora: this.hora }; }
}

/** Progreso del dia de 0 a 1, para el reloj circular de la interfaz. */
export function progresoDia(hora) { return limitar(hora / 24, 0, 1); }
