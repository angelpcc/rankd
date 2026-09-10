-- ============================================================
-- RANKD · Mi Esquina · Plan semanal multi-módulo (punto 21)
--
-- El Asesor puede resolver de una sola petición lo que antes eran tres:
-- "tengo 5 días, quiero fuerza de hipertrofia sin boxeo, un cardio de tarde
-- de 40 min con la inclinación minuto a minuto, otro corto de mañana, otro
-- suave post-entreno, y comida y cena para 5 días con cosas rápidas".
--
-- Aquí se guarda el PLAN GENERADO antes y después de confirmarlo. Hace falta
-- una tabla propia por dos razones:
--
--   1. El plan es un BORRADOR revisable. Entre "generar" y "confirmar" el
--      usuario pide ajustes puntuales ("cambia el cardio del jueves", "el
--      miércoles no quiero pierna"), y eso tiene que sobrevivir a que cierre la
--      pantalla o se le vaya la conexión. Sin esto, cada ajuste obligaría a
--      rehacer la petición entera.
--   2. Al confirmar, el plan se REPARTE en tablas que ya existen
--      (`workout_routines`, `activity_protocols`, `meal_plans`,
--      `day_plan_items`). Guardar además el plan original permite saber de
--      dónde salió cada pieza y volver a aplicarlo o ajustarlo más adelante.
--
-- `plan_json` contiene todo: la petición literal del usuario, los días que dijo
-- tener ESA semana, las exclusiones que pidió respetar, la fuerza por día, los
-- protocolos de cardio con sus tramos y la pauta de comidas. El formato es
-- libre a propósito: lo genera el modelo y el front lo normaliza.
--
-- `committed_json` guarda los ids creados al confirmar (rutina, protocolos,
-- bloques de agenda), para poder deshacer o rastrear sin adivinar.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

create table if not exists public.week_plans (
  id                 uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,

  -- Lo que escribió el usuario, tal cual. Es la fuente de la verdad de lo que
  -- pidió: si el plan no le cuadra, se relee esto antes que el JSON generado.
  request            text not null,

  -- Lunes de la semana que cubre el plan.
  week_start         date not null,

  -- Cuántos días de entreno dijo tener ESA semana. Puede cambiar cada semana:
  -- por eso se guarda por plan y no en el perfil.
  training_days      smallint not null default 0 check (training_days between 0 and 7),

  -- El plan completo generado. Ver cabecera.
  plan_json          jsonb not null default '{}'::jsonb,

  -- draft     = generado y pendiente de revisión/ajustes
  -- committed = confirmado y repartido en sus secciones
  -- archived  = sustituido por otro plan
  status             text not null default 'draft'
                     check (status in ('draft', 'committed', 'archived')),

  -- Ids de lo que se creó al confirmar: { routine_id, protocol_ids[],
  -- day_plan_item_ids[], meal_plan_saved }.
  committed_json     jsonb,
  committed_at       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Lo que se pide al abrir la pantalla es "el borrador que tenía a medias" o
-- "el plan de esta semana": una consulta.
create index if not exists week_plans_owner_status_idx
  on public.week_plans (fighter_profile_id, status, created_at desc);

alter table public.week_plans enable row level security;

drop policy if exists "own week_plans" on public.week_plans;
create policy "own week_plans" on public.week_plans
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

-- El administrador puede leerlo para el modo "Ver como" (solo SELECT), igual
-- criterio que el resto de tablas de Mi Esquina. Se salta si rk_is_admin()
-- todavía no existe: las migraciones no siempre se aplican en orden.
do $$
begin
  if to_regprocedure('public.rk_is_admin()') is not null then
    drop policy if exists "admin read week_plans" on public.week_plans;
    create policy "admin read week_plans" on public.week_plans
      for select using (public.rk_is_admin());
  end if;
end $$;
