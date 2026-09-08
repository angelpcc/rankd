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

// ── Series descendentes (dropsets) ──
//
// En la base hay UNA FILA POR ESCALÓN, pero un dropset de tres bajadas es UNA
// serie, no tres. Los escalones de una misma serie comparten `set_number` y se
// numeran con `drop_step` 1, 2, 3… (migración 0047).

/** Fila mínima para poder agrupar por serie. */
export interface SeriesRow { set_number: number; drop_step?: number | null }

/** Una serie con sus bajadas, si las tenía. */
export interface Series<T extends SeriesRow> { main: T; drops: T[] }

/**
 * Agrupa las filas de un ejercicio en SERIES.
 *
 * Sin la migración 0047, `drop_step` llega null en todas y cada fila es su
 * propia serie: exactamente el comportamiento de siempre.
 */
export function groupSeries<T extends SeriesRow>(rows: T[]): Series<T>[] {
  const bySet = new Map<number, T[]>();
  rows.forEach((r) => bySet.set(r.set_number, [...(bySet.get(r.set_number) || []), r]));
  return [...bySet.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => {
      const sorted = [...group].sort((a, b) => (a.drop_step ?? 1) - (b.drop_step ?? 1));
      return { main: sorted[0], drops: sorted.slice(1) };
    });
}

/** true si la fila es una BAJADA de un dropset, no una serie de verdad. */
export function isDropStep(r: { drop_step?: number | null }): boolean {
  return !!r.drop_step && r.drop_step > 1;
}
