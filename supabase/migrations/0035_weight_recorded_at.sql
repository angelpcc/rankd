-- ============================================================
-- RANKD · Mi Esquina · Hora del registro de peso
--
-- weight_entries (migración 0001) solo guardaba la FECHA (entry_date) y un
-- created_at de auditoría que no se actualiza si el registro de hoy se
-- sobrescribe. Añade 'recorded_at' (timestamptz), que la app fija de forma
-- explícita con new Date() en cada alta o actualización del peso del día,
-- para poder mostrar "72.4 kg · 8:30" junto a cada registro.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.weight_entries
  add column if not exists recorded_at timestamptz not null default now();
