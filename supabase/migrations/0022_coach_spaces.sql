-- ============================================================
-- RANKD · Espacio de entrenador (R13-T1)
--
-- El entrenador de un gimnasio dirige el trabajo de su GRUPO, no el suyo.
-- Piezas:
--   1. gym_staff        → vincula la cuenta del coach con su gimnasio
--   2. gym_invitations  → alta por código/enlace compartible (nunca creamos
--                         cuentas ajenas: el coach se registra y acepta)
--   3. gym_roster       → los boxeadores del club (con consentimiento explícito
--                         para compartir su actividad — privacidad de Mi Esquina)
--   4. club_sessions    → el plan semanal del club (mañana/tarde, grupo, tipo)
--   + RPCs SECURITY DEFINER para aceptar invitación, asignar sesión a boxeadores
--     y leer un resumen de actividad SOLO de quien ha dado su consentimiento.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

-- El plan del coach se vuelca en planned_events con source='coach'. La columna
-- source la añade 0021; la replicamos aquí (add if not exists) para no depender
-- del orden de aplicación.
alter table public.planned_events add column if not exists source text not null default 'manual';

-- ────────────────────────────────────────────────
-- 1. PLANTILLA DEL GIMNASIO — coaches vinculados
-- ────────────────────────────────────────────────
create table if not exists public.gym_staff (
  id uuid primary key default gen_random_uuid(),
  org_profile_id uuid not null references public.profiles(id) on delete cascade,
  coach_profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'coach',
  status text not null default 'active',   -- active | inactive
  created_at timestamptz not null default now(),
  unique (org_profile_id, coach_profile_id)
);
create index if not exists gym_staff_org_idx on public.gym_staff (org_profile_id);
create index if not exists gym_staff_coach_idx on public.gym_staff (coach_profile_id);
alter table public.gym_staff enable row level security;

drop policy if exists "coach reads own staff" on public.gym_staff;
create policy "coach reads own staff" on public.gym_staff
  for select using (auth.uid() = coach_profile_id);
drop policy if exists "org reads its staff" on public.gym_staff;
create policy "org reads its staff" on public.gym_staff
  for select using (auth.uid() = org_profile_id);
drop policy if exists "org manages its staff" on public.gym_staff;
create policy "org manages its staff" on public.gym_staff
  for all using (auth.uid() = org_profile_id) with check (auth.uid() = org_profile_id);
drop policy if exists "coach leaves gym" on public.gym_staff;
create policy "coach leaves gym" on public.gym_staff
  for delete using (auth.uid() = coach_profile_id);

