-- ============================================================
-- RANKD · Mi Esquina · Entrenos de boxeo por asaltos (punto 28)
--
-- El Asesor ya sabe generar cardio minuto a minuto (punto 16). Esto es el
-- equivalente para BOXEO, que no se mide en minutos sino en ASALTOS: le dices
-- el tiempo que tienes y te devuelve calentamiento, N asaltos con su duración y
-- su descanso, qué trabajar en cada uno, y vuelta a la calma.
--
-- ── POR QUÉ UNA TABLA PROPIA Y NO `activity_protocols` ──
--
-- Un protocolo de cardio es una lista de tramos con variables continuas
-- (inclinación, velocidad, minutos). Un entreno de boxeo es otra cosa: una
-- cuenta de asaltos con un guion por asalto, y sobre todo un dato que el
-- protocolo no tiene — la configuración exacta que necesita el TEMPORIZADOR DEL
-- RING para arrancar solo (rounds, duración, descanso, preparación, aviso).
-- Meterlo a la fuerza en `segments` obligaría a adivinar esos números al
-- reproducirlo, que es justo lo que el punto 28 quiere evitar.
--
-- ── EL CAMPO QUE LO EXPLICA TODO: `place` ──
--
-- El contenido de los asaltos cambia por completo según dónde entrenes: sin
-- saco es todo sombra y desplazamientos; con saco y material se estructura
-- distinto. Por eso se guarda, y por eso el Asesor lo PREGUNTA en vez de
-- suponerlo.
--
-- `rounds_json` lleva el guion: un objeto por asalto con su título y lo que
-- toca. Formato libre a propósito: lo genera el modelo y el front lo normaliza.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

create table if not exists public.boxing_sessions (
  id                 uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,

  -- Nombre identificable: "Boxeo casa 45 min", "Saco y técnica 1h15".
  name               text not null,

  -- Dónde se entrena. Cambia el contenido de los asaltos, no solo el material.
  --   home = en casa / en solitario, sin saco
  --   gym  = gimnasio con material (saco, manoplas, compañero)
  place              text not null default 'home'
                     check (place in ('home', 'gym')),

  -- ── Configuración EXACTA del temporizador del Ring ──
  -- Se guarda tal cual la espera `TimerConfig` para que al tocar "empezar" el
  -- cronómetro arranque sin que nadie meta nada a mano. Es el punto del 28.
  rounds             smallint not null default 3  check (rounds between 1 and 24),
  round_sec          integer  not null default 180 check (round_sec between 15 and 900),
  rest_sec           integer  not null default 60  check (rest_sec between 0 and 600),
  prep_sec           integer  not null default 10  check (prep_sec between 0 and 120),
  warn_sec           integer  not null default 10  check (warn_sec between 0 and 60),

  -- Minutos de calentamiento y vuelta a la calma. Van aparte de los asaltos
  -- porque no los cronometra el temporizador: se hacen antes y después.
  warmup_min         smallint not null default 0 check (warmup_min between 0 and 60),
  cooldown_min       smallint not null default 0 check (cooldown_min between 0 and 60),

  -- Guion por asalto: [{ round, title, work }]. Ver cabecera.
  rounds_json        jsonb not null default '[]'::jsonb,

  note               text,
  -- manual = creado a mano | advisor = lo generó el Asesor | import = documento
  source             text not null default 'manual',

  -- Última vez que se lanzó, para poder ordenar por uso reciente.
  last_used_at       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Lo que se pide siempre es "mis entrenos de boxeo, el más reciente arriba".
create index if not exists boxing_sessions_owner_idx
  on public.boxing_sessions (fighter_profile_id, created_at desc);

alter table public.boxing_sessions enable row level security;

drop policy if exists "own boxing_sessions" on public.boxing_sessions;
create policy "own boxing_sessions" on public.boxing_sessions
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

-- El administrador puede leerlo para el modo "Ver como" (solo SELECT), igual
-- criterio que el resto de tablas de Mi Esquina. Se salta si rk_is_admin()
-- todavía no existe: las migraciones no siempre se aplican en orden.
do $$
begin
  if to_regprocedure('public.rk_is_admin()') is not null then
    drop policy if exists "admin read boxing_sessions" on public.boxing_sessions;
    create policy "admin read boxing_sessions" on public.boxing_sessions
      for select using (public.rk_is_admin());
  end if;
end $$;
