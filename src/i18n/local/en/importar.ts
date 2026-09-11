// The single door for bringing a plan in (Planificar › PlanImport).
//
// Importing used to live in three places: routines under Strength, cardio
// protocols under Activity and the week plan under the Advisor. You had to know
// what the document was BEFORE picking the right door, and a document with both
// strength and cardio in it had no good door at all.
//
// The copy here has one job: make clear that it takes whatever you paste, and
// that when the app is unsure it will ASK rather than decide on its own.
// Filing a treadmill table into the strength history is worse than one extra
// click.
//
// Its own module: `esquina.ts` is already over 90 KB.
export default {
  mc_imp_placeholder: 'Paste the plan here…\n\nExamples:\nMonday chest and back, bench press 4x8…\n0-5 min incline 2 speed 6…',

  // What was understood. "This is" when clear; a question when not.
  mc_imp_detected: 'This is',
  mc_imp_ask: 'What is this?',
  mc_imp_change: "That's not it, change",

  mc_imp_kind_routine: 'Strength routine',
  mc_imp_kind_protocol: 'Cardio protocol',
  mc_imp_kind_week: 'Week plan',
  mc_imp_kind_meals: 'Meal plan',

  // Without knowing the activity the table cannot be read: on a treadmill the
  // columns are incline and speed, on a rower they are metres. Ask, don't guess.
  mc_imp_which_activity: 'Which activity is it for?',

  mc_imp_go: 'Bring it in',
  // Spreading a week across days and filing a routine are different
  // outcomes: the button says which of the two is about to happen.
  mc_imp_go_week: 'Spread across the days',

  mc_imp_no_routine: 'No exercises found in there. Try one per line.',
  mc_imp_no_protocol: 'No minute-by-minute blocks found. Try "0-5 min, incline 2, speed 6".',
  mc_imp_saved_local: 'Saved on this device. It will sync when you are back online.',

  mc_imp_default_routine: 'Imported routine',
  mc_imp_default_protocol: 'Imported protocol',

  // Said on purpose: with no AI key the screen is NOT half-broken, the browser
  // reader parses the same text. Without this line it would look broken.
  mc_imp_no_ai: 'No AI configured: the text is still read.',

  // Photo of the document. AI only: the browser cannot read an image, so the
  // button stays hidden when no key is configured.
  mc_imp_photo: 'Upload a photo of the plan',
  mc_imp_photo_clear: 'remove',

  // ── Notices in the libraries, where the import button used to be ──
  // Removing the button is not enough: whoever used it will look where it was.
  // These two lines say where it moved and why that is better.
  // ── Step 2 of the importer: "and which days do you do this?" ──
  // A routine says "Day A, Day B"; a protocol says "40 min on the treadmill".
  // Neither carries a date, and the Agenda only understands dates. That piece is
  // missing, so it gets asked: spreading it out on its own (Mon, Wed, Fri) would
  // be inventing someone's week for them.
  mc_land_title: 'Which days do you do this?',
  mc_land_desc: 'Pick the weekday. Tap again to clear it. Anything left without a day is still saved, and you can place it later from the Agenda.',
  mc_land_day_unnamed: 'Unnamed day',
  mc_land_ex_count_one: '1 exercise',
  mc_land_ex_count_other: '{{count}} exercises',
  mc_land_confirm: 'Put it in the week',
  mc_land_skip: 'Not now',
  mc_land_added_one: 'Added to 1 day',
  mc_land_added_other: 'Added to {{count}} days',
};
