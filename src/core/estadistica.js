/**
 * estadistica.js — Caja de herramientas estadistica sin dependencias.
 *
 * Todo lo que la app afirma sobre "tendencias" y "proyecciones" sale de aqui.
 * Se prefieren estimadores ROBUSTOS (mediana, Theil-Sen, Mann-Kendall) porque
 * las series de conducta humana tienen valores atipicos y no son normales.
 */

// --------------------------------------------------------------- descriptivos
export function suma(xs) { return xs.reduce((a, b) => a + b, 0); }

export function media(xs) { return xs.length ? suma(xs) / xs.length : 0; }

export function mediana(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Varianza muestral (n-1, insesgada). */
export function varianza(xs) {
  if (xs.length < 2) return 0;
  const m = media(xs);
  return suma(xs.map((x) => (x - m) ** 2)) / (xs.length - 1);
}

export function desviacion(xs) { return Math.sqrt(varianza(xs)); }

/** Coeficiente de variacion: dispersion relativa, util para comparar categorias. */
export function coefVariacion(xs) {
  const m = media(xs);
  return m === 0 ? 0 : desviacion(xs) / m;
}

/** Percentil por interpolacion lineal (metodo R-7, el de Excel y NumPy). */
export function percentil(xs, p) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (s.length - 1) * Math.min(Math.max(p, 0), 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/** Rango percentil de un valor dentro de una muestra, en 0..100. */
export function rangoPercentil(xs, valor) {
  if (!xs.length) return 50;
  const menores = xs.filter((x) => x < valor).length;
  const iguales = xs.filter((x) => x === valor).length;
  return ((menores + 0.5 * iguales) / xs.length) * 100;
}

/** Rango intercuartilico y limites de Tukey para deteccion de atipicos. */
export function tukey(xs, k = 1.5) {
  const q1 = percentil(xs, 0.25), q3 = percentil(xs, 0.75);
  const iqr = q3 - q1;
  return { q1, q3, iqr, inferior: q1 - k * iqr, superior: q3 + k * iqr };
}

export function atipicos(xs, k = 1.5) {
  const { inferior, superior } = tukey(xs, k);
  return xs.filter((x) => x < inferior || x > superior);
}

/** Puntuacion z clasica. */
export function z(valor, xs) {
  const d = desviacion(xs);
  return d === 0 ? 0 : (valor - media(xs)) / d;
}

/**
 * Z robusta (MAD): resiste atipicos, ideal para detectar registros fraudulentos.
 * Cuando la MAD es cero (historial constante, muy comun en habitos regulares)
 * degrada a la desviacion absoluta media, segun Iglewicz & Hoaglin (1993).
 * Si toda la serie es identica, cualquier valor distinto es maximamente atipico.
 */
export function zRobusta(valor, xs) {
  if (!xs.length) return 0;
  const med = mediana(xs);
  const mad = mediana(xs.map((x) => Math.abs(x - med)));
  if (mad > 0) return (0.6745 * (valor - med)) / mad; // 0.6745 = phi^-1(0.75)
  const meanAD = media(xs.map((x) => Math.abs(x - med)));
  if (meanAD > 0) return (valor - med) / (1.253314 * meanAD);
  return valor === med ? 0 : Math.sign(valor - med) * 10;
}

// -------------------------------------------------------------------- suavizado
/** Media movil simple de ventana n. */
export function mediaMovil(xs, ventana = 7) {
  if (ventana <= 1) return [...xs];
  return xs.map((_, i) => {
    const ini = Math.max(0, i - ventana + 1);
    return media(xs.slice(ini, i + 1));
  });
}

/** Suavizado exponencial (EWMA). alfa alto = mas reactivo. */
export function ewma(xs, alfa = 0.3) {
  const salida = [];
  let s = xs[0] ?? 0;
  for (const x of xs) { s = alfa * x + (1 - alfa) * s; salida.push(s); }
  return salida;
}

// ------------------------------------------------------------------- regresion
/** Minimos cuadrados ordinarios y = a + b*x, con R2 y error tipico de b. */
export function regresionLineal(ys, xs = null) {
  const n = ys.length;
  if (n < 2) return { pendiente: 0, intercepto: ys[0] ?? 0, r2: 0, ee: 0, n };
  const X = xs || ys.map((_, i) => i);
  const mx = media(X), my = media(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (X[i] - mx) * (ys[i] - my); sxx += (X[i] - mx) ** 2; }
  const pendiente = sxx === 0 ? 0 : sxy / sxx;
  const intercepto = my - pendiente * mx;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercepto + pendiente * X[i];
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  const r2 = ssTot === 0 ? (ssRes === 0 ? 1 : 0) : 1 - ssRes / ssTot;
  const ee = n > 2 && sxx > 0 ? Math.sqrt(ssRes / (n - 2) / sxx) : 0;
  return { pendiente, intercepto, r2, ee, n, predecir: (x) => intercepto + pendiente * x };
}

/**
 * Estimador de pendiente de Theil-Sen: mediana de las pendientes por pares.
 * Punto de ruptura del 29 %: aguanta atipicos que destrozan a OLS.
 */
export function theilSen(ys, xs = null) {
  const n = ys.length;
  if (n < 2) return 0;
  const X = xs || ys.map((_, i) => i);
  const pendientes = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = X[j] - X[i];
      if (dx !== 0) pendientes.push((ys[j] - ys[i]) / dx);
    }
  }
  return mediana(pendientes);
}

