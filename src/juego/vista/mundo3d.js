/**
 * mundo3d.js — Convierte el valle simulado en lo que se ve.
 *
 * Separa lo estatico (terreno, agua, arboles, casa: se sube a la GPU una vez)
 * de lo dinamico (fauna, milpa, lluvia, fuego, luciernagas: se rehace cada
 * cuadro). Esa division es lo que permite tener un monte entero delante sin
 * gastar nada en mantenerlo.
 */
import { componer, m4, mezclar, limitar, hash2, TAU, suavizar } from '../nucleo/mate.js';
import { construir, PALETA, tinte } from '../render/malla.js';
import * as MOD from '../render/modelos.js';
import { NIVEL_AGUA, LUGARES } from '../mundo/terreno.js';
import { CULTIVOS } from '../contenido/cultivos.js';
import { etapaVisual } from '../reglas/cultivo.js';

const CONSTRUCTORES = {
  ceiba: MOD.arbolCeiba, pino: MOD.arbolPino, mango: MOD.arbolMango,
  jocote: MOD.arbolJocote, seco: MOD.arbolSeco, palmera: MOD.palmera,
  matorral: MOD.matorral, mora: MOD.matorralMora, helecho: MOD.helecho,
};
const FOLLAJE = new Set(['ceiba', 'pino', 'mango', 'jocote', 'palmera', 'matorral', 'mora', 'helecho']);

export class Mundo3D {
  constructor(escena, terreno, reparto, op = {}) {
    this.escena = escena;
    this.terreno = terreno;
    this.reparto = reparto;
    this.calidad = op.calidad || 'alta';
    this.m = m4();
    this.tiempo = 0;
    this.gotas = [];
    this.chispas = [];
    this.luciernagas = [];
    this.mallasCultivo = {};
    this.construir();
  }

