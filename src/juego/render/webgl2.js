/**
 * webgl2.js — Respaldo de render en WebGL2.
 *
 * Es el camino que se usa cuando el navegador todavia no trae WebGPU. Dibuja
 * exactamente lo mismo: mapa de sombras direccional con PCF, instanciacion,
 * agua animada, cielo procedural y tonemapping ACES. El antialias lo aporta el
 * propio contexto (MSAA del framebuffer por defecto).
 */
import { OBJETOS_VERT, OBJETOS_FRAG, SOMBRA_VERT, SOMBRA_FRAG, CIELO_VERT, CIELO_FRAG, AGUA_VERT, AGUA_FRAG } from './glsl.js';
import { FLOTANTES_INSTANCIA } from './escena.js';
import { FLOTANTES_VERTICE } from './malla.js';
import { m4, invertir, multiplicar } from '../nucleo/mate.js';

const BYTES_VERTICE = FLOTANTES_VERTICE * 4;
const BYTES_INSTANCIA = FLOTANTES_INSTANCIA * 4;

function compilar(gl, tipo, fuente, nombre) {
  const s = gl.createShader(tipo);
  gl.shaderSource(s, fuente);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader ${nombre} no compila: ${log}`);
  }
  return s;
}

function programa(gl, vs, fs, nombre) {
  const p = gl.createProgram();
  gl.attachShader(p, compilar(gl, gl.VERTEX_SHADER, vs, `${nombre}.vert`));
  gl.attachShader(p, compilar(gl, gl.FRAGMENT_SHADER, fs, `${nombre}.frag`));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Programa ${nombre} no enlaza: ${gl.getProgramInfoLog(p)}`);
  }
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export class RenderizadorWebGL2 {
  static disponible() {
    try {
      const c = document.createElement('canvas');
      return !!c.getContext('webgl2');
    } catch { return false; }
  }

  static async crear(lienzo, opciones = {}) {
    const gl = lienzo.getContext('webgl2', {
      antialias: opciones.antialias !== false,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: !!opciones.preservar,
    });
    if (!gl) return null;
    return new RenderizadorWebGL2(lienzo, gl, opciones);
  }

  constructor(lienzo, gl, opciones) {
    this.nombre = 'WebGL2';
    this.lienzo = lienzo;
    this.gl = gl;
    this.perdido = false;
    this.recursos = new Map();     // malla -> {vbo, ebo, tipoIndice}
    this.buffersInst = new Map();  // lote  -> {vbo, vao, capacidad}
    this.ladoSombra = opciones.sombra === false ? 0 : (opciones.ladoSombra || 2048);

    lienzo.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.perdido = true; });
    lienzo.addEventListener('webglcontextrestored', () => { this.perdido = false; this.recursos.clear(); this.buffersInst.clear(); this.iniciar(); });

    this.iniciar();
  }

  iniciar() {
    const gl = this.gl;
    this.progObjetos = programa(gl, OBJETOS_VERT, OBJETOS_FRAG, 'objetos');
    this.progSombra = programa(gl, SOMBRA_VERT, SOMBRA_FRAG, 'sombra');
    this.progCielo = programa(gl, CIELO_VERT, CIELO_FRAG, 'cielo');
    this.progAgua = programa(gl, AGUA_VERT, AGUA_FRAG, 'agua');
    this.vaoVacio = gl.createVertexArray();

    if (this.ladoSombra) {
      this.texSombra = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texSombra);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, this.ladoSombra, this.ladoSombra, 0,
        gl.DEPTH_COMPONENT, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      this.fboSombra = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboSombra);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.texSombra, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      const estado = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (estado !== gl.FRAMEBUFFER_COMPLETE) this.ladoSombra = 0;  // sin sombras, pero se juega
    }
    this.invVP = m4();
  }

  redimensionar(ancho, alto) {
    this.lienzo.width = ancho;
    this.lienzo.height = alto;
    this.gl.viewport(0, 0, ancho, alto);
  }

  recursoMalla(malla) {
    let r = this.recursos.get(malla);
    if (r) return r;
    const gl = this.gl;
    // Critico: enlazar un buffer de indices mientras hay un VAO activo
    // sobrescribe el VAO de OTRO lote. Se desenlaza antes de crear nada.
    gl.bindVertexArray(null);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, malla.vertices, gl.STATIC_DRAW);
    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, malla.indices, gl.STATIC_DRAW);
    r = { vbo, ebo, tipo: malla.indices.BYTES_PER_ELEMENT === 2 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT };
    this.recursos.set(malla, r);
    return r;
  }

  /** Un VAO por lote: la malla es compartida, el buffer de instancias no. */
  recursoLote(lote) {
    const gl = this.gl;
    const malla = this.recursoMalla(lote.malla);
    let r = this.buffersInst.get(lote);
    if (!r) {
      r = { vbo: gl.createBuffer(), vao: gl.createVertexArray(), capacidad: 0, version: -1, tipo: malla.tipo };
      gl.bindVertexArray(r.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, malla.vbo);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, BYTES_VERTICE, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, BYTES_VERTICE, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, BYTES_VERTICE, 24);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, BYTES_VERTICE, 36);
      gl.bindBuffer(gl.ARRAY_BUFFER, r.vbo);
      for (let k = 0; k < 6; k++) {
        const loc = 4 + k;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, BYTES_INSTANCIA, k * 16);
        gl.vertexAttribDivisor(loc, 1);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, malla.ebo);
      gl.bindVertexArray(null);
      this.buffersInst.set(lote, r);
    }
    // Resubida solo si el lote cambio: los estaticos se suben una vez y ya.
    if (r.version !== lote.version) {
      gl.bindBuffer(gl.ARRAY_BUFFER, r.vbo);
      const bytes = lote.n * BYTES_INSTANCIA;
      if (r.capacidad < lote.datos.byteLength) {
        gl.bufferData(gl.ARRAY_BUFFER, lote.datos, gl.DYNAMIC_DRAW);
        r.capacidad = lote.datos.byteLength;
      } else if (bytes > 0) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, lote.datos, 0, lote.n * FLOTANTES_INSTANCIA);
      }
      r.version = lote.version;
    }
    return r;
  }

  dibujarLote(lote) {
    if (!lote.n) return;
    const gl = this.gl;
    const r = this.recursoLote(lote);
    gl.bindVertexArray(r.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, lote.malla.cuenta, r.tipo, 0, lote.n);
  }

  /**
   * @param {Escena} escena
   * @param {object} marco {camara, cielo, tiempo, viento, luzProy}
   */
  dibujar(escena, marco) {
    if (this.perdido) return;
    const gl = this.gl;
    const { camara, cielo } = marco;
    const lotes = escena.orden;

    // ------------------------------------------------------------ sombras
    if (this.ladoSombra && marco.luzProy) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboSombra);
      gl.viewport(0, 0, this.ladoSombra, this.ladoSombra);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);   // sesgo geometrico: quita el acne casi entero
      const { p, u } = this.progSombra;
      gl.useProgram(p);
      gl.uniformMatrix4fv(u.uLuzProy, false, marco.luzProy);
      gl.uniform1f(u.uTiempo, marco.tiempo);
      gl.uniform3fv(u.uViento, marco.viento);
      for (const lote of lotes) {
        if (!lote.sombra || !lote.n || lote.categoria === 'translucido' || lote.categoria === 'agua') continue;
        this.dibujarLote(lote);
      }
      gl.cullFace(gl.BACK);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.viewport(0, 0, this.lienzo.width, this.lienzo.height);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clearColor(cielo.horizonte[0], cielo.horizonte[1], cielo.horizonte[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // -------------------------------------------------------------- cielo
    {
      const { p, u } = this.progCielo;
      gl.useProgram(p);
      invertir(camara.vistaProyeccion, this.invVP);
      gl.uniformMatrix4fv(u.uInvVistaProy, false, this.invVP);
      gl.uniform3fv(u.uCamPos, camara.posicion);
      gl.uniform3fv(u.uDirSol, cielo.dirSol);
      gl.uniform3fv(u.uColorSol, cielo.colorSol);
      gl.uniform3fv(u.uCenit, cielo.cenit);
      gl.uniform3fv(u.uHorizonte, cielo.horizonte);
      gl.uniform1f(u.uIntensidad, cielo.intensidad);
      gl.uniform1f(u.uEstrellas, cielo.estrellas);
      gl.uniform1f(u.uNubes, cielo.nubes);
      gl.uniform1f(u.uTiempo, marco.tiempo);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(this.vaoVacio);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true);
    }

    // ------------------------------------------------------------ objetos
    {
      const { p, u } = this.progObjetos;
      gl.useProgram(p);
      gl.uniformMatrix4fv(u.uVistaProy, false, camara.vistaProyeccion);
      gl.uniformMatrix4fv(u.uLuzProy, false, marco.luzProy || camara.vistaProyeccion);
      gl.uniform1f(u.uTiempo, marco.tiempo);
      gl.uniform3fv(u.uViento, marco.viento);
      gl.uniform3fv(u.uCamPos, camara.posicion);
      gl.uniform3fv(u.uCamDer, camara.derecha);
      gl.uniform3fv(u.uCamArr, [0, 1, 0]);
      gl.uniform3fv(u.uDirSol, cielo.dirSol);
      gl.uniform3fv(u.uColorSol, cielo.colorSol);
      gl.uniform1f(u.uIntensidad, cielo.intensidad);
      gl.uniform3fv(u.uAmbiente, cielo.ambiente);
      gl.uniform3fv(u.uRebote, [cielo.ambiente[0] * 0.45, cielo.ambiente[1] * 0.42, cielo.ambiente[2] * 0.35]);
      gl.uniform3fv(u.uNieblaColor, cielo.niebla.color);
      gl.uniform1f(u.uNieblaDensidad, cielo.niebla.densidad);
      gl.uniform1f(u.uNieblaAltura, cielo.niebla.altura);
      gl.uniform1f(u.uHumedad, cielo.humedad);
      gl.uniform1f(u.uSombraTexel, this.ladoSombra ? 1 / this.ladoSombra : 0);
      if (this.ladoSombra) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texSombra);
        gl.uniform1i(u.uSombra, 0);
      }

      gl.enable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      for (const lote of lotes) {
        if (!lote.n || lote.categoria === 'agua' || lote.categoria === 'translucido') continue;
        if (lote.categoria === 'follaje') gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
        this.dibujarLote(lote);
      }

      // --------------------------------------------------------- translucidos
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      for (const lote of lotes) {
        if (!lote.n || lote.categoria !== 'translucido') continue;
        this.dibujarLote(lote);
      }
      gl.depthMask(true);
    }

    // --------------------------------------------------------------- agua
    {
      const conAgua = lotes.filter((l) => l.categoria === 'agua' && l.n);
      if (conAgua.length) {
        const { p, u } = this.progAgua;
        gl.useProgram(p);
        gl.uniformMatrix4fv(u.uVistaProy, false, camara.vistaProyeccion);
        gl.uniform1f(u.uTiempo, marco.tiempo);
        gl.uniform1f(u.uAgitacion, marco.agitacion || 0);
        gl.uniform3fv(u.uCamPos, camara.posicion);
        gl.uniform3fv(u.uDirSol, cielo.dirSol);
        gl.uniform3fv(u.uColorSol, cielo.colorSol);
        gl.uniform1f(u.uIntensidad, cielo.intensidad);
        gl.uniform3fv(u.uCenit, cielo.cenit);
        gl.uniform3fv(u.uHorizonte, cielo.horizonte);
        gl.uniform3fv(u.uNieblaColor, cielo.niebla.color);
        gl.uniform1f(u.uNieblaDensidad, cielo.niebla.densidad);
        gl.uniform1f(u.uNieblaAltura, cielo.niebla.altura);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.CULL_FACE);
        for (const lote of conAgua) this.dibujarLote(lote);
      }
    }

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  destruir() {
    const gl = this.gl;
    for (const r of this.recursos.values()) { gl.deleteBuffer(r.vbo); gl.deleteBuffer(r.ebo); }
    for (const r of this.buffersInst.values()) { gl.deleteBuffer(r.vbo); gl.deleteVertexArray(r.vao); }
    this.recursos.clear();
    this.buffersInst.clear();
  }
}
