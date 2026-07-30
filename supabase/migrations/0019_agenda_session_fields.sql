-- R12-T1: campos extra de la agenda para el registro de sesiones.
-- Puramente aditivo y seguro de re-ejecutar. Sin estas columnas la agenda
-- sigue funcionando (WeeklyAgenda reintenta el insert sin ellas), solo que
-- no guarda "cómo te sentiste" ni el momento del día.
alter table public.training_sessions
  add column if not exists feeling smallint;      -- 1..5, cómo se sintió el peleador en la sesión

alter table public.training_sessions
  add column if not exists part_of_day text;       -- 'morning' | 'afternoon' | 'evening' (opcional)
