-- ============================================================
-- RANKD · Mi Esquina · Fuerza: doble sesión por día
--
-- Algunos peleadores entrenan mañana y tarde. Hoy pueden guardar dos sesiones
-- el mismo día (no había constraint de unicidad por fecha), pero no hay forma
-- de distinguirlas: mismo día = todo colapsa en un bloque.
--
-- Añadimos `session_slot` a strength_sets para identificar franja. Nullable:
-- las filas antiguas se quedan sin franja (se tratan como sesión única del día).
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente y aditiva.
-- Sin ella, el front degrada con isMissingColumn: guarda igual sin franja y
-- la sesión sigue apareciendo agrupada por día.
-- ============================================================

alter table public.strength_sets
  add column if not exists session_slot text check (session_slot in ('morning', 'afternoon', 'evening'));

create index if not exists strength_sets_fighter_date_slot_idx
  on public.strength_sets (fighter_profile_id, session_date desc, session_slot);
