// Plan semanal multi-módulo (punto 21) y acceso directo Agenda → ejecución
// (punto 21bis).
//
// Módulo aparte: el índice de i18n carga todos los archivos de cada idioma y
// los fusiona.
//
// Prefijos: mc_sem_ (week plan) · mc_ag_run_* y mc_sem_mark_* (Agenda).
export default {
  // ══════════════════════════════════════════════════════════════
  // PESTAÑA DEL ASESOR
  // ══════════════════════════════════════════════════════════════
  mc_as_tab_week: 'Plan semanal',

  // ══════════════════════════════════════════════════════════════
  // PLAN SEMANAL · cabecera
  // ══════════════════════════════════════════════════════════════
  mc_sem_eyebrow: 'PLAN SEMANAL',
  mc_sem_title: 'Pide la semana',
  mc_sem_title_2: 'de una vez',
  mc_sem_sub: 'Fuerza, los cardios que quieras y las comidas, todo en una sola petición. Lo revisas, pides los cambios que haga falta y se reparte por días en tu Agenda.',

  // ── Petición ──
  mc_sem_ask_label: '¿Qué quieres esta semana?',
  mc_sem_ask_hint: 'Escríbelo como se lo contarías a tu entrenador. Cuanto más concreto, menos tendrás que ajustar después.',
  mc_sem_ask_ph: `Esta semana tengo 5 días para entrenar. Quiero rutina de fuerza para esos 5 días orientada a hipertrofia, sin nada de boxeo ni fútbol.

Además quiero un cardio de 40 minutos por la tarde tipo caminata con inclinación para quemar grasa, con la inclinación y la velocidad minuto a minuto.

Añádeme también un cardio corto por la mañana para los días que tenga tiempo, y otro sencillo para después de entrenar.

Y hazme comida y cena para los 5 días, con alimentos básicos y rápidos de cocinar. El desayuno ya lo tengo resuelto.`,

  mc_sem_checklist_title: 'LO QUE CONVIENE DECIR',
  mc_sem_checklist_days: 'Cuántos días tienes ESTA semana (puede cambiar cada semana).',
  mc_sem_checklist_goal: 'A qué orientas la fuerza: hipertrofia, fuerza, resistencia…',
  mc_sem_checklist_exclusions: 'Qué NO quieres que aparezca. Se respeta al pie de la letra.',
  mc_sem_checklist_cardio: 'Cuántos cardios, cuándo y con qué detalle (puedes pedir minuto a minuto).',
  mc_sem_checklist_meals: 'Qué comidas quieres y cuáles ya tienes resueltas.',

  mc_sem_ai_paused: 'El Asesor está en pausa ahora mismo. En cuanto se active podrás pedir la semana completa desde aquí.',
  mc_sem_generate: 'Montar la semana',
  mc_sem_generating: 'Montando la semana…',
  mc_sem_generating_note: 'Esto tarda un poco más que una consulta normal: está montando la fuerza, los cardios tramo a tramo y las comidas.',
  mc_sem_err_generate: 'No he podido montar el plan. Prueba a decir cuántos días tienes y qué quieres en cada uno.',

  // ── Resumen ──
  mc_sem_state_draft: 'BORRADOR · SIN GUARDAR',
  mc_sem_state_committed: 'GUARDADO',
  mc_sem_week_of: 'Semana del {{date}}',
  mc_sem_stat_days: 'Días',
  mc_sem_stat_strength: 'Fuerza',
  mc_sem_stat_cardio: 'Cardios',
  mc_sem_stat_meals: 'Comidas',
  mc_sem_exclusions: 'NO INCLUYE',
  mc_sem_segments_n: '{{n}} tramos',
  mc_sem_local_only: 'Guardado en este dispositivo: cuando se active la base de datos pasará a tu cuenta.',

  // ── Ajustes ──
  mc_sem_adjust_title: '¿Hay algo que cambiar?',
  mc_sem_adjust_hint: 'Pide el cambio concreto y se aplica sobre este plan. No hace falta repetir toda la petición.',
  mc_sem_adjust_ph: 'Ej. cambia el cardio del jueves',
  mc_sem_adjust_cta: 'Aplicar',
  mc_sem_adjusting: 'Aplicando…',
  mc_sem_adjusted: 'Cambio aplicado',
  mc_sem_err_adjust: 'No he podido aplicar ese cambio. Prueba a decirlo de otra forma.',
  mc_sem_adjust_ex_cardio: 'Cambia el cardio del jueves',
  mc_sem_adjust_ex_leg: 'El miércoles no quiero pierna',
  mc_sem_adjust_ex_shorter: 'Las sesiones más cortas',
  mc_sem_adjust_ex_swap: 'Cambia las cenas, no tengo tiempo',

  // ── Confirmar ──
  mc_sem_confirm: 'Guardar la semana',
  mc_sem_confirm_note: 'Hasta que le des a guardar, esto no toca ni tu Agenda ni tus secciones.',
  mc_sem_discard: 'Descartar este plan',
  mc_sem_discard_yes: 'Sí, descartar',
  mc_sem_committed: 'Semana guardada y repartida en tu Agenda',
  mc_sem_agenda_off: 'El plan se ha guardado en Fuerza y Actividad, pero la Agenda todavía no está activa en tu cuenta.',

  mc_sem_done_title: 'Listo. Esto es lo que tienes ahora:',
  mc_sem_done_routine: 'Una rutina en Fuerza › Rutinas, con un día por cada día de entreno.',
  mc_sem_done_protocols: '{{n}} protocolos en Actividad › Protocolos, cada uno con su nombre.',
  mc_sem_done_agenda: '{{n}} bloques en tu Agenda, repartidos por día y listos para abrir.',
  mc_sem_go_agenda: 'Ver en la Agenda',
  mc_sem_new_plan: 'Pedir otra semana',

  // ══════════════════════════════════════════════════════════════
  // AGENDA · acceso directo a la ejecución (punto 21bis)
  // ══════════════════════════════════════════════════════════════
  mc_ag_run_strength: 'Toca para entrenar',
  mc_ag_run_activity: 'Toca para empezar',
  mc_ag_run_opening: 'Abriendo…',
  mc_ag_run_missing: 'Ya no encuentro la rutina o el protocolo de este bloque. Puedes marcarlo como hecho a mano.',
  mc_ag_run_done: 'Hecho. Queda marcado en tu Agenda.',
  mc_sem_mark_done: 'Marcar como hecho',
  mc_sem_mark_undone: 'Quitar la marca',
};
