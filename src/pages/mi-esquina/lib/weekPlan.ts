// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · Plan semanal multi-módulo (punto 21)
//
// Una sola petición conversacional que combina TRES módulos:
//
//   "Tengo 5 días esta semana. Fuerza orientada a hipertrofia, sin boxeo.
//    Cardio de tarde de 40 min de caminata con inclinación, dime la
//    inclinación minuto a minuto. Otro corto por la mañana y otro suave
//    post-entreno. Y comida y cena para 5 días, básico y rápido."
//
// Lo que hace este archivo:
//   · Define el plan generado (fuerza por día + N protocolos + pauta de comidas).
//   · Lo guarda como BORRADOR revisable (`week_plans`, migración 0056), para
//     que pedir ajustes puntuales no obligue a rehacer la petición entera.
//   · Al confirmar, lo REPARTE en las tablas que ya existen:
//       – una rutina preescrita (`workout_routines`) con los días de fuerza
//       – un protocolo por cardio (`activity_protocols`)
//       – bloques de agenda (`day_plan_items`) para fuerza, cardio y comidas,
//         cada uno ENLAZADO a lo que lo resuelve (routine_id / protocol_id)
//
// Ese enlace es lo que permite el punto 21bis: tocar el bloque del viernes en
// la Agenda abre directamente el checklist de ese día o el reproductor de ese
// cardio, sin ir a buscarlos.
//
// No se inventa un cuarto sitio donde vivan las cosas: al confirmar, el plan
// deja de ser una entidad aparte y pasa a ser rutina + protocolos + agenda.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { isoOf, todayISO, type MealSlot, type MuscleGroup } from './dayPlan';
import { localId as protocolLocalId, saveProtocol, type Protocol, type ProtocolSegment } from './protocols';
import { localId as routineLocalId, saveRoutine, type PrescribedExercise, type Routine, type RoutineDay } from './routines';

// ── El plan generado ───────────────────────────────────────────

export interface WeekStrengthDay {
  /** 0..6 dentro de la semana (0 = lunes). */
  weekday: number;
  /** Fecha real ya resuelta. */
  date: string;
  /** Nombre del día tal y como lo llamó el Asesor ("Push", "Espalda y pecho"). */
  name: string;
  groups: MuscleGroup[];
  exercises: PrescribedExercise[];
  note?: string;
}

export interface WeekProtocol {
  /** Identificador interno dentro del plan, para los ajustes. */
  key: string;
  /** Nombre con el que quedará en Actividad ("Cardio tarde — grasa"). */
  name: string;
  /** Tipo de actividad (cinta, correr, bici…). */
  kind: string;
  /** Franja del día en la que toca. Solo informativa. */
  when: 'morning' | 'midday' | 'afternoon' | 'evening';
  segments: ProtocolSegment[];
  /** Días de la semana (0..6) en los que va este cardio. */
  weekdays: number[];
  note?: string;
}

export interface WeekMeal {
  slot: MealSlot;
  text: string;
  /** Minutos de preparación estimados. */
  minutes: number;
}

export interface WeekMealDay {
  weekday: number;
  date: string;
  meals: WeekMeal[];
}

export interface WeekPlan {
  /** id de la fila en `week_plans`; local mientras no haya base. */
  id: string;
  /** Lo que escribió el usuario, literal. */
  request: string;
  /** Lunes de la semana que cubre. */
  weekStart: string;
  /** Días de entreno que el usuario dijo tener ESA semana. */
  trainingDays: number;
  /** Lo que pidió NO incluir. Se enseña siempre: es lo que más se incumple. */
  exclusions: string[];
  summary: string;
  disclaimer: string;
  strength: WeekStrengthDay[];
  protocols: WeekProtocol[];
  nutrition: WeekMealDay[];
  status: 'draft' | 'committed';
  createdAt: string;
}

export interface CommitResult {
  routineId: string | null;
  protocolIds: string[];
  agendaItems: number;
  /** true si algo se ha tenido que quedar en este navegador. */
  storedLocally: boolean;
  /** Bloques de agenda que NO se pudieron crear (migración 0042 sin aplicar). */
  agendaUnavailable: boolean;
}

