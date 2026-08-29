// "El Rincón" — modo del temporizador que canta combinaciones por voz durante
// el asalto (como el entrenador desde la esquina entre asaltos).
//
// A diferencia del temporizador clásico (combinaciones por asalto, tokens y
// vídeos), aquí la biblioteca usa la NOTACIÓN NUMÉRICA estándar de boxeo:
//   1 Jab · 2 Cruzado · 3 Gancho guardia · 4 Gancho trasero
//   5 Uppercut guardia · 6 Uppercut trasero
//   R Rodillazo · P Patada · C Codo   (muay thai / kickboxing)
// Los combos de fábrica viven en una constante (abajo); los que crea el usuario
// se guardan en localStorage, igual que los preajustes del temporizador clásico.
// Sin BD y sin IA: funciona en el sitio, sin migración.

export type RinconSport = 'boxeo' | 'muaythai' | 'kickboxing';
export type RinconLevel = 'principiante' | 'intermedio' | 'avanzado';
export type RinconCategory = 'ataque' | 'contraataque' | 'defensa' | 'combinado';

export const RINCON_SPORTS: RinconSport[] = ['boxeo', 'muaythai', 'kickboxing'];
export const RINCON_LEVELS: RinconLevel[] = ['principiante', 'intermedio', 'avanzado'];
export const RINCON_CATEGORIES: RinconCategory[] = ['ataque', 'contraataque', 'defensa', 'combinado'];

// Cada X segundos se canta una combinación nueva durante el asalto.
export const FREQ_OPTIONS = [10, 15, 20, 30] as const;
export const REST_OPTIONS = [30, 45, 60, 90, 120] as const;
export const ROUND_MIN_OPTIONS = [1, 2, 3, 5, 10] as const;

export interface RinconCombo {
  id: string;
  /** Etiqueta libre (la teclea el usuario en los propios; en los de fábrica es
   *  la secuencia legible). Se muestra en la biblioteca y el resumen. */
  name: string;
  /** Notación: golpes separados por "-", p. ej. "1-2-3" o "Slip-2". */
  notation: string;
  sport: RinconSport;
  level: RinconLevel;
  category: RinconCategory;
  isCustom: boolean;
  /** Clave i18n del nombre legible (solo combos de fábrica). */
  nameKey?: string;
  createdAt?: number;
}

