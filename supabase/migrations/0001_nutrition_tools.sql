-- ============================================================
-- RANKD · Mi Esquina · Herramientas de Nutrición
-- Seguimiento de peso e hidratación para el peleador.
--
-- Cómo aplicar:
--   1) Supabase Dashboard → SQL Editor → pega este archivo → Run
--   (o) supabase db push si usas la CLI de Supabase.
--
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- (idéntica a la tabla training_sessions ya existente).
-- ============================================================

-- ── Objetivos de nutrición (una fila por peleador) ──────────
create table if not exists public.nutrition_goals (
  fighter_profile_id   uuid primary key references public.profiles(id) on delete cascade,
  target_weight_kg     numeric(5,1),
  daily_water_goal_ml  integer not null default 2500,
  updated_at           timestamptz not null default now()
);

-- ── Registros de peso corporal ──────────────────────────────
create table if not exists public.weight_entries (
  id                  uuid primary key default gen_random_uuid(),
  fighter_profile_id  uuid not null references public.profiles(id) on delete cascade,
  weight_kg           numeric(5,1) not null,
  entry_date          date not null default current_date,
  note                text,
  created_at          timestamptz not null default now()
);

create index if not exists weight_entries_fighter_date_idx
  on public.weight_entries (fighter_profile_id, entry_date desc);

-- ── Hidratación (un acumulado por día y peleador) ───────────
create table if not exists public.hydration_entries (
  fighter_profile_id  uuid not null references public.profiles(id) on delete cascade,
  entry_date          date not null default current_date,
  amount_ml           integer not null default 0,
  updated_at          timestamptz not null default now(),
  primary key (fighter_profile_id, entry_date)
);

-- ── Row Level Security: cada peleador solo ve/edita lo suyo ──
alter table public.nutrition_goals   enable row level security;
alter table public.weight_entries    enable row level security;
alter table public.hydration_entries enable row level security;

drop policy if exists "own nutrition_goals" on public.nutrition_goals;
create policy "own nutrition_goals" on public.nutrition_goals
  for all
  using (auth.uid() = fighter_profile_id)
  with check (auth.uid() = fighter_profile_id);

drop policy if exists "own weight_entries" on public.weight_entries;
create policy "own weight_entries" on public.weight_entries
  for all
  using (auth.uid() = fighter_profile_id)
  with check (auth.uid() = fighter_profile_id);

drop policy if exists "own hydration_entries" on public.hydration_entries;
create policy "own hydration_entries" on public.hydration_entries
  for all
  using (auth.uid() = fighter_profile_id)
  with check (auth.uid() = fighter_profile_id);
