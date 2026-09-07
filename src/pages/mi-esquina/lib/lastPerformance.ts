// "Cómo fue la última vez" de un ejercicio + una sugerencia EDITABLE para hoy.
//
// Todo se deriva de filas de `strength_sets` que el usuario ya guardó: no hay
// IA, ni tablas nuevas, ni estimaciones de esfuerzo. La sugerencia es una
// opción que pre-rellena inputs que el usuario puede cambiar — nunca una
// prescripción, y en ningún caso una recomendación de salud.

import type { TrackingMode, WeightMode } from './exercises';

export interface PerfRow {
  session_date: string;
  reps: number;
  reps_max: number | null;
  weight_kg: number | string;
  notes?: string | null;
}

export interface LastPerformance {
  /** Fecha de la última sesión con este ejercicio. */
  lastDate: string;
  /** Días transcurridos desde esa sesión (0 = hoy). */
  daysAgo: number;
  /** Series de esa última sesión, en orden. */
  sets: { reps: number; repsMax: number | null; weight: number }[];
  /** Mejor carga registrada nunca (0 si el ejercicio no lleva peso). */
  bestWeight: number;
  bestWeightDate: string | null;
  /** Nota escrita en la última sesión, si la hay. */
  note: string | null;
}

/** Incremento de carga razonable según cómo se mide el peso del ejercicio. */
function stepFor(weight: number, mode: WeightMode): number {
  if (mode === 'per_dumbbell') return weight >= 20 ? 2 : 1;
  if (mode === 'per_side') return 1.25;
  return weight >= 60 ? 5 : 2.5;
}

function roundTo(value: number, step: number): number {
  return +(Math.round(value / step) * step).toFixed(2);
}

export function buildLastPerformance(rows: PerfRow[]): LastPerformance | null {
  if (rows.length === 0) return null;
  // `rows` llega ordenado por fecha descendente.
  const lastDate = rows[0].session_date;
  const lastRows = rows.filter((r) => r.session_date === lastDate);

  let bestWeight = 0;
  let bestWeightDate: string | null = null;
  rows.forEach((r) => {
    const w = Number(r.weight_kg) || 0;
    if (w > bestWeight) { bestWeight = w; bestWeightDate = r.session_date; }
  });

  const note = lastRows.map((r) => (r.notes || '').trim()).find((n) => n !== '') || null;

  const days = Math.floor(
    (new Date().setHours(0, 0, 0, 0) - new Date(lastDate + 'T00:00:00').setHours(0, 0, 0, 0)) / 86400000,
  );

  return {
    lastDate,
    daysAgo: Math.max(0, days),
    sets: lastRows.map((r) => ({
      reps: r.reps,
      repsMax: r.reps_max ?? null,
      weight: Number(r.weight_kg) || 0,
    })),
    bestWeight,
    bestWeightDate,
    note,
  };
}

export interface Suggestion {
  /** Series propuestas para hoy (mismo formato que los inputs del formulario). */
  sets: { reps: string; weight: string }[];
  /** true = se propone subir carga; false = se propone repetir lo mismo. */
  stepUp: boolean;
  /** Carga propuesta si stepUp (para el texto). */
  nextWeight: number | null;
  /** Carga de la última vez (para el texto). */
  lastWeight: number;
  /** Nº de series y repeticiones de la última vez (para el texto). */
  lastSetCount: number;
  lastRepsLabel: string;
}

/**
 * Propone qué hacer hoy a partir de la última sesión.
 *
 * Solo sugiere subir carga cuando el ejercicio se mide en repeticiones, llevaba
 * peso, y en TODAS las series se alcanzó el tope del rango: es la señal más
 * conservadora de que la carga se quedó corta. En cualquier otro caso propone
 * repetir. El usuario puede editar todos los campos después.
 */
export function buildSuggestion(perf: LastPerformance, tracking: TrackingMode, weightMode: WeightMode): Suggestion {
  const setCount = perf.sets.length;
  const first = perf.sets[0];
  const lastRepsLabel = first.repsMax && first.repsMax > first.reps
    ? `${first.reps}-${first.repsMax}`
    : String(first.reps);
  const lastWeight = Math.max(...perf.sets.map((s) => s.weight));

  const hitTopOfRange = perf.sets.every((s) => (s.repsMax ? s.reps >= s.repsMax : true));
  const canStepUp = tracking === 'reps' && lastWeight > 0 && hitTopOfRange;

  const nextWeight = canStepUp
    ? roundTo(lastWeight + stepFor(lastWeight, weightMode), weightMode === 'per_side' ? 1.25 : 0.5)
    : null;

  return {
    sets: perf.sets.map((s) => ({
      reps: s.repsMax && s.repsMax > s.reps ? `${s.reps}-${s.repsMax}` : String(s.reps),
      weight: s.weight > 0 ? String(s.weight) : '',
    })),
    stepUp: canStepUp,
    nextWeight,
    lastWeight,
    lastSetCount: setCount,
    lastRepsLabel,
  };
}
