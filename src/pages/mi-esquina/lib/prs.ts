// Marcas personales derivadas de `strength_sets`.
//
// No se guardan en ninguna tabla: se recalculan desde las filas, igual que el
// resto de la sección de Fuerza. Así una sesión corregida o borrada no deja
// marcas fantasma.
//
// Qué cuenta como marca depende de cómo se mide el ejercicio:
//   · peso            → más kg que nunca en ese ejercicio (solo reps con carga)
//   · reps con peso   → más repeticiones que nunca CON ESE MISMO peso
//   · volumen         → más Σ(reps×peso) en una sesión que nunca
//   · tiempo/distancia→ más segundos / metros que nunca
// La primera vez que se hace un ejercicio NO es marca: sin histórico previo no
// se ha batido nada.

import type { TrackingMode, WeightMode } from './exercises';

export type PRKind = 'weight' | 'reps_at_weight' | 'volume' | 'time' | 'distance';

export interface PRRow {
  exercise: string;
  exercise_label: string;
  session_date: string;
  reps: number;
  weight_kg: number | string;
  weight_mode?: string | null;
  tracking_mode?: string | null;
  /**
   * Máquina o polea concreta (migración 0047). Una marca en la polea de un
   * gimnasio no es una marca en la de otro: el número depende del aparato,
   * así que las marcas se llevan por separado.
   */
  machine_label?: string | null;
  /** Escalón de una serie descendente. >1 = bajada, no una serie de verdad. */
  drop_step?: number | null;
}

/** Vacío, null y undefined son la misma máquina: "sin especificar". */
const normMachine = (s?: string | null): string =>
  (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');


export interface PRHit {
  kind: PRKind;
  exercise: string;
  label: string;
  date: string;
  value: number;
  /** Mejor marca anterior que se ha batido. */
  prev: number;
  /** Solo en `reps_at_weight`: el peso al que se batieron las repeticiones. */
  atWeight?: number;
}

/** Clave "fecha|ejercicio" para localizar las marcas de una sesión concreta. */
export function prKey(date: string, exercise: string): string {
  return `${date}|${exercise}`;
}

interface Running {
  bestWeight: number;
  bestVolume: number;
  bestValue: number;              // tiempo o distancia
  repsAtWeight: Map<number, number>;
}

/**
 * Recorre el histórico en orden cronológico y devuelve las marcas batidas,
 * indexadas por `fecha|ejercicio`.
 */
export function computePRs(rows: PRRow[]): Map<string, PRHit[]> {
  const out = new Map<string, PRHit[]>();

  // Agrupar por ejercicio Y MÁQUINA y, dentro, por fecha.
  //
  // El mismo jalón marca 18 en una polea y 30 en otra sin que hayas ganado
  // fuerza. Mezclarlas inventaría una marca al cambiar de gimnasio, o la haría
  // inalcanzable para siempre. Cada máquina lleva su propio récord.
  //
  // La clave del grupo se construye con JSON.stringify para no depender de
  // ningún carácter separador: los nombres de máquina son texto libre del
  // usuario y cualquier separador elegido a mano podría aparecer en ellos. El
  // ejercicio se guarda aparte en el propio valor, así que nunca hay que
  // parsear la clave de vuelta.
  interface Bucket { exercise: string; byDate: Map<string, PRRow[]> }
  const buckets = new Map<string, Bucket>();
  rows.forEach((r) => {
    const k = JSON.stringify([r.exercise, normMachine(r.machine_label)]);
    let bucket = buckets.get(k);
    if (!bucket) { bucket = { exercise: r.exercise, byDate: new Map() }; buckets.set(k, bucket); }
    bucket.byDate.set(r.session_date, [...(bucket.byDate.get(r.session_date) || []), r]);
  });

  buckets.forEach(({ exercise, byDate }) => {
    const dates = [...byDate.keys()].sort();
    const run: Running = { bestWeight: 0, bestVolume: 0, bestValue: 0, repsAtWeight: new Map() };
    let seenAny = false;

    dates.forEach((date) => {
      const sets = byDate.get(date)!;
      const label = sets[0].exercise_label;
      const tm = (sets[0].tracking_mode as TrackingMode) || 'reps';
      const wm = (sets[0].weight_mode as WeightMode) || 'total';
      const hits: PRHit[] = [];

      if (tm === 'time' || tm === 'distance') {
        const best = Math.max(...sets.map((s) => s.reps));
        if (seenAny && best > run.bestValue) {
          hits.push({ kind: tm, exercise, label, date, value: best, prev: run.bestValue });
        }
        run.bestValue = Math.max(run.bestValue, best);
      } else {
        const maxWeight = Math.max(...sets.map((s) => Number(s.weight_kg) || 0));
        const volume = sets.reduce((a, s) => a + s.reps * (Number(s.weight_kg) || 0), 0);
        const loaded = wm !== 'bodyweight' && maxWeight > 0;

        if (seenAny && loaded && maxWeight > run.bestWeight) {
          hits.push({ kind: 'weight', exercise, label, date, value: maxWeight, prev: run.bestWeight });
        }
        // Más repeticiones al mismo peso: se mira serie a serie, quedándose con
        // la mejor mejora del día para no repetir la misma marca N veces.
        if (seenAny && loaded) {
          let bestGain: PRHit | null = null;
          sets.forEach((s) => {
            // Las bajadas de un dropset no cuentan aquí: 6 reps a 30 kg
            // llegando reventado tras 40 kg no es comparable con 6 reps a
            // 30 kg en fresco. Contarlas inventaría marcas.
            if (s.drop_step && s.drop_step > 1) return;
            const w = Number(s.weight_kg) || 0;
            if (w <= 0) return;
            const prev = run.repsAtWeight.get(w);
            if (prev !== undefined && s.reps > prev) {
              if (!bestGain || s.reps - prev > bestGain.value - bestGain.prev) {
                bestGain = { kind: 'reps_at_weight', exercise, label, date, value: s.reps, prev, atWeight: w };
              }
            }
          });
          // El PR de peso ya cuenta esa sesión; no se apilan dos marcas del
          // mismo tipo de mejora en la misma fila del historial.
          if (bestGain && !hits.some((h) => h.kind === 'weight')) hits.push(bestGain);
        }
        if (seenAny && loaded && volume > run.bestVolume && !hits.length) {
          hits.push({ kind: 'volume', exercise, label, date, value: +volume.toFixed(1), prev: +run.bestVolume.toFixed(1) });
        }

        run.bestWeight = Math.max(run.bestWeight, maxWeight);
        run.bestVolume = Math.max(run.bestVolume, volume);
        sets.forEach((s) => {
          if (s.drop_step && s.drop_step > 1) return;
          const w = Number(s.weight_kg) || 0;
          if (w <= 0) return;
          run.repsAtWeight.set(w, Math.max(run.repsAtWeight.get(w) ?? 0, s.reps));
        });
      }

      // Se ACUMULA, no se reemplaza: el mismo ejercicio en dos máquinas
      // distintas el mismo día son dos grupos que escriben en la misma clave.
      if (hits.length) {
        const k = prKey(date, exercise);
        out.set(k, [...(out.get(k) || []), ...hits]);
      }
      seenAny = true;
    });
  });

  return out;
}
