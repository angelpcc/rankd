// Utilidades de fecha para Oportunidades (PROMPT_1 · bloque 3).
//
// Una oportunidad representa un evento futuro (combate, sparring, campamento,
// patrocinio con fecha…). La fecha es OBLIGATORIA y debe ser hoy o futura al
// crear/editar; las oportunidades cuyo evento ya pasó se ocultan de las vistas
// públicas (no se borran; el creador sigue viéndolas marcadas como vencidas).
//
// `event_date` en la BD es un `date` (solo día, sin hora). Se compara como
// cadena 'YYYY-MM-DD' en hora LOCAL para evitar desfases de zona horaria.

/** Fecha de hoy en local como 'YYYY-MM-DD' (sirve para <input min> y comparar). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ¿El evento ya pasó? (tiene fecha y es ANTERIOR a hoy; hoy NO cuenta como pasado). */
export function isPastEvent(eventDate?: string | null): boolean {
  if (!eventDate) return false; // sin fecha (legado) = no se oculta
  return eventDate.slice(0, 10) < todayISO();
}

/**
 * Valida la fecha del evento al crear/editar. Devuelve la CLAVE i18n del error
 * o null si es válida. La validación real de UX vive en el front; la BD la
 * refuerza en el INSERT (migración 0027).
 */
export function validateEventDate(eventDate: string): string | null {
  if (!eventDate) return 'op_date_err_required';
  if (eventDate.slice(0, 10) < todayISO()) return 'op_date_err_past';
  return null;
}
