-- ============================================================
-- RANKD · Mi Esquina · Asesor de comida (meal_plans)
--
-- El peleador dice cuánto tiempo tiene para cocinar, cómo de complicado lo
-- quiere y qué tiene en casa; la app cruza eso con su peso, altura, edad,
-- sexo, días de entreno y peso objetivo, y genera un plan de comidas de
-- varios días. Aquí se guarda para que siga estando al volver.
--
-- Misma pauta que `objective_plans` (0030): guardamos los PARÁMETROS con los
-- que se pidió y el plan entero en JSON, y solo hay un plan 'active' por
-- peleador. Generar otro archiva el anterior en vez de borrarlo, así se puede
-- ver qué se estaba comiendo hace un mes.
--
-- El JSON es libre a propósito: la generación es por reglas hoy y podrá ser
-- por IA mañana sin migrar nada.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente. Depende
-- de `profiles` (viene con Supabase Auth).
-- ============================================================

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,

  -- Lo que pidió el usuario: { maxMinutes, complexity, pantry[], onlyPantry,
  -- vegetarian, days, seed }. Con la semilla, el mismo plan se puede volver a
  -- generar igual.
  params_json jsonb not null default '{}'::jsonb,

  -- El plan completo: { target, params, days: [{ day, meals: [...] }],
  -- createdAt }.
  plan_json jsonb not null,

  -- Cuántos días cubre. Redundante con el JSON, pero permite listarlos sin
  -- abrirlos.
  days smallint not null default 5 check (days between 1 and 14),

  status text not null default 'active' check (status in ('active', 'archived')),

  created_at timestamptz not null default now()
);

-- El plan activo es lo que se pide al abrir la pantalla: una consulta.
create index if not exists meal_plans_owner_active_idx
  on public.meal_plans (fighter_profile_id, status, created_at desc);

alter table public.meal_plans enable row level security;

-- Es comida del usuario: solo él.
drop policy if exists "own meal_plans" on public.meal_plans;
create policy "own meal_plans" on public.meal_plans
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

-- El administrador puede leerlo para el modo "Ver como" (solo SELECT, como el
-- resto de tablas de la migración 0011). Se salta si rk_is_admin() todavía no
-- existe: las migraciones de este proyecto no siempre se aplican en orden.
do $$
begin
  if to_regprocedure('public.rk_is_admin()') is not null then
    drop policy if exists "admin read meal_plans" on public.meal_plans;
    create policy "admin read meal_plans" on public.meal_plans
      for select using (public.rk_is_admin());
  end if;
end $$;
