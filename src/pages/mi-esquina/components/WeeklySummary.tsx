import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';

interface Props {
  profile: Profile;
  /** Cambia al registrar algo, para forzar recarga */
  refreshKey?: number;
  onOpenGoals?: () => void;
}

interface Metric {
  labelKey: string;
  value: number;
  prev: number;
  suffix?: string;
  color: string;
  icon: string;
}

interface ActiveGoal {
  id: string;
  title: string;
  category: string;
  target_value: number | null;
  start_value: number | null;
  unit: string | null;
  deadline: string | null;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function startOfWeek(offsetWeeks = 0): Date {
  const d = new Date();
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1; // lunes = 0
  d.setDate(d.getDate() - day + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Resumen semanal automático: lo que llevas de lunes a hoy comparado con la
 * semana anterior, más el estado de tus objetivos activos. Es la primera cosa
 * que se ve al entrar, para que la visita tenga sentido aunque no vengas a
 * registrar nada.
 */
export default function WeeklySummary({ profile, refreshKey, onOpenGoals }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [hasActivity, setHasActivity] = useState(false);
  const [goals, setGoals] = useState<ActiveGoal[]>([]);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const thisStart = startOfWeek(0);
    const lastStart = startOfWeek(-1);

    const [sessRes, checkRes, goalRes, weightRes] = await Promise.all([
      supabase.from('training_sessions').select('session_date, duration_min')
        .eq('fighter_profile_id', profile.id).gte('session_date', iso(lastStart)),
      supabase.from('daily_checkins').select('entry_date')
        .eq('fighter_profile_id', profile.id).gte('entry_date', iso(lastStart)),
      supabase.from('fighter_goals').select('id, title, category, target_value, start_value, unit, deadline')
        .eq('fighter_profile_id', profile.id).eq('status', 'active').limit(4),
      supabase.from('weight_entries').select('weight_kg')
        .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const sessions = (sessRes.data || []) as { session_date: string; duration_min: number | null }[];
    const inThis = sessions.filter((s) => s.session_date >= iso(thisStart));
    const inLast = sessions.filter((s) => s.session_date >= iso(lastStart) && s.session_date < iso(thisStart));

    const checkins = ((checkRes.data || []) as { entry_date: string }[]);
    const checkThis = checkins.filter((c) => c.entry_date >= iso(thisStart)).length;
    const checkLast = checkins.filter((c) => c.entry_date >= iso(lastStart) && c.entry_date < iso(thisStart)).length;

    const minutes = (rows: typeof sessions) => rows.reduce((a, s) => a + (s.duration_min || 0), 0);
    const activeDays = (rows: typeof sessions) => new Set(rows.map((s) => s.session_date)).size;

    setMetrics([
      { labelKey: 'mc_ws_sessions', value: inThis.length, prev: inLast.length, color: '#E10600', icon: 'ri-calendar-check-line' },
      { labelKey: 'mc_ws_minutes', value: minutes(inThis), prev: minutes(inLast), color: '#4ade80', icon: 'ri-time-line' },
      { labelKey: 'mc_ws_days', value: activeDays(inThis), prev: activeDays(inLast), color: '#38bdf8', icon: 'ri-fire-line' },
      { labelKey: 'mc_ws_checkins', value: checkThis, prev: checkLast, color: '#C9A84C', icon: 'ri-heart-pulse-line' },
    ]);
    setHasActivity(inThis.length > 0 || checkThis > 0);
    setGoals((goalRes.data || []) as ActiveGoal[]);
    setCurrentWeight((weightRes.data as { weight_kg?: number } | null)?.weight_kg ?? null);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="rk-card" style={{ padding: '20px', transform: 'none' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl ws-skeleton" />)}
        </div>
        <style>{`
          .ws-skeleton { background: linear-gradient(90deg, rgba(255,255,255,0.035) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.035) 75%); background-size: 200% 100%; animation: rankd-shimmer 1.6s linear infinite; }
          @media (prefers-reduced-motion: reduce) { .ws-skeleton { animation: none; } }
        `}</style>
      </div>
    );
  }

  const sessionsMetric = metrics[0];
  const better = sessionsMetric && sessionsMetric.value >= sessionsMetric.prev;

  // Progreso de una meta numérica de peso (start → actual → objetivo)
  const goalProgress = (g: ActiveGoal): number | null => {
    if (g.category !== 'weight' || g.target_value === null || g.start_value === null || currentWeight === null) return null;
    const total = g.target_value - g.start_value;
    if (Math.abs(total) < 0.01) return 100;
    return Math.max(0, Math.min(100, Math.round(((currentWeight - g.start_value) / total) * 100)));
  };

  const deadlineText = (deadline: string | null): string | null => {
    if (!deadline) return null;
    const d = new Date(deadline + 'T12:00:00');
    const days = Math.round((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
    if (days < 0) return t('mc_ws_deadline_over');
    if (days === 0) return t('mc_ws_deadline_today');
    return t('mc_ws_deadline_days', { n: days });
  };

  return (
    <div className="rk-card" style={{ padding: '20px', transform: 'none' }}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="rk-h3" style={{ fontSize: '1.05rem', color: '#fff' }}>{t('mc_ws_title')}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{t('mc_ws_subtitle')}</p>
        </div>
        {hasActivity && (
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${better ? 'text-green-400 bg-green-500/10 border-green-500/25' : 'text-orange-400 bg-orange-500/10 border-orange-500/25'}`}>
            {better ? t('mc_ws_good') : t('mc_ws_keep')}
          </span>
        )}
      </div>

      {!hasActivity ? (
        <div className="text-center py-8">
          <i className="ri-bar-chart-line text-3xl text-zinc-700"></i>
          <p className="text-sm text-zinc-300 font-medium mt-2.5">{t('mc_ws_empty')}</p>
          <p className="text-xs text-zinc-600 mt-1">{t('mc_ws_empty_desc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map((m) => {
            const diff = m.value - m.prev;
            return (
              <div key={m.labelKey} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <i className={m.icon} style={{ color: m.color, fontSize: 15 }}></i>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, lineHeight: 1, color: m.color, marginTop: 6 }}>{m.value}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1 leading-tight">{t(m.labelKey)}</p>
                {m.prev > 0 || m.value > 0 ? (
                  <p className={`text-[10px] mt-1.5 font-semibold ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-orange-400' : 'text-zinc-600'}`}>
                    {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {Math.abs(diff)} {t('mc_ws_vs_last')}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Objetivos activos */}
      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-600 mb-2.5">{t('mc_ws_goals_title')}</p>
        {goals.length === 0 ? (
          <button onClick={onOpenGoals} disabled={!onOpenGoals}
            className="text-xs text-zinc-500 hover:text-zinc-300 text-left transition-colors disabled:cursor-default"
            style={{ cursor: onOpenGoals ? 'pointer' : 'default' }}>
            {t('mc_ws_no_goals')}
          </button>
        ) : (
          <div className="space-y-2.5">
            {goals.map((g) => {
              const pct = goalProgress(g);
              const dl = deadlineText(g.deadline);
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-xs text-zinc-300 font-semibold truncate">{g.title}</span>
                    <span className="text-[11px] text-zinc-500 flex-shrink-0">
                      {pct !== null && <span className="text-white font-bold">{pct}% </span>}
                      {dl}
                    </span>
                  </div>
                  {pct !== null && (
                    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#C9A84C' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
