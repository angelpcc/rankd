import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { LineChart, Line, BarChart, Bar, Cell, ResponsiveContainer } from 'recharts';

// Grid de 4 Card Métrica (rediseño UI/UX, sección 4): Peso · Entrenos ·
// Objetivo (combate si hay, si no peso objetivo) · Calorías de hoy.

interface Props {
  profile: Profile;
  weekSessions: number;
  weekTarget?: number;
  onOpenActivity: () => void;
  onOpenWeight: () => void;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface WeightPoint { date: string; v: number }

export default function SummaryMetrics({ profile, weekSessions, weekTarget = 4, onOpenActivity, onOpenWeight }: Props) {
  const { t } = useTranslation();
  const [weightHistory, setWeightHistory] = useState<WeightPoint[]>([]);
  const [weightCurrent, setWeightCurrent] = useState<number | null>(null);
  const [weightDelta, setWeightDelta] = useState<number | null>(null);
  const [weightTarget, setWeightTarget] = useState<number | null>(null);
  const [fightDays, setFightDays] = useState<number | null>(null);
  const [weekDays, setWeekDays] = useState<{ key: string; v: number; today: boolean }[]>([]);
  const [calories, setCalories] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: entries, error: wErr }, { data: goal }, { data: fight }, { data: sessions }, { data: meals }] = await Promise.all([
        supabase.from('weight_entries').select('weight_kg, entry_date')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(14),
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
        supabase.from('planned_events').select('event_date').eq('fighter_profile_id', profile.id)
          .eq('kind', 'fight').gte('event_date', todayISO()).order('event_date', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('training_sessions').select('session_date').eq('fighter_profile_id', profile.id).gte('session_date', iso(new Date(Date.now() - 7 * 86400000))),
        supabase.from('meal_entries').select('calories').eq('fighter_profile_id', profile.id).eq('entry_date', todayISO()),
      ]);
      if (!alive) return;

      if (!isMissingTable(wErr) && entries && entries.length) {
        const ordered = [...entries].reverse();
        setWeightHistory(ordered.map((e) => ({ date: e.entry_date, v: Number(e.weight_kg) })));
        setWeightCurrent(Number(entries[0].weight_kg));
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const ref = entries.find((e) => new Date(e.entry_date) <= weekAgo) || entries[1];
        setWeightDelta(ref ? +(Number(entries[0].weight_kg) - Number(ref.weight_kg)).toFixed(1) : null);
      }
      if (goal?.target_weight_kg) setWeightTarget(Number(goal.target_weight_kg));

      if (fight?.event_date) {
        const days = Math.ceil((new Date(fight.event_date + 'T12:00:00').getTime() - Date.now()) / 86400000);
        setFightDays(days >= 0 ? days : null);
      }

      const counts = new Map<string, number>();
      (sessions || []).forEach((s) => counts.set(s.session_date, (counts.get(s.session_date) || 0) + 1));
      const today = todayISO();
      const days: { key: string; v: number; today: boolean }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const k = iso(d);
        days.push({ key: k, v: Math.max(0.05, counts.get(k) || 0), today: k === today });
      }
      setWeekDays(days);

      const withMacros = (meals || []).filter((m) => m.calories !== null);
      if (withMacros.length > 0) setCalories(withMacros.reduce((a, m) => a + (m.calories || 0), 0));
    })();
    return () => { alive = false; };
  }, [profile.id]);

  const remaining = weightTarget !== null && weightCurrent !== null ? +(weightCurrent - weightTarget).toFixed(1) : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {/* PESO */}
      <div className="card-metric" onClick={onOpenWeight}>
        <div className="min-w-0">
          <p className="t-label">{t('mc_metric_weight')}</p>
          {weightCurrent !== null ? (
            <>
              <p className="mt-1"><span className="t-data">{weightCurrent}</span><span className="t-data-unit">kg</span></p>
              {weightDelta !== null && weightDelta !== 0 && (
                <p className="t-body mt-0.5" style={{ fontSize: 12, color: weightDelta < 0 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                  {weightDelta < 0 ? '↓' : '↑'} {Math.abs(weightDelta)} kg
                </p>
              )}
            </>
          ) : (
            <p className="t-data mt-1" style={{ color: 'var(--text-3)' }}>—</p>
          )}
        </div>
        {weightHistory.length >= 2 && (
          <div style={{ width: 64, height: 36, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightHistory}>
                <Line type="monotone" dataKey="v" stroke="var(--brand)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ENTRENOS ESTA SEMANA */}
      <div className="card-metric" onClick={onOpenActivity}>
        <div className="min-w-0">
          <p className="t-label">{t('mc_metric_week')}</p>
          <p className="mt-1"><span className="t-data" style={{ color: weekSessions >= weekTarget ? 'var(--success)' : 'var(--text-1)' }}>{weekSessions}</span><span className="t-data-unit">/{weekTarget}</span></p>
        </div>
        {weekDays.length > 0 && (
          <div style={{ width: 64, height: 36, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekDays} barSize={5}>
                <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                  {weekDays.map((d) => <Cell key={d.key} fill={d.v > 0.05 ? 'var(--brand)' : 'var(--surface-3)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* OBJETIVO: combate si hay, si no peso objetivo */}
      <div className="card-metric" onClick={fightDays !== null ? onOpenActivity : onOpenWeight}>
        <div className="min-w-0 w-full">
          {fightDays !== null ? (
            <>
              <p className="t-label">{t('mc_metric_fight')}</p>
              <p className="mt-1"><span className="t-data">{fightDays}</span><span className="t-data-unit">{t('mc_metric_days')}</span></p>
            </>
          ) : remaining !== null ? (
            <>
              <p className="t-label">{remaining > 0 ? t('mc_metric_to_lose') : t('mc_metric_to_gain')}</p>
              <p className="mt-1"><span className="t-data">{Math.abs(remaining)}</span><span className="t-data-unit">kg</span></p>
            </>
          ) : (
            <>
              <p className="t-label">{t('mc_metric_goal')}</p>
              <p className="t-data mt-1" style={{ color: 'var(--text-3)' }}>—</p>
            </>
          )}
        </div>
      </div>

      {/* CALORÍAS DE HOY */}
      <div className="card-metric" onClick={onOpenActivity}>
        <div className="min-w-0">
          <p className="t-label">{t('mc_metric_calories')}</p>
          <p className="mt-1">
            {calories !== null ? <><span className="t-data">{calories}</span><span className="t-data-unit">kcal</span></> : <span className="t-data" style={{ color: 'var(--text-3)' }}>—</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
