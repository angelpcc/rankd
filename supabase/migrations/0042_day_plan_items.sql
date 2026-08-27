-- ============================================================
-- RANKD · Mi Esquina · Plan por día unificado (day_plan_items)
--
-- Hasta ahora la planificación vivía repartida en tres sitios sin modelo
-- común: workout_templates (plantillas de un toque), objective_plans →
-- planned_events (plan IA) y planned_events a mano (calendario). La Agenda
-- no sabía nada de comidas ni suplementos previstos, y la "vista día" era
-- solo dos columnas planas.
--
-- day_plan_items es el modelo único de "qué toca cada día". Cinco tipos de
-- bloque, cada uno con su payload jsonb libre:
--
--   · strength   → { groups: string[], exercises?: string, note?: string }
--   · activity   → { kind: string, duration_min?: number, note?: string }
--   · meal       → { slot: 'desayuno'|'comida'|'cena'|'snack', text: string }
--   · supplement → { name: string, time?: string }
--   · note       → { text: string }
--
-- `completed` solo lo usan strength y activity: se marca solo (tick
-- automático) al registrar algo que encaja ese día — grupo muscular en común
-- para fuerza, mismo tipo para actividad. meal/supplement/note son
-- anotaciones informativas, nunca llevan tick.
--
-- `source`: 'manual' (Planificar / a mano), 'advisor' (lo propuso el Asesor),
-- 'template' (se aplicó una plantilla). Solo informativo, para pintarlo.
--
-- planned_events se mantiene APARTE, solo para eventos de competición
-- (kind = 'fight' | 'weigh_in'), que alimentan FightPrep y los iconos de la
-- Agenda. No se migra nada.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

create table if not exists public.day_plan_items (
  id                 uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_date          date not null,
  kind               text not null check (kind in ('strength', 'activity', 'meal', 'supplement', 'note')),
  payload            jsonb not null default '{}'::jsonb,
  completed          boolean not null default false,
  -- manual | advisor | template
  source             text not null default 'manual',
  created_at         timestamptz not null default now()
);

create index if not exists day_plan_items_owner_date_idx
  on public.day_plan_items (fighter_profile_id, plan_date);

alter table public.day_plan_items enable row level security;

drop policy if exists "own day_plan_items" on public.day_plan_items;
create policy "own day_plan_items" on public.day_plan_items
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

-- El administrador puede leerlos para el modo "ver como" (solo SELECT), igual
-- criterio que strength_sets / training_sessions.
drop policy if exists "admin read day_plan_items" on public.day_plan_items;
create policy "admin read day_plan_items" on public.day_plan_items
  for select using (public.rk_is_admin());
