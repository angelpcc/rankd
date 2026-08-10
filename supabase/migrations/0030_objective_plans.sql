-- ============================================================
-- RANKD · Mi Esquina · Plan IA (objective_plans)
--
-- El peleador escribe un OBJETIVO ("bajar 2kg", "preparar combate", "ganar
-- masa"), contesta opcionalmente 4-5 preguntas de calibrado (días disponibles,
-- duración por sesión, cardio aparte, tiempo para cocinar, notas libres) y la
-- IA genera un plan semanal completo (entreno + cardio + nutrición + notas por
-- día). Cuando lo confirma, cada día del plan se convierte en una entrada de
-- `planned_events` (source='ai') que ya alimenta la Agenda existente — NO se
-- crea una tabla de "planned_sessions" nueva por eso.
--
-- Guardamos aquí el ORIGEN del plan (objetivo, respuestas, JSON entero,
-- versión, estado) para poder mostrar el plan activo, refinarlo, versionarlo y
-- archivar los anteriores. Solo hay UN plan activo por peleador a la vez;
-- crear otro archiva los previos (lo hace el cliente en una transacción de dos
-- pasos — es un UPDATE por owner, así que la RLS ya lo cubre).
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente. Depende de
-- que exista la tabla `profiles` (viene con Supabase Auth).
-- ============================================================

create table if not exists public.objective_plans (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,

  -- Objetivo tal cual lo escribió el usuario (o el preset seleccionado).
  objective_text text not null,

  -- Respuestas a las preguntas de calibrado. Puede estar vacío ({}) si el
  -- usuario dio "Omitir" a todo. Formato libre para poder evolucionar sin
  -- migración: { days_per_week?, session_minutes?, cardio_extra_minutes?,
  --              can_cook?, extra_notes?, ...futuro }
  answers_json jsonb not null default '{}'::jsonb,

  -- Plan generado tal cual lo devolvió la IA (validado por el esquema del
  -- endpoint). Formato: { plan_name, summary, disclaimer, weeks: [{ week,
  -- days: [{ day, training?, cardio?, nutrition?, notes? }] }] }. También
  -- jsonb libre para no atarnos si evoluciona el esquema.
  plan_json jsonb not null,

  -- Versión: 1 al generar; sube al refinar con ajustes. Solo la última se
  -- muestra al usuario; las anteriores quedan guardadas por si quiere volver.
  version smallint not null default 1,

  -- 'active' = el plan que está siguiendo hoy. 'archived' = lo reemplazó por
  -- otro. Solo puede haber uno 'active' por peleador (regla aplicada por el
  -- cliente al insertar: archiva los previos primero).
  status text not null default 'active' check (status in ('active', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Búsqueda por peleador ordenada por creación (la lista de planes) y por el
-- plan activo actual (que es lo más frecuente: 1 query al abrir la sección).
create index if not exists objective_plans_owner_created_idx
  on public.objective_plans (fighter_profile_id, created_at desc);

create index if not exists objective_plans_owner_active_idx
  on public.objective_plans (fighter_profile_id, status)
  where status = 'active';

-- RLS: privacidad total, el dueño lo gestiona todo. Sin política de admin
-- (es planificación personal, mismo criterio que documentos/sparring/messages).
alter table public.objective_plans enable row level security;

drop policy if exists "objective_plans_owner_select" on public.objective_plans;
create policy "objective_plans_owner_select" on public.objective_plans
  for select using (fighter_profile_id = auth.uid());

drop policy if exists "objective_plans_owner_insert" on public.objective_plans;
create policy "objective_plans_owner_insert" on public.objective_plans
  for insert with check (fighter_profile_id = auth.uid());

drop policy if exists "objective_plans_owner_update" on public.objective_plans;
create policy "objective_plans_owner_update" on public.objective_plans
  for update using (fighter_profile_id = auth.uid())
  with check (fighter_profile_id = auth.uid());

drop policy if exists "objective_plans_owner_delete" on public.objective_plans;
create policy "objective_plans_owner_delete" on public.objective_plans
  for delete using (fighter_profile_id = auth.uid());
