-- ============================================================
-- RANKD · Métricas de embudo del escaparate de marca (R13-T4)
--
-- Registra eventos anónimos del escaparate para que la marca vea, en su panel:
--   · view          → cuánta gente ha visto su escaparate dentro de RANKD
--   · website_click → clics en su "ir a la web"
--   · product_click → clics en el enlace de compra de CADA producto
--
-- Nota honesta sobre conversión: la compra ocurre en la web externa de la
-- marca, fuera de RANKD, así que NO podemos confirmar ventas reales. El clic en
-- el enlace de compra es lo más cercano (intención de compra) y así se presenta.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

create table if not exists public.brand_events (
  id uuid primary key default gen_random_uuid(),
  org_profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,                 -- view | website_click | product_click
  product_id uuid,                    -- solo en product_click
  created_at timestamptz not null default now()
);
create index if not exists brand_events_org_idx on public.brand_events (org_profile_id, created_at);

alter table public.brand_events enable row level security;

-- Cualquier visitante (incluido anónimo) puede REGISTRAR un evento: es telemetría
-- del escaparate público. No puede leer nada.
drop policy if exists "anyone logs brand event" on public.brand_events;
create policy "anyone logs brand event" on public.brand_events
  for insert with check (true);

-- Solo la marca dueña puede LEER sus métricas.
drop policy if exists "owner reads brand events" on public.brand_events;
create policy "owner reads brand events" on public.brand_events
  for select using (auth.uid() = org_profile_id);

grant insert on public.brand_events to anon, authenticated;
grant select on public.brand_events to authenticated;
