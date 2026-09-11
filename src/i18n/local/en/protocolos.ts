// Activity protocols (point 16), prescribed routines (point 17) and the
// meal-advisor additions (point 20).
//
// Kept in its own module: the i18n index loads every file per language and
// merges them, so these three features get a readable file of their own
// instead of growing a 90 KB one.
//
// Prefixes: mc_pt_ (protocols) · mc_rp_ (routines) · mc_mp_ (meal advisor).
export default {
  // ══════════════════════════════════════════════════════════════
  // NEW ACTIVITY TYPES
  // ══════════════════════════════════════════════════════════════
  mc_act_kind_cinta: 'Treadmill',
  mc_act_kind_eliptica: 'Elliptical',
  mc_act_kind_remo: 'Rowing',

  // Activity section tabs
  mc_av_tab_log: 'Log',
  mc_av_tab_protocols: 'Protocols',

  // ══════════════════════════════════════════════════════════════
  // PROTOCOLS · Segment variables
  // ══════════════════════════════════════════════════════════════
  mc_pt_var_speed: 'Speed',
  mc_pt_var_incline: 'Incline',
  mc_pt_var_resist: 'Resistance',
  mc_pt_var_cadence: 'Cadence',
  mc_pt_var_pace100: '100 m pace',
  mc_pt_var_pace500: '500 m pace',
  mc_pt_var_stroke: 'Stroke rate',
  mc_pt_var_effort: 'Effort',

  // ── Library ──
  mc_pt_eyebrow: 'PROTOCOLS',
  mc_pt_title: 'Your session,',
  mc_pt_title_2: 'segment by segment',
  mc_pt_sub: 'Write the session with its segments once and play it live every time you do it. Works for treadmill, bike, swimming, rowing or whatever you train.',
  mc_pt_new: 'New protocol',
  mc_pt_import: 'Import',
  mc_pt_local_only: 'Saved on this device only: it will move to your account once the database is enabled.',
  mc_pt_empty_title: 'No protocols yet',
  mc_pt_empty_desc: 'Paste the table your coach gave you into Agenda › Plan and we turn it into a script you can follow while training. Or build one by hand, segment by segment.',
  mc_pt_play: 'Start',
  mc_pt_untitled: 'Untitled protocol',
  mc_pt_saved: 'Protocol saved',
  mc_pt_deleted: 'Protocol deleted',
  mc_pt_totals: '{{n}} segments · {{time}}',
  mc_pt_last_done: 'Completed on {{date}}',
  mc_pt_last_partial: 'Last done on {{date}}',
  mc_pt_run_saved: 'Protocol completed and saved to your history',
  mc_pt_run_saved_partial: 'Saved what you did to your history',

  // ── Editor ──
  mc_pt_editor_eyebrow: 'PROTOCOL',
  mc_pt_editor_title: 'Session segments',
  mc_pt_field_name: 'Name',
  mc_pt_field_name_ph: 'e.g. Treadmill intervals 40 min',
  mc_pt_segments: 'Segments',
  mc_pt_by_time: 'By time',
  mc_pt_by_distance: 'By distance',
  mc_pt_field_duration: 'Segment duration',
  mc_pt_field_meters: 'Segment metres',
  mc_pt_field_label: 'Segment name (optional)',
  mc_pt_field_label_ph: 'e.g. Warm-up',
  mc_pt_move_up: 'Move up',
  mc_pt_move_down: 'Move down',
  mc_pt_duplicate: 'Duplicate',
  mc_pt_add_segment: 'Add segment',
  mc_pt_field_note: 'Note (optional)',
  mc_pt_field_note_ph: 'Where it comes from, what it is for…',
  mc_pt_save: 'Save protocol',

  // ── Player ──
  mc_pt_player_eyebrow: 'IN PROGRESS',
  mc_pt_segment_of: 'Segment {{n}} of {{total}}',
  mc_pt_remaining: 'Left in this segment',
  mc_pt_distance_manual: 'This segment goes by distance: tap "Done" when you finish it.',
  mc_pt_next: 'Up next',
  mc_pt_in_time: 'In {{time}}',
  mc_pt_last_segment: 'This is the last segment',
  mc_pt_show_all: 'See the whole protocol',
  mc_pt_start: 'Start',
  mc_pt_resume: 'Resume',
  mc_pt_pause: 'Pause',
  mc_pt_skip: 'Next',
  mc_pt_done_segment: 'Done',
  mc_pt_finish_early: 'Finish early',
  mc_pt_empty_protocol: 'This protocol has no segments.',

  mc_pt_done_title: 'Protocol finished!',
  mc_pt_done_sub: 'Save it and it lands in your Activity history like any other session.',
  mc_pt_stat_time: 'Time',
  mc_pt_stat_segments: 'Segments',
  mc_pt_stat_distance: 'Distance',
  mc_pt_save_session: 'Save session',
  mc_pt_discard_run: 'Leave without saving',

  mc_pt_exit_title: 'Finish here?',
  mc_pt_exit_desc: 'You are at {{time}} and {{n}} of {{total}} segments. You can save what you did as a session.',
  mc_pt_exit_save: 'Save what I did',
  mc_pt_exit_too_short: 'Still too short to save as a session.',
  mc_pt_exit_discard: 'Leave without saving',

  // ── Import ──
  mc_pt_import_title: 'Import protocol',
  mc_pt_import_desc: 'Paste your routine table (minute, incline, speed…) or upload a photo and we turn it into segments. You can review it before saving.',
  mc_pt_import_kind: 'Which activity is it?',
  mc_pt_import_text: 'Paste the text here',
  mc_pt_import_text_ph: `0-5   incl 1   speed 5.5
5-10  incl 2   speed 6
10-15 incl 3   speed 6.5`,
  mc_pt_import_photo: 'Upload a photo of the document',
  mc_pt_import_ai_paused: 'The Advisor is paused right now. You can paste the text and read it here, offline.',
  mc_pt_import_warn: 'Some durations had to be inferred. Check the segments before saving.',
  mc_pt_import_with_ai: 'Read with the Advisor',
  mc_pt_import_reading: 'Reading…',
  mc_pt_import_here: 'Read it right here',
  mc_pt_import_here_hint: 'No AI needed: your browser reads it. Works with minute · incline · speed tables.',
  mc_pt_import_nothing: 'I could not find segments in that document.',
  mc_pt_import_fallback: 'The Advisor could not do it; we read it here instead. Please review.',
  mc_pt_imported_name: 'Imported protocol',

  // ══════════════════════════════════════════════════════════════
  // PRESCRIBED ROUTINES
  // ══════════════════════════════════════════════════════════════
  mc_str_tab_routines: 'Routines',

  // ── Library ──
  mc_rp_eyebrow: 'ROUTINES',
  mc_rp_title: 'Your routine,',
  mc_rp_title_2: 'set by set',
  mc_rp_sub: 'Save your routine by day and open it when you train: tick each set as you go and adjust the real weight for the day.',
  mc_rp_new: 'New routine',
  mc_rp_import: 'Import',
  mc_rp_local_only: 'Saved on this device only: it will move to your account once the database is enabled.',
  mc_rp_empty_title: 'No routines yet',
  mc_rp_empty_desc: 'Paste the routine you already have into Agenda › Plan and we turn it into a checklist you can tick off. Or build it by hand, with your days and exercises.',
  mc_rp_untitled: 'Untitled routine',
  mc_rp_saved: 'Routine saved',
  mc_rp_deleted: 'Routine deleted',
  mc_rp_session_saved: 'Session saved to your Strength history',
  mc_rp_totals: '{{days}} days · {{ex}} exercises · {{sets}} sets',
  mc_rp_last_used: 'last used on {{date}}',
  mc_rp_start_day: 'Train',
  mc_rp_day_n: 'Day {{n}}',
  mc_rp_day_summary: '{{n}} exercises',

  // ── Editor ──
  mc_rp_editor_eyebrow: 'ROUTINE',
  mc_rp_editor_title: 'Days and exercises',
  mc_rp_field_name: 'Routine name',
  mc_rp_field_name_ph: 'e.g. 5-day split',
  mc_rp_days: 'Days',
  mc_rp_field_day_name_ph: 'e.g. Push · Chest, shoulders and triceps',
  mc_rp_field_exercise_ph: 'Exercise name',
  mc_rp_add_exercise: 'Add exercise',
  mc_rp_add_day: 'Add day',
  mc_rp_duplicate_day: 'Duplicate day',
  mc_rp_delete_day: 'Delete day',
  mc_rp_sets: 'Sets',
  mc_rp_reps_min: 'Reps',
  mc_rp_reps_max: 'Up to',
  mc_rp_seconds: 'Seconds',
  mc_rp_meters: 'Metres',
  mc_rp_weight: 'Weight',
  mc_rp_group: 'Group',
  mc_rp_tracking: 'Measured by',
  mc_rp_track_reps: 'Reps',
  mc_rp_track_time: 'Time',
  mc_rp_track_distance: 'Distance',
  mc_rp_field_note: 'Note (optional)',
  mc_rp_field_note_ph: 'Who it came from, which block it is for…',
  mc_rp_save: 'Save routine',

  // ── Live checklist ──
  mc_rp_progress: '{{done}} of {{total}} sets',
  mc_rp_check_all: 'Tick all',
  mc_rp_uncheck_all: 'Untick',
  mc_rp_set_n: 'Set {{n}}',
  mc_rp_unit_reps: 'reps',
  mc_rp_runner_hint: 'The weight is prefilled with what you lifted last time. Change it if today is different: what you tick here is what gets saved.',
  mc_rp_finish_cta: 'Finish session',

  mc_rp_finish_title: 'Good work',
  mc_rp_finish_sub: 'You completed {{done}} of {{total}} sets. Only the ones you ticked get saved.',
  mc_rp_finish_date: 'Which day was it?',
  mc_rp_finish_slot: 'Time of day',
  mc_rp_finish_save: 'Save to my history',
  mc_rp_finish_back: 'Back to the checklist',
  mc_rp_slot_none: 'Single',
  mc_rp_slot_morning: 'Morning',
  mc_rp_slot_afternoon: 'Afternoon',
  mc_rp_slot_evening: 'Evening',

  mc_rp_exit_title: 'Leave the session?',
  mc_rp_exit_desc: 'You have {{done}} of {{total}} sets ticked. You can save them before leaving.',
  mc_rp_exit_save: 'Save what I did',
  mc_rp_exit_discard: 'Leave without saving',

  // ── Import ──
  mc_rp_import_title: 'Import routine',
  mc_rp_import_desc: 'Paste your written routine (days, exercises and sets) or upload a photo and we turn it into a checklist. You can review it before saving.',
  mc_rp_import_text: 'Paste the text here',
  mc_rp_import_text_ph: `PUSH
Bench press 4x8-10
Overhead press 3x10
Dips 3x12

PULL
Pull-ups 4x8
Barbell row 4x10`,
  mc_rp_import_photo: 'Upload a photo of the document',
  mc_rp_import_ai_paused: 'The Advisor is paused right now. You can paste the text and read it here, offline.',
  mc_rp_import_with_ai: 'Read with the Advisor',
  mc_rp_import_reading: 'Reading…',
  mc_rp_import_here: 'Read it right here',
  mc_rp_import_here_hint: 'No AI needed: your browser reads it. Works with the "Bench press 4x8-10" format.',
  mc_rp_import_nothing: 'I could not find a routine in that document.',
  mc_rp_import_fallback: 'The Advisor could not do it; we read it here instead. Please review.',
  mc_rp_imported_name: 'Imported routine',

  // ══════════════════════════════════════════════════════════════
  // MEAL ADVISOR · what point 20 adds
  // ══════════════════════════════════════════════════════════════
  mc_mp_required_title: 'BEFORE PLANNING',

  mc_mp_q_meals: 'How many meals a day do you eat?',
  mc_mp_q_meals_hint: 'This decides how the day is split. No answer is better than another.',
  mc_mp_meals_n: '{{n}} meals',

  mc_mp_q_restrictions: 'Any allergy, intolerance or something you do not eat?',
  mc_mp_q_restrictions_hint: 'Dishes containing it are dropped. If you have none, say so too.',
  mc_mp_q_restrictions_ph: 'e.g. no lactose, no pork',
  mc_mp_restr_none: 'None',
  mc_mp_restr_lactose: 'Lactose',
  mc_mp_restr_gluten: 'Gluten',
  mc_mp_restr_pork: 'Pork',
  mc_mp_restr_fish: 'Fish',
  mc_mp_restr_nuts: 'Nuts',
  mc_mp_restr_too_tight: 'With those restrictions some meal slots run out of dishes. You may see options that do not fully fit: check them.',
  mc_mp_restr_disclaimer: 'We filter by known ingredients. With a real allergy, always check each dish: this does not replace reading the labels.',

  mc_mp_q_when: 'When do you usually train?',
  mc_mp_q_when_hint: 'Used to boost the meal before training. You can change it day by day.',
  mc_mp_when_morning: 'Morning',
  mc_mp_when_midday: 'Midday',
  mc_mp_when_afternoon: 'Afternoon',
  mc_mp_when_evening: 'Evening',
  mc_mp_when_varies: 'It varies',
  mc_mp_when_unknown: 'time not set',
  mc_mp_when_none: "I don't train that day",
  mc_mp_clarify_when: 'Change the time for this day',

  mc_mp_q_goal: 'Where do you want to go?',
  mc_mp_q_goal_hint: 'You have no target weight saved in the app yet. This is what steers the plan.',
  mc_mp_goal_down: 'Lose weight',
  mc_mp_goal_keep: 'Maintain',
  mc_mp_goal_up: 'Gain weight',

  mc_mp_q_my_foods: 'Your own products',
  mc_mp_q_my_foods_hint: 'Write what you buy and usually eat. It gets saved: no need to retype it every time.',
  mc_mp_my_foods_ph: 'e.g. turkey breast, rice cakes',
  mc_mp_my_foods_add: 'Add',
  mc_mp_my_foods_local: 'Your products are saved on this device: they will move to your account once the database is enabled.',
  mc_mp_food_duplicate: 'That product is already on your list',

  mc_mp_missing_intro: '{{n}} answers missing so we can plan without making anything up:',
  mc_mp_missing_meals: 'meals per day',
  mc_mp_missing_restrictions: 'restrictions',
  mc_mp_missing_training_when: 'training time',
  mc_mp_missing_goal: 'goal',

  mc_mp_progress_title: 'HOW FAR YOU ARE',
  mc_mp_progress_n: '{{done}} of {{total}} meals',
  mc_mp_day_done: '{{n}}/{{total}} done',
  mc_mp_training_badge: 'Training',
  mc_mp_pre_training: 'Before',
  mc_mp_post_training: 'After',
  mc_mp_uses_yours: 'Using what you already have: {{list}}',
  mc_mp_mark_done: 'Mark as done',
  mc_mp_done: 'Done',
  mc_mp_extras_title: 'YOU ALSO HAVE',
  mc_mp_extras_hint: 'Your products that do not fit any dish in the catalogue. Use them as a side or between meals.',
};
