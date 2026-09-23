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
export function buildWeekContext(weekStart: string, today: string, lang: 'es' | 'en', weeks = 1): WeekContext {
  return {
    weekStart,
    weeks: Math.max(1, Math.min(6, Math.round(weeks) || 1)),
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
    // Dos formas posibles, y las dos son válidas:
    //
    //   · anidada  { values: { speed_kmh: 5, ... } }  -> la del guion de cardio
    //   · plana    { speed_kmh: 5, ... }              -> la del PLAN
    //
    // El plan la usa plana porque la API rechaza el esquema anidado: cada
    // campo que admite null cuenta como unión y hay un tope de 16. Con la
    // anidada, TODA petición de plan devolvía 400. Ver PLAN_SEGMENT_SCHEMA.
    //
    // En la plana un 0 significa "no aplica", así que se descarta abajo igual
    // que un null: nadie prescribe 0 km/h.
    const rawValues = (s.values || s) as Record<string, unknown>;

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
      // 0 = "no aplica" en la forma plana. Guardarlo pintaría "0 km/h" en la
      // tabla que se mira entrenando, que es peor que dejar el hueco.
      if (n === 0) return;
      values[k] = Math.min(def.max, Math.max(def.min, n));
    });

    const minutes = Number(s.minutes);
    const meters = Number(s.meters);
    const reps = Math.round(Number(s.reps));
    // `detail` es como lo manda el plan; `note`, como lo guarda la app (y como
    // lo mandaba el guion de cardio). Se acepta cualquiera de los dos.
    const texto = [s.detail, s.note].find((x) => typeof x === 'string' && x.trim()) as string | undefined;
    return {
      id: protocolLocalId(),
      label: typeof s.label === 'string' && s.label.trim() ? s.label.trim().slice(0, 60) : undefined,
      seconds: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : 0,
      meters: Number.isFinite(meters) && meters > 0 ? Math.round(meters) : undefined,
      // Una estación ("25 swings") va por repeticiones: se hace y se pulsa
      // "Hecho". Sin esto el tramo no tenía ni tiempo ni distancia y se caía
      // abajo, y un Hyrox copiado de una hoja se quedaba en las carreras.
      ...(Number.isFinite(reps) && reps > 0 ? { reps: Math.min(reps, 5000) } : {}),
      values,
      note: texto ? texto.trim().slice(0, 200) : undefined,
    } as ProtocolSegment;
  }).filter((s) => s.seconds > 0 || (s.meters || 0) > 0 || (s.reps || 0) > 0);
}

const VALID_KINDS = new Set(ACTIVITY_KINDS.map((k) => k.value));

/** Topes de lo que se acepta de un plan. Ver "Los topes" en normalizeWeekPlan. */
const MAX_DIAS_FUERZA = 28;
const MAX_CARDIOS = 24;
const MAX_DIAS_COMIDA = 28;

