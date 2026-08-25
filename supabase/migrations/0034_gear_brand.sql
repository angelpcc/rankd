-- ============================================================
-- RANKD · Mi Esquina · Marca del material
--
-- Amplía el inventario de material (gear_items, migración 0002) con la
-- marca de cada pieza (texto libre, ej. "Everlast", "Venum"). Opcional:
-- si no se informa, el material se comporta como antes.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

alter table public.gear_items
  add column if not exists brand text;
