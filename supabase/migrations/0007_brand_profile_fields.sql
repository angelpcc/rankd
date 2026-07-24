-- ============================================================
-- RANKD · Campos del perfil de marca que no se guardaban
--
-- BUG que corrige: en el panel de marca, "Sector", "Presupuesto de
-- patrocinio" y "Disciplinas objetivo" se rellenaban y se perdían al
-- recargar, porque no existía dónde guardarlos. Con estas columnas
-- pasan a persistir de verdad.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run
-- Es seguro e idempotente (IF NOT EXISTS).
-- ============================================================

alter table public.organizations
  add column if not exists industry text,
  add column if not exists sponsorship_budget text,
  add column if not exists target_disciplines text[];
