// ════════════════════════════════════════════════════════════════
// RANKD · Generar un entreno de boxeo por asaltos (punto 28)
//
// Le dices cuánto tiempo tienes y dónde entrenas, y sale la sesión entera:
// calentamiento, N asaltos con su guion, descansos y vuelta a la calma, cuadrada
// con ese tiempo.
//
// ── LOS DOS DATOS QUE NO SE SUPONEN ──
//
// MINUTOS y SITIO. El primero porque es el límite duro: sin él, "prepárame algo
// de boxeo" sale de 40 minutos o de 90 y acierta por casualidad. El segundo
// porque cambia el contenido entero — sin saco todo es sombra y desplazamientos;
// con saco y material se estructura de otra forma. El punto 28 pide
// explícitamente que se PREGUNTE en vez de asumirlo, y por eso los dos son
// obligatorios en la llamada: no hay valor por defecto que colar.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { emptyBoxingSession, type BoxingPlace, type BoxingSession } from '@/pages/mi-esquina/lib/boxing';
import type { AgendaDia } from '@/pages/mi-esquina/lib/agendaSnapshot';

export interface BoxingRequest {
  /** Minutos disponibles. Es un límite, no una sugerencia. */
  minutes: number;
  place: BoxingPlace;
  /** Lo que el usuario haya añadido: lesiones, en qué quiere incidir… */
  notes?: string;
  /** Perfil del peleador, para ajustar el nivel de exigencia. */
  profile?: Record<string, unknown>;
  /**
   * Lo que tiene puesto estos días.
   *
   * Para no doblar carga sin querer: si ayer hubo pierna dura, el trabajo de
   * desplazamientos y de piernas de la sesión baja. Sin esto, el generador
   * montaba siempre la misma sesión al margen de la semana que lleves.
   */
  agenda?: AgendaDia[];
}

export interface BoxingResult {
  session: BoxingSession | null;
  error: string | null;
}

/** Sonda de disponibilidad (no gasta cuota). */
export async function checkBoxingAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/coach', { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return !!data?.available;
  } catch { return false; }
}

interface RawRound { round?: number; title?: string; work?: string }
interface RawSession {
  name?: string;
  rounds?: number;
  round_sec?: number;
  rest_sec?: number;
  warmup_min?: number;
  cooldown_min?: number;
  note?: string;
  script?: RawRound[];
}

/** Entero dentro de un rango. Lo que venga fuera se recorta, no se rechaza. */
function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Pasa lo que devuelve el modelo al modelo de la app.
 *
 * Se recorta a rangos sensatos en vez de confiar: un `rounds: 40` o un
 * `round_sec: 5` colarían un entreno imposible y, peor, una configuración
 * absurda al temporizador. El esquema JSON ya los acota en el servidor; esto es
 * la segunda red, por si un día se cambia el esquema y se olvida esto.
 */
function normalize(raw: RawSession, place: BoxingPlace): BoxingSession | null {
  const script = (raw.script || [])
    .map((r, i) => ({
      round: clamp(r.round, 1, 24, i + 1),
      title: String(r.title || '').trim().slice(0, 60),
      work: String(r.work || '').trim().slice(0, 400),
    }))
    .filter((r) => r.title || r.work);
  if (script.length === 0) return null;

  // Manda el guion, no el número suelto: si el modelo dice 8 asaltos pero solo
  // escribe 6, el temporizador contaría dos asaltos mudos.
  const rounds = clamp(raw.rounds, 1, 24, script.length);
  const reales = Math.min(rounds, script.length);

  const base = emptyBoxingSession(String(raw.name || '').trim().slice(0, 120));
  return {
    ...base,
    place,
    rounds: reales,
    roundSec: clamp(raw.round_sec, 30, 900, 180),
    restSec: clamp(raw.rest_sec, 0, 600, 60),
    warmupMin: clamp(raw.warmup_min, 0, 60, 10),
    cooldownMin: clamp(raw.cooldown_min, 0, 60, 5),
    script: script.slice(0, reales),
    note: String(raw.note || '').trim().slice(0, 600) || undefined,
    source: 'advisor',
  };
}

export async function generateBoxingSession(req: BoxingRequest): Promise<BoxingResult> {
  const { data: { session: auth } } = await supabase.auth.getSession();
  const token = auth?.access_token;
  if (!token) return { session: null, error: 'auth' };

  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        boxingSession: {
          minutes: req.minutes,
          place: req.place,
          notes: req.notes || '',
        },
        // El perfil va en la raíz del cuerpo, que es donde lo lee el servidor.
        // Meterlo dentro de `boxingSession` lo dejaría fuera en silencio y la
        // sesión saldría sin personalizar — el mismo fallo que ya hubo en el
        // plan semanal. (Y durante un tiempo llegaba bien pero el prompt de
        // boxeo ni siquiera lo recibía, que es la otra mitad del mismo fallo.)
        profile: req.profile || {},
        agenda: req.agenda && req.agenda.length ? req.agenda : undefined,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { session: null, error: data?.message || 'error' };
    }
    const session = normalize((data?.session || {}) as RawSession, req.place);
    if (!session) return { session: null, error: data?.message || 'no_boxing' };
    return { session, error: null };
  } catch {
    return { session: null, error: 'network' };
  }
}
