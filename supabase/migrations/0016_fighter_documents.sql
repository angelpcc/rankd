-- ============================================================
-- RANKD · Documentación del peleador que compite
--
-- Licencia federativa, reconocimiento médico y seguro, con fecha de
-- caducidad y archivo adjunto opcional (foto o PDF). Es lo que le piden
-- antes de cada velada: tenerlo a mano y saber cuándo caduca evita
-- quedarse fuera de un combate por un papel.
--
--   1. fighter_documents  → una fila por documento
--   2. bucket 'fighter-docs' PRIVADO en Storage + políticas por carpeta
--
-- PRIVACIDAD: un reconocimiento médico es dato de salud. Ni el bucket es
-- público ni el administrador puede leer estas filas (misma decisión que
-- con los mensajes privados en la migración 0011). Solo su dueño.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. DOCUMENTOS
-- ────────────────────────────────────────────────
create table if not exists public.fighter_documents (
  id uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,
  -- licencia | medico | seguro | otro
  doc_type text not null default 'licencia',
  title text not null,
  issue_date date,
  -- Puede quedar vacía (hay documentos sin caducidad); los avisos solo
  -- funcionan cuando está informada.
  expiry_date date,
  -- Ruta dentro del bucket privado 'fighter-docs' (carpeta = uid del dueño)
  file_path text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists fighter_documents_owner_idx
  on public.fighter_documents (fighter_profile_id, expiry_date);

alter table public.fighter_documents enable row level security;

-- SOLO el dueño. Sin política de administrador a propósito.
drop policy if exists "own fighter_documents" on public.fighter_documents;
create policy "own fighter_documents" on public.fighter_documents
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);


-- ────────────────────────────────────────────────
-- 2. BUCKET PRIVADO PARA LOS ARCHIVOS
-- Cada usuario solo toca su carpeta: fighter-docs/<su uid>/...
-- Al ser privado, el front lee con URLs firmadas de corta duración.
-- ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fighter-docs', 'fighter-docs', false,
  10485760, -- 10 MB por archivo
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "own fighter-docs read" on storage.objects;
create policy "own fighter-docs read" on storage.objects
  for select to authenticated
  using (bucket_id = 'fighter-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own fighter-docs insert" on storage.objects;
create policy "own fighter-docs insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fighter-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own fighter-docs update" on storage.objects;
create policy "own fighter-docs update" on storage.objects
  for update to authenticated
  using (bucket_id = 'fighter-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own fighter-docs delete" on storage.objects;
create policy "own fighter-docs delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fighter-docs' and (storage.foldername(name))[1] = auth.uid()::text);
