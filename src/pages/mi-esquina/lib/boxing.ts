// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · Entreno de boxeo por asaltos (punto 28)
//
// El equivalente al protocolo de cardio, pero para boxeo: en vez de tramos
// minuto a minuto, ASALTOS. Le dices el tiempo que tienes y sale una sesión
// entera —calentamiento, N asaltos con su guion, descansos, vuelta a la calma—
// que cuadra con ese tiempo.
//
// ── LA PIEZA QUE LO HACE ÚTIL: `toTimerConfig` ──
//
// La app ya tiene un temporizador de asaltos muy completo. Lo que faltaba era
// que una sesión generada pudiera ARRANCARLO SOLA, con sus rounds, su duración
// y sus descansos ya puestos. Por eso la sesión guarda exactamente los campos
// que espera `TimerConfig`, y el guion de cada asalto viaja como `combos[i]`,
// que es el hueco que el temporizador ya usa para decir qué toca en cada uno.
//
// Sin eso, "te genero 8 asaltos de 2 minutos" obliga a ir al temporizador y
// teclear 8, 2:00 y 1:00 a mano — y entonces la sesión generada no vale de
// nada, es un texto bonito.
//
// ── EL SITIO IMPORTA ──
//
// `place` no es un adorno: sin saco, un asalto es sombra y desplazamientos; con
// saco y material se estructura de otra forma. Es la razón de que el Asesor lo
// pregunte en vez de suponerlo (lo pide el punto 28 explícitamente).
//
// Degradación: si la migración 0057 no está aplicada, todo cae a localStorage,
// igual que rutinas y protocolos. La función sigue existiendo.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { DEFAULT_BURST, type RoundCombo, type TimerConfig } from '@/pages/timer/lib/session';

/** Dónde se entrena. Cambia el contenido de los asaltos, no solo el material. */
export type BoxingPlace = 'home' | 'home_bag' | 'gym';

/**
 * Los tres sitios donde se puede entrenar, con su icono y sus textos.
 *
 * Aquí y no en la pantalla porque lo pregunta más de una: el estudio de boxeo
 * y el lanzador de sesiones del día. Con la lista duplicada, añadir un sitio en
 * una y olvidarlo en la otra es cuestión de tiempo.
 */
export const BOXING_PLACES: { v: BoxingPlace; icon: string; label: string; hint: string }[] = [
  { v: 'home', icon: 'ri-home-4-line', label: 'mc_bx_place_home', hint: 'mc_bx_place_home_hint' },
  { v: 'home_bag', icon: 'ri-home-gear-line', label: 'mc_bx_place_home_bag', hint: 'mc_bx_place_home_bag_hint' },
  { v: 'gym', icon: 'ri-boxing-line', label: 'mc_bx_place_gym', hint: 'mc_bx_place_gym_hint' },
];

/** El guion de un asalto. `work` es lo que se hace; `title` lo resume. */
export interface BoxingRound {
  round: number;
  title: string;
  work: string;
}

export interface BoxingSession {
  id: string;
  name: string;
  place: BoxingPlace;
  rounds: number;
  roundSec: number;
  restSec: number;
  prepSec: number;
  warnSec: number;
  warmupMin: number;
  cooldownMin: number;
  script: BoxingRound[];
  note?: string;
  source: 'manual' | 'advisor' | 'import';
  createdAt: string;
  lastUsedAt?: string | null;
}

const LS_KEY = 'rk_boxing_sessions';
const localId = (): string => `bx_${Math.random().toString(36).slice(2, 10)}`;

export function emptyBoxingSession(name = ''): BoxingSession {
  return {
    id: localId(), name, place: 'home',
    rounds: 6, roundSec: 180, restSec: 60, prepSec: 10, warnSec: 10,
    warmupMin: 10, cooldownMin: 5,
    script: [], source: 'manual', createdAt: new Date().toISOString(),
  };
}

// ── Totales ────────────────────────────────────────────────────

/**
 * Minutos totales de la sesión, calentamiento y vuelta a la calma incluidos.
 *
 * El último descanso NO cuenta: después del último asalto no se descansa, se
 * termina. Contarlo hacía que una sesión de "1 hora" pidiera 61 minutos, y ese
 * minuto de más es justo el que descuadra el encaje con el tiempo disponible.
 */
export function boxingTotalMin(s: BoxingSession): number {
  const trabajo = s.rounds * s.roundSec;
  const descansos = Math.max(0, s.rounds - 1) * s.restSec;
  return s.warmupMin + s.cooldownMin + Math.round((trabajo + descansos + s.prepSec) / 60);
}

/** Formato m:ss para una duración en segundos. */
export function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;
}

/** "6 × 3:00 · 1:00 descanso" — la línea que resume una sesión de un vistazo. */
export function boxingSummary(s: BoxingSession): string {
  return `${s.rounds} × ${mmss(s.roundSec)} · ${mmss(s.restSec)}`;
}

// ── El puente con el temporizador del Ring ─────────────────────

/**
 * Convierte la sesión en la configuración exacta del temporizador.
 *
 * El guion de cada asalto se mete en `combos` como texto propio: es el hueco
 * que el temporizador ya tiene para ir diciendo qué toca, así que no hace falta
 * tocar el motor del cronómetro para que esto funcione.
 *
 * Las explosiones (burst) se dejan apagadas: son un recurso de preparación
 * física que el usuario activa si quiere, y encenderlas por nuestra cuenta
 * cambiaría el entreno que el Asesor ha calculado.
 */
