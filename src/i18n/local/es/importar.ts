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
  mc_imp_saved_routine: 'Rutina guardada. La tienes en Fuerza › Rutinas.',
  mc_imp_saved_protocol: 'Protocolo guardado. Lo tienes en Actividad › Protocolos.',
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
  mc_rp_import_moved: 'Para meter una rutina de un documento, ve a Agenda › Planificar: se pega ahí y él reconoce solo lo que es.',
  mc_pt_import_moved: 'Para meter un protocolo de un documento, ve a Agenda › Planificar: se pega ahí y él reconoce solo lo que es.',
};
