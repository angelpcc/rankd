-- ============================================================
-- RANKD · Mi Esquina · Rutinas preescritas (punto 17)
--
-- Una RUTINA es un entreno estructurado escrito de antemano: días con nombre
-- ("Push", "Pull", "Pierna", "Circuito A"…), y dentro de cada día una lista de
-- ejercicios con sus series y su rango de repeticiones ya decididos. Es el
-- gemelo de `activity_protocols` (0053) para el trabajo con pasos preescritos:
-- allí se reproduce un guion por tramos, aquí se va marcando un checklist.
--
-- No es exclusiva de Fuerza tradicional: un circuito o una sesión de calistenia
-- se modelan igual (ejercicios con series y repeticiones o tiempo).
--
--   days: [
--     { id, name, note?,
--       exercises: [
--         { id, name, group, sets, reps_min, reps_max?, value?,
--           weight_kg?, weight_mode, tracking_mode, note? },
--         …
--       ] },
--     …
--   ]
--
-- `group` es un MuscleGroup del front (back, chest, shoulders, biceps, triceps,
-- legs, core, power, full_body) y `weight_mode` / `tracking_mode` son los
-- mismos valores que ya guarda `strength_sets`, para que al completar la
-- sesión las filas salgan idénticas a un registro hecho a mano.
--
-- Al terminar un día NO se guarda nada aquí: la sesión va a `strength_sets`,
-- que es el historial de Fuerza de siempre. En esta tabla solo vive la
-- PLANTILLA, más `last_used_at` para poder ordenar por lo más reciente.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

create table if not exists public.workout_routines (
  id                 uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,

  name               text not null,
  -- Nota libre de la rutina entera (de quién viene, para qué bloque es…).
  note               text,

  -- Los días de la rutina, en orden. Ver cabecera para la forma del objeto.
  days               jsonb not null default '[]'::jsonb,

  -- manual = escrita a mano en la app
  -- import = salió de pegar un texto / una foto y dejar que se estructure
  source             text not null default 'manual',

  -- Última vez que se entrenó algún día de esta rutina. Sirve para ordenar y
  -- para enseñar "última vez: hace 3 días" sin abrirla.
  last_used_at       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists workout_routines_owner_idx
  on public.workout_routines (fighter_profile_id, created_at desc);

alter table public.workout_routines enable row level security;

drop policy if exists "own workout_routines" on public.workout_routines;
create policy "own workout_routines" on public.workout_routines
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

do $$
begin
  if to_regprocedure('public.rk_is_admin()') is not null then
    drop policy if exists "admin read workout_routines" on public.workout_routines;
    create policy "admin read workout_routines" on public.workout_routines
      for select using (public.rk_is_admin());
  end if;
end $$;