export function toTimerConfig(s: BoxingSession): TimerConfig {
  const combos: RoundCombo[] = Array.from({ length: s.rounds }, (_, i) => {
    const r = s.script.find((x) => x.round === i + 1);
    if (!r) return null;
    const texto = [r.title, r.work].filter(Boolean).join(' — ');
    return texto ? { kind: 'custom', text: texto } : null;
  });

  return {
    rounds: s.rounds,
    roundSec: s.roundSec,
    restSec: s.restSec,
    prepSec: s.prepSec,
    warnSec: s.warnSec,
    burst: { ...DEFAULT_BURST },
    combos,
  };
}

// ── Persistencia ───────────────────────────────────────────────

function readLocal(profileId: string): BoxingSession[] {
  try {
    const raw = localStorage.getItem(`${LS_KEY}_${profileId}`);
    return raw ? (JSON.parse(raw) as BoxingSession[]) : [];
  } catch { return []; }
}

function writeLocal(profileId: string, list: BoxingSession[]): void {
  try { localStorage.setItem(`${LS_KEY}_${profileId}`, JSON.stringify(list)); } catch { /* lleno o bloqueado */ }
}

interface Row {
  id: string; name: string; place: string;
  rounds: number; round_sec: number; rest_sec: number; prep_sec: number; warn_sec: number;
  warmup_min: number; cooldown_min: number;
  rounds_json: BoxingRound[] | null; note: string | null; source: string;
  created_at: string; last_used_at: string | null;
}

function fromRow(r: Row): BoxingSession {
  return {
    id: r.id, name: r.name,
    place: (['gym', 'home_bag', 'home'].includes(r.place) ? r.place : 'home') as BoxingPlace,
    rounds: r.rounds, roundSec: r.round_sec, restSec: r.rest_sec,
    prepSec: r.prep_sec, warnSec: r.warn_sec,
    warmupMin: r.warmup_min, cooldownMin: r.cooldown_min,
    script: Array.isArray(r.rounds_json) ? r.rounds_json : [],
    note: r.note || undefined,
    source: (r.source as BoxingSession['source']) || 'manual',
    createdAt: r.created_at, lastUsedAt: r.last_used_at,
  };
}

export async function loadBoxingSessions(profileId: string): Promise<{ sessions: BoxingSession[]; storedLocally: boolean }> {
  const { data, error } = await supabase.from('boxing_sessions')
    .select('*').eq('fighter_profile_id', profileId)
    .order('created_at', { ascending: false });
  if (!error) return { sessions: ((data || []) as Row[]).map(fromRow), storedLocally: false };
  return { sessions: readLocal(profileId), storedLocally: true };
}

export async function loadBoxingById(profileId: string, id: string): Promise<BoxingSession | null> {
  if (!id.startsWith('bx_')) {
    const { data, error } = await supabase.from('boxing_sessions')
      .select('*').eq('fighter_profile_id', profileId).eq('id', id).maybeSingle();
    if (!error && data) return fromRow(data as Row);
  }
  return readLocal(profileId).find((s) => s.id === id) || null;
}

export async function saveBoxingSession(
  profileId: string,
  s: BoxingSession,
): Promise<{ session: BoxingSession; storedLocally: boolean }> {
  const payload = {
    fighter_profile_id: profileId,
    name: s.name.trim().slice(0, 120) || 'Boxeo',
    place: s.place,
    rounds: s.rounds, round_sec: s.roundSec, rest_sec: s.restSec,
    prep_sec: s.prepSec, warn_sec: s.warnSec,
    warmup_min: s.warmupMin, cooldown_min: s.cooldownMin,
    rounds_json: s.script,
    note: s.note?.trim() || null,
    source: s.source,
    updated_at: new Date().toISOString(),
  };
  // Un id local ("bx_…") nunca existe en la base: siempre es alta.
  const esLocal = s.id.startsWith('bx_');
  const res = esLocal
    ? await supabase.from('boxing_sessions').insert(payload).select().maybeSingle()
    : await supabase.from('boxing_sessions').update(payload).eq('id', s.id).select().maybeSingle();

  if (!res.error && res.data) {
    const guardada = fromRow(res.data as Row);
    // Si existía una copia local del mismo entreno, se retira: ya vive arriba.
    writeLocal(profileId, readLocal(profileId).filter((x) => x.id !== s.id));
    return { session: guardada, storedLocally: false };
  }

  const list = readLocal(profileId);
  const i = list.findIndex((x) => x.id === s.id);
  if (i >= 0) list[i] = s; else list.unshift(s);
  writeLocal(profileId, list);
  return { session: s, storedLocally: true };
}

export async function deleteBoxingSession(profileId: string, id: string): Promise<void> {
  if (!id.startsWith('bx_')) {
    const { error } = await supabase.from('boxing_sessions').delete().eq('id', id);
    // Si la tabla no existe, la copia local es la única que había: se sigue.
    // Con cualquier otro error se LANZA: antes volvía en silencio y la pantalla
    // decía "borrado" de un entreno que seguía en la base.
    if (error && !isMissingTable(error)) throw error;
  }
  writeLocal(profileId, readLocal(profileId).filter((s) => s.id !== id));
}

/** Marca que se acaba de lanzar. Best-effort: fallar aquí no rompe nada. */
export async function touchBoxingSession(profileId: string, id: string): Promise<void> {
  if (id.startsWith('bx_')) return;
  try {
    await supabase.from('boxing_sessions')
      .update({ last_used_at: new Date().toISOString() }).eq('id', id);
  } catch { /* da igual: es solo para ordenar por uso reciente */ }
}
