-- ============================================================
-- RANKD · Mi Esquina · Rutinas con día de la semana (pendiente/hecho)
--
-- workout_templates (migración 0010) ya guardaba plantillas de "un toque
-- para registrar". Añade la posibilidad de asignar una plantilla a uno o
-- varios días de la semana (ej. "Hombro" los lunes y jueves): si hoy toca
-- y aún no se ha registrado nada que encaje, se muestra como pendiente en
-- Progreso › Actividad. En cuanto se registra, desaparece solo — no hay
-- que "marcarlo hecho" a mano, se calcula comparando con lo ya registrado
-- hoy (strength_sets.muscle_group si la rutina lleva grupo muscular,
-- training_sessions.session_type si no).
--
--   · days_of_week   → smallint[] con 0=domingo..6=sábado (Date.getDay()).
--                       NULL/vacío = plantilla suelta de siempre (como antes).
--   · muscle_group   → solo tiene sentido si session_type='fuerza'; NULL =
--                       la plantilla no es de un grupo muscular concreto.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.workout_templates
  add column if not exists days_of_week smallint[],
  add column if not exists muscle_group text;
