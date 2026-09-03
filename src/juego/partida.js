/**
 * partida.js — El juego en marcha: une mundo, reglas, render e interfaz.
 *
 * Reparto de responsabilidades:
 *   - mundo/*   sabe como es el valle
 *   - reglas/*  sabe que pasa cuando haces algo (y no toca el DOM)
 *   - render/*  sabe pintar
 *   - vista/*   traduce simulacion a instancias
 *   - ui/*      pinta la interfaz y recoge pulsaciones
 *   - este archivo es el unico que los conoce a todos
 */
import { crearRenderizador, matrizSombra } from './render/renderizador.js';
import { Escena } from './render/escena.js';
import { estadoCielo } from './render/cielo.js';
import { Camara } from './render/camara.js';
import { Terreno, LUGARES, NIVEL_AGUA } from './mundo/terreno.js';
import { repartir, cuadrosMilpa, puntosPesca } from './mundo/dispersion.js';
import { Fauna } from './mundo/fauna.js';
import { climaDelDia, climaEn, aguaDelDia, estacionDe, mesDe, describirClima } from './mundo/clima.js';
import { Mundo3D } from './vista/mundo3d.js';
import { Personaje } from './vista/personaje.js';
import { Reloj } from './nucleo/reloj.js';
import { Bucle } from './nucleo/bucle.js';
import { Entrada } from './nucleo/entrada.js';
import { m4, limitar, mezclar, seguir, TAU } from './nucleo/mate.js';
import { partidaNueva, guardar, cargar, contar, contarEntrega, contarReceta, contarCultivo,
  conocimientos, prepararCuadros } from './nucleo/estado.js';
import { actualizar as actualizarNecesidades, penalizaciones, comer as comerNec, dormir as dormirNec, barras } from './reglas/necesidades.js';
import { peso, cargaMaxima, agregar, cuenta, quitar, transferir } from './reglas/inventario.js';
import { nivel, bono, ganar } from './reglas/habilidades.js';
import { interaccionesCerca, ejecutar, cargaRelativa } from './reglas/acciones.js';
import { avanzarDia as avanzarCultivo } from './reglas/cultivo.js';
import { cerrarDia } from './reglas/hogar.js';
import { cocinar } from './reglas/cocina.js';
import { crearLance, tirarAtarraya } from './reglas/pesca.js';
import { crearApuntado, resolverTiro } from './reglas/caza.js';
import { resumen as resumenCapitulos, disponibles as capitulosDisponibles, activar as activarCapitulo,
  intentarCompletar, activo as capituloActivo, evaluarCapitulo } from './reglas/progresion.js';
import { OBJETOS } from './contenido/objetos.js';
import { frasePara, suceso } from './contenido/dialogos.js';
import { Hud } from './ui/hud.js';
import { Paneles } from './ui/paneles.js';
import { Dialogo } from './ui/dialogo.js';
import { Minijuegos } from './ui/minijuegos.js';
import { Tacto } from './ui/tacto.js';

const VEL_ANDAR = 3.3;
const VEL_CORRER = 6.0;
const VEL_AGACHADO = 1.5;
const VEL_NADAR = 2.1;

export class Partida {
  constructor(op = {}) {
    this.raiz = op.raiz;
    this.lienzo = op.lienzo;
    this.estado = op.estado || partidaNueva();
    this.alSalir = op.alSalir;
    this.listo = false;
  }

