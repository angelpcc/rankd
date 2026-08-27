// Intérprete de dictado para el registro de entrenos.
//
// Convierte lenguaje natural ("hoy hice hora y media de saco, y acabé fundido")
// en campos estructurados que PRE-RELLENAN el formulario. Nunca guarda: el
// peleador revisa y confirma. Es determinista y funciona en el navegador, sin
// depender de la clave de IA (que puede refinarlo el día que se active).

export interface ParsedTraining {
  type?: string;        // sparring | tecnica | fuerza | cardio | flexibilidad | recuperacion
  durationMin?: number; // minutos
  intensity?: number;   // 1..5
  feeling?: number;     // 1..5 (cómo acabó)
  part?: string;        // morning | afternoon | evening
  notes: string;        // el dictado completo, para no perder nada
}

// Palabras → tipo de sesión (raíces, sin acentos).
const TYPE_WORDS: { type: string; words: string[] }[] = [
  { type: 'sparring', words: ['sparring', 'spar', 'guanteo'] },
  { type: 'tecnica', words: ['tecnica', 'saco', 'manopla', 'sombra', 'pao', 'mitts', 'bag', 'shadow', 'technique', 'pads'] },
  { type: 'fuerza', words: ['fuerza', 'pesas', 'gimnasio', 'gym', 'strength', 'weights', 'lifting'] },
  { type: 'cardio', words: ['cardio', 'correr', 'carrera', 'run', 'running', 'bici', 'bike', 'comba', 'cuerda', 'rope', 'hiit', 'natacion', 'swim'] },
  { type: 'flexibilidad', words: ['movilidad', 'estiramiento', 'estirar', 'yoga', 'mobility', 'stretch', 'flexibilidad'] },
  { type: 'recuperacion', words: ['recuperacion', 'descanso', 'masaje', 'recovery', 'rest', 'massage', 'fisio'] },
];

// Cómo acabó (feeling bajo) / a tope de esfuerzo (intensity alto).
const FEEL_LOW = ['fundido', 'reventado', 'muerto', 'agotado', 'destrozado', 'sin fuerzas', 'exhausted', 'wrecked', 'dead', 'shattered', 'drained'];
const FEEL_GOOD = ['genial', 'estupendo', 'fenomenal', 'de lujo', 'como nuevo', 'con fuerza', 'fresco', 'great', 'awesome', 'strong', 'fresh', 'amazing'];
const INT_HIGH = ['al limite', 'a tope', 'muy intenso', 'muy duro', 'durisimo', 'brutal', 'max', 'all out', 'very hard', 'very intense'];
const INT_HARD = ['intenso', 'duro', 'fuerte', 'exigente', 'hard', 'intense', 'tough'];
const INT_SOFT = ['suave', 'flojo', 'tranquilo', 'ligero', 'easy', 'light', 'gentle', 'chill'];

const PART_WORDS: { part: string; words: string[] }[] = [
  { part: 'morning', words: ['manana', 'temprano', 'morning'] },
  { part: 'afternoon', words: ['tarde', 'mediodia', 'afternoon', 'noon'] },
  { part: 'evening', words: ['noche', 'evening', 'night', 'tonight'] },
];

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function has(hay: string, words: string[]): boolean {
  return words.some((w) => hay.includes(w));
}

// "hora y media" = 90, "media hora" = 30, "hora y cuarto" = 75, "dos horas" = 120…
const NUM_WORDS: Record<string, number> = {
  media: 0.5, medio: 0.5, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4,
  half: 0.5, an: 1, a: 1, one: 1, two: 2, three: 3, four: 4,
};

