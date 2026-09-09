// ════════════════════════════════════════════════════════════════
// RANKD · Asesor de comida — objetivos, generación y guardado
//
// Genera un plan de comidas de varios días a partir de tres cosas que el
// usuario dice (cuánto tiempo tiene para cocinar, cómo de complicado lo
// quiere y qué tiene en casa) y de lo que la app YA sabe de él: peso, altura,
// edad, sexo, días de entreno y peso objetivo.
//
// NO usa IA. El reparto de calorías y macros sale de una fórmula estándar
// (Mifflin-St Jeor) y la elección de platos, de un sorteo con semilla fija:
// con los mismos datos sale el mismo plan, y "otra propuesta" cambia la
// semilla. Cuando la IA vuelva a estar activa podrá sustituir `generatePlan`
// sin tocar ni el guardado ni la pantalla.
//
// Todo es orientativo, como el resto de Nutrición.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { ageFromBirth, type FighterPhysical } from '@/lib/physicalProfile';
import { RECIPES, RECIPE_BY_ID, type Complexity, type MealSlot, type Pantry, type Recipe } from './recipes';

// ── Lo que el usuario elige ────────────────────────────────────

export interface PlannerParams {
  /** Minutos como mucho por comida. */
  maxMinutes: number;
  /** 'facil' = solo platos de sartén y poco más. */
  complexity: Complexity;
  /** Lo que dice tener en casa. Vacío = no filtra por despensa. */
  pantry: Pantry[];
  /** Solo platos que se puedan hacer ENTEROS con lo marcado. */
  onlyPantry: boolean;
  /** Sin carne ni pescado. */
  vegetarian: boolean;
  /** Cuántos días genera (3, 5 o 7). */
  days: number;
  /** Semilla del sorteo. Cambia con "otra propuesta". */
  seed: number;
}

export function defaultParams(): PlannerParams {
  return {
    maxMinutes: 30, complexity: 'facil', pantry: [], onlyPantry: false,
    vegetarian: false, days: 5, seed: Math.floor(Math.random() * 1e9),
  };
}

// ── Objetivo diario de calorías y macros ───────────────────────

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
}

const DEFAULT_KCAL = 2400;

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
 * `weighInDate` vienen de nutrition_goals.
 */
