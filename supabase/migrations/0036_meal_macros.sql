-- ============================================================
-- RANKD · Mi Esquina · Macros por comida
--
-- meal_entries (migración 0005) solo guardaba una descripción libre. Para
-- poder mostrar un resumen real de calorías/macros (informe por periodo) y
-- para que el análisis de foto de comida (FoodPhotoAnalyzer) tenga dónde
-- persistir su estimación, añade columnas numéricas opcionales.
--
-- Nullable a propósito: una comida escrita a mano sigue sin macros, como
-- hasta ahora. Solo se rellenan cuando el origen del dato los conoce
-- (análisis de foto, o más adelante el selector de platos comunes).
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.meal_entries
  add column if not exists calories  numeric(6,1),
  add column if not exists protein_g numeric(6,1),
  add column if not exists carbs_g   numeric(6,1),
  add column if not exists fat_g     numeric(6,1);
