-- ============================================================
-- RANKD · Notificaciones internas + comunicados + incidencias
--
-- Añade:
--   1. notifications      → avisos dentro de la plataforma (campana)
--   2. Disparadores       → los avisos entre usuarios los crea la base de
--                           datos, no el navegador (nadie puede colar avisos
--                           en la bandeja de otro)
--   3. email_campaigns    → registro de los envíos masivos del admin
--   4. support_tickets    → incidencias que reporta un usuario
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run
-- Es seguro e idempotente: se puede ejecutar más de una vez.
-- ============================================================

-- Correo del administrador. Se usa en las políticas de lectura del panel.
-- Si algún día hay equipo, se amplía este array.
create or replace function public.rk_is_admin()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = any (array['angelpc2005@gmail.com']);
$$;


-- ════════════════════════════════════════════════
-- 1. NOTIFICACIONES
-- ════════════════════════════════════════════════
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- kind: training_reminder | inactivity | message | application | application_accepted
  --       | verification | ticket_sold | broadcast | system
  kind text not null default 'system',
  title text not null,
  body text,
  -- Ruta interna a la que lleva el aviso al pulsarlo (p. ej. /mi-esquina)
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- Solo lo pendiente de leer: es la consulta que hace la campana en cada carga.
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "own notifications update" on public.notifications;
create policy "own notifications update" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own notifications delete" on public.notifications;
create policy "own notifications delete" on public.notifications
  for delete using (auth.uid() = user_id);

-- Un usuario SOLO puede crearse avisos a sí mismo (recordatorios de entreno).
-- Los avisos que van a otra persona los generan los disparadores de abajo.
drop policy if exists "authenticated can notify" on public.notifications;
drop policy if exists "self notifications insert" on public.notifications;
create policy "self notifications insert" on public.notifications
  for insert to authenticated with check (auth.uid() = user_id);


-- ════════════════════════════════════════════════
-- 2. DISPARADORES: avisos entre usuarios
-- ════════════════════════════════════════════════

-- Helper interno. SECURITY DEFINER para poder escribir en la bandeja de otro.
create or replace function public.rk_notify(
  p_user uuid, p_kind text, p_title text, p_body text, p_link text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user, p_kind, p_title, p_body, p_link);
end;
$$;

-- ── Nuevo mensaje ──
create or replace function public.rk_on_new_message()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_other uuid;
  v_name  text;
begin
  select case when c.participant_1 = new.sender_id then c.participant_2 else c.participant_1 end
    into v_other
  from public.conversations c where c.id = new.conversation_id;

  if v_other is null or v_other = new.sender_id then return new; end if;

  select coalesce(p.full_name, 'Alguien') into v_name
  from public.profiles p where p.id = new.sender_id;

  -- Si ya tiene un aviso de mensaje sin leer, no lo repetimos: la campana
  -- debe avisar de que hay conversación, no marcar cada línea escrita.
  if exists (
    select 1 from public.notifications n
    where n.user_id = v_other and n.kind = 'message' and n.read_at is null
      and n.created_at > now() - interval '6 hours'
  ) then
    return new;
  end if;

  perform public.rk_notify(
    v_other, 'message',
    'Nuevo mensaje de ' || v_name,
    left(new.content, 120),
    '/dashboard?tab=messages'
  );
  return new;
end;
$$;

drop trigger if exists trg_rk_on_new_message on public.messages;
create trigger trg_rk_on_new_message
  after insert on public.messages
  for each row execute function public.rk_on_new_message();


-- ── Nueva candidatura a una oportunidad ──
create or replace function public.rk_on_new_application()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
  v_name  text;
begin
  select o.profile_id, o.title into v_owner, v_title
  from public.opportunities o where o.id = new.opportunity_id;

  select coalesce(p.full_name, 'Un peleador') into v_name
  from public.profiles p where p.id = new.fighter_profile_id;

  perform public.rk_notify(
    v_owner, 'application',
    'Nueva candidatura',
    v_name || ' se ha apuntado a «' || coalesce(v_title, 'tu oportunidad') || '»',
    '/dashboard?tab=applicants'
  );
  return new;
end;
$$;

drop trigger if exists trg_rk_on_new_application on public.applications;
create trigger trg_rk_on_new_application
  after insert on public.applications
  for each row execute function public.rk_on_new_application();


