// La única puerta para meter un plan (Planificar › PlanImport).
//
// Antes importar estaba en tres sitios: rutinas en Fuerza, protocolos de cardio
// en Actividad y el plan de semana en el Asesor. Había que saber de qué era el
// documento ANTES de entrar por la puerta correcta, y un documento con fuerza y
// cardio dentro no tenía puerta buena.
//
// Los textos de aquí tienen un trabajo concreto: dejar claro que da igual lo
// que pegues, y que si la app duda va a PREGUNTAR en vez de decidir por su
// cuenta. Colar una tabla de cinta en el historial de fuerza es peor que un
// clic de más.
//
// Módulo aparte de `esquina.ts`, que ya pasa de 90 KB.
export default {
  mc_imp_placeholder: 'Pega aquí el plan…\n\nEjemplos:\nLunes pecho y espalda, press banca 4x8…\n0-5 min inclinación 2 velocidad 6…',

  // Lo que se ha entendido. "Detectado" cuando está claro; "pregunta" cuando no.
  mc_imp_detected: 'Esto es',
  mc_imp_ask: '¿Qué es esto?',
  mc_imp_change: 'No es eso, cambiar',

  mc_imp_kind_routine: 'Rutina de fuerza',
  mc_imp_kind_protocol: 'Protocolo de cardio',
  mc_imp_kind_week: 'Plan de la semana',
  mc_imp_kind_meals: 'Pauta de comidas',

  // Sin saber la actividad no se puede leer la tabla: en cinta las columnas son
  // inclinación y velocidad, en remo son metros. Se pregunta, no se supone.
  mc_imp_which_activity: '¿De qué actividad es?',

  mc_imp_go: 'Meterlo',
  // Repartir la semana por días y archivar una rutina son resultados
  // distintos: el botón dice cuál de los dos va a pasar.
  mc_imp_go_week: 'Repartir por días',

  mc_imp_no_routine: 'No he encontrado ejercicios ahí. Prueba a poner uno por línea.',
  mc_imp_no_protocol: 'No he encontrado tramos por minutos. Prueba con "0-5 min, inclinación 2, velocidad 6".',
  mc_imp_saved_local: 'Guardado en este dispositivo. Se subirá cuando haya conexión.',

  mc_imp_default_routine: 'Rutina importada',
  mc_imp_default_protocol: 'Protocolo importado',

  // Se dice a propósito: sin clave de IA la pantalla NO está a medias, lee el
  // texto igual con el lector del navegador. Si no se dijera, parecería rota.
  mc_imp_no_ai: 'Sin IA configurada: se lee el texto igualmente.',

  // Foto del documento. Solo con IA: leer una imagen no lo puede hacer el
  // navegador, así que el botón no se enseña si no hay clave configurada.
  mc_imp_photo: 'Subir foto del plan',
  mc_imp_photo_clear: 'quitar',

  // ── Avisos en las bibliotecas, donde ANTES estaba el botón de importar ──
  // No basta con quitar el botón: quien lo usaba lo va a buscar donde estaba.
  // Estas dos líneas dicen adónde se ha movido y por qué merece la pena.
  // ── Paso 2 del importador: "¿y qué días haces esto?" ──
  // Una rutina dice "Día A, Día B"; un protocolo dice "40 min de cinta". Ninguno
  // trae fecha, y la Agenda solo entiende fechas. Ese dato falta y se pregunta:
  // repartirlo solo (lunes, miércoles, viernes) sería inventarse su semana.
  mc_land_title: '¿Qué días haces esto?',
  mc_land_desc: 'Elige el día de la semana. Toca otra vez para quitarlo. Lo que dejes sin día se guarda igual y lo colocas luego desde la Agenda.',
  mc_land_day_unnamed: 'Día sin nombre',
  mc_land_ex_count_one: '1 ejercicio',
  mc_land_ex_count_other: '{{count}} ejercicios',
  mc_land_confirm: 'Ponerlo en la semana',
  mc_land_skip: 'Ahora no',
  mc_land_added_one: 'Añadido a 1 día',
  mc_land_added_other: 'Añadido a {{count}} días',
  // ── Ejemplos de un toque ──
  // Leer ejemplos dentro de un placeholder y luego copiarlos a mano es
  // trabajo. Como pastillas, un toque los mete en la caja: enseñan que aquí
  // cabe todo —la semana, una rutina, una tabla de cardio— y disparan la
  // detección, así que se ve el mecanismo antes de escribir nada propio.
  mc_imp_ej_week: 'Mi semana',
  mc_imp_ej_week_txt: 'Lunes pecho y espalda, tres series de todo.\nMartes correr media hora.\nMiércoles descanso.\nJueves pierna.\nViernes hombro y brazo.',
  mc_imp_ej_routine: 'Una rutina',
  mc_imp_ej_routine_txt: 'Día A — Empuje\nPress banca 4x8\nPress militar 4x10\nFondos 3x12\n\nDía B — Tirón\nDominadas 4x8\nRemo con barra 4x10\nCurl bíceps 3x12',
  mc_imp_ej_protocol: 'Cardio por tramos',
  mc_imp_ej_protocol_txt: 'Cinta\n0-5 min · inclinación 2 · velocidad 6\n5-15 min · inclinación 4 · velocidad 8\n15-20 min · inclinación 2 · velocidad 6',
};
