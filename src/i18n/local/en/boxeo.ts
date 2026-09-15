// Round-based boxing workout (point 28).
//
// The cardio protocol's equivalent, but in ROUNDS: you say how long you have
// and the whole session comes out, and hitting start fires up the Ring timer
// with those rounds already set.
//
// ── WHY THIS COPY ASKS SO MUCH ──
//
// The first two controls ask for time and place, and neither has a default. The
// time because it is the hard limit: without it the session lands at 40 minutes
// or 90 and only gets it right by luck. The place because it changes the WHOLE
// workout — with no bag a round is shadow and footwork; with a bag and kit it is
// structured differently. Handing a bag session to someone training in their
// living room is not a small miss: it is an unusable session.
//
// Its own module: `esquina.ts` is already over 90 KB.
export default {
  mc_as_tab_boxing: 'Boxing',

  mc_bx_title: 'Round-based boxing workout',
  mc_bx_desc: 'Tell me how long you have and where you train, and I will build the whole session: warm-up, rounds with what to do in each one, rests and cool-down.',

  mc_bx_q_time: 'How long have you got?',
  mc_bx_q_place: 'Where are you training?',
  mc_bx_place_home: 'At home',
  mc_bx_place_home_hint: 'No bag: shadow, footwork, technique',
  mc_bx_place_home_bag: 'At home with a bag',
  mc_bx_place_home_bag_hint: 'Bag at home, no partner',
  mc_bx_place_gym: 'At the gym',
  mc_bx_place_gym_hint: 'With a bag and kit',

  mc_bx_notes_ph: 'Anything I should know? Injuries, what you want to work on…',
  mc_bx_generate: 'Build the session',

  // It says which one is missing, not a generic "fill in the fields".
  mc_bx_need_time: 'Pick how much time you have.',
  mc_bx_need_place: 'Tell me where you train: with no bag it is a different workout.',

  mc_bx_err_gen: 'I could not build the session. Try again.',
  mc_bx_err_auth: 'You need to sign in for this.',
  mc_bx_no_ai: 'The AI key is missing, so I cannot build the session yet. The Ring timer still works: you can set the rounds by hand.',
  mc_bx_saved_local: 'Saved on this device. It will sync when you are back online.',
  mc_bx_local_only: 'These workouts live only on this device: migration 0057 has not been applied.',

  mc_bx_mine: 'Your boxing workouts',
  mc_bx_total: '{{n}} min in total',
  mc_bx_more: 'and {{n}} more round(s)',
  mc_bx_start: 'Start',
  mc_bx_to_week: 'Into the week',

  // ── Timer ──
  // Without this the clock shows up with 8 rounds already set and says nothing
  // about where they came from: it looks like it changed on its own.
  tm_bx_loaded: 'Workout loaded',
  tm_bx_script: 'Round-by-round script ({{n}})',
  tm_bx_warmup: 'warm up {{n}} min',
  tm_bx_cooldown: 'cool down {{n}} min',
  tm_bx_saved: 'Boxing workout logged. It is ticked off in the Agenda.',
};