export function parseDuration(raw: string): number | undefined {
  const s = norm(raw);
  // Frases hechas (con o sin artículo): "hora y media", "hora y cuarto".
  if (/hora\s+y\s+media|hour\s+and\s+a\s+half/.test(s)) return 90;
  if (/hora\s+y\s+cuarto|hour\s+and\s+a\s+quarter/.test(s)) return 75;
  if (/media\s+hora|half\s+an?\s+hour/.test(s)) return 30;
  // Horas explícitas con minutos: "1 h 30", "1h30"
  let m = s.match(/(\d+)\s*(?:h|hora|horas|hour|hours)\s*(?:y\s*)?(\d+)\s*(?:m|min|minuto|minutos|minute|minutes)/);
  if (m) { const h = parseInt(m[1], 10); const min = parseInt(m[2], 10); if (!Number.isNaN(h)) return h * 60 + min; }
  // Número en palabra + horas (+ fracción): "una hora", "dos horas", "una hora y media"
  m = s.match(/(un|una|uno|dos|tres|cuatro|one|two|three|four|a|an)\s+(?:hora|horas|hour|hours)(?:\s+y\s+(media|cuarto)|\s+and\s+a\s+(half|quarter))?/);
  if (m) {
    let h = NUM_WORDS[m[1]] ?? 1;
    const frac = m[2] || m[3];
    if (frac === 'media' || frac === 'half') h += 0.5;
    if (frac === 'cuarto' || frac === 'quarter') h += 0.25;
    return Math.round(h * 60);
  }
  // Minutos sueltos: "90 minutos", "45 min"
  m = s.match(/(\d+)\s*(?:m|min|minuto|minutos|minute|minutes)\b/);
  if (m) { const n = parseInt(m[1], 10); if (!Number.isNaN(n)) return n; }
  // Horas sueltas numéricas: "2 horas", "1h"
  m = s.match(/(\d+)\s*(?:h|hora|horas|hour|hours)\b/);
  if (m) { const n = parseInt(m[1], 10); if (!Number.isNaN(n)) return n * 60; }
  // "una hora" sin número explícito ya cubierto; "hora" a secas = 60.
  if (/\bhora\b|\bhour\b/.test(s)) return 60;
  return undefined;
}

// ── Dictado del registro de FUERZA (R13-T10) ──
// "he hecho press banca, tres series de doce con cincuenta kilos"
//   → { exercise:'Press banca', sets:3, reps:12, weight:50 }

export interface ParsedStrength {
  exercise?: string;
  sets?: number;
  reps?: number;
  repsMax?: number;   // tope del rango ("8 a 10" → reps 8, repsMax 10)
  weight?: number;
  notes: string;
}

const NUMW: Record<string, number> = {
  cero: 0, zero: 0, un: 1, uno: 1, una: 1, one: 1, dos: 2, two: 2, tres: 3, three: 3,
  cuatro: 4, four: 4, cinco: 5, five: 5, seis: 6, six: 6, siete: 7, seven: 7, ocho: 8, eight: 8,
  nueve: 9, nine: 9, diez: 10, ten: 10, once: 11, eleven: 11, doce: 12, twelve: 12,
  trece: 13, thirteen: 13, catorce: 14, fourteen: 14, quince: 15, fifteen: 15,
  dieciseis: 16, sixteen: 16, diecisiete: 17, seventeen: 17, dieciocho: 18, eighteen: 18,
  diecinueve: 19, nineteen: 19, veinte: 20, twenty: 20, veintiuno: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
  veintiocho: 28, veintinueve: 29, treinta: 30, thirty: 30, cuarenta: 40, forty: 40,
  cincuenta: 50, fifty: 50, sesenta: 60, sixty: 60, setenta: 70, seventy: 70,
  ochenta: 80, eighty: 80, noventa: 90, ninety: 90, cien: 100, ciento: 100, hundred: 100,
};

