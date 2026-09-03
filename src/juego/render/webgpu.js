/**
 * webgpu.js — Camino principal de render, sobre WebGPU.
 *
 * Estructura por pases:
 *   1. sombras   -> mapa de profundidad 2048x2048 desde el sol (ortografico)
 *   2. principal -> cielo, opacos, follaje, translucidos y agua, con MSAA x4
 *
 * Las instancias viajan en un buffer de almacenamiento por lote y se leen en el
 * vertex shader por instance_index: subir mil matas de maiz es una escritura de
 * buffer, no mil llamadas.
 */
import { OBJETOS, SOMBRA, CIELO, AGUA } from './wgsl.js';
import { FLOTANTES_INSTANCIA } from './escena.js';
import { FLOTANTES_VERTICE } from './malla.js';
import { m4, invertir } from '../nucleo/mate.js';

const BYTES_VERTICE = FLOTANTES_VERTICE * 4;
const BYTES_INSTANCIA = FLOTANTES_INSTANCIA * 4;
const FLOTANTES_MARCO = 88;   // 3 mat4 (48) + 10 vec4 (40)
const MUESTRAS = 4;

const DISPOSICION_VERTICE = {
  arrayStride: BYTES_VERTICE,
  attributes: [
    { shaderLocation: 0, offset: 0,  format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32x3' },
    { shaderLocation: 3, offset: 36, format: 'float32' },
  ],
};

export class RenderizadorWebGPU {
  static disponible() { return typeof navigator !== 'undefined' && !!navigator.gpu; }

  static async crear(lienzo, opciones = {}) {
    if (!RenderizadorWebGPU.disponible()) return null;
    const adaptador = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adaptador) return null;
    const dispositivo = await adaptador.requestDevice();
    if (!dispositivo) return null;
    const contexto = lienzo.getContext('webgpu');
    if (!contexto) return null;
    return new RenderizadorWebGPU(lienzo, contexto, dispositivo, adaptador, opciones);
  }

  constructor(lienzo, contexto, dispositivo, adaptador, opciones) {
    this.nombre = 'WebGPU';
    this.lienzo = lienzo;
    this.ctx = contexto;
    this.dev = dispositivo;
    this.adaptador = adaptador;
    this.perdido = false;
    this.recursos = new Map();
    this.instancias = new Map();
    this.ladoSombra = opciones.sombra === false ? 0 : (opciones.ladoSombra || 2048);
    this.formato = navigator.gpu.getPreferredCanvasFormat();
    // Formato sin sRGB: la conversion de gamma la hace el shader, igual que en
    // WebGL2, para que las dos rutas se vean exactamente igual.
    if (this.formato.endsWith('-srgb')) this.formato = this.formato.replace('-srgb', '');
    this.ctx.configure({
      device: this.dev, format: this.formato, alphaMode: 'opaque',
      // COPY_SRC permite leer el fotograma ya compuesto (fotos de la partida
      // y comprobaciones automaticas del render).
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    this.dev.lost.then((info) => { this.perdido = true; this.motivoPerdida = info?.message || 'dispositivo perdido'; });
    // Los errores de validacion de WebGPU no lanzan excepciones: si no se
    // escuchan aqui, un pipeline mal descrito se traduce en pantalla negra
    // sin ninguna pista.
    this.errores = [];
    this.dev.onuncapturederror = (e) => {
      const msg = e?.error?.message || String(e);
      if (this.errores.length < 12) this.errores.push(msg);
      if (opciones.alFallar) opciones.alFallar(msg);
    };
    this.datosMarco = new Float32Array(FLOTANTES_MARCO);
    this.invVP = m4();
    this.iniciar();
  }

  iniciar() {
    const dev = this.dev;

    this.bufMarco = dev.createBuffer({
      size: FLOTANTES_MARCO * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.texSombra = dev.createTexture({
      size: [this.ladoSombra || 1, this.ladoSombra || 1],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.vistaSombra = this.texSombra.createView();
    this.cmpSombra = dev.createSampler({
      compare: 'less-equal', magFilter: 'linear', minFilter: 'linear',
      addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
    });

    this.disp0 = dev.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
      ],
    });
    this.disp1 = dev.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }],
    });
    this.grupo0 = dev.createBindGroup({
      layout: this.disp0,
      entries: [
        { binding: 0, resource: { buffer: this.bufMarco } },
        { binding: 1, resource: this.vistaSombra },
        { binding: 2, resource: this.cmpSombra },
      ],
    });

    const layout = dev.createPipelineLayout({ bindGroupLayouts: [this.disp0, this.disp1] });
    const modObjetos = dev.createShaderModule({ code: OBJETOS, label: 'objetos' });
    const modSombra = dev.createShaderModule({ code: SOMBRA, label: 'sombra' });
    const modCielo = dev.createShaderModule({ code: CIELO, label: 'cielo' });
    const modAgua = dev.createShaderModule({ code: AGUA, label: 'agua' });

    const mezcla = {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    };

    const base = (extra) => ({
      layout,
      vertex: { module: modObjetos, entryPoint: 'vs', buffers: [DISPOSICION_VERTICE] },
      fragment: { module: modObjetos, entryPoint: 'fs', targets: [{ format: this.formato, ...(extra.mezcla ? { blend: mezcla } : {}) }] },
      primitive: { topology: 'triangle-list', cullMode: extra.cull || 'back' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: extra.escribeProfundidad !== false,
        depthCompare: 'less-equal',
      },
      multisample: { count: MUESTRAS },
    });

    this.pipOpaco = dev.createRenderPipeline(base({ cull: 'back' }));
    this.pipFollaje = dev.createRenderPipeline(base({ cull: 'none' }));
    this.pipTranslucido = dev.createRenderPipeline(base({ cull: 'none', mezcla: true, escribeProfundidad: false }));

    this.pipSombra = dev.createRenderPipeline({
      layout,
      vertex: { module: modSombra, entryPoint: 'vs', buffers: [DISPOSICION_VERTICE] },
      primitive: { topology: 'triangle-list', cullMode: 'front' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less-equal' },
    });

    this.pipCielo = dev.createRenderPipeline({
      layout,
      vertex: { module: modCielo, entryPoint: 'vs' },
      fragment: { module: modCielo, entryPoint: 'fs', targets: [{ format: this.formato }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' },
      multisample: { count: MUESTRAS },
    });

    this.pipAgua = dev.createRenderPipeline({
      layout,
      vertex: { module: modAgua, entryPoint: 'vs', buffers: [DISPOSICION_VERTICE] },
      fragment: { module: modAgua, entryPoint: 'fs', targets: [{ format: this.formato, blend: mezcla }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less-equal' },
      multisample: { count: MUESTRAS },
    });

    // Buffer de instancias de relleno: el pase de cielo tambien necesita
    // un grupo 1 valido aunque no lo lea.
    this.bufVacio = this.dev.createBuffer({ size: BYTES_INSTANCIA, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.grupoVacio = this.dev.createBindGroup({ layout: this.disp1, entries: [{ binding: 0, resource: { buffer: this.bufVacio } }] });
  }

  redimensionar(ancho, alto) {
    this.lienzo.width = Math.max(1, ancho);
    this.lienzo.height = Math.max(1, alto);
    const size = [this.lienzo.width, this.lienzo.height];
    this.texColor?.destroy();
    this.texProfundidad?.destroy();
    this.texColor = this.dev.createTexture({
      size, format: this.formato, sampleCount: MUESTRAS, usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.texProfundidad = this.dev.createTexture({
      size, format: 'depth24plus', sampleCount: MUESTRAS, usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.vistaColor = this.texColor.createView();
    this.vistaProfundidad = this.texProfundidad.createView();
  }

  recursoMalla(malla) {
    let r = this.recursos.get(malla);
    if (r) return r;
    const dev = this.dev;
    const vbo = dev.createBuffer({ size: alinear4(malla.vertices.byteLength), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    dev.queue.writeBuffer(vbo, 0, malla.vertices);
    // Los indices de 16 bits necesitan que el tamano del buffer sea multiplo de 4.
    const datos = malla.indices;
    const ebo = dev.createBuffer({ size: alinear4(datos.byteLength), usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    dev.queue.writeBuffer(ebo, 0, datos);
    r = { vbo, ebo, formato: datos.BYTES_PER_ELEMENT === 2 ? 'uint16' : 'uint32' };
    this.recursos.set(malla, r);
    return r;
  }

  recursoLote(lote) {
    let r = this.instancias.get(lote);
    const necesario = Math.max(BYTES_INSTANCIA, alinear4(lote.datos.byteLength));
    if (!r || r.tam < necesario) {
      r?.buf.destroy();
      const buf = this.dev.createBuffer({ size: necesario, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      r = {
        buf, tam: necesario, version: -1,
        grupo: this.dev.createBindGroup({ layout: this.disp1, entries: [{ binding: 0, resource: { buffer: buf } }] }),
      };
      this.instancias.set(lote, r);
    }
    if (r.version !== lote.version && lote.n > 0) {
      this.dev.queue.writeBuffer(r.buf, 0, lote.datos, 0, lote.n * FLOTANTES_INSTANCIA);
      r.version = lote.version;
    }
    return r;
  }

  dibujarLote(pase, lote) {
    if (!lote.n) return;
    const m = this.recursoMalla(lote.malla);
    const i = this.recursoLote(lote);
    pase.setBindGroup(1, i.grupo);
    pase.setVertexBuffer(0, m.vbo);
    pase.setIndexBuffer(m.ebo, m.formato);
    pase.drawIndexed(lote.malla.cuenta, lote.n, 0, 0, 0);
  }

  escribirMarco(marco) {
    const { camara, cielo } = marco;
    const d = this.datosMarco;
    d.set(camara.vistaProyeccion, 0);
    d.set(marco.luzProy, 16);
    invertir(camara.vistaProyeccion, this.invVP);
    d.set(this.invVP, 32);
    let o = 48;
    const v4 = (a, b, c, w) => { d[o] = a; d[o + 1] = b; d[o + 2] = c; d[o + 3] = w; o += 4; };
    v4(camara.posicion[0], camara.posicion[1], camara.posicion[2], marco.tiempo);
    v4(camara.derecha[0], camara.derecha[1], camara.derecha[2], this.ladoSombra ? 1 / this.ladoSombra : 0);
    v4(cielo.dirSol[0], cielo.dirSol[1], cielo.dirSol[2], cielo.intensidad);
    v4(cielo.colorSol[0], cielo.colorSol[1], cielo.colorSol[2], cielo.humedad);
    v4(cielo.ambiente[0], cielo.ambiente[1], cielo.ambiente[2], cielo.estrellas);
    v4(cielo.ambiente[0] * 0.45, cielo.ambiente[1] * 0.42, cielo.ambiente[2] * 0.35, cielo.nubes);
    v4(cielo.cenit[0], cielo.cenit[1], cielo.cenit[2], marco.agitacion || 0);
    v4(cielo.horizonte[0], cielo.horizonte[1], cielo.horizonte[2], cielo.niebla.altura);
    v4(cielo.niebla.color[0], cielo.niebla.color[1], cielo.niebla.color[2], cielo.niebla.densidad);
    v4(marco.viento[0], marco.viento[1], marco.viento[2], 0);
    this.dev.queue.writeBuffer(this.bufMarco, 0, d);
  }

  dibujar(escena, marco) {
    if (this.perdido) return;
    if (!this.vistaColor) this.redimensionar(this.lienzo.width || 1, this.lienzo.height || 1);
    this.escribirMarco(marco);
    const lotes = escena.orden;
    const cmd = this.dev.createCommandEncoder();

    if (this.ladoSombra) {
      const pase = cmd.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: this.vistaSombra, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store',
        },
      });
      pase.setPipeline(this.pipSombra);
      pase.setBindGroup(0, this.grupo0);
      for (const lote of lotes) {
        if (!lote.sombra || !lote.n || lote.categoria === 'translucido' || lote.categoria === 'agua') continue;
        this.dibujarLote(pase, lote);
      }
      pase.end();
    }

    const c = marco.cielo.horizonte;
    const pase = cmd.beginRenderPass({
      colorAttachments: [{
        view: this.vistaColor,
        resolveTarget: this.ctx.getCurrentTexture().createView(),
        clearValue: { r: c[0], g: c[1], b: c[2], a: 1 },
        loadOp: 'clear', storeOp: 'discard',
      }],
      depthStencilAttachment: {
        view: this.vistaProfundidad, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard',
      },
    });
    pase.setBindGroup(0, this.grupo0);

    pase.setPipeline(this.pipCielo);
    pase.setBindGroup(1, this.grupoVacio);
    pase.draw(3, 1, 0, 0);

    pase.setPipeline(this.pipOpaco);
    for (const lote of lotes) {
      if (!lote.n || lote.categoria !== 'opaco') continue;
      this.dibujarLote(pase, lote);
    }
    pase.setPipeline(this.pipFollaje);
    for (const lote of lotes) {
      if (!lote.n || lote.categoria !== 'follaje') continue;
      this.dibujarLote(pase, lote);
    }
    pase.setPipeline(this.pipAgua);
    for (const lote of lotes) {
      if (!lote.n || lote.categoria !== 'agua') continue;
      this.dibujarLote(pase, lote);
    }
    pase.setPipeline(this.pipTranslucido);
    for (const lote of lotes) {
      if (!lote.n || lote.categoria !== 'translucido') continue;
      this.dibujarLote(pase, lote);
    }
    pase.end();

    if (this.peticionFoto) {
      const foto = this.peticionFoto;
      this.peticionFoto = null;
      const ancho = this.lienzo.width, alto = this.lienzo.height;
      const bytesFila = Math.ceil(ancho * 4 / 256) * 256;
      const buf = this.dev.createBuffer({ size: bytesFila * alto, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      cmd.copyTextureToBuffer({ texture: this.ctx.getCurrentTexture() }, { buffer: buf, bytesPerRow: bytesFila }, [ancho, alto]);
      this.dev.queue.submit([cmd.finish()]);
      buf.mapAsync(GPUMapMode.READ).then(() => {
        const crudo = new Uint8Array(buf.getMappedRange()).slice();
        buf.unmap(); buf.destroy();
        foto({ ancho, alto, bytesFila, datos: crudo, bgra: this.formato.startsWith('bgra') });
      }).catch((e) => foto({ error: e.message }));
      return;
    }

    this.dev.queue.submit([cmd.finish()]);
  }

  /** Devuelve el proximo fotograma como pixeles crudos. */
  foto() {
    return new Promise((res) => { this.peticionFoto = res; });
  }

  destruir() {
    for (const r of this.recursos.values()) { r.vbo.destroy(); r.ebo.destroy(); }
    for (const r of this.instancias.values()) r.buf.destroy();
    this.recursos.clear();
    this.instancias.clear();
    this.texColor?.destroy();
    this.texProfundidad?.destroy();
    this.texSombra?.destroy();
  }
}

function alinear4(n) { return (n + 3) & ~3; }
