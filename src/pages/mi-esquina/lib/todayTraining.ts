// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · "Entreno pendiente" — la condición, entera
//
// ── LA REGLA ──
//
//   Se enseña "entreno pendiente" si y solo si:
//     1. hay una entrada PLANIFICADA para hoy (source ≠ 'logged'), Y
//     2. sigue sin completar, Y
//     3. no hay una sesión real de hoy que la resuelva.
//
// El punto 3 es una red de seguridad, no la regla principal: el tick de la
// Agenda lo escribe `reconcileDayTicks`, que se lanza sin esperar y se traga
// los errores, así que puede no llegar a escribirse. Comparar con lo
// registrado solo puede OCULTAR la tarjeta, nunca hacerla aparecer.
//
// ── QUIÉN DECIDE SI "SE RESUELVE" ──
//
// No este archivo: `lib/planMatch.ts`. Es el MISMO módulo que usa
// `planTicks.ts` para marcar el bloque en la Agenda. Antes cada uno tenía su
// copia de la comparación, y cuando discrepaban salía justo el fallo que se
// reportó: la Agenda daba el entreno por hecho y el Resumen seguía pidiéndolo.
// Con un solo módulo eso ya no puede pasar.
//
// ── QUÉ NO HACE ──
// No calcula el grupo con menos volumen. No sugiere qué entrenar. No tiene
// datos de ejemplo. Solo pregunta a la Agenda y a las tablas de sesiones.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { isMissingColumn, isMissingTable } from '@/lib/dbState';
import { muscleGroupOf } from './exercises';
import { todayISO, type ActivityPayload, type StrengthPayload } from './dayPlan';
import { buildDayFacts, coversPlanItem, emptyDayFacts, type DayFacts } from './planMatch';

export type TrainingKind = 'strength' | 'activity';

/** Entrada PLANIFICADA y sin hacer. Es lo único que puede pintar la tarjeta. */
export interface PlannedEntry {
  /** id del bloque en `day_plan_items`: hace falta para marcarlo o abrirlo. */
  id: string;
  kind: TrainingKind;
  payload: StrengthPayload | ActivityPayload;
  /** De dónde salió el plan: manual | advisor | template. Solo informativo. */
  source: string;
}

export interface TodayTraining {
  /**
   * Entradas planificadas de hoy que siguen pendientes de verdad. Si está
   * vacío, la tarjeta NO se pinta. No hay ningún otro caso en que se pinte.
   *
   * Fuerza primero y actividad después, siempre en el mismo orden: quien pinta
   * una sola tarjeta no puede depender del orden que devuelva la base.
   */
  pending: PlannedEntry[];
  /** Solo lo pendiente de FUERZA. Separado a propósito (ver más abajo). */
  pendingStrength: PlannedEntry[];
  /** Solo lo pendiente de ACTIVIDAD. */
  pendingActivity: PlannedEntry[];
  /** ¿Se ha registrado hoy alguna sesión, del tipo que sea? */
  trainedToday: boolean;
  /** ¿Se ha registrado hoy alguna sesión de fuerza? */
  trainedStrength: boolean;
  /** ¿Se ha registrado hoy alguna actividad? */
  trainedActivity: boolean;
  /**
   * Grupos musculares y tipos de actividad entrenados HOY de verdad.
   *
   * Salen de las tablas de sesiones, no de la Agenda: es el dato más fiable
   * para decir "hoy ya entrenaste: pierna" sin depender de que exista un
   * bloque en el plan ni de que el tick se llegara a escribir.
   */
  trainedGroups: string[];
  trainedKinds: string[];
  /** true si `day_plan_items` todavía no existe (migración 0042 sin aplicar). */
  unavailable: boolean;
}

/** La app crea sola estos bloques al registrar algo sin planificar. */
const LOGGED_SOURCE = 'logged';

/**
 * ¿Es una entrada PLANIFICADA?
 *
 * No hay columna `planificado`. Lo que hay es `source`:
 *   · manual / advisor / template → lo puso alguien al planificar
 *   · logged → lo creó la app sola al registrar algo → es un recibo, no un plan
 * Por exclusión, para que un origen de planificación nuevo cuente sin tocar esto.
 */
function isPlanned(source: string | null): boolean {
  return (source || 'manual') !== LOGGED_SOURCE;
}

/**
 * Lee las sesiones reales del día y las deja en la forma que entiende
 * `planMatch`.
 *
 * `muscle_group` llega a null en filas viejas (es de la migración 0029): en ese
 * caso el grupo se deduce del nombre del ejercicio con la biblioteca, igual que
 * hace el resto de la app.
 */
