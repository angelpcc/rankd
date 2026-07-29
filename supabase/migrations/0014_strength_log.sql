-- ============================================================
-- RANKD · Mi Esquina · Registro de cargas y progresión de fuerza
--
-- Guarda UNA FILA POR SERIE (no por sesión). Es lo que permite después:
--   · ver la progresión de un ejercicio concreto semana a semana
--   · detectar marcas personales sin guardarlas por duplicado
--   · calcular el volumen real levantado (series x reps x peso)
--
-- Las marcas personales NO se almacenan: se derivan de estas filas. Así no
-- pueden quedar desincronizadas si se corrige o borra un registro.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

create table if not exists public.strength_sets (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  -- Nombre del ejercicio ya normalizado en minúsculas por el cliente, para
  -- que "Press banca" y "press banca" no cuenten como ejercicios distintos.
  exercise text not null,
  -- Cómo lo escribió el usuario, para mostrarlo tal cual
  exercise_label text not null,
  session_date date not null default current_date,
  set_number smallint not null default 1,
  reps smallint not null,
  weight_kg numeric(6,2) not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists strength_sets_fighter_ex_idx
  on public.strength_sets (fighter_profile_id, exercise, session_date desc);
create index if not exists strength_sets_fighter_date_idx
  on public.strength_sets (fighter_profile_id, session_date desc);

alter table public.strength_sets enable row level security;

drop policy if exists "own strength_sets" on public.strength_sets;
create policy "own strength_sets" on public.strength_sets
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

-- El administrador puede leerlas para el modo "ver como" (solo SELECT).
drop policy if exists "admin read strength_sets" on public.strength_sets;
create policy "admin read strength_sets" on public.strength_sets
  for select using (public.rk_is_admin());