// Convierte números en palabra a dígitos, incluyendo "cincuenta y cinco" = 55.
function digitize(s: string): string {
  let out = s;
  out = out.replace(/(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)/g,
    (_m, a, b) => String((NUMW[a] || 0) + (NUMW[b] || 0)));
  out = out.replace(/(thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)/g,
    (_m, a, b) => String((NUMW[a] || 0) + (NUMW[b] || 0)));
  // Palabras sueltas → dígitos (las más largas primero para no partir compuestos).
  Object.keys(NUMW).sort((a, b) => b.length - a.length).forEach((w) => {
    out = out.replace(new RegExp(`\\b${w}\\b`, 'g'), String(NUMW[w]));
  });
  return out;
}

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function parseStrengthFromSpeech(text: string, library: string[] = []): ParsedStrength {
  const raw = norm(text);
  const s = digitize(raw);
  const out: ParsedStrength = { notes: text.trim() };

  // Peso: "50 kilos" / "con 50 kg"
  const wm = s.match(/(\d+(?:[.,]\d+)?)\s*(?:kilos?|kgs?|kg)\b/) || s.match(/(?:con|with)\s+(\d+(?:[.,]\d+)?)\b/);
  if (wm) { const w = parseFloat(wm[1].replace(',', '.')); if (w > 0 && w <= 500) out.weight = w; }

  // "3 series" / "3 sets"
  const sm = s.match(/(\d+)\s*(?:series?|sets?)\b/);
  if (sm) out.sets = clampN(parseInt(sm[1], 10), 1, 20);

  // "3 por 12" / "3x12" → series x repeticiones
  const pxr = s.match(/(\d+)\s*(?:x|por|by)\s*(\d+)/);
  if (pxr) {
    if (out.sets === undefined) out.sets = clampN(parseInt(pxr[1], 10), 1, 20);
    out.reps = clampN(parseInt(pxr[2], 10), 1, 100);
  }

  // Rango de repeticiones: "8 a 10", "de 8 a 10", "8 to 10", "8 hasta 10".
  // Tiene prioridad sobre el número suelto para no perder el tope del rango.
  // El lookahead niega "8 a 55kg"/"8 a 55 kilos": eso es peso ("a" = "con"),
  // no un rango de reps hasta 55, y ya lo captura el peso arriba.
  const range = s.match(/(\d+)\s*(?:a|to|hasta)\s*(\d+)\s*(?:repe|reps?|repeticion|repeticiones)?\b(?!\s*(?:kilos?|kgs?|kg)\b)/);
  if (range) {
    const lo = parseInt(range[1], 10);
    const hi = parseInt(range[2], 10);
    if (lo > 0 && hi > lo && hi <= 100) { out.reps = lo; out.repsMax = hi; }
  }

  // "de 12" / "de 12 repeticiones" / "12 reps"
  if (out.reps === undefined) {
    const rm = s.match(/(?:de|por|of)\s*(\d+)\s*(?:repe|reps?|repeticion|repeticiones)?\b/) || s.match(/(\d+)\s*(?:repe|reps?|repeticion|repeticiones)\b/);
    if (rm) { const r = parseInt(rm[1], 10); if (r > 0 && r <= 100) out.reps = r; }
  }

  // Ejercicio: el nombre de la biblioteca más largo que aparezca en el texto.
  const found = library
    .map((l) => ({ l, n: norm(l) }))
    .filter((x) => x.n && raw.includes(x.n))
    .sort((a, b) => b.n.length - a.n.length)[0];
  if (found) out.exercise = found.l;

  return out;
}

// ── Dictado de una SESIÓN completa de fuerza (R14-T3) ──
// "press inclinado, tres series de ocho a diez con veinte kilos, luego pecho
//  inferior en máquina, tres series de doce con quince kilos"
//   → [ {exercise, sets:3, reps:8, repsMax:10, weight:20},
//       {exercise, sets:3, reps:12, weight:15} ]
// Separa por conectores ("luego", "después", "then"…) y, si no los hay, por los
// propios nombres de ejercicio detectados. Cada tramo se parsea por separado.
// NUNCA guarda: el resultado se muestra para revisar y confirmar.

const CONNECTORS = /\s*(?:,?\s*(?:y\s+)?(?:luego|despues|a\s+continuacion|seguido)\b|,?\s*(?:and\s+)?(?:then|next|after\s+that)\b)\s*/g;