// ── Notación → texto que se canta ──
// Tokens que puede teclear el usuario en el pad (1-6, R, P, C) + los que usan
// algunos combos de fábrica (3H a la cabeza, 3B al cuerpo, Slip…). Cada token
// se traduce con la clave tm_rc_tok_<slug>.
export function tokenKey(token: string): string {
  const slug = token.trim().toLowerCase().replace(/\s+/g, '_');
  return `tm_rc_tok_${slug}`;
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

/** Golpes de una notación como lista de tokens ("1-2-3H" → ["1","2","3H"]). */
export function notationTokens(notation: string): string[] {
  return notation.split('-').map((s) => s.trim()).filter(Boolean);
}

/** Secuencia legible/cantable de un combo: "Jab, cruzado, gancho". */
export function comboSpeech(combo: Pick<RinconCombo, 'notation' | 'nameKey'>, t: TFn): string {
  if (combo.nameKey) return t(combo.nameKey);
  return notationTokens(combo.notation)
    .map((tok) => t(tokenKey(tok), { defaultValue: tok }))
    .join(', ');
}

// ── El pad para crear combos ──
export const PAD_NUMBERS = ['1', '2', '3', '4', '5', '6'] as const;
export const PAD_MT_KB = ['R', 'P', 'C'] as const;
/** Letras extra disponibles según el deporte elegido en el creador. */
export function padExtras(sport: RinconSport): readonly string[] {
  return sport === 'boxeo' ? [] : PAD_MT_KB;
}

// ── Combos de fábrica ──
// def.sports = en qué deportes aparece (muay thai y kickboxing comparten varios).
interface FactoryDef {
  key: string;
  notation: string;
  nameKey: string;
  level: RinconLevel;
  category: RinconCategory;
  sports: RinconSport[];
}

const FACTORY_DEFS: FactoryDef[] = [
  // ── Boxeo · principiante ──
  { key: 'bx_1_2', notation: '1-2', nameKey: 'tm_rc_c_1_2', level: 'principiante', category: 'ataque', sports: ['boxeo'] },
  { key: 'bx_11_2', notation: '1-1-2', nameKey: 'tm_rc_c_11_2', level: 'principiante', category: 'ataque', sports: ['boxeo'] },
  { key: 'bx_1_2_3', notation: '1-2-3', nameKey: 'tm_rc_c_1_2_3', level: 'principiante', category: 'ataque', sports: ['boxeo'] },
  { key: 'bx_1_2_3_2', notation: '1-2-3-2', nameKey: 'tm_rc_c_1_2_3_2', level: 'principiante', category: 'combinado', sports: ['boxeo'] },
  // ── Boxeo · intermedio ──
  { key: 'bx_1_2_5_2', notation: '1-2-5-2', nameKey: 'tm_rc_c_1_2_5_2', level: 'intermedio', category: 'ataque', sports: ['boxeo'] },
  { key: 'bx_2_3_2', notation: '2-3-2', nameKey: 'tm_rc_c_2_3_2', level: 'intermedio', category: 'ataque', sports: ['boxeo'] },
  { key: 'bx_1_6_3_2', notation: '1-6-3-2', nameKey: 'tm_rc_c_1_6_3_2', level: 'intermedio', category: 'combinado', sports: ['boxeo'] },
  { key: 'bx_slip_2', notation: 'Slip-2', nameKey: 'tm_rc_c_slip_2', level: 'intermedio', category: 'contraataque', sports: ['boxeo'] },
  // ── Boxeo · avanzado ──
  { key: 'bx_1_2_3h_slip_3b', notation: '1-2-3H-Slip-3B', nameKey: 'tm_rc_c_1_2_3h_slip_3b', level: 'avanzado', category: 'combinado', sports: ['boxeo'] },
  { key: 'bx_slipin_3_2_3', notation: 'Slip Inside-3-2-3', nameKey: 'tm_rc_c_slipin_3_2_3', level: 'avanzado', category: 'contraataque', sports: ['boxeo'] },
  { key: 'bx_5_6_2', notation: '5-6-2', nameKey: 'tm_rc_c_5_6_2', level: 'avanzado', category: 'ataque', sports: ['boxeo'] },
  // ── Muay Thai / Kickboxing · principiante ──
  { key: 'mtkb_1_2_p', notation: '1-2-P', nameKey: 'tm_rc_c_1_2_p', level: 'principiante', category: 'ataque', sports: ['muaythai', 'kickboxing'] },
  { key: 'mtkb_1_r', notation: '1-R', nameKey: 'tm_rc_c_1_r', level: 'principiante', category: 'ataque', sports: ['muaythai', 'kickboxing'] },
  { key: 'mtkb_2_3_p', notation: '2-3-P', nameKey: 'tm_rc_c_2_3_p', level: 'principiante', category: 'ataque', sports: ['muaythai', 'kickboxing'] },
  // ── Muay Thai / Kickboxing · intermedio / avanzado ──
  { key: 'mtkb_1_2_3_p_r', notation: '1-2-3-P-R', nameKey: 'tm_rc_c_1_2_3_p_r', level: 'intermedio', category: 'combinado', sports: ['muaythai', 'kickboxing'] },
  { key: 'mtkb_p_c_r', notation: 'P-C-R', nameKey: 'tm_rc_c_p_c_r', level: 'avanzado', category: 'combinado', sports: ['muaythai', 'kickboxing'] },
];

export const RINCON_FACTORY_COMBOS: RinconCombo[] = FACTORY_DEFS.flatMap((d) =>
  d.sports.map((sport) => ({
    id: `f_${sport}_${d.key}`,
    name: d.notation,
    notation: d.notation,
    sport,
    level: d.level,
    category: d.category,
    isCustom: false,
    nameKey: d.nameKey,
  })),
);

// ── Configuración de la sesión ──
export interface RinconConfig {
  sport: RinconSport;
  level: RinconLevel;
  roundSec: number;
  rounds: number;
  restSec: number;
  freqSec: number;
  /** ids de combos activos (fábrica + propios). Vacío = usa todos los del filtro. */
  comboIds: string[];
}

export const DEFAULT_RINCON_CONFIG: RinconConfig = {
  sport: 'boxeo',
  level: 'principiante',
  roundSec: 180,
  rounds: 3,
  restSec: 60,
  freqSec: 15,
  comboIds: [],
};

export interface RinconPreset extends RinconConfig {
  id: string;
  label: string;
}

// ── Persistencia local ──
const COMBOS_KEY = 'rankd_rincon_combos';
const PRESETS_KEY = 'rankd_rincon_presets';
const CONFIG_KEY = 'rankd_rincon_config';
const MODE_KEY = 'rankd_timer_mode';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* cuota llena */ }
}

export function loadCustomCombos(): RinconCombo[] {
  return readJSON<RinconCombo[]>(COMBOS_KEY, []).map((c) => ({ ...c, isCustom: true }));
}
export function saveCustomCombos(list: RinconCombo[]) {
  writeJSON(COMBOS_KEY, list.slice(0, 300));
}
export function loadRinconPresets(): RinconPreset[] {
  return readJSON<RinconPreset[]>(PRESETS_KEY, []);
}
export function saveRinconPresets(list: RinconPreset[]) {
  writeJSON(PRESETS_KEY, list.slice(0, 40));
}
export function loadRinconConfig(): RinconConfig {
  return { ...DEFAULT_RINCON_CONFIG, ...readJSON<Partial<RinconConfig>>(CONFIG_KEY, {}) };
}
export function saveRinconConfig(cfg: RinconConfig) {
  writeJSON(CONFIG_KEY, cfg);
}

export type TimerMode = 'classic' | 'rincon';
export function loadTimerMode(): TimerMode {
  return readJSON<TimerMode>(MODE_KEY, 'classic') === 'rincon' ? 'rincon' : 'classic';
}
export function saveTimerMode(mode: TimerMode) {
  writeJSON(MODE_KEY, mode);
}

export function rinconUid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Selección de combos para el asalto ──
/** Combos que entran en el sorteo: los marcados en config, o —si no hay
 *  ninguno— todos los del deporte y hasta el nivel elegidos. */
export function activeCombos(all: RinconCombo[], cfg: RinconConfig): RinconCombo[] {
  if (cfg.comboIds.length > 0) {
    const set = new Set(cfg.comboIds);
    return all.filter((c) => set.has(c.id));
  }
  const maxLevel = RINCON_LEVELS.indexOf(cfg.level);
  return all.filter((c) => c.sport === cfg.sport && RINCON_LEVELS.indexOf(c.level) <= maxLevel);
}

/** Elige un combo al azar distinto del anterior. */
export function pickNext(pool: RinconCombo[], prevId: string | null): RinconCombo | null {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  const options = prevId ? pool.filter((c) => c.id !== prevId) : pool;
  return options[Math.floor(Math.random() * options.length)] ?? pool[0];
}
