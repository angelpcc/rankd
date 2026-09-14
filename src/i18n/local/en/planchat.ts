// The plan, by talking: the screen that replaces the week plan and the
// objective plan.
//
// Both were forms for the SAME job, and nobody knew which one to open. Here
// you say what you want, it asks for what is missing, the plan shows up
// inside the conversation and you change it by talking until it fits.
//
// The copy deliberately avoids assistant-speak ("Sure! I would be happy to
// help you..."): this is a coach, and a coach gets to the point.
export default {
  mc_as_tab_planchat: 'Plan',

  mc_pc_weeks_q: 'How many weeks?',
  mc_pc_intro: 'Tell me what you want and by when. Which days you can train, how long you have, and anything you cannot do. I will build it, and then we change it by talking until it fits.',
  mc_pc_sug_1: 'I want to get lean, I can train 6 days',
  mc_pc_sug_2: 'Strength in the morning, cardio in the afternoon',
  mc_pc_sug_3: 'Lose fat without losing strength',
  mc_pc_ph: 'Type here…',
  mc_pc_thinking: 'Building it…',
  mc_pc_resumed: 'This is the plan you have running. Tell me what you want to change.',

  // The plan is drawn as one more message. The live one is marked because a
  // long conversation leaves several versions on screen and you need to know
  // which one is going to be saved.
  mc_pc_plan_current: 'Your plan',
  mc_pc_plan_old: 'Earlier version',
  mc_pc_weeks_1: '1 week',
  mc_pc_weeks_n: '{{n}} weeks',
  mc_pc_stat_strength: '{{n}} strength days',
  mc_pc_stat_cardio: '{{n}} cardio slots',
  mc_pc_stat_meals: '{{n}} meals',

  mc_pc_ready_title: 'When it fits, I send it to the app',
  mc_pc_ready_desc: 'Sessions go to the Agenda, exercises to Strength, cardio to Activity and meals to Nutrition. You can keep changing it afterwards.',
  mc_pc_send: 'Send it to the app',
  mc_pc_saved: 'Done: {{n}} things placed in your Agenda.',
  mc_pc_done_title: 'It is in the app',
  mc_pc_done_desc: '{{n}} blocks spread across your days.',
  mc_pc_done_kept: 'The days you had already trained were left as they were.',
  mc_pc_go_agenda: 'Open the Agenda',
  mc_pc_keep_talking: 'Keep changing it',

  mc_pc_err_auth: 'You need to sign in for this.',
  mc_pc_agenda_off: 'The plan is built, but the Agenda is not available yet.',
  mc_pc_no_ai: 'The AI key is missing, so I cannot build the plan yet. In the meantime you can plan by hand in Agenda › Plan.',
};
