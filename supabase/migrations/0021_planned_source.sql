-- R12-T4: distinguir en la agenda lo que propone la IA de lo añadido a mano.
-- Cuando el peleador acepta un plan de la IA, sus sesiones se reparten día a
-- día en planned_events con source='ai' (se pintan distinto y se pueden
-- editar o borrar como cualquier otra). Puramente aditivo.
alter table public.planned_events
  add column if not exists source text not null default 'manual';
