-- ============================================================
-- RANKD · Mi Esquina · Registro de comidas (diario de dieta)
-- El peleador va apuntando lo que come; la IA de nutrición puede
-- planificar/ajustar sobre esa base y se guarda histórico real.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

create table if not exists public.meal_entries (
  id                  uuid primary key default gen_random_uuid(),
  fighter_profile_id  uuid not null references public.profiles(id) on delete cascade,
  entry_date          date not null default current_date,
  meal_type           text not null default 'comida',  -- desayuno | comida | cena | snack
  description         text not null,
  created_at          timestamptz not null default now()
);

create index if not exists meal_entries_fighter_date_idx
  on public.meal_entries (fighter_profile_id, entry_date desc);

alter table public.meal_entries enable row level security;

drop policy if exists "own meal_entries" on public.meal_entries;
create policy "own meal_entries" on public.meal_entries
  for all
  using (auth.uid() = fighter_profile_id)
  with check (auth.uid() = fighter_profile_id);
