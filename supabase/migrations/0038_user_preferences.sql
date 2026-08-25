-- ============================================================
-- RANKD · Mi Esquina · Preferencias de notificaciones
--
-- Ajustes › Notificaciones: recordatorio diario de entrenamiento (con hora)
-- y recordatorio de registrar el peso. Por ahora solo guarda la preferencia
-- y la usa el sistema de avisos IN-APP (la campana, useNotifications) para
-- decidir si generar el recordatorio cuando el usuario abre la app. El envío
-- por push real (Firebase) es un paso posterior — esta tabla ya deja sitio
-- para ello sin cambios de esquema.
--
-- Una fila por peleador. Los que nunca han abierto Ajustes no tienen fila:
-- el front usa los valores por defecto de esta tabla (entreno ON a las
-- 17:00, peso OFF) para no cambiar el comportamiento actual de nadie.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

create table if not exists public.user_preferences (
  fighter_profile_id         uuid primary key references public.profiles(id) on delete cascade,
  training_reminder_enabled  boolean not null default true,
  training_reminder_time     time not null default '17:00',
  weight_reminder_enabled    boolean not null default false,
  updated_at                 timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "own user_preferences" on public.user_preferences;
create policy "own user_preferences" on public.user_preferences
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);
