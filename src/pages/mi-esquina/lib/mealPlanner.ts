// ════════════════════════════════════════════════════════════════
// RANKD · Asesor de comida — objetivos, generación y guardado
//
// Genera un plan de comidas de varios días cruzando TRES fuentes:
//
//   1. Lo que el usuario responde aquí (tiempo para cocinar, complejidad, qué
//      tiene en casa, cuántas comidas hace al día, restricciones).
//   2. Lo que la app YA sabe de él: peso, altura, edad, sexo, días de entreno y
//      peso objetivo.
//   3. Lo que tiene en la AGENDA: qué días entrena de fuerza o de actividad, y
//      a qué hora. Si entrena de mañana, el desayuno se refuerza; si corre por
//      la tarde, la comida previa se ajusta a esa franja. (Punto 20.)
//
// Y no ASUME lo que no sabe: `missingAnswers` devuelve las preguntas que faltan
// por responder, y la pantalla no deja generar hasta tenerlas. Un plan montado
// sobre suposiciones es peor que no tener plan.
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
import { isoOf, type ActivityPayload, type StrengthPayload } from './dayPlan';

// ── Lo que el usuario elige ────────────────────────────────────

/** Franja del día en la que entrena. 'varies' = no hay una fija. */
export type TrainingWhen = 'morning' | 'midday' | 'afternoon' | 'evening';
export type TrainingWhenAnswer = TrainingWhen | 'varies';

export interface PlannerParams {
  /** Minutos como mucho por comida. */
  maxMinutes: number;
  /** 'facil' = solo platos de sartén y poco más. */
  complexity: Complexity;
  /** Etiquetas de despensa disponibles (marcadas + deducidas de sus productos). */
  pantry: Pantry[];
  /** Solo platos que se puedan hacer ENTEROS con lo marcado. */
  onlyPantry: boolean;
  /** Sin carne ni pescado. */
  vegetarian: boolean;
  /** Cuántos días genera (3, 5 o 7). */
  days: number;
  /** Semilla del sorteo. Cambia con "otra propuesta". */
  seed: number;

  // ── Respuestas obligatorias (punto 20) ──
  // `undefined` = todavía sin responder. No tienen valor por defecto a
  // propósito: si no se sabe, se pregunta.

  /** Comidas al día: 3, 4 o 5. */
  mealsPerDay?: 3 | 4 | 5;
  /**
   * Alergias, intolerancias o cosas que no come. Cadena vacía = "ninguna",
   * que es una respuesta válida; `undefined` = sin responder.
   */
  restrictions?: string;
  /** Franja habitual de entreno. */
  trainingWhen?: TrainingWhenAnswer;
  /**
   * Hacia dónde va la dieta cuando la app NO tiene peso objetivo registrado.
   * Con objetivo registrado se deduce solo y esta pregunta no aparece.
   */
  goalDirection?: GoalDirection;

  /** Productos propios sueltos (los que no encajan en ninguna etiqueta). */
  customFoods?: string[];
  /** Primer día del plan, en ISO. Permite cuadrarlo con la agenda. */
  startDate?: string;
}

export function defaultParams(): PlannerParams {
  return {
    maxMinutes: 30, complexity: 'facil', pantry: [], onlyPantry: false,
    vegetarian: false, days: 5, seed: Math.floor(Math.random() * 1e9),
  };
}

// ── Lo que falta por preguntar ─────────────────────────────────

export type QuestionId = 'meals' | 'restrictions' | 'training_when' | 'goal';

/**
 * Preguntas sin responder que impiden generar un plan honesto.
 *
 * `hasGoal` es true cuando la app ya tiene un peso objetivo registrado: en ese
 * caso la dirección de la dieta se deduce y no hay nada que preguntar. Si no
 * lo tiene, se pregunta — y "no lo sé" es una respuesta válida que orienta el
 * plan a mantenerse, que es la opción saludable por defecto.
 */
