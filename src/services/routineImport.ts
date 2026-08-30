// Servicio de importación de rutina desde foto (PROMPT 1 · parte B · tarea 8a).
//
// Habla con /api/coach (modo routinePhoto). La IA puede estar EN PAUSA: sin
// ANTHROPIC_API_KEY la sonda GET devuelve available=false y la UI enseña
// "disponible pronto" + entrada manual. Reusa la cuota de IA del servidor.

import { supabase } from '@/lib/supabase';

export interface ImportedPlanDay {
  day: string;
  training: string | null;
  cardio: string | null;
  nutrition: string | null;
  notes: string | null;
}
export interface ImportedPlanWeek { week: number; days: ImportedPlanDay[] }
export interface ImportedPlan {
  plan_name: string;
  summary: string;
  disclaimer: string;
  weeks: ImportedPlanWeek[];
}

export interface ImportResult {
  plan: ImportedPlan | null;
  error: string | null;
}

/** Sonda de disponibilidad (no gasta cuota). */
export async function checkRoutineImportAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/coach', { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.available;
  } catch {
    return false;
  }
}

/** Envía la imagen (base64 sin prefijo data:) y devuelve el plan estructurado. */
export async function analyzeRoutinePhoto(imageBase64: string, mediaType: string): Promise<ImportResult> {
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
        routinePhoto: { imageBase64, mediaType },
        messages: [{ role: 'user', content: 'Lee este plan de entrenamiento' }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.plan) {
      return { plan: null, error: data?.message || 'No se pudo leer la foto.' };
    }
    return { plan: data.plan as ImportedPlan, error: null };
  } catch {
    return { plan: null, error: 'Error de conexión. Inténtalo de nuevo.' };
  }
}
