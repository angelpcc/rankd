-- ============================================================
-- RANKD · Lectura de solo administrador (para el modo "Ver como")
--
-- Para que el administrador pueda revisar la plataforma como la ve un usuario
-- real, necesita PODER LEER sus datos. Estas políticas añaden únicamente
-- permiso de SELECT, nunca de escritura.
--
-- Por qué es seguro:
--   · Las políticas de RLS son permisivas y se combinan con OR, así que esto
--     se SUMA a las que ya existen sin tocarlas ni debilitarlas.
--   · Solo conceden SELECT. Insertar, actualizar y borrar en nombre de otro
--     sigue siendo imposible: esas políticas siguen exigiendo auth.uid().
--   · rk_is_admin() (migración 0008) compara el email del JWT con la lista de
--     administradores, así que solo aplica a esa cuenta.
--
-- DELIBERADAMENTE FUERA: messages y conversations. La correspondencia privada
-- entre dos usuarios no se lee ni para revisar la interfaz; el modo vista
-- bloquea la mensajería y muestra el aviso correspondiente.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

do $$
declare
  tbl text;
  -- Tablas de datos propios del peleador/organización que el admin puede leer
  tables text[] := array[
    'training_sessions',
    'weight_entries',
    'hydration_entries',
    'nutrition_goals',
    'meal_entries',
    'gear_items',
    'weekly_plans',
    'planned_events',
    'fighter_goals',
    'daily_checkins',
    'workout_templates',
    'sparring_sessions',
    'technique_notes'
  ];
begin
  foreach tbl in array tables loop
    -- Solo si la tabla existe: las migraciones se aplican en orden y puede que
    -- alguna todavía no esté creada en este proyecto.
    if to_regclass('public.' || tbl) is not null then
      execute format('drop policy if exists "admin read %1$s" on public.%1$I', tbl);
      execute format(
        'create policy "admin read %1$s" on public.%1$I for select using (public.rk_is_admin())',
        tbl
      );
    end if;
  end loop;
end $$;
