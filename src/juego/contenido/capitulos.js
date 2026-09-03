/**
 * capitulos.js — La historia, por capitulos.
 *
 * ESTE ES EL ARCHIVO QUE HAY QUE TOCAR PARA QUE EL JUEGO CREZCA.
 * Cada capitulo es un objeto con esta forma:
 *
 *   id         identificador unico
 *   titulo     como aparece en el diario
 *   subtitulo  una linea que resume lo que toca hacer
 *   requiere   ids de capitulos que hay que terminar antes ([] = desde el principio)
 *   dia        dia minimo de partida para que se ofrezca (opcional)
 *   intro      dialogo de apertura: [{quien, texto}]
 *   objetivos  lista de metas comprobables (ver TIPOS mas abajo)
 *   premio     {xp:{habilidad:n}, objetos:[{id,cantidad}], sabe:['id']}
 *   cierre     dialogo al terminar
 *   consejo    pista que se ve en el diario mientras esta activo
 *
 * TIPOS DE OBJETIVO (los evalua reglas/progresion.js):
 *   {tipo:'entregar',  objeto:'agua', meta:9}      llevar a la casa
 *   {tipo:'juntar',    objeto:'lena', meta:3}      tenerlo encima o en la despensa
 *   {tipo:'accion',    accion:'pescar', meta:3}    hacer algo N veces
 *   {tipo:'habilidad', habilidad:'pesca', meta:2}  llegar a nivel N
 *   {tipo:'cocinar',   receta:'tortilla', meta:1}
 *   {tipo:'sembrar',   cultivo:'maiz', meta:2}
 *   {tipo:'cosechar',  meta:1}
 *   {tipo:'dias',      meta:3, condicion:'cumplido'}  dias seguidos cubriendo la casa
 *   {tipo:'lugar',     lugar:'poza'}               llegar a un sitio
 *   {tipo:'estrellas', meta:3}                     dias de 3 estrellas acumulados
 */

export const PERSONAJES = {
  nino:   { nombre: 'Tino', color: '#f5c77e' },
  mama:   { nombre: 'Mamá Rosa', color: '#f2a4a4' },
  papa:   { nombre: 'Papá Chepe', color: '#8fb8e8' },
  abuela: { nombre: 'Abuela Juana', color: '#c9a6e8' },
  meches: { nombre: 'Meches', color: '#8fe0c0' },
  perro:  { nombre: 'Lucero', color: '#d9b48f' },
  narrador: { nombre: '', color: '#cfd8e3' },
};

