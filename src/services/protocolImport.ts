// Importar un PROTOCOLO de actividad desde un texto o una foto (punto 16).
//
// Habla con /api/coach (modo `protocolText`). La IA puede estar EN PAUSA: sin
// ANTHROPIC_API_KEY la sonda GET devuelve available=false. Cuando eso pasa NO
// se queda uno sin importar: `parseProtocolText` (lib/protocols.ts) lee las
// tablas de cardio habituales sin salir del navegador, y la pantalla ofrece esa
// vía. El Asesor es el atajo cómodo, no el requisito.
//
// Reusa la cuota de IA del servidor, como el resto de modos estructurados.

import { supabase } from '@/lib/supabase';
import { localId, protocolVarsFor, VAR_DEFS, type ProtocolSegment, type ProtocolVarId } from '@/pages/mi-esquina/lib/protocols';

export interface ImportedProtocol {
  name: string;
  kind: string;
  segments: ProtocolSegment[];
  note?: string;
}

export interface ProtocolImportResult {
  protocol: ImportedProtocol | null;
  error: string | null;
}

/** Sonda de disponibilidad (no gasta cuota). */
export async function checkProtocolImportAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/coach', { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.available;
  } catch {
    return false;
  }
}

/**
 * Lo que devuelve el modelo viene con las variables por NOMBRE y las
 * duraciones en minutos, que es como está escrito el documento original. Aquí
 * se normaliza a lo que guarda la app (segundos + claves internas) y se tira
 * todo lo que no sea una variable del tipo de actividad elegido: si alguien
 * importa una tabla de cinta como "natación", los km/h no pintan nada.
 */
function normalizeSegments(raw: unknown, kind: string): ProtocolSegment[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(protocolVarsFor(kind).map((v) => v.id));

  return raw.slice(0, 60).map((item) => {
    const s = (item || {}) as Record<string, unknown>;
    const values: Partial<Record<ProtocolVarId, number>> = {};
    const rawValues = (s.values || {}) as Record<string, unknown>;

    (Object.keys(rawValues) as ProtocolVarId[]).forEach((k) => {
      if (!allowed.has(k)) return;
      const def = VAR_DEFS[k];
      if (!def) return;
      // El esquema permite null en cada variable (un tramo de cinta no tiene
      // cadencia). `Number(null)` es 0, que sí es finito: sin este descarte
      // explícito, "sin dato" se guardaría como un 0 que parecería real.
      const raw = rawValues[k];
      if (raw === null || raw === undefined || raw === '') return;
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      values[k] = Math.min(def.max, Math.max(def.min, n));
    });

    const minutes = Number(s.minutes);
    const meters = Number(s.meters);
    const reps = Math.round(Number(s.reps));
    return {
      id: localId(),
      label: typeof s.label === 'string' && s.label.trim() ? s.label.trim().slice(0, 60) : undefined,
      seconds: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : 0,
      meters: Number.isFinite(meters) && meters > 0 ? Math.round(meters) : undefined,
      // Una estación ("30 wall balls") se hace y se pulsa "Hecho": sin las reps
      // el reproductor la contaba como un minuto y medio y saltaba sola.
      ...(Number.isFinite(reps) && reps > 0 ? { reps: Math.min(reps, 5000) } : {}),
      values,
      note: typeof s.note === 'string' && s.note.trim() ? s.note.trim().slice(0, 200) : undefined,
    } as ProtocolSegment;
  }).filter((s) => s.seconds > 0 || (s.meters || 0) > 0 || (s.reps || 0) > 0);
}

interface Payload {
  /** Texto pegado por el usuario (el contenido de su PDF, un mensaje…). */
  text?: string;
  /** Foto del documento, en base64 SIN el prefijo data:. */
  imageBase64?: string;
  mediaType?: string;
  /** Tipo de actividad al que pertenece el protocolo. */
  kind: string;
}

export interface CardioDesignRequest {
  /** Tipo de actividad: cinta, correr, bici… Manda qué variables tienen sentido. */
  kind: string;
  /** Minutos totales. El guion tiene que sumar exactamente esto. */
  minutes: number;
  /** Lo que se busca, en palabras. Sale de la nota del plan. */
  intent?: string;
  /** El perfil del peleador, para que los números vayan a su nivel. */
  profile?: Record<string, unknown>;
}

/**
 * Escribe el guion minuto a minuto de un cardio que todavía no lo tiene.
 *
 * Es el gemelo de `importProtocol`: mismo esquema y misma normalización, pero
 * en vez de transcribir una tabla que ya existe, la escribe. Hace falta porque
 * un cardio que viene del plan llega como "cinta, 45 min" y una frase — el
 * esquema del plan no tiene sitio para los tramos — y con eso no se puede ni
 * seguir la sesión ni marcarla como hecha.
 *
 * Se llama cuando se va a HACER ese cardio, no al guardar el plan: un plan de
 * dos semanas trae diez cardios y pagar por los diez para usar uno es tirar el
 * saldo. Lo que sale se guarda como protocolo y ya no se vuelve a pagar.
 */
export async function designCardio(req: CardioDesignRequest): Promise<ProtocolImportResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        section: 'training',
        // El perfil va en la RAÍZ del cuerpo, que es donde lo lee el servidor.
        profile: req.profile,
        cardioDesign: {
          kind: req.kind,
          minutes: req.minutes,
          intent: req.intent,
          variables: protocolVarsFor(req.kind).map((v) => v.id),
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.protocol) {
      return { protocol: null, error: data?.message || null };
    }

    const segments = normalizeSegments(data.protocol.segments, req.kind);
    if (segments.length === 0) return { protocol: null, error: null };

    return {
      protocol: {
        name: String(data.protocol.name || '').trim().slice(0, 120) || 'Cardio',
        kind: req.kind,
        segments,
        note: typeof data.protocol.note === 'string' ? data.protocol.note.slice(0, 400) : undefined,
      },
      error: null,
    };
  } catch {
    return { protocol: null, error: null };
  }
}

/** Manda el texto o la foto y devuelve el protocolo ya estructurado. */
export async function importProtocol(payload: Payload): Promise<ProtocolImportResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        section: 'training',
        protocolText: {
          kind: payload.kind,
          text: payload.text,
          imageBase64: payload.imageBase64,
          mediaType: payload.mediaType,
          // Se le dice al modelo qué variables admite ESTE tipo, para que no
          // invente campos que la app luego tiraría.
          variables: protocolVarsFor(payload.kind).map((v) => v.id),
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.protocol) {
      return { protocol: null, error: data?.message || null };
    }

    const segments = normalizeSegments(data.protocol.segments, payload.kind);
    if (segments.length === 0) {
      return { protocol: null, error: null };
    }

    return {
      protocol: {
        name: String(data.protocol.name || '').trim().slice(0, 120) || 'Protocolo',
        kind: payload.kind,
        segments,
        note: typeof data.protocol.note === 'string' ? data.protocol.note.slice(0, 400) : undefined,
      },
      error: null,
    };
  } catch {
    return { protocol: null, error: null };
  }
}
