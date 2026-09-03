/**
 * renderizador.js — Elige el mejor camino disponible y expone una sola API.
 *
 * Preferencia: WebGPU si el navegador lo trae (es el estandar hacia el que va
 * todo el sector), WebGL2 si no. La partida no sabe cual esta usando: manda una
 * Escena y un marco, y ya.
 */
import { RenderizadorWebGPU } from './webgpu.js';
import { RenderizadorWebGL2 } from './webgl2.js';
import { m4, ortografica, mirarA, multiplicar, normalizar } from '../nucleo/mate.js';

export async function crearRenderizador(lienzo, opciones = {}) {
  const preferido = opciones.motor || 'auto';
  const intentos = [];
  if (preferido === 'auto' || preferido === 'webgpu') intentos.push(['WebGPU', RenderizadorWebGPU]);
  if (preferido === 'auto' || preferido === 'webgl2') intentos.push(['WebGL2', RenderizadorWebGL2]);

  const fallos = [];
  for (const [nombre, Clase] of intentos) {
    try {
      const r = await Clase.crear(lienzo, opciones);
      if (r) return r;
      fallos.push(`${nombre}: no disponible`);
    } catch (e) {
      fallos.push(`${nombre}: ${e.message}`);
      // Un contexto a medias deja el lienzo inservible para el siguiente
      // intento, asi que se sustituye por uno limpio.
      if (lienzo.parentNode && intentos.length > 1) {
        const nuevo = lienzo.cloneNode(false);
        lienzo.parentNode.replaceChild(nuevo, lienzo);
        lienzo = nuevo;
      }
    }
  }
  const error = new Error(`Ningun motor grafico disponible. ${fallos.join(' | ')}`);
  error.fallos = fallos;
  error.lienzo = lienzo;
  throw error;
}

const vistaLuz = m4();
const proyLuz = m4();

/**
 * Matriz del sol para el mapa de sombras: caja ortografica centrada en el
 * jugador. El "cuantizado" al texel evita que la sombra hierva al andar.
 */
export function matrizSombra(centro, dirSol, radio = 34, destino = m4(), lado = 2048) {
  const d = normalizar([dirSol[0], Math.max(dirSol[1], 0.22), dirSol[2]]);
  const paso = (radio * 2) / lado;
  const cx = Math.round(centro[0] / paso) * paso;
  const cz = Math.round(centro[2] / paso) * paso;
  const ojo = [cx + d[0] * radio * 2.2, centro[1] + d[1] * radio * 2.2, cz + d[2] * radio * 2.2];
  mirarA(ojo, [cx, centro[1], cz], [0, 1, 0], vistaLuz);
  ortografica(-radio, radio, -radio, radio, 0.5, radio * 5, proyLuz);
  return multiplicar(proyLuz, vistaLuz, destino);
}
