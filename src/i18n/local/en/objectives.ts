// AI plan by objective (Mi Esquina › Progress › AI Plan).
// Prefix op_ ("objective plan").
export default {
  // ── Header ──
  op_eyebrow: 'AI PLAN',
  op_title: 'Your goal,',
  op_title_2: 'your plan',
  op_sub: 'Tell me what you\'re aiming for and I\'ll build a weekly plan of training, cardio and nutrition tailored to you.',

  // ── Coming soon (no API key) ──
  op_soon_title: 'AI PLAN',
  op_soon_desc: 'Once we turn AI on, you\'ll be able to ask for a full plan (training + cardio + nutrition) built around your goal, adjust it in plain words and add it to your Agenda with a tap.',
  op_soon_tag: 'coming soon',

  // ── Step 1: objective ──
  op_step1_title: 'What\'s your goal?',
  op_step1_hint: 'Pick a quick one or write it in your own words.',
  op_preset_lose_weight: 'Lose weight',
  op_preset_gain_muscle: 'Gain muscle',
  op_preset_endurance: 'Improve endurance',
  op_preset_fight_prep: 'Prep for a fight',
  op_preset_stay_fit: 'Stay in shape',
  op_custom_ph: 'e.g. Drop 2 kg before June',
  op_step1_next: 'Next',

  // ── Step 2: calibration questions ──
  op_step2_title: 'Personalise your plan',
  op_step2_hint: 'Every question is optional. The more you answer, the more tailored the plan.',
  op_skip: 'Skip',
  op_skip_all: 'Skip all',

  op_q_days_label: 'How many days a week can you train?',
  op_q_time_label: 'How long per session?',
  op_q_cardio_label: 'Can you do cardio on top of training?',
  op_q_cardio_yes: 'Yes',
  op_q_cardio_no: 'No',
  op_q_cardio_minutes_ph: 'Minutes per day',
  op_q_cook_label: 'Do you have time to cook/prep meals?',
  op_q_cook_yes: 'Yes',
  op_q_cook_sometimes: 'Sometimes',
  op_q_cook_no: 'No',
  op_q_notes_label: 'Anything else I should know?',
  op_q_notes_ph: 'Injuries, schedule, preferences, foods you don\'t eat...',
  op_time_30: '30 min',
  op_time_45: '45 min',
  op_time_60: '1 h',
  op_time_90: '1.5 h',
  op_time_120: '2 h+',

  op_step2_generate: 'Generate my plan',
  op_step2_generating: 'Building your plan',

  // ── Step 3: plan preview ──
  op_plan_your: 'Your plan',
  op_week: 'Week',
  op_day_monday: 'Monday',
  op_day_tuesday: 'Tuesday',
  op_day_wednesday: 'Wednesday',
  op_day_thursday: 'Thursday',
  op_day_friday: 'Friday',
  op_day_saturday: 'Saturday',
  op_day_sunday: 'Sunday',
  op_field_training: 'Training',
  op_field_cardio: 'Cardio',
  op_field_nutrition: 'Nutrition',
  op_field_notes: 'Notes',
  op_day_rest: 'Rest',

  // ── Adjust & save ──
  op_adjust_title: 'Want to tweak anything?',
  op_adjust_ph: 'e.g. Drop Saturdays; add more cardio; no dairy...',
  op_adjust_apply: 'Regenerate with these tweaks',
  op_adjust_applying: 'Applying tweaks',
  op_save_agenda: 'Add to my agenda',
  op_saving: 'Adding…',
  op_saved_agenda: '{{n}} sessions added to your agenda',
  op_saved_none: 'Couldn\'t add the plan',

  // ── Active plan status ──
  op_active_plan: 'Active plan',
  op_no_active: 'You don\'t have an active plan yet. Build one with your goal.',
  op_start_over: 'Build a new plan',
  op_start_over_confirm: 'Building a new one archives the current one. Continue?',
  op_version: 'v{{n}}',
  op_created_at: 'Created on {{date}}',
  op_archive: 'Archive plan',
  op_archived_toast: 'Plan archived',

  // ── Errors ──
  op_err_no_objective: 'Write your goal first.',
  op_err_generate: 'Couldn\'t generate the plan. Try being more specific about the goal.',
  op_err_quota_out: 'You\'ve used up your AI credits for this month.',
  op_err_generic: 'Something went wrong. Try again in a moment.',

  op_disclaimer_prefix: 'Note:',
  // ── Print / PDF view (Block B.7) ──
  op_print_download: 'Download PDF',
  op_print_back: 'Back',
  op_print_objective: 'Objective',
  op_print_duration: 'Duration',
  op_print_generated: 'Generated',
  op_print_weeks_n: '{{n}} weeks',
  op_print_generated_by: 'Generated in RANKD',
  op_print_no_plan_title: 'No active plan',
  op_print_no_plan_desc: "You haven't created a plan yet. Go back to My Corner › Progress › Goals.",
};
