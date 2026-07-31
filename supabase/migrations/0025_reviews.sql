-- ============================================================
-- RANKD · Reseñas de confianza de promotoras/gimnasios/marcas (R13-T7)
--
-- Un peleador solo puede reseñar a una organización con la que tenga una
-- RELACIÓN VERIFICABLE en la plataforma. Se comprueba en servidor (no en el
-- cliente) mediante rk_can_review, usada dentro de la política de inserción:
--   · application → tuvo una postulación ACEPTADA a una oportunidad suya
--   · bout        → aparece en la cartelera de un evento suyo
--   · roster      → está en el roster de ese gimnasio
--
-- Requiere que existan applications/opportunities (base) y event_bouts (0023) /
-- gym_roster (0022): aplica las migraciones en orden.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

create table if not exists public.org_reviews (
  id uuid primary key default gen_random_uuid(),
  org_profile_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  relationship text,          -- application | bout | roster (cómo se acreditó)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_profile_id, reviewer_profile_id)
);
create index if not exists org_reviews_org_idx on public.org_reviews (org_profile_id);
alter table public.org_reviews enable row level security;

-- Lectura pública: las reseñas se muestran en el perfil y el directorio.
drop policy if exists "public read reviews" on public.org_reviews;
create policy "public read reviews" on public.org_reviews
  for select using (true);

-- ¿Puede el peleador actual reseñar a esta organización? Devuelve el tipo de
-- relación acreditada, o NULL si no la hay. SECURITY DEFINER para poder mirar
-- las tablas de relación sin chocar con su RLS.
create or replace function public.rk_can_review(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (
      select 1 from public.applications a
      join public.opportunities o on a.opportunity_id = o.id
      where o.profile_id = p_org and a.fighter_profile_id = auth.uid() and a.status = 'accepted'
    ) then 'application'
    when exists (
      select 1 from public.event_bouts b
      where b.org_profile_id = p_org
        and (b.fighter_a_profile_id = auth.uid() or b.fighter_b_profile_id = auth.uid())
    ) then 'bout'
    when exists (
      select 1 from public.gym_roster r
      where r.org_profile_id = p_org and r.fighter_profile_id = auth.uid() and r.status = 'active'
    ) then 'roster'
    else null
  end;
$$;
grant execute on function public.rk_can_review(uuid) to authenticated;

-- Solo el propio peleador escribe su reseña, y SOLO si tiene relación acreditada.
drop policy if exists "fighter writes verified review" on public.org_reviews;
create policy "fighter writes verified review" on public.org_reviews
  for insert with check (
    auth.uid() = reviewer_profile_id and public.rk_can_review(org_profile_id) is not null
  );
drop policy if exists "fighter updates own review" on public.org_reviews;
create policy "fighter updates own review" on public.org_reviews
  for update using (auth.uid() = reviewer_profile_id) with check (auth.uid() = reviewer_profile_id);
drop policy if exists "fighter deletes own review" on public.org_reviews;
create policy "fighter deletes own review" on public.org_reviews
  for delete using (auth.uid() = reviewer_profile_id);

-- Resumen de valoración por organización, para el perfil y el directorio.
create or replace view public.org_rating_summary as
  select org_profile_id,
         round(avg(rating)::numeric, 1) as avg_rating,
         count(*)::int as review_count
  from public.org_reviews
  group by org_profile_id;
grant select on public.org_rating_summary to anon, authenticated;
