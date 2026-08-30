-- ============================================================
-- RANKD · Mi Esquina · Biblioteca de suplementos ampliada (PROMPT 1 · parte B)
--
-- AUTOCONTENIDA: incluye de forma idempotente lo que hacía 0041_supplements.sql
-- (por si nunca se aplicó) + las columnas nuevas de esta ronda. Se puede
-- ejecutar sola, esté 0041 aplicada o no. Todo con if-not-exists / on-conflict
-- / drop-policy-if-exists, así que re-ejecutarla es seguro.
--
--   1. common_supplements → catálogo compartido (no por usuario). Gana
--      `benefits` (jsonb, lista de frases cortas) y `timing` (texto llano del
--      momento típico de toma). Descripción en lenguaje llano — sin dosis ni
--      indicaciones médicas. El disclaimer es texto fijo en la app.
--   2. user_supplements → los que toma el peleador. Gana `slot` = la "franja"
--      elegida al añadirlo a la rutina (manana | con_comidas | post_entreno |
--      antes_dormir | otro). `time_of_day` guarda una hora representativa de la
--      franja, o la hora libre cuando slot = 'otro'.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run.
-- Convención: fighter_profile_id = profiles.id = auth.uid()
-- ============================================================

-- ── 1. Catálogo compartido ──
create table if not exists public.common_supplements (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  -- protein | creatine | preworkout | amino | vitamin | mineral | omega | other
  category    text not null check (category in ('protein', 'creatine', 'preworkout', 'amino', 'vitamin', 'mineral', 'omega', 'other')),
  description text
);

-- Columnas nuevas de esta ronda (aditivas).
alter table public.common_supplements add column if not exists benefits jsonb;
alter table public.common_supplements add column if not exists timing text;

alter table public.common_supplements enable row level security;

drop policy if exists "read common_supplements" on public.common_supplements;
create policy "read common_supplements" on public.common_supplements
  for select to authenticated using (true);

-- ── 2. Suplementos del usuario ──
create table if not exists public.user_supplements (
  id                  uuid primary key default gen_random_uuid(),
  fighter_profile_id  uuid not null references public.profiles(id) on delete cascade,
  supplement_id       uuid references public.common_supplements(id) on delete set null,
  custom_name         text,
  time_of_day         time,
  notes               text,
  created_at          timestamptz not null default now(),
  constraint user_supplements_has_name check (supplement_id is not null or custom_name is not null)
);

alter table public.user_supplements add column if not exists slot text;

create index if not exists user_supplements_owner_idx
  on public.user_supplements (fighter_profile_id, time_of_day);

alter table public.user_supplements enable row level security;

drop policy if exists "own user_supplements" on public.user_supplements;
create policy "own user_supplements" on public.user_supplements
  for all using (auth.uid() = fighter_profile_id) with check (auth.uid() = fighter_profile_id);

-- ── 3. Semilla base (de 0041, por si no se aplicó) ──
insert into public.common_supplements (name, category, description) values
  ('Proteína vegana', 'protein', 'Alternativa vegetal a la whey'),
  ('Caseína', 'protein', 'Liberación lenta, habitual antes de dormir'),
  ('Pre-entreno (mezcla)', 'preworkout', 'Cafeína + otros estimulantes combinados'),
  ('Citrulina malato', 'preworkout', 'Bombeo y resistencia'),
  ('EAA', 'amino', 'Aminoácidos esenciales completos'),
  ('Complejo B', 'vitamin', 'Energía y sistema nervioso'),
  ('ZMA', 'mineral', 'Zinc + magnesio + B6, habitual antes de dormir'),
  ('Electrolitos', 'mineral', 'Hidratación en sesiones largas o con corte de peso'),
  ('Ashwagandha', 'other', 'Estrés y recuperación hormonal'),
  ('Cúrcuma', 'other', 'Antiinflamatorio natural'),
  ('Probióticos', 'other', 'Salud digestiva')
on conflict (name) do nothing;

