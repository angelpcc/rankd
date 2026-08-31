-- ============================================================
-- RANKD · Mi Esquina · Actividad: inclinación (%)
--
-- Campo opcional para cardio en máquina con pendiente (cinta de correr,
-- rodillo de bici). Solo lo piden los tipos 'correr' y 'bici' en el front.
--
--   · incline_percent → porcentaje de inclinación. numeric(4,1): 0.0 – 999.9,
--     de sobra para el 0–15 % típico de una cinta. Nullable: una sesión sin
--     inclinación se guarda igual y el historial no la muestra.
--
-- Aditiva: no toca ninguna fila existente. El front degrada con
-- isMissingColumn — si esta migración no está aplicada, guarda la sesión sin
-- el campo.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.activity_sessions
  add column if not exists incline_percent numeric(4,1);
