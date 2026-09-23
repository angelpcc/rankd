// ════════════════════════════════════════════════════════════════
// RANKD · Objetivo diario de calorías y macros
//
// ── UNA SOLA CIFRA PARA TODA LA APP ──
//
// El cálculo existía (Mifflin-St Jeor, en el Asesor de comida) pero solo lo
// veía la pestaña Plan de comidas. El resumen de Nutrición decía "aún no hay
// objetivo de calorías" y mandaba a configurarlo en el Asesor, donde no había
// nada que configurar; los anillos de macros llenaban contra una referencia
// fija de 150 g de proteína para todo el mundo; y la IA no sabía ni cuántas
// calorías le tocaban al usuario cuando le montaba las comidas.
//
// Ahora vive aquí y lo leen todos: Resumen, Nutrición, Plan de comidas y las
// IAs. Si cambia en un sitio, cambia en todos.
//
// ── LOS DÍAS DE ENTRENO, DE LO QUE HACE ──
//
// El factor de actividad salía de "días entrenables por semana" del perfil
// físico, y esa pregunta se quitó del formulario para dejarlo en lo esencial.
// Sin ella el cálculo asumía siempre la media. Ahora se mira lo que hay de
// verdad: lo que ha entrenado estas dos semanas y lo que tiene planificado
// para las dos siguientes, y se queda con lo mayor. Solo si no hay nada de
// eso se usa el dato del perfil, si lo hubiera.
//
// ── A MANO, SI SE LO HA DADO UN PROFESIONAL ──
//
// Quien tiene nutricionista ya tiene su cifra y no quiere otra. Se puede fijar
// a mano; las macros se recalculan con ella. Va a `nutrition_goals`
// (migración 0059) y, si esa columna aún no existe, se guarda en este
// dispositivo para que funcione igual mientras tanto.
//
// Todo es orientativo, como el resto de Nutrición.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { isMissingColumn } from '@/lib/dbState';
import { ageFromBirth, loadPhysical, type FighterPhysical } from '@/lib/physicalProfile';
import { isoOf } from './dayPlan';

export type GoalDirection = 'bajar' | 'mantener' | 'subir';

export interface DailyTarget {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  direction: GoalDirection;
  /** false = faltan datos y se ha usado una referencia genérica. */
  personalised: boolean;
  /** Campos del perfil físico que faltan para afinar. */
  missing: string[];
  /** Aviso cuando el ritmo de bajada hasta el pesaje es demasiado agresivo. */
  aggressive?: boolean;
  /** Gasto estimado para mantenerse, antes de déficit o superávit. */
  maintenance: number;
  /** Días de entreno por semana con los que se ha calculado. */
  trainingDays: number | null;
  /** De dónde salen esos días: lo entrenado/planificado, o el perfil. */
  trainingDaysFrom: 'registro' | 'perfil' | null;
  /** true = las calorías las ha fijado el usuario. */
  manual: boolean;
  /** Con cifra a mano, lo que habría dado el cálculo (para enseñarlo al lado). */
  calculatedKcal?: number;
}

const DEFAULT_KCAL = 2400;

/** Límites de una cifra fijada a mano. Fuera de aquí es un error al teclear. */
export const KCAL_MIN = 1000;
export const KCAL_MAX = 6000;

/** Factor de actividad por días de entreno. Deportes de combate: alto. */
function activityFactor(days: number | null): number {
  if (days === null) return 1.55;
  if (days <= 1) return 1.35;
  if (days <= 3) return 1.5;
  if (days <= 5) return 1.65;
  return 1.8;
}

/**
 * Calcula el objetivo diario.
 *
 * `currentWeight` es el último peso registrado (más fiable que el del perfil
 * físico, que se rellena una vez y se queda viejo). `targetWeight` y
 * `weighInDate` vienen de nutrition_goals. `fallbackDirection` es lo que el
 * usuario ha contestado cuando no hay peso objetivo. `realDays`, los días por
 * semana que entrena de verdad (ver cabecera).
 */
