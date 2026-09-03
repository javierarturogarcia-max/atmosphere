/**
 * hogar.js — La casa: lo que hace falta cada dia y lo que el nino aporta.
 *
 * Este es el nucleo emocional del juego. No hay puntuacion abstracta: hay una
 * casa sin luz y sin agua corriente que necesita cada dia sus litros, su lena y
 * su comida. Lo que el nino trae se apunta como aporte, y de ahi salen las
 * estrellas del dia y el animo de la familia.
 */
import { limitar, mezclar } from '../nucleo/mate.js';
import { OBJETOS } from '../contenido/objetos.js';
import { cuenta, quitar, agregar } from './inventario.js';

/** Consumo diario de la casa, para tres personas. */
export const CONSUMO = { agua: 9, lena: 3, raciones: 3 };

export function crearHogar() {
  return {
    despensa: {},
    animoFamilia: 62,
    aporteHoy: 0,
    aporteTotal: 0,
    diasCumplidos: 0,
    diasSeguidos: 0,
    mejorRacha: 0,
    historial: [],       // ultimos dias: {dia, aporte, estrellas, faltas}
  };
}

/** Valor de aporte de un objeto: no todo vale lo mismo para la casa. */
export function valorAporte(id, cantidad = 1) {
  const o = OBJETOS[id];
  if (!o) return 0;
  const base = { agua: 1.1, lena: 2.2, tronco: 5 }[id];
  if (base) return base * cantidad;
  if (o.tipo === 'comida') return (2 + (o.hambre || 0) * 0.16) * cantidad;
  if (o.tipo === 'crudo') return (1.2 + (o.hambre || 0) * 0.1) * cantidad;
  if (o.tipo === 'semilla') return 0.8 * cantidad;
  if (o.tipo === 'material') return 0.6 * cantidad;
  if (o.tipo === 'herramienta') return 3 * cantidad;
  return cantidad;
}

/**
 * Entrega objetos a la casa.
 * @returns {{entregado, aporte}}
 */
export function entregar(hogar, inv, id, cantidad = 1) {
  const hay = Math.min(cantidad, cuenta(inv, id));
  if (!hay) return { entregado: 0, aporte: 0 };
  quitar(inv, id, hay);
  agregar(hogar.despensa, id, hay, 9999);
  const aporte = valorAporte(id, hay);
  hogar.aporteHoy += aporte;
  hogar.aporteTotal += aporte;
  return { entregado: hay, aporte, id };
}

/** Entrega todo lo entregable de golpe (el gesto de llegar y vaciar la canasta). */
export function entregarTodo(hogar, inv) {
  const resultado = [];
  for (const id of Object.keys({ ...inv })) {
    const o = OBJETOS[id];
    if (!o || o.tipo === 'herramienta') continue;
    const r = entregar(hogar, inv, id, cuenta(inv, id));
    if (r.entregado) resultado.push({ id, cantidad: r.entregado, aporte: r.aporte });
  }
  return resultado;
}

/** Raciones de comida que hay en la despensa (una racion = un plato). */
export function racionesDisponibles(despensa) {
  let r = 0;
  for (const [id, n] of Object.entries(despensa)) {
    const o = OBJETOS[id];
    if (!o) continue;
    if (o.tipo === 'comida' && (o.hambre || 0) >= 12) r += n;
    else if (o.tipo === 'comida') r += n * 0.4;
  }
  return Math.floor(r);
}

/** Lo que le falta a la casa ahora mismo. */
export function faltantes(hogar) {
  return {
    agua: Math.max(0, CONSUMO.agua - cuenta(hogar.despensa, 'agua')),
    lena: Math.max(0, CONSUMO.lena - cuenta(hogar.despensa, 'lena')),
    raciones: Math.max(0, CONSUMO.raciones - racionesDisponibles(hogar.despensa)),
  };
}

/**
 * Cierre del dia: la casa consume lo que hay y se juzga el dia.
 * @returns {{estrellas, faltas, texto, animoFamilia}}
 */
export function cerrarDia(hogar, dia) {
  const falta = faltantes(hogar);
  const consumido = {
    agua: Math.min(CONSUMO.agua, cuenta(hogar.despensa, 'agua')),
    lena: Math.min(CONSUMO.lena, cuenta(hogar.despensa, 'lena')),
  };
  quitar(hogar.despensa, 'agua', consumido.agua);
  quitar(hogar.despensa, 'lena', consumido.lena);

  // La comida se consume empezando por lo que menos aguanta guardado.
  let raciones = CONSUMO.raciones - falta.raciones;
  const orden = Object.keys(hogar.despensa)
    .filter((id) => OBJETOS[id]?.tipo === 'comida')
    .sort((a, b) => (OBJETOS[a].hambre || 0) - (OBJETOS[b].hambre || 0));
  for (const id of orden) {
    while (raciones > 0 && cuenta(hogar.despensa, id) > 0) { quitar(hogar.despensa, id, 1); raciones--; }
  }

  const faltas = (falta.agua > 0 ? 1 : 0) + (falta.lena > 0 ? 1 : 0) + (falta.raciones > 0 ? 1 : 0);
  const cubierto = 1 - faltas / 3;
  const generosidad = limitar(hogar.aporteHoy / 34, 0, 1.35);
  const estrellas = faltas === 0
    ? (generosidad > 1 ? 3 : generosidad > 0.6 ? 2 : 1)
    : (faltas === 1 ? 1 : 0);

  hogar.animoFamilia = limitar(hogar.animoFamilia + (faltas === 0 ? 7 : -9 * faltas) + generosidad * 4, 0, 100);
  if (faltas === 0) {
    hogar.diasCumplidos++;
    hogar.diasSeguidos++;
    hogar.mejorRacha = Math.max(hogar.mejorRacha, hogar.diasSeguidos);
  } else {
    hogar.diasSeguidos = 0;
  }

  const texto = faltas === 0
    ? (estrellas === 3 ? 'Hoy sobró. Tu mamá te guardó lo mejor del plato.'
      : 'La casa tuvo lo necesario. Se cena tranquilo.')
    : `Faltó ${[falta.agua ? 'agua' : null, falta.lena ? 'leña' : null, falta.raciones ? 'comida' : null]
        .filter(Boolean).join(' y ')}.`;

  const parte = { dia, aporte: Math.round(hogar.aporteHoy), estrellas, faltas, cubierto, texto };
  hogar.historial.push(parte);
  if (hogar.historial.length > 60) hogar.historial.shift();
  hogar.aporteHoy = 0;
  return { ...parte, animoFamilia: hogar.animoFamilia };
}

/** Frase de la familia segun como va la cosa. */
export function humorFamilia(hogar) {
  const a = hogar.animoFamilia;
  if (a > 82) return 'En la casa se ríe. Tu papá dice que ya eres de ayuda de verdad.';
  if (a > 60) return 'La casa va bien. Tu mamá te manda a lavarte antes de comer.';
  if (a > 38) return 'Se aguanta, pero hay que traer más.';
  if (a > 18) return 'Hay caras largas. Falta de todo.';
  return 'La cosa está fea. Nadie dice nada, y eso es peor.';
}
