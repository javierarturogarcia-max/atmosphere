/**
 * glsl.js — Shaders GLSL ES 3.00 del respaldo WebGL2.
 *
 * El modelo de sombreado es el mismo que el de WGSL (render/wgsl.js), a
 * proposito: si un dia se cambia el aspecto del juego hay que tocar los dos,
 * pero a cambio el resultado es identico en cualquier navegador.
 *
 * Convenio de profundidad: las matrices de nucleo/mate.js producen z en [0, 1]
 * (lo que espera WebGPU). WebGL2 espera [-1, 1], asi que cada vertex shader
 * termina con la correccion `pos.z = pos.z * 2.0 - pos.w;`.
 */

/** Trozos compartidos por varios shaders. */
const COMUN = `
const float PI = 3.14159265;

vec3 aces(vec3 x) {
  // Curva filmica de Narkowicz: comprime altas luces sin quemar el color.
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 aSRGB(vec3 lineal) {
  return pow(max(lineal, vec3(0.0)), vec3(1.0 / 2.2));
}

// Los colores llegan desde JavaScript en sRGB (que es como se piensan al
// disenar la paleta); la luz hay que calcularla en lineal o los verdes se
// lavan y todo acaba pareciendo plastico blanco.
vec3 aLineal(vec3 s) {
  return pow(max(s, vec3(0.0)), vec3(2.2));
}

float hash13(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float ruido3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0));
  float n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1));
  float n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
             mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
`;

/** Desplazamiento por viento, compartido entre pase de color y de sombra. */
const VIENTO = `
vec3 mecer(vec3 mundo, float oleaje, float fase, float tiempo, vec3 viento) {
  if (oleaje <= 0.0) return mundo;
  float f = sin(tiempo * 1.7 + mundo.x * 0.33 + mundo.z * 0.27 + fase)
          + 0.55 * sin(tiempo * 3.1 + mundo.z * 0.61 + fase * 1.7)
          + 0.25 * sin(tiempo * 6.3 + mundo.x * 1.4 + fase * 0.6);
  float k = oleaje * viento.z;
  mundo.xz += viento.xy * f * k * 0.5;
  mundo.y -= abs(f) * k * 0.12;
  return mundo;
}
`;

const NIEBLA = `
vec3 aplicarNiebla(vec3 color, vec3 mundo, vec3 camara, vec3 nieblaColor, float densidad,
                   float alturaNiebla, vec3 dirSol, vec3 colorSol) {
  vec3 v = mundo - camara;
  float dist = length(v);
  // Niebla exponencial integrada en altura: mas densa en el fondo del valle.
  float h = max(0.05, exp(-max(mundo.y, 0.0) * alturaNiebla * 40.0));
  float f = 1.0 - exp(-dist * densidad * h);
  // Dispersion hacia el sol: el aire se enciende mirando al amanecer.
  float haciaSol = max(dot(normalize(v), dirSol), 0.0);
  vec3 tinte = mix(nieblaColor, colorSol * 1.15, pow(haciaSol, 5.0) * 0.55);
  return mix(color, tinte, clamp(f, 0.0, 1.0));
}
`;

export const OBJETOS_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
layout(location = 2) in vec3 aCol;
layout(location = 3) in float aOleaje;
layout(location = 4) in vec4 iM0;
layout(location = 5) in vec4 iM1;
layout(location = 6) in vec4 iM2;
layout(location = 7) in vec4 iM3;
layout(location = 8) in vec4 iColor;
layout(location = 9) in vec4 iExtra;

uniform mat4 uVistaProy;
uniform mat4 uLuzProy;
uniform float uTiempo;
uniform vec3 uViento;
uniform vec3 uCamPos;
uniform vec3 uCamDer;
uniform vec3 uCamArr;

out vec3 vMundo;
out vec3 vNor;
out vec3 vCol;
out float vAlfa;
out float vBrillo;
flat out float vBanderas;
out vec4 vLuz;
${VIENTO}

