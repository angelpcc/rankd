// Open advisor chat (point 18) and the fighter repertoire in the exercise
// library (point 19).
//
// Its own module: the i18n index loads every file per language and merges them,
// so each feature block gets a readable file instead of growing `esquina.ts`.
//
// Prefixes: mc_as_ (advisor) · mc_exlib_ and mc_eq_ (library).
export default {
  // ══════════════════════════════════════════════════════════════
  // ADVISOR · tabs
  // ══════════════════════════════════════════════════════════════
  mc_as_tab_ask: 'Ask',
  mc_as_tab_plan: 'Goal plan',

  // ── Open chat ──
  mc_as_ask_eyebrow: 'ASK',
  mc_as_ask_title: 'Ask',
  mc_as_ask_title_2: 'anything',
  mc_as_ask_sub: 'Loose questions about nutrition, technique, training or anything else. No forms: you ask, it answers, and you can keep pulling on the same thread.',
  mc_as_ask_coach_title: 'Advisor',
  mc_as_ask_coach_intro: 'Ask me anything: what to cook with what you have in, a technique question, how to spread the week out, or what to do if you are coming in heavy.',
  mc_as_ask_note: 'The conversation stays while you are in My Corner. If you close the session, the thread starts over.',

  // Starter prompts. Deliberately concrete: a vague example ("give me nutrition
  // tips") teaches people to use the tool badly.
  mc_as_sug_dinner: 'I have eggs, rice and tuna. What do I cook?',
  mc_as_sug_technique: 'How do I improve my jab without sparring?',
  mc_as_sug_rest: 'How much rest before I compete?',
  mc_as_sug_weight: "I'm 3 kg over and weigh in two weeks",

  // ══════════════════════════════════════════════════════════════
  // LIBRARY · fighter repertoire
  // ══════════════════════════════════════════════════════════════
  mc_exlib_fighter: 'Fighter',
  mc_exlib_fighter_badge: 'Fighter',
  mc_exlib_fighter_on: 'Showing only what you can do without machines.',
  mc_exlib_fighter_title: 'Fighter exercises',
  mc_exlib_fighter_desc: 'Pull-ups and their variants, calisthenics, battle ropes, plyometrics, rotational core, neck work, sledgehammer and tyre. What gets trained in a combat gym or a camp, without depending on a machine room.',
  mc_exlib_fighter_cta: 'See all {{n}}',

  // New equipment the fighter repertoire brings in.
  mc_eq_rope: 'Ropes',
  mc_eq_odd: 'Heavy object',

  // ══════════════════════════════════════════════════════════════
  // PRE-EXISTING GAP
  //
  // `SectionCoach` uses these two keys when saving the plan agreed in the
  // conversation, and they were not translated anywhere: they would have shown
  // on screen as "mc_ai_plan_added_agenda". Today that path only runs in the
  // 'training' and 'nutrition' sections (the open chat offers no saving), which
  // is why nobody noticed. Filled in here so it never surfaces.
  // ══════════════════════════════════════════════════════════════
  mc_ai_plan_added_agenda: 'Added {{count}} sessions to your Agenda',
  mc_ai_meals_added: 'Added {{count}} meals to your diary',
};
