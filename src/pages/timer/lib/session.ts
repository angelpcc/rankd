// Modelo de la sesión de temporizador: configuración, calendario calculado
// (asaltos + descansos + ventanas de explosión) y persistencia local de
// preajustes favoritos y combinaciones propias del usuario.

export type Discipline = 'boxing' | 'mma' | 'kickboxing' | 'muay_thai';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Focus = 'attack' | 'counter' | 'defense' | 'body' | 'footwork' | 'exits';

// Cambios de ritmo dentro del asalto (preparación física).
export interface BurstConfig {
  enabled: boolean;
  count: number;        // explosiones por asalto
  durationSec: number;  // duración de cada explosión
  mode: 'fixed' | 'random';
}

// Combinación asignada a un asalto. Puede venir de la biblioteca (por id),
// ser propia/generada por IA (texto libre) o no haber ninguna (asalto libre).
export type RoundCombo =
  | { kind: 'library'; comboId: string }
  | { kind: 'custom'; text: string; moves?: string[] }
  | null;

export interface TimerConfig {
  rounds: number;
  roundSec: number;
  restSec: number;
  prepSec: number;
  warnSec: number;      // aviso de últimos segundos del asalto
  burst: BurstConfig;
  combos: RoundCombo[]; // una entrada por asalto (índice 0 = asalto 1)
}

export interface Preset {
  id: string;
  label: string;
  rounds: number;
  roundSec: number;
  restSec: number;
  warnSec: number;
  burst: BurstConfig;
}

// Combinación propia guardada por el usuario (biblioteca personal).
export interface CustomCombo {
  id: string;
  moves: string[];      // claves de golpe (ver combos.ts) o texto suelto
  discipline: Discipline;
  focus: Focus[];
  createdAt: number;
}

export type SegmentType = 'prep' | 'round' | 'rest';

export interface BurstWindow {
  startSec: number;     // relativo al inicio del asalto
  endSec: number;
}

export interface Segment {
  type: SegmentType;
  round: number;        // nº de asalto (1..N); 0 en la preparación
  durationSec: number;
  startAt: number;      // segundos absolutos desde el inicio de la sesión
  bursts: BurstWindow[];
}

export const DEFAULT_BURST: BurstConfig = {
  enabled: false, count: 4, durationSec: 15, mode: 'random',
};

export const DEFAULT_CONFIG: TimerConfig = {
  rounds: 3, roundSec: 180, restSec: 60, prepSec: 10, warnSec: 10,
  burst: { ...DEFAULT_BURST }, combos: [],
};

// Preajustes de fábrica: puntos de partida realistas por disciplina.
export const FACTORY_PRESETS: Omit<Preset, 'id'>[] = [
  { label: 'Boxeo amateur', rounds: 3, roundSec: 180, restSec: 60, warnSec: 10, burst: { ...DEFAULT_BURST } },
  { label: 'Boxeo pro', rounds: 12, roundSec: 180, restSec: 60, warnSec: 10, burst: { ...DEFAULT_BURST } },
  { label: 'MMA', rounds: 3, roundSec: 300, restSec: 60, warnSec: 10, burst: { ...DEFAULT_BURST } },
  { label: 'Muay Thai', rounds: 5, roundSec: 180, restSec: 120, warnSec: 10, burst: { ...DEFAULT_BURST } },
  { label: 'HIIT / Saco', rounds: 6, roundSec: 120, restSec: 30, warnSec: 5, burst: { enabled: true, count: 6, durationSec: 15, mode: 'random' } },
];

// ── Cálculo de ventanas de explosión de un asalto ──
// Se calcula UNA vez al arrancar la sesión, de modo que el modo aleatorio
// queda fijado y el motor solo tiene que leer las ventanas.
export function buildBurstWindows(roundSec: number, cfg: BurstConfig): BurstWindow[] {
  if (!cfg.enabled || cfg.count <= 0 || cfg.durationSec <= 0) return [];
  const dur = Math.min(cfg.durationSec, Math.max(2, Math.floor(roundSec / 2)));
  // Dejamos un margen al principio (arranque) y al final (para no solaparse
  // con la campana ni con el aviso de últimos segundos).
  const head = Math.min(5, Math.floor(roundSec * 0.08));
  const tail = Math.min(5, Math.floor(roundSec * 0.08));
  const usable = roundSec - head - tail;
  const maxFit = Math.floor(usable / (dur + 2)); // +2s de separación mínima
  const n = Math.max(0, Math.min(cfg.count, maxFit));
  if (n === 0) return [];

  if (cfg.mode === 'fixed') {
    // Repartidas de forma uniforme por el asalto.
    const gap = usable / n;
    const windows: BurstWindow[] = [];
    for (let i = 0; i < n; i++) {
      const center = head + gap * (i + 0.5);
      let start = Math.round(center - dur / 2);
      start = Math.max(head, Math.min(start, roundSec - tail - dur));
      windows.push({ startSec: start, endSec: start + dur });
    }
    return windows;
  }

  // Aleatorio: posiciones al azar sin solaparse, obliga a estar atento.
  const slots: number[] = [];
  let guard = 0;
  while (slots.length < n && guard < 400) {
    guard++;
    const start = head + Math.floor(Math.random() * (usable - dur + 1));
    const ok = slots.every((s) => Math.abs(s - start) >= dur + 2);
    if (ok) slots.push(start);
  }
  slots.sort((a, b) => a - b);
  return slots.map((s) => ({ startSec: s, endSec: s + dur }));
}

// ── Construye el calendario completo de la sesión ──
export function buildSchedule(cfg: TimerConfig): Segment[] {
  const segs: Segment[] = [];
  let clock = 0;
  const push = (type: SegmentType, round: number, durationSec: number, bursts: BurstWindow[]) => {
    segs.push({ type, round, durationSec, startAt: clock, bursts });
    clock += durationSec;
  };
  if (cfg.prepSec > 0) push('prep', 0, cfg.prepSec, []);
  for (let r = 1; r <= cfg.rounds; r++) {
    push('round', r, cfg.roundSec, buildBurstWindows(cfg.roundSec, cfg.burst));
    if (r < cfg.rounds && cfg.restSec > 0) push('rest', r, cfg.restSec, []);
  }
  return segs;
}

export function totalWorkSeconds(cfg: TimerConfig): number {
  return cfg.rounds * cfg.roundSec;
}

export function totalSessionSeconds(cfg: TimerConfig): number {
  return buildSchedule(cfg).reduce((a, s) => a + s.durationSec, 0);
}

export function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtLong(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

// ── Persistencia local (preajustes y combinaciones propias) ──
const PRESETS_KEY = 'rankd_timer_presets';
const CUSTOM_KEY = 'rankd_timer_combos';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

export function loadPresets(): Preset[] {
  return readJSON<Preset[]>(PRESETS_KEY, []);
}
export function savePresets(list: Preset[]) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list.slice(0, 40))); } catch { /* cuota llena */ }
}

export function loadCustomCombos(): CustomCombo[] {
  return readJSON<CustomCombo[]>(CUSTOM_KEY, []);
}
export function saveCustomCombos(list: CustomCombo[]) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list.slice(0, 200))); } catch { /* cuota llena */ }
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
