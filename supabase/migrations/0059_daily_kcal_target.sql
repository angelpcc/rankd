-- ============================================================
-- 0059 · Objetivo diario de calorías fijado a mano
--
-- POR QUÉ
--
-- La app calcula el objetivo diario (Mifflin-St Jeor con el peso, la altura, la
-- edad, el sexo y los días de entreno; ver src/pages/mi-esquina/lib/
-- objetivoDiario.ts). Pero quien tiene nutricionista ya tiene SU cifra y no
-- quiere otra: la pone a mano y la app entera pasa a medirse contra ella.
--
-- Solo se guarda la cifra de calorías. Las macros se derivan (proteína por kilo
-- de peso, grasa al 25 %, hidratos el resto), así que guardar también gramos
-- sería guardar algo que se puede quedar desincronizado.
--
-- null = usar el cálculo.
--
-- Sin esta migración la app funciona igual: guarda la cifra en el dispositivo.
-- Con ella, se ve en todos.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.nutrition_goals
  add column if not exists daily_kcal_target integer;

-- Fuera de este rango es un error al teclear, no una dieta.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'nutrition_goals_daily_kcal_target_range'
  ) then
    alter table public.nutrition_goals
      add constraint nutrition_goals_daily_kcal_target_range
      check (daily_kcal_target is null or daily_kcal_target between 1000 and 6000);
  end if;
end $$;

comment on column public.nutrition_goals.daily_kcal_target is
  'Calorías al día fijadas por el usuario. null = usar el cálculo de la app (src/pages/mi-esquina/lib/objetivoDiario.ts).';
