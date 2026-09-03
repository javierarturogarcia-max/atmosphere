/**
 * objetos.js — Todo lo que el nino puede llevar encima.
 *
 * Cada objeto declara su peso (la carga es un limite real: un cantaro lleno
 * pesa), lo que alimenta, lo que quita la sed y lo que anima. Para anadir un
 * objeto nuevo basta con escribir una linea aqui; el inventario, la cocina y
 * las misiones lo recogen solos.
 *
 * tipo: recurso | comida | crudo | semilla | herramienta | material
 */
export const OBJETOS = {
  // --------------------------------------------------------------- recursos
  agua:        { nombre: 'Agua', icono: '💧', tipo: 'recurso', peso: 1, unidad: 'L', valor: 0, sed: 22, descripcion: 'Del río. En la casa no hay tubería: cada litro se carga.' },
  lena:        { nombre: 'Leña', icono: '🪵', tipo: 'recurso', peso: 1.5, valor: 2, descripcion: 'Rajas secas para el fogón. Sin leña no se cocina.' },
  tronco:      { nombre: 'Tronco', icono: '🪵', tipo: 'recurso', peso: 6, valor: 4, descripcion: 'Pesado. Con el machete salen tres rajas de leña.' },
  ocote:       { nombre: 'Ocote', icono: '🔥', tipo: 'recurso', peso: 0.4, valor: 3, descripcion: 'Astilla de pino resinosa: prende el fuego aunque llueva.' },
  piedra:      { nombre: 'Piedra', icono: '🪨', tipo: 'material', peso: 0.6, valor: 0, descripcion: 'Munición para la hondilla.' },
  fibra:       { nombre: 'Fibra', icono: '🌾', tipo: 'material', peso: 0.1, valor: 1, descripcion: 'De maguey. Se tuerce para hacer pita.' },
  pita:        { nombre: 'Pita', icono: '🧵', tipo: 'material', peso: 0.15, valor: 3, descripcion: 'Cordel. Sirve para la caña, la atarraya y las trampas.' },
  barro:       { nombre: 'Barro', icono: '🟤', tipo: 'material', peso: 2, valor: 1, descripcion: 'De la orilla. Con él se hacen cántaros y comales.' },
  sal:         { nombre: 'Sal', icono: '🧂', tipo: 'material', peso: 0.2, valor: 4, descripcion: 'Conserva la carne y hace comible lo insípido.' },

  // ----------------------------------------------------------------- crudos
  maiz:        { nombre: 'Maíz', icono: '🌽', tipo: 'crudo', peso: 0.5, valor: 6, hambre: 8, descripcion: 'La base de todo: tortilla, atole, elote.' },
  frijol:      { nombre: 'Frijol', icono: '🫘', tipo: 'crudo', peso: 0.4, valor: 7, hambre: 6, descripcion: 'Con maíz hace comida completa. Hay que cocerlo.' },
  arroz:       { nombre: 'Arroz', icono: '🍚', tipo: 'crudo', peso: 0.4, valor: 7, hambre: 7, descripcion: 'Pide agua y paciencia, pero rinde.' },
  trigo:       { nombre: 'Trigo', icono: '🌾', tipo: 'crudo', peso: 0.4, valor: 8, hambre: 6, descripcion: 'Se muele para pan. Poco común por aquí.' },
  ayote:       { nombre: 'Ayote', icono: '🎃', tipo: 'crudo', peso: 2.2, valor: 6, hambre: 12, descripcion: 'Crece entre la milpa sin pedir nada.' },
  yuca:        { nombre: 'Yuca', icono: '🥔', tipo: 'crudo', peso: 1.2, valor: 5, hambre: 14, descripcion: 'Raíz dura. Cruda no; cocida llena mucho.' },
  tomate:      { nombre: 'Tomate', icono: '🍅', tipo: 'comida', peso: 0.2, valor: 4, hambre: 5, sed: 4, animo: 2 },
  chile:       { nombre: 'Chile', icono: '🌶️', tipo: 'comida', peso: 0.1, valor: 3, hambre: 1, animo: 4, descripcion: 'Da sabor a lo que sea.' },
  hierbas:     { nombre: 'Hierbas', icono: '🌿', tipo: 'comida', peso: 0.1, valor: 3, hambre: 3, salud: 8, descripcion: 'Chipilín, mora, hierbabuena. Para la olla y para la fiebre.' },
  hongos:      { nombre: 'Hongos', icono: '🍄', tipo: 'crudo', peso: 0.2, valor: 6, hambre: 7, descripcion: 'Salen dos días después de la lluvia, al pie de los pinos.' },
  miel:        { nombre: 'Miel', icono: '🍯', tipo: 'comida', peso: 0.5, valor: 14, hambre: 10, animo: 12, descripcion: 'Sacarla cuesta piquetes.' },
  huevo:       { nombre: 'Huevo', icono: '🥚', tipo: 'crudo', peso: 0.15, valor: 4, hambre: 6, descripcion: 'De las gallinas del patio, si les diste de comer.' },
  mango:       { nombre: 'Mango', icono: '🥭', tipo: 'comida', peso: 0.35, valor: 4, hambre: 9, sed: 6, animo: 6 },
  jocote:      { nombre: 'Jocote', icono: '🍒', tipo: 'comida', peso: 0.1, valor: 3, hambre: 4, sed: 3, animo: 5 },
  mora:        { nombre: 'Mora', icono: '🫐', tipo: 'comida', peso: 0.08, valor: 3, hambre: 3, sed: 3, animo: 6 },
  guayaba:     { nombre: 'Guayaba', icono: '🍐', tipo: 'comida', peso: 0.2, valor: 4, hambre: 6, sed: 5, animo: 4 },
  pescado:     { nombre: 'Pescado', icono: '🐟', tipo: 'crudo', peso: 0.6, valor: 12, hambre: 10, descripcion: 'Del río. Crudo no se come.' },
  carne_venado: { nombre: 'Carne de venado', icono: '🥩', tipo: 'crudo', peso: 1.4, valor: 22, hambre: 16 },
  carne_conejo: { nombre: 'Carne de conejo', icono: '🍖', tipo: 'crudo', peso: 0.7, valor: 12, hambre: 11 },
  carne_pajaro: { nombre: 'Carne de pájaro', icono: '🍗', tipo: 'crudo', peso: 0.3, valor: 7, hambre: 7 },
  cuero:       { nombre: 'Cuero', icono: '🟫', tipo: 'material', peso: 1.2, valor: 16, descripcion: 'Del venado. Se cambia bien en el pueblo.' },

  // ---------------------------------------------------------------- cocinado
  tortilla:    { nombre: 'Tortillas', icono: '🫓', tipo: 'comida', peso: 0.3, valor: 10, hambre: 22, animo: 6, descripcion: 'Recién salidas del comal. Con esto se aguanta el día.' },
  frijoles:    { nombre: 'Frijoles cocidos', icono: '🥣', tipo: 'comida', peso: 0.5, valor: 12, hambre: 24, animo: 5 },
  arroz_cocido: { nombre: 'Arroz cocido', icono: '🍚', tipo: 'comida', peso: 0.5, valor: 12, hambre: 22, animo: 4 },
  pan:         { nombre: 'Pan', icono: '🍞', tipo: 'comida', peso: 0.3, valor: 15, hambre: 20, animo: 10 },
  atole:       { nombre: 'Atole', icono: '🥤', tipo: 'comida', peso: 0.6, valor: 9, hambre: 14, sed: 16, animo: 10, descripcion: 'De maíz, caliente. Sabe a casa.' },
  pescado_asado: { nombre: 'Pescado asado', icono: '🐠', tipo: 'comida', peso: 0.5, valor: 18, hambre: 26, animo: 8 },
  carne_asada: { nombre: 'Carne asada', icono: '🍖', tipo: 'comida', peso: 0.8, valor: 26, hambre: 34, animo: 12 },
  sopa:        { nombre: 'Sopa', icono: '🍲', tipo: 'comida', peso: 0.9, valor: 16, hambre: 26, sed: 12, animo: 10, salud: 12 },
  elote_asado: { nombre: 'Elote asado', icono: '🌽', tipo: 'comida', peso: 0.3, valor: 8, hambre: 15, animo: 9 },
  pupusa:      { nombre: 'Pupusas', icono: '🥟', tipo: 'comida', peso: 0.4, valor: 20, hambre: 32, animo: 18, descripcion: 'Día de fiesta.' },

  // ---------------------------------------------------------------- semillas
  semilla_maiz:   { nombre: 'Semilla de maíz', icono: '🌱', tipo: 'semilla', peso: 0.05, valor: 3, cultivo: 'maiz' },
  semilla_frijol: { nombre: 'Semilla de frijol', icono: '🌱', tipo: 'semilla', peso: 0.05, valor: 3, cultivo: 'frijol' },
  semilla_arroz:  { nombre: 'Semilla de arroz', icono: '🌱', tipo: 'semilla', peso: 0.05, valor: 4, cultivo: 'arroz' },
  semilla_trigo:  { nombre: 'Semilla de trigo', icono: '🌱', tipo: 'semilla', peso: 0.05, valor: 4, cultivo: 'trigo' },

  // ------------------------------------------------------------ herramientas
  hondilla:    { nombre: 'Hondilla', icono: '🪁', tipo: 'herramienta', peso: 0.2, valor: 8, unica: true, descripcion: 'Dos tiras de hule y una badana. Con puntería, cena.' },
  cana:        { nombre: 'Caña de pescar', icono: '🎣', tipo: 'herramienta', peso: 0.6, valor: 12, unica: true },
  atarraya:    { nombre: 'Atarraya', icono: '🕸️', tipo: 'herramienta', peso: 1.8, valor: 30, unica: true, descripcion: 'Red de tirar. Saca varios de una vez, pero cansa.' },
  machete:     { nombre: 'Machete', icono: '🔪', tipo: 'herramienta', peso: 1.1, valor: 18, unica: true },
  azadon:      { nombre: 'Azadón', icono: '⛏️', tipo: 'herramienta', peso: 1.6, valor: 16, unica: true },
  cantaro:     { nombre: 'Cántaro', icono: '🏺', tipo: 'herramienta', peso: 1.5, valor: 10, unica: true, capacidadAgua: 10, descripcion: 'De barro. Aguanta diez litros del río.' },
  canasta:     { nombre: 'Canasta', icono: '🧺', tipo: 'herramienta', peso: 0.8, valor: 9, unica: true, cargaExtra: 12, descripcion: 'Al hombro caben doce kilos más.' },
  trampa:      { nombre: 'Trampa', icono: '🪤', tipo: 'herramienta', peso: 0.9, valor: 14, descripcion: 'Se deja puesta y se revisa al otro día.' },
  candil:      { nombre: 'Candil', icono: '🕯️', tipo: 'herramienta', peso: 0.4, valor: 12, unica: true, descripcion: 'No hay luz eléctrica: de noche, o candil o luna.' },
};

export function objeto(id) { return OBJETOS[id] || null; }
export function nombreObjeto(id) { return OBJETOS[id]?.nombre || id; }
export function iconoObjeto(id) { return OBJETOS[id]?.icono || '📦'; }
export function pesoObjeto(id) { return OBJETOS[id]?.peso ?? 0.2; }
export function esComida(id) { const o = OBJETOS[id]; return !!o && (o.hambre > 0 || o.sed > 0) && o.tipo !== 'crudo'; }
export function valorObjeto(id) { return OBJETOS[id]?.valor ?? 0; }
export const IDS_OBJETOS = Object.keys(OBJETOS);
