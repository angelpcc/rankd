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
    return {
      id: localId(),
      label: typeof s.label === 'string' && s.label.trim() ? s.label.trim().slice(0, 40) : undefined,
      seconds: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : 0,
      meters: Number.isFinite(meters) && meters > 0 ? Math.round(meters) : undefined,
      values,
      note: typeof s.note === 'string' && s.note.trim() ? s.note.trim().slice(0, 200) : undefined,
    } as ProtocolSegment;
  }).filter((s) => s.seconds > 0 || (s.meters || 0) > 0);
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
