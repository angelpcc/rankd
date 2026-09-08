-- ============================================================
-- RANKD · Mi Esquina · Vigencia por fecha de los suplementos
--
-- Los suplementos que se toman a diario deben verse en la Agenda día a día,
-- como un bloque recurrente. El problema de hacerlo con la lista actual es que
-- la lista es un ESTADO PRESENTE: si hoy añades omega-3, mirar el martes
-- pasado te lo mostraría también, y ese día no lo tomabas. Se estaría
-- reescribiendo el historial hacia atrás.
--
-- Con estas dos columnas cada suplemento pasa a tener un INTERVALO de vigencia:
--
--   · started_on → desde qué día se toma. Por defecto, el día en que se añadió
--                  (se rellena desde created_at, así las filas que ya existen
--                  quedan bien sin tocarlas a mano).
--   · ended_on   → día en que se dejó de tomar. NULL = se sigue tomando.
--                  Quitar un suplemento ya NO lo borra: le pone esta fecha.
--                  Así los días anteriores siguen mostrándolo, que es lo que
--                  realmente pasó, y los siguientes ya no.
--
-- Un día D muestra el suplemento si:
--     started_on <= D  AND  (ended_on IS NULL OR D < ended_on)
--
-- El front degrada con isMissingColumn: sin esta migración, la lista se
-- comporta como hasta ahora (todo vigente siempre, borrar borra de verdad).
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.user_supplements
  add column if not exists started_on date,
  add column if not exists ended_on   date;

-- Las filas que ya existían empiezan el día en que se crearon. Sin esto
-- tendrían started_on NULL y no aparecerían en ningún día.
update public.user_supplements
   set started_on = created_at::date
 where started_on is null;

-- A partir de aquí, lo normal es que lo ponga el cliente; el default cubre
-- cualquier inserción que se olvide de mandarlo.
alter table public.user_supplements
  alter column started_on set default current_date;

-- Sanidad: no se puede dejar de tomar algo antes de empezar.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_supplements_valid_range'
  ) then
    alter table public.user_supplements
      add constraint user_supplements_valid_range
      check (ended_on is null or started_on is null or ended_on >= started_on);
  end if;
end $$;

create index if not exists user_supplements_validity_idx
  on public.user_supplements (fighter_profile_id, started_on, ended_on);
