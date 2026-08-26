-- ============================================================
-- RANKD · Mi Esquina · Suplementación
--
--   1. common_supplements → catálogo compartido (no es por usuario), como
--      common_foods (migración 0039). Lectura abierta, sin escritura desde
--      el cliente.
--   2. user_supplements   → los que toma el peleador de verdad: o bien
--      apunta a uno del catálogo (supplement_id), o escribe uno propio
--      (custom_name) si no está en la lista. Guarda a qué hora lo toma.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

create table if not exists public.common_supplements (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  -- protein | creatine | preworkout | amino | vitamin | mineral | omega | other
  category    text not null check (category in ('protein', 'creatine', 'preworkout', 'amino', 'vitamin', 'mineral', 'omega', 'other')),
  description text
);

alter table public.common_supplements enable row level security;

drop policy if exists "read common_supplements" on public.common_supplements;
create policy "read common_supplements" on public.common_supplements
  for select to authenticated using (true);

insert into public.common_supplements (name, category, description) values
  ('Proteína de suero (whey)', 'protein', 'Recuperación muscular tras entrenar'),
  ('Proteína vegana', 'protein', 'Alternativa vegetal a la whey'),
  ('Caseína', 'protein', 'Liberación lenta, habitual antes de dormir'),
  ('Creatina monohidrato', 'creatine', 'Fuerza y potencia explosiva'),
  ('Cafeína', 'preworkout', 'Energía y foco antes de entrenar'),
  ('Pre-entreno (mezcla)', 'preworkout', 'Cafeína + otros estimulantes combinados'),
  ('Beta-alanina', 'preworkout', 'Retrasa la fatiga muscular'),
  ('Citrulina malato', 'preworkout', 'Bombeo y resistencia'),
  ('BCAA', 'amino', 'Aminoácidos ramificados, anti-catabólico'),
  ('EAA', 'amino', 'Aminoácidos esenciales completos'),
  ('Glutamina', 'amino', 'Recuperación e inmunidad'),
  ('Multivitamínico', 'vitamin', 'Cobertura general de micronutrientes'),
  ('Vitamina D', 'vitamin', 'Huesos e inmunidad, habitual en déficit'),
  ('Vitamina C', 'vitamin', 'Antioxidante, apoyo inmune'),
  ('Complejo B', 'vitamin', 'Energía y sistema nervioso'),
  ('Magnesio', 'mineral', 'Descanso, calambres y recuperación'),
  ('Zinc', 'mineral', 'Inmunidad y recuperación'),
  ('ZMA', 'mineral', 'Zinc + magnesio + B6, habitual antes de dormir'),
  ('Electrolitos', 'mineral', 'Hidratación en sesiones largas o con corte de peso'),
  ('Omega 3', 'omega', 'Antiinflamatorio, salud cardiovascular'),
  ('Colágeno', 'other', 'Apoyo a articulaciones y tendones'),
  ('Ashwagandha', 'other', 'Estrés y recuperación hormonal'),
  ('Melatonina', 'other', 'Conciliar el sueño'),
  ('Cúrcuma', 'other', 'Antiinflamatorio natural'),
  ('Probióticos', 'other', 'Salud digestiva')
on conflict (name) do nothing;

create table if not exists public.user_supplements (
  id                  uuid primary key default gen_random_uuid(),
  fighter_profile_id  uuid not null references public.profiles(id) on delete cascade,
  supplement_id       uuid references public.common_supplements(id) on delete set null,
  custom_name         text,
  time_of_day         time,
  notes               text,
  created_at          timestamptz not null default now(),
  constraint user_supplements_has_name check (supplement_id is not null or custom_name is not null)
);

create index if not exists user_supplements_owner_idx
  on public.user_supplements (fighter_profile_id, time_of_day);

alter table public.user_supplements enable row level security;

drop policy if exists "own user_supplements" on public.user_supplements;
create policy "own user_supplements" on public.user_supplements
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);