void main() {
  mat4 M = mat4(iM0, iM1, iM2, iM3);
  vec3 mundo;
  vec3 nor;
  int banderas = int(iExtra.z + 0.5);
  if ((banderas & 2) != 0) {
    // Cartel siempre de cara: se toma la posicion y la escala de la matriz.
    vec3 centro = iM3.xyz;
    float ex = length(iM0.xyz), ey = length(iM1.xyz);
    mundo = centro + uCamDer * (aPos.x * ex) + uCamArr * (aPos.y * ey);
    nor = normalize(uCamPos - centro);
  } else {
    mundo = (M * vec4(aPos, 1.0)).xyz;
    nor = normalize(mat3(M) * aNor);
  }
  mundo = mecer(mundo, aOleaje * iExtra.x, iExtra.w, uTiempo, uViento);
  vMundo = mundo;
  vNor = nor;
  vCol = aCol * iColor.rgb;
  vAlfa = iColor.a;
  vBrillo = iExtra.y;
  vBanderas = iExtra.z;
  vLuz = uLuzProy * vec4(mundo, 1.0);
  vec4 pos = uVistaProy * vec4(mundo, 1.0);
  pos.z = pos.z * 2.0 - pos.w;
  gl_Position = pos;
}`;

export const OBJETOS_FRAG = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vMundo;
in vec3 vNor;
in vec3 vCol;
in float vAlfa;
in float vBrillo;
flat in float vBanderas;
in vec4 vLuz;

uniform vec3 uCamPos;
uniform vec3 uDirSol;
uniform vec3 uColorSol;
uniform float uIntensidad;
uniform vec3 uAmbiente;
uniform vec3 uRebote;
uniform vec3 uNieblaColor;
uniform float uNieblaDensidad;
uniform float uNieblaAltura;
uniform float uHumedad;
uniform float uSombraTexel;
uniform sampler2DShadow uSombra;

out vec4 salida;
${COMUN}
${NIEBLA}

float sombraEn(vec3 n) {
  vec3 p = vLuz.xyz / max(vLuz.w, 1e-5);
  vec2 uv = p.xy * 0.5 + 0.5;
  if (uv.x < 0.002 || uv.x > 0.998 || uv.y < 0.002 || uv.y > 0.998 || p.z > 1.0) return 1.0;
  // Sesgo proporcional a la inclinacion: sin esto aparece el rayado de acne.
  float cosT = clamp(dot(n, uDirSol), 0.0, 1.0);
  float sesgo = mix(0.0022, 0.0004, cosT);
  float z = p.z - sesgo;
  float suma = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 d = vec2(float(x), float(y)) * uSombraTexel;
      suma += texture(uSombra, vec3(uv + d, z));
    }
  }
  return suma / 9.0;
}

void main() {
  int banderas = int(vBanderas + 0.5);
  bool follaje = (banderas & 1) != 0;
  vec3 n = normalize(vNor);
  vec3 v = normalize(uCamPos - vMundo);
  if (follaje && dot(n, v) < 0.0) n = -n;   // hojas por las dos caras

  float nl = dot(n, uDirSol);
  float directa = max(nl, 0.0);
  // Envoltura suave: el terreno no se corta a negro en el terminador.
  float envuelta = clamp(nl * 0.55 + 0.45, 0.0, 1.0);
  float difusa = mix(directa, envuelta, 0.45);

  float sombra = sombraEn(n);
  vec3 colorSol = aLineal(uColorSol);
  vec3 luz = colorSol * uIntensidad * difusa * mix(0.25, 1.0, sombra);

  // Ambiente hemisferico: cielo arriba, rebote de la tierra abajo.
  float sky = n.y * 0.5 + 0.5;
  vec3 ambiente = mix(aLineal(uRebote), aLineal(uAmbiente), sky);

  // Translucidez de la hoja: se enciende cuando el sol viene de detras.
  if (follaje) {
    float tras = pow(max(dot(-v, uDirSol), 0.0), 3.0);
    luz += colorSol * uIntensidad * tras * 0.55 * mix(0.4, 1.0, sombra);
  }

  vec3 base = aLineal(vCol);
  // Mojado: oscurece el difuso y sube el especular, como el suelo tras la lluvia.
  base *= mix(1.0, 0.72, uHumedad * max(n.y, 0.0));

  vec3 color = base * (luz + ambiente);

  vec3 h = normalize(uDirSol + v);
  float brilloEsp = pow(max(dot(n, h), 0.0), mix(24.0, 90.0, uHumedad));
  color += colorSol * uIntensidad * brilloEsp * mix(0.03, 0.35, uHumedad) * sombra;

  color += base * vBrillo;

  color = aplicarNiebla(color, vMundo, uCamPos, aLineal(uNieblaColor), uNieblaDensidad,
                        uNieblaAltura, uDirSol, colorSol);
  salida = vec4(aSRGB(aces(color)), vAlfa);
  if (salida.a < 0.004) discard;
}`;

