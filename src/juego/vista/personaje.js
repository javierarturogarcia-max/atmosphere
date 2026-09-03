/**
 * personaje.js — El nino, animado por piezas.
 *
 * No hay esqueleto ni pesos: hay seis piezas con el origen en su articulacion
 * y una matriz por pieza que se recalcula cada cuadro. Con eso salen el paso,
 * la carrera, el agachado, el nado y las poses de pescar y apuntar, y cuesta
 * practicamente nada.
 */
import { componer, m4, mezclar, seguir, seguirAngulo, limitar } from '../nucleo/mate.js';
import { piezasNino, herramientas } from '../render/modelos.js';

export class Personaje {
  constructor(escena, op = {}) {
    const piezas = piezasNino(op.aspecto || {});
    const utiles = herramientas();
    this.lotes = {
      torso: escena.lote('nino_torso', piezas.nino_torso, { capacidad: 2 }),
      cabeza: escena.lote('nino_cabeza', piezas.nino_cabeza, { capacidad: 2 }),
      sombrero: escena.lote('nino_sombrero', piezas.nino_sombrero, { capacidad: 2 }),
      brazo: escena.lote('nino_brazo', piezas.nino_brazo, { capacidad: 4 }),
      pierna: escena.lote('nino_pierna', piezas.nino_pierna, { capacidad: 4 }),
    };
    this.utiles = {
      hondilla: escena.lote('util_hondilla', utiles.hondilla, { capacidad: 2 }),
      cana: escena.lote('util_cana', utiles.cana, { capacidad: 2 }),
      machete: escena.lote('util_machete', utiles.machete, { capacidad: 2 }),
      balde: escena.lote('util_balde', utiles.balde, { capacidad: 2 }),
    };
    this.m = m4();
    this.fase = 0;
    this.inclina = 0;
    this.altura = 0;
    this.rumboSuave = 0;
    this.brazoIzq = 0; this.brazoDer = 0;
    this.pose = 'normal';
    this.sombrero = op.sombrero !== false;
  }

  /**
   * @param {number} dt
   * @param {object} e {x, y, z, rumbo, velocidad, agachado, pose, nadando, carga}
   */
  actualizar(dt, e) {
    const vel = e.velocidad || 0;
    // La cadencia del paso sube con la velocidad; corriendo es casi el doble.
    this.fase += dt * mezclar(0, 9.5, limitar(vel / 5.5, 0, 1.4));
    this.rumboSuave = seguirAngulo(this.rumboSuave, e.rumbo, 14, dt);
    const objetivoInclina = e.nadando ? 1.35 : limitar(vel * 0.045 + (e.carga || 0) * 0.22, 0, 0.42);
    this.inclina = seguir(this.inclina, objetivoInclina, 8, dt);
    this.altura = seguir(this.altura, e.agachado ? -0.16 : 0, 12, dt);
    this.pose = e.pose || 'normal';
    this.estado = e;
  }

  /** Escribe las instancias de este cuadro. */
  emitir() {
    const e = this.estado;
    if (!e) return;
    const base = [e.x, e.y + this.altura, e.z];
    const r = this.rumboSuave;
    const vel = e.velocidad || 0;
    const paso = Math.sin(this.fase);
    const paso2 = Math.sin(this.fase + Math.PI);
    const amplitud = mezclar(0.08, 0.95, limitar(vel / 5, 0, 1));
    const balanceo = Math.sin(this.fase * 2) * 0.022 * amplitud;
    const alturaTorso = 0.52 + balanceo + (e.nadando ? -0.28 : 0);

    const torso = [base[0], base[1] + alturaTorso, base[2]];
    this.lotes.torso.agregar(componer(torso, [this.inclina, r, Math.sin(this.fase * 2) * 0.03], 1, this.m));

    const cuello = [
      torso[0] - Math.sin(r) * Math.sin(this.inclina) * 0.42,
      torso[1] + 0.44 * Math.cos(this.inclina),
      torso[2] - Math.cos(r) * Math.sin(this.inclina) * 0.42,
    ];
    const miraCabeza = this.pose === 'apuntar' ? r : r + Math.sin(this.fase * 0.5) * 0.06;
    this.lotes.cabeza.agregar(componer(cuello, [this.inclina * 0.35, miraCabeza, 0], 1, this.m));
    if (this.sombrero) {
      this.lotes.sombrero.agregar(componer([cuello[0], cuello[1] + 0.11, cuello[2]],
        [this.inclina * 0.3, miraCabeza, 0], 1, this.m));
    }

    // Hombros y caderas, girados con el rumbo.
    const lado = (dx, dy, dz) => [
      base[0] + Math.cos(r) * dx - Math.sin(r) * dz,
      base[1] + dy,
      base[2] - Math.sin(r) * dx - Math.cos(r) * dz,
    ];

    let brazoIzq = -paso * amplitud * 0.9 + this.inclina * 0.3;
    let brazoDer = -paso2 * amplitud * 0.9 + this.inclina * 0.3;
    let piernaIzq = paso * amplitud * 0.85;
    let piernaDer = paso2 * amplitud * 0.85;
    let abreBrazos = 0;

    if (this.pose === 'cargar') { brazoIzq = 0.35; brazoDer = 0.35; abreBrazos = 0.18; }
    else if (this.pose === 'pescar') { brazoIzq = -1.15; brazoDer = -0.9; }
    else if (this.pose === 'apuntar') { brazoIzq = -1.45; brazoDer = -1.2; abreBrazos = 0.1; }
    else if (this.pose === 'recoger') { brazoIzq = -0.9; brazoDer = -0.6; }
    else if (this.pose === 'trabajar') {
      const golpe = Math.sin(this.fase * 1.6);
      brazoIzq = -1.2 + golpe * 0.9; brazoDer = -1.0 + golpe * 0.9;
    } else if (e.nadando) {
      brazoIzq = -1.9 + Math.sin(this.fase) * 0.8; brazoDer = -1.9 + Math.sin(this.fase + 2.1) * 0.8;
      piernaIzq = Math.sin(this.fase * 1.4) * 0.35; piernaDer = -piernaIzq;
    }

    const hombroY = base[1] + alturaTorso + 0.38;
    const caderaY = base[1] + alturaTorso + 0.02;
    this.lotes.brazo.agregar(componer(lado(-0.185, hombroY - base[1], 0), [brazoIzq, r, -abreBrazos], 1, this.m));
    this.lotes.brazo.agregar(componer(lado(0.185, hombroY - base[1], 0), [brazoDer, r, abreBrazos], 1, this.m));
    this.lotes.pierna.agregar(componer(lado(-0.085, caderaY - base[1], 0), [piernaIzq, r, 0], 1, this.m));
    this.lotes.pierna.agregar(componer(lado(0.085, caderaY - base[1], 0), [piernaDer, r, 0], 1, this.m));

    // Lo que lleva en la mano segun lo que este haciendo.
    const manoDer = lado(0.185 + Math.sin(abreBrazos) * 0.1, hombroY - base[1] - 0.42 * Math.cos(brazoDer), -0.42 * Math.sin(-brazoDer));
    const util = { pescar: 'cana', apuntar: 'hondilla', trabajar: 'machete', cargar: 'balde' }[this.pose];
    if (util && this.utiles[util]) {
      const inclinaUtil = { cana: brazoDer + 0.4, hondilla: brazoDer + 1.5, machete: brazoDer, balde: 0 }[util] ?? 0;
      this.utiles[util].agregar(componer(manoDer, [inclinaUtil, r, 0], 1, this.m));
    }
  }
}
