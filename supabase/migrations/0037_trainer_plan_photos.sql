-- ============================================================
-- RANKD · Mi Esquina · Foto del plan de mi entrenador
--
-- El peleador hace foto (o sube imagen/PDF) del papel o mensaje con la
-- rutina que le ha dado su entrenador real, y la guarda para consultarla en
-- el gimnasio. Solo almacenamiento — sin interpretación automática (eso es
-- un paso posterior, cuando haya clave de IA activa).
--
--   1. trainer_plan_photos → una fila por foto subida
--   2. reutiliza el bucket PRIVADO 'fighter-docs' (migración 0016), carpeta
--      <uid>/plans/... — mismas políticas de Storage por carpeta, no hace
--      falta bucket nuevo.
--
-- PRIVACIDAD: mismo criterio que fighter_documents — solo su dueño, sin
-- política de administrador.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

create table if not exists public.trainer_plan_photos (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  -- Ruta dentro del bucket privado 'fighter-docs': <uid>/plans/<archivo>
  file_path text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists trainer_plan_photos_owner_idx
  on public.trainer_plan_photos (fighter_profile_id, created_at desc);

alter table public.trainer_plan_photos enable row level security;

drop policy if exists "own trainer_plan_photos" on public.trainer_plan_photos;
create policy "own trainer_plan_photos" on public.trainer_plan_photos
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);
