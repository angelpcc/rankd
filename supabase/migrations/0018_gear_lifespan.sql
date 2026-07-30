-- ============================================================
-- RANKD · Mi Esquina · Vida útil del material (recordatorios)
--
-- Amplía el inventario de material (gear_items, migración 0002) para poder
-- avisar cuándo toca renovar una pieza por antigüedad, no solo cuando el
-- peleador la marca a mano como "gastada".
--
--   · acquired_at      → desde cuándo tiene la pieza (o cuándo la renovó)
--   · lifespan_months  → cada cuántos meses conviene reemplazarla
--
-- Con ambas se calcula una fecha de reemplazo. El aviso solo aparece cuando
-- 'acquired_at' está informada; sin ella, el material se comporta como antes.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

alter table public.gear_items
  add column if not exists acquired_at date,
  add column if not exists lifespan_months integer;

create index if not exists gear_items_owner_acquired_idx
  on public.gear_items (fighter_profile_id, acquired_at);
