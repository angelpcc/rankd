-- ============================================================
-- RANKD · Perfil físico del peleador (fighter_physical)
--
-- La IA de planes (Plan IA por objetivo) necesita conocer al usuario para
-- generar algo útil: peso, altura, edad, sexo, deporte, nivel, días y minutos
-- disponibles, acceso a material y lesiones. Se guardan aquí, en una tabla 1:1
-- con el perfil, TODOS opcionales (el usuario puede omitir cualquiera). No se
-- meten en `profiles` para no engordar la tabla de identidad; misma pauta que
-- nutrition_goals / fighters.
--
-- La edad NO se almacena: se calcula de `birth_date` en el cliente.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente. Depende de
-- `profiles` (viene con Supabase Auth).
-- ============================================================

create table if not exists public.fighter_physical (
  fighter_profile_id uuid primary key references public.profiles(id) on delete cascade,
  weight_kg              numeric(5,1),
  height_cm              smallint,
  birth_date            date,
  sex                   text check (sex in ('male', 'female', 'other')),
  sport                 text check (sport in ('boxeo', 'mma', 'kickboxing', 'muaythai', 'otro')),
  level                 text check (level in ('principiante', 'amateur', 'competidor', 'profesional')),
  training_days_per_week smallint check (training_days_per_week between 0 and 14),
  session_minutes       smallint check (session_minutes between 0 and 600),
  equipment_access      text check (equipment_access in ('gimnasio_completo', 'gimnasio_basico', 'casa_material', 'casa_sin_material')),
  injuries_notes        text,
  updated_at            timestamptz not null default now()
);

alter table public.fighter_physical enable row level security;

-- El dueño gestiona su propio perfil físico.
drop policy if exists "own fighter_physical" on public.fighter_physical;
create policy "own fighter_physical" on public.fighter_physical
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

-- El administrador puede leerlo para el modo "ver como" (solo SELECT).
drop policy if exists "admin read fighter_physical" on public.fighter_physical;
create policy "admin read fighter_physical" on public.fighter_physical
  for select using (public.rk_is_admin());
