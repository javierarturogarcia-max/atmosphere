/**
 * factores.js — Base cientifica de factores de impacto ambiental.
 *
 * Todos los valores son de referencia, con fuente y anio indicados.
 * Unidades:
 *   - CO2e: kg de dioxido de carbono equivalente (GWP-100, IPCC AR6)
 *   - agua: litros
 *   - residuo: kg
 *   - energia: kWh
 *
 * ADVERTENCIA METODOLOGICA: los factores son promedios globales o regionales.
 * La incertidumbre tipica de un analisis de ciclo de vida (ACV) es de +/- 20-50 %.
 * Cada factor incluye su banda de incertidumbre relativa (`inc`) para poder
 * propagarla en los calculos (ver core/estadistica.js -> propagarIncertidumbre).
 */

/** Potenciales de calentamiento global a 100 anios. Fuente: IPCC AR6 WG1 Cap.7 (2021). */
export const GWP100 = Object.freeze({
  CO2: 1,
  CH4_fosil: 29.8,
  CH4_biogenico: 27.0,
  N2O: 273,
  HFC134a: 1530,
  SF6: 25200,
});

/**
 * Factores de movilidad en kg CO2e por pasajero-kilometro (pkm).
 * Fuentes: UK DEFRA/BEIS GHG Conversion Factors 2023; EEA TERM;
 * EPA Emission Factors for GHG Inventories (2023).
 */
export const MOVILIDAD = Object.freeze({
  caminar:            { co2e: 0.000, inc: 0.00, etiqueta: 'Caminar' },
  bicicleta:          { co2e: 0.000, inc: 0.00, etiqueta: 'Bicicleta' },
  bici_electrica:     { co2e: 0.005, inc: 0.40, etiqueta: 'Bicicleta electrica' },
  patinete_electrico: { co2e: 0.021, inc: 0.45, etiqueta: 'Patinete electrico' },
  metro:              { co2e: 0.033, inc: 0.30, etiqueta: 'Metro / tren urbano' },
  tren_regional:      { co2e: 0.041, inc: 0.30, etiqueta: 'Tren regional' },
  autobus_urbano:     { co2e: 0.102, inc: 0.25, etiqueta: 'Autobus urbano' },
  autobus_electrico:  { co2e: 0.045, inc: 0.35, etiqueta: 'Autobus electrico' },
  coche_electrico:    { co2e: 0.053, inc: 0.40, etiqueta: 'Coche electrico (mix medio)' },
  coche_hibrido:      { co2e: 0.110, inc: 0.25, etiqueta: 'Coche hibrido' },
  coche_gasolina:     { co2e: 0.171, inc: 0.20, etiqueta: 'Coche gasolina' },
  coche_diesel:       { co2e: 0.168, inc: 0.20, etiqueta: 'Coche diesel' },
  coche_compartido:   { co2e: 0.061, inc: 0.30, etiqueta: 'Coche compartido (2.8 ocup.)' },
  motocicleta:        { co2e: 0.114, inc: 0.25, etiqueta: 'Motocicleta' },
  taxi:               { co2e: 0.212, inc: 0.25, etiqueta: 'Taxi / VTC' },
  avion_corto:        { co2e: 0.246, inc: 0.30, etiqueta: 'Avion < 1500 km' },
  avion_medio:        { co2e: 0.156, inc: 0.30, etiqueta: 'Avion 1500-3700 km' },
  avion_largo:        { co2e: 0.150, inc: 0.30, etiqueta: 'Avion > 3700 km' },
});

/**
 * Factor de forzamiento radiativo no-CO2 de la aviacion (estelas, NOx, cirros).
 * Lee et al. (2021), Atmospheric Environment: multiplicador efectivo ~1.7-3.0.
 */
export const RFI_AVIACION = 1.9;

/**
 * Alimentacion: kg CO2e y litros de agua por kg de alimento consumido.
 * Fuentes: Poore & Nemecek (2018) Science 360:987-992 (mediana global de ACV,
 * n=38.700 granjas); Mekonnen & Hoekstra (2011) huella hidrica.
 */
