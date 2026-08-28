import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import SegmentedProgress from '@/components/base/SegmentedProgress';

// Grid 2×2 de métricas compactas — PESO · ENTRENOS · RACHA · OBJETIVO.
// Cada una card --s-2: label arriba, dato grande (Bebas). El dato de "logro"
// (racha, objetivo) va en oro; el resto en blanco. Nada rojo aquí.

interface Props {
  profile: Profile;
  weekSessions: number;
  weekTarget?: number;
  streak: number;
  onOpenActivity: () => void;
  onOpenWeight: () => void;
}

interface WeightPoint { date: string; value: number }

export default function SummaryMetrics({ profile, weekSessions, weekTarget = 4, streak, onOpenActivity, onOpenWeight }: Props) {
  const { t } = useTranslation();
  const [weightHistory, setWeightHistory] = useState<WeightPoint[]>([]);
  const [weightCurrent, setWeightCurrent] = useState<number | null>(null);
  const [weightDelta, setWeightDelta] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: entries, error: wErr }, { data: goal }] = await Promise.all([
        supabase.from('weight_entries').select('weight_kg, entry_date')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(14),
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
      ]);
      if (!alive) return;
      if (!isMissingTable(wErr) && entries && entries.length) {
        const ordered = [...entries].reverse();
        setWeightHistory(ordered.map((e) => ({ date: e.entry_date, value: Number(e.weight_kg) })));
        setWeightCurrent(Number(entries[0].weight_kg));
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const ref = entries.find((e) => new Date(e.entry_date) <= weekAgo) || entries[1];
        setWeightDelta(ref ? +(Number(entries[0].weight_kg) - Number(ref.weight_kg)).toFixed(1) : null);
      }
      const tw = (goal as { target_weight_kg?: number } | null)?.target_weight_kg;
      if (tw != null) setTargetWeight(Number(tw));
    })();
    return () => { alive = false; };
  }, [profile.id]);

  const Card = ({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="w-full text-left cursor-pointer"
      style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)', borderRadius: 'var(--r-cta)', padding: 16, minHeight: 104 }}
    >
      {children}
    </button>
  );

  const weekMet = weekSessions >= weekTarget;
  const toGo = targetWeight != null && weightCurrent != null ? +(weightCurrent - targetWeight).toFixed(1) : null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* ── PESO ── */}
      <Card onClick={onOpenWeight}>
        <p className="rk-label">{t('mc_metric_weight')}</p>
        {weightCurrent !== null ? (
          <>
            <p className="rk-num mt-1.5">{weightCurrent}<span style={{ fontSize: 14, color: 'var(--t-3)', marginLeft: 4 }}>kg</span></p>
            {weightDelta !== null && weightDelta !== 0 && (
              <p className="mt-0.5 text-xs font-semibold" style={{ color: weightDelta < 0 ? '#4ade80' : '#fb923c' }}>
                {weightDelta < 0 ? '▼' : '▲'} {Math.abs(weightDelta)} kg
              </p>
            )}
            {weightHistory.length >= 2 && (
              <div style={{ width: '100%', height: 24, marginTop: 4 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightHistory} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <Line type="monotone" dataKey="value" stroke="var(--t-3)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <p className="rk-num mt-1.5" style={{ color: 'var(--t-3)' }}>—</p>
        )}
      </Card>

      {/* ── ENTRENOS SEMANA ── */}
      <Card onClick={onOpenActivity}>
        <p className="rk-label">{t('mc_metric_week')}</p>
        <p className="rk-num mt-1.5" style={{ color: weekMet ? '#4ade80' : 'var(--t-1)' }}>
          {weekSessions}<span style={{ fontSize: 14, color: 'var(--t-3)', marginLeft: 4 }}>/{weekTarget}</span>
        </p>
        <div className="mt-2">
          <SegmentedProgress total={weekTarget} done={weekSessions} height={6} />
        </div>
      </Card>

      {/* ── RACHA ── */}
      <Card onClick={onOpenActivity}>
        <p className="rk-label">{t('mc_metric_streak')}</p>
        <p className="rk-num-gold mt-1.5">
          {streak}<span style={{ fontSize: 14, color: 'var(--t-3)', marginLeft: 4 }}>{t(streak === 1 ? 'mc_metric_day' : 'mc_metric_days')}</span>
        </p>
      </Card>

      {/* ── OBJETIVO DE PESO ── */}
      <Card onClick={onOpenWeight}>
        <p className="rk-label">{t('mc_metric_goal')}</p>
        {targetWeight != null ? (
          <>
            <p className="rk-num-gold mt-1.5">{targetWeight}<span style={{ fontSize: 14, color: 'var(--t-3)', marginLeft: 4 }}>kg</span></p>
            {toGo !== null && toGo !== 0 && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--t-3)' }}>
                {t('mc_metric_goal_togo', { n: Math.abs(toGo) })}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs" style={{ color: 'var(--t-3)' }}>{t('mc_metric_goal_empty')}</p>
        )}
      </Card>
    </div>
  );
}
