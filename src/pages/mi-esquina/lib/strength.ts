// Cálculos compartidos sobre series de fuerza (strength_sets), para no
// repetir la misma lógica de marcas personales en StrengthLog y en el
// resumen semanal.

export interface StrengthSetRow {
  exercise: string;
  exercise_label: string;
  weight_kg: number | string;
  reps: number;
  session_date: string;
}

export interface ExerciseBest {
  exercise: string;
  label: string;
  best: number;
  bestReps: number;
  date: string;
}

/** Mejor marca (peso más alto) por ejercicio, a partir de las series dadas. */
export function bestByExercise(rows: StrengthSetRow[]): Map<string, ExerciseBest> {
  const map = new Map<string, ExerciseBest>();
  rows.forEach((r) => {
    const w = Number(r.weight_kg);
    const cur = map.get(r.exercise);
    if (!cur || w > cur.best) {
      map.set(r.exercise, { exercise: r.exercise, label: r.exercise_label, best: w, bestReps: r.reps, date: r.session_date });
    }
  });
  return map;
}

export interface WeeklyProgress { label: string; before: number; now: number; gain: number }

/**
 * El ejercicio con mayor subida de marca esta semana frente a su mejor marca
 * anterior. Solo cuenta si ya tenía una marca previa (para no señalar como
 * "progreso" el primer registro de un ejercicio nuevo).
 */
export function bestWeeklyProgress(rows: StrengthSetRow[], weekStartISO: string): WeeklyProgress | null {
  const before = bestByExercise(rows.filter((r) => r.session_date < weekStartISO));
  const thisWeek = bestByExercise(rows.filter((r) => r.session_date >= weekStartISO));

  let top: WeeklyProgress | null = null;
  thisWeek.forEach((now, key) => {
    const prev = before.get(key);
    if (!prev || now.best <= prev.best) return;
    const gain = +(now.best - prev.best).toFixed(1);
    if (!top || gain > top.gain) top = { label: now.label, before: prev.best, now: now.best, gain };
  });
  return top;
}
