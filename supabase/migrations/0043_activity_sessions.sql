-- ============================================================
-- RANKD · Mi Esquina · Registro de actividad no-fuerza (activity_sessions)
--
-- La pestaña "Actividad" de Progreso era un diario genérico con racha sobre
-- training_sessions (que mezcla tipos de todo). Se rehace como registro +
-- progreso de actividades NO de fuerza, al estilo de la sección Fuerza pero
-- sin muñeco muscular: cada sesión es un tipo + una duración.
--
--   · kind          → 'correr' | 'boxeo' | 'bici' | 'natacion' | 'cuerda' | 'otro'
--                     (clave interna; la etiqueta visible es i18n)
--   · duration_min  → minutos. Es el único dato obligatorio del registro.
--                     NO se pide distancia ni kilómetros: no aplica a boxeo,
--                     cuerda ni sparring y complica el registro sin aportar.
--   · rounds        → solo tiene sentido en 'boxeo' (asaltos), opcional.
--   · note          → texto libre opcional.
--
-- Dispara el tick automático de day_plan_items (kind='activity') del mismo
-- día cuando el tipo coincide. Cuenta en "sesiones esta semana" del Resumen
-- junto con los días de fuerza.
--
-- training_sessions se mantiene intacta (la usan el temporizador de asaltos,
-- el registro de plantillas y varias métricas); esto es una tabla nueva y
-- aparte, no un reemplazo.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

create table if not exists public.activity_sessions (
  id                 uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  session_date       date not null default current_date,
  kind               text not null,
  duration_min       integer not null,
  rounds             integer,
  note               text,
  created_at         timestamptz not null default now()
);

create index if not exists activity_sessions_owner_date_idx
  on public.activity_sessions (fighter_profile_id, session_date desc);

alter table public.activity_sessions enable row level security;

drop policy if exists "own activity_sessions" on public.activity_sessions;
create policy "own activity_sessions" on public.activity_sessions
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

drop policy if exists "admin read activity_sessions" on public.activity_sessions;
create policy "admin read activity_sessions" on public.activity_sessions
  for select using (public.rk_is_admin());
