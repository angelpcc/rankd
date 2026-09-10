// El flujo PLANIFICADO → HECHO, en textos (puntos 23-26).
//
// Las tarjetas de "hoy toca" leían la Agenda sin mirar si el bloque estaba
// completado, así que un entreno ya hecho seguía saliendo como pendiente. Al
// separar lo planificado-y-pendiente de lo ya entrenado aparece un estado
// nuevo: cuando no queda nada por hacer pero SÍ se ha entrenado, se confirma
// en vez de dejar el hueco vacío o —peor— insistir con "EMPEZAR".
//
// Es confirmación, no llamada a la acción: nunca lleva el botón rojo.
//
// Y desde el punto 26, Fuerza y Actividad no comparten tarjeta: cada una tiene
// su aviso, su sección y su texto. Antes solo cabía un pendiente en el Resumen
// y, al resolver la actividad, el bloque de fuerza ascendía a ese hueco —
// parecía que "aparecía Pierna" al terminar el cardio.
//
// Módulo aparte porque `esquina.ts` ya pasa de 90 KB.
export default {
  // ── Resumen · TodayCard · ya entrenado ──
  mc_hoy_done_chip: 'Completado',
  mc_hoy_done_title: 'Hoy ya entrenaste: {{what}}',
  mc_hoy_done_desc: 'Sesión registrada. Si quieres meter otra, entra en el día.',
  mc_hoy_done_cta: 'Ver el día',

  // ── Resumen · TodayCard · pendiente, una tarjeta por tipo ──
  // El tipo va en el distintivo, no en el titular: el titular es QUÉ toca
  // ("Pierna", "Cardio tarde — grasa"), que es lo que se lee de un vistazo.
  mc_hoy_p_str: 'Fuerza pendiente',
  mc_hoy_p_act: 'Actividad pendiente',
  mc_hoy_p_cta_str: 'Ir a Fuerza',
  mc_hoy_p_cta_act: 'Ir a Actividad',

  // ── Fuerza · StrengthSummary ──
  mc_strs_done_today: 'HOY YA ENTRENASTE',
  mc_strs_done_today_desc: 'Queda registrado en tu historial y en la Agenda del día.',
  mc_strs_done_today_more: 'Registrar otra sesión',

  // ── Actividad · ActivityTodayCard ──
  // El gemelo de la card de Fuerza. Antes Actividad no tenía ninguno: el único
  // sitio donde salía un cardio planificado era el Resumen.
  mc_hoy_act_title: 'HOY TOCA',
  mc_hoy_act_cta: 'Registrar ahora',
  mc_hoy_act_min: '{{n}} min',
  mc_hoy_act_rounds: '{{n}} asaltos',
  mc_hoy_act_done: 'HOY YA HICISTE ACTIVIDAD',
  mc_hoy_act_done_desc: 'Queda registrada en tu historial y en la Agenda del día.',
  mc_hoy_act_see_day: 'Ver el día',

  // ── Agenda · bloque sin rutina ni protocolo detrás ──
  // Se abre igual, pero llevando a la pantalla de registro en vez de a un
  // ejecutor en vivo. El texto lo dice para que nadie espere un cronómetro.
  mc_ag_go_log: 'Toca para registrar',

  // ── Planificar fuerza sin escribir la sesión entera ──
  // Planificar es decir QUÉ toca, no dejar el entreno escrito. "Mañana pecho y
  // espalda" es un plan completo; los ejercicios se deciden en el gimnasio.
  // Por eso guardar solo los grupos es el botón PRINCIPAL, y añadir ejercicios
  // el secundario: al revés, un gesto de dos toques se volvía un formulario.
  mc_dp_str_only_groups: 'Guardar así',
  mc_dp_str_add_ex: 'Añadir ejercicios (opcional)',

  // ── Agenda · resumen de lo entrenado ──
  mc_ag_done_sets_one: '1 serie',
  mc_ag_done_sets_other: '{{count}} series',
};
