/**
 * wgsl.js — Shaders WGSL del camino WebGPU.
 *
 * Espejo exacto de render/glsl.js. WebGPU es el estandar al que va el sector
 * (canalizacion explicita, sin estado global, y con computo disponible para lo
 * que venga despues), asi que es el camino preferente; GLSL queda de respaldo.
 *
 * Diferencias inevitables con GLSL:
 *   - el origen de las coordenadas de textura esta arriba, asi que la busqueda
 *     en el mapa de sombras invierte la Y;
 *   - la profundidad ya es [0, 1], que es justo lo que producen las matrices de
 *     nucleo/mate.js: aqui no hace falta corregir nada.
 */

const COMUN = `
struct Marco {
  vistaProy    : mat4x4<f32>,
  luzProy      : mat4x4<f32>,
  invVistaProy : mat4x4<f32>,
  camPos       : vec4<f32>,  // xyz, w = tiempo
  camDer       : vec4<f32>,  // xyz, w = texel de sombra
  dirSol       : vec4<f32>,  // xyz, w = intensidad
  colorSol     : vec4<f32>,  // rgb, w = humedad
  ambiente     : vec4<f32>,  // rgb, w = estrellas
  rebote       : vec4<f32>,  // rgb, w = nubes
  cenit        : vec4<f32>,  // rgb, w = agitacion del agua
  horizonte    : vec4<f32>,  // rgb, w = altura de niebla
  niebla       : vec4<f32>,  // rgb, w = densidad
  viento       : vec4<f32>,  // x, z, fuerza, sin usar
};

struct Instancia {
  modelo : mat4x4<f32>,
  color  : vec4<f32>,
  extra  : vec4<f32>,        // oleaje, brillo, banderas, fase
};

@group(0) @binding(0) var<uniform> marco : Marco;
@group(0) @binding(1) var texSombra : texture_depth_2d;
@group(0) @binding(2) var cmpSombra : sampler_comparison;
@group(1) @binding(0) var<storage, read> instancias : array<Instancia>;

fn aces(x : vec3<f32>) -> vec3<f32> {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3(0.0), vec3(1.0));
}

fn aSRGB(lineal : vec3<f32>) -> vec3<f32> {
  return pow(max(lineal, vec3(0.0)), vec3(1.0 / 2.2));
}

// Los colores llegan en sRGB desde JavaScript; la luz se calcula en lineal.
fn aLineal(s : vec3<f32>) -> vec3<f32> {
  return pow(max(s, vec3(0.0)), vec3(2.2));
}

fn hash13(pe : vec3<f32>) -> f32 {
  var p = fract(pe * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p = p * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

fn ruido3(p : vec3<f32>) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  let n000 = hash13(i);                let n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  let n010 = hash13(i + vec3(0.0, 1.0, 0.0)); let n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  let n001 = hash13(i + vec3(0.0, 0.0, 1.0)); let n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  let n011 = hash13(i + vec3(0.0, 1.0, 1.0)); let n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

fn mecer(mundoIn : vec3<f32>, oleaje : f32, fase : f32) -> vec3<f32> {
  var mundo = mundoIn;
  if (oleaje <= 0.0) { return mundo; }
  let t = marco.camPos.w;
  let f = sin(t * 1.7 + mundo.x * 0.33 + mundo.z * 0.27 + fase)
        + 0.55 * sin(t * 3.1 + mundo.z * 0.61 + fase * 1.7)
        + 0.25 * sin(t * 6.3 + mundo.x * 1.4 + fase * 0.6);
  let k = oleaje * marco.viento.z;
  mundo = vec3(mundo.x + marco.viento.x * f * k * 0.5, mundo.y - abs(f) * k * 0.12,
               mundo.z + marco.viento.y * f * k * 0.5);
  return mundo;
}

fn aplicarNiebla(color : vec3<f32>, mundo : vec3<f32>) -> vec3<f32> {
  let v = mundo - marco.camPos.xyz;
  let dist = length(v);
  let h = max(0.05, exp(-max(mundo.y, 0.0) * marco.horizonte.w * 40.0));
  let f = 1.0 - exp(-dist * marco.niebla.w * h);
  let haciaSol = max(dot(normalize(v), marco.dirSol.xyz), 0.0);
  let tinte = mix(aLineal(marco.niebla.rgb), aLineal(marco.colorSol.rgb) * 1.15, pow(haciaSol, 5.0) * 0.55);
  return mix(color, tinte, clamp(f, 0.0, 1.0));
}
`;

