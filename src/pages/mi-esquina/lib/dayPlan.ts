// Modelo compartido del "plan por día" (day_plan_items, migración 0042).
//
// Cinco tipos de bloque. Solo `strength` y `activity` llevan tick (completed);
// `meal`, `supplement` y `note` son anotaciones informativas — nunca checkbox.
// Lo usan la Agenda (vista Día/Semana/Mes), Planificar y el Asesor.

import type { MuscleGroup, WeightMode, TrackingMode } from './exercises';
import { weightModeOf, trackingModeOf } from './exercises';

export type DayPlanKind = 'strength' | 'activity' | 'meal' | 'supplement' | 'note';

export type MealSlot = 'desayuno' | 'comida' | 'cena' | 'snack';

/**
 * Un ejercicio planificado (o registrado) en detalle. `value` guarda segundos
 * (tracking_mode 'time') o metros ('distance'); en 'reps' se usan reps_min /
 * reps_max. `weight_kg` es el número tal cual lo teclea el usuario, interpretado
 * según `weight_mode`.
 */
export interface ExerciseSpec {
  name: string;
  sets: number;
  reps_min?: number;
  reps_max?: number;
  value?: number;
  weight_kg?: number;
  weight_mode?: WeightMode;
  tracking_mode?: TrackingMode;
}

// exercises: los flujos antiguos (dictado, Asesor) escriben un string libre;
// el planificador en detalle escribe ExerciseSpec[]. Los renderers aceptan ambos.
export interface StrengthPayload { groups: string[]; exercises?: string | ExerciseSpec[]; note?: string }
export interface ActivityPayload {
  kind: string;
  duration_min?: number;
  distance_km?: number;
  meters?: number;
  rounds?: number;
  round_duration_sec?: number;
  pace_sec_per_km?: number;
  note?: string;
}
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
// value = clave interna (se guarda en BD); labelKey = i18n; fields = qué inputs
// pide cada tipo, más allá de la duración y la nota (comunes a todos).
export type ActivityField = 'distance_km' | 'pace' | 'meters' | 'rounds' | 'round_duration';

export interface ActivityKindCfg {
  value: string;
  labelKey: string;
  icon: string;
  hex: string;
  /** Campos propios del tipo (además de duración + nota). */
  fields: ActivityField[];
  /** true si `rounds` aplica (boxeo). */
  rounds?: boolean;
}

export const ACTIVITY_KINDS: ActivityKindCfg[] = [
  { value: 'correr',   labelKey: 'mc_act_kind_correr',   icon: 'ri-run-line',         hex: '#22c55e', fields: ['distance_km', 'pace'] },
  { value: 'boxeo',    labelKey: 'mc_act_kind_boxeo',    icon: 'ri-boxing-line',      hex: '#E10600', fields: ['rounds', 'round_duration'], rounds: true },
  { value: 'bici',     labelKey: 'mc_act_kind_bici',     icon: 'ri-riding-line',      hex: '#3b82f6', fields: ['distance_km'] },
  { value: 'natacion', labelKey: 'mc_act_kind_natacion', icon: 'ri-drop-line',        hex: '#38bdf8', fields: ['meters'] },
  { value: 'cuerda',   labelKey: 'mc_act_kind_cuerda',   icon: 'ri-donut-chart-line', hex: '#a78bfa', fields: [] },
  { value: 'otro',     labelKey: 'mc_act_kind_otro',     icon: 'ri-more-line',        hex: '#6b7280', fields: [] },
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

/** "5:30" a partir de segundos por km. */
export function paceLabel(secPerKm: number): string {
  const s = Math.round(secPerKm);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Ritmo en seg/km a partir de duración (min) y distancia (km). null si falta algo. */
export function computePace(durationMin?: number, distanceKm?: number): number | null {
  if (!durationMin || !distanceKm || distanceKm <= 0) return null;
  return Math.round((durationMin * 60) / distanceKm);
}

/** "5:30" o "330" → segundos. 0 si no parsea. */
export function paceToSec(raw: string): number {
  const s = raw.trim();
  const m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ── Formato de un ejercicio / serie de fuerza según sus modos ──

/** Peso de una serie ya con su modo: "55 kg" / "22 kg/mancuerna" / "20 kg/lado" / "peso corporal" / "+10 kg lastre". */
export function fmtWeight(weightKg: number | undefined, mode: WeightMode | undefined, t: TFn): string {
  const w = weightKg ?? 0;
  const m = mode ?? 'total';
  if (m === 'bodyweight') return w > 0 ? t('mc_str_wt_bw_load', { n: w }) : t('mc_str_wt_bw');
  if (w <= 0) return '';
  if (m === 'per_side') return t('mc_str_wt_per_side', { n: w });
  if (m === 'per_dumbbell') return t('mc_str_wt_per_dumbbell', { n: w });
  return t('mc_str_wt_total', { n: w });
}

interface SetOpts { repsMin?: number; repsMax?: number; value?: number; trackingMode?: TrackingMode }

/** "10", "8–10", "45 s", "20 m". Solo el valor de una serie, sin "N×" ni peso. */
export function fmtSetValue(opts: SetOpts, t: TFn): string {
  const tm = opts.trackingMode ?? 'reps';
  if (tm === 'time') return `${opts.value ?? 0} ${t('mc_str_unit_sec')}`;
  if (tm === 'distance') return `${opts.value ?? 0} ${t('mc_str_unit_m')}`;
  return opts.repsMax && opts.repsMax > (opts.repsMin ?? 0)
    ? `${opts.repsMin ?? 0}–${opts.repsMax}`
    : String(opts.repsMin ?? 0);
}

/** "4×10", "4×8–10", "3×45 s", "4×20 m". Sin el peso. */
export function fmtSetCount(sets: number, opts: SetOpts, t: TFn): string {
  return `${sets}×${fmtSetValue(opts, t)}`;
}

/** "Jalón al pecho · 4×10 · 55 kg" / "Plancha · 3×45 s" / "Crunch · 4×20". */
export function fmtExerciseSpec(spec: ExerciseSpec, t: TFn): string {
  const wm = spec.weight_mode ?? weightModeOf(spec.name);
  const tm = spec.tracking_mode ?? trackingModeOf(spec.name);
  const count = fmtSetCount(spec.sets, { repsMin: spec.reps_min, repsMax: spec.reps_max, value: spec.value, trackingMode: tm }, t);
  const weight = fmtWeight(spec.weight_kg, wm, t);
  return [spec.name, count, weight].filter(Boolean).join(' · ');
}

/** Normaliza `payload.exercises` a array de líneas de texto para mostrar. */
export function exerciseLines(exercises: string | ExerciseSpec[] | undefined, t: TFn): string[] {
  if (!exercises) return [];
  if (typeof exercises === 'string') return exercises.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  return exercises.map((e) => fmtExerciseSpec(e, t));
}

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
      const bits: string[] = [];
      if (p.distance_km) bits.push(`${p.distance_km} km`);
      else if (p.meters) bits.push(`${p.meters} m`);
      else if (p.rounds) bits.push(t('mc_av_rounds_short', { n: p.rounds }));
      else if (p.duration_min) bits.push(`${p.duration_min} min`);
      return bits.length ? `${name} · ${bits.join(' · ')}` : name;
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
export type { MuscleGroup, WeightMode, TrackingMode };
