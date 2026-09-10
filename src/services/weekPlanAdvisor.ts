// Plan semanal multi-módulo desde una sola petición (punto 21).
//
// Habla con /api/coach (modo `weekPlan`), que resuelve dos cosas con el mismo
// esquema:
//   · GENERAR — la petición compuesta del usuario → fuerza por día + N
//     protocolos de cardio + pauta de comidas.
//   · AJUSTAR — "cambia el cardio del jueves" → el plan anterior entero con
//     SOLO ese cambio. Es lo que evita rehacer la petición desde el principio.
//
// Aquí se NORMALIZA lo que devuelve el modelo a lo que guarda la app: minutos a
// segundos, nombres de ejercicio resueltos contra la biblioteca, días fuera de
// rango descartados y variables que no aplican a ese tipo de actividad tiradas.
// El modelo propone; la app decide qué es válido.

import { supabase } from '@/lib/supabase';
import { ACTIVITY_KINDS, type MealSlot } from '@/pages/mi-esquina/lib/dayPlan';
import {
  libraryLabels, MUSCLE_GROUPS, muscleGroupOf,
  type MuscleGroup, type TrackingMode, type WeightMode,
} from '@/pages/mi-esquina/lib/exercises';
import {
  localId as protocolLocalId, protocolVarsFor, VAR_DEFS,
  type ProtocolSegment, type ProtocolVarId,
} from '@/pages/mi-esquina/lib/protocols';
import { inferExerciseMeta, localId as routineLocalId, type PrescribedExercise } from '@/pages/mi-esquina/lib/routines';
import {
  dateOfWeekday, newPlanId,
  type WeekContext, type WeekMealDay, type WeekPlan, type WeekProtocol, type WeekStrengthDay,
} from '@/pages/mi-esquina/lib/weekPlan';

export interface WeekPlanResult {
  plan: WeekPlan | null;
  /** Mensaje del servidor cuando hay uno que merezca enseñarse. */
  error: string | null;
}

/** Sonda de disponibilidad (no gasta cuota). */
export async function checkWeekPlanAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/coach', { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.available;
  } catch {
    return false;
  }
}

/** Contexto que se le manda al modelo para que no invente nombres ni tipos. */
export function buildWeekContext(weekStart: string, today: string, lang: 'es' | 'en'): WeekContext {
  return {
    weekStart,
    today,
    exerciseNames: libraryLabels(lang),
    activityKinds: ACTIVITY_KINDS.map((k) => k.value),
  };
}

// ── Normalización ──────────────────────────────────────────────

const TRACKING: TrackingMode[] = ['reps', 'time', 'distance'];
const WEIGHTS: WeightMode[] = ['total', 'per_side', 'per_dumbbell', 'bodyweight'];
const SLOTS: MealSlot[] = ['desayuno', 'comida', 'cena', 'snack'];
const WHENS = ['morning', 'midday', 'afternoon', 'evening'] as const;

const clampWeekday = (v: unknown): number | null => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 6 ? n : null;
};

