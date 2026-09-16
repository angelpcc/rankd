// ════════════════════════════════════════════════════════════════
// RANKD · De qué está hecho cada deporte
//
// ── POR QUÉ EXISTE ──
//
// Registrar un Hyrox guardaba "duración" y "rondas". Eso no es un Hyrox: un
// Hyrox son 8 kilómetros repartidos entre 8 estaciones fijas, y lo que te dice
// si has mejorado es el tiempo de CADA estación y el peso que moviste en el
// trineo. Con "75 minutos, 8 rondas" no puedes comparar nada ni saber dónde se
// te fue la carrera.
//
// Igual con CrossFit: un WOD no es una duración, es un FORMATO (AMRAP, EMOM,
// For Time…) con su tope de tiempo, sus movimientos y sus cargas. El resultado
// que cuenta cambia según el formato — en un AMRAP son rondas + repeticiones,
// en un For Time es el tiempo.
//
// Aquí vive ese conocimiento, en un sitio: lo usan el formulario de registro
// (para pedir lo que de verdad define la sesión) y la IA (para que un plan de
// Hyrox sea un Hyrox y no "45 minutos de funcional").
//
// ── SOBRE LOS PESOS ──
//
// Los pesos de Hyrox son los estándar de las divisiones Open y Pro. Son
// VALORES POR DEFECTO EDITABLES, no una verdad grabada: la organización los ha
// ido ajustando por temporada y hay variantes por franja de edad. Lo que se
// guarda es lo que el usuario dice que movió, no lo que aquí pone.
// ════════════════════════════════════════════════════════════════

/** Cómo se mide una estación: por tiempo, por distancia o por repeticiones. */
export type SpecMetric = 'time' | 'distance' | 'reps';

export interface SpecStation {
  /** Identificador estable. NO se traduce: viaja a la base. */
  id: string;
  /** Etiqueta i18n. */
  labelKey: string;
  metric: SpecMetric;
  /** Metros de la estación, cuando va por distancia. */
  meters?: number;
  /** Repeticiones estándar (hombres / mujeres) cuando va por repeticiones. */
  reps?: { m: number; f: number };
  /** Carga estándar en kg por división. Editable: ver cabecera. */
  kg?: { openM?: number; openF?: number; proM?: number; proF?: number };
  /** Nota corta de ejecución, para que el registro tenga sentido. */
  hintKey?: string;
}

/**
 * Las 8 estaciones de un Hyrox, EN ORDEN.
 *
 * Entre cada dos hay 1 km de carrera (8 km en total). El orden no es un detalle
 * de presentación: la carrera se corre así y compararse estación a estación con
 * otra carrera solo tiene sentido si el orden es el mismo.
 */
export const HYROX_STATIONS: SpecStation[] = [
  { id: 'ski', labelKey: 'mc_sp_hx_ski', metric: 'distance', meters: 1000, hintKey: 'mc_sp_hx_ski_h' },
  {
    id: 'sled_push', labelKey: 'mc_sp_hx_push', metric: 'distance', meters: 50,
    kg: { openM: 102, openF: 78, proM: 152, proF: 103 }, hintKey: 'mc_sp_hx_push_h',
  },
  {
    id: 'sled_pull', labelKey: 'mc_sp_hx_pull', metric: 'distance', meters: 50,
    kg: { openM: 78, openF: 52, proM: 103, proF: 78 }, hintKey: 'mc_sp_hx_pull_h',
  },
  { id: 'burpee_bj', labelKey: 'mc_sp_hx_burpee', metric: 'distance', meters: 80, hintKey: 'mc_sp_hx_burpee_h' },
  { id: 'row', labelKey: 'mc_sp_hx_row', metric: 'distance', meters: 1000 },
  {
    id: 'farmers', labelKey: 'mc_sp_hx_farmers', metric: 'distance', meters: 200,
    kg: { openM: 24, openF: 16, proM: 32, proF: 24 }, hintKey: 'mc_sp_hx_farmers_h',
  },
  {
    id: 'lunges', labelKey: 'mc_sp_hx_lunges', metric: 'distance', meters: 100,
    kg: { openM: 20, openF: 10, proM: 30, proF: 20 }, hintKey: 'mc_sp_hx_lunges_h',
  },
  {
    id: 'wall_balls', labelKey: 'mc_sp_hx_wb', metric: 'reps', reps: { m: 100, f: 100 },
    kg: { openM: 6, openF: 4, proM: 9, proF: 6 }, hintKey: 'mc_sp_hx_wb_h',
  },
];

/** Kilómetros de carrera de un Hyrox completo: 8 tramos de 1 km. */
export const HYROX_RUN_KM = 8;

export type HyroxDivision = 'open_m' | 'open_f' | 'pro_m' | 'pro_f';

export const HYROX_DIVISIONS: { value: HyroxDivision; labelKey: string }[] = [
  { value: 'open_m', labelKey: 'mc_sp_hx_open_m' },
  { value: 'open_f', labelKey: 'mc_sp_hx_open_f' },
  { value: 'pro_m', labelKey: 'mc_sp_hx_pro_m' },
  { value: 'pro_f', labelKey: 'mc_sp_hx_pro_f' },
];

/** Carga estándar de una estación en una división. undefined = sin carga. */
export function hyroxKg(st: SpecStation, div: HyroxDivision): number | undefined {
  if (!st.kg) return undefined;
  switch (div) {
    case 'open_m': return st.kg.openM;
    case 'open_f': return st.kg.openF;
    case 'pro_m': return st.kg.proM;
    default: return st.kg.proF;
  }
}

