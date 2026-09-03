/**
 * fauna.js — Animales del valle: cuando aparecen, como se mueven y cuando
 * te descubren.
 *
 * La caza no va de punteria sino de acercarse. Cada animal acumula sospecha
 * segun la distancia, el ruido que hagas, si vas agachado y —sobre todo— si el
 * viento le lleva tu olor. Por eso el clima importa: cazar a favor del viento
 * es la diferencia entre comer carne o volver con las manos vacias.
 */
import { generador } from '../../core/rng.js';
import { limitar, mezclar, suavizar, TAU, normalizar } from '../nucleo/mate.js';
import { NIVEL_AGUA } from './terreno.js';

export const PERFILES = {
  venado: {
    nombre: 'venado', malla: 'venado', escala: 1, altura: 1.1,
    velocidad: 1.5, huida: 9.5, radioVista: 30, oido: 1.0, olfato: 1.6,
    zonas: ['monte', 'ribera'], horas: [[4.5, 9.5], [15.5, 20.5]], objetivo: 3, grupo: [1, 2],
    presa: { objeto: 'carne_venado', cantidad: 3 }, xp: 26, dificultad: 0.8, radioTiro: 16,
  },
  conejo: {
    nombre: 'conejo', malla: 'conejo', escala: 1, altura: 0.3,
    velocidad: 1.1, huida: 7.5, radioVista: 16, oido: 1.3, olfato: 0.8,
    zonas: ['monte', 'potrero', 'ribera'], horas: [[4.5, 10], [16, 21]], objetivo: 6, grupo: [1, 2],
    presa: { objeto: 'carne_conejo', cantidad: 1 }, xp: 12, dificultad: 0.55, radioTiro: 11,
  },
  pajaro: {
    nombre: 'pajaro', malla: 'pajaro', escala: 1, altura: 2.6, vuela: true,
    velocidad: 3.2, huida: 8, radioVista: 14, oido: 1.4, olfato: 0.2,
    zonas: ['monte', 'ribera', 'potrero', 'casa'], horas: [[5, 18.5]], objetivo: 10, grupo: [2, 4],
    presa: { objeto: 'carne_pajaro', cantidad: 1 }, xp: 8, dificultad: 0.4, radioTiro: 9,
  },
  gallina: {
    nombre: 'gallina', malla: 'gallina', escala: 1, altura: 0.3, domestica: true,
    velocidad: 0.6, huida: 3.2, radioVista: 8, oido: 1, olfato: 0.4,
    zonas: ['casa'], horas: [[5.5, 18.5]], objetivo: 5, grupo: [2, 3],
    presa: null, xp: 0, dificultad: 0.2, radioTiro: 6,
  },
  pez: {
    nombre: 'pez', malla: 'pez', escala: 1, altura: -0.35, nada: true,
    velocidad: 1.3, huida: 4, radioVista: 7, oido: 0.6, olfato: 0,
    zonas: ['rio'], horas: [[0, 24]], objetivo: 14, grupo: [3, 6],
    presa: { objeto: 'pescado', cantidad: 1 }, xp: 10, dificultad: 0.5, radioTiro: 0,
  },
};

let siguienteId = 1;

export class Fauna {
  constructor(terreno, semilla = 1) {
    this.terreno = terreno;
    this.semilla = semilla;
    this.animales = [];
    this.rnd = generador(`${semilla}:fauna`);
  }

  /** Cuantos individuos de cada especie deberia haber a esta hora. */
  cupo(tipo, hora, clima) {
    const p = PERFILES[tipo];
    const activo = p.horas.some(([a, b]) => hora >= a && hora <= b);
    if (!activo) return p.domestica || p.nada ? Math.round(p.objetivo * 0.4) : 0;
    let n = p.objetivo;
    // Con lluvia fuerte los animales se recogen; el pez, al contrario, pica mas.
    if (clima?.lluvia > 0.5) n = Math.round(n * (p.nada ? 1.25 : 0.45));
    if (clima?.tormenta && !p.nada) n = Math.round(n * 0.3);
    return Math.max(0, n);
  }

