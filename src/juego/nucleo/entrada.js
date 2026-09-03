/**
 * entrada.js — Teclado, raton, tactil y mando, en una sola interfaz.
 *
 * El juego nunca pregunta "que tecla esta pulsada" sino "hacia donde quiere ir"
 * y "ha pedido interactuar". Asi el mismo codigo vale para un teclado, para el
 * dedo de un movil y para un mando, que era el objetivo: que se pueda jugar en
 * cualquier cosa que tenga pantalla.
 */
import { limitar } from './mate.js';

const MAPA = {
  KeyW: 'arriba', ArrowUp: 'arriba',
  KeyS: 'abajo', ArrowDown: 'abajo',
  KeyA: 'izquierda', ArrowLeft: 'izquierda',
  KeyD: 'derecha', ArrowRight: 'derecha',
  ShiftLeft: 'correr', ShiftRight: 'correr',
  ControlLeft: 'agachar', KeyC: 'agachar',
  KeyE: 'interactuar', Enter: 'interactuar',
  Space: 'accion',
  KeyI: 'inventario', Tab: 'inventario',
  KeyJ: 'diario',
  KeyQ: 'mapa',
  Escape: 'pausa',
  KeyF: 'linterna',
};

export class Entrada {
  constructor(elemento, op = {}) {
    this.el = elemento;
    this.teclas = new Set();
    this.acciones = new Set();      // pulsaciones pendientes de consumir
    this.mantenidas = new Set();
    this.raton = { dx: 0, dy: 0, rueda: 0, pulsado: false, x: 0, y: 0 };
    this.palanca = { x: 0, y: 0, activa: false, id: null, ox: 0, oy: 0 };
    this.mirada = { x: 0, y: 0, id: null };
    this.tactil = false;
    this.sensibilidad = op.sensibilidad ?? 1;
    this.activo = true;
    this._instalar();
  }

  _instalar() {
    const el = this.el;
    this._teclaAbajo = (e) => {
      if (!this.activo) return;
      const a = MAPA[e.code];
      if (!a) return;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!this.teclas.has(e.code)) this.acciones.add(a);
      this.teclas.add(e.code);
      this.mantenidas.add(a);
    };
    this._teclaArriba = (e) => {
      const a = MAPA[e.code];
      this.teclas.delete(e.code);
      if (a && ![...this.teclas].some((c) => MAPA[c] === a)) this.mantenidas.delete(a);
    };
    addEventListener('keydown', this._teclaAbajo);
    addEventListener('keyup', this._teclaArriba);
    addEventListener('blur', () => { this.teclas.clear(); this.mantenidas.clear(); });

    el.addEventListener('pointerdown', (e) => {
      if (!this.activo) return;
      el.setPointerCapture?.(e.pointerId);
      if (e.pointerType === 'touch') {
        this.tactil = true;
        const mitad = el.clientWidth / 2;
        if (e.clientX < mitad && !this.palanca.activa) {
          this.palanca = { x: 0, y: 0, activa: true, id: e.pointerId, ox: e.clientX, oy: e.clientY };
        } else if (this.mirada.id === null) {
          this.mirada = { x: e.clientX, y: e.clientY, id: e.pointerId };
        }
      } else {
        this.raton.pulsado = true;
        this.raton.x = e.clientX; this.raton.y = e.clientY;
      }
    });

    el.addEventListener('pointermove', (e) => {
      if (!this.activo) return;
      if (e.pointerId === this.palanca.id) {
        const dx = e.clientX - this.palanca.ox, dy = e.clientY - this.palanca.oy;
        const r = 62;
        this.palanca.x = limitar(dx / r, -1, 1);
        this.palanca.y = limitar(dy / r, -1, 1);
      } else if (e.pointerId === this.mirada.id) {
        this.raton.dx += (e.clientX - this.mirada.x) * 0.0055 * this.sensibilidad;
        this.raton.dy += (e.clientY - this.mirada.y) * 0.0045 * this.sensibilidad;
        this.mirada.x = e.clientX; this.mirada.y = e.clientY;
      } else if (this.raton.pulsado || document.pointerLockElement === el) {
        const dx = document.pointerLockElement === el ? e.movementX : e.clientX - this.raton.x;
        const dy = document.pointerLockElement === el ? e.movementY : e.clientY - this.raton.y;
        this.raton.dx += dx * 0.0042 * this.sensibilidad;
        this.raton.dy += dy * 0.0035 * this.sensibilidad;
        this.raton.x = e.clientX; this.raton.y = e.clientY;
      }
    });

    const soltar = (e) => {
      if (e.pointerId === this.palanca.id) this.palanca = { x: 0, y: 0, activa: false, id: null, ox: 0, oy: 0 };
      else if (e.pointerId === this.mirada.id) this.mirada = { x: 0, y: 0, id: null };
      this.raton.pulsado = false;
    };
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    el.addEventListener('wheel', (e) => { this.raton.rueda += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Botones de la interfaz tactil: se pulsan desde ui/tacto.js. */
  pulsar(accion) { this.acciones.add(accion); }
  mantener(accion, si) { if (si) this.mantenidas.add(accion); else this.mantenidas.delete(accion); }

  /** Direccion deseada en el plano, ya normalizada. */
  get direccion() {
    let x = 0, y = 0;
    if (this.mantenidas.has('izquierda')) x -= 1;
    if (this.mantenidas.has('derecha')) x += 1;
    if (this.mantenidas.has('arriba')) y -= 1;
    if (this.mantenidas.has('abajo')) y += 1;
    if (this.palanca.activa) { x += this.palanca.x; y += this.palanca.y; }
    const mando = this._mando();
    if (mando) { x += mando.ejes[0]; y += mando.ejes[1]; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y, fuerza: Math.min(1, l) };
  }

  _mando() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const g = [...navigator.getGamepads()].find((p) => p && p.connected);
    if (!g) return null;
    const zm = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    // Botones estandar: A accion, B agachar, X interactuar, Y diario.
    if (g.buttons[0]?.pressed) this.mantenidas.add('accion'); else this.mantenidas.delete('accion');
    if (g.buttons[2]?.pressed) this.acciones.add('interactuar');
    if (g.buttons[1]?.pressed) this.mantenidas.add('agachar'); else this.mantenidas.delete('agachar');
    if (g.buttons[3]?.pressed) this.acciones.add('diario');
    if (g.buttons[9]?.pressed) this.acciones.add('pausa');
    if (g.buttons[6]?.pressed || g.buttons[10]?.pressed) this.mantenidas.add('correr');
    this.raton.dx += zm(g.axes[2] || 0) * 0.045;
    this.raton.dy += zm(g.axes[3] || 0) * 0.03;
    return { ejes: [zm(g.axes[0] || 0), zm(g.axes[1] || 0)] };
  }

  activa(accion) { return this.mantenidas.has(accion); }

  /** Devuelve true una sola vez por pulsacion. */
  consumir(accion) {
    if (!this.acciones.has(accion)) return false;
    this.acciones.delete(accion);
    return true;
  }

  /** Lee y pone a cero el movimiento acumulado del raton. */
  tomarMirada() {
    const m = { dx: this.raton.dx, dy: this.raton.dy, rueda: this.raton.rueda };
    this.raton.dx = 0; this.raton.dy = 0; this.raton.rueda = 0;
    return m;
  }

  limpiar() { this.acciones.clear(); }

  destruir() {
    removeEventListener('keydown', this._teclaAbajo);
    removeEventListener('keyup', this._teclaArriba);
  }
}
