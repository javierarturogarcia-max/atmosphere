/**
 * estado.js — La partida: todo lo que hay que guardar para poder seguir mañana.
 *
 * Un unico objeto serializable. Nada de esto sale del dispositivo: se guarda en
 * localStorage con numero de version y migraciones, igual que el resto del
 * proyecto. Si un dia cambia la forma, se anade una migracion y las partidas
 * viejas siguen abriendo.
 */
import { crearNecesidades } from '../reglas/necesidades.js';
import { crearInventario } from '../reglas/inventario.js';
import { crearHabilidades, desbloqueado } from '../reglas/habilidades.js';
import { crearHogar } from '../reglas/hogar.js';
import { crearCuadro } from '../reglas/cultivo.js';

export const VERSION_PARTIDA = 1;
export const CLAVE_GUARDADO = 'monteadentro.partida.v1';

export function partidaNueva(op = {}) {
  return {
    version: VERSION_PARTIDA,
    semilla: op.semilla ?? Math.floor(Math.random() * 1e9),
    nombre: op.nombre || 'Tino',
    creada: new Date().toISOString(),
    jugada: 0,                       // segundos reales jugados
    dia: 1,
    hora: 6.9,
    jugador: {
      x: op.x ?? 0, z: op.z ?? 0, rumbo: 0,
      necesidades: crearNecesidades(),
      inventario: crearInventario({ cantaro: 1 }),
      habilidades: crearHabilidades(),
    },
    hogar: crearHogar(),
    cuadros: [],
    recursos: {},                    // id -> {agotadoHasta}
    trampas: [],
    sabe: [],                        // lo que le han ensenado los capitulos
    capitulos: { activo: null, hechos: [], vistos: [] },
    contadores: contadoresNuevos(),
    diario: [],                      // sucesos del dia, para el resumen nocturno
    ajustes: { motor: 'auto', sombras: true, calidad: 'alta', musica: true, tacto: 'auto' },
  };
}

export function contadoresNuevos() {
  return {
    entregado: {},
    entregadoCategoria: {},
    pescar: 0, cazar: 0, buscar: 0, sembrar: 0, regar: 0, deshierbar: 0, cosechar: 0,
    cocinar: 0, lena: 0, agua: 0, banar: 0, jugar_lluvia: 0, estrellas_noche: 0,
    trampa: 0, nadar: 0, dormir: 0, pasos: 0,
    recetas: {},
    cultivos: {},
    estrellas: 0,
    dias3estrellas: 0,
  };
}

/** Suma a un contador simple. */
export function contar(estado, clave, n = 1) {
  const c = estado.contadores;
  if (typeof c[clave] === 'number') c[clave] += n;
  else c[clave] = n;
  return c[clave];
}

export function contarEntrega(estado, id, cantidad, categoria) {
  const c = estado.contadores;
  c.entregado[id] = (c.entregado[id] || 0) + cantidad;
  if (categoria) c.entregadoCategoria[categoria] = (c.entregadoCategoria[categoria] || 0) + cantidad;
}

export function contarReceta(estado, id, n = 1) {
  estado.contadores.recetas[id] = (estado.contadores.recetas[id] || 0) + n;
  estado.contadores.cocinar++;
}

export function contarCultivo(estado, id, n = 1) {
  estado.contadores.cultivos[id] = (estado.contadores.cultivos[id] || 0) + n;
}

/** Todo lo que el nino sabe hacer: lo aprendido por historia + por habilidad. */
export function conocimientos(estado) {
  const set = desbloqueado(estado.jugador.habilidades);
  for (const s of estado.sabe || []) set.add(s);
  return set;
}

export function prepararCuadros(estado, cuadros) {
  if (estado.cuadros.length) return estado.cuadros;
  estado.cuadros = cuadros.map((c) => Object.assign(crearCuadro(c.id, c.x, c.y, c.z)));
  return estado.cuadros;
}

// ------------------------------------------------------------- persistencia
const MIGRACIONES = {
  // 0 -> 1: formato inicial. Se deja el mecanismo montado para lo que venga.
  1: (p) => p,
};

export function migrar(partida) {
  let p = partida;
  let v = p.version || 0;
  while (v < VERSION_PARTIDA) {
    v++;
    p = (MIGRACIONES[v] || ((x) => x))(p);
    p.version = v;
  }
  return p;
}

export function guardar(estado, almacenamiento = obtenerAlmacen()) {
  if (!almacenamiento) return false;
  try {
    almacenamiento.setItem(CLAVE_GUARDADO, JSON.stringify(estado));
    return true;
  } catch {
    return false;   // sin espacio o en modo privado: se sigue jugando en memoria
  }
}

export function cargar(almacenamiento = obtenerAlmacen()) {
  if (!almacenamiento) return null;
  try {
    const crudo = almacenamiento.getItem(CLAVE_GUARDADO);
    if (!crudo) return null;
    const p = migrar(JSON.parse(crudo));
    // Red de seguridad: una partida corrupta no debe romper el arranque.
    if (!p.jugador || !p.jugador.necesidades) return null;
    p.contadores = { ...contadoresNuevos(), ...(p.contadores || {}) };
    return p;
  } catch {
    return null;
  }
}

export function borrar(almacenamiento = obtenerAlmacen()) {
  try { almacenamiento?.removeItem(CLAVE_GUARDADO); return true; } catch { return false; }
}

export function hayPartida(almacenamiento = obtenerAlmacen()) {
  try { return !!almacenamiento?.getItem(CLAVE_GUARDADO); } catch { return false; }
}

function obtenerAlmacen() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