export const ALIMENTOS = Object.freeze({
  carne_res:     { co2e: 99.5, agua: 15415, inc: 0.45, etiqueta: 'Carne de res' },
  cordero:       { co2e: 39.7, agua: 10412, inc: 0.40, etiqueta: 'Cordero' },
  camaron:       { co2e: 26.9, agua:  4000, inc: 0.50, etiqueta: 'Camaron de acuicultura' },
  queso:         { co2e: 23.9, agua:  5060, inc: 0.35, etiqueta: 'Queso' },
  chocolate:     { co2e: 18.7, agua: 17196, inc: 0.45, etiqueta: 'Chocolate' },
  cafe:          { co2e: 16.5, agua: 15897, inc: 0.45, etiqueta: 'Cafe (grano)' },
  cerdo:         { co2e: 12.3, agua:  5988, inc: 0.30, etiqueta: 'Cerdo' },
  pescado_acui:  { co2e: 13.6, agua:  3000, inc: 0.45, etiqueta: 'Pescado de acuicultura' },
  pollo:         { co2e:  9.9, agua:  4325, inc: 0.30, etiqueta: 'Pollo' },
  huevos:        { co2e:  4.7, agua:  3265, inc: 0.30, etiqueta: 'Huevos' },
  arroz:         { co2e:  4.5, agua:  2497, inc: 0.35, etiqueta: 'Arroz' },
  leche:         { co2e:  3.2, agua:  1020, inc: 0.30, etiqueta: 'Leche' },
  tofu:          { co2e:  3.2, agua:  2523, inc: 0.35, etiqueta: 'Tofu' },
  pan:           { co2e:  1.6, agua:  1608, inc: 0.30, etiqueta: 'Pan / trigo' },
  frutas:        { co2e:  1.1, agua:   962, inc: 0.35, etiqueta: 'Fruta' },
  legumbres:     { co2e:  0.9, agua:  4055, inc: 0.35, etiqueta: 'Legumbres' },
  verduras:      { co2e:  0.5, agua:   322, inc: 0.35, etiqueta: 'Verdura' },
  frutos_secos:  { co2e:  0.4, agua:  9063, inc: 0.40, etiqueta: 'Frutos secos' },
});

/**
 * Dietas: kg CO2e por dia (solo alimentacion), poblacion adulta 2000 kcal.
 * Fuente: Scarborough et al. (2023) Nature Food 4:565-574 (EPIC-Oxford, 55.504 personas).
 */
export const DIETAS = Object.freeze({
  alta_carne:   { co2e_dia: 10.24, etiqueta: 'Alta en carne (>100 g/dia)' },
  media_carne:  { co2e_dia:  7.25, etiqueta: 'Media en carne (50-100 g/dia)' },
  baja_carne:   { co2e_dia:  5.37, etiqueta: 'Baja en carne (<50 g/dia)' },
  pescetariana: { co2e_dia:  3.91, etiqueta: 'Pescetariana' },
  vegetariana:  { co2e_dia:  3.81, etiqueta: 'Vegetariana' },
  vegana:       { co2e_dia:  2.47, etiqueta: 'Vegana' },
});

/**
 * Residuos: kg CO2e evitados por kg de material reciclado o compostado
 * frente al escenario base (vertedero + produccion virgen).
 * Fuente: US EPA WARM v15 (2023); Eunomia (2021).
 */
export const RESIDUOS = Object.freeze({
  aluminio: { co2e_evitado:  8.90, inc: 0.25, etiqueta: 'Aluminio' },
  plastico: { co2e_evitado:  1.80, inc: 0.35, etiqueta: 'Plastico PET/HDPE' },
  papel:    { co2e_evitado:  0.90, inc: 0.30, etiqueta: 'Papel y carton' },
  vidrio:   { co2e_evitado:  0.31, inc: 0.30, etiqueta: 'Vidrio' },
  organico: { co2e_evitado:  0.55, inc: 0.40, etiqueta: 'Organico (compostaje)' },
  textil:   { co2e_evitado:  3.40, inc: 0.45, etiqueta: 'Textil' },
  raee:     { co2e_evitado: 12.00, inc: 0.50, etiqueta: 'Electronicos (RAEE)' },
  aceite:   { co2e_evitado:  2.40, inc: 0.45, etiqueta: 'Aceite usado' },
});

/**
 * Agua: litros por unidad de uso domestico.
 * Fuentes: EPA WaterSense (2023); AEAS (2022).
 */
export const AGUA = Object.freeze({
  ducha_min:          { litros: 9.5,  etiqueta: 'Minuto de ducha' },
  ducha_eficiente_min:{ litros: 6.0,  etiqueta: 'Minuto de ducha eficiente' },
  bano_completo:      { litros: 150,  etiqueta: 'Banera llena' },
  inodoro_descarga:   { litros: 6.0,  etiqueta: 'Descarga de inodoro' },
  grifo_min:          { litros: 8.0,  etiqueta: 'Minuto de grifo abierto' },
  lavadora_ciclo:     { litros: 50,   etiqueta: 'Ciclo de lavadora' },
  lavavajillas_ciclo: { litros: 12,   etiqueta: 'Ciclo de lavavajillas' },
  lavado_mano_platos: { litros: 40,   etiqueta: 'Lavar platos a mano' },
  riego_jardin_min:   { litros: 15,   etiqueta: 'Minuto de riego' },
});

