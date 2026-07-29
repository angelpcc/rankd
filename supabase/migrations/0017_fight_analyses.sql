-- ============================================================
-- RANKD · Análisis privado post-combate
--
-- Después de pelear, el peleador que compite anota su propio análisis:
-- qué funcionó, qué no, qué corregir y notas del rival por si hay revancha.
--
-- IMPORTANTE: esto es PRIVADO y va SEPARADO del récord público (wins/losses
-- en la tabla `fighters`). El campo `result` de aquí es la etiqueta que el
-- propio peleador se pone para ordenar sus notas; no altera ni lee su récord
-- oficial. Nadie más que su dueño puede ver estas filas — ni el administrador
-- (misma decisión que con mensajes y documentos).
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

create table if not exists public.fight_analyses (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  fight_date date,
  opponent text,
  event_name text,
  -- Etiqueta PRIVADA del propio peleador; NO es el récord público.
  result text,              -- win | loss | draw | nc
  method text,              -- "KO R2", "decisión unánime"...
  performance smallint,     -- autovaloración 1..5
  what_worked text,         -- qué funcionó
  what_didnt text,          -- qué no funcionó
  lessons text,             -- qué corregir de cara a la próxima
  opponent_notes text,      -- scouting del rival para una posible revancha
  created_at timestamptz not null default now()
);

create index if not exists fight_analyses_owner_idx
  on public.fight_analyses (fighter_profile_id, fight_date desc);

alter table public.fight_analyses enable row level security;

-- SOLO el dueño. Sin política de administrador a propósito: es material
-- estratégico y personal.
drop policy if exists "own fight_analyses" on public.fight_analyses;
create policy "own fight_analyses" on public.fight_analyses
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);
