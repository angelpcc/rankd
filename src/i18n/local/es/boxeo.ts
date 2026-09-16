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
  mc_as_tab_boxing: 'Sesión',

  mc_bx_title: 'Móntame un entreno',
  mc_bx_desc: 'Dime qué deporte, cuánto tiempo tienes, dónde entrenas y qué material, y te monto la sesión entera. Los de combate salen por asaltos y arrancan el temporizador; el resto, con su tabla minuto a minuto.',

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
  mc_bx_q_disc: '¿Qué entrenas?',
  mc_bx_disc_boxing: 'Boxeo',
  mc_bx_disc_kick: 'Kickboxing',
  mc_bx_disc_muay: 'Muay Thai',
  mc_bx_disc_mma: 'MMA',
  mc_bx_q_gear: '¿Qué material tienes?',
  mc_bx_gear_ph: 'Comba, mancuernas de 10, bandas…',
  mc_bx_gear_rope: 'comba',
  mc_bx_gear_dumbbells: 'mancuernas',
  mc_bx_gear_bands: 'bandas',
  mc_bx_gear_pads: 'manoplas',
  mc_bx_gear_kettlebell: 'kettlebell',
  mc_bx_gear_partner: 'compañero',
  mc_bx_sitio_home: 'Entreno en casa, sin material pesado',
  mc_bx_sitio_home_bag: 'Entreno en casa y tengo saco',
  mc_bx_sitio_gym: 'Entreno en un gimnasio con material',
};
