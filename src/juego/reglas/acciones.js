/**
 * acciones.js — Todo lo que el nino puede hacer y que pasa cuando lo hace.
 *
 * Cada accion es una funcion pura sobre el contexto de la partida: mira el
 * estado, decide y devuelve el resultado (texto, objetos, experiencia, si abre
 * un minijuego). Quien la aplica es partida.js. Asi las reglas se pueden
 * probar sin navegador y la interfaz no tiene logica de juego dentro.
 */
import { OBJETOS } from '../contenido/objetos.js';
import { NIVEL_AGUA, LUGARES } from '../mundo/terreno.js';
import { agregar, cuenta, quitar, peso, cargaMaxima } from './inventario.js';
import { beber as beberNec, banarse, comer } from './necesidades.js';
import { buscar, juntarLena, disponible, agotar } from './recoleccion.js';
import { arar, sembrar, regar, deshierbar, cosechar, listoParaCosechar, etapaDe, diagnostico } from './cultivo.js';
import { revisarTrampa, colocarTrampa, TRAMPA } from './caza.js';
import { entregarTodo } from './hogar.js';
import { nivel, bono } from './habilidades.js';
import { CULTIVOS } from '../contenido/cultivos.js';
import { limitar, mezclar } from '../nucleo/mate.js';

export const RADIO_INTERACCION = 3.2;

/**
 * Que tiene el nino a mano ahora mismo.
 * @param {object} ctx {estado, terreno, fauna, recursos, cuadros, jugador, clima, hora, dia, sabe}
 * @returns {Array} opciones ordenadas por cercania
 */
