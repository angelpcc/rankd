-- 0027_opportunity_future_date.sql  (PROMPT_1 · bloque 3)
--
-- Refuerza en la base de datos que toda NUEVA oportunidad tenga fecha de evento
-- y que esa fecha sea hoy o futura. La validación principal de UX ya vive en el
-- front (OrgOpportunities / FighterOpportunities); esto cierra el hueco de un
-- POST manual con fecha pasada o sin fecha.
--
-- Decisiones deliberadas:
--   · Solo se valida en INSERT, NO en UPDATE. Así el creador puede seguir
--     editando/cerrando una oportunidad cuyo evento ya pasó (p. ej. para
--     archivarla) sin que la BD se lo impida.
--   · Las filas antiguas con event_date NULL o pasada NO se tocan: siguen
--     existiendo; el front las oculta de las vistas públicas.
--   · Aditiva e idempotente: segura de re-ejecutar.
--
-- Sin aplicar esta migración el producto funciona igual (el front ya valida);
-- solo se pierde la red de seguridad del lado servidor.

create or replace function public.rk_opp_check_future_date()
returns trigger
language plpgsql
as $$
begin
  if new.event_date is null then
    raise exception 'La fecha del evento es obligatoria'
      using errcode = 'check_violation';
  end if;
  if new.event_date < current_date then
    raise exception 'La fecha del evento no puede ser anterior a hoy'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_opp_future_date on public.opportunities;

create trigger trg_opp_future_date
  before insert on public.opportunities
  for each row
  execute function public.rk_opp_check_future_date();