  // ------------------------------------------------------------- estatico
  construir() {
    const t = this.terreno;
    const esc = this.escena;
    const uno = componer([0, 0, 0], [0, 0, 0], 1, m4());

    // --- terreno en trozos: cada trozo es un lote, asi el mapa grande no
    // depende de indices de 32 bits y ademas se puede descartar por distancia.
    const trozos = this.calidad === 'baja' ? 2 : 4;
    const paso = t.lado / trozos;
    const div = Math.round(paso / (this.calidad === 'baja' ? 3 : 1.6));
    for (let j = 0; j < trozos; j++) {
      for (let i = 0; i < trozos; i++) {
        const cx = -t.mitad + paso * (i + 0.5);
        const cz = -t.mitad + paso * (j + 0.5);
        const malla = construir(`terreno_${i}_${j}`, (c) => c.rejilla({
          ancho: paso + 0.3, fondo: paso + 0.3, divX: div, divZ: div, en: [cx, 0, cz],
          alturaEn: (x, z) => t.altura(x + cx, z + cz),
          colorEn: (x, z, y) => t.colorSuelo(x + cx, z + cz, y),
        }));
        esc.lote(`terreno_${i}_${j}`, malla, { estatico: true }).agregar(uno);
      }
    }

    // --- agua: solo donde el terreno esta por debajo del nivel del rio.
    const pasoAgua = 2.2;
    const mallaAgua = construir('agua', (c) => {
      const n = Math.floor(t.lado / pasoAgua);
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = -t.mitad + i * pasoAgua, z = -t.mitad + j * pasoAgua;
          const h = [t.altura(x, z), t.altura(x + pasoAgua, z), t.altura(x + pasoAgua, z + pasoAgua), t.altura(x, z + pasoAgua)];
          if (Math.min(...h) > NIVEL_AGUA + 0.25) continue;
          const prof = h.map((y) => limitar((NIVEL_AGUA - y) / 3.2, 0, 1));
          const base = c.vertices;
          const esquinas = [[x, z, prof[0]], [x + pasoAgua, z, prof[1]],
            [x + pasoAgua, z + pasoAgua, prof[2]], [x, z + pasoAgua, prof[3]]];
          for (const [px, pz, p] of esquinas) c.vertice([px, NIVEL_AGUA, pz], [0, 1, 0], PALETA.agua, p);
          c.quad(base, base + 1, base + 2, base + 3);
        }
      }
    });
    if (mallaAgua.cuenta) {
      esc.lote('agua', mallaAgua, { estatico: true, categoria: 'agua', sombra: false }).agregar(uno);
    }

    // --- cordillera del fondo: dos cortinas que cierran el horizonte.
    const uno2 = componer([0, 0, 0], [0, 0, 0], 1, m4());
    esc.lote('cordillera_1', MOD.cordillera(t.mitad + 30, 46, 3, [0.26, 0.34, 0.34]),
      { estatico: true, categoria: 'follaje', sombra: false }).agregar(uno2);
    esc.lote('cordillera_2', MOD.cordillera(t.mitad + 96, 94, 11, [0.34, 0.42, 0.50]),
      { estatico: true, categoria: 'follaje', sombra: false }).agregar(uno2);

    // --- vegetacion, agrupada por especie para instanciar de golpe.
    const porEspecie = {};
    for (const p of this.reparto.plantas) (porEspecie[p.especie] ||= []).push(p);
    for (const [especie, lista] of Object.entries(porEspecie)) {
      const hacer = CONSTRUCTORES[especie];
      if (!hacer) continue;
      // Tres variantes por especie: rompe la sensacion de copia y pega.
      const variantes = [0, 1, 2].map((k) => hacer(semillaFija(especie, k)));
      variantes.forEach((malla, k) => {
        const lote = esc.lote(`veg_${especie}_${k}`, malla, {
          estatico: true, capacidad: Math.max(8, lista.length),
          categoria: FOLLAJE.has(especie) ? 'follaje' : 'opaco',
        });
        for (const p of lista) {
          if (Math.abs(hash2(Math.round(p.x * 7), Math.round(p.z * 7), 13) * 3 | 0) % 3 !== k) continue;
          lote.agregar(componer([p.x, p.y, p.z], [0, p.giro, 0], p.escala, this.m),
            [1, 1, 1], 1, especie === 'seco' ? 0.3 : 1, 0, (p.x + p.z) * 0.7);
        }
      });
    }

    // --- piedras
    const rocas = [0, 1].map((k) => esc.lote(`roca_${k}`, MOD.roca(semillaFija('roca', k)),
      { estatico: true, capacidad: this.reparto.rocas.length }));
    this.reparto.rocas.forEach((r, i) => {
      rocas[i % 2].agregar(componer([r.x, r.y, r.z], [0, r.giro, 0], r.escala, this.m));
    });

    // --- hierba (solo si la calidad lo permite: es lo primero que se recorta)
    if (this.calidad !== 'baja') {
      const densidad = this.calidad === 'alta' ? 3 : 1;
      const hierba = esc.lote('hierba', MOD.hierba(semillaFija('hierba', 0)),
        { estatico: true, categoria: 'follaje', sombra: false, capacidad: this.reparto.hierba.length * densidad });
      for (const h of this.reparto.hierba) {
        for (let k = 0; k < densidad; k++) {
          const dx = (hash2(Math.round(h.x * 13) + k, Math.round(h.z * 13), 91) - 0.5) * 2.6;
          const dz = (hash2(Math.round(h.x * 13), Math.round(h.z * 13) + k, 77) - 0.5) * 2.6;
          const x = h.x + dx, z = h.z + dz;
          if (!this.terreno.dentro(x, z)) continue;
          const y = this.terreno.altura(x, z);
          if (y < NIVEL_AGUA + 0.2) continue;
          hierba.agregar(componer([x, y, z], [0, h.giro + k, 0], h.escala * mezclar(0.8, 1.3, hash2(k, Math.round(x), 3)), this.m),
            [1, 1, 1], 1, 1, 0, (x + z) * 1.3);
        }
      }
    }

    // --- troncos caidos y lena del suelo (son recursos, pero se ven siempre)
    const troncos = esc.lote('tronco_caido', MOD.troncoCaido(semillaFija('tronco', 0)),
      { estatico: true, capacidad: 220 });
    for (const r of this.reparto.recursos) {
      if (r.tipo !== 'tronco') continue;
      troncos.agregar(componer([r.x, r.y, r.z], [0, r.giro || 0, 0], r.escala || 1, this.m));
    }

    // --- la casa y su patio
    const casa = LUGARES.casa;
    const yCasa = t.altura(casa.x, casa.z);
    esc.lote('casa', MOD.casa(), { estatico: true })
      .agregar(componer([casa.x, yCasa, casa.z], [0, casa.giro, 0], 1, this.m));
    esc.lote('gallinero', MOD.gallinero(), { estatico: true })
      .agregar(componer([casa.x + 7, t.altura(casa.x + 7, casa.z - 4), casa.z - 4], [0, 0.9, 0], 1, this.m));
    const fog = LUGARES.fogon;
    this.yFogon = t.altura(fog.x, fog.z);
    esc.lote('fogon', MOD.fogon(), { estatico: true })
      .agregar(componer([fog.x, this.yFogon, fog.z], [0, 0.4, 0], 1, this.m));
    esc.lote('canasta', MOD.canasta(), { estatico: true })
      .agregar(componer([casa.x + 2.4, t.altura(casa.x + 2.4, casa.z + 3.4), casa.z + 3.4], [0, 1.2, 0], 1, this.m));

    // --- cerca del patio
    const cerca = esc.lote('cerca', MOD.cerca(), { estatico: true, capacidad: 40 });
    for (let a = 0; a < TAU; a += TAU / 22) {
      const rad = LUGARES.casa.radio + 3.5;
      const x = casa.x + Math.cos(a) * rad, z = casa.z + Math.sin(a) * rad * 0.85;
      if (Math.abs(a - Math.PI * 0.5) < 0.3) continue;   // hueco para entrar
      cerca.agregar(componer([x, t.altura(x, z), z], [0, a + Math.PI / 2, 0], 1, this.m));
    }

    // --- cuadros de la milpa (la tierra; las matas van aparte, son dinamicas)
    this.loteParcela = esc.lote('parcela', MOD.parcela(), { estatico: false, capacidad: 20 });

    // --- mallas de cultivo: 4 etapas por cultivo
    for (const [id, c] of Object.entries(CULTIVOS)) {
      const fn = { maiz: MOD.mataMaiz, frijol: MOD.mataFrijol, arroz: MOD.mataArroz, trigo: MOD.mataTrigo }[c.malla];
      if (!fn) continue;
      this.mallasCultivo[id] = [0, 1, 2, 3].map((etapa) => {
        const malla = fn(etapa, semillaFija(id, etapa));
        return esc.lote(`cultivo_${id}_${etapa}`, malla, { categoria: 'follaje', capacidad: 140 });
      });
    }

    // --- lotes dinamicos (fauna, particulas, marcadores)
    this.lotesFauna = {};
    for (const [tipo, hacer] of Object.entries({
      venado: MOD.venado, conejo: MOD.conejo, gallina: MOD.gallina, pajaro: MOD.pajaro, pez: MOD.pez,
    })) {
      this.lotesFauna[tipo] = esc.lote(`fauna_${tipo}`, hacer(semillaFija(tipo, 0)), { capacidad: 40 });
    }
    this.lotePerro = esc.lote('perro', MOD.perro(semillaFija('perro', 0)), { capacidad: 2 });
    this.loteSenal = esc.lote('senal', MOD.senal(), { capacidad: 8, sombra: false });
    this.loteQuad = esc.lote('particulas', MOD.quad(), { categoria: 'translucido', sombra: false, capacidad: 900 });
    this.loteQuad.comoCartel();
    this.loteFuego = esc.lote('fuego', MOD.quad(), { categoria: 'translucido', sombra: false, capacidad: 60 });
    this.loteFuego.comoCartel();
  }

  // ------------------------------------------------------------- dinamico
  /** Dibuja los cuadros de la milpa con el aspecto que toca. */
  emitirMilpa(cuadros) {
    this.loteParcela.reiniciar();
    for (const lista of Object.values(this.mallasCultivo)) for (const l of lista) l.reiniciar();
    for (const q of cuadros) {
      // El color del cuadro delata la humedad: tierra oscura = regada.
      const humedad = limitar(q.humedad ?? 0, 0, 1.2);
      const tono = mezclar(1.18, 0.62, limitar(humedad, 0, 1));
      this.loteParcela.agregar(componer([q.x, q.y, q.z], [0, 0, 0], 1.9, this.m),
        [tono, tono * 0.96, tono * 0.9], 1, 0, 0, 0);
      if (!q.cultivo || !this.mallasCultivo[q.cultivo]) continue;
      const etapa = etapaVisual(q);
      const lote = this.mallasCultivo[q.cultivo][etapa];
      const salud = limitar(q.salud ?? 1, 0, 1);
      const color = [mezclar(1.25, 1, salud), mezclar(0.75, 1, salud), mezclar(0.5, 1, salud)];
      for (let f = 0; f < 3; f++) {
        for (let c = 0; c < 3; c++) {
          const x = q.x + (c - 1) * 1.05 + (hash2(f, c, 5) - 0.5) * 0.3;
          const z = q.z + (f - 1) * 1.05 + (hash2(c, f, 9) - 0.5) * 0.3;
          lote.agregar(componer([x, this.terreno.altura(x, z), z], [0, hash2(f, c, 2) * TAU, 0],
            mezclar(0.85, 1.15, hash2(f + 3, c, 7)), this.m), color, 1, 1, 0, (x + z) * 0.9);
        }
      }
    }
  }

  emitirFauna(fauna) {
    for (const l of Object.values(this.lotesFauna)) l.reiniciar();
    for (const a of fauna.animales) {
      const lote = this.lotesFauna[a.tipo];
      if (!lote || !a.vivo) continue;
      // Trotecillo: los animales botan al andar, y el pez colea siempre.
      const bote = a.perfil.nada ? 0 : Math.abs(Math.sin(a.fase)) * (a.velocidad > 0 ? 0.06 : 0.01);
      const giro = a.perfil.nada ? a.rumbo + Math.sin(a.fase * 2) * 0.3 : a.rumbo;
      const alerta = a.estado === 'alerta' ? 1.06 : 1;
      lote.agregar(componer([a.x, a.y + bote, a.z], [0, -giro + Math.PI / 2, a.perfil.nada ? Math.sin(a.fase * 3) * 0.12 : 0],
        (a.perfil.escala || 1) * alerta, this.m));
    }
  }

  emitirPerro(perro) {
    this.lotePerro.reiniciar();
    if (!perro) return;
    const bote = Math.abs(Math.sin(perro.fase)) * 0.05;
    this.lotePerro.agregar(componer([perro.x, perro.y + bote, perro.z],
      [0, -perro.rumbo + Math.PI / 2, 0], 1, this.m));
  }

  emitirSenales(marcadores) {
    this.loteSenal.reiniciar();
    for (const m of marcadores || []) {
      const y = this.terreno.altura(m.x, m.z);
      this.loteSenal.agregar(componer([m.x, y, m.z], [0, this.tiempo * 0.6, 0], 1, this.m),
        m.color || [1, 0.85, 0.3], 1, 0, 0.5, 0);
    }
  }

  /**
   * Lluvia, fuego, humo y luciernagas. Todo con carteles hacia la camara.
   * @param {object} ctx {dt, camara, clima, hora, fogonEncendido}
   */
  emitirParticulas(ctx) {
    const { dt, camara, clima } = ctx;
    this.tiempo += dt;
    this.loteQuad.reiniciar();
    this.loteFuego.reiniciar();
    const cam = camara.posicion;

    // --- lluvia: caja de gotas que sigue a la camara
    const objetivo = Math.round((clima.lluvia || 0) * (this.calidad === 'alta' ? 620 : 260));
    while (this.gotas.length < objetivo) this.gotas.push(this.nuevaGota(cam));
    if (this.gotas.length > objetivo) this.gotas.length = objetivo;
    const vientoX = (clima.viento?.x || 0) * (clima.viento?.fuerza || 0) * 5;
    const vientoZ = (clima.viento?.z || 0) * (clima.viento?.fuerza || 0) * 5;
    for (const g of this.gotas) {
      g.y -= (16 + g.v) * dt;
      g.x += vientoX * dt; g.z += vientoZ * dt;
      const suelo = this.terreno.altura(g.x, g.z);
      if (g.y < suelo || Math.abs(g.x - cam[0]) > 26 || Math.abs(g.z - cam[2]) > 26) {
        Object.assign(g, this.nuevaGota(cam));
        continue;
      }
      this.loteQuad.agregar(componer([g.x, g.y, g.z], [0, 0, 0], [0.02, 0.55 + g.v * 0.02, 1], this.m),
        [0.72, 0.82, 0.92], 0.34, 0, 0, 0);
    }

    // --- fuego del fogon
    if (ctx.fogonEncendido) {
      const f = LUGARES.fogon;
      for (let k = 0; k < 9; k++) {
        const t = this.tiempo * 2.4 + k * 1.7;
        const alto = 0.18 + (t % 1) * 0.55;
        const s = (1 - (t % 1)) * 0.32;
        this.loteFuego.agregar(componer(
          [f.x + Math.sin(t * 3.1) * 0.1, this.yFogon + 0.15 + alto, f.z + Math.cos(t * 2.3) * 0.1],
          [0, 0, 0], [s, s * 1.6, 1], this.m),
          [1, mezclar(0.75, 0.35, t % 1), 0.15], 0.85 * (1 - (t % 1)), 0, 2.4, 0);
      }
      // humo
      for (let k = 0; k < 5; k++) {
        const t = (this.tiempo * 0.5 + k * 0.9) % 3;
        const s = 0.25 + t * 0.35;
        this.loteQuad.agregar(componer([f.x + Math.sin(t * 1.3) * 0.35, this.yFogon + 0.9 + t * 1.5, f.z + Math.cos(t) * 0.3],
          [0, 0, 0], [s, s, 1], this.m), [0.7, 0.7, 0.72], limitar(0.25 - t * 0.07, 0, 1), 0, 0, 0);
      }
    }

    // --- luciernagas de noche, si no llueve
    const nocheLimpia = (ctx.hora > 18.8 || ctx.hora < 5) && (clima.lluvia || 0) < 0.1;
    const cuantas = nocheLimpia ? (this.calidad === 'alta' ? 26 : 10) : 0;
    while (this.luciernagas.length < cuantas) {
      this.luciernagas.push({
        x: cam[0] + (Math.random() - 0.5) * 26, z: cam[2] + (Math.random() - 0.5) * 26,
        y: 0, fase: Math.random() * TAU, alto: 0.5 + Math.random() * 1.8,
      });
    }
    if (this.luciernagas.length > cuantas) this.luciernagas.length = cuantas;
    for (const l of this.luciernagas) {
      l.fase += dt * 0.9;
      l.x += Math.sin(l.fase * 1.3) * dt * 0.5;
      l.z += Math.cos(l.fase * 0.9) * dt * 0.5;
      if (Math.abs(l.x - cam[0]) > 30 || Math.abs(l.z - cam[2]) > 30) {
        l.x = cam[0] + (Math.random() - 0.5) * 26;
        l.z = cam[2] + (Math.random() - 0.5) * 26;
      }
      const y = this.terreno.altura(l.x, l.z) + l.alto + Math.sin(l.fase * 2.1) * 0.3;
      const brillo = Math.max(0, Math.sin(l.fase * 2.4));
      if (brillo < 0.15) continue;
      this.loteFuego.agregar(componer([l.x, y, l.z], [0, 0, 0], 0.07, this.m),
        [0.95, 1, 0.55], brillo * 0.9, 0, 3.5, 0);
    }
  }

  nuevaGota(cam) {
    const x = cam[0] + (Math.random() - 0.5) * 44;
    const z = cam[2] + (Math.random() - 0.5) * 44;
    return { x, z, y: this.terreno.altura(x, z) + 6 + Math.random() * 14, v: Math.random() * 6 };
  }

  /** Salpicadura al entrar al agua o al caer algo. */
  salpicar(x, y, z, n = 8) {
    for (let k = 0; k < n; k++) {
      this.chispas.push({
        x, y, z, vx: (Math.random() - 0.5) * 2.5, vy: 1.5 + Math.random() * 2.5,
        vz: (Math.random() - 0.5) * 2.5, vida: 0.7,
      });
    }
  }

  emitirChispas(dt) {
    for (let i = this.chispas.length - 1; i >= 0; i--) {
      const c = this.chispas[i];
      c.vida -= dt;
      if (c.vida <= 0) { this.chispas.splice(i, 1); continue; }
      c.vy -= 9.8 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      this.loteQuad.agregar(componer([c.x, c.y, c.z], [0, 0, 0], 0.09, this.m),
        [0.85, 0.93, 0.98], limitar(c.vida, 0, 1) * 0.8, 0, 0, 0);
    }
  }
}

/** Semilla estable por especie y variante: el bosque es el mismo siempre. */
function semillaFija(clave, k) {
  let h = 2166136261;
  const s = `${clave}:${k}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return function siguiente() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
