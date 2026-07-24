-- ============================================================
-- RANKD · Directorio público de promotoras y gimnasios
-- Permite que cualquier visitante vea las organizaciones que se han
-- marcado como públicas (is_public = true) en /promotoras.
-- Las políticas de escritura del dueño se mantienen: esto solo AÑADE
-- lectura pública, y solo de las que el dueño ha decidido publicar.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run
-- NOTA: puede que ya tengas lectura pública (el home ya lista partners).
-- Ejecutarlo igualmente es seguro e idempotente.
-- ============================================================

alter table public.organizations enable row level security;

drop policy if exists "public read published organizations" on public.organizations;
create policy "public read published organizations" on public.organizations
  for select
  using (is_public = true or auth.uid() = profile_id);
