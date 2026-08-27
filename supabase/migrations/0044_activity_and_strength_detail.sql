-- ============================================================
-- RANKD · Mi Esquina · Actividad por tipo + detalle de fuerza
--
-- Dos bloques aditivos:
--
-- 1. activity_sessions (mig 0043) solo guardaba duración. Cada tipo de
--    actividad tiene datos propios que antes se perdían:
--      · distance_km       → correr y bici (km recorridos)
--      · pace_sec_per_km   → correr (ritmo; se calcula de duración/distancia
--                            pero es editable, así que se persiste)
--      · meters            → natación (metros nadados)
--      · round_duration_sec→ boxeo (duración de cada asalto, opcional)
--    Todas nullable: una sesión de cuerda sigue siendo solo duración.
--
-- 2. strength_sets (migs 0014/0026/0029/0033) trataba todo como
--    series × reps × peso. Dos columnas para poder interpretar bien el
--    registro y el histórico:
--      · weight_mode    → 'total' | 'per_side' | 'per_dumbbell' | 'bodyweight'
--                         (cómo leer weight_kg: total levantado, por lado,
--                         por mancuerna, o lastre sobre el peso corporal).
--                         weight_kg se guarda SIEMPRE tal cual lo teclea el
--                         usuario — no se convierte a total.
--      · tracking_mode  → 'reps' | 'time' | 'distance'. En 'time' la columna
--                         `reps` guarda SEGUNDOS; en 'distance', METROS. Así
--                         una plancha es 3×45 s y un paseo del granjero 4×20 m
--                         sin columnas nuevas para el valor.
--    NULL = comportamiento de siempre ('total' / 'reps'). El front degrada con
--    isMissingColumn: si la migración no está, inserta sin estas columnas.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.activity_sessions
  add column if not exists distance_km        numeric(6,2),
  add column if not exists pace_sec_per_km    integer,
  add column if not exists meters             integer,
  add column if not exists round_duration_sec integer;

alter table public.strength_sets
  add column if not exists weight_mode   text,
  add column if not exists tracking_mode text;
