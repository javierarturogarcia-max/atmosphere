/**
 * bucle.js — El bucle principal, con paso fijo para la simulacion.
 *
 * La simulacion avanza en pasos fijos de 1/60 s (lo que hace que el juego se
 * comporte igual en un movil de 30 Hz que en un monitor de 144 Hz) y el
 * dibujado ocurre una vez por fotograma. Si la pestana estuvo en segundo plano,
 * el salto se recorta en vez de simular diez segundos de golpe.
 */
export const PASO = 1 / 60;
const MAX_ACUMULADO = 0.25;

export class Bucle {
  constructor({ simular, dibujar, alFallar }) {
    this.simular = simular;
    this.dibujar = dibujar;
    this.alFallar = alFallar;
    this.acumulado = 0;
    this.ultimo = 0;
    this.corriendo = false;
    this.cuadros = 0;
    this.fps = 60;
    this.ventana = [];
    this._paso = this._paso.bind(this);
  }

  arrancar() {
    if (this.corriendo) return;
    this.corriendo = true;
    this.ultimo = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.id = requestAnimationFrame(this._paso);
  }

  parar() {
    this.corriendo = false;
    if (this.id) cancelAnimationFrame(this.id);
  }

  _paso(ahora) {
    if (!this.corriendo) return;
    this.id = requestAnimationFrame(this._paso);
    let dt = (ahora - this.ultimo) / 1000;
    this.ultimo = ahora;
    if (!(dt > 0)) return;
    if (dt > MAX_ACUMULADO) dt = MAX_ACUMULADO;

    this.ventana.push(dt);
    if (this.ventana.length > 30) this.ventana.shift();
    this.fps = 1 / (this.ventana.reduce((s, v) => s + v, 0) / this.ventana.length);

    this.acumulado += dt;
    let pasos = 0;
    try {
      while (this.acumulado >= PASO && pasos < 6) {
        this.simular(PASO);
        this.acumulado -= PASO;
        pasos++;
      }
      if (pasos >= 6) this.acumulado = 0;   // no arrastrar deuda imposible
      this.dibujar(dt, this.acumulado / PASO);
      this.cuadros++;
    } catch (e) {
      this.parar();
      if (this.alFallar) this.alFallar(e);
      else throw e;
    }
  }
}