function normalizeExercises(raw: unknown): PrescribedExercise[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).map((item) => {
    const e = (item || {}) as Record<string, unknown>;
    const name = String(e.name || '').trim().slice(0, 80);
    if (!name) return null;

    // La biblioteca manda sobre el modelo: si conoce el ejercicio, sabe mejor
    // que él si va por tiempo y cómo se cuenta el peso.
    const known = muscleGroupOf(name) !== null;
    const meta = inferExerciseMeta(name);

    const modelTracking = TRACKING.includes(e.tracking_mode as TrackingMode) ? (e.tracking_mode as TrackingMode) : 'reps';
    const tracking = known && meta.tracking_mode !== 'reps' ? meta.tracking_mode : modelTracking;

    const repsMin = Math.max(0, Math.round(Number(e.reps_min) || 0));
    const repsMax = Math.round(Number(e.reps_max) || 0);
    const value = Math.max(0, Math.round(Number(e.value) || 0));
    const weight = Number(e.weight_kg);

    return {
      id: routineLocalId(),
      name,
      group: known
        ? meta.group
        : (MUSCLE_GROUPS.includes(e.group as MuscleGroup) ? (e.group as MuscleGroup) : 'full_body'),
      sets: Math.min(8, Math.max(1, Math.round(Number(e.sets) || 3))),
      reps_min: tracking === 'reps' ? (repsMin || 10) : 0,
      reps_max: tracking === 'reps' && repsMax > repsMin ? repsMax : undefined,
      value: tracking === 'reps' ? undefined : (value || repsMin || 30),
      weight_kg: Number.isFinite(weight) && weight > 0 ? weight : undefined,
      weight_mode: known
        ? meta.weight_mode
        : (WEIGHTS.includes(e.weight_mode as WeightMode) ? (e.weight_mode as WeightMode) : 'total'),
      tracking_mode: tracking,
      note: typeof e.note === 'string' && e.note.trim() ? e.note.trim().slice(0, 200) : undefined,
    } as PrescribedExercise;
  }).filter((x): x is PrescribedExercise => x !== null);
}

function normalizeSegments(raw: unknown, kind: string): ProtocolSegment[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(protocolVarsFor(kind).map((v) => v.id));

  return raw.slice(0, 90).map((item) => {
    const s = (item || {}) as Record<string, unknown>;
    const values: Partial<Record<ProtocolVarId, number>> = {};
    const rawValues = (s.values || {}) as Record<string, unknown>;

    (Object.keys(rawValues) as ProtocolVarId[]).forEach((k) => {
      if (!allowed.has(k)) return;
      const def = VAR_DEFS[k];
      if (!def) return;
      // El esquema admite null en cada variable. `Number(null)` es 0, que sí es
      // finito: sin este descarte, "sin dato" se guardaría como un 0 real.
      const v = rawValues[k];
      if (v === null || v === undefined || v === '') return;
      const n = Number(v);
      if (!Number.isFinite(n)) return;
      values[k] = Math.min(def.max, Math.max(def.min, n));
    });

    const minutes = Number(s.minutes);
    const meters = Number(s.meters);
    return {
      id: protocolLocalId(),
      label: typeof s.label === 'string' && s.label.trim() ? s.label.trim().slice(0, 40) : undefined,
      seconds: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : 0,
      meters: Number.isFinite(meters) && meters > 0 ? Math.round(meters) : undefined,
      values,
      note: typeof s.note === 'string' && s.note.trim() ? s.note.trim().slice(0, 200) : undefined,
    } as ProtocolSegment;
  }).filter((s) => s.seconds > 0 || (s.meters || 0) > 0);
}

const VALID_KINDS = new Set(ACTIVITY_KINDS.map((k) => k.value));