export function dailyTarget(
  physical: FighterPhysical | null,
  currentWeight: number | null,
  targetWeight: number | null,
  weighInDate: string | null,
  todayIso: string,
  fallbackDirection?: GoalDirection,
  realDays?: number | null,
): DailyTarget {
  const weight = currentWeight ?? physical?.weight_kg ?? null;
  const height = physical?.height_cm ?? null;
  const age = ageFromBirth(physical?.birth_date);
  const sex = physical?.sex ?? null;

  const missing: string[] = [];
  if (weight === null) missing.push('weight_kg');
  if (height === null) missing.push('height_cm');
  if (age === null) missing.push('birth_date');
  if (sex === null) missing.push('sex');

  // ¿Bajar, mantener o subir? Medio kilo de margen para no llamar "déficit" a
  // una diferencia que es ruido de báscula. Sin peso objetivo manda lo que haya
  // contestado el usuario; si tampoco hay respuesta, mantenerse.
  let direction: GoalDirection = fallbackDirection ?? 'mantener';
  if (weight !== null && targetWeight !== null) {
    direction = 'mantener';
    if (targetWeight < weight - 0.5) direction = 'bajar';
    else if (targetWeight > weight + 0.5) direction = 'subir';
  }

  const trainingDays = realDays != null && realDays > 0
    ? realDays
    : physical?.training_days_per_week ?? null;
  const trainingDaysFrom: DailyTarget['trainingDaysFrom'] = realDays != null && realDays > 0
    ? 'registro'
    : physical?.training_days_per_week != null ? 'perfil' : null;

  // Sin los cuatro datos no se puede aplicar la fórmula: se usa una
  // referencia genérica y se dice claramente que no está personalizada.
  const personalised = weight !== null && height !== null && age !== null && sex !== null;

  let maintenance: number;
  if (personalised) {
    // Mifflin-St Jeor. Para 'other' o sexo sin declarar, el punto medio entre
    // las dos constantes (+5 y −161).
    const base = 10 * weight! + 6.25 * height! - 5 * age!;
    const bmr = sex === 'male' ? base + 5 : sex === 'female' ? base - 161 : base - 78;
    maintenance = bmr * activityFactor(trainingDays);
  } else {
    maintenance = DEFAULT_KCAL;
  }

  let kcal = maintenance;
  let aggressive = false;
  if (direction === 'bajar') {
    // Déficit del 15 % por defecto. Si hay fecha de pesaje se comprueba que el
    // ritmo sea razonable (hasta 1 % del peso por semana); si hace falta más,
    // NO se aprieta más el plan: se avisa.
    kcal = maintenance * 0.85;
    if (weighInDate && weight !== null && targetWeight !== null) {
      const days = Math.max(1, Math.round(
        (new Date(weighInDate + 'T12:00:00').getTime() - new Date(todayIso + 'T12:00:00').getTime())
        / 86400000,
      ));
      const weeks = days / 7;
      const perWeek = (weight - targetWeight) / weeks;
      if (perWeek > weight * 0.01) aggressive = true;
    }
  } else if (direction === 'subir') {
    kcal = maintenance * 1.1;
  }
  kcal = Math.round(kcal / 10) * 10;

  // Proteína por kilo de peso corporal; grasa al 25 % de las calorías; el
  // resto, hidratos.
  const proteinG = Math.round((weight ?? 75) * 2);
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));

  return {
    kcal, protein: proteinG, carbs: carbsG, fat: fatG, direction, personalised, missing, aggressive,
    maintenance: Math.round(maintenance / 10) * 10, trainingDays, trainingDaysFrom, manual: false,
  };
}

/**
 * El mismo objetivo, con las calorías que ha fijado el usuario.
 *
 * La proteína no cambia —va por kilo de peso, no por calorías—; la grasa sigue
 * al 25 % y los hidratos son lo que queda.
 */
export function conKcalManual(t: DailyTarget, kcal: number): DailyTarget {
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - t.protein * 4 - fatG * 9) / 4));
  return { ...t, kcal, fat: fatG, carbs: carbsG, manual: true, calculatedKcal: t.kcal };
}

// ── Lo que hace falta leer ─────────────────────────────────────