export const OBJETOS = `${COMUN}

struct SalidaV {
  @builtin(position) pos : vec4<f32>,
  @location(0) mundo : vec3<f32>,
  @location(1) nor : vec3<f32>,
  @location(2) col : vec3<f32>,
  @location(3) alfa : f32,
  @location(4) brillo : f32,
  @location(5) @interpolate(flat) banderas : u32,
  @location(6) luz : vec4<f32>,
};

@vertex
fn vs(@builtin(instance_index) ii : u32,
      @location(0) aPos : vec3<f32>,
      @location(1) aNor : vec3<f32>,
      @location(2) aCol : vec3<f32>,
      @location(3) aOleaje : f32) -> SalidaV {
  let inst = instancias[ii];
  let banderas = u32(inst.extra.z + 0.5);
  var mundo : vec3<f32>;
  var nor : vec3<f32>;
  if ((banderas & 2u) != 0u) {
    let centro = inst.modelo[3].xyz;
    let ex = length(inst.modelo[0].xyz);
    let ey = length(inst.modelo[1].xyz);
    mundo = centro + marco.camDer.xyz * (aPos.x * ex) + vec3(0.0, 1.0, 0.0) * (aPos.y * ey);
    nor = normalize(marco.camPos.xyz - centro);
  } else {
    mundo = (inst.modelo * vec4(aPos, 1.0)).xyz;
    let m3 = mat3x3<f32>(inst.modelo[0].xyz, inst.modelo[1].xyz, inst.modelo[2].xyz);
    nor = normalize(m3 * aNor);
  }
  mundo = mecer(mundo, aOleaje * inst.extra.x, inst.extra.w);

  var s : SalidaV;
  s.pos = marco.vistaProy * vec4(mundo, 1.0);
  s.mundo = mundo;
  s.nor = nor;
  s.col = aCol * inst.color.rgb;
  s.alfa = inst.color.a;
  s.brillo = inst.extra.y;
  s.banderas = banderas;
  s.luz = marco.luzProy * vec4(mundo, 1.0);
  return s;
}

fn sombraEn(luz : vec4<f32>, n : vec3<f32>) -> f32 {
  let p = luz.xyz / max(luz.w, 1e-5);
  let uv = vec2(p.x * 0.5 + 0.5, -p.y * 0.5 + 0.5);
  let cosT = clamp(dot(n, marco.dirSol.xyz), 0.0, 1.0);
  let sesgo = mix(0.0022, 0.0004, cosT);
  let z = p.z - sesgo;
  let texel = marco.camDer.w;
  var suma = 0.0;
  // Bucle de control uniforme: WGSL exige que la comparacion no dependa
  // de ramas por pixel, asi que se muestrea siempre y se decide al final.
  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      let d = vec2(f32(x), f32(y)) * texel;
      suma = suma + textureSampleCompareLevel(texSombra, cmpSombra, uv + d, z);
    }
  }
  let dentro = select(0.0, 1.0, uv.x > 0.002 && uv.x < 0.998 && uv.y > 0.002 && uv.y < 0.998 && p.z <= 1.0);
  return mix(1.0, suma / 9.0, dentro);
}

@fragment
fn fs(e : SalidaV) -> @location(0) vec4<f32> {
  let follaje = (e.banderas & 1u) != 0u;
  var n = normalize(e.nor);
  let v = normalize(marco.camPos.xyz - e.mundo);
  if (follaje && dot(n, v) < 0.0) { n = -n; }

  let dirSol = marco.dirSol.xyz;
  let intensidad = marco.dirSol.w;
  let colorSol = aLineal(marco.colorSol.rgb);
  let humedad = marco.colorSol.a;

  let nl = dot(n, dirSol);
  let directa = max(nl, 0.0);
  let envuelta = clamp(nl * 0.55 + 0.45, 0.0, 1.0);
  let difusa = mix(directa, envuelta, 0.45);

  let sombra = sombraEn(e.luz, n);
  var luz = colorSol * intensidad * difusa * mix(0.25, 1.0, sombra);

  let sky = n.y * 0.5 + 0.5;
  let ambiente = mix(aLineal(marco.rebote.rgb), aLineal(marco.ambiente.rgb), sky);

  if (follaje) {
    let tras = pow(max(dot(-v, dirSol), 0.0), 3.0);
    luz = luz + colorSol * intensidad * tras * 0.55 * mix(0.4, 1.0, sombra);
  }

  var base = aLineal(e.col);
  base = base * mix(1.0, 0.72, humedad * max(n.y, 0.0));

  var color = base * (luz + ambiente);
  let h = normalize(dirSol + v);
  let esp = pow(max(dot(n, h), 0.0), mix(24.0, 90.0, humedad));
  color = color + colorSol * intensidad * esp * mix(0.03, 0.35, humedad) * sombra;
  color = color + base * e.brillo;
  color = aplicarNiebla(color, e.mundo);

  if (e.alfa < 0.004) { discard; }
  return vec4(aSRGB(aces(color)), e.alfa);
}
`;

