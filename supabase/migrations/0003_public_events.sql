-- ============================================================
-- RANKD · Escaparate público de eventos
-- Permite que cualquier visitante (incluido anónimo) pueda VER los
-- eventos que publican promotoras y gimnasios en /eventos.
-- Las políticas de escritura del dueño ya existentes se mantienen:
-- esto solo AÑADE lectura pública.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run
-- ============================================================

alter table public.organization_events enable row level security;

-- Lectura pública de todos los eventos publicados por promotoras/gimnasios.
-- (Cada evento se crea con la intención de ser visible; el dueño sigue
--  siendo el único que puede crear/editar/borrar mediante sus políticas.)
drop policy if exists "public read events" on public.organization_events;
create policy "public read events" on public.organization_events
  for select
  using (true);
