// Avisos del Resumen de Mi Esquina.
//
// Regla de diseño: un aviso solo existe si hay un dato real detrás. No hay
// avisos "motivacionales" ni recordatorios inventados. Y todos se pueden
// descartar o posponer, porque un aviso que no se puede callar deja de ser un
// aviso y pasa a ser ruido.
//
// El estado de descartado/pospuesto vive en localStorage: es una preferencia de
// este dispositivo sobre qué le apetece ver al usuario, no un dato del perfil.
//
// Lo que YA cubre la card "Tu siguiente acción" (entreno de hoy pendiente, peso
// sin registrar hace pocos días, combate a ≤7 días) NO se repite aquí.

export type AlertKind =
  | 'inactive'          // varios días sin registrar nada
  | 'fight_soon'        // combate entre 8 y 21 días (el ≤7 lo lleva TodayCard)
  | 'weigh_in_soon'     // pesaje marcado a ≤10 días
  | 'week_empty'        // semana en curso sin nada planificado
  | 'weight_stalled';   // hay objetivo de peso y ≥7 días sin pesarse

export type AlertSeverity = 'info' | 'urgent';

export interface EsquinaAlert {
  /** Identidad estable del aviso; incluye el dato para que "otro combate" sea otro aviso. */
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  icon: string;
  /** Clave i18n del texto + parámetros. */
  titleKey: string;
  params?: Record<string, string | number>;
  /** Acción sugerida (clave i18n) — la resuelve quien lo pinta. */
  ctaKey?: string;
}

const KEY = 'rankd_alert_state_v1';
/** Posponer = no volver a verlo en 3 días. */
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

interface AlertState { dismissed?: true; snoozeUntil?: number }
type StateMap = Record<string, AlertState>;

function readState(): StateMap {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as StateMap; } catch { return {}; }
}

function writeState(s: StateMap): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* cuota / modo privado */ }
}

export function dismissAlert(id: string): void {
  const s = readState(); s[id] = { ...s[id], dismissed: true }; writeState(s);
}

export function snoozeAlert(id: string): void {
  const s = readState(); s[id] = { ...s[id], snoozeUntil: Date.now() + SNOOZE_MS }; writeState(s);
}

/** Quita del listado lo descartado y lo pospuesto que sigue vigente. */
export function applyAlertState(alerts: EsquinaAlert[]): EsquinaAlert[] {
  const s = readState();
  const now = Date.now();
  return alerts.filter((a) => {
    const st = s[a.id];
    if (!st) return true;
    if (st.dismissed) return false;
    if (st.snoozeUntil && st.snoozeUntil > now) return false;
    return true;
  });
}

/** Limpia entradas de avisos que ya no se generan (no crecer sin límite). */
export function pruneAlertState(currentIds: string[]): void {
  const s = readState();
  const keep = new Set(currentIds);
  let changed = false;
  Object.keys(s).forEach((id) => {
    // Solo se conserva lo pospuesto vigente de avisos que siguen existiendo.
    if (!keep.has(id) && !(s[id].snoozeUntil && s[id].snoozeUntil > Date.now())) {
      delete s[id]; changed = true;
    }
  });
  if (changed) writeState(s);
}

export interface AlertInput {
  mode: 'pro' | 'hobby';
  /** Días desde el último registro (actividad o fuerza). null = nunca ha registrado. */
  daysSinceActivity: number | null;
  /** Días hasta el próximo combate. null = no hay. */
  daysToFight: number | null;
  /** Días hasta el pesaje marcado. null = no hay. */
  daysToWeighIn: number | null;
  /** Elementos planificados en la semana en curso. */
  weekPlannedCount: number;
  /** ¿Tiene objetivo de peso fijado? */
  hasWeightGoal: boolean;
  /** Días desde el último registro de peso. null = nunca. */
  daysSinceWeight: number | null;
}

/**
 * Deriva los avisos que aplican ahora mismo. Puro: no lee estado ni red.
 * El orden del array es el de prioridad de pintado.
 */
export function buildAlerts(i: AlertInput): EsquinaAlert[] {
  const out: EsquinaAlert[] = [];

  if (i.mode === 'pro' && i.daysToFight !== null && i.daysToFight >= 8 && i.daysToFight <= 21) {
    out.push({
      id: `fight_soon:${i.daysToFight <= 14 ? '14' : '21'}`,
      kind: 'fight_soon', severity: 'urgent', icon: 'ri-sword-line',
      titleKey: 'mc_al_fight_soon', params: { n: i.daysToFight }, ctaKey: 'mc_al_cta_agenda',
    });
  }

  if (i.mode === 'pro' && i.daysToWeighIn !== null && i.daysToWeighIn >= 0 && i.daysToWeighIn <= 10) {
    out.push({
      id: `weigh_in_soon:${i.daysToWeighIn}`,
      kind: 'weigh_in_soon', severity: 'urgent', icon: 'ri-scales-2-line',
      titleKey: 'mc_al_weighin_soon', params: { n: i.daysToWeighIn }, ctaKey: 'mc_al_cta_weight',
    });
  }

  // "Nunca ha registrado" lo cubre la ruta de activación, no un aviso.
  if (i.daysSinceActivity !== null && i.daysSinceActivity >= 4) {
    // Se agrupa por tramos para que el id no cambie cada día y el "posponer"
    // aguante de verdad los 3 días.
    const bucket = i.daysSinceActivity >= 14 ? '14' : i.daysSinceActivity >= 7 ? '7' : '4';
    out.push({
      id: `inactive:${bucket}`,
      kind: 'inactive', severity: 'info', icon: 'ri-calendar-close-line',
      titleKey: 'mc_al_inactive', params: { n: i.daysSinceActivity }, ctaKey: 'mc_al_cta_log',
    });
  }

  if (i.hasWeightGoal && i.daysSinceWeight !== null && i.daysSinceWeight >= 7) {
    out.push({
      id: `weight_stalled:${i.daysSinceWeight >= 14 ? '14' : '7'}`,
      kind: 'weight_stalled', severity: 'info', icon: 'ri-line-chart-line',
      titleKey: 'mc_al_weight_stalled', params: { n: i.daysSinceWeight }, ctaKey: 'mc_al_cta_weight',
    });
  }

  if (i.weekPlannedCount === 0) {
    // Un id por semana: si la semana que viene tampoco hay nada, vuelve a avisar.
    const d = new Date();
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - dow);
    const monday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({
      id: `week_empty:${monday}`,
      kind: 'week_empty', severity: 'info', icon: 'ri-calendar-line',
      titleKey: 'mc_al_week_empty', ctaKey: 'mc_al_cta_plan',
    });
  }

  return out;
}
