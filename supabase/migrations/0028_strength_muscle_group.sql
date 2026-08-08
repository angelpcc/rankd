-- ============================================================
-- RANKD · Mi Esquina · Fuerza: grupo muscular por serie
--
-- El nuevo registro de Fuerza va por SESIÓN: el usuario marca uno o varios
-- grupos musculares (espalda, pecho, bíceps…) y añade ejercicios dentro de cada
-- bloque. Para poder mostrar la sesión y el historial AGRUPADOS por grupo —
-- incluso con ejercicios libres que no están en la biblioteca— guardamos el
-- grupo elegido en cada serie.
--
-- `muscle_group` es texto libre (clave del grupo: back/chest/shoulders/biceps/
-- triceps/legs/core/power/full_body). Nullable para no romper las filas
-- antiguas: si falta, el cliente deriva el grupo del nombre del ejercicio.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente. Depende de
-- que 0014 (tabla strength_sets) esté aplicada.
-- ============================================================

alter table public.strength_sets
  add column if not exists muscle_group text;

create index if not exists strength_sets_fighter_group_idx
  on public.strength_sets (fighter_profile_id, session_date desc, muscle_group);
