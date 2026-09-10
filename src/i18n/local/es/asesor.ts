// Consulta abierta del Asesor (punto 18) y repertorio de peleador en la
// biblioteca de ejercicios (punto 19).
//
// Módulo aparte: el índice de i18n carga todos los archivos de cada idioma y
// los fusiona, así que cada bloque de funcionalidad puede tener su archivo
// legible en vez de engordar `esquina.ts`.
//
// Prefijos: mc_as_ (Asesor) · mc_exlib_ y mc_eq_ (biblioteca).
export default {
  // ══════════════════════════════════════════════════════════════
  // ASESOR · pestañas
  // ══════════════════════════════════════════════════════════════
  mc_as_tab_ask: 'Consulta',
  mc_as_tab_plan: 'Plan por objetivo',

  // ── Consulta abierta ──
  mc_as_ask_eyebrow: 'CONSULTA',
  mc_as_ask_title: 'Pregunta',
  mc_as_ask_title_2: 'lo que quieras',
  mc_as_ask_sub: 'Dudas sueltas de nutrición, técnica, entrenamiento o cualquier otra cosa. Sin formularios: preguntas y te contesta, y puedes seguir tirando del hilo.',
  mc_as_ask_coach_title: 'Asesor',
  mc_as_ask_coach_intro: 'Pregúntame lo que sea: qué cenar con lo que tienes en casa, una duda de técnica, cómo repartir la semana o qué hacer si llegas justo de peso.',
  mc_as_ask_note: 'La conversación se mantiene mientras no salgas de Mi Esquina. Si cierras la sesión, el hilo empieza de cero.',

  // Sugerencias de arranque. Concretas a propósito: un ejemplo vago ("dame
  // consejos de nutrición") enseña a usar mal la herramienta.
  mc_as_sug_dinner: 'Tengo huevos, arroz y atún. ¿Qué ceno?',
  mc_as_sug_technique: '¿Cómo mejoro el jab sin sparring?',
  mc_as_sug_rest: '¿Cuánto descanso antes de competir?',
  mc_as_sug_weight: 'Me sobran 3 kg y peso en dos semanas',

  // ══════════════════════════════════════════════════════════════
  // BIBLIOTECA · repertorio de peleador
  // ══════════════════════════════════════════════════════════════
  mc_exlib_fighter: 'De peleador',
  mc_exlib_fighter_badge: 'Peleador',
  mc_exlib_fighter_on: 'Viendo solo lo que se puede hacer sin máquinas.',
  mc_exlib_fighter_title: 'Ejercicios de peleador',
  mc_exlib_fighter_desc: 'Dominadas y sus variantes, calistenia, cuerdas, pliometría, core rotacional, cuello, mazo y neumático. Lo que se entrena en un gimnasio de combate o en un campamento, sin depender de una sala de máquinas.',
  mc_exlib_fighter_cta: 'Ver los {{n}}',

  // Material nuevo que trae el repertorio de peleador.
  mc_eq_rope: 'Cuerdas',
  mc_eq_odd: 'Objeto pesado',

  // ══════════════════════════════════════════════════════════════
  // HUECO PREEXISTENTE
  //
  // `SectionCoach` usa estas dos claves al guardar el plan acordado en la
  // conversación, y no estaban traducidas en ningún archivo: habrían salido en
  // pantalla como "mc_ai_plan_added_agenda". Hoy ese camino solo se activa en
  // las secciones 'training' y 'nutrition' (la consulta abierta no ofrece
  // guardar nada), así que no se había notado. Se rellenan aquí para que no
  // aparezca el día que se use.
  // ══════════════════════════════════════════════════════════════
  mc_ai_plan_added_agenda: 'Añadidas {{count}} sesiones a tu Agenda',
  mc_ai_meals_added: 'Añadidas {{count}} comidas a tu diario',
};
