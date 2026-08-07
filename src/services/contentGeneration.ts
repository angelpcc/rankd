// Servicio cliente de Creator Studio: genera guiones de vídeo, copys de
// publicación y mensajes con IA. Mismo patrón que services/nutritionAnalysis.ts
// — sonda GET sin gastar cuota, POST con el token de sesión, nunca lanza
// (siempre devuelve {data, error}). Habla con /api/coach (modo creatorStudio),
// reutilizando su control de cuota y su registro de coste en ai_usage.
//
// La IA está en pausa hasta que haya ANTHROPIC_API_KEY en el servidor: hasta
// entonces la sonda devuelve available=false y la UI debe mostrar "disponible
// pronto" (mismo patrón que FoodPhotoAnalyzer).

import { supabase } from '@/lib/supabase';

export interface VideoScene {
  startTime: number;
  endTime: number;
  action: string;
  ui: string;
  text: string;
  transition: string;
  notes: string;
}

export interface GeneratedVideoScript {
  title: string;
  scenes: VideoScene[];
  caption: string;
  hashtags: string[];
  musicSuggestion: string;
  cta: string;
}

export interface GeneratedPublication {
  headline: string;
  body: string;
  cta: string;
  hashtags: string[];
  emoji: string;
}

export interface GeneratedMessage {
  subject: string | null;
  body: string;
  cta: string;
  tone: string;
  alternatives: string[];
}

export interface VideoScriptInput {
  prompt: string;
  platform: 'reels' | 'tiktok' | 'shorts' | 'facebook' | 'custom';
  duration: 15 | 30 | 60;
  includeText: boolean;
  includeSubtitles: boolean;
  includeMusic: boolean;
  includeCta: boolean;
}

export interface PublicationInput {
  prompt: string;
  format: 'post' | 'carousel' | 'story' | 'square' | 'horizontal' | 'custom';
  platforms: string[];
  tone: 'profesional' | 'casual' | 'motivador' | 'tecnico' | 'urgente';
  includeHashtags: boolean;
  includeEmoji: boolean;
  includeCta: boolean;
  includeMentions: boolean;
}

export interface MessageInput {
  goal: string;
  recipientType: 'fighter' | 'organization' | 'brand' | 'gym' | 'coach' | 'collaborator' | 'sponsor' | 'other';
  channel: 'email' | 'whatsapp' | 'instagram' | 'linkedin' | 'sms' | 'other';
  context: string;
  receivedMessage: string;
  tone: 'formal' | 'casual' | 'urgente' | 'motivador' | 'tecnico';
}

interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

/** Sonda de disponibilidad (no gasta cuota). Igual patrón que nutritionAnalysis. */
export async function checkContentGenerationAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/coach', { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.available;
  } catch {
    return false;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function callCreatorStudio<T>(payload: Record<string, unknown>): Promise<ServiceResult<T>> {
  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ creatorStudio: payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.content) {
      return { data: null, error: data?.message || 'No se pudo generar el contenido.' };
    }
    return { data: data.content as T, error: null };
  } catch {
    return { data: null, error: 'Error de conexión. Inténtalo de nuevo.' };
  }
}

export function generateVideoScript(input: VideoScriptInput) {
  return callCreatorStudio<GeneratedVideoScript>({ kind: 'videoScript', ...input });
}

export function generatePublication(input: PublicationInput) {
  return callCreatorStudio<GeneratedPublication>({ kind: 'publication', ...input });
}

export function generateMessage(input: MessageInput) {
  return callCreatorStudio<GeneratedMessage>({ kind: 'message', ...input });
}

/** Genera una alternativa a un contenido ya existente (de cualquier tipo). */
export function generateVariation<T>(type: 'video' | 'publication' | 'message', original: unknown, variationType?: string) {
  return callCreatorStudio<T>({ kind: 'variation', type, original, variationType: variationType || 'general' });
}
