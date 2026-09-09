// Sincroniza la AGENDA con lo que se ha registrado de verdad.
//
// Hace dos cosas, en este orden:
//
//   1. TICK: marca `completed` los bloques planificados de ese día que ya
//      tienen un registro real que encaja. Criterio tolerante a propósito:
//        · Fuerza    → mismo día + al menos un grupo muscular en común.
//        · Actividad → mismo día + mismo tipo.
//      No se exige que coincidan ejercicios, series, duración ni asaltos.
//
//   2. ALTA: si se ha entrenado algo que NO estaba planificado, se crea el
//      bloque en la agenda de ese día, ya marcado como hecho y con
//      `source: 'logged'`. Antes, entrenar un día libre no dejaba rastro: la
//      Agenda solo sabía de lo previsto, así que mirando atrás no se veía lo
//      que realmente se hizo. Ahora la Agenda es también el historial.
//
// Comidas, suplementos y observaciones NUNCA llevan tick ni se dan de alta
// desde aquí: son anotaciones, no registros.
//
// Es best-effort y silencioso: si la migración 0042 aún no está aplicada, el
// error se traga y no pasa nada (la sección ya muestra su estado "en camino").

import { supabase } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import type { StrengthPayload, ActivityPayload, MealPayload, MealSlot } from './dayPlan';

interface PlanRow {
  id: string;
  kind: string;
  payload: StrengthPayload | ActivityPayload | MealPayload;
  completed: boolean;
  /** manual | advisor | template | logged. Solo se limpian los 'logged'. */
  source?: string;
}

/** Firma de un bloque de fuerza: sus grupos musculares, ordenados. */
const strengthSig = (groups: string[]): string => [...new Set(groups)].sort().join('+');

/**
 * Revisa el día `date`: marca lo planificado que ya se hizo y da de alta lo
 * que se hizo sin estar planificado. Devuelve cuántos bloques tocó.
 */
