import { supabase } from '@/lib/supabase';

// Una sola llamada por pestaña: no necesitamos contar cada navegación interna,
// solo saber qué días entra cada usuario para poder medir recurrencia.
let done = false;

/**
 * Registra que el usuario ha entrado hoy.
 *
 * Es idempotente por día en la base de datos, así que llamarla de más no
 * ensucia los datos. Falla en silencio a propósito: una métrica nunca debe
 * estropearle la sesión a nadie.
 *
 * (En modo "ver como" queda bloqueada por el guardián de escrituras, que es
 * justo lo que queremos: revisar la plataforma no debe falsear las métricas.)
 */
export async function trackVisit(): Promise<void> {
  if (done) return;
  done = true;
  try {
    await supabase.rpc('rk_track_visit');
  } catch {
    /* la migración puede no estar aplicada todavía */
  }
}