export function interaccionesCerca(ctx) {
  const { terreno, jugador } = ctx;
  const inv = ctx.estado.jugador.inventario;
  const ops = [];
  const dist = (x, z) => Math.hypot(x - jugador.x, z - jugador.z);

  // --- el rio
  const profundidad = terreno.profundidadAgua(jugador.x, jugador.z);
  const orilla = terreno.orillaCercana(jugador.x, jugador.z);
  const dOrilla = orilla ? dist(orilla[0], orilla[1]) : 999;
  if (profundidad > -0.6 || dOrilla < 4.5) {
    ops.push({ id: 'beber', etiqueta: 'Beber agua', icono: '💧', distancia: 0.4 });
    if (cuenta(inv, 'cantaro')) ops.push({ id: 'llenar', etiqueta: 'Llenar el cántaro', icono: '🏺', distancia: 0.5 });
    ops.push({ id: 'banar', etiqueta: 'Bañarse en el río', icono: '🏊', distancia: 0.6 });
    if (cuenta(inv, 'cana')) ops.push({ id: 'pescar', etiqueta: 'Pescar', icono: '🎣', distancia: 0.3 });
    if (cuenta(inv, 'atarraya')) ops.push({ id: 'atarraya', etiqueta: 'Tirar la atarraya', icono: '🕸️', distancia: 0.35 });
    ops.push({ id: 'buscar_ribera', etiqueta: 'Rebuscar en la orilla', icono: '🪨', distancia: 0.8 });
  }

  // --- recursos del monte (frutales, matas, lena, troncos)
  for (const r of ctx.recursos || []) {
    const d = dist(r.x, r.z);
    if (d > RADIO_INTERACCION + 1.4) continue;
    const memoria = ctx.estado.recursos[r.id];
    const libre = !memoria || disponible(memoria, ctx.dia);
    if (r.tipo === 'frutal') {
      ops.push({ id: 'recolectar', etiqueta: libre ? `Buscar en el palo de ${r.especie}` : 'Ya no queda fruta aquí',
        icono: '🥭', distancia: d, objetivo: r, desactivada: !libre, fuente: 'frutal' });
    } else if (r.tipo === 'mata') {
      ops.push({ id: 'recolectar', etiqueta: libre ? 'Rebuscar en la mata' : 'Mata ya rebuscada',
        icono: '🫐', distancia: d, objetivo: r, desactivada: !libre, fuente: 'mata' });
    } else if (r.tipo === 'tronco') {
      ops.push({ id: 'lena_suelo', etiqueta: libre ? 'Juntar leña del suelo' : 'Aquí ya no hay leña',
        icono: '🪵', distancia: d, objetivo: r, desactivada: !libre });
      if (cuenta(inv, 'machete') && libre) {
        ops.push({ id: 'rajar', etiqueta: 'Rajar el tronco con el machete', icono: '🪓', distancia: d + 0.1, objetivo: r });
      }
    } else if (r.tipo === 'lena') {
      ops.push({ id: 'lena_suelo', etiqueta: libre ? 'Recoger ramas secas' : 'Palo ya limpio',
        icono: '🪵', distancia: d, objetivo: r, desactivada: !libre });
    }
  }

  // --- rebuscar en el monte donde estes
  const zona = terreno.zona(jugador.x, jugador.z);
  if ((zona === 'monte' || zona === 'potrero') && profundidad < -0.5) {
    ops.push({ id: 'buscar_monte', etiqueta: 'Rebuscar en el monte', icono: '🌿', distancia: 1.2 });
  }

  // --- cuadros de la milpa
  for (const q of ctx.estado.cuadros || []) {
    const d = dist(q.x, q.z);
    if (d > RADIO_INTERACCION) continue;
    if (!q.cultivo) {
      if (!q.arado) ops.push({ id: 'arar', etiqueta: 'Arar el cuadro', icono: '⛏️', distancia: d, objetivo: q });
      else ops.push({ id: 'sembrar', etiqueta: 'Sembrar', icono: '🌱', distancia: d, objetivo: q, menu: 'sembrar' });
    } else {
      if (listoParaCosechar(q)) ops.push({ id: 'cosechar', etiqueta: 'Cosechar', icono: '🌽', distancia: d - 0.5, objetivo: q });
      ops.push({ id: 'regar', etiqueta: 'Regar', icono: '💧', distancia: d + 0.1, objetivo: q,
        desactivada: cuenta(inv, 'agua') < 1 });
      if (q.maleza > 0.25) ops.push({ id: 'deshierbar', etiqueta: 'Quitar la maleza', icono: '🌿', distancia: d + 0.2, objetivo: q });
    }
  }

  // --- casa y fogon
  const dCasa = dist(LUGARES.casa.x, LUGARES.casa.z);
  if (dCasa < LUGARES.casa.radio) {
    ops.push({ id: 'entregar', etiqueta: 'Dejar lo que traés en la casa', icono: '🏠', distancia: dCasa * 0.1 });
    ops.push({ id: 'despensa', etiqueta: 'Ver la despensa', icono: '🧺', distancia: dCasa * 0.1 + 0.4, menu: 'despensa' });
    if (ctx.hora > 19.5 || ctx.hora < 4.5) {
      ops.push({ id: 'dormir', etiqueta: 'Acostarse a dormir', icono: '🌙', distancia: 0.05 });
    }
  }
  const dFogon = dist(LUGARES.fogon.x, LUGARES.fogon.z);
  if (dFogon < 4) {
    ops.push({ id: 'cocinar', etiqueta: 'Cocinar en el fogón', icono: '🔥', distancia: dFogon * 0.1, menu: 'cocina' });
    ops.push({ id: 'taller', etiqueta: 'Hacer cosas (taller)', icono: '🔨', distancia: dFogon * 0.1 + 0.3, menu: 'taller' });
  }

  // --- caza
  if (cuenta(inv, 'hondilla') && cuenta(inv, 'piedra')) {
    const cerca = ctx.fauna?.masCercano(jugador.x, jugador.z, 22, (a) => a.perfil.presa);
    if (cerca) {
      ops.push({ id: 'cazar', etiqueta: `Apuntar al ${cerca.animal.perfil.nombre}`, icono: '🏹',
        distancia: 0.2, objetivo: cerca.animal, sub: `a ${cerca.distancia.toFixed(0)} m` });
    }
  }
  if (cuenta(inv, 'trampa')) {
    ops.push({ id: 'poner_trampa', etiqueta: 'Poner una trampa aquí', icono: '🪤', distancia: 1.6 });
  }
  for (const t of ctx.estado.trampas || []) {
    const d = dist(t.x, t.z);
    if (d < RADIO_INTERACCION) ops.push({ id: 'revisar_trampa', etiqueta: 'Revisar la trampa', icono: '🪤', distancia: d, objetivo: t });
  }

  // --- diversiones
  if ((ctx.clima?.lluvia ?? 0) > 0.25 && profundidad < -0.3) {
    ops.push({ id: 'jugar_lluvia', etiqueta: 'Jugar bajo la lluvia', icono: '🌧️', distancia: 1.9 });
  }
  if ((ctx.hora > 19.8 || ctx.hora < 4.5) && (ctx.clima?.nubosidad ?? 1) < 0.45 && profundidad < -0.3) {
    ops.push({ id: 'estrellas', etiqueta: 'Quedarse viendo las estrellas', icono: '✨', distancia: 2.1 });
  }

  return ops.filter((o) => !o.oculta).sort((a, b) => a.distancia - b.distancia);
}

/**
 * Ejecuta una accion.
 * @returns {{ok, texto, objetos, xp, habilidad, minijuego, tiempo, actividad}}
 */