export const SOMBRA_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 3) in float aOleaje;
layout(location = 4) in vec4 iM0;
layout(location = 5) in vec4 iM1;
layout(location = 6) in vec4 iM2;
layout(location = 7) in vec4 iM3;
layout(location = 8) in vec4 iColor;
layout(location = 9) in vec4 iExtra;
uniform mat4 uLuzProy;
uniform float uTiempo;
uniform vec3 uViento;
${VIENTO}
void main() {
  mat4 M = mat4(iM0, iM1, iM2, iM3);
  vec3 mundo = (M * vec4(aPos, 1.0)).xyz;
  mundo = mecer(mundo, aOleaje * iExtra.x, iExtra.w, uTiempo, uViento);
  vec4 pos = uLuzProy * vec4(mundo, 1.0);
  pos.z = pos.z * 2.0 - pos.w;
  gl_Position = pos;
}`;

export const SOMBRA_FRAG = `#version 300 es
precision highp float;
void main() {}`;

export const CIELO_VERT = `#version 300 es
precision highp float;
out vec2 vUV;
void main() {
  // Triangulo unico que cubre la pantalla, sin buffer de vertices.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 1.0, 1.0);
}`;

export const CIELO_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
uniform mat4 uInvVistaProy;
uniform vec3 uCamPos;
uniform vec3 uDirSol;
uniform vec3 uColorSol;
uniform vec3 uCenit;
uniform vec3 uHorizonte;
uniform float uIntensidad;
uniform float uEstrellas;
uniform float uNubes;
uniform float uTiempo;
out vec4 salida;
${COMUN}

void main() {
  vec4 lejos = uInvVistaProy * vec4(vUV * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(lejos.xyz / lejos.w - uCamPos);

  float alt = clamp(dir.y, -1.0, 1.0);
  float k = pow(clamp(alt * 1.05 + 0.06, 0.0, 1.0), 0.42);
  vec3 colorSol = aLineal(uColorSol);
  vec3 color = mix(aLineal(uHorizonte), aLineal(uCenit), k);

  // Suelo por debajo del horizonte: evita el corte duro contra la niebla.
  color = mix(color * 0.55, color, smoothstep(-0.08, 0.02, alt));

  float cosSol = dot(dir, uDirSol);
  // Halo y disco solar.
  color += colorSol * pow(max(cosSol, 0.0), 220.0) * 26.0 * step(0.0, uDirSol.y + 0.08);
  color += colorSol * pow(max(cosSol, 0.0), 7.0) * 0.26 * max(uIntensidad, 0.15);

  // Luna: un disco frio en la direccion opuesta al sol.
  vec3 dirLuna = -uDirSol;
  float cosLuna = dot(dir, dirLuna);
  color += vec3(0.75, 0.80, 0.95) * pow(max(cosLuna, 0.0), 900.0) * 8.0 * uEstrellas;

  // Estrellas: rejilla con ruido, solo de noche y sin nubes.
  if (uEstrellas > 0.01 && alt > -0.02) {
    vec3 celda = floor(dir * 190.0);
    float e = hash13(celda);
    float brillo = smoothstep(0.9965, 1.0, e) * (0.6 + 0.4 * sin(uTiempo * 2.0 + e * 40.0));
    color += vec3(0.85, 0.9, 1.0) * brillo * uEstrellas * 2.2;
  }

  // Nubes: dos octavas de ruido proyectadas en un plano alto.
  if (alt > 0.005) {
    vec3 p = vec3(dir.xz / max(alt, 0.02) * 0.9, uTiempo * 0.012);
    float n = ruido3(p * 1.1 + vec3(uTiempo * 0.02, 0.0, 0.0)) * 0.6
            + ruido3(p * 2.7 + vec3(0.0, uTiempo * 0.03, 0.0)) * 0.4;
    float cobertura = smoothstep(0.62 - uNubes * 0.45, 0.92 - uNubes * 0.35, n);
    cobertura *= smoothstep(0.0, 0.22, alt);
    vec3 nube = mix(vec3(0.30, 0.32, 0.36), vec3(1.05, 1.0, 0.98), clamp(uIntensidad * 0.45, 0.05, 1.0));
    nube = mix(nube, colorSol * 1.1, pow(max(cosSol, 0.0), 4.0) * 0.5);
    color = mix(color, nube, cobertura * mix(0.35, 0.95, uNubes));
  }

  salida = vec4(aSRGB(aces(color)), 1.0);
}`;

export const AGUA_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
layout(location = 2) in vec3 aCol;
layout(location = 3) in float aProfundidad;
layout(location = 4) in vec4 iM0;
layout(location = 5) in vec4 iM1;
layout(location = 6) in vec4 iM2;
layout(location = 7) in vec4 iM3;
layout(location = 8) in vec4 iColor;
layout(location = 9) in vec4 iExtra;
uniform mat4 uVistaProy;
uniform float uTiempo;
uniform float uAgitacion;
out vec3 vMundo;
out float vProf;
out vec2 vOla;