function findExerciseHits(hay: string, library: string[]): { label: string; idx: number; len: number }[] {
  const hits: { label: string; idx: number; len: number }[] = [];
  library.forEach((l) => {
    const n = norm(l);
    if (!n) return;
    let from = 0;
    for (;;) {
      const idx = hay.indexOf(n, from);
      if (idx === -1) break;
      hits.push({ label: l, idx, len: n.length });
      from = idx + n.length;
    }
  });
  // Ordena por posición; en solapes, gana el nombre más largo.
  hits.sort((a, b) => a.idx - b.idx || b.len - a.len);
  const chosen: typeof hits = [];
  hits.forEach((h) => {
    if (!chosen.some((c) => h.idx < c.idx + c.len && c.idx < h.idx + h.len)) chosen.push(h);
  });
  return chosen.sort((a, b) => a.idx - b.idx);
}

export function parseStrengthSessionFromSpeech(text: string, library: string[] = []): ParsedStrength[] {
  const raw = norm(text);

  // 1) Segmentar por conectores explícitos ("luego", "then"…).
  let segments = raw.split(CONNECTORS).map((s) => s.trim()).filter(Boolean);

  // 2) Si no hubo conectores pero SÍ hay varios ejercicios nombrados, cortar por
  //    la posición de cada ejercicio detectado.
  if (segments.length <= 1) {
    const hits = findExerciseHits(raw, library);
    if (hits.length > 1) {
      segments = hits.map((h, i) => raw.slice(h.idx, i + 1 < hits.length ? hits[i + 1].idx : raw.length).trim()).filter(Boolean);
    }
  }

  const parsed = segments
    .map((seg) => parseStrengthFromSpeech(seg, library))
    .filter((p) => p.exercise || p.reps || p.weight || p.sets);

  // Un solo ejercicio (o ninguno): devolvemos como está para el flujo normal.
  return parsed;
}

export function parseTrainingFromSpeech(text: string): ParsedTraining {
  const s = norm(text);
  const out: ParsedTraining = { notes: text.trim() };

  for (const { type, words } of TYPE_WORDS) { if (has(s, words)) { out.type = type; break; } }
  for (const { part, words } of PART_WORDS) { if (has(s, words)) { out.part = part; break; } }

  const dur = parseDuration(text);
  if (dur && dur >= 5 && dur <= 600) out.durationMin = dur;

  if (has(s, INT_HIGH)) out.intensity = 5;
  else if (has(s, INT_HARD)) out.intensity = 4;
  else if (has(s, INT_SOFT)) out.intensity = 2;

  if (has(s, FEEL_LOW)) { out.feeling = 2; if (out.intensity === undefined) out.intensity = 5; }
  else if (has(s, FEEL_GOOD)) out.feeling = 5;

  return out;
}

// ── Dictado / escritura de un PLAN DE SEMANA (Planificar, Tarea 2) ──
//
// "Esta semana: lunes hombro y espalda, tres series de todo. Martes correr
//  media hora. Miércoles descanso. Toda la semana pollo y arroz de comida, y
//  por la noche algo ligero. Tomo creatina cada día y proteína después de
//  entrenar. El viernes cena fuera."
//
//   → una línea por (día × bloque): strength / activity / meal / supplement / note
//
// Determinista, en el navegador, sin IA. El resultado SIEMPRE pasa por una
// pantalla de revisión editable antes de guardar — nunca se agenda directo.

export type WeekPlanKind = 'strength' | 'activity' | 'meal' | 'supplement' | 'note';

export interface WeekPlanLine {
  /** Date.getDay(): 0=domingo … 6=sábado. */
  day: number;
  kind: WeekPlanKind;
  /** payload equivalente al de day_plan_items según kind. */
  payload:
    | { groups: string[]; note?: string }
    | { kind: string; duration_min?: number; note?: string }
    | { slot: 'desayuno' | 'comida' | 'cena' | 'snack'; text: string }
    | { name: string; time?: string }
    | { text: string };
  /** Texto original del fragmento, para mostrarlo en la revisión. */
  raw: string;
}

