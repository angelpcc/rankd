// Protocolos de actividad (punto 16), rutinas preescritas (punto 17) y las
// ampliaciones del Asesor de comida (punto 20).
//
// Va en un módulo aparte de `esquina.ts` porque el índice de i18n carga TODOS
// los archivos de cada idioma y los fusiona: así estas tres funciones tienen su
// propio archivo legible en vez de engordar uno de 90 KB.
//
// Prefijos: mc_pt_ (protocolos) · mc_rp_ (rutinas) · mc_mp_ (asesor de comida).
export default {
  // ══════════════════════════════════════════════════════════════
  // TIPOS DE ACTIVIDAD NUEVOS
  // ══════════════════════════════════════════════════════════════
  mc_act_kind_cinta: 'Cinta',
  mc_act_kind_eliptica: 'Elíptica',
  mc_act_kind_remo: 'Remo',

  // Pestañas de la sección Actividad
  mc_av_tab_log: 'Registro',
  mc_av_tab_protocols: 'Protocolos',

  // ══════════════════════════════════════════════════════════════
  // PROTOCOLOS · Variables de tramo
  // ══════════════════════════════════════════════════════════════
  mc_pt_var_speed: 'Velocidad',
  mc_pt_var_incline: 'Inclinación',
  mc_pt_var_resist: 'Resistencia',
  mc_pt_var_cadence: 'Cadencia',
  mc_pt_var_pace100: 'Ritmo 100 m',
  mc_pt_var_pace500: 'Ritmo 500 m',
  mc_pt_var_stroke: 'Paladas',
  mc_pt_var_effort: 'Esfuerzo',

  // ── Biblioteca ──
  mc_pt_eyebrow: 'PROTOCOLOS',
  mc_pt_title: 'Tu sesión,',
  mc_pt_title_2: 'tramo a tramo',
  mc_pt_sub: 'Escribe una vez la sesión con sus tramos y reprodúcela en vivo cada vez que la hagas. Vale para cinta, bici, natación, remo o lo que entrenes.',
  mc_pt_new: 'Nuevo protocolo',
  mc_pt_import: 'Importar',
  mc_pt_local_only: 'Guardado solo en este dispositivo: cuando se active la base de datos pasará a tu cuenta.',
  mc_pt_empty_title: 'Todavía no tienes protocolos',
  mc_pt_empty_desc: 'Crea uno con sus tramos o pega la tabla que te haya pasado tu entrenador y la convertimos en un guion que puedes seguir mientras entrenas.',
  mc_pt_play: 'Empezar',
  mc_pt_untitled: 'Protocolo sin nombre',
  mc_pt_saved: 'Protocolo guardado',
  mc_pt_deleted: 'Protocolo eliminado',
  mc_pt_totals: '{{n}} tramos · {{time}}',
  mc_pt_last_done: 'Completado el {{date}}',
  mc_pt_last_partial: 'Última vez el {{date}}',
  mc_pt_run_saved: 'Protocolo completado y guardado en tu historial',
  mc_pt_run_saved_partial: 'Guardado lo que has hecho en tu historial',

  // ── Editor ──
  mc_pt_editor_eyebrow: 'PROTOCOLO',
  mc_pt_editor_title: 'Tramos de la sesión',
  mc_pt_field_name: 'Nombre',
  mc_pt_field_name_ph: 'Ej. Intervalos cinta 40 min',
  mc_pt_segments: 'Tramos',
  mc_pt_by_time: 'Por tiempo',
  mc_pt_by_distance: 'Por distancia',
  mc_pt_field_duration: 'Duración del tramo',
  mc_pt_field_meters: 'Metros del tramo',
  mc_pt_field_label: 'Nombre del tramo (opcional)',
  mc_pt_field_label_ph: 'Ej. Calentamiento',
  mc_pt_move_up: 'Subir',
  mc_pt_move_down: 'Bajar',
  mc_pt_duplicate: 'Duplicar',
  mc_pt_add_segment: 'Añadir tramo',
  mc_pt_field_note: 'Nota (opcional)',
  mc_pt_field_note_ph: 'De dónde sale, para qué es…',
  mc_pt_save: 'Guardar protocolo',

  // ── Reproductor ──
  mc_pt_player_eyebrow: 'EN CURSO',
  mc_pt_segment_of: 'Tramo {{n}} de {{total}}',
  mc_pt_remaining: 'Queda de este tramo',
  mc_pt_distance_manual: 'Este tramo va por distancia: dale a "Hecho" cuando lo completes.',
  mc_pt_next: 'A continuación',
  mc_pt_in_time: 'En {{time}}',
  mc_pt_last_segment: 'Es el último tramo',
  mc_pt_show_all: 'Ver el protocolo entero',
  mc_pt_start: 'Empezar',
  mc_pt_resume: 'Reanudar',
  mc_pt_pause: 'Pausa',
  mc_pt_skip: 'Siguiente',
  mc_pt_done_segment: 'Hecho',
  mc_pt_finish_early: 'Terminar antes',
  mc_pt_empty_protocol: 'Este protocolo no tiene tramos.',

  mc_pt_done_title: '¡Protocolo terminado!',
  mc_pt_done_sub: 'Guárdalo y quedará en tu historial de Actividad como una sesión más.',
  mc_pt_stat_time: 'Tiempo',
  mc_pt_stat_segments: 'Tramos',
  mc_pt_stat_distance: 'Distancia',
  mc_pt_save_session: 'Guardar sesión',
  mc_pt_discard_run: 'Salir sin guardar',

  mc_pt_exit_title: '¿Terminar aquí?',
  mc_pt_exit_desc: 'Llevas {{time}} y {{n}} de {{total}} tramos. Puedes guardar lo hecho como sesión.',
  mc_pt_exit_save: 'Guardar lo hecho',
  mc_pt_exit_too_short: 'Aún es muy poco para guardarlo como sesión.',
  mc_pt_exit_discard: 'Salir sin guardar',

  // ── Importar ──
  mc_pt_import_title: 'Importar protocolo',
  mc_pt_import_desc: 'Pega la tabla de tu rutina (minuto, inclinación, velocidad…) o sube una foto y la convertimos en tramos. Podrás revisarla antes de guardar.',
  mc_pt_import_kind: '¿De qué actividad es?',
  mc_pt_import_text: 'Pega aquí el texto',
  mc_pt_import_text_ph: `0-5   incl 1   vel 5,5
5-10  incl 2   vel 6
10-15 incl 3   vel 6,5`,
  mc_pt_import_photo: 'Subir foto del documento',
  mc_pt_import_ai_paused: 'El Asesor está en pausa ahora mismo. Puedes pegar el texto y leerlo aquí mismo, sin conexión.',
  mc_pt_import_warn: 'Alguna duración se ha tenido que deducir. Revisa los tramos antes de guardar.',
  mc_pt_import_with_ai: 'Leer con el Asesor',
  mc_pt_import_reading: 'Leyendo…',
  mc_pt_import_here: 'Leer aquí mismo',
  mc_pt_import_here_hint: 'Sin conexión ni IA: lo lee tu navegador. Funciona con tablas de minuto · inclinación · velocidad.',
  mc_pt_import_nothing: 'No he podido leer tramos en ese documento.',
  mc_pt_import_fallback: 'El Asesor no ha podido; lo hemos leído aquí mismo. Revísalo.',
  mc_pt_imported_name: 'Protocolo importado',

  // ══════════════════════════════════════════════════════════════
  // RUTINAS PREESCRITAS
  // ══════════════════════════════════════════════════════════════
  mc_str_tab_routines: 'Rutinas',

  // ── Biblioteca ──
  mc_rp_eyebrow: 'RUTINAS',
  mc_rp_title: 'Tu rutina,',
  mc_rp_title_2: 'serie a serie',
  mc_rp_sub: 'Guarda tu rutina por días y ábrela al entrenar: marcas cada serie según la haces y ajustas el peso real de ese día.',
  mc_rp_new: 'Nueva rutina',
  mc_rp_import: 'Importar',
  mc_rp_local_only: 'Guardada solo en este dispositivo: cuando se active la base de datos pasará a tu cuenta.',
  mc_rp_empty_title: 'Todavía no tienes rutinas',
  mc_rp_empty_desc: 'Crea una con tus días y ejercicios, o pega la rutina que ya tengas escrita y la convertimos en un checklist que puedes ir marcando.',
  mc_rp_untitled: 'Rutina sin nombre',
  mc_rp_saved: 'Rutina guardada',
  mc_rp_deleted: 'Rutina eliminada',
  mc_rp_session_saved: 'Sesión guardada en tu historial de Fuerza',
  mc_rp_totals: '{{days}} días · {{ex}} ejercicios · {{sets}} series',
  mc_rp_last_used: 'última vez el {{date}}',
  mc_rp_start_day: 'Entrenar',
  mc_rp_day_n: 'Día {{n}}',
  mc_rp_day_summary: '{{n}} ejercicios',

  // ── Editor ──
  mc_rp_editor_eyebrow: 'RUTINA',
  mc_rp_editor_title: 'Días y ejercicios',
  mc_rp_field_name: 'Nombre de la rutina',
  mc_rp_field_name_ph: 'Ej. Rutina 5 días',
  mc_rp_days: 'Días',
  mc_rp_field_day_name_ph: 'Ej. Push · Pecho, hombro y tríceps',
  mc_rp_field_exercise_ph: 'Nombre del ejercicio',
  mc_rp_add_exercise: 'Añadir ejercicio',
  mc_rp_add_day: 'Añadir día',
  mc_rp_duplicate_day: 'Duplicar día',
  mc_rp_delete_day: 'Borrar día',
  mc_rp_sets: 'Series',
  mc_rp_reps_min: 'Reps',
  mc_rp_reps_max: 'Hasta',
  mc_rp_seconds: 'Segundos',
  mc_rp_meters: 'Metros',
  mc_rp_weight: 'Peso',
  mc_rp_group: 'Grupo',
  mc_rp_tracking: 'Cómo se mide',
  mc_rp_track_reps: 'Reps',
  mc_rp_track_time: 'Tiempo',
  mc_rp_track_distance: 'Distancia',
  mc_rp_field_note: 'Nota (opcional)',
  mc_rp_field_note_ph: 'De quién viene, para qué bloque es…',
  mc_rp_save: 'Guardar rutina',

  // ── Checklist en vivo ──
  mc_rp_progress: '{{done}} de {{total}} series',
  mc_rp_check_all: 'Marcar todo',
  mc_rp_uncheck_all: 'Desmarcar',
  mc_rp_set_n: 'Serie {{n}}',
  mc_rp_unit_reps: 'reps',
  mc_rp_runner_hint: 'El peso viene propuesto con lo que levantaste la última vez. Cámbialo si hoy es otro: se guarda lo que marques aquí.',
  mc_rp_finish_cta: 'Terminar sesión',

  mc_rp_finish_title: 'Buen trabajo',
  mc_rp_finish_sub: 'Has completado {{done}} de {{total}} series. Solo se guardan las que has marcado.',
  mc_rp_finish_date: '¿Qué día ha sido?',
  mc_rp_finish_slot: 'Franja',
  mc_rp_finish_save: 'Guardar en mi historial',
  mc_rp_finish_back: 'Volver al checklist',
  mc_rp_slot_none: 'Única',
  mc_rp_slot_morning: 'Mañana',
  mc_rp_slot_afternoon: 'Tarde',
  mc_rp_slot_evening: 'Noche',

  mc_rp_exit_title: '¿Salir de la sesión?',
  mc_rp_exit_desc: 'Llevas {{done}} de {{total}} series marcadas. Puedes guardarlas antes de salir.',
  mc_rp_exit_save: 'Guardar lo hecho',
  mc_rp_exit_discard: 'Salir sin guardar',

  // ── Importar ──
  mc_rp_import_title: 'Importar rutina',
  mc_rp_import_desc: 'Pega tu rutina escrita (días, ejercicios y series) o sube una foto y la convertimos en un checklist. Podrás revisarla antes de guardar.',
  mc_rp_import_text: 'Pega aquí el texto',
  mc_rp_import_text_ph: `PUSH
Press banca 4x8-10
Press militar 3x10
Fondos 3x12

PULL
Dominadas 4x8
Remo con barra 4x10`,
  mc_rp_import_photo: 'Subir foto del documento',
  mc_rp_import_ai_paused: 'El Asesor está en pausa ahora mismo. Puedes pegar el texto y leerlo aquí mismo, sin conexión.',
  mc_rp_import_with_ai: 'Leer con el Asesor',
  mc_rp_import_reading: 'Leyendo…',
  mc_rp_import_here: 'Leer aquí mismo',
  mc_rp_import_here_hint: 'Sin conexión ni IA: lo lee tu navegador. Funciona con el formato "Press banca 4x8-10".',
  mc_rp_import_nothing: 'No he podido leer una rutina en ese documento.',
  mc_rp_import_fallback: 'El Asesor no ha podido; la hemos leído aquí mismo. Revísala.',
  mc_rp_imported_name: 'Rutina importada',

  // ══════════════════════════════════════════════════════════════
  // ASESOR DE COMIDA · lo nuevo del punto 20
  // ══════════════════════════════════════════════════════════════
  mc_mp_required_title: 'ANTES DE PLANIFICAR',

  mc_mp_q_meals: '¿Cuántas comidas haces al día?',
  mc_mp_q_meals_hint: 'Es lo que decide cómo se reparte el día. No hay una respuesta mejor que otra.',
  mc_mp_meals_n: '{{n}} comidas',

  mc_mp_q_restrictions: '¿Alguna alergia, intolerancia o algo que no comas?',
  mc_mp_q_restrictions_hint: 'Se descartan los platos que lo lleven. Si no tienes ninguna, dilo también.',
  mc_mp_q_restrictions_ph: 'Ej. sin lactosa, nada de cerdo',
  mc_mp_restr_none: 'Ninguna',
  mc_mp_restr_lactose: 'Lactosa',
  mc_mp_restr_gluten: 'Gluten',
  mc_mp_restr_pork: 'Cerdo',
  mc_mp_restr_fish: 'Pescado',
  mc_mp_restr_nuts: 'Frutos secos',
  mc_mp_restr_too_tight: 'Con esas restricciones alguna comida se queda sin platos. Puede que veas opciones que no encajan del todo: revísalas.',
  mc_mp_restr_disclaimer: 'Filtramos por ingredientes conocidos. Ante una alergia real, revisa siempre cada plato: esto no sustituye a leer las etiquetas.',

  mc_mp_q_when: '¿A qué hora sueles entrenar?',
  mc_mp_q_when_hint: 'Sirve para reforzar la comida de antes del entreno. Podrás cambiarlo día a día.',
  mc_mp_when_morning: 'Mañana',
  mc_mp_when_midday: 'Mediodía',
  mc_mp_when_afternoon: 'Tarde',
  mc_mp_when_evening: 'Noche',
  mc_mp_when_varies: 'Varía',
  mc_mp_when_unknown: 'hora sin concretar',
  mc_mp_when_none: 'Ese día no entreno',
  mc_mp_clarify_when: 'Cambiar la hora de este día',

  mc_mp_q_goal: '¿Hacia dónde quieres ir?',
  mc_mp_q_goal_hint: 'Todavía no tienes un peso objetivo guardado en la app. Con esto orientamos el plan.',
  mc_mp_goal_down: 'Bajar peso',
  mc_mp_goal_keep: 'Mantenerme',
  mc_mp_goal_up: 'Ganar peso',

  mc_mp_q_my_foods: 'Tus productos',
  mc_mp_q_my_foods_hint: 'Escribe lo que compras y sueles comer. Se guarda: no hay que reescribirlo cada vez.',
  mc_mp_my_foods_ph: 'Ej. pechuga de pavo, tortitas de arroz',
  mc_mp_my_foods_add: 'Añadir',
  mc_mp_my_foods_local: 'Tus productos están guardados en este dispositivo: cuando se active la base de datos pasarán a tu cuenta.',
  mc_mp_food_duplicate: 'Ese producto ya está en tu lista',

  mc_mp_missing_intro: 'Faltan {{n}} respuestas para poder planificar sin inventar nada:',
  mc_mp_missing_meals: 'comidas al día',
  mc_mp_missing_restrictions: 'restricciones',
  mc_mp_missing_training_when: 'hora de entreno',
  mc_mp_missing_goal: 'objetivo',

  mc_mp_progress_title: 'LO QUE LLEVAS',
  mc_mp_progress_n: '{{done}} de {{total}} comidas',
  mc_mp_day_done: '{{n}}/{{total}} hechas',
  mc_mp_training_badge: 'Entreno',
  mc_mp_pre_training: 'Antes',
  mc_mp_post_training: 'Después',
  mc_mp_uses_yours: 'Con lo que ya tienes: {{list}}',
  mc_mp_mark_done: 'Marcar hecha',
  mc_mp_done: 'Hecha',
  mc_mp_extras_title: 'TAMBIÉN TIENES',
  mc_mp_extras_hint: 'Productos tuyos que no encajan en ningún plato del catálogo. Úsalos de acompañamiento o entre horas.',
};
