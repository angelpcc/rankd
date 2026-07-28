-- ============================================================
-- RANKD · Control de coste de la IA
--
-- Pone un tope de uso por usuario ANTES de activar la facturación de la API,
-- para que no exista el escenario de "factura descontrolada".
--
--   1. app_settings   → ajustes editables desde el panel (el tope global)
--   2. ai_usage       → una fila por llamada: tokens reales y coste estimado
--   3. ai_user_limits → ampliación manual del tope a un usuario concreto
--
-- La unidad del tope son MENSAJES por mes natural, no tokens: es lo único
-- que un usuario entiende de un vistazo. El coste por mensaje está acotado
-- por diseño (max_tokens de salida 1.500 e historial de 20 turnos), así que
-- mensajes × tope da un techo de gasto predecible.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. AJUSTES DE LA PLATAFORMA
-- ────────────────────────────────────────────────
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Tope por defecto. Editable desde el panel de administración.
insert into public.app_settings (key, value)
values ('ai_limits', '{"monthly_messages": 40, "warn_at_pct": 80, "enabled": true}'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

-- Cualquiera con sesión puede LEER los ajustes (el front necesita saber el
-- tope para avisar). Escribir, solo el administrador.
drop policy if exists "read app_settings" on public.app_settings;
create policy "read app_settings" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "admin writes app_settings" on public.app_settings;
create policy "admin writes app_settings" on public.app_settings
  for all using (public.rk_is_admin()) with check (public.rk_is_admin());


-- ────────────────────────────────────────────────
-- 2. CONSUMO DE IA
-- Una fila por llamada. La escribe la función serverless con la service_role
-- key, así que el usuario no puede falsear su propio consumo.
-- ────────────────────────────────────────────────
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Mes natural en formato 'YYYY-MM': la unidad del tope
  period text not null,
  section text not null,              -- training | nutrition | gear
  kind text not null default 'chat',  -- chat | extract
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  -- Coste estimado en USD con la tarifa vigente del modelo
  cost_usd numeric(10,5) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_period_idx
  on public.ai_usage (user_id, period);
create index if not exists ai_usage_period_idx
  on public.ai_usage (period, created_at desc);

alter table public.ai_usage enable row level security;

-- Cada uno ve su consumo; el administrador ve el de todos.
drop policy if exists "own or admin ai_usage" on public.ai_usage;
create policy "own or admin ai_usage" on public.ai_usage
  for select using (auth.uid() = user_id or public.rk_is_admin());


-- ────────────────────────────────────────────────
-- 3. AMPLIACIÓN MANUAL POR USUARIO
-- Deja preparada una "versión ampliada" sin tocar código.
-- ────────────────────────────────────────────────
create table if not exists public.ai_user_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_messages integer not null,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.ai_user_limits enable row level security;

drop policy if exists "own or admin read ai_user_limits" on public.ai_user_limits;
create policy "own or admin read ai_user_limits" on public.ai_user_limits
  for select using (auth.uid() = user_id or public.rk_is_admin());

drop policy if exists "admin writes ai_user_limits" on public.ai_user_limits;
create policy "admin writes ai_user_limits" on public.ai_user_limits
  for all using (public.rk_is_admin()) with check (public.rk_is_admin());


-- ────────────────────────────────────────────────
-- 4. CONSULTA DE CUOTA
-- Devuelve lo consumido y el tope efectivo del usuario en el mes actual.
-- SECURITY DEFINER para poder leer ajustes y topes sin exponer las tablas.
-- ────────────────────────────────────────────────
create or replace function public.rk_ai_quota(p_user uuid)
returns table (used integer, quota integer, warn_at_pct integer, enabled boolean)
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

  select l.monthly_messages into v_override
  from public.ai_user_limits l where l.user_id = p_user;

  quota := coalesce(v_override, v_default);

  select count(*)::integer into used
  from public.ai_usage u
  where u.user_id = p_user and u.period = v_period and u.kind = 'chat';

  return next;
end;
$$;

grant execute on function public.rk_ai_quota(uuid) to authenticated;
