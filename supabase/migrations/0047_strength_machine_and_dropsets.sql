-- ============================================================
-- RANKD · Mi Esquina · Fuerza: máquina concreta y series descendentes
--
-- Dos columnas aditivas sobre strength_sets. Ambas nullable, así que las filas
-- que ya existen siguen siendo válidas y el front degrada con isMissingColumn
-- si esta migración todavía no está aplicada.
--
-- 1. machine_label → EN QUÉ máquina o polea concreta se hizo la serie.
--
--    El mismo ejercicio marca números distintos según el aparato: un jalón en
--    polea puede poner 18 en un gimnasio y 30 en otro sin que la fuerza real
--    haya cambiado. Comparar esos números entre sí no significa nada.
--
--    Con esta columna, la comparación de progreso (última vez, sugerencia,
--    gráfico y marcas personales) se hace SOLO entre series con el mismo valor.
--    Vacío o NULL = "sin especificar", y esas se comparan entre ellas como
--    siempre. Es texto libre corto porque los nombres de máquina son del
--    gimnasio del usuario, no de un catálogo que podamos cerrar.
--
--    OJO: NO sirve para distinguir polea de máquina guiada. Eso ya está
--    separado por nombre en la biblioteca ("Jalón al pecho (polea)" vs
--    "(máquina guiada)"). Esta columna distingue DOS MÁQUINAS DISTINTAS de la
--    misma variante: dos gimnasios, dos marcas.
--
-- 2. drop_step → posición dentro de una serie descendente (dropset).
--
--    Un dropset es UNA serie con varias bajadas de peso encadenadas sin
--    descanso: 40 kg x 8, 30 kg x 6, 20 kg x 8. Se sigue guardando una fila
--    por escalón (el modelo de "una fila por serie" no cambia, y así el
--    volumen levantado sigue saliendo solo), pero los escalones de una misma
--    serie COMPARTEN set_number y se numeran aquí 1, 2, 3…
--
--    NULL = serie normal de toda la vida. Si esta migración no está aplicada,
--    los escalones se guardan igual como series sueltas: el dato es correcto,
--    solo se pierde la agrupación visual en el historial.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.strength_sets
  add column if not exists machine_label text,
  add column if not exists drop_step     smallint;

-- Búsqueda de "cómo fue la última vez en ESTA máquina": el índice existente
-- (fighter, exercise, date desc) ya acota casi todo; machine_label se filtra
-- sobre un conjunto pequeño, así que no hace falta índice propio.

-- Sanidad: el escalón, si existe, empieza en 1.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'strength_sets_drop_step_positive'
  ) then
    alter table public.strength_sets
      add constraint strength_sets_drop_step_positive
      check (drop_step is null or drop_step >= 1);
  end if;
end $$;