export function dailyTarget(
  physical: FighterPhysical | null,
  currentWeight: number | null,
  targetWeight: number | null,
  weighInDate: string | null,
  todayIso: string,
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
  // una diferencia que es ruido de báscula.
  let direction: GoalDirection = 'mantener';
  if (weight !== null && targetWeight !== null) {
    if (targetWeight < weight - 0.5) direction = 'bajar';
    else if (targetWeight > weight + 0.5) direction = 'subir';
  }

  // Sin los cuatro datos no se puede aplicar la fórmula: se usa una
  // referencia genérica y se dice claramente que no está personalizada.
  const personalised = weight !== null && height !== null && age !== null && sex !== null;

  let maintenance: number;
  if (personalised) {
    // Mifflin-St Jeor. Para 'other' o sexo sin declarar, el punto medio entre
    // las dos constantes (+5 y −161).
    const base = 10 * weight! + 6.25 * height! - 5 * age!;
    const bmr = sex === 'male' ? base + 5 : sex === 'female' ? base - 161 : base - 78;
    maintenance = bmr * activityFactor(physical?.training_days_per_week ?? null);
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

  return { kcal, protein: proteinG, carbs: carbsG, fat: fatG, direction, personalised, missing, aggressive };
}

// ── El plan ────────────────────────────────────────────────────

export interface PlannedMeal {
  slot: MealSlot;
  recipeId: string;
  /** Raciones (0.5 – 2.5, en cuartos). Escala las macros del plato. */
  servings: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PlannedDay {
  /** 1..N dentro del plan (no una fecha: el plan es una pauta, no una agenda). */
  day: number;
  meals: PlannedMeal[];
  kcal: number;
  protein: number;
}

export interface MealPlan {
  target: DailyTarget;
  params: PlannerParams;
  days: PlannedDay[];
  /** ISO de cuándo se generó, para mostrar "creado el…". */
  createdAt: string;
}

// Reparto de las calorías del día. Los snacks salen del hueco que dejan las
// tres comidas principales.
const SPLIT: { slot: MealSlot; share: number }[] = [
  { slot: 'desayuno', share: 0.25 },
  { slot: 'comida', share: 0.35 },
  { slot: 'cena', share: 0.30 },
  { slot: 'snack', share: 0.10 },
];

/** Generador con semilla: mismos datos → mismo plan. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Cuánto de un plato cubre la despensa marcada (0 a 1). */
function pantryCoverage(r: Recipe, pantry: Set<Pantry>): number {
  if (pantry.size === 0 || r.pantry.length === 0) return 1;
  const have = r.pantry.filter((p) => pantry.has(p)).length;
  return have / r.pantry.length;
}

/**
 * Platos candidatos para una franja, ya ordenados por lo bien que encajan.
 *
 * Los filtros NUNCA dejan la lista vacía: si el tiempo o la despensa no dan
 * para nada, se relajan por orden (primero la despensa, luego la complejidad,
 * luego el tiempo) y se devuelve lo más cercano. Un asesor que responde "no
 * hay nada" no sirve de nada.
 */
function candidates(slot: MealSlot, p: PlannerParams): Recipe[] {
  const pantry = new Set(p.pantry);
  const base = RECIPES.filter((r) => r.slot === slot && (!p.vegetarian || r.veg));
  if (base.length === 0) return [];

  const byTime = (list: Recipe[]) => list.filter((r) => r.minutes <= p.maxMinutes);
  const byComplexity = (list: Recipe[]) => (p.complexity === 'facil'
    ? list.filter((r) => r.complexity === 'facil')
    : list);
  const byPantry = (list: Recipe[]) => (p.onlyPantry && pantry.size > 0
    ? list.filter((r) => pantryCoverage(r, pantry) === 1)
    : list);

  // Se va aflojando hasta que quede algo.
  const attempts: Recipe[][] = [
    byPantry(byComplexity(byTime(base))),
    byComplexity(byTime(base)),
    byTime(base),
    base,
  ];
  const pool = attempts.find((a) => a.length > 0) || base;

  // Dentro de lo que vale, primero lo que más aprovecha lo que hay en casa y,
  // a igualdad, lo más rápido.
  return [...pool].sort((a, b) => {
    const d = pantryCoverage(b, pantry) - pantryCoverage(a, pantry);
    if (Math.abs(d) > 0.01) return d;
    return a.minutes - b.minutes;
  });
}

function scaleMeal(r: Recipe, targetKcal: number): PlannedMeal {
  // Raciones en cuartos, entre media y dos y media: por debajo no es una
  // comida y por encima ya no es ese plato.
  const raw = targetKcal / r.kcal;
  const servings = Math.min(2.5, Math.max(0.5, Math.round(raw * 4) / 4));
  return {
    slot: r.slot, recipeId: r.id, servings,
    kcal: Math.round(r.kcal * servings),
    protein: Math.round(r.protein * servings),
    carbs: Math.round(r.carbs * servings),
    fat: Math.round(r.fat * servings),
  };
}

/**
 * Monta el plan.
 *
 * Por franja se prepara una baraja barajada con la semilla y se va repartiendo
 * en orden: así ningún día repite plato mientras queden cartas, y al agotarse
 * la baraja se vuelve a barajar en vez de dejar huecos.
 */
export function generatePlan(target: DailyTarget, params: PlannerParams): MealPlan {
  const rnd = mulberry32(params.seed);
  const decks = new Map<MealSlot, { pool: Recipe[]; used: Set<string> }>();
  for (const { slot } of SPLIT) {
    decks.set(slot, { pool: shuffle(candidates(slot, params), rnd), used: new Set() });
  }

  // Densidad de proteína que pide el objetivo, en gramos por kcal. Sirve para
  // elegir entre varias cartas la que mejor cuadra el día.
  const wantedDensity = target.kcal > 0 ? target.protein / target.kcal : 0;

  /**
   * Saca un plato para esa franja, sin repetir mientras queden sin usar.
   *
   * De los tres primeros que quedan disponibles se queda con el que más se
   * acerca a la densidad de proteína del objetivo. Repartir a ciegas cuadraba
   * bien las calorías pero dejaba días con 112 g de proteína y otros con 179,
   * y en un deportista la proteína es justo lo que no conviene que baile.
   */
  const draw = (slot: MealSlot): Recipe | null => {
    const deck = decks.get(slot);
    if (!deck || deck.pool.length === 0) return null;

    let available = deck.pool.filter((r) => !deck.used.has(r.id));
    // Agotada la baraja se vuelve a empezar en vez de dejar el hueco vacío.
    if (available.length === 0) { deck.used.clear(); available = deck.pool; }

    const hand = available.slice(0, 3);
    let best = hand[0];
    let bestGap = Infinity;
    for (const r of hand) {
      const gap = Math.abs(r.protein / Math.max(1, r.kcal) - wantedDensity);
      if (gap < bestGap) { bestGap = gap; best = r; }
    }
    deck.used.add(best.id);
    return best;
  };

  const days: PlannedDay[] = [];
  for (let d = 1; d <= params.days; d++) {
    const meals: PlannedMeal[] = [];
    for (const { slot, share } of SPLIT) {
      const r = draw(slot);
      if (!r) continue;
      meals.push(scaleMeal(r, target.kcal * share));
    }
    days.push({
      day: d, meals,
      kcal: meals.reduce((a, m) => a + m.kcal, 0),
      protein: meals.reduce((a, m) => a + m.protein, 0),
    });
  }

  return { target, params, days, createdAt: new Date().toISOString() };
}

/**
 * ¿Este plato incumple algo de lo que pidió el usuario?
 *
 * `candidates()` afloja los filtros antes que devolver una franja vacía, y eso
 * está bien —un asesor que dice "no hay nada" no sirve— pero colar un guiso de
 * 30 minutos a quien pidió 15 sin avisar es engañarle. Se calcula al pintar,
 * no se guarda: así los planes viejos también quedan marcados.
 */
export function mealWarnings(recipe: Recipe, params: PlannerParams): { overTime: boolean; offPantry: boolean } {
  const pantry = new Set(params.pantry);
  return {
    overTime: recipe.minutes > params.maxMinutes,
    offPantry: params.onlyPantry && pantry.size > 0 && pantryCoverage(recipe, pantry) < 1,
  };
}

/** Cuántos platos del plan incumplen algo. Para el aviso de cabecera. */
export function countRelaxed(plan: MealPlan): number {
  let n = 0;
  for (const day of plan.days) {
    for (const m of day.meals) {
      const r = RECIPE_BY_ID.get(m.recipeId);
      if (!r) continue;
      const w = mealWarnings(r, plan.params);
      if (w.overTime || w.offPantry) n++;
    }
  }
  return n;
}

/** Lista de la compra: cada etiqueta de despensa que aparece en el plan. */
export function shoppingTags(plan: MealPlan): Pantry[] {
  const seen = new Set<Pantry>();
  for (const day of plan.days) {
    for (const m of day.meals) {
      const r = RECIPE_BY_ID.get(m.recipeId);
      r?.pantry.forEach((p) => seen.add(p));
    }
  }
  return [...seen];
}

// ── Guardado ───────────────────────────────────────────────────
//
// Primero la base (`meal_plans`, migración 0050). Si la tabla todavía no
// existe, el plan se guarda en este navegador para que la pantalla siga
// siendo útil desde el primer día; `storedLocally` avisa de ello para poder
// decírselo al usuario en vez de aparentar que está en su cuenta.

const LOCAL_KEY = 'rankd_meal_plan';

export interface LoadedPlan { plan: MealPlan; storedLocally: boolean }

function localKey(profileId: string) { return `${LOCAL_KEY}:${profileId}`; }

function readLocal(profileId: string): MealPlan | null {
  try {
    const raw = localStorage.getItem(localKey(profileId));
    return raw ? (JSON.parse(raw) as MealPlan) : null;
  } catch { return null; }
}

function writeLocal(profileId: string, plan: MealPlan) {
  try { localStorage.setItem(localKey(profileId), JSON.stringify(plan)); } catch { /* sin espacio */ }
}

/** Guarda el plan como el activo. Devuelve si ha tenido que quedarse local. */
export async function savePlan(profileId: string, plan: MealPlan): Promise<{ ok: boolean; storedLocally: boolean }> {
  writeLocal(profileId, plan);

  // Solo hay un plan activo: el anterior se archiva, no se borra.
  const { error: archErr } = await supabase.from('meal_plans')
    .update({ status: 'archived' })
    .eq('fighter_profile_id', profileId).eq('status', 'active');
  if (isMissingTable(archErr)) return { ok: true, storedLocally: true };

  const { error } = await supabase.from('meal_plans').insert({
    fighter_profile_id: profileId,
    params_json: plan.params,
    plan_json: plan,
    days: plan.params.days,
    status: 'active',
  });
  if (isMissingTable(error)) return { ok: true, storedLocally: true };
  return { ok: !error, storedLocally: false };
}

/** Carga el plan activo: primero de la cuenta, si no, el de este navegador. */
export async function loadPlan(profileId: string): Promise<LoadedPlan | null> {
  const { data, error } = await supabase.from('meal_plans')
    .select('plan_json')
    .eq('fighter_profile_id', profileId).eq('status', 'active')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!error && data?.plan_json) return { plan: data.plan_json as MealPlan, storedLocally: false };

  const local = readLocal(profileId);
  return local ? { plan: local, storedLocally: true } : null;
}

/** Descarta el plan activo (archiva en la base y limpia el local). */
export async function clearPlan(profileId: string): Promise<void> {
  try { localStorage.removeItem(localKey(profileId)); } catch { /* nada */ }
  await supabase.from('meal_plans')
    .update({ status: 'archived' })
    .eq('fighter_profile_id', profileId).eq('status', 'active');
}
