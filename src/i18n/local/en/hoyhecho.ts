// The PLANNED → DONE flow, in copy (points 23-26).
//
// The "today" cards read the Agenda without checking whether the block was
// completed, so a session already done kept showing as pending. Separating
// planned-and-pending from already-trained brings in a new state: when nothing
// is left to do but there IS a logged session, it confirms instead of leaving
// an empty slot or — worse — insisting with "START".
//
// It is a confirmation, not a call to action: it never carries the red button.
//
// And since point 26, Strength and Activity no longer share a card: each has
// its own notice, its own section and its own copy. Before, only one pending
// item fit in the Summary and, once the activity was resolved, the strength
// block was promoted into that slot — it looked like "Legs appeared" when the
// cardio finished.
//
// Its own module because `esquina.ts` is already over 90 KB.
export default {
  // ── Summary · TodayCard · already trained ──
  mc_hoy_done_chip: 'Completed',
  mc_hoy_done_title: 'Trained today: {{what}}',
  mc_hoy_done_desc: 'Session logged. If you want another one, open the day.',
  mc_hoy_done_cta: 'See the day',

  // ── Summary · TodayCard · pending, one card per type ──
  // The type goes in the pill, not the headline: the headline is WHAT is due
  // ("Legs", "Evening cardio — fat"), which is what gets read at a glance.
  mc_hoy_p_str: 'Strength pending',
  mc_hoy_p_act: 'Activity pending',
  mc_hoy_p_cta_str: 'Go to Strength',
  mc_hoy_p_cta_act: 'Go to Activity',

  // ── Strength · StrengthSummary ──
  mc_strs_done_today: 'YOU TRAINED TODAY',
  mc_strs_done_today_desc: "It's in your history and in the day's Agenda.",
  mc_strs_done_today_more: 'Log another session',

  // ── Activity · ActivityTodayCard ──
  // The twin of the Strength card. Activity had none before: the only place a
  // planned cardio showed up was the Summary.
  mc_hoy_act_title: 'TODAY',
  mc_hoy_act_cta: 'Log it now',
  mc_hoy_act_min: '{{n}} min',
  mc_hoy_act_rounds: '{{n}} rounds',
  mc_hoy_act_done: 'YOU DID ACTIVITY TODAY',
  mc_hoy_act_done_desc: "It's in your history and in the day's Agenda.",
  mc_hoy_act_see_day: 'See the day',

  // ── Agenda · block with no routine or protocol behind it ──
  // It opens all the same, but leads to the logging screen instead of a live
  // player. The copy says so, so nobody expects a stopwatch.
  mc_ag_go_log: 'Tap to log',

  // ── Planning strength without writing the whole session ──
  // Planning is saying WHAT is due, not writing the workout out. "Chest and
  // back tomorrow" is a complete plan; the exercises get decided at the gym.
  // Hence saving just the groups is the PRIMARY button and adding exercises
  // the secondary one: the other way round turned two taps into a form.
  mc_dp_str_only_groups: 'Save as is',
  mc_dp_str_add_ex: 'Add exercises (optional)',

  // ── Agenda · summary of what was trained ──
  mc_ag_done_sets_one: '1 set',
  mc_ag_done_sets_other: '{{count}} sets',
};
