// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · Rutinas preescritas (punto 17)
//
// Gemelo de `protocols.ts` para el entreno con pasos preescritos. Allí se
// reproduce un guion por tramos; aquí se va marcando un checklist:
//
//   Rutina → días con nombre ("Push", "Pull", "Pierna", "Circuito A")
//          → ejercicios con sus series y repeticiones ya decididas
//          → al entrenar, cada serie se marca y se ajusta el peso real
//
// No es exclusivo de la Fuerza clásica: un circuito o una sesión de calistenia
// se describen igual (series + repeticiones, o series + tiempo, o + metros).
//
// Al terminar NO se inventa un historial nuevo: la sesión se escribe en
// `strength_sets`, exactamente igual que si se hubiera registrado a mano. Esa
// es la diferencia entre una función útil y un PDF bonito.
//
// Sin IA también funciona: `parseRoutineText` entiende el formato habitual de
// las rutinas escritas ("Press banca 4x8-10"). El Asesor es el atajo cómodo.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { writeDroppingMissingColumns } from '@/lib/dbState';
import {
  muscleGroupOf, trackingModeOf, weightModeOf,
  type MuscleGroup, type TrackingMode, type WeightMode,
} from './exercises';

// ── Modelo ─────────────────────────────────────────────────────

export interface PrescribedExercise {
  id: string;
  /** Nombre tal cual lo verá el usuario. Campo libre, como en el registro. */
  name: string;
  group: MuscleGroup;
  sets: number;
  /** Repeticiones (tracking 'reps'). Con reps_max forman un rango "8–10". */
  reps_min: number;
  reps_max?: number;
  /** Segundos ('time') o metros ('distance'). */
  value?: number;
  /** Peso prescrito, si la rutina lo trae. El real se ajusta al entrenar. */
  weight_kg?: number;
  weight_mode: WeightMode;
  tracking_mode: TrackingMode;
  note?: string;
}

export interface RoutineDay {
  id: string;
  name: string;
  note?: string;
  exercises: PrescribedExercise[];
}

export interface Routine {
  id: string;
  name: string;
  note?: string;
  days: RoutineDay[];
  source: 'manual' | 'import';
  createdAt: string;
  lastUsedAt?: string | null;
}

let seq = 0;
export function localId(prefix = 'ex'): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export function emptyExercise(): PrescribedExercise {
  return {
    id: localId(),
    name: '',
    group: 'full_body',
    sets: 4,
    reps_min: 8,
    reps_max: 10,
    weight_mode: 'total',
    tracking_mode: 'reps',
  };
}

export function emptyDay(name: string): RoutineDay {
  return { id: localId('day'), name, exercises: [emptyExercise()] };
}

