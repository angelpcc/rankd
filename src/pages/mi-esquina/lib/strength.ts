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

export interface WeeklyProgress { exercise: string; label: string; before: number; now: number; gain: number }

/** Lunes de esta semana (o `offsetWeeks` semanas atrás), en ISO local. */
export function startOfWeekISO(offsetWeeks = 0): string {
  const d = new Date();
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - day + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Todos los ejercicios que subieron de marca esta semana frente a su mejor
 * marca anterior, ordenados de mayor a menor subida. Solo cuenta si ya tenía
 * una marca previa (para no señalar como "progreso" un ejercicio nuevo).
 */
export function weeklyProgressList(rows: StrengthSetRow[], weekStartISO: string): WeeklyProgress[] {
  const before = bestByExercise(rows.filter((r) => r.session_date < weekStartISO));
  const thisWeek = bestByExercise(rows.filter((r) => r.session_date >= weekStartISO));
  const out: WeeklyProgress[] = [];
  thisWeek.forEach((now, key) => {
    const prev = before.get(key);
    if (!prev || now.best <= prev.best) return;
    out.push({ exercise: key, label: now.label, before: prev.best, now: now.best, gain: +(now.best - prev.best).toFixed(1) });
  });
  return out.sort((a, b) => b.gain - a.gain);
}

/** El ejercicio con mayor subida de marca esta semana (o null si ninguno). */
export function bestWeeklyProgress(rows: StrengthSetRow[], weekStartISO: string): WeeklyProgress | null {
  return weeklyProgressList(rows, weekStartISO)[0] || null;
}