// Días de la semana → Date.getDay(). Raíces sin acento.
const DAY_WORDS: { day: number; words: string[] }[] = [
  { day: 1, words: ['lunes', 'monday'] },
  { day: 2, words: ['martes', 'tuesday'] },
  { day: 3, words: ['miercoles', 'wednesday'] },
  { day: 4, words: ['jueves', 'thursday'] },
  { day: 5, words: ['viernes', 'friday'] },
  { day: 6, words: ['sabado', 'saturday'] },
  { day: 0, words: ['domingo', 'sunday'] },
];
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
const EVERY_DAY_WORDS = ['toda la semana', 'cada dia', 'todos los dias', 'a diario', 'every day', 'all week', 'daily'];

// Grupo muscular ← palabras (clave = MuscleGroup de exercises.ts).
const MG_WORDS: { group: string; words: string[] }[] = [
  { group: 'back', words: ['espalda', 'dorsal', 'dorsales', 'back', 'lats'] },
  { group: 'chest', words: ['pecho', 'pectoral', 'pectorales', 'chest'] },
  { group: 'shoulders', words: ['hombro', 'hombros', 'deltoide', 'deltoides', 'shoulder', 'shoulders', 'delts'] },
  { group: 'biceps', words: ['biceps', 'bicep'] },
  { group: 'triceps', words: ['triceps', 'tricep'] },
  { group: 'legs', words: ['pierna', 'piernas', 'cuadriceps', 'femoral', 'gluteo', 'gluteos', 'gemelos', 'sentadilla', 'leg', 'legs', 'quads', 'glutes'] },
  { group: 'core', words: ['core', 'abdomen', 'abdominales', 'abdominal', 'abs'] },
  { group: 'power', words: ['potencia', 'pliometria', 'explosivo', 'power'] },
  { group: 'full_body', words: ['full body', 'cuerpo entero', 'todo el cuerpo', 'fullbody'] },
];

// Actividad no-fuerza ← palabras (value de ACTIVITY_KINDS).
const ACT_WORDS: { kind: string; words: string[] }[] = [
  { kind: 'correr', words: ['correr', 'carrera', 'trotar', 'footing', 'rodaje', 'run', 'running', 'jog'] },
  { kind: 'boxeo', words: ['boxeo', 'sparring', 'guanteo', 'saco', 'manoplas', 'sombra', 'boxing', 'spar', 'bag work'] },
  { kind: 'bici', words: ['bici', 'bicicleta', 'ciclismo', 'rodillo', 'bike', 'cycling', 'spinning'] },
  { kind: 'natacion', words: ['natacion', 'nadar', 'piscina', 'swim', 'swimming', 'pool'] },
  { kind: 'cuerda', words: ['comba', 'cuerda', 'saltar a la comba', 'rope', 'jump rope', 'skipping'] },
];

// Suplementos ← palabras (se guarda el nombre tal cual detectado).
const SUPP_WORDS: { name: string; words: string[] }[] = [
  { name: 'Creatina', words: ['creatina', 'creatine'] },
  { name: 'Proteína', words: ['proteina', 'whey', 'batido de proteina', 'protein'] },
  { name: 'Cafeína', words: ['cafeina', 'caffeine'] },
  { name: 'Pre-entreno', words: ['pre entreno', 'preentreno', 'pre-entreno', 'preworkout', 'pre-workout'] },
  { name: 'BCAA', words: ['bcaa', 'bcaas'] },
  { name: 'Glutamina', words: ['glutamina', 'glutamine'] },
  { name: 'Magnesio', words: ['magnesio', 'magnesium'] },
  { name: 'Omega 3', words: ['omega 3', 'omega3', 'omega-3', 'aceite de pescado', 'fish oil'] },
  { name: 'Multivitamínico', words: ['multivitaminico', 'multivitamina', 'multivitamin'] },
  { name: 'Vitamina D', words: ['vitamina d', 'vitamin d'] },
  { name: 'ZMA', words: ['zma'] },
  { name: 'Beta-alanina', words: ['beta alanina', 'beta-alanina', 'beta alanine'] },
  { name: 'Colágeno', words: ['colageno', 'collagen'] },
  { name: 'Melatonina', words: ['melatonina', 'melatonin'] },
];

