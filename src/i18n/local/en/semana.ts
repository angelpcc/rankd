// Multi-module weekly plan (point 21) and direct Agenda → execution navigation
// (point 21bis).
//
// Its own module: the i18n index loads every file per language and merges them.
//
// Prefixes: mc_sem_ (week plan) · mc_ag_run_* and mc_sem_mark_* (Agenda).
export default {
  // ══════════════════════════════════════════════════════════════
  // ADVISOR TAB
  // ══════════════════════════════════════════════════════════════
  mc_as_tab_week: 'Weekly plan',

  // ══════════════════════════════════════════════════════════════
  // WEEKLY PLAN · header
  // ══════════════════════════════════════════════════════════════
  mc_sem_eyebrow: 'WEEKLY PLAN',
  mc_sem_title: 'Ask for the week',
  mc_sem_title_2: 'in one go',
  mc_sem_sub: 'Strength, as many cardio sessions as you want and your meals, all in a single request. You review it, ask for any changes, and it gets spread across the days in your Agenda.',

  // ── Request ──
  mc_sem_ask_label: 'What do you want this week?',
  mc_sem_ask_hint: 'Write it the way you would tell your coach. The more specific, the less you will have to adjust afterwards.',
  mc_sem_ask_ph: `I have 5 days to train this week. I want a strength routine for those 5 days aimed at hypertrophy, nothing with boxing or football.

I also want a 40-minute incline walk in the afternoon to burn fat, with the incline and speed minute by minute.

Add a short morning cardio for the days I have time, and an easy one for after training.

And give me lunch and dinner for the 5 days, with basic ingredients that are quick to cook. Breakfast I already have sorted.`,

  mc_sem_checklist_title: 'WHAT HELPS TO SAY',
  mc_sem_checklist_days: 'How many days you have THIS week (it can change week to week).',
  mc_sem_checklist_goal: 'What the strength is aimed at: hypertrophy, strength, endurance…',
  mc_sem_checklist_exclusions: 'What you do NOT want in it. It is respected to the letter.',
  mc_sem_checklist_cardio: 'How many cardio sessions, when, and in what detail (you can ask minute by minute).',
  mc_sem_checklist_meals: 'Which meals you want and which ones you already have sorted.',

  mc_sem_ai_paused: 'The Advisor is paused right now. As soon as it is enabled you will be able to ask for the whole week from here.',
  mc_sem_generate: 'Build the week',
  mc_sem_generating: 'Building the week…',
  mc_sem_generating_note: 'This takes a bit longer than a normal question: it is building the strength days, the cardio segment by segment, and the meals.',
  mc_sem_err_generate: 'I could not build the plan. Try saying how many days you have and what you want on each one.',

  // ── Summary ──
  mc_sem_state_draft: 'DRAFT · NOT SAVED',
  mc_sem_state_committed: 'SAVED',
  mc_sem_week_of: 'Week of {{date}}',
  mc_sem_stat_days: 'Days',
  mc_sem_stat_strength: 'Strength',
  mc_sem_stat_cardio: 'Cardio',
  mc_sem_stat_meals: 'Meals',
  mc_sem_exclusions: 'DOES NOT INCLUDE',
  mc_sem_segments_n: '{{n}} segments',
  mc_sem_local_only: 'Saved on this device: it will move to your account once the database is enabled.',

  // ── Adjustments ──
  mc_sem_adjust_title: 'Anything to change?',
  mc_sem_adjust_hint: 'Ask for the specific change and it gets applied to this plan. No need to repeat the whole request.',
  mc_sem_adjust_ph: 'e.g. change Thursday\'s cardio',
  mc_sem_adjust_cta: 'Apply',
  mc_sem_adjusting: 'Applying…',
  mc_sem_adjusted: 'Change applied',
  mc_sem_err_adjust: 'I could not apply that change. Try putting it another way.',
  mc_sem_adjust_ex_cardio: "Change Thursday's cardio",
  mc_sem_adjust_ex_leg: "No legs on Wednesday",
  mc_sem_adjust_ex_shorter: 'Make the sessions shorter',
  mc_sem_adjust_ex_swap: 'Change the dinners, no time',

  // ── Confirm ──
  mc_sem_confirm: 'Save the week',
  mc_sem_confirm_note: 'Until you hit save, this touches neither your Agenda nor your sections.',
  mc_sem_discard: 'Discard this plan',
  mc_sem_discard_yes: 'Yes, discard',
  mc_sem_committed: 'Week saved and spread across your Agenda',
  mc_sem_agenda_off: 'The plan was saved to Strength and Activity, but the Agenda is not enabled on your account yet.',

  mc_sem_done_title: 'Done. Here is what you have now:',
  mc_sem_done_routine: 'A routine in Strength › Routines, with one day per training day.',
  mc_sem_done_protocols: '{{n}} protocols in Activity › Protocols, each with its own name.',
  mc_sem_done_agenda: '{{n}} blocks in your Agenda, spread by day and ready to open.',
  mc_sem_go_agenda: 'See it in the Agenda',
  mc_sem_new_plan: 'Ask for another week',

  // ══════════════════════════════════════════════════════════════
  // AGENDA · direct access to execution (point 21bis)
  // ══════════════════════════════════════════════════════════════
  mc_ag_run_strength: 'Tap to train',
  mc_ag_run_activity: 'Tap to start',
  mc_ag_run_opening: 'Opening…',
  mc_ag_run_missing: 'I can no longer find the routine or protocol for this block. You can mark it done by hand.',
  mc_ag_run_done: 'Done. It is marked in your Agenda.',
  mc_sem_mark_done: 'Mark as done',
  mc_sem_mark_undone: 'Remove the mark',
};