export const SOMBRA = `${COMUN}

@vertex
fn vs(@builtin(instance_index) ii : u32,
      @location(0) aPos : vec3<f32>,
      @location(1) aNor : vec3<f32>,
      @location(2) aCol : vec3<f32>,
      @location(3) aOleaje : f32) -> @builtin(position) vec4<f32> {
  let inst = instancias[ii];
  var mundo = (inst.modelo * vec4(aPos, 1.0)).xyz;
  mundo = mecer(mundo, aOleaje * inst.extra.x, inst.extra.w);
  return marco.luzProy * vec4(mundo, 1.0);
}
`;

export const CIELO = `${COMUN}

struct SalidaC {
  @builtin(position) pos : vec4<f32>,
  @location(0) ndc : vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi : u32) -> SalidaC {
  let p = vec2<f32>(f32((vi << 1u) & 2u), f32(vi & 2u));
  var s : SalidaC;
  s.ndc = p * 2.0 - 1.0;
  s.pos = vec4(s.ndc, 1.0, 1.0);
  return s;
}

@fragment
fn fs(e : SalidaC) -> @location(0) vec4<f32> {
  let lejos = marco.invVistaProy * vec4(e.ndc, 1.0, 1.0);
  let dir = normalize(lejos.xyz / lejos.w - marco.camPos.xyz);
  let dirSol = marco.dirSol.xyz;
  let intensidad = marco.dirSol.w;
  let colorSol = aLineal(marco.colorSol.rgb);
  let estrellas = marco.ambiente.w;
  let nubes = marco.rebote.w;
  let tiempo = marco.camPos.w;

  let alt = clamp(dir.y, -1.0, 1.0);
  let k = pow(clamp(alt * 1.05 + 0.06, 0.0, 1.0), 0.42);
  var color = mix(aLineal(marco.horizonte.rgb), aLineal(marco.cenit.rgb), k);
  color = mix(color * 0.55, color, smoothstep(-0.08, 0.02, alt));

  let cosSol = dot(dir, dirSol);
  color = color + colorSol * pow(max(cosSol, 0.0), 220.0) * 26.0 * step(0.0, dirSol.y + 0.08);
  color = color + colorSol * pow(max(cosSol, 0.0), 7.0) * 0.26 * max(intensidad, 0.15);

  let cosLuna = dot(dir, -dirSol);
  color = color + vec3(0.75, 0.80, 0.95) * pow(max(cosLuna, 0.0), 900.0) * 8.0 * estrellas;

  if (estrellas > 0.01 && alt > -0.02) {
    let celda = floor(dir * 190.0);
    let ee = hash13(celda);
    let brillo = smoothstep(0.9965, 1.0, ee) * (0.6 + 0.4 * sin(tiempo * 2.0 + ee * 40.0));
    color = color + vec3(0.85, 0.9, 1.0) * brillo * estrellas * 2.2;
  }

  if (alt > 0.005) {
    let p = vec3(dir.xz / max(alt, 0.02) * 0.9, tiempo * 0.012);
    let n = ruido3(p * 1.1 + vec3(tiempo * 0.02, 0.0, 0.0)) * 0.6
          + ruido3(p * 2.7 + vec3(0.0, tiempo * 0.03, 0.0)) * 0.4;
    var cobertura = smoothstep(0.62 - nubes * 0.45, 0.92 - nubes * 0.35, n);
    cobertura = cobertura * smoothstep(0.0, 0.22, alt);
    var nube = mix(vec3(0.30, 0.32, 0.36), vec3(1.05, 1.0, 0.98), clamp(intensidad * 0.45, 0.05, 1.0));
    nube = mix(nube, colorSol * 1.1, pow(max(cosSol, 0.0), 4.0) * 0.5);
    color = mix(color, nube, cobertura * mix(0.35, 0.95, nubes));
  }

  return vec4(aSRGB(aces(color)), 1.0);
}
`;