const FOOD_HINT = ['pollo', 'arroz', 'pasta', 'pescado', 'carne', 'ensalada', 'verdura', 'huevos', 'atun', 'ternera',
  'avena', 'fruta', 'patata', 'legumbres', 'lentejas', 'garbanzos', 'tortilla', 'yogur', 'queso', 'pan',
  'chicken', 'rice', 'fish', 'salad', 'oats', 'eggs', 'meat', 'pasta', 'comer', 'comida', 'cena', 'desayuno',
  'plato', 'menu', 'dieta', 'ligero', 'ligera'];
const REST_WORDS = ['descanso', 'descansar', 'libre', 'rest', 'day off', 'off'];

function findDays(seg: string): number[] {
  if (EVERY_DAY_WORDS.some((w) => seg.includes(w))) return [...ALL_WEEK];
  const days = new Set<number>();
  for (const { day, words } of DAY_WORDS) if (has(seg, words)) days.add(day);
  return [...days];
}

/** Grupos musculares (claves de exercises.ts) mencionados en un texto libre. */
export function detectMuscleGroups(text: string): string[] {
  const s = norm(text);
  return MG_WORDS.filter((g) => has(s, g.words)).map((g) => g.group);
}

/** Tipo de actividad no-fuerza más cercano a un texto libre (o null). */
export function detectActivityKind(text: string): string | null {
  const s = norm(text);
  return ACT_WORDS.find((a) => has(s, a.words))?.kind ?? null;
}

function mealSlot(seg: string): 'desayuno' | 'comida' | 'cena' | 'snack' {
  if (/desayun/.test(seg) || seg.includes('breakfast') || /por la manana/.test(seg)) return 'desayuno';
  if (/\bcena\b|cenar|por la noche|de noche|night|dinner/.test(seg)) return 'cena';
  if (/snack|merienda|media manana|tentempie/.test(seg)) return 'snack';
  return 'comida';
}

// Días con y sin acento, para limpiar el texto de la revisión (el día ya
// se muestra aparte en un selector).
const DAY_STRIP = 'lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday';

// Limpia un fragmento para mostrarlo: quita el día del principio y conectores.
function cleanRaw(raw: string): string {
  return raw
    .trim()
    .replace(/^\s*(?:esta semana|this week)[\s,:]*/i, '')
    .replace(new RegExp(`^\\s*(?:el|los|este|esta|the|on|tengo|hago)\\s+`, 'i'), '')
    .replace(new RegExp(`^\\s*(?:y\\s+)?(?:el|los)?\\s*(?:${DAY_STRIP})\\b[\\s,]*`, 'i'), '')
    .replace(new RegExp(`^\\s*(?:el|los|este|esta|the|on|tengo|hago)\\s+`, 'i'), '')
    .trim();
}

/**
 * Interpreta un plan de semana escrito o dictado. `weekStartsMonday` no cambia
 * nada aquí (devolvemos Date.getDay()); el llamador mapea cada `day` a la fecha
 * de la semana que esté editando.
 */
