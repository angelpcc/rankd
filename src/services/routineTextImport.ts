// Importar una RUTINA preescrita desde un texto o una foto (punto 17).
//
// Habla con /api/coach (modo `routineText`). Es el hermano de
// `routineImport.ts`, que lee una foto de un plan SEMANAL (días de la semana
// con una línea de texto por día) y sirve para la Agenda. Este otro lee una
// RUTINA DE GIMNASIO: días con nombre y, dentro, ejercicios con sus series y
// su rango de repeticiones, que es lo que se puede convertir en un checklist.
//
// La IA puede estar EN PAUSA. Cuando lo está, `parseRoutineText`
// (lib/routines.ts) lee el mismo texto en el navegador: importar sigue siendo
// posible sin depender del servidor.

import { supabase } from '@/lib/supabase';
import { inferExerciseMeta, localId, type PrescribedExercise, type RoutineDay } from '@/pages/mi-esquina/lib/routines';
import { MUSCLE_GROUPS, muscleGroupOf, type MuscleGroup, type TrackingMode, type WeightMode } from '@/pages/mi-esquina/lib/exercises';

export interface ImportedRoutine {
  name: string;
  days: RoutineDay[];
  note?: string;
}

export interface RoutineImportResult {
  routine: ImportedRoutine | null;
  error: string | null;
}

/** Sonda de disponibilidad (no gasta cuota). */
export async function checkRoutineTextImportAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/coach', { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.available;
  } catch {
    return false;
  }
}

const TRACKING: TrackingMode[] = ['reps', 'time', 'distance'];
const WEIGHTS: WeightMode[] = ['total', 'per_side', 'per_dumbbell', 'bodyweight'];

/**
 * Normaliza lo que devuelve el modelo.
 *
 * Se confía en el nombre del ejercicio por encima de lo que diga el modelo
 * sobre grupo y modos: la biblioteca de la app ya sabe que "Plancha" va por
 * tiempo y sin peso, y ese dato es más fiable que una etiqueta inventada. Solo
 * se acepta lo del modelo cuando la biblioteca no reconoce el ejercicio.
 */
function normalizeDays(raw: unknown): RoutineDay[] {
  if (!Array.isArray(raw)) return [];

  return raw.slice(0, 14).map((item) => {
    const d = (item || {}) as Record<string, unknown>;
    const exercisesRaw = Array.isArray(d.exercises) ? d.exercises : [];

    const exercises: PrescribedExercise[] = exercisesRaw.slice(0, 30).map((exItem) => {
      const e = (exItem || {}) as Record<string, unknown>;
      const name = String(e.name || '').trim().slice(0, 80);
      const meta = inferExerciseMeta(name);
      // "Conocido" = la biblioteca lo tiene fichado. `inferExerciseMeta` cae a
      // 'full_body' cuando no lo reconoce, así que comprobar el grupo que
      // devuelve no distingue nada: hay que preguntarle a la biblioteca.
      const known = !!name && muscleGroupOf(name) !== null;

      const sets = Math.min(12, Math.max(1, Number(e.sets) || 3));
      const repsMin = Math.max(0, Math.round(Number(e.reps_min) || 0));
      const repsMaxRaw = Math.round(Number(e.reps_max) || 0);
      const value = Math.max(0, Math.round(Number(e.value) || 0));
      const weight = Number(e.weight_kg);

      const modelTracking = TRACKING.includes(e.tracking_mode as TrackingMode) ? (e.tracking_mode as TrackingMode) : 'reps';
      const modelWeight = WEIGHTS.includes(e.weight_mode as WeightMode) ? (e.weight_mode as WeightMode) : 'total';
      const modelGroup = MUSCLE_GROUPS.includes(e.group as MuscleGroup) ? (e.group as MuscleGroup) : 'full_body';

      const tracking = known && meta.tracking_mode !== 'reps' ? meta.tracking_mode : modelTracking;

      return {
        id: localId(),
        name: name || '—',
        group: known ? meta.group : modelGroup,
        sets,
        reps_min: tracking === 'reps' ? (repsMin || 8) : 0,
        reps_max: tracking === 'reps' && repsMaxRaw > repsMin ? repsMaxRaw : undefined,
        value: tracking === 'reps' ? undefined : (value || repsMin || 30),
        weight_kg: Number.isFinite(weight) && weight > 0 ? weight : undefined,
        weight_mode: known ? meta.weight_mode : modelWeight,
        tracking_mode: tracking,
        note: typeof e.note === 'string' && e.note.trim() ? e.note.trim().slice(0, 200) : undefined,
      };
    }).filter((e) => e.name !== '—');

    return {
      id: localId('day'),
      name: String(d.name || '').trim().slice(0, 60),
      note: typeof d.note === 'string' && d.note.trim() ? d.note.trim().slice(0, 200) : undefined,
      exercises,
    };
  }).filter((d) => d.exercises.length > 0);
}

interface Payload {
  text?: string;
  imageBase64?: string;
  mediaType?: string;
}

export async function importRoutine(payload: Payload): Promise<RoutineImportResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        section: 'training',
        routineText: {
          text: payload.text,
          imageBase64: payload.imageBase64,
          mediaType: payload.mediaType,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.routine) {
      return { routine: null, error: data?.message || null };
    }

    const days = normalizeDays(data.routine.days);
    if (days.length === 0) return { routine: null, error: null };

    return {
      routine: {
        name: String(data.routine.name || '').trim().slice(0, 120) || 'Rutina importada',
        days,
        note: typeof data.routine.note === 'string' ? data.routine.note.slice(0, 400) : undefined,
      },
      error: null,
    };
  } catch {
    return { routine: null, error: null };
  }
}
