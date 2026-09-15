// Entreno de boxeo por asaltos (punto 28).
//
// El equivalente al protocolo de cardio, pero en ASALTOS: dices el tiempo que
// tienes y sale la sesión entera, y al darle a empezar arranca el temporizador
// del Ring con esos asaltos ya puestos.
//
// ── POR QUÉ ESTOS TEXTOS PREGUNTAN TANTO ──
//
// Los dos primeros controles piden tiempo y sitio, y no hay valor por defecto.
// El tiempo porque es el límite duro: sin él la sesión sale de 40 minutos o de
// 90 y acierta por casualidad. El sitio porque cambia el entreno ENTERO — sin
// saco, un asalto es sombra y desplazamientos; con saco y material se
// estructura de otra forma. Devolverle una sesión de saco a quien entrena en su
// salón no es un fallo pequeño: es una sesión inservible.
//
// Módulo aparte porque `esquina.ts` ya pasa de 90 KB.
export default {
  mc_as_tab_boxing: 'Boxeo',

  mc_bx_title: 'Entreno de boxeo por asaltos',
  mc_bx_desc: 'Dime de cuánto tiempo dispones y dónde entrenas, y te monto la sesión entera: calentamiento, asaltos con lo que toca en cada uno, descansos y vuelta a la calma.',

  mc_bx_q_time: '¿Cuánto tiempo tienes?',
  mc_bx_q_place: '¿Dónde entrenas?',
  mc_bx_place_home: 'En casa',
  mc_bx_place_home_hint: 'Sin saco: sombra, pies y técnica',
  mc_bx_place_home_bag: 'En casa con saco',
  mc_bx_place_home_bag_hint: 'Saco en casa, sin compañero',
  mc_bx_place_gym: 'En el gimnasio',
  mc_bx_place_gym_hint: 'Con saco y material',

  mc_bx_notes_ph: '¿Algo que deba tener en cuenta? Lesiones, en qué quieres incidir…',
  mc_bx_generate: 'Montar la sesión',

  // Se dice cuál falta, no un "rellena los campos" genérico.
  mc_bx_need_time: 'Elige de cuánto tiempo dispones.',
  mc_bx_need_place: 'Dime dónde entrenas: sin saco el entreno es otro.',

  mc_bx_err_gen: 'No he podido montar la sesión. Prueba otra vez.',
  mc_bx_err_auth: 'Tienes que iniciar sesión para esto.',
  mc_bx_no_ai: 'Falta la clave de IA, así que no puedo montarte la sesión todavía. El temporizador del Ring funciona igual: puedes configurar los asaltos a mano.',
  mc_bx_saved_local: 'Guardado en este dispositivo. Se subirá cuando haya conexión.',
  mc_bx_local_only: 'Estos entrenos están solo en este dispositivo: falta aplicar la migración 0057.',

  mc_bx_mine: 'Tus entrenos de boxeo',
  mc_bx_total: '{{n}} min en total',
  mc_bx_more: 'y {{n}} asalto(s) más',
  mc_bx_start: 'Empezar',
  mc_bx_to_week: 'A la semana',

  // ── Temporizador ──
  // Sin esto, el cronómetro aparece con 8 asaltos puestos y no dice de dónde
  // han salido: parece que se han cambiado solos.
  tm_bx_loaded: 'Entreno cargado',
  tm_bx_script: 'El guion, asalto a asalto ({{n}})',
  tm_bx_warmup: 'calentar {{n}} min',
  tm_bx_cooldown: 'enfriar {{n}} min',
  tm_bx_saved: 'Entreno de boxeo registrado. Queda marcado en la Agenda.',
  mc_bx_head_sub: 'Le dices el tiempo y sale la sesión',
};