export function parseWeekPlanFromSpeech(text: string): WeekPlanLine[] {
  const lines: WeekPlanLine[] = [];
  // Frases por punto / salto de línea / punto y coma / dos puntos.
  const sentences = text.split(/[.\n;:]+/).map((x) => x.trim()).filter(Boolean);

  let lastDays: number[] = [];

  for (const sentence of sentences) {
    const sNorm = norm(sentence);
    const sentenceDays = findDays(sNorm);
    // Sub-fragmentos por coma; el día detectado en la frase vale para todos.
    const clauses = sentence.split(/,|\by\b(?=\s+(?:por|el|los|cada|toda|de noche|de dia))/i)
      .map((x) => x.trim()).filter(Boolean);

    let producedStrengthIdx = -1;

    clauses.forEach((clause, ci) => {
      const c = norm(clause);
      let days = ci === 0 ? sentenceDays : (findDays(c).length ? findDays(c) : sentenceDays);
      if (days.length === 0) days = lastDays;
      // Un fragmento de detalle ("tres series de todo") sin día ni patrón se
      // pega como nota al bloque de fuerza que acabamos de crear en la frase.
      const looksLikeDetail = ci > 0 && findDays(c).length === 0;

      // 1. Fuerza. La nota se compone SOLO de los fragmentos de detalle
      //    posteriores ("tres series de todo"), no de esta cláusula.
      const groups = MG_WORDS.filter((g) => has(c, g.words)).map((g) => g.group);
      if (groups.length > 0) {
        (days.length ? days : lastDays).forEach((d) => lines.push({
          day: d, kind: 'strength', payload: { groups }, raw: cleanRaw(clause),
        }));
        producedStrengthIdx = lines.length - 1;
        lastDays = days.length ? days : lastDays;
        return;
      }

      // 2. Actividad
      const act = ACT_WORDS.find((a) => has(c, a.words));
      if (act) {
        const dur = parseDuration(clause);
        (days.length ? days : lastDays).forEach((d) => lines.push({
          day: d, kind: 'activity',
          payload: { kind: act.kind, ...(dur && dur >= 5 && dur <= 600 ? { duration_min: dur } : {}) },
          raw: cleanRaw(clause),
        }));
        lastDays = days.length ? days : lastDays;
        return;
      }

      // 3. Suplemento
      const supps = SUPP_WORDS.filter((sp) => has(c, sp.words));
      if (supps.length > 0) {
        const target = EVERY_DAY_WORDS.some((w) => c.includes(w)) || days.length === 0 ? ALL_WEEK : days;
        supps.forEach((sp) => target.forEach((d) => lines.push({
          day: d, kind: 'supplement', payload: { name: sp.name }, raw: cleanRaw(clause),
        })));
        lastDays = target;
        return;
      }

      // 4. Descanso / "cena fuera" / detalle → nota
      if (has(c, REST_WORDS) || /fuera|out\b/.test(c)) {
        (days.length ? days : lastDays).forEach((d) => lines.push({
          day: d, kind: 'note', payload: { text: cleanRaw(clause) || clause.trim() }, raw: cleanRaw(clause),
        }));
        lastDays = days.length ? days : lastDays;
        return;
      }

      // 5. Comida
      if (has(c, FOOD_HINT)) {
        const slot = mealSlot(c);
        const text2 = cleanRaw(clause)
          .replace(/\b(de (comida|comer|cena|cenar|desayuno)|por la (noche|ma[ñn]ana)|para (comer|cenar|desayunar))\b/gi, '')
          .replace(/\b(toda la semana|todos los d[ií]as|cada d[ií]a|a diario|all week|every day|daily)\b/gi, '')
          .replace(/^\s*(?:y|and|,)\s*/i, '').replace(/\s+/g, ' ').trim();
        const target = EVERY_DAY_WORDS.some((w) => c.includes(w)) ? ALL_WEEK : (days.length ? days : lastDays);
        target.forEach((d) => lines.push({
          day: d, kind: 'meal', payload: { slot, text: text2 || clause.trim() }, raw: cleanRaw(clause),
        }));
        lastDays = target;
        return;
      }

      // 6. Detalle sin patrón → nota del bloque de fuerza previo, si lo hay
      if (looksLikeDetail && producedStrengthIdx >= 0) {
        const detail = clause.trim();
        // Pega la nota a TODAS las líneas de fuerza recién creadas en esta frase.
        for (let k = producedStrengthIdx; k < lines.length; k++) {
          if (lines[k].kind === 'strength') {
            const p = lines[k].payload as { groups: string[]; note?: string };
            p.note = p.note ? `${p.note} · ${detail}` : detail;
          }
        }
        return;
      }

      // 7. Con día explícito pero sin patrón reconocible → nota
      if (days.length > 0 && clause.trim().length > 2) {
        days.forEach((d) => lines.push({
          day: d, kind: 'note', payload: { text: cleanRaw(clause) || clause.trim() }, raw: cleanRaw(clause),
        }));
        lastDays = days;
      }
    });
  }

  // Dedupe exacto (mismo día + kind + payload serializado).
  const seen = new Set<string>();
  return lines.filter((l) => {
    const key = `${l.day}|${l.kind}|${JSON.stringify(l.payload)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