/**
 * Energia calorifica de agua caliente: kWh por litro calentado 25 K.
 * c = 4.186 kJ/(kg.K) -> 4.186*25/3600 = 0.0291 kWh/L (rendimiento 0.85 -> 0.0342).
 */
export const KWH_POR_LITRO_CALIENTE = 0.0342;

/**
 * Consumo electrico tipico de equipos, en kWh por hora de uso.
 * Fuentes: IEA 4E EDNA (2022); ADEME (2023).
 */
export const APARATOS = Object.freeze({
  bombilla_incandescente: { kwh_h: 0.060, etiqueta: 'Bombilla incandescente 60 W' },
  bombilla_led:           { kwh_h: 0.009, etiqueta: 'Bombilla LED 9 W' },
  aire_acondicionado:     { kwh_h: 1.400, etiqueta: 'Aire acondicionado 1.4 kW' },
  calefactor_electrico:   { kwh_h: 1.800, etiqueta: 'Calefactor electrico' },
  nevera:                 { kwh_h: 0.045, etiqueta: 'Frigorifico A++' },
  lavadora:               { kwh_h: 0.700, etiqueta: 'Lavadora (ciclo 60 C)' },
  secadora:               { kwh_h: 2.500, etiqueta: 'Secadora' },
  portatil:               { kwh_h: 0.050, etiqueta: 'Portatil' },
  television:             { kwh_h: 0.100, etiqueta: 'Television LED 50"' },
  standby_hogar:          { kwh_h: 0.045, etiqueta: 'Consumo fantasma del hogar' },
  streaming_hd_h:         { kwh_h: 0.077, etiqueta: 'Streaming HD (1 h)' },
});

/**
 * Productos y consumo: kg CO2e por unidad completa (ciclo de vida).
 * Fuentes: Quantis (2018) Measuring Fashion; Apple/Dell product reports (2023);
 * Ellen MacArthur Foundation (2017).
 */
export const PRODUCTOS = Object.freeze({
  camiseta_algodon:  { co2e:  7.0, agua: 2700, etiqueta: 'Camiseta de algodon' },
  pantalon_vaquero:  { co2e: 33.4, agua: 7500, etiqueta: 'Pantalon vaquero' },
  zapatillas:        { co2e: 14.0, agua: 4400, etiqueta: 'Par de zapatillas' },
  smartphone:        { co2e: 62.0, agua: 3200, etiqueta: 'Smartphone' },
  portatil_fab:      { co2e: 331.0, agua: 9000, etiqueta: 'Portatil (fabricacion)' },
  botella_plastico:  { co2e:  0.083, agua: 3.0, etiqueta: 'Botella PET 500 ml' },
  bolsa_plastico:    { co2e:  0.033, agua: 1.0, etiqueta: 'Bolsa de plastico' },
  vaso_desechable:   { co2e:  0.055, agua: 0.7, etiqueta: 'Vaso desechable' },
  libro_papel:       { co2e:  1.20, agua: 20.0, etiqueta: 'Libro impreso' },
});

/**
 * Sumideros y equivalencias de referencia.
 * Fuentes: EPA GHG Equivalencies Calculator (2024); Bastin et al. (2019) Science.
 */
export const SUMIDEROS = Object.freeze({
  /** kg CO2 secuestrados por un arbol urbano maduro y sano en un anio. */
  arbol_anio: 21.77,
  /** kg CO2 acumulados por un arbol en 40 anios (crecimiento no lineal). */
  arbol_40anios: 725,
  /** kg CO2 por hectarea de bosque templado y anio. */
  hectarea_bosque_anio: 8200,
  /** kg CO2 por m2 de pradera marina (Posidonia) y anio: sumidero azul. */
  pradera_marina_m2_anio: 0.83,
});

/** Equivalencias didacticas: kg CO2e por unidad. Fuente: EPA (2024). */
export const EQUIVALENCIAS = Object.freeze({
  km_coche_gasolina: 0.171,
  carga_movil:       0.0039,
  bombilla_led_dia:  0.0031,
  botella_plastico:  0.083,
  hamburguesa_res:   6.30,
  ducha_10min:       1.05,
});

/** Devuelve el factor de movilidad aplicando el RFI aeronautico cuando corresponde. */
export function factorMovilidad(modo, { conRFI = true } = {}) {
  const f = MOVILIDAD[modo];
  if (!f) return null;
  const esAvion = modo.startsWith('avion');
  const co2e = esAvion && conRFI ? f.co2e * RFI_AVIACION : f.co2e;
  return { ...f, co2e, rfiAplicado: esAvion && conRFI };
}

/** Indice para busquedas: todas las tablas de factores por clave. */
export const TABLAS = Object.freeze({
  movilidad: MOVILIDAD,
  alimentos: ALIMENTOS,
  residuos: RESIDUOS,
  agua: AGUA,
  aparatos: APARATOS,
  productos: PRODUCTOS,
});
