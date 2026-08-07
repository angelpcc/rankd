-- 0028_content_generation.sql
--
-- Creator Studio: la fábrica de contenido de Ángel (vídeos, publicaciones y
-- mensajes generados con IA). Es una zona SOLO ADMIN — nadie más la usa ni
-- debería poder leer o escribir aquí, así que las 4 tablas se cierran por
-- completo detrás de rk_is_admin() (definida en 0008).
--
-- content_generated: cada pieza generada (o en borrador). generated_content
--   guarda el JSON tal cual lo devuelve la IA (guion de escenas, copy con
--   hashtags, mensaje con alternativas...), así el front no necesita un
--   esquema de columnas distinto por tipo.
-- content_templates: plantillas reutilizables por sección, que prellenan el
--   formulario del generador (ej. "Promocionar Mi Esquina").
-- content_generation_log: auditoría de cada llamada a la IA (para poder
--   depurar sin depender solo de ai_usage, que es agregada por periodo).
-- content_versions: historial de versiones de una pieza, para poder volver
--   atrás si una edición o una variación empeora el resultado.
--
-- Aditiva e idempotente: segura de re-ejecutar.

create table if not exists public.content_generated (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  -- type: video | publication | message
  type text not null check (type in ('video', 'publication', 'message')),
  subtype text,
  title text not null default '',
  user_prompt text not null default '',
  generated_content jsonb not null default '{}'::jsonb,
  -- status: draft | ready | published | archived
  status text not null default 'draft' check (status in ('draft', 'ready', 'published', 'archived')),
  tokens_used integer,
  model_used text,
  tags text[] not null default '{}',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_templates (
  id uuid primary key default gen_random_uuid(),
  -- section: video | publication | message (misma familia que content_generated.type)
  section text not null check (section in ('video', 'publication', 'message')),
  name text not null,
  prompt_seed text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.content_generation_log (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.content_generated(id) on delete cascade,
  action text not null, -- generate | variation | edit
  tokens integer,
  cost_usd numeric(10, 5),
  created_at timestamptz not null default now()
);

create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_generated(id) on delete cascade,
  version integer not null,
  generated_content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists content_generated_type_idx on public.content_generated(type, created_at desc);
create index if not exists content_versions_content_idx on public.content_versions(content_id, version desc);

alter table public.content_generated enable row level security;
alter table public.content_templates enable row level security;
alter table public.content_generation_log enable row level security;
alter table public.content_versions enable row level security;

drop policy if exists "admin only content_generated" on public.content_generated;
create policy "admin only content_generated" on public.content_generated
  for all using (public.rk_is_admin()) with check (public.rk_is_admin());

drop policy if exists "admin only content_templates" on public.content_templates;
create policy "admin only content_templates" on public.content_templates
  for all using (public.rk_is_admin()) with check (public.rk_is_admin());

drop policy if exists "admin only content_generation_log" on public.content_generation_log;
create policy "admin only content_generation_log" on public.content_generation_log
  for all using (public.rk_is_admin()) with check (public.rk_is_admin());

drop policy if exists "admin only content_versions" on public.content_versions;
create policy "admin only content_versions" on public.content_versions
  for all using (public.rk_is_admin()) with check (public.rk_is_admin());
