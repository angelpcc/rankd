-- ============================================================
-- RANKD · Métricas de uso y RECURRENCIA
--
-- Registrar altas es fácil; lo que de verdad dice si el producto funciona es
-- cuánta gente VUELVE. Para eso hace falta saber qué días entra cada usuario.
--
-- Se guarda UNA FILA POR USUARIO Y DÍA, no una por visita: es suficiente para
-- calcular recurrencia y días entre visitas, y mantiene la tabla pequeña
-- (un usuario diario genera 365 filas al año).
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

create table if not exists public.user_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_date date not null default current_date,
  first_seen_at timestamptz not null default now(),
  -- Se actualiza en cada carga: permite estimar "activos ahora mismo"
  last_seen_at timestamptz not null default now(),
  -- Cuántas veces ha abierto la plataforma ese día
  loads integer not null default 1,
  primary key (user_id, visit_date)
);

create index if not exists user_visits_date_idx
  on public.user_visits (visit_date desc);
create index if not exists user_visits_last_seen_idx
  on public.user_visits (last_seen_at desc);

alter table public.user_visits enable row level security;

-- Cada uno puede registrar y ver su propia visita; el admin las lee todas.
drop policy if exists "own visits insert" on public.user_visits;
create policy "own visits insert" on public.user_visits
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own visits update" on public.user_visits;
create policy "own visits update" on public.user_visits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own or admin visits read" on public.user_visits;
create policy "own or admin visits read" on public.user_visits
  for select using (auth.uid() = user_id or public.rk_is_admin());


-- ────────────────────────────────────────────────
-- Registro de visita (idempotente por día)
-- El cliente la llama una vez por sesión de navegador.
-- ────────────────────────────────────────────────
create or replace function public.rk_track_visit()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;

  insert into public.user_visits (user_id, visit_date, first_seen_at, last_seen_at, loads)
  values (auth.uid(), current_date, now(), now(), 1)
  on conflict (user_id, visit_date) do update
    set last_seen_at = now(),
        loads = public.user_visits.loads + 1;
end;
$$;

grant execute on function public.rk_track_visit() to authenticated;


-- ────────────────────────────────────────────────
-- Resumen de recurrencia (solo administrador)
--
-- Devuelve de una sola pasada lo que cuesta calcular en el cliente:
-- cuánta gente ha vuelto, qué porcentaje representa y cuántos días de media
-- pasan entre una visita y la siguiente.
-- ────────────────────────────────────────────────
create or replace function public.rk_retention()
returns table (
  total_users integer,
  active_7d integer,
  active_30d integer,
  active_15m integer,
  returning_users integer,   -- han entrado 2 o más días distintos
  one_and_done integer,      -- se registraron y solo entraron un día
  avg_days_between numeric,
  avg_visit_days numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.rk_is_admin() then
    raise exception 'solo administradores';
  end if;

  select count(*)::integer into total_users from public.profiles;

  select count(distinct user_id)::integer into active_7d
  from public.user_visits where visit_date >= current_date - 7;

  select count(distinct user_id)::integer into active_30d
  from public.user_visits where visit_date >= current_date - 30;

  select count(distinct user_id)::integer into active_15m
  from public.user_visits where last_seen_at >= now() - interval '15 minutes';

  select count(*)::integer into returning_users
  from (select user_id from public.user_visits group by user_id having count(*) > 1) r;

  select count(*)::integer into one_and_done
  from (select user_id from public.user_visits group by user_id having count(*) = 1) o;

  -- Días de media entre la primera y la última visita, repartidos entre el
  -- número de intervalos. Solo tiene sentido en quien ha vuelto al menos una vez.
  select round(avg(span), 1) into avg_days_between
  from (
    select (max(visit_date) - min(visit_date))::numeric / nullif(count(*) - 1, 0) as span
    from public.user_visits
    group by user_id
    having count(*) > 1
  ) s;

  select round(avg(d), 1) into avg_visit_days
  from (select count(*)::numeric as d from public.user_visits group by user_id) v;

  return next;
end;
$$;

grant execute on function public.rk_retention() to authenticated;
