/**
 * escena.js — Lo que se manda a dibujar cada fotograma.
 *
 * No hay grafo de escena jerarquico: hay lotes. Un lote es "esta malla, estas
 * N copias", y cada copia son 24 flotantes (matriz + color + extras). El
 * renderizador sube ese bloque de memoria tal cual, asi que anadir mil matas
 * de maiz cuesta un memcpy, no mil llamadas de dibujo.
 */

export const FLOTANTES_INSTANCIA = 24; // mat4(16) + color rgba(4) + extra(4)

/** extra = [factorOleaje, brillo, alfa, semillaFase] */
export class Lote {
  constructor(malla, { estatico = false, capacidad = 64, categoria = 'opaco', sombra = true } = {}) {
    this.malla = malla;
    this.estatico = estatico;
    this.categoria = categoria;   // opaco | follaje | agua | translucido
    this.sombra = sombra;
    this.billboard = false;
    // Banderas que viajan con cada instancia: 1 = follaje (dos caras y
    // translucidez), 2 = cartel siempre de cara a la camara.
    this.banderas = categoria === 'follaje' ? 1 : 0;
    this.datos = new Float32Array(capacidad * FLOTANTES_INSTANCIA);
    this.n = 0;
    this.version = 0;             // sube cuando cambian los datos: el backend resube
    this.subido = -1;
  }

  reiniciar() { this.n = 0; }

  /** Marca el lote como cartel: cada instancia se orienta hacia la camara. */
  comoCartel() { this.billboard = true; this.banderas |= 2; return this; }

  /** Reserva mas sitio conservando lo ya escrito. */
  asegurar(cuantas) {
    const necesario = (this.n + cuantas) * FLOTANTES_INSTANCIA;
    if (necesario <= this.datos.length) return;
    let cap = Math.max(this.datos.length * 2, necesario);
    const nuevo = new Float32Array(cap);
    nuevo.set(this.datos);
    this.datos = nuevo;
    this.subido = -1;
  }

  /**
   * Anade una instancia. `matriz` es Float32Array(16); se copia, asi que quien
   * llama puede reutilizar la suya en el bucle.
   */
  agregar(matriz, color = [1, 1, 1], alfa = 1, oleaje = 0, brillo = 0, fase = 0) {
    this.asegurar(1);
    const d = this.datos;
    let o = this.n * FLOTANTES_INSTANCIA;
    d.set(matriz, o);
    o += 16;
    d[o] = color[0]; d[o + 1] = color[1]; d[o + 2] = color[2]; d[o + 3] = alfa;
    d[o + 4] = oleaje; d[o + 5] = brillo; d[o + 6] = this.banderas; d[o + 7] = fase;
    this.n++;
    this.version++;
    return this;
  }
}

export class Escena {
  constructor() {
    this.lotes = new Map();
    this.orden = [];
  }

  /** Crea el lote si no existe. La malla se identifica por su nombre. */
  lote(clave, malla, opciones) {
    let l = this.lotes.get(clave);
    if (!l) {
      l = new Lote(malla, opciones);
      l.clave = clave;
      this.lotes.set(clave, l);
      this.orden.push(l);
    }
    return l;
  }

  obtener(clave) { return this.lotes.get(clave); }

  /** Vacia solo los lotes dinamicos; los estaticos se conservan entre cuadros. */
  reiniciarDinamicos() {
    for (const l of this.orden) if (!l.estatico) l.reiniciar();
  }

  get instancias() {
    let n = 0;
    for (const l of this.orden) n += l.n;
    return n;
  }

  get triangulos() {
    let n = 0;
    for (const l of this.orden) n += (l.malla.cuenta / 3) * l.n;
    return n;
  }
}
