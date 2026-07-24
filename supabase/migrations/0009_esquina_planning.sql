-- ============================================================
-- RANKD · Mi Esquina · Planificación, objetivos y lesiones
--
-- Añade las tres piezas que faltaban para que Mi Esquina planifique
-- hacia adelante, no solo registre lo hecho:
--   1. planned_events → calendario: entrenos futuros, pesaje, combate
--   2. fighter_goals  → metas concretas con fecha límite
--   3. injuries       → seguimiento de lesiones y su evolución
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run
-- Es seguro e idempotente. Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. CALENDARIO — eventos planificados
-- ────────────────────────────────────────────────
create table if not exists public.planned_events (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  event_date date not null,
  -- kind: training | weigh_in | fight | rest | other
  kind text not null default 'training',
  -- Para entrenos, el tipo (sparring/tecnica/...) va aquí; para pesaje/combate se ignora
  session_type text,
  title text not null,
  time text,             -- "18:30", opcional
  notes text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists planned_events_fighter_date_idx
  on public.planned_events (fighter_profile_id, event_date);

alter table public.planned_events enable row level security;

drop policy if exists "own planned_events" on public.planned_events;
create policy "own planned_events" on public.planned_events
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);


-- ────────────────────────────────────────────────
-- 2. OBJETIVOS — metas con fecha límite
-- ────────────────────────────────────────────────
create table if not exists public.fighter_goals (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  -- category: weight | performance | habit | competition | other
  category text not null default 'other',
  target_value numeric,   -- p. ej. 70 (kg) en metas de peso; null si es cualitativa
  start_value numeric,    -- punto de partida, para la barra de progreso
  unit text,              -- "kg", "km", "combates"...
  deadline date,
  -- status: active | achieved | archived
  status text not null default 'active',
  created_at timestamptz not null default now(),
  achieved_at timestamptz
);

create index if not exists fighter_goals_fighter_idx
  on public.fighter_goals (fighter_profile_id, status);

alter table public.fighter_goals enable row level security;

drop policy if exists "own fighter_goals" on public.fighter_goals;
create policy "own fighter_goals" on public.fighter_goals
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);


-- ────────────────────────────────────────────────
-- 3. LESIONES — molestias y su evolución
-- ────────────────────────────────────────────────
create table if not exists public.injuries (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  body_part text not null,   -- rodilla, hombro, mano, costillas...
  title text,                -- descripción breve de la molestia
  -- severity: leve | moderada | grave
  severity text not null default 'leve',
  -- status: activa | recuperando | recuperada
  status text not null default 'activa',
  started_on date not null default current_date,
  resolved_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists injuries_fighter_idx
  on public.injuries (fighter_profile_id, status);

alter table public.injuries enable row level security;

drop policy if exists "own injuries" on public.injuries;
create policy "own injuries" on public.injuries
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);
