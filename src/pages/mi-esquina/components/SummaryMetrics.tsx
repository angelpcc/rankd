import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { LineChart, Line, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

// PILOTO DE TEMA CLARO (PROMPT_DISEÑO): cards individuales por métrica con
// mini gráficos integrados. Sustituye la fila de 3 cards compactas por 3 cards
// separadas verticalmente (una por métrica) en el orden pedido:
//   PESO (línea) · ENTRENAMIENTOS (barras 7 días) · OBJETIVO/COMBATE (barra o número).
// Cada card blanca, con sombra sutil, sobre el fondo crema del scope claro.

interface Props {
  profile: Profile;
  weekSessions: number;
  weekTarget?: number;
  onOpenAgenda: () => void;
  onOpenWeight: () => void;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface WeightPoint { date: string; value: number }

export default function SummaryMetrics({ profile, weekSessions, weekTarget = 4, onOpenAgenda, onOpenWeight }: Props) {
  const { t } = useTranslation();
  const [weightHistory, setWeightHistory] = useState<WeightPoint[]>([]);
  const [weightCurrent, setWeightCurrent] = useState<number | null>(null);
  const [weightDelta, setWeightDelta] = useState<number | null>(null);
  const [weightTarget, setWeightTarget] = useState<number | null>(null);
  const [fightDays, setFightDays] = useState<number | null>(null);
  const [weekDays, setWeekDays] = useState<{ key: string; count: number; today: boolean }[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: entries, error: wErr }, { data: goal }, { data: fight }, { data: sessions }] = await Promise.all([
        supabase.from('weight_entries').select('weight_kg, entry_date')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(14),
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
        supabase.from('planned_events').select('event_date').eq('fighter_profile_id', profile.id)
          .eq('kind', 'fight').gte('event_date', todayISO()).order('event_date', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('training_sessions').select('session_date').eq('fighter_profile_id', profile.id).gte('session_date', iso(new Date(Date.now() - 7 * 86400000))),
      ]);
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
      if (goal?.target_weight_kg) setWeightTarget(Number(goal.target_weight_kg));

      // Combate: días que faltan (si hay).
      if (fight?.event_date) {
        const days = Math.ceil((new Date(fight.event_date + 'T12:00:00').getTime() - Date.now()) / 86400000);
        setFightDays(days >= 0 ? days : null);
      }

      // Entrenamientos: barras de los últimos 7 días (una por día).
      const counts = new Map<string, number>();
      (sessions || []).forEach((s) => counts.set(s.session_date, (counts.get(s.session_date) || 0) + 1));
      const today = todayISO();
      const days: { key: string; count: number; today: boolean }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const k = iso(d);
        days.push({ key: k, count: counts.get(k) || 0, today: k === today });
      }
      setWeekDays(days);
    })();
    return () => { alive = false; };
  }, [profile.id]);

  // ── Card wrapper reutilizable ──
  const Card = ({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} className="rk-lc w-full text-left relative cursor-pointer" style={{ minHeight: 108 }}>
      {children}
      {onClick && <i className="ri-arrow-right-line" style={{ position: 'absolute', top: 20, right: 20, color: 'var(--rkl-text-muted)', fontSize: 16 }} />}
    </button>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* ─────── PESO ─────── */}
      <Card onClick={onOpenWeight}>
        <p className="rk-lc-label">{t('mc_metric_weight')}</p>
        <div className="flex items-center justify-between gap-3 mt-2">
          {weightCurrent !== null ? (
            <div>
              <p className="rk-lc-data">
                {weightCurrent}<span className="rk-lc-unit">kg</span>
              </p>
              {weightDelta !== null && weightDelta !== 0 && (
                <p className="rk-lc-meta mt-1" style={{ color: weightDelta < 0 ? '#16a34a' : '#c2410c', fontWeight: 600 }}>
                  {weightDelta < 0 ? '▼' : '▲'} {Math.abs(weightDelta)} kg
                </p>
              )}
            </div>
          ) : (
            <p className="rk-lc-data" style={{ color: 'var(--rkl-text-muted)' }}>—</p>
          )}
          {weightHistory.length >= 2 && (
            <div style={{ width: 120, height: 44, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightHistory} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <Line type="monotone" dataKey="value" stroke="#E10600" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#E10600' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      {/* ─────── ENTRENAMIENTOS ─────── */}
      <Card onClick={onOpenAgenda}>
        <p className="rk-lc-label">{t('mc_metric_week')}</p>
        <div className="flex items-center justify-between gap-3 mt-2">
          <p className="rk-lc-data" style={{ color: weekSessions >= weekTarget ? '#16a34a' : 'var(--rkl-text-primary)' }}>
            {weekSessions}<span className="rk-lc-unit">/{weekTarget}</span>
          </p>
          {weekDays.length > 0 && (
            <div style={{ width: 130, height: 44, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekDays.map((d) => ({ name: d.key, v: Math.max(0.05, d.count) }))} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <Bar dataKey="v" radius={[3, 3, 0, 0]}>
                    {weekDays.map((d, i) => (
                      <Cell key={i} fill={d.count > 0 ? '#E10600' : '#E5E0D8'} opacity={d.today ? 1 : 0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      {/* ─────── OBJETIVO / COMBATE (sm:col-span-2) ─────── */}
      <div className="sm:col-span-2">
        <Card onClick={fightDays !== null ? onOpenAgenda : onOpenWeight}>
          {fightDays !== null ? (
            <>
              <p className="rk-lc-label">{t('mc_metric_fight')}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="rk-lc-data rk-lc-data-accent">{fightDays}</p>
                <span className="rk-lc-unit">{t('mc_metric_days')}</span>
              </div>
            </>
          ) : weightTarget !== null && weightCurrent !== null ? (
            (() => {
              const remaining = +(weightCurrent - weightTarget).toFixed(1);
              const start = weightHistory[0]?.value ?? weightCurrent;
              const totalToDo = Math.abs(start - weightTarget) || 1;
              const done = Math.max(0, totalToDo - Math.abs(remaining));
              const pct = Math.min(100, Math.round((done / totalToDo) * 100));
              return (
                <>
                  <p className="rk-lc-label">{remaining > 0 ? t('mc_metric_to_lose') : t('mc_metric_to_gain')}</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="rk-lc-data rk-lc-data-accent">{Math.abs(remaining)}</p>
                    <span className="rk-lc-unit">kg</span>
                  </div>
                  <div style={{ marginTop: 12, height: 6, borderRadius: 999, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #E10600, #8A6D1F)', borderRadius: 999, transition: 'width 0.3s ease' }} />
                  </div>
                  <p className="rk-lc-meta mt-1.5">{pct}% · {weightCurrent} → {weightTarget} kg</p>
                </>
              );
            })()
          ) : (
            <>
              <p className="rk-lc-label">{t('mc_metric_goal')}</p>
              <p className="rk-lc-data mt-2" style={{ color: 'var(--rkl-text-muted)' }}>—</p>
              <p className="rk-lc-meta mt-1">{t('mc_metric_goal_hint') || ''}</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