  // ------------------------------------------------------------- arranque
  async iniciar() {
    const e = this.estado;
    this.terreno = new Terreno({ semilla: e.semilla });
    this.reparto = repartir(this.terreno, { densidad: e.ajustes.calidad === 'baja' ? 0.6 : 1 });
    this.puntosPesca = puntosPesca(this.terreno);
    prepararCuadros(e, cuadrosMilpa(this.terreno));

    this.renderizador = await crearRenderizador(this.lienzo, {
      motor: e.ajustes.motor || 'auto',
      sombra: e.ajustes.sombras !== false,
      ladoSombra: e.ajustes.calidad === 'baja' ? 1024 : 2048,
    });
    this.lienzo = this.renderizador.lienzo;

    this.escena = new Escena();
    this.mundo3d = new Mundo3D(this.escena, this.terreno, this.reparto, { calidad: e.ajustes.calidad });
    this.personaje = new Personaje(this.escena, {});
    this.fauna = new Fauna(this.terreno, e.semilla);
    this.camara = new Camara();
    this.reloj = new Reloj({ dia: e.dia, hora: e.hora });
    this.entrada = new Entrada(this.lienzo);

    // El nino empieza en el patio de la casa si es partida nueva.
    const inicio = e.jugador.x || e.jugador.z
      ? [e.jugador.x, e.jugador.z]
      : [LUGARES.casa.x + 3, LUGARES.casa.z + 6];
    this.jugador = {
      x: inicio[0], z: inicio[1], y: this.terreno.altura(inicio[0], inicio[1]),
      rumbo: e.jugador.rumbo || 0, velocidad: 0, agachado: false, nadando: false,
      pose: 'normal', ruido: 0.4,
    };
    this.perro = { x: this.jugador.x + 1.5, z: this.jugador.z + 1, y: 0, rumbo: 0, fase: 0 };

    this.hud = new Hud(this.raiz);
    this.paneles = new Paneles(this.raiz, this._accionesPanel());
    this.dialogo = new Dialogo(this.raiz);
    this.minijuegos = new Minijuegos(this.raiz);
    this.tacto = new Tacto(this.raiz, this.entrada);
    this.hud.ponerBotones([
      { texto: '🧺 Canasta', titulo: 'Tecla I', alPulsar: () => this.abrirPanel('inventario') },
      { texto: '📖 Diario', titulo: 'Tecla J', alPulsar: () => this.abrirPanel('diario') },
      { texto: '⏸', titulo: 'Tecla Esc', alPulsar: () => this.abrirPanel('pausa') },
    ]);

    this.planClima = climaDelDia(e.semilla, this.reloj.dia);
    this.clima = climaEn(this.planClima, this.reloj.hora);
    this.fauna.poblar(this.reloj.hora, this.clima);
    this.luzProy = m4();
    this.tiempoRender = 0;
    this.horaAnterior = Math.floor(this.reloj.hora);
    this.opciones = [];
    this.mensajeCuadro = null;
    this.lluviaReciente = false;
    this.acumuladoGuardado = 0;
    this.vientoSuave = [0, 0, 0];

    // La camara mira hacia el valle desde el patio, y se deja ya calculada:
    // sin esta primera actualizacion la matriz seria la identidad y el primer
    // fotograma saldria vacio.
    this.camara.giro = this.camara.giroDeseado =
      Math.atan2(this.jugador.x - LUGARES.poza.x, this.jugador.z - LUGARES.poza.z);
    this._actualizarCamara(1 / 60);
    this.camara.objetivoSuave = [this.jugador.x, this.jugador.y + 1.05, this.jugador.z];

    this._redimensionar();
    addEventListener('resize', () => this._redimensionar());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.guardar();
    });

    this.bucle = new Bucle({
      simular: (dt) => this.simular(dt),
      dibujar: (dt) => this.dibujar(dt),
      alFallar: (err) => this._fallo(err),
    });
    this.listo = true;
    this.bucle.arrancar();
    this._arrancarHistoria();
    return this;
  }

  _fallo(err) {
    console.error('[monte adentro]', err);
    this.hud?.aviso(`Algo se rompió: ${err.message}`, 'malo', 9000);
  }

  _redimensionar() {
    const dpr = Math.min(devicePixelRatio || 1, this.estado.ajustes.calidad === 'alta' ? 2 : 1.35);
    const ancho = Math.max(1, Math.floor(this.lienzo.clientWidth * dpr));
    const alto = Math.max(1, Math.floor(this.lienzo.clientHeight * dpr));
    this.renderizador.redimensionar(ancho, alto);
    this.camara.aspecto = ancho / alto;
    this.tacto.mostrar(matchMedia('(pointer: coarse)').matches);
  }

  // ------------------------------------------------------------ historia
  _arrancarHistoria() {
    const e = this.estado;
    if (!e.capitulos.activo) {
      const posibles = capitulosDisponibles(e);
      if (posibles.length) {
        const cap = posibles[0];
        activarCapitulo(e, cap.id);
        this.dialogo.mostrar(cap.intro, () => this.hud.aviso(`Capítulo: ${cap.titulo}`, 'premio', 5000));
      }
    }
  }

  _comprobarCapitulo() {
    const fin = intentarCompletar(this.estado);
    if (!fin) return;
    const textos = fin.premios.map((p) => {
      if (p.tipo === 'objeto') return `${p.cantidad} × ${p.nombre}`;
      if (p.tipo === 'xp') return `+${p.xp} de ${p.habilidad}`;
      return 'algo nuevo que sabés hacer';
    });
    this.dialogo.mostrar(fin.capitulo.cierre, () => {
      this.hud.aviso(`Capítulo terminado: ${fin.capitulo.titulo}`, 'premio', 6000);
      if (textos.length) this.hud.aviso(textos.join(' · '), 'bueno', 6000);
      for (const s of fin.subidas) this.hud.aviso(`¡Subiste a ${s.habilidad} ${s.nivel}!`, 'premio', 5000);
      this.guardar();
      setTimeout(() => this._arrancarHistoria(), 900);
    });
  }

  // ------------------------------------------------------------ simulacion
  simular(dt) {
    if (this.dialogo.activo || this.paneles.abierto) {
      // El mundo se para mientras se habla o se mira un panel: es un juego de
      // decidir, no de que te pillen leyendo el inventario.
      this.dialogo.actualizar(dt);
      if (this.entrada.consumir('interactuar') || this.entrada.consumir('accion')) this.dialogo.avanzar();
      if (this.entrada.consumir('pausa')) { this.dialogo.cerrar(); this.paneles.cerrar(); }
      // La camara sigue viva: el valle se ve detras de la conversacion.
      this._actualizarCamara(dt);
      return;
    }

    const e = this.estado;
    const mirada = this.entrada.tomarMirada();
    this.camara.girar(mirada.dx, mirada.dy);
    if (mirada.rueda) this.camara.acercar(mirada.rueda * 0.9);

    if (this.minijuegos.activo) {
      this.minijuegos.actualizar(dt, {
        accion: this.entrada.activa('accion'),
        pulso: this.entrada.consumir('accion') || this.entrada.consumir('interactuar'),
        cancelar: this.entrada.consumir('pausa'),
      });
      this._avanzarTiempo(dt, 'quieto');
      this._actualizarCamara(dt);
      return;
    }

    this._mover(dt);
    this._avanzarTiempo(dt, this._actividad());
    this._actualizarCamara(dt);

    this.fauna.actualizar(dt, {
      jugador: { x: this.jugador.x, z: this.jugador.z, ruido: this.jugador.ruido, agachado: this.jugador.agachado },
      clima: this.clima, tiempo: this.tiempoRender,
    });
    this._moverPerro(dt);
    this._interacciones(dt);
    this._teclas();
  }

  _actividad() {
    const j = this.jugador;
    if (j.nadando) return 'nadar';
    if (j.velocidad > VEL_ANDAR + 0.4) return 'correr';
    if (j.velocidad > 0.2) return cargaRelativa(this.estado) > 0.7 ? 'cargar' : 'andar';
    return 'quieto';
  }

  _mover(dt) {
    const j = this.jugador;
    const dir = this.entrada.direccion;
    const pen = penalizaciones(this.estado.jugador.necesidades);
    const carga = cargaRelativa(this.estado);
    const frenoCarga = 1 - limitar(carga, 0, 1.2) * 0.34;

    j.agachado = this.entrada.activa('agachar');
    const quiereCorrer = this.entrada.activa('correr') && this.estado.jugador.necesidades.aguante > 4 && !j.agachado;

    let vel = j.nadando ? VEL_NADAR : j.agachado ? VEL_AGACHADO : (quiereCorrer ? VEL_CORRER : VEL_ANDAR);
    vel *= pen.velocidad * frenoCarga;

    const fuerza = Math.hypot(dir.x, dir.y);
    if (fuerza > 0.02) {
      const frente = this.camara.frente, derecha = this.camara.derecha;
      const dx = frente[0] * -dir.y + derecha[0] * dir.x;
      const dz = frente[2] * -dir.y + derecha[2] * dir.x;
      const l = Math.hypot(dx, dz) || 1;
      const nx = j.x + (dx / l) * vel * fuerza * dt;
      const nz = j.z + (dz / l) * vel * fuerza * dt;
      j.rumbo = Math.atan2(dx, dz);
      this._intentarMover(nx, nz);
      j.velocidad = vel * fuerza;
      contar(this.estado, 'pasos', vel * fuerza * dt);
    } else {
      j.velocidad = mezclar(j.velocidad, 0, 1 - Math.exp(-16 * dt));
      if (j.velocidad < 0.05) j.velocidad = 0;
    }

    const suelo = this.terreno.altura(j.x, j.z);
    const profundidad = NIVEL_AGUA - suelo;
    j.nadando = profundidad > 0.95;
    j.y = j.nadando ? NIVEL_AGUA - 0.42 : suelo;
    // El ruido que hace: es lo que oyen y huelen los animales.
    j.ruido = limitar((j.velocidad / VEL_CORRER) * (j.agachado ? 0.35 : 1) + (j.nadando ? 0.4 : 0), 0, 1);
    j.pose = this.jugadorPose || (carga > 0.75 ? 'cargar' : 'normal');
  }

  _intentarMover(nx, nz) {
    const j = this.jugador;
    const t = this.terreno;
    const puede = (x, z) => t.dentro(x, z) && t.pendiente(x, z) < 0.74;
    if (puede(nx, nz)) { j.x = nx; j.z = nz; return; }
    // Deslizar por la pared en vez de quedarse clavado.
    if (puede(nx, j.z)) { j.x = nx; return; }
    if (puede(j.x, nz)) { j.z = nz; }
  }

  _moverPerro(dt) {
    const p = this.perro, j = this.jugador;
    const d = Math.hypot(j.x - p.x, j.z - p.z);
    const objetivo = 2.2;
    if (d > objetivo) {
      const v = limitar((d - objetivo) * 1.6, 0, 6.5);
      const a = Math.atan2(j.z - p.z, j.x - p.x);
      const nx = p.x + Math.cos(a) * v * dt;
      const nz = p.z + Math.sin(a) * v * dt;
      if (this.terreno.dentro(nx, nz) && !this.terreno.enAgua(nx, nz)) { p.x = nx; p.z = nz; }
      p.rumbo = a;
      p.fase += dt * 9;
    } else {
      p.fase += dt * 1.5;
    }
    p.y = this.terreno.altura(p.x, p.z);
  }

  _actualizarCamara(dt) {
    const j = this.jugador;
    this.camara.actualizar({
      objetivo: [j.x, j.y + 1.05, j.z], dt,
      alturaEn: (x, z) => Math.max(this.terreno.altura(x, z), NIVEL_AGUA - 0.2),
    });
  }

  // --------------------------------------------------------------- tiempo
  _avanzarTiempo(dt, actividad) {
    const e = this.estado;
    const paso = this.reloj.avanzar(dt);
    e.jugada += dt;
    this.tiempoRender += dt;

    actualizarNecesidades(e.jugador.necesidades, paso.horas, {
      actividad,
      temperatura: this.clima.temperatura,
      cargaRelativa: cargaRelativa(e),
      mojado: this.clima.lluvia > 0.2 || this.jugador.nadando,
    });

    this.clima = climaEn(this.planClima, this.reloj.hora);
    // El viento se mueve suave para que las plantas no den saltos.
    const objetivoViento = [this.clima.viento.x, this.clima.viento.z, this.clima.viento.fuerza * 0.85];
    for (let k = 0; k < 3; k++) this.vientoSuave[k] = seguir(this.vientoSuave[k], objetivoViento[k], 1.2, dt);

    const horaEntera = Math.floor(this.reloj.hora);
    if (horaEntera !== this.horaAnterior) {
      this.horaAnterior = horaEntera;
      this._cadaHora();
    }
    if (paso.cambioDia) this._nuevoDia();

    this.acumuladoGuardado += dt;
    if (this.acumuladoGuardado > 45) { this.acumuladoGuardado = 0; this.guardar(); }
  }

  _cadaHora() {
    this.fauna.poblar(this.reloj.hora, this.clima);
    const nec = this.estado.jugador.necesidades;
    const aviso = penalizaciones(nec).aviso;
    if (aviso && Math.random() < 0.6) this.hud.aviso(aviso, 'malo');
    else {
      const frase = frasePara({
        hora: this.reloj.hora, clima: this.clima, necesidades: nec,
        estacion: this.clima.estacion, aguaEnCasa: cuenta(this.estado.hogar.despensa, 'agua'),
      });
      if (frase && Math.random() < 0.45) this.hud.aviso(`${frase.texto}`, 'neutro', 4600);
    }
    if (Math.floor(this.reloj.hora) === 19) this.hud.aviso(suceso('anochecer'), 'neutro', 5000);
    if (Math.floor(this.reloj.hora) === 6) this.hud.aviso(suceso('amanecer'), 'neutro', 5000);
  }

  /** Cambio de dia por medianoche (sin dormir): pasa igual, pero se nota. */
  _nuevoDia() {
    this.estado.dia = this.reloj.dia;
    this._cerrarDia({ durmiendo: false });
  }

  _cerrarDia({ durmiendo }) {
    const e = this.estado;
    const dia = this.reloj.dia - (durmiendo ? 1 : 1);
    const agua = aguaDelDia(this.planClima);
    for (const q of e.cuadros) {
      avanzarCultivo(q, {
        agua, temperatura: this.clima.temperatura,
        estacion: estacionDe(this.reloj.dia), rnd: Math.random,
      });
    }
    const parte = cerrarDia(e.hogar, dia);
    e.contadores.estrellas += parte.estrellas;
    if (parte.estrellas === 3) e.contadores.dias3estrellas++;

    this.lluviaReciente = agua > 0.25;
    this.planClima = climaDelDia(e.semilla, this.reloj.dia);
    this.clima = climaEn(this.planClima, this.reloj.hora);
    this.fauna.poblar(this.reloj.hora, this.clima);
    e.dia = this.reloj.dia;
    this.guardar();

    this.paneles.abrir('resumen', { parte, hogar: e.hogar, aprendido: [] });
    this._comprobarCapitulo();
  }

  dormir() {
    const e = this.estado;
    const horas = this.reloj.saltarA(5.6);
    dormirNec(e.jugador.necesidades, horas);
    contar(e, 'dormir');
    this.jugador.x = LUGARES.casa.x + 2.5;
    this.jugador.z = LUGARES.casa.z + 5;
    this._cerrarDia({ durmiendo: true });
  }

  // ---------------------------------------------------------- interaccion
  _interacciones(dt) {
    const ctx = this._contexto();
    this.opciones = interaccionesCerca(ctx);
    this.hud.mostrarContexto(this.opciones, (op) => this.hacer(op));
    this.tacto.iconoAccion(this.opciones[0]?.icono || '⚡');
  }

  _contexto() {
    return {
      estado: this.estado,
      terreno: this.terreno,
      fauna: this.fauna,
      recursos: this.reparto.recursos,
      jugador: this.jugador,
      clima: this.clima,
      hora: this.reloj.hora,
      dia: this.reloj.dia,
      mes: mesDe(this.reloj.dia),
      sabe: conocimientos(this.estado),
      lluviaReciente: this.lluviaReciente || this.clima.lluvia > 0.1,
      rnd: Math.random,
    };
  }

  _teclas() {
    const t = this.entrada;
    if (t.consumir('interactuar') && this.opciones.length) {
      const primera = this.opciones.find((o) => !o.desactivada);
      if (primera) this.hacer(primera);
    }
    for (let i = 1; i <= 3; i++) {
      if (t.consumir(String(i))) {
        const op = this.opciones[i];
        if (op && !op.desactivada) this.hacer(op);
      }
    }
    if (t.consumir('inventario')) this.abrirPanel('inventario');
    if (t.consumir('diario')) this.abrirPanel('diario');
    if (t.consumir('pausa')) this.abrirPanel('pausa');
    if (t.consumir('accion') && this.opciones.length) {
      const primera = this.opciones.find((o) => !o.desactivada);
      if (primera) this.hacer(primera);
    }
  }

  /** Ejecuta una opcion del menu de contexto. */
  hacer(op) {
    if (!op) return;
    const e = this.estado;
    if (op.menu) {
      if (op.menu === 'sembrar') this.cuadroElegido = op.objetivo;
      this.abrirPanel(op.menu);
      return;
    }
    const ctx = this._contexto();
    const r = ejecutar(op, ctx);
    this._aplicar(r, op);
  }

  _aplicar(r, op) {
    const e = this.estado;
    if (!r) return;
    if (r.dormir) { this.dormir(); return; }
    // Pesca, caza y atarraya SON el minijuego: no dan nada por si mismas.
    // Rajar lena, en cambio, ya rinde y el minijuego solo anade el extra por
    // buen pulso, asi que primero se cobra lo seguro.
    if (r.minijuego && !r.objetos) { this._abrirMinijuego(r.minijuego, op); return; }
    if (!r.ok) { this.hud.aviso(r.texto || 'No se pudo.', 'malo'); return; }

    // objetos
    let sobra = 0;
    for (const o of r.objetos || []) {
      const res = agregar(e.jugador.inventario, o.id, o.cantidad, nivel(e.jugador.habilidades, 'fuerza'));
      sobra += res.rechazado;
    }
    if (sobra > 0) this.hud.aviso('No te cabe todo: vas muy cargado.', 'malo');

    // entregas a la casa
    if (r.entregas) {
      for (const x of r.entregas) {
        const o = OBJETOS[x.id];
        const categoria = o?.tipo === 'comida' || o?.tipo === 'crudo' ? 'alimento' : o?.tipo;
        contarEntrega(e, x.id, x.cantidad, categoria);
      }
      this.hud.aviso(`${r.texto} (+${Math.round(r.aporte)} de aporte)`, 'bueno');
    } else if (r.texto) {
      this.hud.aviso(r.texto, 'bueno');
    }

    if (r.contador) contar(e, r.contador);
    if (r.cultivo) contarCultivo(e, r.cultivo);
    if (r.xp && r.habilidad) this._ganarXP(r.habilidad, r.xp);
    if (r.tiempo) this._pasarMinutos(r.tiempo, r.actividad);
    this._comprobarCapitulo();
    if (r.minijuego) this._abrirMinijuego(r.minijuego, op);
  }

  _ganarXP(habilidad, xp) {
    const res = ganar(this.estado.jugador.habilidades, habilidad, xp);
    if (res.subio) {
      this.hud.aviso(`¡${habilidad} nivel ${res.nivel}!`, 'premio', 5200);
      for (const d of res.desbloqueos) this.hud.aviso(`Ahora sabés: ${d.texto}`, 'premio', 6200);
    }
  }

  /** Adelanta el reloj por una tarea que lleva su tiempo. */
  _pasarMinutos(minutos, actividad = 'trabajar') {
    const horas = minutos / 60;
    this.reloj.hora += horas;
    while (this.reloj.hora >= 24) { this.reloj.hora -= 24; this.reloj.dia++; this._nuevoDia(); }
    actualizarNecesidades(this.estado.jugador.necesidades, horas, {
      actividad, temperatura: this.clima.temperatura, cargaRelativa: cargaRelativa(this.estado),
    });
  }

  // --------------------------------------------------------- minijuegos
  _abrirMinijuego(tipo, op) {
    const e = this.estado;
    const hab = e.jugador.habilidades;
    if (tipo === 'pesca') {
      const punto = this._puntoPescaCercano();
      this.jugadorPose = 'pescar';
      const lance = crearLance({
        hondura: punto?.hondura ?? 0.3, hora: this.reloj.hora, lluvia: this.clima.lluvia,
        cebo: conocimientos(e).has('cebo'), bono: bono(hab, 'pesca'),
      }, Math.random);
      this.minijuegos.iniciarPesca(lance, (res) => {
        this.jugadorPose = null;
        if (res.cancelado) return;
        if (res.ok) {
          for (const o of res.objetos) agregar(e.jugador.inventario, o.id, o.cantidad, nivel(hab, 'fuerza'));
          contar(e, 'pescar');
          this.hud.aviso(`¡${res.texto}!`, 'bueno', 4200);
          this._ganarXP('pesca', res.xp);
        } else {
          this.hud.aviso(res.texto || 'Se escapó.', 'malo');
          this._ganarXP('pesca', 2);
        }
        this._pasarMinutos(18, 'trabajar');
        this._comprobarCapitulo();
      });
      return;
    }
    if (tipo === 'atarraya') {
      const punto = this._puntoPescaCercano();
      const res = tirarAtarraya({ hondura: punto?.hondura ?? 0.3, hora: this.reloj.hora,
        lluvia: this.clima.lluvia, bono: bono(hab, 'pesca') }, Math.random);
      for (const o of res.objetos) agregar(e.jugador.inventario, o.id, o.cantidad, nivel(hab, 'fuerza'));
      if (res.ok) {
        contar(e, 'pescar', res.capturas.length);
        this.hud.aviso(`La atarraya trajo ${res.capturas.length} peces.`, 'bueno');
      } else this.hud.aviso('La atarraya salió vacía.', 'malo');
      this._ganarXP('pesca', res.xp);
      this.estado.jugador.necesidades.aguante = limitar(this.estado.jugador.necesidades.aguante - res.aguante, 0, 100);
      this._pasarMinutos(20, 'trabajar');
      this._comprobarCapitulo();
      return;
    }
    if (tipo === 'caza') {
      const animal = op.objetivo;
      const distancia = Math.hypot(animal.x - this.jugador.x, animal.z - this.jugador.z);
      const pen = penalizaciones(e.jugador.necesidades);
      this.jugadorPose = 'apuntar';
      const arma = conocimientos(e).has('tiro_largo') ? 'hondilla_larga' : 'hondilla';
      const ap = crearApuntado({
        arma, distancia, bono: bono(hab, 'caza'), punteria: pen.punteria,
        viento: this.clima.viento, agachado: this.jugador.agachado, fase: Math.random() * TAU,
      });
      this.camara.fovDeseado = 40 * (Math.PI / 180);
      this.minijuegos.iniciarCaza(ap, animal, (res) => {
        this.jugadorPose = null;
        this.camara.fovDeseado = 58 * (Math.PI / 180);
        if (res.cancelado) return;
        if (!res.disparo) { this.hud.aviso(res.texto || 'No tiraste.', 'malo'); return; }
        quitar(e.jugador.inventario, 'piedra', 1);
        const tiro = resolverTiro({
          animal: animal.perfil, desvio: res.desvio, distancia, arma,
          bono: bono(hab, 'caza'), rnd: Math.random,
        });
        this.hud.aviso(tiro.texto, tiro.limpio ? 'bueno' : 'malo', 4600);
        if (tiro.limpio && tiro.presa) {
          const presa = this.fauna.cobrar(animal);
          agregar(e.jugador.inventario, presa.objeto, presa.cantidad, nivel(hab, 'fuerza'));
          if (conocimientos(e).has('destazar') && animal.tipo === 'venado') {
            agregar(e.jugador.inventario, 'cuero', 1, nivel(hab, 'fuerza'));
          }
          contar(e, 'cazar');
        } else {
          animal.sospecha = 1.3;
          animal.estado = 'huir';
          animal.temporizador = 5;
        }
        this._ganarXP('caza', tiro.xp);
        this._pasarMinutos(12, 'trabajar');
        this._comprobarCapitulo();
      });
      return;
    }
    if (tipo === 'lena') {
      this.jugadorPose = 'trabajar';
      this.minijuegos.iniciarLena(3, (res) => {
        this.jugadorPose = null;
        if (res.cancelado) return;
        const extra = res.aciertos;
        if (extra > 0) {
          agregar(e.jugador.inventario, 'lena', extra, nivel(hab, 'fuerza'));
          this.hud.aviso(`${extra} leña${extra > 1 ? 's' : ''} de más por los buenos golpes.`, 'bueno');
        }
        this._ganarXP('fuerza', 3 + extra * 2);
        this._comprobarCapitulo();
      });
    }
  }

  _puntoPescaCercano() {
    let mejor = null, mejorD = 1e9;
    for (const p of this.puntosPesca) {
      const d = Math.hypot(p.x - this.jugador.x, p.z - this.jugador.z);
      if (d < mejorD) { mejorD = d; mejor = p; }
    }
    return mejorD < 26 ? mejor : null;
  }

  // -------------------------------------------------------------- paneles
  abrirPanel(tipo) {
    const e = this.estado;
    this.paneles.abrir(tipo, {
      estado: e,
      nivelFuerza: nivel(e.jugador.habilidades, 'fuerza'),
      sabe: conocimientos(e),
      progreso: resumenCapitulos(e),
      estacion: estacionDe(this.reloj.dia),
      motor: this.renderizador.nombre,
    });
  }

  _accionesPanel() {
    return {
      alCerrar: () => this.entrada.limpiar(),
      alComer: (id) => {
        const e = this.estado;
        if (!cuenta(e.jugador.inventario, id)) return;
        quitar(e.jugador.inventario, id, 1);
        comerNec(e.jugador.necesidades, OBJETOS[id]);
        this.hud.aviso(`Te comiste: ${OBJETOS[id].nombre}`, 'bueno');
      },
      alTomar: (id) => {
        const e = this.estado;
        transferir(e.hogar.despensa, e.jugador.inventario, id, 1, nivel(e.jugador.habilidades, 'fuerza'));
      },
      alCocinar: (idReceta) => {
        const e = this.estado;
        const r = cocinar(idReceta, e.jugador.inventario, {
          sabe: conocimientos(e), despensa: e.hogar.despensa,
          nivelFuerza: nivel(e.jugador.habilidades, 'fuerza'),
        });
        if (!r.ok) { this.hud.aviso(r.motivo || 'Faltan cosas.', 'malo'); return; }
        contarReceta(e, idReceta);
        this._ganarXP('oficio', r.xp);
        this._pasarMinutos(r.minutos, 'trabajar');
        this.hud.aviso(`Hiciste ${r.texto}`, 'bueno');
        this._comprobarCapitulo();
      },
      alSembrar: (idCultivo) => {
        if (!this.cuadroElegido) return;
        this.hacer({ id: 'sembrar', objetivo: this.cuadroElegido, cultivo: idCultivo });
        this.cuadroElegido = null;
      },
      alEmpezarCapitulo: (id) => {
        const cap = activarCapitulo(this.estado, id);
        if (cap.ok) this.dialogo.mostrar(cap.capitulo.intro, () => this.guardar());
      },
      alAjustar: (clave, valor) => {
        this.estado.ajustes[clave] = valor;
        this.guardar();
        if (clave === 'motor' || clave === 'sombras' || clave === 'calidad') {
          this.hud.aviso('Se aplica al volver a entrar al juego.', 'neutro', 5000);
        }
      },
      alGuardar: () => { this.guardar(); this.hud.aviso('Partida guardada.', 'bueno'); },
      alReiniciar: () => { if (confirm('¿Empezar de nuevo? Se pierde la partida.')) this.alSalir?.('nueva'); },
      alAmanecer: () => { this.hud.aviso(suceso('amanecer'), 'neutro', 4200); },
    };
  }

  // --------------------------------------------------------------- dibujo
  dibujar(dt) {
    const e = this.estado;
    const cielo = estadoCielo(this.reloj.hora, this.clima);
    const j = this.jugador;

    this.escena.reiniciarDinamicos();
    this.mundo3d.emitirMilpa(e.cuadros);
    this.mundo3d.emitirFauna(this.fauna);
    this.mundo3d.emitirPerro(this.perro);
    this.mundo3d.emitirSenales(this._marcadores());
    this.mundo3d.emitirParticulas({
      dt, camara: this.camara, clima: this.clima, hora: this.reloj.hora,
      fogonEncendido: this.reloj.esNoche || this.clima.lluvia > 0.3,
    });
    this.mundo3d.emitirChispas(dt);

    this.personaje.actualizar(dt, {
      x: j.x, y: j.y, z: j.z, rumbo: j.rumbo, velocidad: j.velocidad,
      agachado: j.agachado, nadando: j.nadando, pose: this.jugadorPose || j.pose,
      carga: cargaRelativa(e),
    });
    this.personaje.emitir();

    matrizSombra([j.x, j.y, j.z], cielo.dirSol, 38, this.luzProy);
    this.renderizador.dibujar(this.escena, {
      camara: this.camara, cielo, tiempo: this.tiempoRender, luzProy: this.luzProy,
      viento: this.vientoSuave, agitacion: limitar(0.2 + this.clima.lluvia * 0.7, 0, 1),
    });

    this.hud.actualizar({
      reloj: this.reloj, dia: this.reloj.dia, clima: this.clima,
      necesidades: e.jugador.necesidades,
      peso: peso(e.jugador.inventario),
      cargaMaxima: cargaMaxima(e.jugador.inventario, nivel(e.jugador.habilidades, 'fuerza')),
      capitulo: capituloActivo(e) ? { capitulo: capituloActivo(e), ...evaluarCapitulo(capituloActivo(e), e) } : null,
    });
    this.dialogo.actualizar(dt);
  }

  /** Banderas que apuntan a donde hay que ir para el objetivo activo. */
  _marcadores() {
    const cap = capituloActivo(this.estado);
    if (!cap) return [];
    const ev = evaluarCapitulo(cap, this.estado);
    const sitios = [];
    for (const o of ev.objetivos) {
      if (o.hecho) continue;
      const def = cap.objetivos.find((x) => x.id === o.id);
      if (!def) continue;
      if (def.tipo === 'entregar' || def.tipo === 'entregarCategoria') sitios.push(LUGARES.casa);
      else if (def.accion === 'pescar' || def.objeto === 'agua') sitios.push(LUGARES.poza);
      else if (def.accion === 'buscar' || def.accion === 'cazar') sitios.push(LUGARES.monte);
      else if (['sembrar', 'regar', 'cosechar'].includes(def.accion) || def.tipo === 'sembrar' || def.tipo === 'cosechar') sitios.push(LUGARES.milpa);
      else if (def.tipo === 'cocinar') sitios.push(LUGARES.fogon);
    }
    // Solo se marca lo que esta lejos: de cerca estorba.
    return sitios.filter((s) => Math.hypot(s.x - this.jugador.x, s.z - this.jugador.z) > 14).slice(0, 2);
  }

  // -------------------------------------------------------------- guardado
  guardar() {
    const e = this.estado;
    e.dia = this.reloj.dia;
    e.hora = this.reloj.hora;
    e.jugador.x = this.jugador.x;
    e.jugador.z = this.jugador.z;
    e.jugador.rumbo = this.jugador.rumbo;
    guardar(e);
  }

  destruir() {
    this.bucle?.parar();
    this.entrada?.destruir();
    this.renderizador?.destruir();
  }
}