-- ── 4. Re-siembra ampliada (17 comunes) con función en lenguaje llano ──
insert into public.common_supplements (name, category, description, benefits, timing) values
  ('Creatina monohidrato', 'creatine',
   'El suplemento de rendimiento más estudiado que existe.',
   '["Más fuerza y potencia en esfuerzos cortos","Mejor recuperación entre series y sesiones","Ayuda a ganar masa muscular con el tiempo"]'::jsonb,
   'Cualquier momento del día, a diario'),
  ('Cafeína', 'preworkout',
   'Estimulante para energía y concentración.',
   '["Más energía y foco","Retrasa la sensación de fatiga","Puede mejorar fuerza y potencia"]'::jsonb,
   '30-60 min antes de entrenar'),
  ('Beta-alanina', 'preworkout',
   'Ayuda en esfuerzos intensos de 1 a 4 minutos.',
   '["Retrasa la fatiga muscular en esfuerzos intensos","Útil en rondas largas o series de muchas repeticiones"]'::jsonb,
   'A diario; reparte la dosis para evitar el hormigueo'),
  ('Nitratos (zumo de remolacha)', 'other',
   'Fuente natural de nitratos para la resistencia.',
   '["Mejora el uso del oxígeno","Puede aumentar la resistencia","Menos coste de energía al mismo ritmo"]'::jsonb,
   '2-3 h antes de un esfuerzo largo'),
  ('Bicarbonato de sodio', 'other',
   'Tampón que reduce la acidez muscular en esfuerzos muy intensos.',
   '["Reduce la acidosis muscular en esfuerzos intensos","Puede alargar el tiempo hasta el fallo"]'::jsonb,
   '60-90 min antes; prueba primero la tolerancia digestiva'),
  ('Proteína de suero (whey)', 'protein',
   'Proteína de asimilación rápida para recuperar y construir músculo.',
   '["Aporta proteína de calidad de forma cómoda","Recuperación y desarrollo muscular","Útil si no llegas a tu proteína diaria con comida"]'::jsonb,
   'Tras entrenar, o en cualquier comida que falte proteína'),
  ('BCAA', 'amino',
   'Aminoácidos ramificados (leucina, isoleucina, valina).',
   '["Puede reducir la fatiga en sesiones largas","Apoyo a la recuperación si la dieta es baja en proteína"]'::jsonb,
   'Antes o durante el entreno'),
  ('Glutamina', 'amino',
   'Aminoácido relacionado con la recuperación y la inmunidad.',
   '["Apoyo a la recuperación muscular","Puede ayudar a la salud intestinal e inmune en cargas altas"]'::jsonb,
   'Tras entrenar o antes de dormir'),
  ('Magnesio', 'mineral',
   'Mineral implicado en el músculo, el sistema nervioso y el sueño.',
   '["Mejor calidad del sueño","Recuperación muscular y menos calambres","Función nerviosa normal"]'::jsonb,
   'Por la noche, con la cena o antes de dormir'),
  ('Omega 3', 'omega',
   'Ácidos grasos EPA y DHA de aceite de pescado o de algas.',
   '["Efecto antiinflamatorio","Salud cardiovascular","Apoyo a la recuperación articular"]'::jsonb,
   'Con una comida que tenga grasa'),
  ('Vitamina D', 'vitamin',
   'Vitamina clave para huesos, músculo e inmunidad; habitual tenerla baja.',
   '["Salud ósea y muscular","Función inmune","Muy común tener niveles bajos sin sol"]'::jsonb,
   'Con una comida con grasa, por la mañana'),
  ('Multivitamínico', 'vitamin',
   'Cobertura general de micronutrientes.',
   '["Rellena huecos de la dieta","Cómodo como seguro nutricional"]'::jsonb,
   'Con el desayuno'),
  ('Melatonina', 'other',
   'Hormona que regula el ciclo del sueño.',
   '["Ayuda a conciliar el sueño","Útil con cambios de horario o viajes"]'::jsonb,
   '30-60 min antes de acostarte'),
  ('Zinc', 'mineral',
   'Mineral para la inmunidad y la recuperación.',
   '["Función inmune","Apoyo hormonal y de recuperación","Se pierde con el sudor"]'::jsonb,
   'Con la cena, separado del calcio'),
  ('Vitamina C', 'vitamin',
   'Antioxidante y apoyo al sistema inmune.',
   '["Apoyo inmune","Antioxidante","Ayuda a la síntesis de colágeno"]'::jsonb,
   'Con cualquier comida'),
  ('Carnitina', 'other',
   'Compuesto implicado en el uso de la grasa como energía.',
   '["Rol en el metabolismo de las grasas","Puede apoyar la recuperación"]'::jsonb,
   'Con una comida que tenga carbohidratos'),
  ('Colágeno', 'other',
   'Proteína estructural para articulaciones, tendones y piel.',
   '["Apoyo a articulaciones y tendones","Suele tomarse junto a vitamina C"]'::jsonb,
   '30-60 min antes del entreno, o a diario')
on conflict (name) do update
  set category = excluded.category,
      description = excluded.description,
      benefits = excluded.benefits,
      timing = excluded.timing;