async function loadDayFacts(profileId: string, date: string, kinds: TrainingKind[]): Promise<DayFacts> {
  const wantStrength = kinds.includes('strength');
  const wantActivity = kinds.includes('activity');
  if (!wantStrength && !wantActivity) return emptyDayFacts();

  const [setsRes, actsRes] = await Promise.all([
    wantStrength
      ? supabase.from('strength_sets').select('muscle_group, exercise_label')
        .eq('fighter_profile_id', profileId).eq('session_date', date)
      : Promise.resolve({ data: null, error: null }),
    wantActivity
      ? supabase.from('activity_sessions').select('kind')
        .eq('fighter_profile_id', profileId).eq('session_date', date)
      : Promise.resolve({ data: null, error: null }),
  ]);

  // Sin la 0029 no existe `muscle_group`: se pide solo el nombre y se deduce.
  let setRows = (setsRes.data || []) as { muscle_group?: string | null; exercise_label?: string }[];
  if (wantStrength && isMissingColumn(setsRes.error)) {
    const retry = await supabase.from('strength_sets').select('exercise_label')
      .eq('fighter_profile_id', profileId).eq('session_date', date);
    setRows = (retry.data || []) as { exercise_label?: string }[];
  }

  return buildDayFacts(setRows, (actsRes.data || []) as { kind: string }[], muscleGroupOf);
}

/**
 * Entradas planificadas de hoy que siguen pendientes.
 *
 * `kinds` acota la pregunta: la tarjeta de Fuerza pide solo `['strength']`, la
 * de Actividad solo `['activity']`, y la del Resumen las dos.
 *
 * ── POR QUÉ VUELVEN SEPARADAS ──
 * Fuerza y Actividad son dos avisos distintos y no se sustituyen. Al devolver
 * una lista única, quien pintaba una sola tarjeta cogía el primer elemento y,
 * al resolverse la actividad, ascendía el bloque de fuerza a ese hueco: parecía
 * que "al terminar la actividad aparecía Pierna de la nada". No aparecía nada,
 * es que solo cabía uno. Ahora cada tipo tiene su lista y su tarjeta.
 */
export async function loadTodayTraining(
  profileId: string,
  kinds: TrainingKind[] = ['strength', 'activity'],
  date: string = todayISO(),
): Promise<TodayTraining> {
  const [planRes, facts] = await Promise.all([
    supabase.from('day_plan_items')
      .select('id, kind, payload, completed, source')
      .eq('fighter_profile_id', profileId)
      .eq('plan_date', date)
      .in('kind', kinds)
      // El filtro va también en el SQL: así la intención se ve en los logs de
      // red sin tener que leer este archivo.
      .eq('completed', false),
    loadDayFacts(profileId, date, kinds),
  ]);

  const base = {
    trainedToday: facts.anyStrength || facts.anyActivity,
    trainedStrength: facts.anyStrength,
    trainedActivity: facts.anyActivity,
    trainedGroups: [...facts.groups],
    trainedKinds: [...facts.kinds],
  };

  if (planRes.error) {
    // Sin Agenda no hay nada planificado que enseñar. Jamás se inventa un
    // "pendiente" a partir de lo registrado.
    return {
      ...base,
      pending: [], pendingStrength: [], pendingActivity: [],
      unavailable: isMissingTable(planRes.error),
    };
  }

  const rows = (planRes.data || []) as {
    id: string; kind: string; payload: StrengthPayload | ActivityPayload;
    completed: boolean; source: string | null;
  }[];

  const pending = rows
    .filter((r) => isPlanned(r.source))
    .map((r): PlannedEntry => ({
      id: r.id,
      kind: r.kind === 'activity' ? 'activity' : 'strength',
      payload: r.payload,
      source: r.source || 'manual',
    }))
    // Red de seguridad por si el tick no se llegó a escribir. Solo oculta.
    .filter((e) => !coversPlanItem(e.kind, e.payload, facts));

  const pendingStrength = pending.filter((e) => e.kind === 'strength');
  const pendingActivity = pending.filter((e) => e.kind === 'activity');

  return {
    ...base,
    // Orden estable: la base no garantiza ninguno y el Resumen no puede
    // cambiar de titular entre dos cargas idénticas.
    pending: [...pendingStrength, ...pendingActivity],
    pendingStrength,
    pendingActivity,
    unavailable: false,
  };
}
