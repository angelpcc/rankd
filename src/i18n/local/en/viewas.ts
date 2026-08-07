// Admin panel "View as" mode.
export default {
  // ── Fixed bar ──
  va_bar_mode: 'VIEW MODE',
  va_bar_viewing: 'Viewing as',
  va_bar_readonly: 'Read only',
  va_bar_exit: 'Exit view mode',
  va_bar_exit_short: 'Exit',
  va_blocked: 'Action not available in view mode',
  va_blocked_desc: 'View mode is for reviewing only. Exit it to act with your own account.',
  va_not_available: 'Not available in view mode',

  // ── Admin panel ──
  va_title: 'VIEW AS',
  va_title_2: 'ANOTHER PROFILE',
  va_eyebrow: 'REVIEW',
  va_sub: 'Walk through the platform in another user type\'s shoes to check everything looks and works right. You never leave your admin account.',
  va_tab_presets: 'By profile type',
  va_tab_users: 'Real user',
  va_start: 'Enter',
  va_current_title: 'You are in view mode',
  va_current_desc: 'Right now you are seeing the platform as {{name}}.',
  va_exit_now: 'EXIT VIEW MODE',
  va_search_user: 'Search by name or location...',
  va_no_users: 'No user matches your search.',
  va_loading_users: 'Loading users...',
  va_users_hint: 'Pick someone from the list to see the platform exactly as they see it.',
  va_presets_hint: 'Test profiles for reviewing the interface. They never touch anyone\'s data.',

  // ── Synthetic profiles ──
  va_preset_fighter_pro: 'Competing fighter',
  va_preset_fighter_pro_desc: 'Full My Corner: sparring, technique notes, fight prep and division weight.',
  va_preset_fighter_hobby: 'Hobby fighter',
  va_preset_fighter_hobby_desc: 'Simplified My Corner, with nothing about competing.',
  va_preset_promoter: 'Promoter',
  va_preset_promoter_desc: 'Management dashboard: events, tickets, talent and applications.',
  va_preset_gym: 'Gym or club',
  va_preset_gym_desc: 'Dashboard with storefront, gallery and fighter search.',
  va_preset_coach: 'Coach',
  va_preset_coach_desc: 'Club space: weekly plan, boxers and round timer.',
  va_preset_brand: 'Brand',
  va_preset_brand_desc: 'Brand dashboard: products, services and talent to sponsor.',
  va_preset_visitor: 'Visitor without account',
  va_preset_visitor_desc: 'The platform exactly as someone who has not signed up sees it.',

  // ── Notices ──
  va_safety_title: 'What you can and cannot do',
  va_safety_read: 'You can browse, open any section and see how everything looks.',
  va_safety_write: 'You cannot save, send, buy or delete anything: every write is blocked.',
  va_safety_session: 'Your session stays an admin session the whole time. The mode ends on its own when you close the tab.',
  va_data_note: 'On test profiles the data you see is your own account\'s: it is there to review the design, not to look at other people\'s information.',
  va_data_note_user: 'Seeing another person\'s real data requires migration 0011. Without it you get their identity and navigation, but data sections come up empty.',
};
