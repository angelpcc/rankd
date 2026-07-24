-- ============================================================
-- RANKD · Venta de entradas para eventos
-- Tipos de entrada por evento + pedidos/reservas.
-- (Sin pasarela de pago real todavía: los pedidos se crean como
--  'pending'. Ver PAGOS.md para conectar Stripe.)
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run
-- Requiere haber aplicado antes 0003_public_events.sql
-- ============================================================

-- ── Tipos de entrada de un evento ───────────────────────────
create table if not exists public.event_tickets (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.organization_events(id) on delete cascade,
  org_profile_id   uuid not null references public.profiles(id) on delete cascade,
  name             text not null,                 -- "General", "VIP", "Ringside"
  description      text,
  price_cents      integer not null default 0,    -- precio en céntimos (0 = gratis)
  currency         text not null default 'EUR',
  quantity_total   integer not null default 0,    -- 0 = sin límite
  quantity_sold    integer not null default 0,
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists event_tickets_event_idx on public.event_tickets (event_id);

-- ── Pedidos / reservas de entradas ──────────────────────────
create table if not exists public.ticket_orders (
  id                uuid primary key default gen_random_uuid(),
  ticket_id         uuid not null references public.event_tickets(id) on delete cascade,
  event_id          uuid not null references public.organization_events(id) on delete cascade,
  org_profile_id    uuid not null references public.profiles(id) on delete cascade,
  buyer_user_id     uuid not null references auth.users(id) on delete cascade,
  buyer_name        text not null,
  buyer_email       text not null,
  quantity          integer not null default 1,
  unit_price_cents  integer not null,
  total_cents       integer not null,
  status            text not null default 'pending',  -- 'pending' | 'paid' | 'cancelled'
  created_at        timestamptz not null default now()
);

create index if not exists ticket_orders_event_idx on public.ticket_orders (event_id);
create index if not exists ticket_orders_buyer_idx on public.ticket_orders (buyer_user_id);

-- ── RLS ─────────────────────────────────────────────────────
alter table public.event_tickets enable row level security;
alter table public.ticket_orders enable row level security;

-- event_tickets: lectura pública de las activas; el dueño gestiona las suyas
drop policy if exists "public read active tickets" on public.event_tickets;
create policy "public read active tickets" on public.event_tickets
  for select using (is_active = true or auth.uid() = org_profile_id);

drop policy if exists "owner manage tickets" on public.event_tickets;
create policy "owner manage tickets" on public.event_tickets
  for all using (auth.uid() = org_profile_id) with check (auth.uid() = org_profile_id);

-- ticket_orders: el comprador crea/lee lo suyo; el dueño del evento lee/gestiona
drop policy if exists "buyer insert own order" on public.ticket_orders;
create policy "buyer insert own order" on public.ticket_orders
  for insert with check (auth.uid() = buyer_user_id);

drop policy if exists "buyer read own order" on public.ticket_orders;
create policy "buyer read own order" on public.ticket_orders
  for select using (auth.uid() = buyer_user_id or auth.uid() = org_profile_id);

drop policy if exists "owner manage orders" on public.ticket_orders;
create policy "owner manage orders" on public.ticket_orders
  for update using (auth.uid() = org_profile_id) with check (auth.uid() = org_profile_id);

-- ── Stock: al crear un pedido, incrementa quantity_sold ─────
-- (SECURITY DEFINER para poder tocar event_tickets aunque el comprador
--  no sea el dueño; mantiene el stock real sin lógica en el cliente.)
create or replace function public.bump_ticket_sold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_tickets
    set quantity_sold = quantity_sold + new.quantity
    where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_ticket_sold on public.ticket_orders;
create trigger trg_bump_ticket_sold
  after insert on public.ticket_orders
  for each row execute function public.bump_ticket_sold();
