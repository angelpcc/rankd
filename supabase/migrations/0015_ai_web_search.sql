-- ============================================================
-- RANKD · Búsqueda web para el asesor de Material
--
-- Da al asistente de Material (y SOLO a ese) acceso a búsqueda web para
-- consultar precios y disponibilidad reales de equipamiento. Como cada
-- búsqueda cuesta dinero aparte de los tokens, tiene su propio sub-tope
-- mensual por usuario, configurable desde el panel igual que el resto.
--
-- FALLA CERRADO: si esta migración no está aplicada, rk_ai_quota no devuelve
-- searches_quota, el servidor NO activa la herramienta y el asesor sigue
-- respondiendo con su conocimiento de marcas. Nada se rompe ni se dispara.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. BÚSQUEDAS POR LLAMADA
-- Nº de búsquedas web que hizo el modelo en cada llamada (0 en las que no
-- buscan). El sub-tope mensual = suma de esta columna en la sección 'gear'.
-- ────────────────────────────────────────────────
alter table public.ai_usage
  add column if not exists searches integer not null default 0;


-- ────────────────────────────────────────────────
-- 2. SUB-TOPE GLOBAL POR DEFECTO
-- Editable desde el panel. Solo se añade la clave si no existe, para no pisar
-- un valor que ya se haya ajustado a mano.
-- ────────────────────────────────────────────────
update public.app_settings
set value = value || '{"monthly_searches": 8}'::jsonb
where key = 'ai_limits' and not (value ? 'monthly_searches');


-- ────────────────────────────────────────────────
-- 3. CONSULTA DE CUOTA AMPLIADA
-- Ahora devuelve también lo consumido y el tope de búsquedas del mes. Cambia
-- el tipo de retorno, así que hay que soltar la función y recrearla.
-- ────────────────────────────────────────────────
drop function if exists public.rk_ai_quota(uuid);

create or replace function public.rk_ai_quota(p_user uuid)
returns table (
  used integer, quota integer, warn_at_pct integer, enabled boolean,
  searches_used integer, searches_quota integer
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_period text := to_char(now(), 'YYYY-MM');
  v_settings jsonb;
  v_default integer;
  v_override integer;
begin
  select value into v_settings from public.app_settings where key = 'ai_limits';
  v_default := coalesce((v_settings ->> 'monthly_messages')::integer, 40);
  warn_at_pct := coalesce((v_settings ->> 'warn_at_pct')::integer, 80);
  enabled := coalesce((v_settings ->> 'enabled')::boolean, true);
  searches_quota := coalesce((v_settings ->> 'monthly_searches')::integer, 8);

  select l.monthly_messages into v_override
  from public.ai_user_limits l where l.user_id = p_user;

  quota := coalesce(v_override, v_default);

  select count(*)::integer into used
  from public.ai_usage u
  where u.user_id = p_user and u.period = v_period and u.kind = 'chat';

  -- Búsquedas gastadas este mes en el asesor de Material.
  select coalesce(sum(u.searches), 0)::integer into searches_used
  from public.ai_usage u
  where u.user_id = p_user and u.period = v_period and u.section = 'gear';

  return next;
end;
$$;

grant execute on function public.rk_ai_quota(uuid) to authenticated;
