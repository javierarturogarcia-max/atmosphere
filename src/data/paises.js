/**
 * paises.js — Intensidad de carbono de la red electrica y huella per capita.
 *
 * `red` : g CO2e por kWh generado (mix electrico nacional).
 *         Fuentes: Ember Electricity Data Explorer (2024); IEA Emissions Factors (2023).
 * `huella` : t CO2e por habitante y anio (emisiones territoriales, todos los gases).
 *         Fuentes: Global Carbon Budget 2024; EDGAR v8 (2023).
 * `objetivo2030` : t CO2e/hab compatibles con 1,5 C (UNEP Emissions Gap 2023: ~2,3).
 */
export const OBJETIVO_2030_TCO2E = 2.3;
export const MEDIA_MUNDIAL_TCO2E = 6.6;
export const RED_MUNDIAL_G_KWH = 473;

export const PAISES = Object.freeze([
  { cod: 'SV', nombre: 'El Salvador',     red: 191, huella: 1.3,  region: 'Centroamerica' },
  { cod: 'GT', nombre: 'Guatemala',       red: 331, huella: 1.2,  region: 'Centroamerica' },
  { cod: 'HN', nombre: 'Honduras',        red: 336, huella: 1.1,  region: 'Centroamerica' },
  { cod: 'NI', nombre: 'Nicaragua',       red: 296, huella: 0.9,  region: 'Centroamerica' },
  { cod: 'CR', nombre: 'Costa Rica',      red:  38, huella: 1.6,  region: 'Centroamerica' },
  { cod: 'PA', nombre: 'Panama',          red: 178, huella: 2.9,  region: 'Centroamerica' },
  { cod: 'MX', nombre: 'Mexico',          red: 423, huella: 3.6,  region: 'Norteamerica' },
  { cod: 'US', nombre: 'Estados Unidos',  red: 369, huella: 14.3, region: 'Norteamerica' },
  { cod: 'CA', nombre: 'Canada',          red: 121, huella: 14.2, region: 'Norteamerica' },
  { cod: 'CO', nombre: 'Colombia',        red: 205, huella: 2.0,  region: 'Sudamerica' },
  { cod: 'PE', nombre: 'Peru',            red: 247, huella: 1.9,  region: 'Sudamerica' },
  { cod: 'EC', nombre: 'Ecuador',         red: 175, huella: 2.4,  region: 'Sudamerica' },
  { cod: 'BR', nombre: 'Brasil',          red: 110, huella: 2.3,  region: 'Sudamerica' },
  { cod: 'AR', nombre: 'Argentina',       red: 329, huella: 4.1,  region: 'Sudamerica' },
  { cod: 'CL', nombre: 'Chile',           red: 331, huella: 4.6,  region: 'Sudamerica' },
  { cod: 'UY', nombre: 'Uruguay',         red:  76, huella: 2.1,  region: 'Sudamerica' },
  { cod: 'ES', nombre: 'Espana',          red: 148, huella: 5.2,  region: 'Europa' },
  { cod: 'FR', nombre: 'Francia',         red:  56, huella: 4.2,  region: 'Europa' },
  { cod: 'DE', nombre: 'Alemania',        red: 381, huella: 7.7,  region: 'Europa' },
  { cod: 'IT', nombre: 'Italia',          red: 297, huella: 5.4,  region: 'Europa' },
  { cod: 'PT', nombre: 'Portugal',        red: 125, huella: 4.0,  region: 'Europa' },
  { cod: 'GB', nombre: 'Reino Unido',     red: 207, huella: 4.7,  region: 'Europa' },
  { cod: 'NO', nombre: 'Noruega',         red:  29, huella: 7.0,  region: 'Europa' },
  { cod: 'SE', nombre: 'Suecia',          red:  41, huella: 3.6,  region: 'Europa' },
  { cod: 'PL', nombre: 'Polonia',         red: 662, huella: 7.6,  region: 'Europa' },
  { cod: 'CN', nombre: 'China',           red: 582, huella: 8.4,  region: 'Asia' },
  { cod: 'IN', nombre: 'India',           red: 713, huella: 2.0,  region: 'Asia' },
  { cod: 'JP', nombre: 'Japon',           red: 494, huella: 8.5,  region: 'Asia' },
  { cod: 'KR', nombre: 'Corea del Sur',   red: 437, huella: 11.6, region: 'Asia' },
  { cod: 'ID', nombre: 'Indonesia',       red: 679, huella: 2.6,  region: 'Asia' },
  { cod: 'AU', nombre: 'Australia',       red: 549, huella: 14.9, region: 'Oceania' },
  { cod: 'NZ', nombre: 'Nueva Zelanda',   red: 106, huella: 6.3,  region: 'Oceania' },
  { cod: 'ZA', nombre: 'Sudafrica',       red: 707, huella: 6.7,  region: 'Africa' },
  { cod: 'NG', nombre: 'Nigeria',         red: 391, huella: 0.6,  region: 'Africa' },
  { cod: 'MA', nombre: 'Marruecos',       red: 610, huella: 1.9,  region: 'Africa' },
  { cod: 'KE', nombre: 'Kenia',           red:  91, huella: 0.4,  region: 'Africa' },
  { cod: 'EG', nombre: 'Egipto',          red: 450, huella: 2.4,  region: 'Africa' },
  { cod: 'WW', nombre: 'Media mundial',   red: RED_MUNDIAL_G_KWH, huella: MEDIA_MUNDIAL_TCO2E, region: 'Global' },
]);

const INDICE = new Map(PAISES.map((p) => [p.cod, p]));

/** Devuelve el registro de un pais por codigo ISO-2; cae en la media mundial. */
export function pais(cod) {
  return INDICE.get(String(cod || '').toUpperCase()) || INDICE.get('WW');
}

/** Intensidad de la red en kg CO2e/kWh para un pais. */
export function intensidadRed(cod) {
  return pais(cod).red / 1000;
}

/** Paises ordenados alfabeticamente para desplegables. */
export function paisesOrdenados() {
  return [...PAISES].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