// ── CROSSFIT Y FUNCIONAL ─────────────────────────────────────────

/**
 * Los formatos de WOD.
 *
 * `result` dice QUÉ resultado tiene sentido apuntar, y es la razón de que esto
 * exista: pedir "duración" en un AMRAP no mide nada (la duración es fija, la
 * dices tú al empezar), y pedir "rondas" en un For Time tampoco (las rondas son
 * fijas, lo que varía es el tiempo). Preguntar el dato equivocado es la forma
 * más rápida de que un registro no sirva para compararse con el de dentro de
 * un mes.
 */
export type WodResult = 'rounds_reps' | 'time' | 'reps' | 'load';

export interface WodFormat {
  id: string;
  labelKey: string;
  descKey: string;
  result: WodResult;
  /** ¿Lleva un tiempo declarado de antemano (AMRAP 20', EMOM 12')? */
  timed: boolean;
}

export const WOD_FORMATS: WodFormat[] = [
  { id: 'amrap', labelKey: 'mc_sp_wod_amrap', descKey: 'mc_sp_wod_amrap_d', result: 'rounds_reps', timed: true },
  { id: 'for_time', labelKey: 'mc_sp_wod_fortime', descKey: 'mc_sp_wod_fortime_d', result: 'time', timed: true },
  { id: 'emom', labelKey: 'mc_sp_wod_emom', descKey: 'mc_sp_wod_emom_d', result: 'rounds_reps', timed: true },
  { id: 'tabata', labelKey: 'mc_sp_wod_tabata', descKey: 'mc_sp_wod_tabata_d', result: 'reps', timed: true },
  { id: 'chipper', labelKey: 'mc_sp_wod_chipper', descKey: 'mc_sp_wod_chipper_d', result: 'time', timed: true },
  { id: 'strength', labelKey: 'mc_sp_wod_strength', descKey: 'mc_sp_wod_strength_d', result: 'load', timed: false },
];

export const wodFormat = (id: string): WodFormat | undefined => WOD_FORMATS.find((f) => f.id === id);

// ── Lo que se guarda ─────────────────────────────────────────────

/** Una estación de Hyrox, tal y como la hizo. */
export interface HyroxStationLog {
  id: string;
  /** Segundos que tardó en esa estación. */
  seconds?: number;
  /** Kilos que movió de verdad (no los del estándar). */
  kg?: number;
}

export interface HyroxDetail {
  sport: 'hyrox';
  division?: HyroxDivision;
  /** Estaciones, en el orden oficial. */
  stations: HyroxStationLog[];
  /** Segundos totales corriendo, si los separó de las estaciones. */
  runSeconds?: number;
}

/** Un movimiento del WOD: "20 thrusters a 43 kg". */
export interface WodMovement {
  name: string;
  reps?: number;
  kg?: number;
}

export interface WodDetail {
  sport: 'wod';
  format: string;
  /** Minutos declarados del formato (AMRAP 20' → 20). */
  capMin?: number;
  movements: WodMovement[];
  /** Resultado, en la unidad que pida el formato. */
  rounds?: number;
  extraReps?: number;
  seconds?: number;
  reps?: number;
  kg?: number;
  /** Nombre del WOD si es uno conocido ("Fran", "Murph"). */
  name?: string;
}

export type ActivityDetail = HyroxDetail | WodDetail;

/** ¿Este tipo de actividad se registra con estaciones de Hyrox? */
export const usaHyrox = (kind: string): boolean => kind === 'hyrox';

/** ¿Este tipo se registra como un WOD (formato + movimientos + resultado)? */
export const usaWod = (kind: string): boolean =>
  kind === 'crossfit' || kind === 'funcional' || kind === 'calistenia';

/**
 * WODs conocidos, para no tener que teclearlos.
 *
 * Son los benchmark clásicos: quien hace CrossFit los nombra por su nombre, y
 * escribir "21-15-9 thrusters y dominadas" cada vez que haces Fran es trabajo
 * que la app puede ahorrarse. Las cargas son las estándar de hombres; se
 * editan como todo lo demás.
 */
export const WODS_CONOCIDOS: { name: string; format: string; capMin?: number; movements: WodMovement[] }[] = [
  {
    name: 'Fran', format: 'for_time', capMin: 10,
    movements: [{ name: 'Thrusters', reps: 45, kg: 43 }, { name: 'Dominadas', reps: 45 }],
  },
  {
    name: 'Cindy', format: 'amrap', capMin: 20,
    movements: [{ name: 'Dominadas', reps: 5 }, { name: 'Flexiones', reps: 10 }, { name: 'Sentadillas', reps: 15 }],
  },
  {
    name: 'Murph', format: 'for_time', capMin: 60,
    movements: [
      { name: 'Correr 1 milla' }, { name: 'Dominadas', reps: 100 },
      { name: 'Flexiones', reps: 200 }, { name: 'Sentadillas', reps: 300 }, { name: 'Correr 1 milla' },
    ],
  },
  {
    name: 'Helen', format: 'for_time', capMin: 15,
    movements: [{ name: 'Correr 400 m' }, { name: 'Kettlebell swing', reps: 21, kg: 24 }, { name: 'Dominadas', reps: 12 }],
  },
  {
    name: 'Grace', format: 'for_time', capMin: 10,
    movements: [{ name: 'Clean and jerk', reps: 30, kg: 61 }],
  },
];