export async function reconcileDayTicks(fighterProfileId: string, date: string): Promise<number> {
  try {
    // TODOS los bloques del día, no solo los pendientes: los ya completados
    // hacen falta para saber que ese entreno YA está en la agenda y no
    // duplicarlo en cada guardado.
    const { data: items, error } = await supabase
      .from('day_plan_items')
      .select('id, kind, payload, completed, source')
      .eq('fighter_profile_id', fighterProfileId)
      .eq('plan_date', date)
      .in('kind', ['strength', 'activity', 'meal']);
    if (isMissingTable(error)) return 0;
    const plan = (items || []) as PlanRow[];

    const [setsRes, actsRes, mealsRes] = await Promise.all([
      supabase.from('strength_sets')
        .select('muscle_group, exercise_label')
        .eq('fighter_profile_id', fighterProfileId).eq('session_date', date),
      supabase.from('activity_sessions')
        .select('kind, duration_min')
        .eq('fighter_profile_id', fighterProfileId).eq('session_date', date),
      supabase.from('meal_entries')
        .select('meal_type, description')
        .eq('fighter_profile_id', fighterProfileId).eq('entry_date', date),
    ]);

    const setRows = (setsRes.data || []) as { muscle_group: string | null; exercise_label: string }[];
    const actRows = (actsRes.data || []) as { kind: string; duration_min: number | null }[];
    const mealRows = (mealsRes.data || []) as { meal_type: string | null; description: string }[];

    const loggedGroups = [...new Set(setRows.map((s) => s.muscle_group).filter((g): g is string => !!g))];
    const loggedExercises = [...new Set(setRows.map((s) => s.exercise_label.trim()).filter(Boolean))];

    // ── 1. Tick de lo planificado que encaja ──
    const toComplete = plan
      .filter((i) => !i.completed)
      .filter((i) => {
        if (i.kind === 'strength') {
          const groups = (i.payload as StrengthPayload)?.groups || [];
          return groups.some((g) => loggedGroups.includes(g));
        }
        const k = (i.payload as ActivityPayload)?.kind;
        return !!k && actRows.some((a) => a.kind === k);
      })
      .map((i) => i.id);

    if (toComplete.length > 0) {
      await supabase.from('day_plan_items').update({ completed: true }).in('id', toComplete);
    }

    // ── 2. Alta de lo que se hizo sin estar planificado ──
    //
    // Se compara por FIRMA, no por igualdad exacta, para que volver a guardar
    // la misma sesión no cree un bloque nuevo cada vez.
    const planStrengthSigs = new Set(
      plan.filter((i) => i.kind === 'strength')
        .map((i) => strengthSig((i.payload as StrengthPayload)?.groups || [])),
    );
    const planActivityKinds = new Set(
      plan.filter((i) => i.kind === 'activity')
        .map((i) => (i.payload as ActivityPayload)?.kind)
        .filter(Boolean),
    );

    const inserts: { fighter_profile_id: string; plan_date: string; kind: string; payload: unknown; completed: boolean; source: string }[] = [];

    // Fuerza: un bloque con TODOS los grupos entrenados ese día. Se da de alta
    // solo si ningún bloque planificado comparte grupo (si comparte, ya se ha
    // marcado arriba y añadir otro sería duplicar el mismo entreno).
    if (loggedGroups.length > 0) {
      const sig = strengthSig(loggedGroups);
      const yaCubierto = planStrengthSigs.has(sig)
        || plan.some((i) => i.kind === 'strength'
          && ((i.payload as StrengthPayload)?.groups || []).some((g) => loggedGroups.includes(g)));
      if (!yaCubierto) {
        inserts.push({
          fighter_profile_id: fighterProfileId,
          plan_date: date,
          kind: 'strength',
          payload: { groups: loggedGroups, exercises: loggedExercises.join(', ') } as StrengthPayload,
          completed: true,
          source: 'logged',
        });
      }
    }

    // Actividad: un bloque por TIPO distinto registrado ese día.
    const actByKind = new Map<string, number>();
    actRows.forEach((a) => actByKind.set(a.kind, (actByKind.get(a.kind) || 0) + (a.duration_min || 0)));
    actByKind.forEach((mins, kind) => {
      if (planActivityKinds.has(kind)) return;
      inserts.push({
        fighter_profile_id: fighterProfileId,
        plan_date: date,
        kind: 'activity',
        payload: { kind, duration_min: mins || undefined } as ActivityPayload,
        completed: true,
        source: 'logged',
      });
    });

    // Comidas: un bloque por FRANJA (desayuno, comida, cena, snack) con lo que
    // se comió. Si ya había una comida planificada en esa franja no se toca:
    // el plan manda y añadir otra sería duplicar la misma franja.
    const planMealSlots = new Set(
      plan.filter((i) => i.kind === 'meal').map((i) => (i.payload as MealPayload)?.slot).filter(Boolean),
    );
    const mealBySlot = new Map<string, string[]>();
    mealRows.forEach((m) => {
      const slot = (m.meal_type || 'snack').trim();
      const txt = (m.description || '').trim();
      if (!txt) return;
      mealBySlot.set(slot, [...(mealBySlot.get(slot) || []), txt]);
    });
    mealBySlot.forEach((descs, slot) => {
      if (planMealSlots.has(slot as MealSlot)) return;
      inserts.push({
        fighter_profile_id: fighterProfileId,
        plan_date: date,
        kind: 'meal',
        payload: { slot: slot as MealSlot, text: descs.join(', ') } as MealPayload,
        // Las comidas no llevan tick en el modelo, pero se marcan igual: es la
        // señal de que vienen de un registro y no de una previsión.
        completed: true,
        source: 'logged',
      });
    });

    if (inserts.length > 0) {
      const ins = await supabase.from('day_plan_items').insert(inserts);
      // `source: 'logged'` es valor nuevo. Si la base tuviera un CHECK que no
      // lo admita, se reintenta con 'manual': mejor que perder el registro.
      if (ins.error) {
        await supabase.from('day_plan_items')
          .insert(inserts.map((i) => ({ ...i, source: 'manual' })));
      }
    }

    // ── 3. Limpieza de bloques automáticos huérfanos ──
    //
    // Si el usuario borra o corrige una sesión, el bloque que se creó solo
    // dejaría de corresponder a nada y la Agenda mostraría un entreno que ya
    // no existe. Solo se tocan los de `source: 'logged'`: lo que el usuario
    // planificó a mano no se borra nunca desde aquí.
    const stale = plan
      .filter((i) => i.source === 'logged')
      .filter((i) => {
        if (i.kind === 'strength') {
          const groups = (i.payload as StrengthPayload)?.groups || [];
          return !groups.some((g) => loggedGroups.includes(g));
        }
        if (i.kind === 'meal') {
          const slot = (i.payload as MealPayload)?.slot;
          return !slot || !mealBySlot.has(slot);
        }
        const k = (i.payload as ActivityPayload)?.kind;
        return !k || !actRows.some((a) => a.kind === k);
      })
      .map((i) => i.id);

    if (stale.length > 0) {
      await supabase.from('day_plan_items').delete().in('id', stale);
    }

    return toComplete.length + inserts.length + stale.length;
  } catch {
    return 0;
  }
}
