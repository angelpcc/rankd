import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import {
  buildAlerts, applyAlertState, dismissAlert, snoozeAlert, pruneAlertState,
  type AlertInput, type AlertKind,
} from '../lib/alerts';

// Pila de avisos del Resumen. Cada uno se puede posponer (3 días) o descartar.
// Máximo 2 a la vez: más de dos avisos dejan de leerse y empiezan a ignorarse.
//
// Carga sus propios datos (mismo patrón que TodayCard/SummaryMetrics) para no
// engordar page.tsx con consultas que solo usa este bloque.

const MAX_VISIBLE = 2;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayDelta(iso: string): number {
  const a = new Date(iso + 'T00:00:00'); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function mondayISO(): string {
  const d = new Date();
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  profile: Profile;
  mode: 'pro' | 'hobby';
  /** Días desde el último registro; lo calcula ya el Resumen. */
  daysSinceActivity: number | null;
  /** Qué hacer al pulsar la acción de cada tipo de aviso. */
  onAction: (kind: AlertKind) => void;
}

export default function AlertStack({ profile, mode, daysSinceActivity, onAction }: Props) {
  const { t } = useTranslation();
  // Cambiar este contador re-evalúa el estado tras descartar/posponer.
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState<Omit<AlertInput, 'mode' | 'daysSinceActivity'> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const monday = mondayISO();
      const sunday = new Date(monday + 'T00:00:00'); sunday.setDate(sunday.getDate() + 6);
      const sundayISO = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;

      const [planRes, goalRes, weightRes, eventsRes] = await Promise.all([
        supabase.from('day_plan_items').select('id', { count: 'exact', head: true })
          .eq('fighter_profile_id', profile.id).gte('plan_date', monday).lte('plan_date', sundayISO),
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
        supabase.from('weight_entries').select('entry_date')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1),
        mode === 'pro'
          ? supabase.from('planned_events').select('event_date, kind')
              .eq('fighter_profile_id', profile.id).in('kind', ['fight', 'weigh_in'])
              .gte('event_date', todayISO()).order('event_date', { ascending: true })
          : Promise.resolve({ data: null, error: null } as { data: { event_date: string; kind: string }[] | null; error: null }),
      ]);
      if (!alive) return;

      const events = (eventsRes.data || []) as { event_date: string; kind: string }[];
      const fight = events.find((e) => e.kind === 'fight');
      const weighIn = events.find((e) => e.kind === 'weigh_in');
      const lastW = (weightRes.data || [])[0] as { entry_date: string } | undefined;
      const target = (goalRes.data as { target_weight_kg?: number | null } | null)?.target_weight_kg;

      setLoaded({
        // Sin la migración de day_plan_items no se puede decir "semana vacía":
        // se asume 1 para no lanzar un aviso falso.
        weekPlannedCount: isMissingTable(planRes.error) ? 1 : (planRes.count ?? 0),
        daysToFight: fight ? dayDelta(fight.event_date) : null,
        daysToWeighIn: weighIn ? dayDelta(weighIn.event_date) : null,
        hasWeightGoal: target != null,
        daysSinceWeight: lastW ? -dayDelta(lastW.entry_date) : null,
      });
    })();
    return () => { alive = false; };
  }, [profile.id, mode]);

  const visible = useMemo(() => {
    if (!loaded) return [];
    const all = buildAlerts({ ...loaded, mode, daysSinceActivity });
    pruneAlertState(all.map((a) => a.id));
    return applyAlertState(all).slice(0, MAX_VISIBLE);
    // `tick` fuerza el recálculo tras descartar o posponer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, mode, daysSinceActivity, tick]);

  if (visible.length === 0) return null;

  return (
    <div className="rk-stack">
      {visible.map((a) => {
        const urgent = a.severity === 'urgent';
        return (
          <div key={a.id} className="rk-card" style={{ padding: '14px 16px' }} role="status">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl"
                style={{
                  background: urgent ? 'var(--accent-dim)' : 'var(--s-2)',
                  border: `1px solid ${urgent ? 'rgba(225,6,0,0.3)' : 'var(--s-3)'}`,
                  color: urgent ? 'var(--accent)' : 'var(--t-2)',
                }}>
                <i className={a.icon} />
              </span>
              <p className="flex-1 min-w-0 text-sm leading-snug" style={{ color: 'var(--t-1)' }}>
                {t(a.titleKey, a.params)}
              </p>
              <button
                onClick={() => { dismissAlert(a.id); setTick((v) => v + 1); }}
                aria-label={t('mc_al_dismiss')} title={t('mc_al_dismiss')}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ color: 'var(--t-3)' }}
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {a.ctaKey && (
                <button onClick={() => onAction(a.kind)} style={{ minHeight: 36, padding: '0 14px' }}
                  className="rk-nav-btn text-xs font-bold">
                  {t(a.ctaKey)}
                </button>
              )}
              <button onClick={() => { snoozeAlert(a.id); setTick((v) => v + 1); }}
                style={{ minHeight: 36, padding: '0 10px' }}
                className="text-xs font-semibold cursor-pointer" >
                <span style={{ color: 'var(--t-3)' }}>{t('mc_al_snooze')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
