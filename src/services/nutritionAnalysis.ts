// Servicio de análisis de foto de comida (PROMPT_1 · bloque 2).
//
// Habla con /api/coach (modo foodPhoto). La IA está EN PAUSA: sin
// ANTHROPIC_API_KEY la sonda GET devuelve available=false y la UI enseña
// "disponible pronto"; el análisis real solo se llama cuando está disponible.
// Reusa la cuota de IA del servidor (falla cerrado), no gasta sin control.

import { supabase } from '@/lib/supabase';

export interface FoodItem {
  nombre: string;
  gramos: number;
  calorias: number;
  proteina: number;
  carbohidratos: number;
  grasas: number;
}

export interface NutritionTotal {
  calorias: number;
  proteina: number;
  carbohidratos: number;
  grasas: number;
}

export interface NutritionAnalysis {
  alimentos: FoodItem[];
  total: NutritionTotal;
  disclaimer: string;
}

export interface AnalyzeResult {
  analysis: NutritionAnalysis | null;
  /** Mensaje de error listo para mostrar; null si fue bien. */
  error: string | null;
}

/** Sonda de disponibilidad (no gasta cuota). Igual patrón que SectionCoach. */
export async function checkPhotoAnalysisAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/coach', { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.available;
  } catch {
    return false;
  }
}

/** Envía la imagen (base64 sin prefijo data:) y devuelve la estimación de macros. */
export async function analyzeFoodPhoto(imageBase64: string, mediaType: string): Promise<AnalyzeResult> {
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
        section: 'nutrition',
        foodPhoto: { imageBase64, mediaType },
        // Mensaje de texto mínimo para pasar los checks previos del endpoint.
        messages: [{ role: 'user', content: 'Analiza esta comida' }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.analysis) {
      return { analysis: null, error: data?.message || 'No se pudo analizar la foto.' };
    }
    return { analysis: data.analysis as NutritionAnalysis, error: null };
  } catch {
    return { analysis: null, error: 'Error de conexión. Inténtalo de nuevo.' };
  }
}
