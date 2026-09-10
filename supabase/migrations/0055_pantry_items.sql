-- ============================================================
-- RANKD · Mi Esquina · Productos propios del usuario (punto 20)
--
-- La lista de despensa del Asesor de comida es una lista CERRADA de etiquetas
-- ('pollo', 'avena', 'atun'…). Sirve para filtrar el recetario, pero deja
-- fuera lo que cada uno compra de verdad: "pechuga de pavo del Mercadona",
-- "tortitas de arroz", "queso batido 0%". Aquí se guardan esos productos, para
-- que el usuario los escriba UNA vez y sigan estando en la siguiente
-- planificación.
--
-- `tag` es la etiqueta de despensa a la que se ha podido asociar el producto
-- (por palabras clave, en el front). Cuando hay tag, el producto cuenta como
-- despensa y prioriza los platos que lo usan; cuando no la hay (null), el
-- producto no se pierde: se ofrece como acompañamiento o snack disponible.
--
-- `available` permite tener el producto guardado pero marcarlo como "ahora no
-- lo tengo" sin borrarlo — que es lo que pasa con la compra de cada semana.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

create table if not exists public.pantry_items (
  id                 uuid primary key default gen_random_uuid(),
  fighter_profile_id uuid not null references public.profiles(id) on delete cascade,

  -- Tal cual lo escribió el usuario. Es lo que se le enseña luego.
  name               text not null,

  -- Etiqueta de despensa asociada (o null si no encaja en ninguna).
  tag                text,

  -- ¿Lo tiene ahora mismo en casa?
  available          boolean not null default true,

  created_at         timestamptz not null default now()
);

-- Un mismo producto no debería estar dos veces en la lista del mismo usuario.
-- El índice es sobre el nombre en minúsculas para que "Avena" y "avena" sean
-- el mismo producto.
create unique index if not exists pantry_items_owner_name_idx
  on public.pantry_items (fighter_profile_id, lower(name));

alter table public.pantry_items enable row level security;

drop policy if exists "own pantry_items" on public.pantry_items;
create policy "own pantry_items" on public.pantry_items
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

do $$
begin
  if to_regprocedure('public.rk_is_admin()') is not null then
    drop policy if exists "admin read pantry_items" on public.pantry_items;
    create policy "admin read pantry_items" on public.pantry_items
      for select using (public.rk_is_admin());
  end if;
end $$;
