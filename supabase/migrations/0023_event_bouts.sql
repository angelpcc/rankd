-- ============================================================
-- RANKD · Gestión de eventos: estados + cartelera de combates (R13-T2)
--
-- 1. organization_events gana un estado real: borrador | publicado. Solo los
--    publicados salen en la cartelera pública. (add-if-not-exists, y por
--    defecto 'published' para que los eventos ya creados sigan visibles.)
-- 2. event_bouts → la cartelera de combates de cada evento: quién pelea, en qué
--    orden, categoría de peso, asaltos, combate estelar y resultado.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.organization_events add column if not exists status text not null default 'published';

-- ────────────────────────────────────────────────
-- CARTELERA DE COMBATES
-- ────────────────────────────────────────────────
create table if not exists public.event_bouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.organization_events(id) on delete cascade,
  -- Se guarda el dueño para poder escribir la RLS sin un join a organization_events.
  org_profile_id uuid not null references public.profiles(id) on delete cascade,
  bout_order int not null default 0,
  -- Cada esquina: enlazada a un perfil RANKD (para llevar a su ficha) o nombre
  -- suelto si el peleador aún no está en la plataforma.
  fighter_a_profile_id uuid references public.profiles(id) on delete set null,
  fighter_a_name text,
  fighter_b_profile_id uuid references public.profiles(id) on delete set null,
  fighter_b_name text,
  weight_class text,
  rounds int,
  is_main boolean not null default false,
  status text not null default 'confirmed',   -- confirmed | tentative
  -- Resultado tras la velada: 'a' | 'b' | 'draw' | null (sin disputar todavía)
  result text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists event_bouts_event_idx on public.event_bouts (event_id, bout_order);
alter table public.event_bouts enable row level security;

-- La promotora dueña del evento gestiona su cartelera.
drop policy if exists "owner manages bouts" on public.event_bouts;
create policy "owner manages bouts" on public.event_bouts
  for all using (auth.uid() = org_profile_id) with check (auth.uid() = org_profile_id);

-- Lectura pública: la cartelera se muestra en la página del evento. No es dato
-- sensible; el evento en borrador ya queda oculto de la lista por su estado.
drop policy if exists "public read bouts" on public.event_bouts;
create policy "public read bouts" on public.event_bouts
  for select using (true);