  /** Punto valido para esta especie, buscado por sorteo con reintentos. */
  puntoValido(tipo, cerca = null) {
    const p = PERFILES[tipo];
    const t = this.terreno;
    for (let intento = 0; intento < 40; intento++) {
      let x, z;
      if (cerca) {
        const a = this.rnd() * TAU, d = this.rnd() * 7 + 1.5;
        x = cerca[0] + Math.cos(a) * d; z = cerca[1] + Math.sin(a) * d;
      } else {
        x = (this.rnd() - 0.5) * (t.lado - 24);
        z = (this.rnd() - 0.5) * (t.lado - 24);
      }
      if (!t.dentro(x, z)) continue;
      const zona = t.zona(x, z);
      if (!p.zonas.includes(zona)) continue;
      if (p.nada && t.profundidadAgua(x, z) < 0.9) continue;
      if (!p.nada && t.enAgua(x, z)) continue;
      if (!p.nada && t.pendiente(x, z) > 0.6) continue;
      return [x, z];
    }
    return null;
  }

  crear(tipo, x, z) {
    const p = PERFILES[tipo];
    const a = {
      id: siguienteId++, tipo, perfil: p,
      x, z, y: this.alturaDe(p, x, z),
      rumbo: this.rnd() * TAU, velocidad: 0,
      estado: 'pastar', sospecha: 0, temporizador: 1 + this.rnd() * 3,
      destino: null, fase: this.rnd() * TAU, vivo: true,
    };
    this.animales.push(a);
    return a;
  }

  alturaDe(p, x, z) {
    if (p.nada) return NIVEL_AGUA + p.altura;
    return this.terreno.altura(x, z) + (p.vuela ? p.altura : 0);
  }

  /** Ajusta la poblacion a la hora del dia. Se llama al pasar cada hora. */
  poblar(hora, clima) {
    for (const tipo of Object.keys(PERFILES)) {
      const objetivo = this.cupo(tipo, hora, clima);
      const vivos = this.animales.filter((a) => a.tipo === tipo && a.vivo);
      if (vivos.length > objetivo) {
        // Se retiran los mas lejanos, no los que el jugador tiene delante.
        for (const a of vivos.slice(objetivo)) a.vivo = false;
      }
      let faltan = objetivo - vivos.length;
      while (faltan > 0) {
        const punto = this.puntoValido(tipo);
        if (!punto) break;
        const p = PERFILES[tipo];
        const cuantos = Math.min(faltan, Math.round(mezclar(p.grupo[0], p.grupo[1], this.rnd())));
        for (let k = 0; k < cuantos; k++) {
          const cerca = k === 0 ? punto : (this.puntoValido(tipo, punto) || punto);
          this.crear(tipo, cerca[0], cerca[1]);
          faltan--;
        }
      }
    }
    this.animales = this.animales.filter((a) => a.vivo);
  }

  /**
   * Cuanta sospecha gana el animal por segundo.
   * @param {object} j {x, z, ruido 0..1, agachado bool}
   * @param {object} clima con viento {x, z, fuerza}
   */
  percepcion(a, j, clima) {
    const p = a.perfil;
    const dx = j.x - a.x, dz = j.z - a.z;
    const dist = Math.hypot(dx, dz);
    if (dist > p.radioVista * 1.5) return 0;

    const cerca = 1 - limitar(dist / (p.radioVista * 1.5), 0, 1);
    const sigilo = j.agachado ? 0.45 : 1;
    const ruido = mezclar(0.25, 1.35, limitar(j.ruido ?? 0.5, 0, 1));

    // Vista: mucho mas si te mueves rapido y vas de pie.
    let v = cerca * cerca * 1.5 * sigilo * mezclar(0.5, 1.4, limitar(j.ruido ?? 0.5, 0, 1));

    // Oido: escala con el ruido y poco con la distancia.
    v += cerca * ruido * p.oido * 0.7;

    // Olfato: solo si el viento sopla del jugador hacia el animal.
    if (clima?.viento && p.olfato > 0) {
      const haciaAnimal = normalizar([a.x - j.x, 0, a.z - j.z]);
      const alineado = haciaAnimal[0] * clima.viento.x + haciaAnimal[2] * clima.viento.z;
      if (alineado > 0) {
        v += cerca * alineado * clima.viento.fuerza * p.olfato * 1.6;
      }
    }
    // La lluvia tapa el ruido y borra el rastro.
    if (clima?.lluvia) v *= mezclar(1, 0.45, limitar(clima.lluvia, 0, 1));
    return v;
  }

