// Perfil físico del peleador (Bloque A).
//
// Datos que la IA de planes necesita para personalizar. Todos OPCIONALES.
// Se guardan en la tabla `fighter_physical` (1:1 con el perfil). Degrada con
// gracia si la migración 0031 no está aplicada: se trata como perfil vacío.

import { supabase } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

export type Sex = 'male' | 'female' | 'other';
export type Sport = 'boxeo' | 'mma' | 'kickboxing' | 'muaythai' | 'otro';
export type Level = 'principiante' | 'amateur' | 'competidor' | 'profesional';
export type Equipment = 'gimnasio_completo' | 'gimnasio_basico' | 'casa_material' | 'casa_sin_material';

export interface FighterPhysical {
  weight_kg: number | null;
  height_cm: number | null;
  birth_date: string | null;
  sex: Sex | null;
  sport: Sport | null;
  level: Level | null;
  training_days_per_week: number | null;
  session_minutes: number | null;
  equipment_access: Equipment | null;
  injuries_notes: string | null;
}

export function emptyPhysical(): FighterPhysical {
  return {
    weight_kg: null, height_cm: null, birth_date: null, sex: null, sport: null,
    level: null, training_days_per_week: null, session_minutes: null,
    equipment_access: null, injuries_notes: null,
  };
}

// Campos que cuentan para el % de completitud (injuries_notes NO cuenta: "sin
// lesiones" es un estado válido, no un hueco por rellenar).
export const CORE_PHYSICAL_FIELDS: (keyof FighterPhysical)[] = [
  'weight_kg', 'height_cm', 'birth_date', 'sex', 'sport', 'level',
  'training_days_per_week', 'session_minutes', 'equipment_access',
];

export interface Completeness { pct: number; filled: number; total: number; missing: (keyof FighterPhysical)[] }

export function completeness(p: FighterPhysical | null): Completeness {
  const total = CORE_PHYSICAL_FIELDS.length;
  if (!p) return { pct: 0, filled: 0, total, missing: [...CORE_PHYSICAL_FIELDS] };
  const missing = CORE_PHYSICAL_FIELDS.filter((k) => p[k] === null || p[k] === undefined || p[k] === '');
  const filled = total - missing.length;
  return { pct: Math.round((filled / total) * 100), filled, total, missing };
}

/** Edad a partir de la fecha de nacimiento (o null). */
export function ageFromBirth(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const b = new Date(birth + 'T12:00:00');
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

/** Carga el perfil físico. Devuelve empty si no hay fila; null si la tabla no existe. */
export async function loadPhysical(profileId: string): Promise<{ data: FighterPhysical; unavailable: boolean }> {
  const { data, error } = await supabase
    .from('fighter_physical').select('*')
    .eq('fighter_profile_id', profileId).maybeSingle();
  if (isMissingTable(error)) return { data: emptyPhysical(), unavailable: true };
  return { data: { ...emptyPhysical(), ...(data || {}) } as FighterPhysical, unavailable: false };
}

/** Guarda (upsert) el perfil físico. Devuelve true si fue bien. */
export async function savePhysical(profileId: string, patch: Partial<FighterPhysical>): Promise<boolean> {
  const row = { fighter_profile_id: profileId, ...patch, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('fighter_physical').upsert(row, { onConflict: 'fighter_profile_id' });
  return !error;
}
