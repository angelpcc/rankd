-- ============================================================
-- RANKD · Mi Esquina · Fuerza: rangos de repeticiones (R14-T2)
--
-- Hasta ahora cada serie guardaba UN número exacto de reps. Ahora se admite
-- también un RANGO ("8 a 10"): `reps` sigue siendo el valor bajo/fijo y
-- `reps_max` guarda el tope del rango (NULL = número fijo, sin ambigüedad).
--
-- El peso ya admite decimales (columna numeric(6,2)), no hace falta tocarlo.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.strength_sets
  add column if not exists reps_max smallint;

-- Coherencia: si hay tope de rango, debe ser >= reps (el valor bajo).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'strength_sets_reps_range_ck'
  ) then
    alter table public.strength_sets
      add constraint strength_sets_reps_range_ck
      check (reps_max is null or reps_max >= reps);
  end if;
end $$;
