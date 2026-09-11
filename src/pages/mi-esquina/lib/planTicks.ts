// Sincroniza la AGENDA con lo que se ha registrado de verdad.
//
// Hace dos cosas, en este orden:
//
//   1. TICK: marca `completed` los bloques planificados de ese día que ya
//      tienen un registro real que encaja. Quién decide si "encaja" NO está
//      aquí: está en `lib/planMatch.ts`, el mismo módulo que usa
//      `todayTraining.ts` para esconder el aviso de "hoy toca". Tenerlo en dos
//      sitios era el fallo: la Agenda daba el entreno por hecho y el Resumen
//      seguía pidiéndolo, porque cada uno comparaba a su manera.
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
import { muscleGroupOf } from './exercises';
import { activityFamily, buildDayFacts, coversPlanItem, isWildcardKind } from './planMatch';
import type { StrengthPayload, ActivityPayload, MealPayload, MealSlot, DoneSummary } from './dayPlan';

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

    // Los hechos del día, en la forma que entiende `planMatch`. `muscle_group`
    // llega a null en filas anteriores a la 0029: se deduce del nombre.
    const facts = buildDayFacts(setRows, actRows, muscleGroupOf);

    const loggedGroups = [...facts.groups];
    const loggedExercises = [...new Set(setRows.map((s) => s.exercise_label.trim()).filter(Boolean))];

    // ── Resumen de lo que se hizo de verdad ──
    //
    // Planificar dice "pecho y espalda"; esto dice "Press banca ×4 · Remo ×3".
    // Va al bloque de la Agenda para que, de un vistazo al día, se vea qué se
    // hizo sin tener que entrar en Fuerza. El plan original no se toca: se
    // guarda al lado, en `payload.done`.
    const setsByExercise = new Map<string, number>();
    for (const s of setRows) {
      const n = (s.exercise_label || '').trim();
      if (n) setsByExercise.set(n, (setsByExercise.get(n) || 0) + 1);
    }
    const strengthDone: DoneSummary | null = setsByExercise.size > 0
      ? {
        // Cinco ejercicios como mucho: es un resumen, no el historial. El resto
        // se cuenta ("+3") en vez de alargar la linea hasta hacerla ilegible.
        text: [...setsByExercise.entries()].slice(0, 5).map(([n, c]) => `${n} ×${c}`).join(' · ')
          + (setsByExercise.size > 5 ? ` +${setsByExercise.size - 5}` : ''),
        total: setRows.length,
      }
      : null;

    /** Resumen de actividad para el tipo concreto que resuelve un bloque. */
    const activityDoneFor = (payload: ActivityPayload | null | undefined): DoneSummary | null => {
      const relevantes = actRows.filter((a) => isWildcardKind(payload?.kind)
        || activityFamily(a.kind) === activityFamily(payload?.kind)
        || isWildcardKind(a.kind));
      if (relevantes.length === 0) return null;
      const mins = relevantes.reduce((acc, a) => acc + (a.duration_min || 0), 0);
      const tipos = [...new Set(relevantes.map((a) => a.kind).filter(Boolean))];
      return { text: tipos.join(' · ') + (mins > 0 ? ` · ${mins} min` : ''), total: mins };
    };

    // ── 1. Tick de lo planificado que encaja ──
    //
    // La comparación es la de `planMatch`, la misma que decide si el aviso de
    // "hoy toca" desaparece. No hay una segunda opinión aquí.
    //
    // Se actualiza uno a uno, no en bloque, porque cada bloque lleva SU resumen.
    // Son uno o dos por día: no compensa complicarlo para ahorrar una consulta.
    const pendientes = plan
      .filter((i) => i.kind === 'strength' || i.kind === 'activity')
      .filter((i) => coversPlanItem(i.kind, i.payload as StrengthPayload | ActivityPayload, facts));

    let tocados = 0;
    for (const i of pendientes) {
      const payload = i.payload as StrengthPayload & ActivityPayload;
      const done = i.kind === 'strength' ? strengthDone : activityDoneFor(payload);

      // Solo se escribe si algo cambia: sin esto, cada guardado reescribiría
      // todos los bloques del día aunque no hubieran cambiado.
      const yaEstaba = i.completed && JSON.stringify(payload?.done ?? null) === JSON.stringify(done);
      if (yaEstaba) continue;

      const nuevo = { ...payload, ...(done ? { done } : {}) };
      const upd = await supabase.from('day_plan_items')
        .update({ completed: true, payload: nuevo }).eq('id', i.id);
      // Un tick perdido deja la Agenda enseñando como pendiente algo que ya se
      // hizo, y la Agenda lee `completed` a pelo: no tiene la red de seguridad
      // que sí tiene el aviso de "hoy toca". Un reintento cuesta nada y evita
      // el caso más molesto (un corte de red justo al guardar).
      if (upd.error) {
        await supabase.from('day_plan_items')
          .update({ completed: true, payload: nuevo }).eq('id', i.id);
      }
      tocados++;
    }

    // ── 2. Alta de lo que se hizo sin estar planificado ──
    //
    // Se compara por FIRMA, no por igualdad exacta, para que volver a guardar
    // la misma sesión no cree un bloque nuevo cada vez.
    const planStrengthSigs = new Set(
      plan.filter((i) => i.kind === 'strength')
        .map((i) => strengthSig((i.payload as StrengthPayload)?.groups || [])),
    );
    // Por FAMILIA, no por tipo exacto: si había "correr" planificado y se
    // registró "cinta", el bloque planificado ya se ha marcado arriba y dar de
    // alta otro sería enseñar el mismo entreno dos veces en la Agenda.
    const planActivityFamilies = new Set(
      plan.filter((i) => i.kind === 'activity')
        .map((i) => (i.payload as ActivityPayload)?.kind)
        .filter(Boolean)
        .map((k) => activityFamily(k)),
    );
    /** ¿Hay algún bloque de actividad planificado que no concreta el tipo? */
    const planHasWildcardActivity = plan.some((i) => i.kind === 'activity'
      && isWildcardKind((i.payload as ActivityPayload)?.kind));

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

    // Actividad: un bloque por TIPO distinto registrado ese día, salvo los que
    // ya resuelven un bloque planificado.
    const actByKind = new Map<string, number>();
    actRows.forEach((a) => actByKind.set(a.kind, (actByKind.get(a.kind) || 0) + (a.duration_min || 0)));

    // Un bloque planificado sin tipo concreto ("otro") se lo queda la PRIMERA
    // actividad que no encaje en ningún otro bloque: es la que lo ha resuelto
    // en el paso 1. Solo una — si ese día se hicieron bici y natación, la
    // segunda sigue siendo un entreno extra y merece su propia línea.
    let wildcardLibre = planHasWildcardActivity;
    actByKind.forEach((mins, kind) => {
      if (planActivityFamilies.has(activityFamily(kind))) return;
      if (wildcardLibre) { wildcardLibre = false; return; }
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
        if (i.kind === 'meal') {
          const slot = (i.payload as MealPayload)?.slot;
          return !slot || !mealBySlot.has(slot);
        }
        // Misma comparación que en el paso 1: un recibo sobrevive mientras
        // siga habiendo una sesión que lo respalde. Si aquí se comparara de
        // otra forma, un bloque recién creado podría borrarse a sí mismo en la
        // siguiente pasada.
        return !coversPlanItem(i.kind, i.payload as StrengthPayload | ActivityPayload, facts);
      })
      .map((i) => i.id);

    if (stale.length > 0) {
      await supabase.from('day_plan_items').delete().in('id', stale);
    }

    return tocados + inserts.length + stale.length;
  } catch {
    return 0;
  }
}
