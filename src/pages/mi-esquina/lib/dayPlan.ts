// Modelo compartido del "plan por día" (day_plan_items, migración 0042).
//
// Cinco tipos de bloque. Solo `strength` y `activity` llevan tick (completed);
// `meal`, `supplement` y `note` son anotaciones informativas — nunca checkbox.
// Lo usan la Agenda (vista Día/Semana/Mes), Planificar y el Asesor.

import type { MuscleGroup } from './exercises';

export type DayPlanKind = 'strength' | 'activity' | 'meal' | 'supplement' | 'note';

export type MealSlot = 'desayuno' | 'comida' | 'cena' | 'snack';

export interface StrengthPayload { groups: string[]; exercises?: string; note?: string }
export interface ActivityPayload { kind: string; duration_min?: number; note?: string }
export interface MealPayload { slot: MealSlot; text: string }
export interface SupplementPayload { name: string; time?: string }
export interface NotePayload { text: string }

export type DayPlanPayload =
  | StrengthPayload | ActivityPayload | MealPayload | SupplementPayload | NotePayload;

export interface DayPlanItem {
  id: string;
  fighter_profile_id: string;
  plan_date: string;              // 'YYYY-MM-DD'
  kind: DayPlanKind;
  payload: DayPlanPayload;
  completed: boolean;
  source: 'manual' | 'advisor' | 'template';
  created_at?: string;
}

/** Orden de prioridad de los bloques en la vista Día y en el preview de Semana. */
export const KIND_ORDER: DayPlanKind[] = ['strength', 'activity', 'meal', 'supplement', 'note'];

export const KIND_META: Record<DayPlanKind, { icon: string; hex: string; labelKey: string; tick: boolean }> = {
  strength:   { icon: 'ri-hammer-line',      hex: '#fb923c', labelKey: 'mc_dp_kind_strength',   tick: true },
  activity:   { icon: 'ri-run-line',         hex: '#4ade80', labelKey: 'mc_dp_kind_activity',   tick: true },
  meal:       { icon: 'ri-restaurant-line',  hex: '#38bdf8', labelKey: 'mc_dp_kind_meal',       tick: false },
  supplement: { icon: 'ri-capsule-line',     hex: '#C9A84C', labelKey: 'mc_dp_kind_supplement', tick: false },
  note:       { icon: 'ri-sticky-note-line', hex: '#a1a1aa', labelKey: 'mc_dp_kind_note',       tick: false },
};

// ── Tipos de actividad no-fuerza (activity_sessions + payload.kind de day_plan_items) ──
// value = clave interna (se guarda en BD); labelKey = i18n; boxeo admite rounds.
export interface ActivityKindCfg {
  value: string;
  labelKey: string;
  icon: string;
  hex: string;
  rounds?: boolean;
}

export const ACTIVITY_KINDS: ActivityKindCfg[] = [
  { value: 'correr',   labelKey: 'mc_act_kind_correr',   icon: 'ri-run-line',          hex: '#22c55e' },
  { value: 'boxeo',    labelKey: 'mc_act_kind_boxeo',    icon: 'ri-boxing-line',       hex: '#E10600', rounds: true },
  { value: 'bici',     labelKey: 'mc_act_kind_bici',     icon: 'ri-riding-line',       hex: '#3b82f6' },
  { value: 'natacion', labelKey: 'mc_act_kind_natacion', icon: 'ri-drop-line',         hex: '#38bdf8' },
  { value: 'cuerda',   labelKey: 'mc_act_kind_cuerda',   icon: 'ri-donut-chart-line',  hex: '#a78bfa' },
  { value: 'otro',     labelKey: 'mc_act_kind_otro',     icon: 'ri-more-line',         hex: '#6b7280' },
];

export const activityKindCfg = (v: string): ActivityKindCfg =>
  ACTIVITY_KINDS.find((k) => k.value === v) || ACTIVITY_KINDS[ACTIVITY_KINDS.length - 1];

export const MEAL_SLOTS: { value: MealSlot; labelKey: string }[] = [
  { value: 'desayuno', labelKey: 'mc_dp_slot_desayuno' },
  { value: 'comida',   labelKey: 'mc_dp_slot_comida' },
  { value: 'cena',     labelKey: 'mc_dp_slot_cena' },
  { value: 'snack',    labelKey: 'mc_dp_slot_snack' },
];

type TFn = (key: string, opts?: Record<string, unknown>) => string;

/** Resumen de una línea para el preview de la vista Semana / la vista Día. */
export function summarizeItem(item: DayPlanItem, t: TFn): string {
  switch (item.kind) {
    case 'strength': {
      const p = item.payload as StrengthPayload;
      const groups = (p.groups || []).map((g) => t(`mc_str_mg_${g}`, { defaultValue: g })).join(' + ');
      return groups || t('mc_dp_kind_strength');
    }
    case 'activity': {
      const p = item.payload as ActivityPayload;
      const name = t(activityKindCfg(p.kind).labelKey);
      return p.duration_min ? `${name} · ${p.duration_min} min` : name;
    }
    case 'meal': {
      const p = item.payload as MealPayload;
      const slot = t(`mc_dp_slot_${p.slot}`, { defaultValue: p.slot });
      return `${slot}: ${p.text}`;
    }
    case 'supplement': {
      const p = item.payload as SupplementPayload;
      return p.time ? `${p.time} · ${p.name}` : p.name;
    }
    case 'note':
      return (item.payload as NotePayload).text || t('mc_dp_kind_note');
  }
}

/** Etiqueta corta de bloque (para cabeceras). */
export function kindLabel(kind: DayPlanKind, t: TFn): string {
  return t(KIND_META[kind].labelKey);
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Re-export para quien solo importe de aquí.
export type { MuscleGroup };