-- ── Candidatura aceptada o rechazada ──
create or replace function public.rk_on_application_decided()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_title text;
begin
  if new.status = old.status then return new; end if;

  select o.title into v_title
  from public.opportunities o where o.id = new.opportunity_id;

  if new.status = 'accepted' then
    perform public.rk_notify(
      new.fighter_profile_id, 'application_accepted',
      '¡Te han aceptado!',
      'Tu candidatura a «' || coalesce(v_title, 'una oportunidad') || '» ha sido aceptada.',
      '/opportunities'
    );
  elsif new.status = 'rejected' then
    perform public.rk_notify(
      new.fighter_profile_id, 'application',
      'Candidatura no seleccionada',
      'Esta vez no ha salido «' || coalesce(v_title, 'la oportunidad') || '». Hay más abiertas.',
      '/opportunities'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rk_on_application_decided on public.applications;
create trigger trg_rk_on_application_decided
  after update of status on public.applications
  for each row execute function public.rk_on_application_decided();


-- ── Resultado de la verificación ──
create or replace function public.rk_on_verification_decided()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.verification_status = old.verification_status then return new; end if;

  if new.verification_status = 'verified' then
    perform public.rk_notify(
      new.id, 'verification',
      'Perfil verificado',
      'Tu perfil ya luce el distintivo de verificado en todo RANKD.',
      '/dashboard'
    );
  elsif new.verification_status = 'rejected' then
    perform public.rk_notify(
      new.id, 'verification',
      'Verificación no aprobada',
      'No hemos podido confirmar tus datos. Revisa tu récord y vuelve a solicitarla.',
      '/dashboard'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rk_on_verification_decided on public.profiles;
create trigger trg_rk_on_verification_decided
  after update of verification_status on public.profiles
  for each row execute function public.rk_on_verification_decided();


-- ── Entrada reservada: avisa a la promotora ──
do $$
begin
  if to_regclass('public.ticket_orders') is not null then
    execute $fn$
      create or replace function public.rk_on_ticket_order()
      returns trigger
      language plpgsql security definer set search_path = public
      as $body$
      begin
        perform public.rk_notify(
          new.org_profile_id, 'ticket_sold',
          'Entrada reservada',
          new.buyer_name || ' ha reservado ' || new.quantity || ' entrada(s).',
          '/dashboard?tab=events'
        );
        return new;
      end;
      $body$;
    $fn$;
    execute 'drop trigger if exists trg_rk_on_ticket_order on public.ticket_orders';
    execute 'create trigger trg_rk_on_ticket_order after insert on public.ticket_orders for each row execute function public.rk_on_ticket_order()';
  end if;
end $$;


-- ════════════════════════════════════════════════
-- 3. HISTORIAL DE COMUNICADOS
-- ════════════════════════════════════════════════
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  audience text not null default 'all',
  recipients_count integer not null default 0,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists email_campaigns_created_idx
  on public.email_campaigns (created_at desc);

alter table public.email_campaigns enable row level security;

-- Lo lee el administrador desde su panel. La escritura la hace la función
-- serverless con la service_role key, que se salta RLS.
drop policy if exists "own campaigns read" on public.email_campaigns;
drop policy if exists "admin campaigns read" on public.email_campaigns;
create policy "admin campaigns read" on public.email_campaigns
  for select using (public.rk_is_admin() or auth.uid() = sent_by);


-- ════════════════════════════════════════════════
-- 4. INCIDENCIAS / SOPORTE
-- ════════════════════════════════════════════════
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  -- topic: bug | cuenta | pago | contenido | otro
  topic text not null default 'otro',
  subject text not null,
  message text not null,
  contact_email text,
  status text not null default 'open',   -- open | in_progress | closed
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "create own ticket" on public.support_tickets;
create policy "create own ticket" on public.support_tickets
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "read own ticket" on public.support_tickets;
create policy "read own ticket" on public.support_tickets
  for select using (auth.uid() = user_id or public.rk_is_admin());

drop policy if exists "admin updates ticket" on public.support_tickets;
create policy "admin updates ticket" on public.support_tickets
  for update using (public.rk_is_admin()) with check (public.rk_is_admin());