function normalizePlan(raw: Record<string, unknown>, request: string, ctx: WeekContext, id: string): WeekPlan | null {
  const weekStart = ctx.weekStart;
  const today = ctx.today;

  // Un día que ya ha pasado no se puede planificar: se descarta en silencio
  // aquí (el system prompt ya se lo pide, esto es el cinturón).
  const usable = (weekday: number) => dateOfWeekday(weekStart, weekday) >= today;

  const strength: WeekStrengthDay[] = (Array.isArray(raw.strength) ? raw.strength : [])
    .slice(0, 7)
    .map((item) => {
      const d = (item || {}) as Record<string, unknown>;
      const weekday = clampWeekday(d.weekday);
      if (weekday === null || !usable(weekday)) return null;
      const exercises = normalizeExercises(d.exercises);
      if (exercises.length === 0) return null;
      const groups = (Array.isArray(d.groups) ? d.groups : [])
        .filter((g): g is MuscleGroup => MUSCLE_GROUPS.includes(g as MuscleGroup));
      return {
        weekday,
        date: dateOfWeekday(weekStart, weekday),
        name: String(d.name || '').trim().slice(0, 60),
        // Si el modelo no declara grupos, se derivan de los ejercicios: el
        // tick automático de la Agenda se basa en ellos.
        groups: groups.length > 0 ? groups : [...new Set(exercises.map((e) => e.group))],
        exercises,
        note: typeof d.note === 'string' && d.note.trim() ? d.note.trim().slice(0, 200) : undefined,
      } as WeekStrengthDay;
    })
    .filter((x): x is WeekStrengthDay => x !== null)
    .sort((a, b) => a.weekday - b.weekday);

  const protocols: WeekProtocol[] = (Array.isArray(raw.protocols) ? raw.protocols : [])
    .slice(0, 6)
    .map((item, i) => {
      const p = (item || {}) as Record<string, unknown>;
      const kindRaw = String(p.kind || '').trim();
      const kind = VALID_KINDS.has(kindRaw) ? kindRaw : 'otro';
      const segments = normalizeSegments(p.segments, kind);
      if (segments.length === 0) return null;
      const weekdays = (Array.isArray(p.weekdays) ? p.weekdays : [])
        .map(clampWeekday)
        .filter((w): w is number => w !== null && usable(w));
      if (weekdays.length === 0) return null;
      return {
        key: String(p.key || `cardio_${i}`).trim().slice(0, 40) || `cardio_${i}`,
        name: String(p.name || '').trim().slice(0, 120) || `Cardio ${i + 1}`,
        kind,
        when: (WHENS as readonly string[]).includes(String(p.when)) ? (p.when as WeekProtocol['when']) : 'afternoon',
        segments,
        weekdays: [...new Set(weekdays)].sort((a, b) => a - b),
        note: typeof p.note === 'string' && p.note.trim() ? p.note.trim().slice(0, 200) : undefined,
      } as WeekProtocol;
    })
    .filter((x): x is WeekProtocol => x !== null);

  const nutrition: WeekMealDay[] = (Array.isArray(raw.nutrition) ? raw.nutrition : [])
    .slice(0, 7)
    .map((item) => {
      const d = (item || {}) as Record<string, unknown>;
      const weekday = clampWeekday(d.weekday);
      if (weekday === null || !usable(weekday)) return null;
      const meals = (Array.isArray(d.meals) ? d.meals : [])
        .slice(0, 6)
        .map((mItem) => {
          const m = (mItem || {}) as Record<string, unknown>;
          const text = String(m.text || '').trim().slice(0, 400);
          if (!text) return null;
          const minutes = Math.round(Number(m.minutes) || 0);
          return {
            slot: SLOTS.includes(m.slot as MealSlot) ? (m.slot as MealSlot) : 'comida',
            text,
            minutes: minutes > 0 ? Math.min(180, minutes) : 20,
          };
        })
        .filter((x): x is { slot: MealSlot; text: string; minutes: number } => x !== null);
      if (meals.length === 0) return null;
      return { weekday, date: dateOfWeekday(weekStart, weekday), meals } as WeekMealDay;
    })
    .filter((x): x is WeekMealDay => x !== null)
    .sort((a, b) => a.weekday - b.weekday);

  if (strength.length === 0 && protocols.length === 0 && nutrition.length === 0) return null;

  const declaredDays = Math.round(Number(raw.training_days) || 0);

  return {
    id,
    request,
    weekStart,
    // Si el modelo no lo declara, se usa lo que ha montado de verdad: es más
    // honesto que un número que no se corresponde con el plan.
    trainingDays: declaredDays > 0 && declaredDays <= 7 ? declaredDays : strength.length,
    exclusions: (Array.isArray(raw.exclusions) ? raw.exclusions : [])
      .map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 12),
    summary: String(raw.summary || '').trim().slice(0, 800),
    disclaimer: String(raw.disclaimer || '').trim().slice(0, 400),
    strength,
    protocols,
    nutrition,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
}