// ── Fechas ─────────────────────────────────────────────────────

/** Lunes de la semana de `d`. */
export function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Lunes de esta semana en ISO. */
export function currentWeekStart(): string {
  return isoOf(mondayOf(new Date()));
}

/** Fecha del día `weekday` (0 = lunes) de la semana que empieza en `weekStart`. */
export function dateOfWeekday(weekStart: string, weekday: number): string {
  const d = new Date(`${weekStart}T12:00:00`);
  d.setDate(d.getDate() + Math.max(0, Math.min(6, weekday)));
  return isoOf(d);
}

/** Días con algo planificado, para el resumen. */
export function planTotals(plan: WeekPlan): { strengthDays: number; protocols: number; cardioSlots: number; mealDays: number; meals: number } {
  return {
    strengthDays: plan.strength.length,
    protocols: plan.protocols.length,
    cardioSlots: plan.protocols.reduce((a, p) => a + p.weekdays.length, 0),
    mealDays: plan.nutrition.length,
    meals: plan.nutrition.reduce((a, d) => a + d.meals.length, 0),
  };
}

/**
 * Días de la semana que TOCAN algo, ordenados. Sirve para pintar el resumen
 * por día en vez de por módulo, que es como lo va a leer el usuario.
 */
export function planWeekdays(plan: WeekPlan): number[] {
  const set = new Set<number>();
  plan.strength.forEach((s) => set.add(s.weekday));
  plan.protocols.forEach((p) => p.weekdays.forEach((w) => set.add(w)));
  plan.nutrition.forEach((n) => set.add(n.weekday));
  return [...set].sort((a, b) => a - b);
}

// ── Guardado del borrador ──────────────────────────────────────
//
// Mismo criterio que el resto de Mi Esquina: primero la base (migración 0056)
// y, si no está aplicada, este navegador, avisando de ello.

const LOCAL_KEY = 'rankd_week_plan';

function localKey(profileId: string) { return `${LOCAL_KEY}:${profileId}`; }

function readLocal(profileId: string): WeekPlan | null {
  try {
    const raw = localStorage.getItem(localKey(profileId));
    return raw ? (JSON.parse(raw) as WeekPlan) : null;
  } catch { return null; }
}

function writeLocal(profileId: string, plan: WeekPlan | null) {
  try {
    if (plan) localStorage.setItem(localKey(profileId), JSON.stringify(plan));
    else localStorage.removeItem(localKey(profileId));
  } catch { /* sin espacio */ }
}

export interface LoadedWeekPlan { plan: WeekPlan; storedLocally: boolean }

interface PlanRow { id: string; request: string; week_start: string; training_days: number; plan_json: WeekPlan; status: string; created_at: string }

/** El borrador a medias, si lo hay. Lo que se pide al abrir la pantalla. */
export async function loadDraft(profileId: string): Promise<LoadedWeekPlan | null> {
  const { data, error } = await supabase
    .from('week_plans')
    .select('id, request, week_start, training_days, plan_json, status, created_at')
    .eq('fighter_profile_id', profileId).eq('status', 'draft')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!error && data) {
    const row = data as PlanRow;
    return { plan: { ...row.plan_json, id: row.id, status: 'draft' }, storedLocally: false };
  }
  const local = readLocal(profileId);
  return local && local.status === 'draft' ? { plan: local, storedLocally: true } : null;
}

/** Guarda o actualiza el borrador. Devuelve el plan con su id definitivo. */
export async function saveDraft(profileId: string, plan: WeekPlan): Promise<{ plan: WeekPlan; storedLocally: boolean }> {
  const payload = {
    fighter_profile_id: profileId,
    request: plan.request.slice(0, 4000),
    week_start: plan.weekStart,
    training_days: Math.max(0, Math.min(7, plan.trainingDays)),
    plan_json: plan,
    status: 'draft',
    updated_at: new Date().toISOString(),
  };
  const isLocalId = plan.id.startsWith('wp_');

  const res = isLocalId
    ? await supabase.from('week_plans').insert(payload).select('id').maybeSingle()
    : await supabase.from('week_plans').update(payload).eq('id', plan.id).select('id').maybeSingle();

  if (!res.error && res.data) {
    const saved: WeekPlan = { ...plan, id: (res.data as { id: string }).id };
    writeLocal(profileId, null);
    return { plan: saved, storedLocally: false };
  }

  const stored: WeekPlan = { ...plan, id: isLocalId ? plan.id : newPlanId() };
  writeLocal(profileId, stored);
  return { plan: stored, storedLocally: true };
}