export interface DatosObjetivo {
  physical: FighterPhysical | null;
  currentWeight: number | null;
  targetWeight: number | null;
  weighIn: string | null;
  /** Días por semana con entreno, de lo registrado y lo planificado. */
  realDays: number | null;
  /** Calorías fijadas a mano, si las hay. */
  manualKcal: number | null;
}

const CLAVE_LOCAL = 'rankd_kcal_manual';

function leerLocal(profileId: string): number | null {
  try {
    const v = Number(localStorage.getItem(`${CLAVE_LOCAL}:${profileId}`));
    return Number.isFinite(v) && v >= KCAL_MIN && v <= KCAL_MAX ? v : null;
  } catch {
    return null;
  }
}

function escribirLocal(profileId: string, kcal: number | null): void {
  try {
    if (kcal == null) localStorage.removeItem(`${CLAVE_LOCAL}:${profileId}`);
    else localStorage.setItem(`${CLAVE_LOCAL}:${profileId}`, String(kcal));
  } catch { /* sin almacenamiento, se queda con el cálculo */ }
}

/**
 * Días por semana con entreno.
 *
 * Mira dos semanas hacia atrás (lo registrado y lo marcado como hecho) y dos
 * hacia delante (lo planificado que no es opcional), y se queda con la más
 * alta. Quien sigue un plan y aún no ha registrado nada sale con los días de su
 * plan; quien entrena por libre sin planificar, con los de su registro.
 */
async function diasDeEntreno(profileId: string): Promise<number | null> {
  const hoy = new Date();
  const atras = new Date(hoy); atras.setDate(hoy.getDate() - 14);
  const delante = new Date(hoy); delante.setDate(hoy.getDate() + 13);
  const hoyISO = isoOf(hoy), atrasISO = isoOf(atras), delanteISO = isoOf(delante);

  try {
    const [sets, acts, plan] = await Promise.all([
      supabase.from('strength_sets').select('session_date')
        .eq('fighter_profile_id', profileId).gte('session_date', atrasISO).lte('session_date', hoyISO),
      supabase.from('activity_sessions').select('session_date')
        .eq('fighter_profile_id', profileId).gte('session_date', atrasISO).lte('session_date', hoyISO),
      supabase.from('day_plan_items').select('plan_date, payload, completed')
        .eq('fighter_profile_id', profileId).in('kind', ['strength', 'activity'])
        .gte('plan_date', atrasISO).lte('plan_date', delanteISO),
    ]);

    const pasado = new Set<string>();
    for (const r of (sets.data || []) as { session_date: string }[]) pasado.add(r.session_date);
    for (const r of (acts.data || []) as { session_date: string }[]) pasado.add(r.session_date);

    const futuro = new Set<string>();
    for (const r of (plan.data || []) as { plan_date: string; payload: { optional?: boolean } | null; completed: boolean }[]) {
      if (r.plan_date < hoyISO) {
        if (r.completed) pasado.add(r.plan_date);
      } else if (!r.payload?.optional) {
        futuro.add(r.plan_date);
      }
    }

    const porSemana = Math.round(Math.max(pasado.size, futuro.size) / 2);
    return porSemana > 0 ? Math.min(7, porSemana) : null;
  } catch {
    return null;
  }
}

