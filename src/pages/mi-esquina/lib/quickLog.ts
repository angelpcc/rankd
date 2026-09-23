// ════════════════════════════════════════════════════════════════
// RANKD · Registro rápido: peso y agua sin entrar en su sección
//
// Pesarse o beber un vaso de agua son las dos cosas que más se repiten y las
// que menos merecen un viaje: antes había que ir a Peso, bajar al campo y
// guardar; o entrar en Nutrición, pasar a la pantalla de trabajo, abrir la
// pestaña Agua y darle al vaso. Desde el registro rápido es un toque.
//
// Escriben EXACTAMENTE como sus secciones (WeightTracker y NutritionTracker):
// mismo día, mismas columnas, misma reserva si falta `recorded_at`. Si no, lo
// apuntado desde aquí y lo apuntado desde Peso serían dos datos distintos.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { isMissingColumn } from '@/lib/dbState';
import { isoOf } from './dayPlan';

const hoy = () => isoOf(new Date());

export interface PesoHoy {
  /** Último peso registrado (el de hoy si lo hay). */
  ultimo: number | null;
  /** ¿Hay ya un peso de hoy? Guardar lo actualiza en vez de duplicarlo. */
  deHoy: boolean;
}

export async function leerPeso(profileId: string): Promise<PesoHoy> {
  const { data } = await supabase.from('weight_entries')
    .select('weight_kg, entry_date')
    .eq('fighter_profile_id', profileId)
    .order('entry_date', { ascending: false }).limit(1).maybeSingle();
  const r = data as { weight_kg: number; entry_date: string } | null;
  return { ultimo: r ? Number(r.weight_kg) : null, deHoy: !!r && r.entry_date === hoy() };
}

/** Guarda el peso de hoy. Si ya había uno, lo actualiza. */
export async function guardarPesoHoy(profileId: string, kg: number): Promise<boolean> {
  if (!Number.isFinite(kg) || kg < 20 || kg > 250) return false;
  const fecha = hoy();
  const ahora = new Date().toISOString();
  const { data: existente } = await supabase.from('weight_entries')
    .select('id').eq('fighter_profile_id', profileId).eq('entry_date', fecha).maybeSingle();
  const id = (existente as { id: string } | null)?.id;

  if (id) {
    let { error } = await supabase.from('weight_entries').update({ weight_kg: kg, recorded_at: ahora }).eq('id', id);
    if (error && isMissingColumn(error)) {
      ({ error } = await supabase.from('weight_entries').update({ weight_kg: kg }).eq('id', id));
    }
    return !error;
  }
  let { error } = await supabase.from('weight_entries')
    .insert({ fighter_profile_id: profileId, weight_kg: kg, entry_date: fecha, recorded_at: ahora });
  if (error && isMissingColumn(error)) {
    ({ error } = await supabase.from('weight_entries')
      .insert({ fighter_profile_id: profileId, weight_kg: kg, entry_date: fecha }));
  }
  return !error;
}

export async function leerAgua(profileId: string): Promise<number> {
  const { data } = await supabase.from('hydration_entries')
    .select('amount_ml').eq('fighter_profile_id', profileId).eq('entry_date', hoy()).maybeSingle();
  return Number((data as { amount_ml?: number } | null)?.amount_ml) || 0;
}

/** Suma agua a lo de hoy. Devuelve el total nuevo, o null si no se pudo guardar. */
export async function sumarAgua(profileId: string, ml: number): Promise<number | null> {
  const actual = await leerAgua(profileId);
  // Tope de 10 litros: más que eso es un error al tocar, no agua.
  const total = Math.max(0, Math.min(10000, actual + ml));
  const { error } = await supabase.from('hydration_entries').upsert({
    fighter_profile_id: profileId,
    entry_date: hoy(),
    amount_ml: total,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'fighter_profile_id,entry_date' });
  return error ? null : total;
}