// ------------------------------------------------------------ test de tendencia
/** Funcion de distribucion normal acumulada (Abramowitz & Stegun 26.2.17). */
export function normalAcumulada(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  let p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 +
          t * (-1.821255978 + t * 1.330274429))));
  p = 1 - p;
  return x >= 0 ? p : 1 - p;
}

/**
 * Test de Mann-Kendall: detecta tendencia monotona sin asumir normalidad.
 * Es el estandar en series ambientales (hidrologia, calidad del aire).
 * Devuelve S, tau de Kendall, Z y p bilateral.
 */
export function mannKendall(ys) {
  const n = ys.length;
  if (n < 4) return { S: 0, tau: 0, Z: 0, p: 1, tendencia: 'insuficiente', n };
  let S = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) S += Math.sign(ys[j] - ys[i]);
  }
  // Correccion por empates
  const conteos = new Map();
  for (const y of ys) conteos.set(y, (conteos.get(y) || 0) + 1);
  let ajuste = 0;
  for (const t of conteos.values()) if (t > 1) ajuste += t * (t - 1) * (2 * t + 5);
  const varS = (n * (n - 1) * (2 * n + 5) - ajuste) / 18;
  const Z = varS <= 0 ? 0 : (S > 0 ? (S - 1) : S < 0 ? (S + 1) : 0) / Math.sqrt(varS);
  const p = 2 * (1 - normalAcumulada(Math.abs(Z)));
  const tau = (2 * S) / (n * (n - 1));
  let tendencia = 'sin tendencia significativa';
  if (p < 0.05) tendencia = S > 0 ? 'creciente significativa' : 'decreciente significativa';
  else if (p < 0.10) tendencia = S > 0 ? 'creciente debil' : 'decreciente debil';
  return { S, tau, Z, p, tendencia, n };
}

// ------------------------------------------------------------------- intervalos
/**
 * Intervalo de confianza por bootstrap percentil.
 * No asume distribucion: se remuestrea con reposicion B veces.
 */
export function bootstrapIC(xs, estadistico = media, B = 1000, nivel = 0.95, rnd = Math.random) {
  if (xs.length < 2) return { inferior: xs[0] ?? 0, superior: xs[0] ?? 0, estimacion: xs[0] ?? 0 };
  const reps = [];
  for (let b = 0; b < B; b++) {
    const m = new Array(xs.length);
    for (let i = 0; i < xs.length; i++) m[i] = xs[Math.floor(rnd() * xs.length)];
    reps.push(estadistico(m));
  }
  const alfa = (1 - nivel) / 2;
  return {
    estimacion: estadistico(xs),
    inferior: percentil(reps, alfa),
    superior: percentil(reps, 1 - alfa),
    nivel,
  };
}

/**
 * Propagacion de incertidumbre para una suma de terminos independientes:
 * sigma_total = sqrt(sum(sigma_i^2)) (ley de propagacion de errores).
 */
export function propagarIncertidumbre(terminos) {
  const total = suma(terminos.map((t) => t.valor));
  const varTotal = suma(terminos.map((t) => (t.valor * t.inc) ** 2));
  const sigma = Math.sqrt(varTotal);
  return {
    valor: total,
    sigma,
    inferior: Math.max(0, total - 1.96 * sigma),
    superior: total + 1.96 * sigma,
    incRelativa: total === 0 ? 0 : sigma / total,
  };
}

// --------------------------------------------------------------------- indices
/** Correlacion de Pearson entre dos series de igual longitud. */
export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = media(xs.slice(0, n)), my = media(ys.slice(0, n));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

/**
 * Indice de Shannon: mide la diversidad de las acciones registradas.
 * H alto = conducta ecologica variada; H bajo = una sola palanca.
 */
export function shannon(conteos) {
  const total = suma(conteos);
  if (total <= 0) return 0;
  const h = -suma(conteos.filter((c) => c > 0).map((c) => {
    const p = c / total;
    return p * Math.log(p);
  }));
  return h + 0; // normaliza el -0 que produce el negado de una suma nula
}

/** Equidad de Pielou: H normalizado a 0..1 por el numero de categorias. */
export function pielou(conteos) {
  const usadas = conteos.filter((c) => c > 0).length;
  if (usadas < 2) return 0;
  return shannon(conteos) / Math.log(usadas);
}

/** Coeficiente de Gini: desigualdad de la distribucion (0 = igual, 1 = maxima). */
export function gini(xs) {
  const s = [...xs].filter((x) => x >= 0).sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  const total = suma(s);
  if (total === 0) return 0;
  let acum = 0;
  for (let i = 0; i < n; i++) acum += (2 * (i + 1) - n - 1) * s[i];
  return acum / (n * total);
}

/** Redondeo a d decimales evitando errores de coma flotante. */
export function redondear(x, d = 2) {
  const f = 10 ** d;
  return Math.round((x + Number.EPSILON) * f) / f;
}
