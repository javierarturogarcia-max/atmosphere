/**
 * logros.js — Insignias. Cada logro declara una condicion pura sobre el
 * `resumen` del perfil (ver core/analitica.js -> construirResumen), de modo que
 * la evaluacion es determinista, testeable y sin efectos secundarios.
 *
 * Niveles: bronce (facil, primeros dias) / plata / oro / platino (meses de constancia).
 */

export const NIVELES_LOGRO = Object.freeze({
  bronce:  { etiqueta: 'Bronce',  color: '#d97706', xp: 40 },
  plata:   { etiqueta: 'Plata',   color: '#94a3b8', xp: 90 },
  oro:     { etiqueta: 'Oro',     color: '#f59e0b', xp: 200 },
  platino: { etiqueta: 'Platino', color: '#67e8f9', xp: 450 },
});

const n = (v) => Number(v) || 0;

export const LOGROS = Object.freeze([
  // -------------------------------------------------------------- primeros pasos
  { id: 'primer_paso', titulo: 'Primer paso', icono: '👣', nivel: 'bronce',
    desc: 'Registra tu primera accion ambiental.',
    condicion: (r) => n(r.registros) >= 1, progreso: (r) => [n(r.registros), 1] },

  { id: 'diez_acciones', titulo: 'Constancia inicial', icono: '🔟', nivel: 'bronce',
    desc: 'Acumula 10 acciones registradas.',
    condicion: (r) => n(r.registros) >= 10, progreso: (r) => [n(r.registros), 10] },

  { id: 'cien_acciones', titulo: 'Centenario verde', icono: '💯', nivel: 'plata',
    desc: 'Acumula 100 acciones registradas.',
    condicion: (r) => n(r.registros) >= 100, progreso: (r) => [n(r.registros), 100] },

  { id: 'mil_acciones', titulo: 'Maquina imparable', icono: '⚙️', nivel: 'platino',
    desc: 'Acumula 1.000 acciones registradas.',
    condicion: (r) => n(r.registros) >= 1000, progreso: (r) => [n(r.registros), 1000] },

  // -------------------------------------------------------------------- carbono
  { id: 'co2_10', titulo: 'Diez kilos menos', icono: '🌬️', nivel: 'bronce',
    desc: 'Evita 10 kg de CO2e.',
    condicion: (r) => n(r.co2eTotal) >= 10, progreso: (r) => [n(r.co2eTotal), 10] },

  { id: 'co2_100', titulo: 'Sumidero personal', icono: '🍃', nivel: 'plata',
    desc: 'Evita 100 kg de CO2e: lo que absorben 5 arboles en un anio.',
    condicion: (r) => n(r.co2eTotal) >= 100, progreso: (r) => [n(r.co2eTotal), 100] },

  { id: 'co2_500', titulo: 'Media tonelada', icono: '🏋️', nivel: 'oro',
    desc: 'Evita 500 kg de CO2e.',
    condicion: (r) => n(r.co2eTotal) >= 500, progreso: (r) => [n(r.co2eTotal), 500] },

  { id: 'co2_1000', titulo: 'Tonelada evitada', icono: '🏆', nivel: 'platino',
    desc: 'Evita 1 tonelada de CO2e: el 43 % del presupuesto anual compatible con 1,5 C.',
    condicion: (r) => n(r.co2eTotal) >= 1000, progreso: (r) => [n(r.co2eTotal), 1000] },

  // ----------------------------------------------------------------------- agua
  { id: 'agua_1000', titulo: 'Mil litros', icono: '💧', nivel: 'bronce',
    desc: 'Ahorra 1.000 litros de agua.',
    condicion: (r) => n(r.aguaTotal) >= 1000, progreso: (r) => [n(r.aguaTotal), 1000] },

  { id: 'agua_10000', titulo: 'Guardian del agua', icono: '🌊', nivel: 'oro',
    desc: 'Ahorra 10.000 litros: 77 dias de consumo domestico de una persona.',
    condicion: (r) => n(r.aguaTotal) >= 10000, progreso: (r) => [n(r.aguaTotal), 10000] },

  { id: 'agua_100000', titulo: 'Cuenca protegida', icono: '🏞️', nivel: 'platino',
    desc: 'Ahorra 100.000 litros de agua.',
    condicion: (r) => n(r.aguaTotal) >= 100000, progreso: (r) => [n(r.aguaTotal), 100000] },

  // ------------------------------------------------------------------- residuos
  { id: 'res_10', titulo: 'Separador', icono: '♻️', nivel: 'bronce',
    desc: 'Desvia 10 kg de residuo del vertedero.',
    condicion: (r) => n(r.residuoTotal) >= 10, progreso: (r) => [n(r.residuoTotal), 10] },

  { id: 'res_100', titulo: 'Economia circular', icono: '🔄', nivel: 'oro',
    desc: 'Desvia 100 kg de residuo del vertedero.',
    condicion: (r) => n(r.residuoTotal) >= 100, progreso: (r) => [n(r.residuoTotal), 100] },

  { id: 'compostador', titulo: 'Alquimista del suelo', icono: '🪱', nivel: 'plata',
    desc: 'Composta 25 kg de materia organica.',
    condicion: (r) => n(r.porAccion?.res_compostar_kg) >= 25,
    progreso: (r) => [n(r.porAccion?.res_compostar_kg), 25] },

  { id: 'basuraleza', titulo: 'Limpiador urbano', icono: '🧤', nivel: 'plata',
    desc: 'Recoge 20 kg de basura del entorno.',
    condicion: (r) => n(r.porAccion?.res_limpieza_kg) >= 20,
    progreso: (r) => [n(r.porAccion?.res_limpieza_kg), 20] },

  // ------------------------------------------------------------------ movilidad
  { id: 'bici_50', titulo: 'Ciclista urbano', icono: '🚲', nivel: 'bronce',
    desc: 'Recorre 50 km en bicicleta.',
    condicion: (r) => n(r.porAccion?.mov_bici_km) >= 50,
    progreso: (r) => [n(r.porAccion?.mov_bici_km), 50] },

  { id: 'bici_500', titulo: 'Piernas de acero', icono: '🦵', nivel: 'oro',
    desc: 'Recorre 500 km en bicicleta.',
    condicion: (r) => n(r.porAccion?.mov_bici_km) >= 500,
    progreso: (r) => [n(r.porAccion?.mov_bici_km), 500] },

  { id: 'sin_coche_semana', titulo: 'Semana sin coche', icono: '🚫🚗', nivel: 'plata',
    desc: '7 dias seguidos con movilidad registrada y sin coche.',
    condicion: (r) => n(r.rachaSinCoche) >= 7, progreso: (r) => [n(r.rachaSinCoche), 7] },

  { id: 'maraton_verde', titulo: 'Maraton verde', icono: '🏃', nivel: 'plata',
    desc: 'Acumula 42 km caminando.',
    condicion: (r) => n(r.porAccion?.mov_caminar_km) >= 42,
    progreso: (r) => [n(r.porAccion?.mov_caminar_km), 42] },

  // -------------------------------------------------------------------- energia
  { id: 'led_total', titulo: 'Casa LED', icono: '💡', nivel: 'plata',
    desc: 'Sustituye 10 bombillas por LED.',
    condicion: (r) => n(r.porAccion?.ene_led_ud) >= 10,
    progreso: (r) => [n(r.porAccion?.ene_led_ud), 10] },

  { id: 'kwh_500', titulo: 'Cazador de vatios', icono: '⚡', nivel: 'oro',
    desc: 'Ahorra 500 kWh de electricidad.',
    condicion: (r) => n(r.kwhTotal) >= 500, progreso: (r) => [n(r.kwhTotal), 500] },

  { id: 'solar', titulo: 'Energia del sol', icono: '🔆', nivel: 'platino',
    desc: 'Registra autoconsumo solar.',
    condicion: (r) => n(r.porAccion?.ene_solar_mes) >= 1,
    progreso: (r) => [n(r.porAccion?.ene_solar_mes), 1] },

  // --------------------------------------------------------------- alimentacion
  { id: 'veg_10', titulo: 'Plato verde', icono: '🥦', nivel: 'bronce',
    desc: '10 comidas sin carne.',
    condicion: (r) => n(r.porAccion?.ali_sin_carne_ud) >= 10,
    progreso: (r) => [n(r.porAccion?.ali_sin_carne_ud), 10] },

  { id: 'veg_100', titulo: 'Cocina baja en carbono', icono: '👨‍🍳', nivel: 'oro',
    desc: '100 comidas sin carne: unos 190 kg CO2e evitados.',
    condicion: (r) => n(r.porAccion?.ali_sin_carne_ud) >= 100,
    progreso: (r) => [n(r.porAccion?.ali_sin_carne_ud), 100] },

  { id: 'cero_desperdicio', titulo: 'Cero desperdicio', icono: '🍲', nivel: 'plata',
    desc: 'Aprovecha 15 kg de sobras.',
    condicion: (r) => n(r.porAccion?.ali_no_desperdiciar_kg) >= 15,
    progreso: (r) => [n(r.porAccion?.ali_no_desperdiciar_kg), 15] },

  // -------------------------------------------------------------- biodiversidad
  { id: 'primer_arbol', titulo: 'Sembrador', icono: '🌱', nivel: 'bronce',
    desc: 'Planta tu primer arbol.',
    condicion: (r) => n(r.arboles) >= 1, progreso: (r) => [n(r.arboles), 1] },

  { id: 'bosquecillo', titulo: 'Bosquecillo', icono: '🌳', nivel: 'oro',
    desc: 'Planta 25 arboles.',
    condicion: (r) => n(r.arboles) >= 25, progreso: (r) => [n(r.arboles), 25] },

  { id: 'polinizador', titulo: 'Amigo de las abejas', icono: '🐝', nivel: 'plata',
    desc: 'Planta 10 especies nativas o polinizadoras.',
    condicion: (r) => n(r.porAccion?.bio_planta_nativa_ud) >= 10,
    progreso: (r) => [n(r.porAccion?.bio_planta_nativa_ud), 10] },

  // ------------------------------------------------------------------ constancia
  { id: 'racha_7', titulo: 'Una semana firme', icono: '🔥', nivel: 'bronce',
    desc: 'Manten una racha de 7 dias.',
    condicion: (r) => n(r.rachaMejor) >= 7, progreso: (r) => [n(r.rachaMejor), 7] },

  { id: 'racha_30', titulo: 'Habito consolidado', icono: '🔥', nivel: 'oro',
    desc: 'Manten una racha de 30 dias. La literatura fija ahi la formacion del habito.',
    condicion: (r) => n(r.rachaMejor) >= 30, progreso: (r) => [n(r.rachaMejor), 30] },

  { id: 'racha_100', titulo: 'Cien dias', icono: '💎', nivel: 'platino',
    desc: 'Manten una racha de 100 dias.',
    condicion: (r) => n(r.rachaMejor) >= 100, progreso: (r) => [n(r.rachaMejor), 100] },

  { id: 'madrugador', titulo: 'Madrugador', icono: '🌅', nivel: 'bronce',
    desc: 'Registra una accion antes de las 7:00.',
    condicion: (r) => !!r.registroMadrugada, progreso: (r) => [r.registroMadrugada ? 1 : 0, 1] },

  // ------------------------------------------------------------------ diversidad
  { id: 'todoterreno', titulo: 'Todoterreno', icono: '🧭', nivel: 'plata',
    desc: 'Registra acciones de las 8 categorias.',
    condicion: (r) => n(r.categoriasUsadas) >= 8, progreso: (r) => [n(r.categoriasUsadas), 8] },

  { id: 'equilibrado', titulo: 'Perfil equilibrado', icono: '⚖️', nivel: 'oro',
    desc: 'Alcanza una equidad de Pielou superior a 0,85 con 5+ categorias.',
    condicion: (r) => n(r.pielou) >= 0.85 && n(r.categoriasUsadas) >= 5,
    progreso: (r) => [n(r.pielou) * 100, 85] },

  { id: 'coleccionista', titulo: 'Coleccionista', icono: '📚', nivel: 'oro',
    desc: 'Prueba 30 acciones distintas del catalogo.',
    condicion: (r) => n(r.accionesDistintas) >= 30, progreso: (r) => [n(r.accionesDistintas), 30] },

  // -------------------------------------------------------------------- social
  { id: 'mentor', titulo: 'Mentor', icono: '🎓', nivel: 'plata',
    desc: 'Ensena una practica sostenible a 5 personas.',
    condicion: (r) => n(r.porAccion?.com_ensenar_ud) >= 5,
    progreso: (r) => [n(r.porAccion?.com_ensenar_ud), 5] },

  { id: 'voluntario', titulo: 'Manos a la obra', icono: '🤝', nivel: 'oro',
    desc: 'Dedica 20 horas a voluntariado ambiental.',
    condicion: (r) => n(r.porAccion?.com_voluntariado_h) >= 20,
    progreso: (r) => [n(r.porAccion?.com_voluntariado_h), 20] },

  { id: 'cientifico', titulo: 'Ciencia ciudadana', icono: '🔬', nivel: 'plata',
    desc: 'Aporta 25 observaciones de ciencia ciudadana.',
    condicion: (r) => n(r.porAccion?.com_ciencia_ciudadana_ud) >= 25,
    progreso: (r) => [n(r.porAccion?.com_ciencia_ciudadana_ud), 25] },

  // -------------------------------------------------------------------- maestria
  { id: 'nivel_10', titulo: 'Retono', icono: '🍃', nivel: 'bronce',
    desc: 'Alcanza el nivel 10.',
    condicion: (r) => n(r.nivel) >= 10, progreso: (r) => [n(r.nivel), 10] },

  { id: 'nivel_30', titulo: 'Arbol joven', icono: '🌳', nivel: 'plata',
    desc: 'Alcanza el nivel 30.',
    condicion: (r) => n(r.nivel) >= 30, progreso: (r) => [n(r.nivel), 30] },

  { id: 'nivel_60', titulo: 'Veterano', icono: '🪵', nivel: 'oro',
    desc: 'Alcanza el nivel 60.',
    condicion: (r) => n(r.nivel) >= 60, progreso: (r) => [n(r.nivel), 60] },

  { id: 'nivel_100', titulo: 'Guardian del planeta', icono: '🛡️', nivel: 'platino',
    desc: 'Alcanza el nivel 100.',
    condicion: (r) => n(r.nivel) >= 100, progreso: (r) => [n(r.nivel), 100] },

  { id: 'misiones_50', titulo: 'Cumplidor', icono: '🎯', nivel: 'oro',
    desc: 'Completa 50 misiones.',
    condicion: (r) => n(r.misionesCompletadas) >= 50,
    progreso: (r) => [n(r.misionesCompletadas), 50] },

  { id: 'huella_objetivo', titulo: 'Compatible con 1,5 C', icono: '🎯', nivel: 'platino',
    desc: 'Calcula tu huella y situala por debajo de 2,3 t CO2e/anio.',
    condicion: (r) => n(r.huellaAnual) > 0 && n(r.huellaAnual) <= 2.3,
    progreso: (r) => [n(r.huellaAnual) > 0 ? Math.max(0, 100 - (n(r.huellaAnual) - 2.3) * 20) : 0, 100] },

  { id: 'fotoperiodista', titulo: 'Fotoperiodista', icono: '📷', nivel: 'plata',
    desc: 'Aporta 10 pruebas graficas fechadas de tus acciones.',
    condicion: (r) => n(r.pruebasVerificadas) >= 10,
    progreso: (r) => [n(r.pruebasVerificadas), 10] },

  { id: 'documentalista', titulo: 'Documentalista', icono: '🎥', nivel: 'oro',
    desc: 'Graba 5 videos verificados: son la prueba mas dificil de falsificar.',
    condicion: (r) => n(r.pruebasVideo) >= 5,
    progreso: (r) => [n(r.pruebasVideo), 5] },

  { id: 'auditor', titulo: 'Auditor riguroso', icono: '🧾', nivel: 'plata',
    desc: 'Manten un indice de confianza superior a 0,8 con 50+ registros.',
    condicion: (r) => n(r.confianza) >= 0.8 && n(r.registros) >= 50,
    progreso: (r) => [n(r.confianza) * 100, 80] },
]);

const INDICE = new Map(LOGROS.map((l) => [l.id, l]));
export function logro(id) { return INDICE.get(id) || null; }