vec2 olas(vec3 p, float t) {
  // Dos trenes cruzados: suficiente para leer corriente sin gastar en fisica.
  float a = sin(p.x * 1.7 + t * 1.9) * 0.5 + sin(p.z * 2.3 - t * 1.4) * 0.5;
  float b = sin((p.x + p.z) * 3.1 + t * 2.7) * 0.35 + sin(p.z * 5.2 + t * 3.3) * 0.25;
  return vec2(a, b);
}

void main() {
  mat4 M = mat4(iM0, iM1, iM2, iM3);
  vec3 mundo = (M * vec4(aPos, 1.0)).xyz;
  vec2 o = olas(mundo, uTiempo);
  float amp = mix(0.012, 0.075, uAgitacion) * clamp(aProfundidad * 2.0, 0.15, 1.0);
  mundo.y += (o.x * 0.6 + o.y * 0.4) * amp;
  vMundo = mundo;
  vProf = aProfundidad;
  vOla = o;
  vec4 pos = uVistaProy * vec4(mundo, 1.0);
  pos.z = pos.z * 2.0 - pos.w;
  gl_Position = pos;
}`;

export const AGUA_FRAG = `#version 300 es
precision highp float;
in vec3 vMundo;
in float vProf;
in vec2 vOla;
uniform vec3 uCamPos;
uniform vec3 uDirSol;
uniform vec3 uColorSol;
uniform float uIntensidad;
uniform vec3 uCenit;
uniform vec3 uHorizonte;
uniform vec3 uNieblaColor;
uniform float uNieblaDensidad;
uniform float uNieblaAltura;
uniform float uTiempo;
uniform float uAgitacion;
out vec4 salida;
${COMUN}
${NIEBLA}

void main() {
  vec3 v = normalize(uCamPos - vMundo);
  // Normal analitica a partir de la derivada de las olas.
  float e = 0.35;
  float dx = cos(vMundo.x * 1.7 + uTiempo * 1.9) * 1.7 * 0.5
           + cos((vMundo.x + vMundo.z) * 3.1 + uTiempo * 2.7) * 3.1 * 0.35;
  float dz = cos(vMundo.z * 2.3 - uTiempo * 1.4) * 2.3 * 0.5
           + cos(vMundo.z * 5.2 + uTiempo * 3.3) * 5.2 * 0.25;
  float amp = mix(0.010, 0.055, uAgitacion);
  vec3 n = normalize(vec3(-dx * amp * e, 1.0, -dz * amp * e));

  float fresnel = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0);
  vec3 reflejo = mix(aLineal(uHorizonte), aLineal(uCenit), 0.55) * 1.15;
  vec3 hondo = mix(vec3(0.05, 0.13, 0.16), vec3(0.10, 0.24, 0.26), clamp(uIntensidad * 0.4, 0.0, 1.0));
  vec3 bajo = mix(vec3(0.22, 0.34, 0.28), vec3(0.42, 0.55, 0.44), clamp(uIntensidad * 0.4, 0.0, 1.0));
  vec3 agua = mix(bajo, hondo, smoothstep(0.05, 0.75, vProf));

  vec3 color = mix(agua, reflejo, clamp(fresnel * 0.9 + 0.06, 0.0, 1.0));

  // Reflejo especular del sol: el camino de luz sobre el rio.
  vec3 h = normalize(uDirSol + v);
  color += aLineal(uColorSol) * uIntensidad * pow(max(dot(n, h), 0.0), 240.0) * 2.6;

  // Espuma en la orilla y en las piedras.
  float espuma = smoothstep(0.13, 0.0, vProf) * (0.55 + 0.45 * sin(uTiempo * 3.0 + vMundo.x * 6.0 + vMundo.z * 5.0));
  color = mix(color, aLineal(vec3(0.92, 0.95, 0.95)), clamp(espuma, 0.0, 1.0) * 0.7);

  color = aplicarNiebla(color, vMundo, uCamPos, aLineal(uNieblaColor), uNieblaDensidad,
                        uNieblaAltura, uDirSol, aLineal(uColorSol));

  float alfa = clamp(0.62 + fresnel * 0.38 + espuma * 0.4 + vProf * 0.3, 0.0, 1.0);
  salida = vec4(aSRGB(aces(color)), alfa);
}`;
