// Tick automático del plan del día (day_plan_items).
//
// Cuando el peleador registra algo REAL —una sesión de fuerza o una
// actividad— se marca solo lo que estaba planificado ese día y encaja. El
// criterio es tolerante a propósito (Tarea 3 del rediseño):
//
//   · Fuerza    → mismo día + al menos un grupo muscular en común.
//   · Actividad → mismo día + mismo tipo.
//
// No se exige que coincidan ejercicios, series, duración ni asaltos. Comidas,
// suplementos y observaciones NUNCA llevan tick, así que ni se miran.
//
// Es best-effort y silencioso: si la migración 0042 aún no está aplicada, el
// error se traga y no pasa nada (la sección ya muestra su estado "en camino").

import { supabase } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import type { StrengthPayload, ActivityPayload } from './dayPlan';

/**
 * Revisa el plan de `date` y marca `completed` los bloques de fuerza/actividad
 * que ya tienen un registro real que encaja. Devuelve cuántos marcó.
 */
export async function reconcileDayTicks(fighterProfileId: string, date: string): Promise<number> {
  try {
    const { data: items, error } = await supabase
      .from('day_plan_items')
      .select('id, kind, payload, completed')
      .eq('fighter_profile_id', fighterProfileId)
      .eq('plan_date', date)
      .eq('completed', false)
      .in('kind', ['strength', 'activity']);
    if (isMissingTable(error) || !items || items.length === 0) return 0;

    const needStrength = items.some((i) => i.kind === 'strength');
    const needActivity = items.some((i) => i.kind === 'activity');

    const [setsRes, actsRes] = await Promise.all([
      needStrength
        ? supabase.from('strength_sets').select('muscle_group, exercise_label')
            .eq('fighter_profile_id', fighterProfileId).eq('session_date', date)
        : Promise.resolve({ data: [] as { muscle_group: string | null; exercise_label: string }[] }),
      needActivity
        ? supabase.from('activity_sessions').select('kind')
            .eq('fighter_profile_id', fighterProfileId).eq('session_date', date)
        : Promise.resolve({ data: [] as { kind: string }[] }),
    ]);

    const loggedGroups = new Set(
      ((setsRes.data || []) as { muscle_group: string | null }[])
        .map((s) => s.muscle_group)
        .filter((g): g is string => !!g),
    );
    const loggedActivityKinds = new Set(
      ((actsRes.data || []) as { kind: string }[]).map((a) => a.kind),
    );

    const toComplete = items
      .filter((i) => {
        if (i.kind === 'strength') {
          const groups = ((i.payload as StrengthPayload)?.groups) || [];
          return groups.some((g) => loggedGroups.has(g));
        }
        // activity
        const k = (i.payload as ActivityPayload)?.kind;
        return !!k && loggedActivityKinds.has(k);
      })
      .map((i) => i.id);

    if (toComplete.length === 0) return 0;
    await supabase.from('day_plan_items').update({ completed: true }).in('id', toComplete);
    return toComplete.length;
  } catch {
    return 0;
  }
}
