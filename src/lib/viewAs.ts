// ════════════════════════════════════════════════════════════════
// RANKD · Modo "Ver como" (solo administradores)
//
// Permite al administrador recorrer la plataforma con la piel de otro tipo
// de perfil para revisar que todo se vea y funcione bien.
//
// PRINCIPIO DE SEGURIDAD: la sesión real NUNCA se sustituye. Seguimos
// autenticados como administrador; lo único que cambia es el perfil que la
// interfaz usa para decidir qué pintar. Como el JWT sigue siendo el del
// admin, las políticas RLS de Supabase impiden por sí solas escribir en
// nombre de otro usuario — y encima bloqueamos toda escritura en el cliente
// (ver guardWrites en lib/supabase.ts).
//
// Se guarda en sessionStorage a propósito: el modo muere al cerrar la
// pestaña, así no queda "pegado" de un día para otro.
// ════════════════════════════════════════════════════════════════

import type { UserType } from '@/lib/supabase';

const KEY = 'rankd_view_as';
export const VIEW_AS_EVENT = 'rankd:viewas';
export const VIEW_AS_BLOCKED_EVENT = 'rankd:viewas-blocked';

export interface ViewAsState {
  /** 'type' = perfil sintético para revisar la interfaz; 'user' = un usuario real */
  kind: 'type' | 'user';
  /** null = visitante sin cuenta */
  userType: UserType | null;
  athleteMode: 'competitor' | 'hobby' | null;
  /** Solo en kind 'user': el id real del perfil que se está viendo */
  profileId?: string;
  /** Nombre a mostrar en la barra */
  label: string;
  avatarUrl?: string | null;
}

let cached: ViewAsState | null | undefined;

/** Estado actual del modo vista, o null si no está activo. */
export function getViewAs(): ViewAsState | null {
  if (cached !== undefined) return cached;
  try {
    const raw = sessionStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as ViewAsState) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function isViewingAs(): boolean {
  return getViewAs() !== null;
}

function emit() {
  window.dispatchEvent(new CustomEvent(VIEW_AS_EVENT));
}

export function setViewAs(state: ViewAsState) {
  cached = state;
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* modo privado */ }
  emit();
}

export function clearViewAs() {
  cached = null;
  try { sessionStorage.removeItem(KEY); } catch { /* nada que hacer */ }
  emit();
}

/**
 * Avisa a la barra de que se ha intentado una acción que el modo vista bloquea.
 * La barra escucha este evento y muestra el aviso, así no hay que tocar cada
 * botón de la plataforma uno por uno.
 */
export function notifyBlocked(what?: string) {
  window.dispatchEvent(new CustomEvent(VIEW_AS_BLOCKED_EVENT, { detail: what }));
}

/** Perfiles sintéticos que se pueden revisar sin elegir un usuario real. */
export const VIEW_AS_PRESETS: {
  id: string;
  userType: UserType | null;
  athleteMode: 'competitor' | 'hobby' | null;
  labelKey: string;
  descKey: string;
  icon: string;
  color: string;
  /** A dónde llevar al entrar en el modo */
  landing: string;
}[] = [
  {
    id: 'fighter_pro', userType: 'fighter', athleteMode: 'competitor',
    labelKey: 'va_preset_fighter_pro', descKey: 'va_preset_fighter_pro_desc',
    icon: 'ri-boxing-line', color: '#E10600', landing: '/mi-esquina',
  },
  {
    id: 'fighter_hobby', userType: 'fighter', athleteMode: 'hobby',
    labelKey: 'va_preset_fighter_hobby', descKey: 'va_preset_fighter_hobby_desc',
    icon: 'ri-heart-pulse-line', color: '#22c55e', landing: '/mi-esquina',
  },
  {
    id: 'promoter', userType: 'promoter', athleteMode: null,
    labelKey: 'va_preset_promoter', descKey: 'va_preset_promoter_desc',
    icon: 'ri-trophy-line', color: '#fb923c', landing: '/dashboard',
  },
  {
    id: 'gym', userType: 'gym', athleteMode: null,
    labelKey: 'va_preset_gym', descKey: 'va_preset_gym_desc',
    icon: 'ri-building-4-line', color: '#34d399', landing: '/dashboard',
  },
  {
    id: 'brand', userType: 'brand', athleteMode: null,
    labelKey: 'va_preset_brand', descKey: 'va_preset_brand_desc',
    icon: 'ri-store-2-line', color: '#C9A84C', landing: '/dashboard',
  },
  {
    id: 'visitor', userType: null, athleteMode: null,
    labelKey: 'va_preset_visitor', descKey: 'va_preset_visitor_desc',
    icon: 'ri-user-search-line', color: '#38bdf8', landing: '/beta',
  },
];

/** Ruta de aterrizaje según el tipo de perfil que se va a ver. */
export function landingFor(userType: UserType | null, athleteMode: string | null): string {
  if (!userType) return '/beta';
  if (userType === 'fighter') return athleteMode === 'hobby' ? '/mi-esquina' : '/mi-esquina';
  return '/dashboard';
}
