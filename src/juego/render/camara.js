/**
 * camara.js — Camara en tercera persona con amortiguacion y colision blanda.
 *
 * Sigue al nino por detras, se levanta si el terreno se le mete delante y se
 * sacude cuando hay trueno o cuando el hacha pega. El objetivo es que nunca
 * haya un corte brusco: todo se interpola con constantes de tiempo, asi que la
 * sensacion es la misma a 30 que a 144 fotogramas por segundo.
 */
import { m4, perspectiva, mirarA, multiplicar, limitar, mezclar, seguir, seguirAngulo, TAU } from '../nucleo/mate.js';

export class Camara {
  constructor() {
    this.objetivo = [0, 1.2, 0];
    this.objetivoSuave = [0, 1.2, 0];
    this.giro = 0;              // acimut, radianes
    this.giroDeseado = 0;
    this.inclinacion = 0.28;    // radianes sobre la horizontal
    this.inclinacionDeseada = 0.28;
    this.distancia = 6.2;
    this.distanciaDeseada = 6.2;
    this.fov = 58 * (Math.PI / 180);
    this.fovDeseado = this.fov;
    this.aspecto = 16 / 9;
    this.cerca = 0.12;
    this.lejos = 420;
    this.posicion = [0, 3, 8];
    this.vista = m4();
    this.proyeccion = m4();
    this.vistaProyeccion = m4();
    this.sacudida = 0;
    this.tiempo = 0;
  }

  girar(dx, dy) {
    this.giroDeseado -= dx;
    this.inclinacionDeseada = limitar(this.inclinacionDeseada + dy, -0.35, 1.25);
  }

  acercar(delta) {
    this.distanciaDeseada = limitar(this.distanciaDeseada + delta, 2.2, 14);
  }

  sacudir(fuerza) { this.sacudida = Math.min(1.2, this.sacudida + fuerza); }

  /**
   * @param {object} p {objetivo, alturaEn(x,z), dt, apuntando}
   */
  actualizar(p) {
    const dt = Math.min(p.dt, 0.05);
    this.tiempo += dt;
    const obj = p.objetivo;
    for (let k = 0; k < 3; k++) {
      this.objetivoSuave[k] = seguir(this.objetivoSuave[k], obj[k], k === 1 ? 7 : 11, dt);
    }
    this.giro = seguirAngulo(this.giro, this.giroDeseado, 12, dt);
    this.inclinacion = seguir(this.inclinacion, this.inclinacionDeseada, 12, dt);
    this.distancia = seguir(this.distancia, this.distanciaDeseada, 6, dt);
    this.fov = seguir(this.fov, this.fovDeseado, 8, dt);

    const ci = Math.cos(this.inclinacion), si = Math.sin(this.inclinacion);
    let ox = Math.sin(this.giro) * ci * this.distancia;
    let oz = Math.cos(this.giro) * ci * this.distancia;
    let oy = si * this.distancia + 0.6;

    let px = this.objetivoSuave[0] + ox;
    let py = this.objetivoSuave[1] + oy;
    let pz = this.objetivoSuave[2] + oz;

    // Colision blanda: si el suelo esta por encima de la camara, se sube.
    if (p.alturaEn) {
      const suelo = p.alturaEn(px, pz) + 0.55;
      if (py < suelo) py = mezclar(py, suelo, 0.85);
      // Y ademas se comprueba a mitad de camino, para lomas cortadas.
      const mx = mezclar(this.objetivoSuave[0], px, 0.55);
      const mz = mezclar(this.objetivoSuave[2], pz, 0.55);
      const sueloMedio = p.alturaEn(mx, mz) + 0.4;
      const yMedio = mezclar(this.objetivoSuave[1], py, 0.55);
      if (yMedio < sueloMedio) py += (sueloMedio - yMedio) * 1.2;
    }

    if (this.sacudida > 0.001) {
      const s = this.sacudida * 0.16;
      px += Math.sin(this.tiempo * 47) * s;
      py += Math.sin(this.tiempo * 61 + 1.7) * s;
      this.sacudida *= Math.exp(-4.5 * dt);
    }

    this.posicion[0] = px; this.posicion[1] = py; this.posicion[2] = pz;
    mirarA(this.posicion, [this.objetivoSuave[0], this.objetivoSuave[1] + 0.25, this.objetivoSuave[2]], [0, 1, 0], this.vista);
    perspectiva(this.fov, this.aspecto, this.cerca, this.lejos, this.proyeccion);
    multiplicar(this.proyeccion, this.vista, this.vistaProyeccion);
    return this;
  }

  /** Direccion horizontal a la que mira, para mover al personaje relativo a la camara. */
  get frente() {
    return [-Math.sin(this.giro), 0, -Math.cos(this.giro)];
  }
  get derecha() {
    return [Math.cos(this.giro), 0, -Math.sin(this.giro)];
  }
}
