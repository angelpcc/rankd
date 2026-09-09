-- ============================================================
-- RANKD · Permitir el tipo de cuenta 'coach' en profiles
--
-- BUG DE FONDO, no una mejora: `profiles.user_type` tiene un CHECK que admite
-- fighter / promoter / manager / brand / gym pero NO 'coach'. Comprobado
-- contra la base real: un UPDATE a 'coach' devuelve 23514
-- (profiles_user_type_check).
--
-- Eso deja inservible TODO el rol de entrenador, incluido lo que ya existía
-- desde la 0022:
--   · rk_accept_gym_invite() pone user_type='coach' al aceptar una invitación
--     → falla, así que ningún entrenador podía entrar a su club.
--   · El registro como entrenador por su cuenta (nuevo) fallaría igual.
--   · Por eso el script de cuentas demo crea demo.coach@rankd.test como 'gym':
--     era un apaño para esquivar esto.
--
-- La lista sale de UserType en src/lib/supabase.ts, que es donde está la
-- verdad del producto.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente y sin
-- pérdida: solo AMPLÍA lo que se admite, no toca ninguna fila.
-- ============================================================

alter table public.profiles drop constraint if exists profiles_user_type_check;

alter table public.profiles
  add constraint profiles_user_type_check
  check (user_type in ('fighter', 'promoter', 'manager', 'brand', 'gym', 'coach'));