export const AGUA = `${COMUN}

struct SalidaA {
  @builtin(position) pos : vec4<f32>,
  @location(0) mundo : vec3<f32>,
  @location(1) prof : f32,
};

@vertex
fn vs(@builtin(instance_index) ii : u32,
      @location(0) aPos : vec3<f32>,
      @location(1) aNor : vec3<f32>,
      @location(2) aCol : vec3<f32>,
      @location(3) aProf : f32) -> SalidaA {
  let inst = instancias[ii];
  var mundo = (inst.modelo * vec4(aPos, 1.0)).xyz;
  let t = marco.camPos.w;
  let agitacion = marco.cenit.w;
  let a = sin(mundo.x * 1.7 + t * 1.9) * 0.5 + sin(mundo.z * 2.3 - t * 1.4) * 0.5;
  let b = sin((mundo.x + mundo.z) * 3.1 + t * 2.7) * 0.35 + sin(mundo.z * 5.2 + t * 3.3) * 0.25;
  let amp = mix(0.012, 0.075, agitacion) * clamp(aProf * 2.0, 0.15, 1.0);
  mundo.y = mundo.y + (a * 0.6 + b * 0.4) * amp;
  var s : SalidaA;
  s.pos = marco.vistaProy * vec4(mundo, 1.0);
  s.mundo = mundo;
  s.prof = aProf;
  return s;
}

@fragment
fn fs(e : SalidaA) -> @location(0) vec4<f32> {
  let t = marco.camPos.w;
  let agitacion = marco.cenit.w;
  let v = normalize(marco.camPos.xyz - e.mundo);
  let dx = cos(e.mundo.x * 1.7 + t * 1.9) * 1.7 * 0.5
         + cos((e.mundo.x + e.mundo.z) * 3.1 + t * 2.7) * 3.1 * 0.35;
  let dz = cos(e.mundo.z * 2.3 - t * 1.4) * 2.3 * 0.5
         + cos(e.mundo.z * 5.2 + t * 3.3) * 5.2 * 0.25;
  let amp = mix(0.010, 0.055, agitacion);
  let n = normalize(vec3(-dx * amp * 0.35, 1.0, -dz * amp * 0.35));

  let intensidad = marco.dirSol.w;
  let fresnel = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0);
  let reflejo = mix(aLineal(marco.horizonte.rgb), aLineal(marco.cenit.rgb), 0.55) * 1.15;
  let hondo = mix(vec3(0.04, 0.11, 0.15), vec3(0.08, 0.21, 0.25), clamp(intensidad * 0.4, 0.0, 1.0));
  let bajo = mix(vec3(0.16, 0.24, 0.20), vec3(0.30, 0.40, 0.31), clamp(intensidad * 0.4, 0.0, 1.0));
  let agua = mix(bajo, hondo, smoothstep(0.05, 0.75, e.prof));

  // El reflejo se limita: a ras de agua el fresnel se dispara y el rio se
  // convertia en una plancha azul sin fondo ni corriente.
  var color = mix(agua, reflejo, clamp(fresnel * 0.7 + 0.06, 0.0, 0.72));
  let rizo = sin(e.mundo.x * 9.0 + t * 2.1) * sin(e.mundo.z * 7.3 - t * 1.7);
  color = color * (1.0 + rizo * 0.09 * (0.35 + agitacion));
  let h = normalize(marco.dirSol.xyz + v);
  color = color + aLineal(marco.colorSol.rgb) * intensidad * pow(max(dot(n, h), 0.0), 240.0) * 2.6;

  // Espuma de orilla en manchas, no en bandas (ver glsl.js).
  let patron = 0.5 + 0.5 * sin(e.mundo.x * 3.3 + t * 1.6) * sin(e.mundo.z * 2.9 - t * 1.1);
  let espuma = smoothstep(0.07, 0.0, e.prof) * (0.3 + 0.7 * patron);
  color = mix(color, aLineal(vec3(0.90, 0.94, 0.95)), clamp(espuma, 0.0, 1.0) * 0.45);
  color = aplicarNiebla(color, e.mundo);

  let alfa = clamp(0.34 + e.prof * 0.55 + fresnel * 0.28 + espuma * 0.35, 0.0, 1.0);
  return vec4(aSRGB(aces(color)), alfa);
}
`;