export function ejecutar(op, ctx) {
  const e = ctx.estado;
  const inv = e.jugador.inventario;
  const nec = e.jugador.necesidades;
  const hab = e.jugador.habilidades;
  const sabe = ctx.sabe || new Set();
  const rnd = ctx.rnd || Math.random;
  const fuerza = nivel(hab, 'fuerza');

  switch (op.id) {
    case 'beber': {
      beberNec(nec, 1.5);
      return { ok: true, texto: 'Bebiste del río. Está fría.', tiempo: 4, actividad: 'quieto' };
    }
    case 'llenar': {
      const cap = OBJETOS.cantaro.capacidadAgua * (sabe.has('dos_cantaros') ? 2 : 1);
      const r = agregar(inv, 'agua', cap, fuerza);
      const texto = r.anadido === 0
        ? 'No podés con más peso. Dejá algo o llevá menos.'
        : `Llenaste ${r.anadido} litros.${r.lleno ? ' Ya no te cabe más.' : ''}`;
      return { ok: r.anadido > 0, texto, tiempo: 25, actividad: 'trabajar',
        xp: r.anadido > 0 ? 3 : 0, habilidad: 'fuerza', contador: 'agua' };
    }
    case 'banar': {
      banarse(nec);
      return { ok: true, texto: 'Te metiste al agua. Sale uno nuevo.', tiempo: 40, actividad: 'nadar',
        xp: 6, habilidad: 'espiritu', contador: 'banar' };
    }
    case 'pescar':
      return { ok: true, minijuego: 'pesca', texto: 'Tiraste el anzuelo.' };
    case 'atarraya':
      return { ok: true, minijuego: 'atarraya' };
    case 'cazar':
      return { ok: true, minijuego: 'caza', objetivo: op.objetivo };

    case 'buscar_ribera':
    case 'buscar_monte':
    case 'recolectar': {
      const fuente = op.fuente || (op.id === 'buscar_ribera' ? 'ribera' : 'monte');
      const zona = ctx.terreno.zona(ctx.jugador.x, ctx.jugador.z);
      const r = buscar({
        fuente, zona, mes: ctx.mes, sabe, rnd,
        especie: op.objetivo?.especie,
        lluviaReciente: ctx.lluviaReciente,
        bono: bono(hab, 'recoleccion'),
      });
      if (op.objetivo) {
        const mem = e.recursos[op.objetivo.id] || (e.recursos[op.objetivo.id] = {});
        agotar(mem, ctx.dia, fuente);
      }
      if (r.vacio) return { ok: true, texto: r.motivo, tiempo: 20, actividad: 'trabajar', xp: 1, habilidad: 'recoleccion', contador: 'buscar' };
      return {
        ok: true, objetos: r.objetos, xp: r.xp, habilidad: 'recoleccion',
        texto: r.objetos.map((o) => `${o.cantidad} × ${OBJETOS[o.id]?.nombre || o.id}`).join(', '),
        tiempo: 25, actividad: 'trabajar', contador: 'buscar',
      };
    }

    case 'lena_suelo':
    case 'rajar': {
      const modo = op.id === 'rajar' ? 'rajar' : 'suelo';
      const r = juntarLena(modo, { rnd, tieneMachete: cuenta(inv, 'machete') > 0, bono: bono(hab, 'fuerza') });
      if (!r.ok) return { ok: false, texto: r.motivo };
      if (op.objetivo) {
        const mem = e.recursos[op.objetivo.id] || (e.recursos[op.objetivo.id] = {});
        agotar(mem, ctx.dia, 'tronco');
      }
      return { ok: true, objetos: r.objetos, xp: r.xp, habilidad: 'fuerza', contador: 'lena',
        texto: `${r.objetos[0].cantidad} × ${OBJETOS[r.objetos[0].id].nombre}`,
        tiempo: modo === 'rajar' ? 90 : 35, actividad: 'trabajar', minijuego: 'lena' };
    }

    case 'arar': {
      const r = arar(op.objetivo);
      if (!r.ok) return { ok: false, texto: r.motivo };
      return { ok: true, texto: 'Cuadro arado y listo.', xp: 6, habilidad: 'siembra',
        tiempo: 55, actividad: 'trabajar' };
    }
    case 'sembrar': {
      const idCultivo = op.cultivo;
      const c = CULTIVOS[idCultivo];
      if (!c) return { ok: false, texto: 'No sabés sembrar eso.' };
      if (!cuenta(inv, c.semilla)) return { ok: false, texto: `No tenés semilla de ${c.nombre.toLowerCase()}.` };
      const r = sembrar(op.objetivo, idCultivo, ctx.dia);
      if (!r.ok) return { ok: false, texto: r.motivo };
      quitar(inv, c.semilla, 1);
      return { ok: true, texto: `Sembraste ${c.nombre.toLowerCase()}.`, xp: 10, habilidad: 'siembra',
        tiempo: 40, actividad: 'trabajar', contador: 'sembrar', cultivo: idCultivo };
    }
    case 'regar': {
      const litros = Math.min(cuenta(inv, 'agua'), 6);
      if (!litros) return { ok: false, texto: 'No traés agua.' };
      quitar(inv, 'agua', litros);
      regar(op.objetivo, litros, sabe.has('riego'));
      return { ok: true, texto: `Regaste con ${litros} litros.`, xp: 4, habilidad: 'siembra',
        tiempo: 25, actividad: 'trabajar', contador: 'regar' };
    }
    case 'deshierbar': {
      deshierbar(op.objetivo);
      return { ok: true, texto: 'Cuadro limpio de maleza.', xp: 5, habilidad: 'siembra',
        tiempo: 35, actividad: 'trabajar', contador: 'deshierbar' };
    }
    case 'cosechar': {
      const r = cosechar(op.objetivo, { bonoSiembra: bono(hab, 'siembra'), rnd });
      if (!r.ok) return { ok: false, texto: r.motivo };
      if (!r.grano) return { ok: true, texto: r.motivo, xp: 2, habilidad: 'siembra', tiempo: 30, actividad: 'trabajar' };
      const objetos = [{ id: r.grano, cantidad: r.cantidad }];
      if (r.semillas) objetos.push({ id: r.semilla, cantidad: r.semillas });
      return {
        ok: true, objetos, xp: 14 + r.cantidad * 2, habilidad: 'siembra', contador: 'cosechar',
        texto: `Cosechaste ${r.cantidad} de ${r.cultivo.nombre.toLowerCase()}`,
        tiempo: 45, actividad: 'trabajar',
      };
    }

    case 'entregar': {
      const entregas = entregarTodo(e.hogar, inv);
      if (!entregas.length) return { ok: false, texto: 'No traés nada que dejar.' };
      const total = entregas.reduce((s, x) => s + x.aporte, 0);
      return {
        ok: true, entregas, aporte: total, tiempo: 10, actividad: 'quieto',
        texto: `Dejaste ${entregas.reduce((s, x) => s + x.cantidad, 0)} cosas en la casa.`,
      };
    }
    case 'poner_trampa': {
      if (!cuenta(inv, 'trampa')) return { ok: false, texto: 'No tenés trampas.' };
      quitar(inv, 'trampa', 1);
      colocarTrampa(e, ctx.jugador.x, ctx.jugador.z, ctx.dia);
      return { ok: true, texto: 'Trampa puesta. Hay que revisarla mañana.', xp: 5, habilidad: 'caza',
        tiempo: 30, actividad: 'trabajar', contador: 'trampa' };
    }
    case 'revisar_trampa': {
      const r = revisarTrampa(op.objetivo, ctx.dia, { rnd, bono: bono(hab, 'caza') });
      if (!r.ok) return { ok: false, texto: r.motivo };
      e.trampas = e.trampas.filter((t) => t !== op.objetivo);
      agregar(inv, 'trampa', 1, fuerza);
      return { ok: true, texto: r.texto, objetos: r.objetos, xp: r.xp, habilidad: 'caza',
        tiempo: 20, actividad: 'trabajar' };
    }
    case 'jugar_lluvia': {
      return { ok: true, texto: 'Corriste bajo el agua hasta quedar empapado.', xp: 18, habilidad: 'espiritu',
        tiempo: 45, actividad: 'jugar', contador: 'jugar_lluvia' };
    }
    case 'estrellas': {
      return { ok: true, texto: 'Sin luz eléctrica, el cielo se ve entero.', xp: 12, habilidad: 'espiritu',
        tiempo: 60, actividad: 'quieto', contador: 'estrellas_noche' };
    }
    case 'dormir':
      return { ok: true, dormir: true };
    default:
      return { ok: false, texto: 'Eso todavía no se puede hacer.' };
  }
}

/** Texto de ayuda del cuadro que se tiene delante (se ve en el HUD). */
export function estadoCuadro(cuadro) {
  return diagnostico(cuadro);
}

/** Cuanto pesa lo que lleva, de 0 a 1 y mas alla (a partir de 1 va cargado). */
export function cargaRelativa(estado) {
  const inv = estado.jugador.inventario;
  return peso(inv) / cargaMaxima(inv, nivel(estado.jugador.habilidades, 'fuerza'));
}
