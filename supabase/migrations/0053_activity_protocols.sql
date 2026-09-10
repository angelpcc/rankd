-- ============================================================
-- RANKD · Mi Esquina · Protocolos de actividad (punto 16)
--
-- Un PROTOCOLO es una sesión de actividad escrita por tramos: "del minuto 0 al
-- 5, inclinación 2 y velocidad 6; del 5 al 10, inclinación 4 y velocidad 7,5".
-- No es solo de cinta: vale para CUALQUIER tipo de actividad, porque lo que
-- cambia entre tipos son las VARIABLES de cada tramo (inclinación y velocidad
-- en cinta, resistencia y cadencia en bici, ritmo en natación o remo…), no la
-- estructura. Por eso los tramos van en jsonb y no en columnas: añadir un tipo
-- de actividad nuevo mañana no obliga a migrar nada.
--
--   segments: [
--     { id, label?, seconds, meters?, note?,
--       values: { speed_kmh?, incline_pct?, resistance?, cadence_rpm?,
--                 pace_min_100m?, pace_min_500m?, stroke_rate?, effort? } },
--     …
--   ]
--
-- `kind` es la misma clave interna que usa activity_sessions.kind y el payload
-- de day_plan_items ('correr', 'cinta', 'bici', 'natacion', 'remo',
-- 'eliptica', 'boxeo', 'cuerda', 'otro'…). Se guarda como texto libre a
-- propósito: la lista de tipos vive en el front (dayPlan.ts) y crece sin
-- migración.
--
-- `protocol_runs` es el historial de veces que se ha REPRODUCIDO un protocolo:
-- cuándo, cuánto se completó y con qué sesión de actividad quedó enlazado. La
-- sesión de verdad sigue yendo a `activity_sessions` (el historial de siempre);
-- esta tabla solo responde a "¿cuándo hice este protocolo por última vez y lo
-- terminé entero?".
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

create table if not exists public.activity_protocols (
  id                 uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,

  name               text not null,
  -- Tipo de actividad al que pertenece el protocolo (clave interna del front).
  kind               text not null default 'otro',

  -- Los tramos, en orden. Ver cabecera para la forma del objeto.
  segments           jsonb not null default '[]'::jsonb,

  -- Nota libre del protocolo entero (de dónde sale, para qué es…).
  note               text,

  -- manual  = lo escribió el usuario tramo a tramo
  -- import  = salió de pegar un texto / una foto y dejar que se estructure
  source             text not null default 'manual',

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists activity_protocols_owner_idx
  on public.activity_protocols (fighter_profile_id, kind, created_at desc);

alter table public.activity_protocols enable row level security;

drop policy if exists "own activity_protocols" on public.activity_protocols;
create policy "own activity_protocols" on public.activity_protocols
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

-- ── Historial de reproducciones ──

create table if not exists public.protocol_runs (
  id                 uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,

  -- Si se borra el protocolo, la marca del día se conserva con su nombre.
  protocol_id        uuid references public.activity_protocols(id) on delete set null,
  protocol_name      text not null,
  kind               text not null default 'otro',

  run_date           date not null,
  -- Segundos realmente completados y cuántos tramos se dieron por hechos.
  seconds_done       integer not null default 0 check (seconds_done >= 0),
  segments_done      smallint not null default 0 check (segments_done >= 0),
  -- true solo si se llegó al final de todos los tramos.
  completed          boolean not null default false,

  -- Sesión de activity_sessions que se creó al terminar (si se creó).
  activity_session_id uuid,

  created_at         timestamptz not null default now()
);

create index if not exists protocol_runs_owner_date_idx
  on public.protocol_runs (fighter_profile_id, run_date desc);

alter table public.protocol_runs enable row level security;

drop policy if exists "own protocol_runs" on public.protocol_runs;
create policy "own protocol_runs" on public.protocol_runs
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

-- El administrador puede leer (solo SELECT) para el modo "Ver como", igual
-- criterio que el resto de tablas de Mi Esquina. Se salta si rk_is_admin()
-- todavía no existe: las migraciones no siempre se aplican en orden.
do $$
begin
  if to_regprocedure('public.rk_is_admin()') is not null then
    drop policy if exists "admin read activity_protocols" on public.activity_protocols;
    create policy "admin read activity_protocols" on public.activity_protocols
      for select using (public.rk_is_admin());

    drop policy if exists "admin read protocol_runs" on public.protocol_runs;
    create policy "admin read protocol_runs" on public.protocol_runs
      for select using (public.rk_is_admin());
  end if;
end $$;
