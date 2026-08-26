import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

// PILOTO DE TEMA CLARO (PROMPT_DISEÑO): tres tarjetas pequeñas en fila —
// PESO ACTUAL · ENTRENOS SEMANA · RACHA. El detalle de peso objetivo/combate
// vive en Progreso (Peso) y en la tarjeta de "próxima pelea" (FightPrep) por
// separado, para no duplicar información en el resumen.

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

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: entries, error: wErr } = await supabase.from('weight_entries').select('weight_kg, entry_date')
        .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(14);
      if (!alive) return;

      // Peso: histórico ordenado asc para el sparkline; delta contra ~7d atrás.
      if (!isMissingTable(wErr) && entries && entries.length) {
        const ordered = [...entries].reverse();
        setWeightHistory(ordered.map((e) => ({ date: e.entry_date, value: Number(e.weight_kg) })));
        setWeightCurrent(Number(entries[0].weight_kg));
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const ref = entries.find((e) => new Date(e.entry_date) <= weekAgo) || entries[1];
        setWeightDelta(ref ? +(Number(entries[0].weight_kg) - Number(ref.weight_kg)).toFixed(1) : null);
      }
    })();
    return () => { alive = false; };
  }, [profile.id]);

  // ── Card wrapper reutilizable ──
  const Card = ({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} className="rk-lc w-full text-left relative cursor-pointer" style={{ minHeight: 96 }}>
      {children}
    </button>
  );

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* ─────── PESO ACTUAL ─────── */}
      <Card onClick={onOpenWeight}>
        <p className="rk-lc-label">{t('mc_metric_weight')}</p>
        {weightCurrent !== null ? (
          <>
            <p className="rk-lc-data mt-1.5">
              {weightCurrent}<span className="rk-lc-unit">kg</span>
            </p>
            {weightDelta !== null && weightDelta !== 0 && (
              <p className="rk-lc-meta mt-0.5" style={{ color: weightDelta < 0 ? '#16a34a' : '#c2410c', fontWeight: 600 }}>
                {weightDelta < 0 ? '▼' : '▲'} {Math.abs(weightDelta)} kg
              </p>
            )}
            {weightHistory.length >= 2 && (
              <div style={{ width: '100%', height: 28, marginTop: 4 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightHistory} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <Line type="monotone" dataKey="value" stroke="#E10600" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <p className="rk-lc-data mt-1.5" style={{ color: 'var(--rkl-text-muted)' }}>—</p>
        )}
      </Card>

      {/* ─────── ENTRENOS SEMANA ─────── */}
      <Card onClick={onOpenActivity}>
        <p className="rk-lc-label">{t('mc_metric_week')}</p>
        <p className="rk-lc-data mt-1.5" style={{ color: weekSessions >= weekTarget ? '#16a34a' : 'var(--rkl-text-primary)' }}>
          {weekSessions}<span className="rk-lc-unit">/{weekTarget}</span>
        </p>
      </Card>

      {/* ─────── RACHA ─────── */}
      <Card onClick={onOpenActivity}>
        <p className="rk-lc-label">{t('mc_metric_streak')}</p>
        <p className="rk-lc-data mt-1.5">
          {streak}<span className="rk-lc-unit">{t(streak === 1 ? 'mc_metric_day' : 'mc_metric_days')}</span>
        </p>
      </Card>
    </div>
  );
}
