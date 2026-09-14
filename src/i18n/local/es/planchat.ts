// El plan, hablando: la pantalla que sustituye al plan semanal y al plan por
// objetivo.
//
// Los dos eran formularios para la MISMA tarea, y nadie entendía en cuál
// entrar. Aquí se dice lo que se quiere, se pregunta lo que falte, el plan
// aparece dentro de la conversación y se cambia hablando hasta que cuadra.
//
// Los textos evitan a propósito el tono de asistente ("¡Claro! Con gusto te
// ayudo a..."): esto es un entrenador, y un entrenador va al grano.
export default {
  mc_as_tab_planchat: 'Plan',

  mc_pc_weeks_q: '¿Para cuántas semanas?',
  mc_pc_intro: 'Cuéntame qué quieres y para cuándo. Los días que puedes entrenar, cuánto rato tienes y si hay algo que no puedes hacer. Con eso te lo monto, y luego lo cambiamos hablando hasta que te cuadre.',
  mc_pc_sug_1: 'Quiero definir, puedo 6 días',
  mc_pc_sug_2: 'Fuerza por la mañana y cardio por la tarde',
  mc_pc_sug_3: 'Bajar grasa sin perder fuerza',
  mc_pc_ph: 'Escribe aquí…',
  mc_pc_thinking: 'Montándolo…',
  mc_pc_resumed: 'Este es el plan que tienes en marcha. Dime qué quieres cambiar.',

  // El plan se pinta como un mensaje más. Se marca cuál es el vigente porque
  // en una conversación larga quedan varias versiones a la vista y hay que
  // saber cuál es la que se va a guardar.
  mc_pc_plan_current: 'Tu plan',
  mc_pc_plan_old: 'Versión anterior',
  mc_pc_weeks_1: '1 semana',
  mc_pc_weeks_n: '{{n}} semanas',
  mc_pc_stat_strength: '{{n}} días de fuerza',
  mc_pc_stat_cardio: '{{n}} cardios',
  mc_pc_stat_meals: '{{n}} comidas',

  mc_pc_ready_title: 'Cuando te cuadre, lo mando a la app',
  mc_pc_ready_desc: 'Los entrenos van a la Agenda, los ejercicios a Fuerza, los cardios a Actividad y las comidas a Nutrición. Puedes seguir cambiándolo después.',
  mc_pc_send: 'Mandarlo a la app',
  mc_pc_saved: 'Hecho: {{n}} cosas puestas en tu Agenda.',
  mc_pc_done_title: 'Ya está en la app',
  mc_pc_done_desc: '{{n}} bloques repartidos por tus días.',
  mc_pc_done_kept: 'Los días que ya habías entrenado se han quedado como estaban.',
  mc_pc_go_agenda: 'Ver la Agenda',
  mc_pc_keep_talking: 'Seguir cambiándolo',

  mc_pc_err_auth: 'Tienes que iniciar sesión para esto.',
  mc_pc_agenda_off: 'El plan se ha montado, pero la Agenda no está disponible todavía.',
  mc_pc_no_ai: 'Falta la clave de IA, así que todavía no puedo montarte el plan. Mientras tanto puedes planificar a mano en Agenda › Planificar.',
};