/** Tira el borrador sin confirmarlo. */
export async function discardDraft(profileId: string, plan: WeekPlan): Promise<void> {
  writeLocal(profileId, null);
  if (!plan.id.startsWith('wp_')) {
    await supabase.from('week_plans').update({ status: 'archived' }).eq('id', plan.id);
  }
}

let seq = 0;
export function newPlanId(): string {
  seq += 1;
  return `wp_${Date.now().toString(36)}_${seq.toString(36)}`;
}

// ── Confirmar: repartir el plan en sus secciones ───────────────

/**
 * Confirma el plan.
 *
 * El orden importa: primero se crean rutina y protocolos (para tener sus ids),
 * y solo después los bloques de la Agenda, que los enlazan. Si la Agenda no
 * está disponible (migración 0042 sin aplicar), la rutina y los protocolos YA
 * se han guardado y siguen siendo utilizables desde Fuerza y Actividad: se
 * pierde el acceso directo desde el día, no el trabajo.
 *
 * Los bloques del plan anterior generados por el Asesor en esas mismas fechas
 * se retiran antes de escribir los nuevos. Sin eso, regenerar el plan de la
 * semana dejaría el día con dos entrenos de fuerza y tres cardios.
 */
export async function commitWeekPlan(profileId: string, plan: WeekPlan): Promise<CommitResult> {
  const out: CommitResult = {
    routineId: null, protocolIds: [], agendaItems: 0,
    storedLocally: false, agendaUnavailable: false,
  };

  // ── 1. La rutina de fuerza de la semana ──
  let routine: Routine | null = null;
  if (plan.strength.length > 0) {
    const days: RoutineDay[] = plan.strength.map((s) => ({
      id: routineLocalId('day'),
      name: s.name || dayLabelFallback(s.weekday),
      note: s.note,
      exercises: s.exercises,
    }));
    const draft: Routine = {
      id: routineLocalId('rt'),
      name: plan.summary ? routineNameFrom(plan) : 'Rutina de la semana',
      note: plan.exclusions.length > 0 ? `Sin: ${plan.exclusions.join(', ')}` : undefined,
      days,
      source: 'import',
      createdAt: new Date().toISOString(),
    };
    const saved = await saveRoutine(profileId, draft);
    routine = saved.routine;
    out.routineId = saved.routine.id;
    if (saved.storedLocally) out.storedLocally = true;
  }

  // ── 2. Un protocolo por cardio ──
  const savedProtocols = new Map<string, Protocol>();
  for (const p of plan.protocols) {
    const draft: Protocol = {
      id: protocolLocalId('prot'),
      name: p.name,
      kind: p.kind,
      segments: p.segments,
      note: p.note,
      source: 'import',
      createdAt: new Date().toISOString(),
    };
    const saved = await saveProtocol(profileId, draft);
    savedProtocols.set(p.key, saved.protocol);
    out.protocolIds.push(saved.protocol.id);
    if (saved.storedLocally) out.storedLocally = true;
  }

  // ── 3. Los bloques de la Agenda ──
  const dates = new Set<string>();
  plan.strength.forEach((s) => dates.add(s.date));
  plan.protocols.forEach((p) => p.weekdays.forEach((w) => dates.add(dateOfWeekday(plan.weekStart, w))));
  plan.nutrition.forEach((n) => dates.add(n.date));

  // Limpieza de lo que dejó un plan anterior del Asesor en esas fechas.
  if (dates.size > 0) {
    await supabase.from('day_plan_items')
      .delete()
      .eq('fighter_profile_id', profileId)
      .eq('source', 'advisor')
      .in('plan_date', [...dates]);
  }

  interface Row { fighter_profile_id: string; plan_date: string; kind: string; payload: unknown; source: string; completed: boolean }
  const rows: Row[] = [];

  plan.strength.forEach((s, i) => {
    const day = routine?.days[i];
    rows.push({
      fighter_profile_id: profileId,
      plan_date: s.date,
      kind: 'strength',
      payload: {
        groups: s.groups,
        exercises: s.exercises.map((e) => ({
          name: e.name, sets: e.sets, reps_min: e.reps_min, reps_max: e.reps_max,
          value: e.value, weight_kg: e.weight_kg, weight_mode: e.weight_mode, tracking_mode: e.tracking_mode,
        })),
        note: s.note,
        routine_id: routine?.id,
        routine_day_id: day?.id,
        routine_name: s.name || routine?.name,
      },
      source: 'advisor',
      completed: false,
    });
  });

  plan.protocols.forEach((p) => {
    const saved = savedProtocols.get(p.key);
    const seconds = p.segments.reduce((a, s) => a + Math.max(0, s.seconds || 0), 0);
    p.weekdays.forEach((w) => {
      rows.push({
        fighter_profile_id: profileId,
        plan_date: dateOfWeekday(plan.weekStart, w),
        kind: 'activity',
        payload: {
          kind: p.kind,
          duration_min: seconds > 0 ? Math.round(seconds / 60) : undefined,
          note: p.note,
          protocol_id: saved?.id,
          protocol_name: p.name,
        },
        source: 'advisor',
        completed: false,
      });
    });
  });

  plan.nutrition.forEach((n) => {
    n.meals.forEach((m) => {
      rows.push({
        fighter_profile_id: profileId,
        plan_date: n.date,
        kind: 'meal',
        payload: { slot: m.slot, text: m.text, minutes: m.minutes },
        source: 'advisor',
        completed: false,
      });
    });
  });

  if (rows.length > 0) {
    let ins = await supabase.from('day_plan_items').insert(rows).select('id');
    // `source: 'advisor'` es un valor que la base admite (texto libre), pero si
    // algún CHECK lo rechazara, mejor guardar como 'manual' que perder el plan.
    if (ins.error && !isMissingTable(ins.error)) {
      ins = await supabase.from('day_plan_items')
        .insert(rows.map((r) => ({ ...r, source: 'manual' }))).select('id');
    }
    if (isMissingTable(ins.error)) out.agendaUnavailable = true;
    else out.agendaItems = (ins.data || []).length;
  }

  // ── 4. Cerrar el borrador ──
  const committed = { ...plan, status: 'committed' as const };
  writeLocal(profileId, null);
  if (!plan.id.startsWith('wp_')) {
    await supabase.from('week_plans').update({
      status: 'committed',
      plan_json: committed,
      committed_json: {
        routine_id: out.routineId,
        protocol_ids: out.protocolIds,
        agenda_items: out.agendaItems,
      },
      committed_at: new Date().toISOString(),
    }).eq('id', plan.id);
  }

  return out;
}

/** Nombre de la rutina a partir del plan. Corto y reconocible en la lista. */
function routineNameFrom(plan: WeekPlan): string {
  const d = new Date(`${plan.weekStart}T12:00:00`);
  const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `Semana del ${label} · ${plan.strength.length} días`;
}

function dayLabelFallback(weekday: number): string {
  const names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  return names[Math.max(0, Math.min(6, weekday))];
}

// ── Contexto que se le pasa al Asesor ──────────────────────────

export interface WeekContext {
  /** Lunes de la semana objetivo. */
  weekStart: string;
  /** Hoy, para que no planifique días que ya han pasado. */
  today: string;
  /** Nombres de ejercicio de la biblioteca, para que no se los invente. */
  exerciseNames: string[];
  /** Tipos de actividad válidos. */
  activityKinds: string[];
}

/** Fechas de la semana con su nombre, para el resumen. */
export function weekDates(weekStart: string): { weekday: number; date: string }[] {
  return Array.from({ length: 7 }, (_, i) => ({ weekday: i, date: dateOfWeekday(weekStart, i) }));
}

/** ¿Este día ya ha pasado? El plan no debe colocar nada ahí. */
export function isPast(date: string): boolean {
  return date < todayISO();
}
