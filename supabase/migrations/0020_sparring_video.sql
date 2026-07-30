-- ============================================================
-- RANKD · Biblioteca de vídeo de sparring (R12-T2)
--
-- Cada sparring puede llevar un vídeo: subido a un bucket PRIVADO o un
-- enlace externo (YouTube/Drive). Y notas ancladas a un momento del vídeo.
--
--   1. sparring_sessions  → columnas de vídeo (subido o enlace)
--   2. sparring_notes     → notas con marca de tiempo (o generales)
--   3. bucket 'sparring-videos' PRIVADO en Storage + políticas por carpeta
--
-- PRIVACIDAD: el vídeo de un peleador es suyo. Bucket privado (URLs firmadas)
-- y sin política de administrador, igual que documentos/mensajes.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. VÍDEO EN CADA SPARRING
-- ────────────────────────────────────────────────
alter table public.sparring_sessions add column if not exists video_path text;  -- ruta en el bucket privado
alter table public.sparring_sessions add column if not exists video_url text;    -- enlace externo (YouTube, Drive...)
alter table public.sparring_sessions add column if not exists video_kind text;    -- 'upload' | 'external'

-- ────────────────────────────────────────────────
-- 2. NOTAS ANCLADAS AL VÍDEO
-- ts_seconds = momento del vídeo; null = nota general de la sesión.
-- ────────────────────────────────────────────────
create table if not exists public.sparring_notes (
  id uuid primary key default gen_random_uuid(),
  sparring_id uuid not null references public.sparring_sessions(id) on delete cascade,
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  ts_seconds numeric,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists sparring_notes_sparring_idx
  on public.sparring_notes (sparring_id, ts_seconds);

alter table public.sparring_notes enable row level security;

-- SOLO el dueño. Sin política de administrador a propósito.
drop policy if exists "own sparring_notes" on public.sparring_notes;
create policy "own sparring_notes" on public.sparring_notes
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

-- ────────────────────────────────────────────────
-- 3. BUCKET PRIVADO PARA LOS VÍDEOS
-- Cada usuario solo toca su carpeta: sparring-videos/<su uid>/...
-- Tope de 500 MB por archivo para no disparar el almacenamiento (para
-- sesiones largas, mejor un enlace externo). Al ser privado, el front lee
-- con URLs firmadas de corta duración.
-- ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sparring-videos', 'sparring-videos', false,
  524288000, -- 500 MB por archivo
  array['video/mp4','video/quicktime','video/webm','video/x-matroska','video/3gpp']
)
on conflict (id) do nothing;

drop policy if exists "own sparring-videos read" on storage.objects;
create policy "own sparring-videos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'sparring-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own sparring-videos insert" on storage.objects;
create policy "own sparring-videos insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sparring-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own sparring-videos delete" on storage.objects;
create policy "own sparring-videos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sparring-videos' and (storage.foldername(name))[1] = auth.uid()::text);
