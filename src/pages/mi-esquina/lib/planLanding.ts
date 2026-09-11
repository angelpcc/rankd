// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · Aterrizar lo importado en días concretos
//
// ── POR QUÉ HACE FALTA ──
//
// Una rutina y un protocolo NO tienen fecha. Una rutina dice "Día A, Día B,
// Día C"; un protocolo dice "40 minutos de cinta así". La Agenda, en cambio,
// solo entiende días del calendario.
//
// Antes ese salto no se daba: lo importado se quedaba en su biblioteca (Fuerza
// › Rutinas, Actividad › Protocolos) y la Agenda ni se enteraba. Eran dos
// mundos separados, y por eso planificar la semana y "tener una rutina" parecía
// hacer el mismo trabajo dos veces.
//
// Aquí se da ese salto: eliges a qué día de la semana va cada pieza y se
// escriben los bloques del plan, con TODO el detalle dentro (los ejercicios con
// sus series, o el tipo y los minutos del cardio) más el enlace a la rutina o
// al protocolo que lo resuelve. Así:
//
//   · La Agenda enseña qué toca cada día, con su detalle.
//   · Al tocar el bloque se abre el checklist en vivo o el reproductor.
//   · Al ir a Fuerza, el registro ya viene con esos ejercicios puestos.
//
// El guion detallado (los tramos del cardio, el día concreto de la rutina)
// sigue guardado en su tabla: es lo que necesita el reproductor. Lo que
// desaparece es la PANTALLA de biblioteca, no el dato.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { isoOf, type ActivityPayload, type ExerciseSpec, type StrengthPayload } from './dayPlan';
import type { Protocol } from './protocols';
import type { Routine, RoutineDay } from './routines';

/** Lunes de la semana de `d`, a medianoche. */
export function mondayOf(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - dow);
  return x;
}

/**
 * Fecha ISO del día `dow` (0=domingo … 6=sábado, como Date.getDay) dentro de la
 * semana que empieza el lunes `ws`.
 */
export function dateOfDow(ws: Date, dow: number): string {
  const x = new Date(ws);
  x.setDate(x.getDate() + (dow === 0 ? 6 : dow - 1));
  return isoOf(x);
}

/** Un día de la rutina y el día de la semana al que se manda. `null` = no se pone. */
export interface DayAssignment {
  dayId: string;
  /** 0=domingo … 6=sábado. null si el usuario lo deja fuera. */
  dow: number | null;
}

/** Pasa los ejercicios prescritos al formato que guarda el bloque del plan. */
function toSpecs(day: RoutineDay): ExerciseSpec[] {
  return day.exercises
    .filter((e) => e.name.trim())
    .map((e) => {
      const spec: ExerciseSpec = {
        name: e.name.trim(),
        sets: Math.max(1, e.sets || 1),
        weight_mode: e.weight_mode,
        tracking_mode: e.tracking_mode,
      };
      if (e.reps_min > 0) spec.reps_min = e.reps_min;
      if (e.reps_max && e.reps_max > 0) spec.reps_max = e.reps_max;
      if (e.value && e.value > 0) spec.value = e.value;
      if (e.weight_kg && e.weight_kg > 0) spec.weight_kg = e.weight_kg;
      return spec;
    });
}

export interface LandingResult {
  /** Cuántos bloques se han escrito en la Agenda. */
  added: number;
  error: boolean;
}

/**
 * Escribe en la Agenda los días de una rutina.
 *
 * `routineId` puede ser null: si la rutina no se llegó a guardar en la base (sin
 * conexión, tabla sin migrar), el bloque conserva igualmente los ejercicios y
 * sirve para entrenar y para registrar. Lo único que se pierde es el checklist
 * en vivo, que necesita la rutina guardada.
 */
export async function landRoutine(
  profileId: string,
  routine: Routine,
  routineId: string | null,
  asignaciones: DayAssignment[],
  weekStart: Date = mondayOf(),
): Promise<LandingResult> {
  const rows = asignaciones
    .filter((a) => a.dow !== null)
    .map((a) => {
      const day = routine.days.find((d) => d.id === a.dayId);
      if (!day) return null;
      const specs = toSpecs(day);
      const groups = [...new Set(day.exercises.map((e) => e.group).filter(Boolean))];
      const payload: StrengthPayload = {
        groups,
        ...(specs.length > 0 ? { exercises: specs } : {}),
        ...(day.note ? { note: day.note } : {}),
        ...(routineId ? { routine_id: routineId, routine_day_id: day.id, routine_name: routine.name } : {}),
      };
      return {
        fighter_profile_id: profileId,
        plan_date: dateOfDow(weekStart, a.dow as number),
        kind: 'strength',
        payload,
        source: 'manual',
        completed: false,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  if (rows.length === 0) return { added: 0, error: false };
  const { error } = await supabase.from('day_plan_items').insert(rows);
  return { added: error ? 0 : rows.length, error: !!error };
}

/**
 * Escribe en la Agenda un protocolo, en los días elegidos.
 *
 * Los minutos van al bloque para que la Agenda pueda enseñar "Cinta · 40 min"
 * sin tener que cargar el protocolo entero solo para pintar una línea.
 */
export async function landProtocol(
  profileId: string,
  protocol: Protocol,
  protocolId: string | null,
  dows: number[],
  weekStart: Date = mondayOf(),
): Promise<LandingResult> {
  const seconds = protocol.segments.reduce((acc, s) => acc + Math.max(0, s.seconds || 0), 0);
  const payload: ActivityPayload = {
    kind: protocol.kind,
    ...(seconds > 0 ? { duration_min: Math.round(seconds / 60) } : {}),
    ...(protocol.note ? { note: protocol.note } : {}),
    ...(protocolId ? { protocol_id: protocolId, protocol_name: protocol.name } : {}),
  };

  const rows = dows.map((dow) => ({
    fighter_profile_id: profileId,
    plan_date: dateOfDow(weekStart, dow),
    kind: 'activity',
    payload,
    source: 'manual',
    completed: false,
  }));

  if (rows.length === 0) return { added: 0, error: false };
  const { error } = await supabase.from('day_plan_items').insert(rows);
  return { added: error ? 0 : rows.length, error: !!error };
}
