-- ============================================================
-- RANKD · Mi Esquina · Inventario de material del peleador
-- Cada peleador marca el equipo que tiene y su estado
-- (para saber cuándo toca reemplazar guantes, bucal, vendas...).
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

create table if not exists public.gear_items (
  id                  uuid primary key default gen_random_uuid(),
  fighter_profile_id  uuid not null references public.profiles(id) on delete cascade,
  name                text not null,
  condition           text not null default 'good',  -- 'good' | 'replace'
  created_at          timestamptz not null default now()
);

create index if not exists gear_items_fighter_idx
  on public.gear_items (fighter_profile_id);

alter table public.gear_items enable row level security;

drop policy if exists "own gear_items" on public.gear_items;
create policy "own gear_items" on public.gear_items
  for all
  using (auth.uid() = fighter_profile_id)
  with check (auth.uid() = fighter_profile_id);