export function emptyRoutine(name: string): Routine {
  return {
    id: localId('rt'),
    name,
    days: [emptyDay('')],
    source: 'manual',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Rellena grupo y modos a partir del nombre del ejercicio.
 *
 * La biblioteca ya sabe que "Press banca con barra" es pecho, se mide en
 * repeticiones y el peso es el total; y que "Plancha" va por tiempo y peso
 * corporal. Preguntárselo al usuario ejercicio a ejercicio sería hacerle
 * teclear lo que la app ya sabe.
 */
export function inferExerciseMeta(name: string): Pick<PrescribedExercise, 'group' | 'weight_mode' | 'tracking_mode'> {
  return {
    group: muscleGroupOf(name) || 'full_body',
    weight_mode: weightModeOf(name),
    tracking_mode: trackingModeOf(name),
  };
}

export function routineTotals(r: Routine): { days: number; exercises: number; sets: number } {
  let exercises = 0;
  let sets = 0;
  for (const d of r.days) {
    exercises += d.exercises.length;
    for (const e of d.exercises) sets += Math.max(0, e.sets);
  }
  return { days: r.days.length, exercises, sets };
}

/** Grupos musculares distintos que toca un día. Para la cabecera y el tick. */
export function dayGroups(d: RoutineDay): MuscleGroup[] {
  return [...new Set(d.exercises.map((e) => e.group))];
}

// ── Leer una rutina escrita a mano (sin IA) ────────────────────

export interface ParsedRoutine {
  days: RoutineDay[];
  /** true si ha tenido que meter los ejercicios en un día sin nombre. */
  guessedDays: boolean;
}

const SET_RE = /(\d{1,2})\s*[x×*]\s*(\d{1,3})(?:\s*[-–a]\s*(\d{1,3}))?/i;
const WEIGHT_RE = /(\d{1,3}(?:[.,]\d+)?)\s*(?:kg|kilos?)\b/i;
const TIME_RE = /(\d{1,3})\s*(?:s|seg|segundos|sec)\b/i;
const DIST_RE = /(\d{1,4})\s*(?:m|metros)\b/i;

/**
 * Convierte un texto pegado en días con sus ejercicios.
 *
 * Reconoce:
 *   · "DÍA 1 — PUSH", "Pull", "Lunes: Pierna"  → cabecera de día
 *   · "Press banca 4x8-10 60kg"                → 4 series de 8-10 con 60 kg
 *   · "Plancha 3x45s"                          → 3 series de 45 segundos
 *   · "Paseo del granjero 3x20m"               → 3 series de 20 metros
 *
 * Una línea sin patrón de series y razonablemente corta se toma como el
 * nombre del día siguiente. Es la convención de casi cualquier rutina escrita.
 */
export function parseRoutineText(text: string): ParsedRoutine {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const days: RoutineDay[] = [];
  let guessedDays = false;

  /**
   * Día en curso. Si aún no hay ninguno (la rutina empieza directamente con
   * ejercicios, sin cabecera), se abre uno sin nombre y se deja constancia en
   * `guessedDays` para poder avisar de que ese reparto es una suposición.
   */
  const currentDay = (): RoutineDay => {
    const last = days[days.length - 1];
    if (last) return last;
    const fresh: RoutineDay = { id: localId('day'), name: '', exercises: [] };
    days.push(fresh);
    guessedDays = true;
    return fresh;
  };

  for (const line of lines) {
    const setMatch = line.match(SET_RE);

    // Sin patrón "N x M": es la cabecera de un día nuevo.
    if (!setMatch) {
      // Se ignoran las líneas de adorno ("-----"); "SEMANA 1" sola sirve igual
      // como cabecera, así que solo se filtran las que no traen letras.
      if (!/[a-záéíóúñ]/i.test(line)) continue;
      days.push({ id: localId('day'), name: line.replace(/^[-–•*\s]+/, '').slice(0, 60), exercises: [] });
      continue;
    }

    const day = currentDay();

    const sets = Math.min(12, Math.max(1, parseInt(setMatch[1], 10)));
    const a = parseInt(setMatch[2], 10);
    const b = setMatch[3] ? parseInt(setMatch[3], 10) : undefined;

    // El nombre es lo que queda al quitar series, peso y unidades.
    let name = line
      .replace(SET_RE, ' ')
      .replace(WEIGHT_RE, ' ')
      .replace(/^[-–•*\d.\s)]+/, '')
      .replace(/[|·,;]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!name) name = line.trim().slice(0, 60);

    const meta = inferExerciseMeta(name);

    // El "45s" o el "20m" van pegados al número de repeticiones en el propio
    // patrón de series, así que se miran sobre la parte derecha de la línea.
    const tail = line.slice(line.indexOf(setMatch[0]) + setMatch[0].length - String(setMatch[2]).length);
    const isTime = TIME_RE.test(tail) || meta.tracking_mode === 'time';
    const isDist = !isTime && (DIST_RE.test(tail) || meta.tracking_mode === 'distance');

    const weightMatch = line.match(WEIGHT_RE);
    const weight = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : undefined;

    day.exercises.push({
      id: localId(),
      name: name.slice(0, 80),
      group: meta.group,
      sets,
      reps_min: isTime || isDist ? 0 : a,
      reps_max: !isTime && !isDist && b && b > a ? b : undefined,
      value: isTime || isDist ? a : undefined,
      weight_kg: weight,
      weight_mode: meta.weight_mode,
      tracking_mode: isTime ? 'time' : isDist ? 'distance' : 'reps',
    });
  }

  return { days: days.filter((d) => d.exercises.length > 0), guessedDays };
}

// ── Guardado de la plantilla ───────────────────────────────────
//
// Mismo criterio que el resto de Mi Esquina: primero la base (migración 0054)
// y, si no está aplicada, este navegador, avisando de ello.

const LOCAL_KEY = 'rankd_routines';

function localKey(profileId: string) { return `${LOCAL_KEY}:${profileId}`; }

function readLocal(profileId: string): Routine[] {
  try {
    const raw = localStorage.getItem(localKey(profileId));
    const list = raw ? (JSON.parse(raw) as Routine[]) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function writeLocal(profileId: string, list: Routine[]) {
  try { localStorage.setItem(localKey(profileId), JSON.stringify(list)); } catch { /* sin espacio */ }
}

interface RoutineRow {
  id: string;
  name: string;
  note: string | null;
  days: RoutineDay[];
  source: string;
  last_used_at: string | null;
  created_at: string;
}

const rowToRoutine = (r: RoutineRow): Routine => ({
  id: r.id,
  name: r.name,
  note: r.note || undefined,
  days: Array.isArray(r.days) ? r.days : [],
  source: r.source === 'import' ? 'import' : 'manual',
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
});

export interface LoadedRoutines { routines: Routine[]; storedLocally: boolean }

export async function loadRoutines(profileId: string): Promise<LoadedRoutines> {
  const { data, error } = await supabase
    .from('workout_routines')
    .select('id, name, note, days, source, last_used_at, created_at')
    .eq('fighter_profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) return { routines: readLocal(profileId), storedLocally: true };

  const remote = ((data || []) as RoutineRow[]).map(rowToRoutine);
  const local = readLocal(profileId).filter((r) => !remote.some((x) => x.id === r.id));
  return { routines: [...remote, ...local], storedLocally: local.length > 0 && remote.length === 0 };
}

export async function saveRoutine(profileId: string, r: Routine): Promise<{ routine: Routine; storedLocally: boolean }> {
  const payload = {
    fighter_profile_id: profileId,
    name: r.name.trim().slice(0, 120) || 'Rutina',
    note: r.note?.trim() || null,
    days: r.days,
    source: r.source,
    updated_at: new Date().toISOString(),
  };
  const isLocalId = r.id.startsWith('rt_');

  const { result } = await writeDroppingMissingColumns(
    [payload],
    (rows) => (isLocalId
      ? supabase.from('workout_routines').insert(rows).select().maybeSingle()
      : supabase.from('workout_routines').update(rows[0]).eq('id', r.id).select().maybeSingle()),
    ['fighter_profile_id', 'name', 'days'],
  );

  if (!result.error && result.data) {
    writeLocal(profileId, readLocal(profileId).filter((x) => x.id !== r.id));
    return { routine: rowToRoutine(result.data as RoutineRow), storedLocally: false };
  }

  const stored: Routine = { ...r, id: isLocalId ? r.id : localId('rt') };
  writeLocal(profileId, [stored, ...readLocal(profileId).filter((x) => x.id !== stored.id)]);
  return { routine: stored, storedLocally: true };
}

/**
 * Una rutina concreta por id, mire donde mire (cuenta o navegador).
 *
 * Lo usa la Agenda para abrir el día que toca al tocar el bloque de Fuerza.
 * Se apoya en `loadRoutines` en vez de hacer su propio SELECT porque las
 * rutinas guardadas sin base viven en localStorage y un SELECT no las vería:
 * el acceso directo tiene que funcionar también con las migraciones sin aplicar.
 */
export async function loadRoutineById(profileId: string, id: string): Promise<Routine | null> {
  const { routines } = await loadRoutines(profileId);
  return routines.find((r) => r.id === id) ?? null;
}

export async function deleteRoutine(profileId: string, id: string): Promise<void> {
  writeLocal(profileId, readLocal(profileId).filter((x) => x.id !== id));
  if (!id.startsWith('rt_')) {
    await supabase.from('workout_routines').delete().eq('id', id);
  }
}

// ── Guardar la sesión entrenada ────────────────────────────────

/** Una serie realmente hecha, con el peso y las repeticiones del día. */
export interface LoggedSet {
  exerciseName: string;
  group: MuscleGroup;
  weightMode: WeightMode;
  trackingMode: TrackingMode;
  /** Repeticiones (o segundos / metros, según trackingMode). */
  reps: number;
  weight: number;
  note?: string;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Escribe la sesión en `strength_sets`, el historial de Fuerza de siempre.
 *
 * Las filas salen con la MISMA forma que las del registro manual (mismo
 * `set_number` por ejercicio, mismos modos, mismo grupo muscular), así que la
 * sesión aparece en el historial, en las gráficas y en los récords sin que
 * nada sepa que venía de una rutina. Es justo lo que pide el encargo: "igual
 * que si se hubiera registrado desde cero".
 */
export async function saveRoutineSession(
  profileId: string,
  date: string,
  slot: string | null,
  sets: LoggedSet[],
): Promise<{ ok: boolean }> {
  if (sets.length === 0) return { ok: false };

  // El número de serie se cuenta POR EJERCICIO, no por sesión.
  const counters = new Map<string, number>();
  const rows = sets.map((s) => {
    const key = normalize(s.exerciseName);
    const n = (counters.get(key) || 0) + 1;
    counters.set(key, n);
    return {
      fighter_profile_id: profileId,
      exercise: key,
      exercise_label: s.exerciseName.trim(),
      session_date: date,
      set_number: n,
      reps: Math.max(0, Math.round(s.reps)),
      reps_max: null,
      weight_kg: Math.max(0, s.weight),
      muscle_group: s.group,
      session_slot: slot,
      weight_mode: s.weightMode,
      tracking_mode: s.trackingMode,
      machine_label: null,
      drop_step: null,
      notes: n === 1 ? (s.note ?? null) : null,
    };
  });

  const { result } = await writeDroppingMissingColumns(
    rows,
    (r) => supabase.from('strength_sets').insert(r).select(),
    ['fighter_profile_id', 'exercise', 'exercise_label', 'session_date', 'set_number', 'reps', 'weight_kg'],
  );

  return { ok: !result.error };
}

/** Deja constancia de que la rutina se ha usado hoy (para ordenar la lista). */
export async function touchRoutine(profileId: string, routine: Routine): Promise<void> {
  const now = new Date().toISOString();
  if (routine.id.startsWith('rt_')) {
    writeLocal(profileId, readLocal(profileId).map((r) => (r.id === routine.id ? { ...r, lastUsedAt: now } : r)));
    return;
  }
  await supabase.from('workout_routines').update({ last_used_at: now }).eq('id', routine.id);
}

/**
 * Último peso usado en cada ejercicio, para proponerlo al entrenar.
 *
 * Una rutina puede no traer pesos (muchas solo dicen "4x8-10"), y aunque los
 * traiga, el peso de hace tres semanas ya no es el de hoy. Lo que de verdad
 * sirve es lo que levantó la última vez.
 */
export async function lastWeights(profileId: string, names: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const keys = [...new Set(names.map(normalize).filter(Boolean))];
  if (keys.length === 0) return out;

  const { data, error } = await supabase
    .from('strength_sets')
    .select('exercise, weight_kg, session_date')
    .eq('fighter_profile_id', profileId)
    .in('exercise', keys)
    .order('session_date', { ascending: false })
    .limit(600);
  if (error || !data) return out;

  for (const row of data as { exercise: string; weight_kg: number; session_date: string }[]) {
    // Las filas llegan de más reciente a más antigua: la primera de cada
    // ejercicio es la buena.
    if (!out.has(row.exercise)) out.set(row.exercise, Number(row.weight_kg) || 0);
  }
  return out;
}