export async function cargarDatosObjetivo(profileId: string): Promise<DatosObjetivo> {
  const [phys, weightRow, goals, manualRow, realDays] = await Promise.all([
    loadPhysical(profileId),
    supabase.from('weight_entries').select('weight_kg')
      .eq('fighter_profile_id', profileId)
      .order('entry_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('nutrition_goals').select('target_weight_kg, weigh_in_date')
      .eq('fighter_profile_id', profileId).maybeSingle(),
    // Aparte, para que si la 0059 no está aplicada no se pierda también el
    // peso objetivo por un error de columna.
    supabase.from('nutrition_goals').select('daily_kcal_target')
      .eq('fighter_profile_id', profileId).maybeSingle(),
    diasDeEntreno(profileId),
  ]);

  // weigh_in_date llega de la 0010; si no está aplicada, se reintenta sin ella.
  let goalRow = goals.data as { target_weight_kg?: number | null; weigh_in_date?: string | null } | null;
  if (goals.error && isMissingColumn(goals.error)) {
    const r = await supabase.from('nutrition_goals').select('target_weight_kg')
      .eq('fighter_profile_id', profileId).maybeSingle();
    goalRow = r.data as { target_weight_kg?: number | null } | null;
  }

  const enBase = (manualRow.data as { daily_kcal_target?: number | null } | null)?.daily_kcal_target ?? null;
  const manualKcal = manualRow.error ? leerLocal(profileId) : (enBase ?? leerLocal(profileId));

  const cw = (weightRow.data as { weight_kg?: number } | null)?.weight_kg;
  return {
    physical: phys.unavailable ? null : phys.data,
    currentWeight: cw != null ? Number(cw) : null,
    targetWeight: goalRow?.target_weight_kg != null ? Number(goalRow.target_weight_kg) : null,
    weighIn: goalRow?.weigh_in_date ?? null,
    realDays,
    manualKcal,
  };
}

/** El objetivo a partir de lo leído, con la cifra a mano si la hay. */
export function objetivoDe(d: DatosObjetivo, fallbackDirection?: GoalDirection): DailyTarget {
  const base = dailyTarget(d.physical, d.currentWeight, d.targetWeight, d.weighIn, isoOf(new Date()), fallbackDirection, d.realDays);
  return d.manualKcal != null ? conKcalManual(base, d.manualKcal) : base;
}

export async function cargarObjetivoDiario(profileId: string): Promise<DailyTarget> {
  return objetivoDe(await cargarDatosObjetivo(profileId));
}

/**
 * Fija (o quita, con null) las calorías a mano.
 *
 * `soloEsteDispositivo` = la 0059 no está aplicada y se ha guardado aquí.
 */
export async function guardarKcalManual(profileId: string, kcal: number | null): Promise<{ ok: boolean; soloEsteDispositivo: boolean }> {
  if (kcal != null && (!Number.isFinite(kcal) || kcal < KCAL_MIN || kcal > KCAL_MAX)) {
    return { ok: false, soloEsteDispositivo: false };
  }
  const valor = kcal == null ? null : Math.round(kcal / 10) * 10;
  const { error } = await supabase.from('nutrition_goals').upsert(
    { fighter_profile_id: profileId, daily_kcal_target: valor, updated_at: new Date().toISOString() },
    { onConflict: 'fighter_profile_id' },
  );
  if (error && isMissingColumn(error)) {
    escribirLocal(profileId, valor);
    return { ok: true, soloEsteDispositivo: true };
  }
  if (error) return { ok: false, soloEsteDispositivo: false };
  // En la base ya manda la base: lo de este dispositivo sobra.
  escribirLocal(profileId, null);
  return { ok: true, soloEsteDispositivo: false };
}

/**
 * Lo que se le cuenta a la IA. Corto: son cuatro números y de dónde salen.
 * Con esto, las comidas que propone cuadran con lo que la app enseña.
 */
export function objetivoParaIA(t: DailyTarget): Record<string, unknown> {
  return {
    dailyKcal: t.kcal,
    proteinG: t.protein,
    carbsG: t.carbs,
    fatG: t.fat,
    dailyKcalManual: t.manual || undefined,
    dailyKcalGeneric: !t.personalised && !t.manual ? true : undefined,
  };
}

/**
 * El cuerpo y el objetivo, para el perfil que se manda a las IAs.
 *
 * El chat del plan recibía el peso y el peso objetivo y nada más: ni altura, ni
 * sexo, ni edad del perfil físico, ni cuántas calorías le tocan. Así no podía
 * cuadrar unas comidas con nada. Solo va lo que hay; lo vacío no se manda.
 */
export function contextoCuerpoParaIA(d: DatosObjetivo): Record<string, unknown> {
  const p = d.physical;
  const age = ageFromBirth(p?.birth_date);
  return {
    ...(p?.height_cm ? { heightCm: p.height_cm } : {}),
    ...(p?.sex === 'male' ? { sex: 'hombre' } : p?.sex === 'female' ? { sex: 'mujer' } : {}),
    ...(age != null ? { age } : {}),
    ...objetivoParaIA(objetivoDe(d)),
  };
}
