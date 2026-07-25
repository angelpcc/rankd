-- ============================================================
-- RANKD · Mi Esquina · Check-in, rutinas, sparring y notas técnicas
--
-- Añade las piezas de uso recurrente y las específicas del peleador
-- que compite:
--   1. daily_checkins    → cómo se ha sentido hoy (alimenta la IA)
--   2. workout_templates → rutinas guardadas, registrables de un toque
--   3. sparring_sessions → registro de sparring (solo perfil competitivo)
--   4. technique_notes   → libreta de correcciones del entrenador
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run
-- Es seguro e idempotente. Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. CHECK-IN DIARIO
-- Una fila por día y peleador: si vuelve a enviarlo, se actualiza.
-- ────────────────────────────────────────────────
create table if not exists public.daily_checkins (
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null default current_date,
  energy smallint not null default 3,      -- 1 (agotado) .. 5 (a tope)
  soreness smallint not null default 3,    -- 1 (fresco) .. 5 (muy cargado)
  sleep_hours numeric(3,1),                -- 7.5
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (fighter_profile_id, entry_date)
);

create index if not exists daily_checkins_recent_idx
  on public.daily_checkins (fighter_profile_id, entry_date desc);

alter table public.daily_checkins enable row level security;

drop policy if exists "own daily_checkins" on public.daily_checkins;
create policy "own daily_checkins" on public.daily_checkins
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);


-- ────────────────────────────────────────────────
-- 2. RUTINAS GUARDADAS (plantillas de entreno)
-- ────────────────────────────────────────────────
create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  session_type text not null default 'tecnica',
  duration_min integer,
  intensity smallint not null default 3,
  notes text,
  -- Cuántas veces se ha registrado con esta plantilla: ordena las más usadas
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists workout_templates_fighter_idx
  on public.workout_templates (fighter_profile_id, use_count desc);

alter table public.workout_templates enable row level security;

drop policy if exists "own workout_templates" on public.workout_templates;
create policy "own workout_templates" on public.workout_templates
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);


-- ────────────────────────────────────────────────
-- 3. REGISTRO DE SPARRING (perfil competitivo)
-- ────────────────────────────────────────────────
create table if not exists public.sparring_sessions (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null default current_date,
  rounds smallint not null default 3,
  round_minutes numeric(3,1) not null default 3,
  partner text,                 -- con quién
  partner_level text,           -- similar | mas_fuerte | mas_flojo
  intensity smallint not null default 3,
  what_worked text,             -- qué funcionó
  what_didnt text,              -- qué no funcionó
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists sparring_sessions_fighter_date_idx
  on public.sparring_sessions (fighter_profile_id, session_date desc);

alter table public.sparring_sessions enable row level security;

drop policy if exists "own sparring_sessions" on public.sparring_sessions;
create policy "own sparring_sessions" on public.sparring_sessions
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);


-- ────────────────────────────────────────────────
-- 4. LIBRETA DE NOTAS TÉCNICAS (perfil competitivo)
-- ────────────────────────────────────────────────
create table if not exists public.technique_notes (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  note_date date not null default current_date,
  title text not null,
  body text,
  -- category: correccion | tactica | idea | error
  category text not null default 'correccion',
  -- Etiquetas libres para poder filtrar después (p. ej. "jab", "guardia")
  tags text[],
  -- De quién viene: coach | propia
  source text not null default 'coach',
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists technique_notes_fighter_date_idx
  on public.technique_notes (fighter_profile_id, note_date desc);

alter table public.technique_notes enable row level security;

drop policy if exists "own technique_notes" on public.technique_notes;
create policy "own technique_notes" on public.technique_notes
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);


-- ────────────────────────────────────────────────
-- 5. PESO OBJETIVO: fecha de pesaje y margen
-- El peleador que compite no persigue "un peso", persigue dar el peso de su
-- categoría un día concreto. Estas dos columnas lo hacen explícito.
-- ────────────────────────────────────────────────
alter table public.nutrition_goals
  add column if not exists weigh_in_date date,
  add column if not exists weight_class_label text;
