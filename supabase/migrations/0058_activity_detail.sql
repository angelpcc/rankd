-- ============================================================
-- 0058 · El detalle de una sesión que no cabe en columnas
--
-- POR QUÉ
--
-- `activity_sessions` tiene columnas para lo que comparten todas las
-- actividades: duración, distancia, ritmo, rondas, inclinación, pulso. Eso vale
-- para correr, para la cinta y para la bici.
--
-- No vale para Hyrox ni para CrossFit:
--
--   · Un Hyrox son OCHO estaciones fijas, cada una con su tiempo y su carga.
--     Guardarlo en columnas serían dieciséis columnas usadas por un solo tipo
--     de actividad y vacías en todas las demás.
--   · Un WOD es un FORMATO (AMRAP, EMOM, For Time…) con sus movimientos y sus
--     cargas, y el número de movimientos es libre.
--
-- Un jsonb es la forma honesta de eso: estructura variable que solo entiende
-- quien la escribe. Lo que SÍ es común (duración, rondas) se sigue guardando en
-- sus columnas, así que las gráficas y los totales de siempre no se enteran de
-- este cambio.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.activity_sessions
  add column if not exists detail jsonb;

comment on column public.activity_sessions.detail is
  'Detalle propio del tipo de actividad: estaciones de Hyrox, o formato y movimientos de un WOD. Ver src/pages/mi-esquina/lib/sportSpecs.ts.';