  actualizar(dt, ctx) {
    const t = this.terreno;
    const j = ctx.jugador;
    const clima = ctx.clima;
    for (const a of this.animales) {
      if (!a.vivo) continue;
      const p = a.perfil;

      const gana = this.percepcion(a, j, clima) * dt;
      const pierde = (a.estado === 'huir' ? 0.05 : 0.42) * dt;
      a.sospecha = limitar(a.sospecha + gana - pierde, 0, 1.35);

      if (a.sospecha >= 1 && a.estado !== 'huir') {
        a.estado = 'huir';
        a.temporizador = mezclar(2.5, 5, this.rnd());
        a.rumbo = Math.atan2(a.z - j.z, a.x - j.x);
      } else if (a.sospecha > 0.42 && a.estado === 'pastar') {
        a.estado = 'alerta';
        a.temporizador = mezclar(1.2, 3, this.rnd());
      } else if (a.sospecha < 0.2 && a.estado === 'alerta') {
        a.estado = 'pastar';
      }

      a.temporizador -= dt;
      let vel = 0;
      if (a.estado === 'huir') {
        vel = p.huida;
        if (a.temporizador <= 0) { a.estado = 'pastar'; a.sospecha = 0.3; }
      } else if (a.estado === 'alerta') {
        vel = 0;
        // Mirar al intruso: gira despacio hacia el jugador.
        a.rumbo = Math.atan2(j.z - a.z, j.x - a.x);
        if (a.temporizador <= 0) { a.estado = 'pastar'; a.temporizador = 2 + this.rnd() * 3; }
      } else {
        // Pastar: paradas largas y trotecitos cortos.
        if (a.temporizador <= 0) {
          a.temporizador = mezclar(1.5, 5, this.rnd());
          a.andando = this.rnd() < (p.vuela || p.nada ? 0.85 : 0.5);
          a.rumbo += (this.rnd() - 0.5) * 2.2;
        }
        vel = a.andando ? p.velocidad : 0;
      }

      if (vel > 0) {
        const nx = a.x + Math.cos(a.rumbo) * vel * dt;
        const nz = a.z + Math.sin(a.rumbo) * vel * dt;
        if (this.puedeEstar(p, nx, nz)) {
          a.x = nx; a.z = nz;
        } else {
          a.rumbo += Math.PI * (0.5 + this.rnd() * 0.5);
        }
      }
      a.velocidad = vel;
      a.y = this.alturaDe(p, a.x, a.z) + (p.vuela ? Math.sin(ctx.tiempo * 1.7 + a.fase) * 0.35 : 0);
      a.fase += dt * (vel > 0 ? 6 : 1.2);
    }
    if (this.animales.length > 260) this.animales = this.animales.filter((a) => a.vivo);
  }

  puedeEstar(p, x, z) {
    const t = this.terreno;
    if (!t.dentro(x, z)) return false;
    if (p.nada) return t.profundidadAgua(x, z) > 0.6;
    if (p.vuela) return true;
    return !t.enAgua(x, z) && t.pendiente(x, z) < 0.68;
  }

  /** El animal cazable mas cercano dentro de un radio. */
  masCercano(x, z, radio = 20, filtro = null) {
    let mejor = null, mejorD = radio;
    for (const a of this.animales) {
      if (!a.vivo) continue;
      if (filtro && !filtro(a)) continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < mejorD) { mejorD = d; mejor = a; }
    }
    return mejor ? { animal: mejor, distancia: mejorD } : null;
  }

  cobrar(animal) {
    animal.vivo = false;
    this.animales = this.animales.filter((a) => a.vivo);
    return animal.perfil.presa;
  }

  get vivos() { return this.animales.filter((a) => a.vivo).length; }
}