export function missingAnswers(p: PlannerParams, hasGoal: boolean): QuestionId[] {
  const out: QuestionId[] = [];
  if (!p.mealsPerDay) out.push('meals');
  if (p.restrictions === undefined) out.push('restrictions');
  if (!p.trainingWhen) out.push('training_when');
  if (!hasGoal && !p.goalDirection) out.push('goal');
  return out;
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
 * `weighInDate` vienen de nutrition_goals. `fallbackDirection` es lo que el
 * usuario ha contestado cuando no hay peso objetivo.
 */
export function dailyTarget(
  physical: FighterPhysical | null,
  currentWeight: number | null,
  targetWeight: number | null,
  weighInDate: string | null,
  todayIso: string,
  fallbackDirection?: GoalDirection,
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

// ── Lo que hay en la Agenda ────────────────────────────────────

export interface DayTraining {
  /** Hay fuerza planificada o registrada ese día. */
  strength: boolean;
  /** Tipos de actividad (correr, bici…) de ese día. */
  activities: string[];
}

export type TrainingMap = Map<string, DayTraining>;

/**
 * Qué entrena el usuario cada día del plan, según la app.
 *
 * Mira lo PLANIFICADO (`day_plan_items`) y lo ya REGISTRADO (`strength_sets` y
 * `activity_sessions`), que es lo que pide el encargo. Es best-effort: si
 * alguna tabla no está, el plan se genera igual — solo pierde el ajuste por
 * entreno, y la pantalla lo dice.
 */
export async function loadTrainingContext(profileId: string, startDate: string, days: number): Promise<TrainingMap> {
  const map: TrainingMap = new Map();
  const start = startDate;
  const endDate = new Date(`${startDate}T12:00:00`);
  endDate.setDate(endDate.getDate() + Math.max(0, days - 1));
  const end = isoOf(endDate);

  const touch = (date: string): DayTraining => {
    const cur = map.get(date) || { strength: false, activities: [] };
    map.set(date, cur);
    return cur;
  };

  try {
    const [planned, sets, acts] = await Promise.all([
      supabase.from('day_plan_items')
        .select('plan_date, kind, payload')
        .eq('fighter_profile_id', profileId)
        .in('kind', ['strength', 'activity'])
        .gte('plan_date', start).lte('plan_date', end),
      supabase.from('strength_sets')
        .select('session_date')
        .eq('fighter_profile_id', profileId)
        .gte('session_date', start).lte('session_date', end),
      supabase.from('activity_sessions')
        .select('session_date, kind')
        .eq('fighter_profile_id', profileId)
        .gte('session_date', start).lte('session_date', end),
    ]);

    if (!isMissingTable(planned.error)) {
      for (const row of (planned.data || []) as { plan_date: string; kind: string; payload: StrengthPayload | ActivityPayload }[]) {
        const d = touch(row.plan_date);
        if (row.kind === 'strength') d.strength = true;
        else {
          const k = (row.payload as ActivityPayload)?.kind;
          if (k && !d.activities.includes(k)) d.activities.push(k);
        }
      }
    }
    if (!isMissingTable(sets.error)) {
      for (const row of (sets.data || []) as { session_date: string }[]) {
        touch(row.session_date).strength = true;
      }
    }
    if (!isMissingTable(acts.error)) {
      for (const row of (acts.data || []) as { session_date: string; kind: string }[]) {
        const d = touch(row.session_date);
        if (row.kind && !d.activities.includes(row.kind)) d.activities.push(row.kind);
      }
    }
  } catch { /* sin contexto de agenda el plan sigue siendo válido */ }

  return map;
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
  /** Hora orientativa ("08:00"). */
  time: string;
  /** Relación con el entreno de ese día. */
  training?: 'pre' | 'post';
}

export interface PlannedDay {
  /** 1..N dentro del plan. */
  day: number;
  /** Fecha real, para cuadrar con la agenda y poder marcar lo hecho. */
  date: string;
  meals: PlannedMeal[];
  kcal: number;
  protein: number;
  /** Qué entrena ese día y en qué franja. */
  strength: boolean;
  activities: string[];
  when: TrainingWhen | null;
}

export interface MealPlan {
  target: DailyTarget;
  params: PlannerParams;
  days: PlannedDay[];
  /** ISO de cuándo se generó, para mostrar "creado el…". */
  createdAt: string;
  /** Comidas ya hechas. Claves "día-índice" ("3-1"). */
  done: string[];
  /** Productos propios que no encajan en ninguna etiqueta, para enseñarlos. */
  extras: string[];
}

/** Clave de una comida dentro del plan. */
export function mealKey(day: number, index: number): string {
  return `${day}-${index}`;
}

// ── Reparto del día ────────────────────────────────────────────
//
// El número de comidas lo decide el usuario, no la app. Cada disposición trae
// su hora orientativa: sirve para colocar el entreno y para que el plan se
// pueda leer como un horario y no como una lista suelta.

interface SlotSpec { slot: MealSlot; share: number; hour: number }

const LAYOUTS: Record<3 | 4 | 5, SlotSpec[]> = {
  3: [
    { slot: 'desayuno', share: 0.30, hour: 8 },
    { slot: 'comida', share: 0.40, hour: 14 },
    { slot: 'cena', share: 0.30, hour: 21 },
  ],
  4: [
    { slot: 'desayuno', share: 0.25, hour: 8 },
    { slot: 'comida', share: 0.35, hour: 14 },
    { slot: 'snack', share: 0.10, hour: 17.5 },
    { slot: 'cena', share: 0.30, hour: 21 },
  ],
  5: [
    { slot: 'desayuno', share: 0.22, hour: 8 },
    { slot: 'snack', share: 0.08, hour: 11 },
    { slot: 'comida', share: 0.33, hour: 14 },
    { slot: 'snack', share: 0.10, hour: 17.5 },
    { slot: 'cena', share: 0.27, hour: 21 },
  ],
};

const TRAIN_HOUR: Record<TrainingWhen, number> = {
  morning: 9, midday: 13, afternoon: 18, evening: 20.5,
};

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Reparte las calorías del día teniendo en cuenta el entreno.
 *
 * La comida ANTERIOR al entreno se refuerza (es la que da la energía) y la
 * POSTERIOR se marca como recuperación. Lo que sube una lo bajan las demás, en
 * proporción: el total del día no cambia, que es lo que importa.
 */
function splitFor(mealsPerDay: 3 | 4 | 5, when: TrainingWhen | null): (SlotSpec & { training?: 'pre' | 'post' })[] {
  const base = LAYOUTS[mealsPerDay].map((s) => ({ ...s }));
  if (!when) return base;

  const trainHour = TRAIN_HOUR[when];
  let preIdx = -1;
  let postIdx = -1;
  base.forEach((s, i) => {
    if (s.hour <= trainHour) preIdx = i;
    if (postIdx === -1 && s.hour > trainHour) postIdx = i;
  });
  // Entreno antes del desayuno: la comida de después hace de repostaje.
  if (preIdx === -1 && postIdx !== -1) {
    return base.map((s, i) => (i === postIdx ? { ...s, training: 'post' as const } : s));
  }
  if (preIdx === -1) return base;

  const BOOST = 0.05;
  const others = base.map((_, i) => i).filter((i) => i !== preIdx && i !== postIdx);
  const pool = others.reduce((a, i) => a + base[i].share, 0);
  if (pool > BOOST) {
    base[preIdx].share += BOOST;
    others.forEach((i) => { base[i].share -= BOOST * (base[i].share / pool); });
  }

  return base.map((s, i) => ({
    ...s,
    training: i === preIdx ? 'pre' as const : i === postIdx ? 'post' as const : undefined,
  }));
}

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
 *
 * Las restricciones escritas por el usuario ("sin lactosa", "nada de cerdo")
 * SÍ filtran de verdad y no se relajan: es lo único que puede sentarle mal.
 */
function candidates(slot: MealSlot, p: PlannerParams): Recipe[] {
  const pantry = new Set(p.pantry);
  const banned = bannedTags(p.restrictions);
  const base = RECIPES.filter((r) => r.slot === slot
    && (!p.vegetarian || r.veg)
    && !r.pantry.some((tag) => banned.has(tag)));
  if (base.length === 0) {
    // Si las restricciones dejan la franja sin nada, se avisa desde arriba con
    // `restrictionsTooTight`; aquí se devuelve lo que haya sin restricciones
    // para no dejar el día vacío en silencio.
    return RECIPES.filter((r) => r.slot === slot && (!p.vegetarian || r.veg));
  }

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

/**
 * Etiquetas que hay que evitar según lo que el usuario haya escrito.
 *
 * Es un filtro por palabras clave, no un análisis clínico: cubre lo habitual
 * ("sin lactosa", "no como cerdo", "alergia a los frutos secos") y la pantalla
 * recuerda que ante una alergia real hay que revisar cada plato. Preferimos un
 * filtro honesto y limitado a fingir que entendemos cualquier frase.
 */
const RESTRICTION_RULES: { words: string[]; tags: Pantry[] }[] = [
  { words: ['lactosa', 'lactose', 'lacteo', 'lacteos', 'leche', 'dairy', 'milk'], tags: ['lacteo', 'queso', 'yogur'] },
  { words: ['gluten', 'celiac', 'celiaco', 'trigo', 'wheat'], tags: ['pasta', 'pan'] },
  { words: ['cerdo', 'pork', 'jamon', 'bacon'], tags: ['cerdo'] },
  { words: ['marisco', 'crustaceo', 'shellfish', 'seafood'], tags: ['marisco'] },
  { words: ['pescado', 'fish'], tags: ['pescado', 'atun'] },
  { words: ['frutos secos', 'nueces', 'cacahuete', 'nuts', 'peanut'], tags: ['frutos_secos'] },
  { words: ['huevo', 'egg'], tags: ['huevo'] },
  { words: ['legumbre', 'legumbres', 'legume'], tags: ['legumbre'] },
  { words: ['soja', 'soy'], tags: ['tofu'] },
];

function bannedTags(restrictions: string | undefined): Set<Pantry> {
  const out = new Set<Pantry>();
  const raw = (restrictions || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!raw.trim()) return out;
  for (const rule of RESTRICTION_RULES) {
    if (rule.words.some((w) => raw.includes(w))) rule.tags.forEach((t) => out.add(t));
  }
  return out;
}

/** ¿Las restricciones dejan alguna franja sin platos? Para avisar arriba. */
export function restrictionsTooTight(p: PlannerParams): boolean {
  const banned = bannedTags(p.restrictions);
  if (banned.size === 0) return false;
  const slots: MealSlot[] = ['desayuno', 'comida', 'cena', 'snack'];
  return slots.some((slot) => RECIPES.filter((r) => r.slot === slot
    && (!p.vegetarian || r.veg)
    && !r.pantry.some((tag) => banned.has(tag))).length === 0);
}

function scaleMeal(r: Recipe, targetKcal: number, spec: SlotSpec & { training?: 'pre' | 'post' }): PlannedMeal {
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
    time: fmtHour(spec.hour),
    training: spec.training,
  };
}

export interface PlanContext {
  /** Primer día del plan (ISO). */
  startDate: string;
  /** Lo que hay en la agenda, por fecha. */
  training: TrainingMap;
  /** Franja habitual de entreno; null si el usuario dijo que varía. */
  defaultWhen: TrainingWhen | null;
  /** Aclaraciones por día concreto ("ese jueves entreno por la noche"). */
  overrides?: Record<string, TrainingWhen | null>;
}

/** Franja de entreno que aplica a un día: la aclaración manda sobre la habitual. */
function whenFor(date: string, hasTraining: boolean, ctx: PlanContext): TrainingWhen | null {
  const override = ctx.overrides?.[date];
  if (override !== undefined) return override;
  return hasTraining ? ctx.defaultWhen : null;
}

/**
 * Monta el plan.
 *
 * Por franja se prepara una baraja barajada con la semilla y se va repartiendo
 * en orden: así ningún día repite plato mientras queden cartas, y al agotarse
 * la baraja se vuelve a barajar en vez de dejar huecos.
 */
export function generatePlan(target: DailyTarget, params: PlannerParams, ctx: PlanContext): MealPlan {
  const meals = params.mealsPerDay ?? 4;
  const rnd = mulberry32(params.seed);

  // Una baraja por FRANJA (no por posición): con 5 comidas hay dos snacks y
  // deben salir de la misma baraja para no repetirse entre sí.
  const decks = new Map<MealSlot, { pool: Recipe[]; used: Set<string> }>();
  for (const slot of ['desayuno', 'comida', 'cena', 'snack'] as MealSlot[]) {
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
  const start = new Date(`${ctx.startDate}T12:00:00`);

  for (let d = 1; d <= params.days; d++) {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + d - 1);
    const date = isoOf(dayDate);

    const training = ctx.training.get(date) || { strength: false, activities: [] };
    const hasTraining = training.strength || training.activities.length > 0;
    const when = whenFor(date, hasTraining, ctx);

    const specs = splitFor(meals, when);
    const dayMeals: PlannedMeal[] = [];
    for (const spec of specs) {
      const r = draw(spec.slot);
      if (!r) continue;
      dayMeals.push(scaleMeal(r, target.kcal * spec.share, spec));
    }

    days.push({
      day: d,
      date,
      meals: dayMeals,
      kcal: dayMeals.reduce((a, m) => a + m.kcal, 0),
      protein: dayMeals.reduce((a, m) => a + m.protein, 0),
      strength: training.strength,
      activities: training.activities,
      when,
    });
  }

  return {
    target,
    params,
    days,
    createdAt: new Date().toISOString(),
    done: [],
    extras: params.customFoods || [],
  };
}

/**
 * Recalcula UN día cuando el usuario aclara a qué hora entrena ese día.
 *
 * No cambia los platos: cambia el reparto de calorías, las horas y las marcas
 * de pre/post entreno. Rehacer el menú entero porque el jueves entrena de
 * noche sería castigar al usuario por darnos un dato mejor.
 */
export function rescaleDay(plan: MealPlan, dayNumber: number, when: TrainingWhen | null): MealPlan {
  const meals = plan.params.mealsPerDay ?? 4;
  const days = plan.days.map((d) => {
    if (d.day !== dayNumber) return d;
    const specs = splitFor(meals, when);
    const next = d.meals.map((m, i) => {
      const spec = specs[i];
      const r = RECIPE_BY_ID.get(m.recipeId);
      if (!spec || !r) return m;
      return scaleMeal(r, plan.target.kcal * spec.share, spec);
    });
    return {
      ...d,
      when,
      meals: next,
      kcal: next.reduce((a, m) => a + m.kcal, 0),
      protein: next.reduce((a, m) => a + m.protein, 0),
    };
  });
  return { ...plan, days };
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

/**
 * Rellena lo que falte en un plan guardado antes de la ampliación.
 *
 * Los planes creados con la versión anterior no traen fecha, ni horas, ni
 * comidas marcadas. Se completan al cargarlos en vez de tirarlos: el usuario
 * no tiene por qué perder su plan porque nosotros hayamos cambiado el modelo.
 */
function hydrate(plan: MealPlan): MealPlan {
  const created = plan.createdAt ? new Date(plan.createdAt) : new Date();
  const meals = plan.params?.mealsPerDay ?? 4;
  const specs = LAYOUTS[meals as 3 | 4 | 5] || LAYOUTS[4];

  return {
    ...plan,
    done: Array.isArray(plan.done) ? plan.done : [],
    extras: Array.isArray(plan.extras) ? plan.extras : [],
    days: (plan.days || []).map((d) => {
      const date = d.date || (() => {
        const dt = new Date(created);
        dt.setDate(created.getDate() + (d.day - 1));
        return isoOf(dt);
      })();
      return {
        ...d,
        date,
        strength: d.strength ?? false,
        activities: d.activities ?? [],
        when: d.when ?? null,
        meals: (d.meals || []).map((m, i) => ({
          ...m,
          time: m.time || fmtHour(specs[i]?.hour ?? 13),
        })),
      };
    }),
  };
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

/**
 * Guarda un cambio pequeño sobre el plan activo (marcar una comida, aclarar
 * la hora de un día) SIN archivar ni crear una versión nueva.
 */
export async function updateActivePlan(profileId: string, plan: MealPlan): Promise<void> {
  writeLocal(profileId, plan);
  await supabase.from('meal_plans')
    .update({ plan_json: plan, params_json: plan.params })
    .eq('fighter_profile_id', profileId).eq('status', 'active');
}

/** Carga el plan activo: primero de la cuenta, si no, el de este navegador. */
export async function loadPlan(profileId: string): Promise<LoadedPlan | null> {
  const { data, error } = await supabase.from('meal_plans')
    .select('plan_json')
    .eq('fighter_profile_id', profileId).eq('status', 'active')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!error && data?.plan_json) {
    return { plan: hydrate(data.plan_json as MealPlan), storedLocally: false };
  }

  const local = readLocal(profileId);
  return local ? { plan: hydrate(local), storedLocally: true } : null;
}

/** Descarta el plan activo (archiva en la base y limpia el local). */
export async function clearPlan(profileId: string): Promise<void> {
  try { localStorage.removeItem(localKey(profileId)); } catch { /* nada */ }
  await supabase.from('meal_plans')
    .update({ status: 'archived' })
    .eq('fighter_profile_id', profileId).eq('status', 'active');
}