// ── Llamadas ───────────────────────────────────────────────────

async function call(
  body: Record<string, unknown>,
  profile: Record<string, unknown>,
): Promise<{ raw: Record<string, unknown> | null; error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // `profile` va al NIVEL RAÍZ del cuerpo, no dentro de `weekPlan`: es donde
      // lo lee el servidor para armar el contexto del peleador. Metido dentro se
      // enviaba igual pero el plan salía sin personalizar.
      body: JSON.stringify({ section: 'training', profile, weekPlan: body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.plan) return { raw: null, error: data?.message || null };
    return { raw: data.plan as Record<string, unknown>, error: null };
  } catch {
    return { raw: null, error: null };
  }
}

/** Genera el plan de la semana a partir de la petición del usuario. */
export async function generateWeekPlan(
  request: string,
  ctx: WeekContext,
  profile: Record<string, unknown>,
): Promise<WeekPlanResult> {
  const { raw, error } = await call({
    request,
    weekStart: ctx.weekStart,
    today: ctx.today,
    exerciseNames: ctx.exerciseNames,
    activityKinds: ctx.activityKinds,
  }, profile);
  if (!raw) return { plan: null, error };
  const plan = normalizePlan(raw, request, ctx, newPlanId());
  return { plan, error: plan ? null : error };
}

/**
 * Aplica un ajuste puntual sobre un plan ya generado.
 *
 * Se le manda el plan entero para que devuelva el mismo con SOLO ese cambio.
 * Se conserva el id del borrador: sigue siendo el mismo plan, no uno nuevo.
 */
export async function adjustWeekPlan(
  plan: WeekPlan,
  instruction: string,
  ctx: WeekContext,
  profile: Record<string, unknown>,
): Promise<WeekPlanResult> {
  const { raw, error } = await call({
    request: plan.request,
    adjustments: instruction,
    // Se manda lo justo: el plan sin los ids locales, que al modelo no le dicen
    // nada y se llevan la mitad del presupuesto de tokens.
    previous: stripIds(plan),
    weekStart: ctx.weekStart,
    today: ctx.today,
    exerciseNames: ctx.exerciseNames,
    activityKinds: ctx.activityKinds,
  }, profile);
  if (!raw) return { plan: null, error };
  const next = normalizePlan(raw, plan.request, ctx, plan.id);
  if (!next) return { plan: null, error };
  return {
    plan: {
      ...next,
      // El historial de la petición original no se pierde al ajustar.
      request: plan.request,
      createdAt: plan.createdAt,
    },
    error: null,
  };
}

/** El plan en la forma mínima que el modelo necesita para ajustarlo. */
function stripIds(plan: WeekPlan) {
  return {
    training_days: plan.trainingDays,
    exclusions: plan.exclusions,
    summary: plan.summary,
    strength: plan.strength.map((s) => ({
      weekday: s.weekday, name: s.name, groups: s.groups, note: s.note ?? null,
      exercises: s.exercises.map((e) => ({
        name: e.name, group: e.group, sets: e.sets, reps_min: e.reps_min,
        reps_max: e.reps_max ?? null, value: e.value ?? null, weight_kg: e.weight_kg ?? null,
        weight_mode: e.weight_mode, tracking_mode: e.tracking_mode, note: e.note ?? null,
      })),
    })),
    protocols: plan.protocols.map((p) => ({
      key: p.key, name: p.name, kind: p.kind, when: p.when, weekdays: p.weekdays, note: p.note ?? null,
      segments: p.segments.map((s) => ({
        label: s.label ?? null,
        minutes: +(s.seconds / 60).toFixed(2),
        meters: s.meters ?? null,
        note: s.note ?? null,
        values: s.values,
      })),
    })),
    nutrition: plan.nutrition.map((n) => ({
      weekday: n.weekday,
      meals: n.meals.map((m) => ({ slot: m.slot, text: m.text, minutes: m.minutes })),
    })),
  };
}