export function normalizeWeekPlan(raw: Record<string, unknown>, request: string, ctx: WeekContext, id: string): WeekPlan | null {
  const weekStart = ctx.weekStart;
  const today = ctx.today;

  // Un día que ya ha pasado no se puede planificar: se descarta en silencio
  // aquí (el system prompt ya se lo pide, esto es el cinturón).
  /**
   * ¿Se puede usar este día de la semana?
   *
   * En un plan de UNA semana, un lunes que ya pasó no sirve: el plan nacería
   * con un entreno imposible. Pero en uno de VARIAS, ese mismo lunes existe
   * también la semana que viene, así que descartarlo se cargaría el día en
   * todas las semanas por lo que pase en la primera. Con más de una semana no
   * se filtra; los bloques de los días ya pasados simplemente no se crean.
   */
  const multi = Math.max(1, Number(raw.weeks) || ctx.weeks || 1) > 1;
  const usable = (weekday: number) => multi || dateOfWeekday(weekStart, weekday) >= today;

  // ── Los topes ──
  //
  // Eran 7 días de fuerza, 6 cardios y 7 días de comidas, y se cortaba SIN
  // AVISAR. Con un plan real no daba: cinco cardios de lunes a viernes, tres
  // opciones el sábado y un cardio de mañana son nueve, y las opciones del
  // sábado, que van al final, se perdían. Ese era el "el sábado no lo ha
  // metido bien": faltaban la B y la C. Y en planes de varias semanas, un día
  // que cambia de una semana a otra cuenta dos veces.
  //
  // Los topes siguen, pero como red contra una respuesta desbocada, no como
  // límite de lo que alguien puede pedir.
  const strength: WeekStrengthDay[] = (Array.isArray(raw.strength) ? raw.strength : [])
    .slice(0, MAX_DIAS_FUERZA)
    .map((item) => {
      const d = (item || {}) as Record<string, unknown>;
      const weekday = clampWeekday(d.weekday);
      if (weekday === null || !usable(weekday)) return null;
      const exercises = normalizeExercises(d.exercises);
      const groups = (Array.isArray(d.groups) ? d.groups : [])
        .filter((g): g is MuscleGroup => MUSCLE_GROUPS.includes(g as MuscleGroup));
      const nombre = String(d.name || '').trim().slice(0, 60);

      // Un día SIN ejercicios es válido, y ahora es lo normal.
      //
      // Antes esto era `if (exercises.length === 0) return null`, porque se daba
      // por hecho que un día de fuerza traía su lista. Pero "hazme una rutina
      // push pull pierna" pide el REPARTO, no los ejercicios: mucha gente ya
      // sabe cuáles hace. Con el descarte, un plan así se quedaba sin fuerza
      // entera y en silencio.
      //
      // Lo que sí hay que exigir es que el día DIGA algo: sin ejercicios, sin
      // grupos y sin nombre no es un día, es una fila vacía.
      if (exercises.length === 0 && groups.length === 0 && !nombre) return null;

      return {
        weekday,
        ...(Number.isFinite(Number(d.week)) && Number(d.week) >= 0 ? { week: Number(d.week) } : {}),
        date: dateOfWeekday(weekStart, weekday),
        name: nombre,
        // Si el modelo no declara grupos, se derivan de los ejercicios: el
        // tick automático de la Agenda se basa en ellos. Sin ejercicios no hay
        // de dónde derivarlos, y entonces mandan los que haya declarado.
        groups: groups.length > 0 ? groups : [...new Set(exercises.map((e) => e.group))],
        exercises,
        note: typeof d.note === 'string' && d.note.trim() ? d.note.trim().slice(0, 400) : undefined,
        // "Opción A · Pierna suave": una de las opciones del sábado. Se ve y se
        // puede marcar, pero no cuenta como fuerza pendiente.
        ...(d.optional === true ? { optional: true } : {}),
      } as WeekStrengthDay;
    })
    .filter((x): x is WeekStrengthDay => x !== null)
    .sort((a, b) => a.weekday - b.weekday);

  const protocols: WeekProtocol[] = (Array.isArray(raw.protocols) ? raw.protocols : [])
    .slice(0, MAX_CARDIOS)
    .map((item, i) => {
      const p = (item || {}) as Record<string, unknown>;
      const kindRaw = String(p.kind || '').trim();
      const kind = VALID_KINDS.has(kindRaw) ? kindRaw : 'otro';
      // Ya no vienen tramos: el plan trae minutos y el detalle en texto. Se
      // conserva `normalizeSegments` porque el import de documentos SÍ los usa.
      const segments = normalizeSegments(p.segments, kind);
      const minutos = Math.max(0, Math.min(300, Math.round(Number(p.minutes) || 0)));
      // Sin minutos NI tramos no hay cardio que valga la pena poner en el día.
      if (segments.length === 0 && minutos === 0) return null;
      const pedidos = (Array.isArray(p.weekdays) ? p.weekdays : [])
        .map(clampWeekday)
        .filter((w): w is number => w !== null);
      const weekdays = pedidos.filter(usable);
      // Sin días PEDIDOS es un cardio para guardar sin fecha ("Cardios
      // guardados"), que es justo lo que dice el esquema. Antes se descartaba
      // igual que uno cuyos días ya han pasado, y lo que se pedía guardar
      // desaparecía. Solo se descarta si tenía días y ya no queda ninguno.
      if (pedidos.length > 0 && weekdays.length === 0) return null;
      return {
        key: String(p.key || `cardio_${i}`).trim().slice(0, 40) || `cardio_${i}`,
        name: String(p.name || '').trim().slice(0, 120) || `Cardio ${i + 1}`,
        kind,
        when: (WHENS as readonly string[]).includes(String(p.when)) ? (p.when as WeekProtocol['when']) : 'afternoon',
        segments,
        // Ante la duda, opcional NO: marcar de mas como opcional haria que
        // la fuerza de siempre dejara de avisar, que es peor que lo contrario.
        optional: p.optional === true,
        minutes: minutos > 0 ? minutos : undefined,
        weekdays: [...new Set(weekdays)].sort((a, b) => a - b),
        ...(Array.isArray(p.weeks) && p.weeks.length > 0
          ? { weeks: [...new Set((p.weeks as unknown[]).map(Number).filter((w) => Number.isFinite(w) && w >= 0))] }
          : {}),
        // 400 y no 200: las reglas de una hoja ("no te agarres a las asas; si
        // pasas de 139 ppm, baja un punto") van aquí y se leen entrenando.
        note: typeof p.note === 'string' && p.note.trim() ? p.note.trim().slice(0, 400) : undefined,
      } as WeekProtocol;
    })
    .filter((x): x is WeekProtocol => x !== null)
    // Claves únicas: con dos cardios con la misma clave, la Agenda y la
    // tarjeta del plan los confundían (ver savedProtocols en commitWeekPlan).
    .map((p, i, todos) => (todos.findIndex((q) => q.key === p.key) === i ? p : { ...p, key: `${p.key}_${i}` }));

  const nutrition: WeekMealDay[] = (Array.isArray(raw.nutrition) ? raw.nutrition : [])
    .slice(0, MAX_DIAS_COMIDA)
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
      const wk = Number(d.week);
      return {
        weekday,
        ...(Number.isFinite(wk) && wk >= 0 ? { week: wk } : {}),
        date: dateOfWeekday(weekStart, weekday), meals,
      } as WeekMealDay;
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
    // 1 a 6 semanas. Más allá es planificar a ciegas: nadie cumple seis semanas
    // clavadas, y cada semana de más son bloques que luego hay que borrar.
    weeks: Math.max(1, Math.min(6, Math.round(Number(raw.weeks) || ctx.weeks || 1))),
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
    weeks: ctx.weeks || 1,
    exerciseNames: ctx.exerciseNames,
    activityKinds: ctx.activityKinds,
  }, profile);
  if (!raw) return { plan: null, error };
  const plan = normalizeWeekPlan(raw, request, ctx, newPlanId());
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
    // Un ajuste no cambia la duración: se mantiene la del plan que se retoca.
    weeks: plan.weeks || ctx.weeks || 1,
    exerciseNames: ctx.exerciseNames,
    activityKinds: ctx.activityKinds,
  }, profile);
  if (!raw) return { plan: null, error };
  const next = normalizeWeekPlan(raw, plan.request, ctx, plan.id);
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
        reps: s.reps ?? 0,
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