export const CAPITULOS = [
  {
    id: 'agua',
    titulo: 'El mandado del agua',
    subtitulo: 'En esta casa no hay tubería. El agua se trae.',
    requiere: [],
    intro: [
      { quien: 'narrador', texto: 'Amanece en el valle. Huele a tierra mojada y a humo del fogón de al lado.' },
      { quien: 'mama', texto: 'Tino, ya te levantaste. Andá al río y traeme agua, que no hay ni para el café.' },
      { quien: 'mama', texto: 'Y de vuelta juntá leña seca. Si viene lloviendo, la de abajo del palo no se moja.' },
      { quien: 'nino', texto: '¿Y si me tardo?' },
      { quien: 'mama', texto: 'Te tardás. Pero volvés.' },
    ],
    objetivos: [
      { id: 'agua', texto: 'Llevar 9 litros de agua a la casa', tipo: 'entregar', objeto: 'agua', meta: 9 },
      { id: 'lena', texto: 'Llevar 3 leñas a la casa', tipo: 'entregar', objeto: 'lena', meta: 3 },
    ],
    premio: { xp: { fuerza: 40 }, objetos: [{ id: 'canasta', cantidad: 1 }] },
    cierre: [
      { quien: 'mama', texto: 'Mirá vos. Con eso alcanza para hoy.' },
      { quien: 'mama', texto: 'Tomá la canasta de tu abuelo. Ahora te cabe más.' },
    ],
    consejo: 'El cántaro se llena metiéndose al río. Cada litro pesa: si te cargás de más, te vas a cansar antes de llegar.',
  },
  {
    id: 'monte',
    titulo: 'Lo que da el monte',
    subtitulo: 'Aprender a mirar el suelo y los palos',
    requiere: ['agua'],
    intro: [
      { quien: 'abuela', texto: 'Vení, siéntate. ¿Vos sabés cuál mata se come y cuál no?' },
      { quien: 'nino', texto: 'No.' },
      { quien: 'abuela', texto: 'Entonces vas a pasar hambre teniendo el monte lleno. Andá y traéme lo que encontrés; yo te digo qué sirve.' },
    ],
    objetivos: [
      { id: 'buscar', texto: 'Rebuscar 6 veces en el monte o en los palos', tipo: 'accion', accion: 'buscar', meta: 6 },
      { id: 'comida', texto: 'Llevar 5 cosas de comer a la casa', tipo: 'entregarCategoria', categoria: 'alimento', meta: 5 },
    ],
    premio: { xp: { recoleccion: 55 }, sabe: ['hongos'] },
    cierre: [
      { quien: 'abuela', texto: 'Los hongos salen dos días después del aguacero, al pie de los pinos. Los que tienen el sombrero rajado, esos no.' },
      { quien: 'abuela', texto: 'Ya sabés algo que no sabías ayer. Así se hace uno grande.' },
    ],
    consejo: 'Cada mes da su fruta: el mango en marzo, el jocote en junio. Lo que no está en su tiempo, no está.',
  },
  {
    id: 'rio',
    titulo: 'El pulso del río',
    subtitulo: 'Hacer la caña y aguantar el tirón',
    requiere: ['agua'],
    intro: [
      { quien: 'papa', texto: 'Hoy no hay carne. ¿Vas a llorar o vas a pescar?' },
      { quien: 'papa', texto: 'Necesitás pita y una vara. Lo demás es paciencia: el pez pica cuando el sol está bajo, no cuando a vos te da la gana.' },
    ],
    objetivos: [
      { id: 'cana', texto: 'Hacer una caña de pescar', tipo: 'cocinar', receta: 'cana', meta: 1 },
      { id: 'pescar', texto: 'Sacar 3 pescados del río', tipo: 'accion', accion: 'pescar', meta: 3 },
      { id: 'asar', texto: 'Asar un pescado en el fogón', tipo: 'cocinar', receta: 'pescado_asado', meta: 1 },
    ],
    premio: { xp: { pesca: 60, oficio: 25 }, sabe: ['cebo'] },
    cierre: [
      { quien: 'papa', texto: 'Ese guapote lo sacaste vos solo. Acordate del día.' },
      { quien: 'nino', texto: 'Me tembló la mano.' },
      { quien: 'papa', texto: 'A todos nos tiembla. Lo que cuenta es no soltar.' },
    ],
    consejo: 'En la poza honda hay pescado grande. Recogé cuando el pez afloja y soltá cuando tira: si forzás, se revienta la línea.',
  },
  {
    id: 'milpa',
    titulo: 'La milpa',
    subtitulo: 'Sembrar es creer en algo que todavía no se ve',
    requiere: ['monte'],
    intro: [
      { quien: 'papa', texto: 'Con la primera lluvia se siembra. Ni antes ni después.' },
      { quien: 'papa', texto: 'Arás el cuadro, metés la semilla y la cuidás. El maíz aguanta; el frijol perdona. Los dos se pierden si te olvidás.' },
    ],
    objetivos: [
      { id: 'sembrar', texto: 'Sembrar 3 cuadros de la milpa', tipo: 'accion', accion: 'sembrar', meta: 3 },
      { id: 'regar', texto: 'Regar la milpa 5 veces', tipo: 'accion', accion: 'regar', meta: 5 },
      { id: 'cosechar', texto: 'Levantar tu primera cosecha', tipo: 'cosechar', meta: 1 },
    ],
    premio: { xp: { siembra: 90 }, objetos: [{ id: 'azadon', cantidad: 1 }, { id: 'semilla_maiz', cantidad: 6 }], sabe: ['riego'] },
    cierre: [
      { quien: 'mama', texto: 'De aquí salen las tortillas de todo el año, Tino.' },
      { quien: 'papa', texto: 'Y la semilla del año que viene. Guardá siempre semilla. Siempre.' },
    ],
    consejo: 'Mirá el cuadro cada mañana: si dice "sed", regálo; si dice "maleza", limpiálo. La cosecha se decide en esos ratos.',
  },
  {
    id: 'caza',
    titulo: 'La hondilla',
    subtitulo: 'Acercarse sin que te huelan',
    requiere: ['monte'],
    intro: [
      { quien: 'papa', texto: 'Los animales oyen mejor que vos y huelen mucho mejor. Si el viento va de vos hacia ellos, ya perdiste.' },
      { quien: 'papa', texto: 'Agachate. Andá despacio. Y tirá una sola vez.' },
    ],
    objetivos: [
      { id: 'arma', texto: 'Hacer una hondilla', tipo: 'cocinar', receta: 'hondilla', meta: 1 },
      { id: 'cazar', texto: 'Cobrar una pieza', tipo: 'accion', accion: 'cazar', meta: 1 },
      { id: 'comida', texto: 'Asar la carne y llevarla a la casa', tipo: 'entregar', objeto: 'carne_asada', meta: 1 },
    ],
    premio: { xp: { caza: 80 }, sabe: ['rastro'] },
    cierre: [
      { quien: 'papa', texto: 'Hoy hay carne por vos.' },
      { quien: 'abuela', texto: 'Y del monte se toma lo que hace falta, no más. El que agarra de más, un día no encuentra nada.' },
    ],
    consejo: 'Mirá de dónde viene el viento antes de acercarte. Agachado hacés la mitad de ruido.',
  },
  {
    id: 'aguacero',
    titulo: 'El aguacero',
    subtitulo: 'La tormenta que se ve venir desde la loma',
    requiere: ['rio', 'milpa'],
    intro: [
      { quien: 'abuela', texto: 'Mirá el cielo por el lado del monte. Eso que viene negro no es sombra.' },
      { quien: 'mama', texto: 'Meté la leña bajo el corredor antes de que caiga, o mañana comemos frío.' },
      { quien: 'meches', texto: '¡Y después salimos a mojarnos! ¿Verdad que sí?' },
    ],
    objetivos: [
      { id: 'lena', texto: 'Tener 6 leñas guardadas antes del aguacero', tipo: 'entregar', objeto: 'lena', meta: 6 },
      { id: 'agua', texto: 'Dejar 12 litros de agua en la casa', tipo: 'entregar', objeto: 'agua', meta: 12 },
      { id: 'jugar', texto: 'Salir a jugar bajo la lluvia', tipo: 'accion', accion: 'jugar_lluvia', meta: 1 },
    ],
    premio: { xp: { espiritu: 70, fuerza: 30 }, sabe: ['cocina'] },
    cierre: [
      { quien: 'meches', texto: '¡Estás todo enlodado!' },
      { quien: 'nino', texto: 'Vos también.' },
      { quien: 'abuela', texto: 'Déjenlos, Rosa. Un aguacero se juega una vez y se acuerda toda la vida.' },
    ],
    consejo: 'Bajo la lluvia el ánimo sube rapidísimo, y con el ánimo alto se aguanta más el día siguiente.',
  },
  {
    id: 'seca',
    titulo: 'La seca',
    subtitulo: 'Cuando el río baja y hay que estirar todo',
    requiere: ['aguacero'],
    intro: [
      { quien: 'papa', texto: 'Se acabó el invierno. Ahora el agua está más lejos y la milpa pide todos los días.' },
      { quien: 'mama', texto: 'Vamos a ver de qué estás hecho, Tino.' },
    ],
    objetivos: [
      { id: 'dias', texto: 'Cubrir lo de la casa 4 días seguidos', tipo: 'dias', meta: 4, condicion: 'cumplido' },
      { id: 'fuerza', texto: 'Llegar a Fuerza 3', tipo: 'habilidad', habilidad: 'fuerza', meta: 3 },
    ],
    premio: { xp: { fuerza: 60, espiritu: 40 }, objetos: [{ id: 'cantaro', cantidad: 1 }], sabe: ['dos_cantaros'] },
    cierre: [
      { quien: 'papa', texto: 'Cuatro días seguidos sin que falte nada. Yo a tu edad no aguantaba dos.' },
      { quien: 'mama', texto: 'Ya no sos el que manda a hacer mandados. Ya sos el que resuelve.' },
    ],
    consejo: 'En la seca conviene madrugar: se carga más fresco y el aguante rinde el doble.',
  },
  {
    id: 'pueblo',
    titulo: 'El camino al pueblo',
    subtitulo: 'Lo que sobra se cambia por lo que falta',
    requiere: ['seca', 'caza'],
    intro: [
      { quien: 'papa', texto: 'El sábado bajamos al pueblo. Llevá lo que te sobre: cuero, pescado seco, maíz.' },
      { quien: 'papa', texto: 'Y aprendé a mirar el precio antes de decir que sí.' },
    ],
    objetivos: [
      { id: 'valor', texto: 'Juntar 140 en cosas para cambiar', tipo: 'valor', meta: 140 },
      { id: 'estrellas', texto: 'Acumular 6 estrellas de días buenos', tipo: 'estrellas', meta: 6 },
    ],
    premio: { xp: { oficio: 80, espiritu: 60 }, objetos: [{ id: 'machete', cantidad: 1 }], sabe: ['barro', 'atarraya'] },
    cierre: [
      { quien: 'narrador', texto: 'El camino al pueblo son dos horas de polvo y una cuesta.' },
      { quien: 'papa', texto: 'Este machete es tuyo. No lo prestés y no lo dejés en el monte.' },
      { quien: 'narrador', texto: 'Tino miró para atrás. Desde la cuesta se veía la casa, la milpa y el hilo del río. Todo eso lo había ayudado a levantar él.' },
      { quien: 'narrador', texto: 'Y todavía le faltaba mucho valle por aprender.' },
    ],
    consejo: 'El cuero del venado y el pescado grande son lo que más se paga. La fruta se pudre: esa se come.',
  },
];

export function capitulo(id) { return CAPITULOS.find((c) => c.id === id) || null; }
export const IDS_CAPITULOS = CAPITULOS.map((c) => c.id);
