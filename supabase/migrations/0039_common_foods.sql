-- ============================================================
-- RANKD · Mi Esquina · Buscador de platos comunes (Nutrición › Diario)
--
-- Catálogo compartido (no es por usuario) de alimentos habituales en España
-- con sus macros aproximados por 100g, para registrar comidas más rápido sin
-- escribir a mano. El usuario ajusta los gramos y se recalcula; también
-- puede seguir escribiendo texto libre como hasta ahora.
--
-- Valores nutricionales de referencia estándar (aprox.), coherente con el
-- disclaimer ya visible en Nutrición ("todo es orientativo").
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

create table if not exists public.common_foods (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  -- protein | carb | fat | veggie | snack
  category            text not null check (category in ('protein', 'carb', 'fat', 'veggie', 'snack')),
  calories_per_100g   numeric(6,1) not null,
  protein_per_100g    numeric(6,1) not null default 0,
  carbs_per_100g      numeric(6,1) not null default 0,
  fat_per_100g        numeric(6,1) not null default 0
);

-- Catálogo de referencia, no datos de usuario: lectura abierta a cualquier
-- autenticado, sin escritura desde el cliente.
alter table public.common_foods enable row level security;

drop policy if exists "read common_foods" on public.common_foods;
create policy "read common_foods" on public.common_foods
  for select to authenticated using (true);

insert into public.common_foods (name, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g) values
  -- Proteínas
  ('Pollo a la plancha', 'protein', 165, 31, 0, 3.6),
  ('Huevos revueltos', 'protein', 155, 13, 1.1, 11),
  ('Atún en lata', 'protein', 116, 26, 0, 1),
  ('Salmón', 'protein', 208, 20, 0, 13),
  ('Ternera magra', 'protein', 187, 26, 0, 8.6),
  ('Pavo (pechuga)', 'protein', 135, 30, 0, 1),
  ('Merluza', 'protein', 86, 17.8, 0, 1),
  ('Tofu', 'protein', 76, 8, 1.9, 4.8),
  ('Queso fresco batido 0%', 'protein', 45, 8, 3.5, 0.2),
  ('Yogur griego natural', 'protein', 97, 9, 3.6, 5),
  ('Jamón cocido', 'protein', 113, 18, 1.5, 4),
  ('Jamón serrano', 'protein', 241, 31, 0.5, 13),
  ('Lentejas cocidas', 'protein', 116, 9, 20, 0.4),
  ('Garbanzos cocidos', 'protein', 164, 8.9, 27, 2.6),
  ('Tortilla de patata', 'protein', 195, 6.7, 12, 13),
  ('Queso curado', 'protein', 392, 26, 1.3, 32),
  -- Carbohidratos
  ('Arroz blanco', 'carb', 130, 2.7, 28, 0.3),
  ('Pasta', 'carb', 131, 5, 25, 1.1),
  ('Pan blanco', 'carb', 265, 9, 49, 3.2),
  ('Pan integral', 'carb', 247, 13, 41, 3.4),
  ('Patata cocida', 'carb', 87, 1.9, 20, 0.1),
  ('Boniato cocido', 'carb', 90, 2, 21, 0.1),
  ('Avena (copos)', 'carb', 389, 17, 66, 7),
  ('Quinoa cocida', 'carb', 120, 4.4, 21, 1.9),
  ('Cuscús cocido', 'carb', 112, 3.8, 23, 0.2),
  ('Tortitas de maíz', 'carb', 384, 8, 83, 3),
  -- Grasas
  ('Aceite de oliva', 'fat', 884, 0, 0, 100),
  ('Aguacate', 'fat', 160, 2, 8.5, 14.7),
  ('Almendras', 'fat', 579, 21, 22, 50),
  ('Nueces', 'fat', 654, 15, 14, 65),
  ('Cacahuetes', 'fat', 567, 26, 16, 49),
  ('Mantequilla de cacahuete', 'fat', 588, 25, 20, 50),
  -- Verduras
  ('Ensalada', 'veggie', 20, 1, 3.6, 0.2),
  ('Brócoli cocido', 'veggie', 35, 2.4, 7, 0.4),
  ('Espinacas', 'veggie', 23, 2.9, 3.6, 0.4),
  ('Tomate', 'veggie', 18, 0.9, 3.9, 0.2),
  ('Zanahoria', 'veggie', 41, 0.9, 10, 0.2),
  ('Calabacín', 'veggie', 17, 1.2, 3.1, 0.3),
  ('Pimiento', 'veggie', 31, 1, 6, 0.3),
  ('Judías verdes', 'veggie', 31, 1.8, 7, 0.1),
  ('Champiñones', 'veggie', 22, 3.1, 3.3, 0.3),
  -- Snacks
  ('Yogur natural', 'snack', 61, 3.5, 4.7, 3.3),
  ('Fruta', 'snack', 52, 0.3, 14, 0.2),
  ('Plátano', 'snack', 89, 1.1, 23, 0.3),
  ('Frutos secos mixtos', 'snack', 607, 20, 21, 54),
  ('Barrita de cereales', 'snack', 400, 7, 65, 12),
  ('Chocolate negro (70%)', 'snack', 546, 7.8, 46, 31)
on conflict (name) do nothing;
