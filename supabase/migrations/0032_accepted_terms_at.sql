-- ============================================================
-- RANKD · Constancia de aceptación de términos y privacidad
--
-- El registro exige (en el front) marcar un checkbox de aceptación de la
-- Política de privacidad y los Términos y condiciones. Guardamos la fecha en
-- el perfil para tener trazabilidad legal: cuándo aceptó cada usuario.
--
-- Nullable a propósito: las cuentas antiguas (creadas antes de esta columna)
-- se quedan con null y NO se les fuerza reaceptar retroactivamente. Los nuevos
-- registros sí lo guardan siempre.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente. Aditiva
-- y segura. Sin ella, el front sigue funcionando: el checkbox se muestra y
-- se valida en cliente igualmente; solo se pierde la trazabilidad en BD.
-- ============================================================

alter table public.profiles
  add column if not exists accepted_terms_at timestamptz;
