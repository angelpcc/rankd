-- ============================================================
-- RANKD · Ficha básica del alumno (gym_roster)
--
-- El entrenador que da de alta a alguien necesita apuntar cuatro cosas en el
-- momento: cómo localizarle, qué edad tiene, cuánto pesa y en qué nivel está.
-- Hasta ahora la lista solo guardaba el nombre y una nota suelta, así que esos
-- datos acababan en la agenda del móvil del entrenador o en ningún sitio.
--
-- TODO opcional: dar de alta a alguien tiene que seguir siendo escribir un
-- nombre y pulsar. Los demás campos se rellenan cuando se sepan.
--
-- PRIVACIDAD: son datos de terceros, algunos de ellos personales (teléfono,
-- fecha de nacimiento). No se añade ninguna política: heredan las de
-- gym_roster, que ya limitan la lectura al staff del club (rk_is_gym_staff) y
-- al propio alumno cuando está enlazado a una cuenta de RANKD. Nada de esto
-- aparece en ningún perfil público.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente. Depende de
-- gym_roster (migración 0022).
-- ============================================================

alter table public.gym_roster
  add column if not exists phone       text,
  add column if not exists birth_date  date,
  add column if not exists weight_kg   numeric(5,1),
  -- Mismo vocabulario que fighter_physical.level, para no inventar una escala
  -- distinta para lo mismo.
  add column if not exists level       text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'gym_roster_level_check'
  ) then
    alter table public.gym_roster
      add constraint gym_roster_level_check
      check (level is null or level in ('principiante', 'amateur', 'competidor', 'profesional'));
  end if;
end $$;