-- ¿Es la persona actual staff (dueño o coach activo) de este gimnasio?
-- SECURITY DEFINER para poder usarse dentro de las políticas de otras tablas
-- sin toparse con su propia RLS.
create or replace function public.rk_is_gym_staff(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select org = auth.uid()
    or exists (
      select 1 from public.gym_staff s
      where s.org_profile_id = org
        and s.coach_profile_id = auth.uid()
        and s.status = 'active'
    );
$$;
grant execute on function public.rk_is_gym_staff(uuid) to authenticated;

-- ────────────────────────────────────────────────
-- 2. INVITACIONES — alta de coach por código/enlace
-- ────────────────────────────────────────────────
create table if not exists public.gym_invitations (
  id uuid primary key default gen_random_uuid(),
  org_profile_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique,
  email text,
  invited_name text,
  role text not null default 'coach',
  status text not null default 'pending',   -- pending | accepted | revoked
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists gym_invitations_org_idx on public.gym_invitations (org_profile_id);
alter table public.gym_invitations enable row level security;

-- El gimnasio gestiona sus propias invitaciones. La ACEPTACIÓN va por RPC
-- (SECURITY DEFINER), así que no hace falta abrir lectura a terceros.
drop policy if exists "org manages own invites" on public.gym_invitations;
create policy "org manages own invites" on public.gym_invitations
  for all using (auth.uid() = org_profile_id) with check (auth.uid() = org_profile_id);

-- Muestra el nombre del gimnasio a partir del código, sin necesidad de sesión,
-- para que la pantalla de "unirte" sepa a qué club te invitan.
create or replace function public.rk_gym_invite_info(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare inv record; gym_name text;
begin
  select * into inv from public.gym_invitations where code = p_code limit 1;
  if inv is null then return jsonb_build_object('found', false); end if;
  select org_name into gym_name from public.organizations where profile_id = inv.org_profile_id;
  return jsonb_build_object('found', true, 'status', inv.status, 'gym', coalesce(gym_name, ''));
end $$;
grant execute on function public.rk_gym_invite_info(text) to anon, authenticated;

-- Aceptar la invitación: vincula al coach, lo marca como tal y cierra la invitación.
create or replace function public.rk_accept_gym_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv record; gym_name text;
begin
  select * into inv from public.gym_invitations where code = p_code and status = 'pending' limit 1;
  if inv is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;

  insert into public.gym_staff (org_profile_id, coach_profile_id, role, status)
    values (inv.org_profile_id, auth.uid(), coalesce(inv.role, 'coach'), 'active')
    on conflict (org_profile_id, coach_profile_id) do update set status = 'active';

  -- Se convierte en entrenador salvo que ya sea una organización (un dueño de
  -- gimnasio no debe perder su tipo; de todos modos él no necesita invitación).
  update public.profiles set user_type = 'coach', updated_at = now()
    where id = auth.uid()
      and user_type not in ('gym', 'promoter', 'manager', 'brand', 'coach');

  update public.gym_invitations
    set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
    where id = inv.id;

  select org_name into gym_name from public.organizations where profile_id = inv.org_profile_id;
  return jsonb_build_object('ok', true, 'org', inv.org_profile_id, 'gym', coalesce(gym_name, ''));
end $$;
grant execute on function public.rk_accept_gym_invite(text) to authenticated;

-- ────────────────────────────────────────────────
-- 3. ROSTER — los boxeadores del club
-- ────────────────────────────────────────────────
create table if not exists public.gym_roster (
  id uuid primary key default gen_random_uuid(),
  org_profile_id uuid not null references public.profiles(id) on delete cascade,
  -- Enlazado si es usuario de RANKD; si no, solo un nombre para la lista.
  fighter_profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  note text,
  status text not null default 'active',        -- active | left
  -- Consentimiento del boxeador para que el gimnasio vea su actividad reciente.
  -- Arranca en false: el club puede tenerlo en su lista, pero NADA de su
  -- Mi Esquina se comparte hasta que él lo autoriza.
  shares_activity boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gym_roster_org_idx on public.gym_roster (org_profile_id);
create index if not exists gym_roster_fighter_idx on public.gym_roster (fighter_profile_id);
alter table public.gym_roster enable row level security;

drop policy if exists "staff read roster" on public.gym_roster;
create policy "staff read roster" on public.gym_roster
  for select using (public.rk_is_gym_staff(org_profile_id));
drop policy if exists "staff manage roster" on public.gym_roster;
create policy "staff manage roster" on public.gym_roster
  for all using (public.rk_is_gym_staff(org_profile_id)) with check (public.rk_is_gym_staff(org_profile_id));
-- El boxeador enlazado ve sus propias filas y controla su consentimiento / se va.
drop policy if exists "fighter reads own roster" on public.gym_roster;
create policy "fighter reads own roster" on public.gym_roster
  for select using (auth.uid() = fighter_profile_id);
drop policy if exists "fighter updates own roster" on public.gym_roster;
create policy "fighter updates own roster" on public.gym_roster
  for update using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

-- Resumen de actividad SOLO de quien ha dado su consentimiento. Devuelve
-- recuentos y la última fecha, nunca el contenido privado de las sesiones.
create or replace function public.rk_roster_activity(p_org uuid)
returns table (fighter_profile_id uuid, last_session date, sessions_week int, minutes_week int)
language plpgsql stable security definer set search_path = public as $$
declare week_start date := current_date - (((extract(dow from current_date)::int + 6) % 7));
begin
  if not public.rk_is_gym_staff(p_org) then return; end if;
  return query
    select r.fighter_profile_id,
           max(ts.session_date) as last_session,
           count(ts.id) filter (where ts.session_date >= week_start)::int as sessions_week,
           coalesce(sum(ts.duration_min) filter (where ts.session_date >= week_start), 0)::int as minutes_week
    from public.gym_roster r
    left join public.training_sessions ts on ts.fighter_profile_id = r.fighter_profile_id
    where r.org_profile_id = p_org
      and r.status = 'active'
      and r.shares_activity = true
      and r.fighter_profile_id is not null
    group by r.fighter_profile_id;
end $$;
grant execute on function public.rk_roster_activity(uuid) to authenticated;

-- ────────────────────────────────────────────────
-- 4. PLAN DEL CLUB — la semana de entrenos del gimnasio
-- ────────────────────────────────────────────────
create table if not exists public.club_sessions (
  id uuid primary key default gen_random_uuid(),
  org_profile_id uuid not null references public.profiles(id) on delete cascade,
  coach_profile_id uuid references public.profiles(id) on delete set null,
  session_date date not null,
  part_of_day text not null default 'evening',  -- morning | afternoon | evening
  session_type text not null default 'tecnica',
  title text not null,
  group_label text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists club_sessions_org_date_idx on public.club_sessions (org_profile_id, session_date);
alter table public.club_sessions enable row level security;

drop policy if exists "staff read club_sessions" on public.club_sessions;
create policy "staff read club_sessions" on public.club_sessions
  for select using (public.rk_is_gym_staff(org_profile_id));
drop policy if exists "staff manage club_sessions" on public.club_sessions;
create policy "staff manage club_sessions" on public.club_sessions
  for all using (public.rk_is_gym_staff(org_profile_id)) with check (public.rk_is_gym_staff(org_profile_id));

-- Asignar una sesión a uno o varios boxeadores del club: aparece SUGERIDA en su
-- propio plan (planned_events, source='coach'), nunca se auto-añade sin que la
-- vea. Solo llega a boxeadores que estén en el roster de ese gimnasio.
create or replace function public.rk_coach_assign_plan(
  p_org uuid, p_fighter_ids uuid[], p_event_date date, p_session_type text,
  p_title text, p_time text, p_notes text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare fid uuid; n int := 0;
begin
  if not public.rk_is_gym_staff(p_org) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  foreach fid in array p_fighter_ids loop
    if exists (
      select 1 from public.gym_roster r
      where r.org_profile_id = p_org and r.fighter_profile_id = fid and r.status = 'active'
    ) then
      insert into public.planned_events (fighter_profile_id, event_date, kind, session_type, title, time, notes, source)
        values (fid, p_event_date, 'training', p_session_type, p_title, nullif(p_time, ''), nullif(p_notes, ''), 'coach');
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'count', n);
end $$;
grant execute on function public.rk_coach_assign_plan(uuid, uuid[], date, text, text, text) to authenticated;
