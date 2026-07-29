import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import Reveal from '@/components/base/Reveal';
import WeightCutPlanner from '@/pages/mi-esquina/components/WeightCutPlanner';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** 'pro' = enfocado a dar el peso de una categoría en una fecha; 'hobby' = objetivo personal */
  mode?: 'pro' | 'hobby';
}

interface WeightEntry {
  id: string;
  weight_kg: number;
  entry_date: string;
  note: string | null;
}

const RANGES = [
  { days: 30, label: '1M' },
  { days: 90, label: '3M' },
  { days: 180, label: '6M' },
  { days: 3650, label: '∞' },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WeightTracker({ profile, showToast, mode = 'pro' }: Props) {
  const { t, i18n } = useTranslation();
  const isPro = mode === 'pro';
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [waterGoal, setWaterGoal] = useState(2500);
  const [weighInDate, setWeighInDate] = useState<string | null>(null);
  const [classLabel, setClassLabel] = useState<string | null>(null);

  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [classInput, setClassInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [range, setRange] = useState(90);

  const load = useCallback(async () => {
    setLoading(true);
    const [weightRes, goalRes] = await Promise.all([
      supabase.from('weight_entries').select('id, weight_kg, entry_date, note')
        .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(400),
      // select('*') a propósito: weigh_in_date y weight_class_label son columnas
      // nuevas y pedirlas por nombre fallaría si la migración 0010 no está aplicada.
      supabase.from('nutrition_goals').select('*').eq('fighter_profile_id', profile.id).maybeSingle(),
    ]);
    if (isMissingTable(weightRes.error)) { setUnavailable(true); setLoading(false); return; }
    setWeights((weightRes.data || []) as WeightEntry[]);
    const g = goalRes.data as Record<string, unknown> | null;
    setTargetWeight((g?.target_weight_kg as number | null) ?? null);
    setWaterGoal((g?.daily_water_goal_ml as number | null) || 2500);
    setWeighInDate((g?.weigh_in_date as string | null) ?? null);
    setClassLabel((g?.weight_class_label as string | null) ?? null);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const addWeight = async () => {
    const val = parseFloat(weightInput.replace(',', '.'));
    if (!val || val < 20 || val > 250) { showToast(t('error_save'), 'error'); return; }
    setSavingWeight(true);
    const today = todayISO();
    const existing = weights.find((w) => w.entry_date === today);
    if (existing) {
      const { error } = await supabase.from('weight_entries').update({ weight_kg: val }).eq('id', existing.id);
      if (error) { showToast(t('error_save'), 'error'); setSavingWeight(false); return; }
      setWeights((prev) => prev.map((w) => w.id === existing.id ? { ...w, weight_kg: val } : w));
    } else {
      const { data, error } = await supabase.from('weight_entries')
        .insert({ fighter_profile_id: profile.id, weight_kg: val, entry_date: today })
        .select('id, weight_kg, entry_date, note').maybeSingle();
      if (error || !data) { showToast(t('error_save'), 'error'); setSavingWeight(false); return; }
      setWeights((prev) => [data, ...prev]);
    }
    setWeightInput('');
    showToast(t('mc_ci_saved'));
    setSavingWeight(false);
  };

  const deleteWeight = async (id: string) => {
    const { error } = await supabase.from('weight_entries').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); return; }
    setWeights((prev) => prev.filter((w) => w.id !== id));
  };

  const openGoal = () => {
    setTargetInput(targetWeight?.toString() || '');
    setClassInput(classLabel || '');
    setDateInput(weighInDate || '');
    setShowGoal(true);
  };

  const saveGoal = async () => {
    setSavingGoal(true);
    const target = targetInput ? parseFloat(targetInput.replace(',', '.')) : null;
    // Reescribimos la fila entera: nutrition_goals la comparten Peso y Nutrición.
    const row: Record<string, unknown> = {
      fighter_profile_id: profile.id,
      target_weight_kg: target,
      daily_water_goal_ml: waterGoal,
      updated_at: new Date().toISOString(),
    };
    if (isPro) {
      row.weight_class_label = classInput.trim() || null;
      row.weigh_in_date = dateInput || null;
    }
    const { error } = await supabase.from('nutrition_goals').upsert(row, { onConflict: 'fighter_profile_id' });
    if (error) { showToast(t('error_save'), 'error'); setSavingGoal(false); return; }
    setTargetWeight(target);
    if (isPro) { setClassLabel(classInput.trim() || null); setWeighInDate(dateInput || null); }
    setShowGoal(false);
    setSavingGoal(false);
    showToast(t('mc_ci_saved'));
  };

  const currentWeight = weights[0]?.weight_kg ?? null;
  const prevWeight = weights[1]?.weight_kg ?? null;
  const weightTrend = currentWeight !== null && prevWeight !== null ? +(currentWeight - prevWeight).toFixed(1) : null;
  const toTarget = currentWeight !== null && targetWeight !== null ? +(currentWeight - targetWeight).toFixed(1) : null;

  const daysToWeighIn = useMemo(() => {
    if (!weighInDate) return null;
    return Math.round((new Date(weighInDate + 'T12:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  }, [weighInDate]);

  /** Ritmo semanal necesario para llegar al peso el día del pesaje. */
  const pace = useMemo(() => {
    if (!isPro || toTarget === null || daysToWeighIn === null || daysToWeighIn <= 0) return null;
    if (toTarget <= 0.1) return { kg: 0, state: 'done' as const };
    const perWeek = +(toTarget / (daysToWeighIn / 7)).toFixed(2);
    // Por encima de ~1 kg/semana el corte deja de ser cómodo y hay que vigilarlo.
    return { kg: perWeek, state: perWeek > 1 ? ('fast' as const) : ('ok' as const) };
  }, [isPro, toTarget, daysToWeighIn]);

  const rangeStats = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - range);
    const inRange = weights.filter((w) => new Date(w.entry_date + 'T12:00:00') >= since);
    if (inRange.length < 2) return null;
    const sorted = [...inRange].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    return { delta: +(sorted[sorted.length - 1].weight_kg - sorted[0].weight_kg).toFixed(1) };
  }, [weights, range]);

  const chartData = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - range);
    return [...weights]
      .filter((w) => new Date(w.entry_date + 'T12:00:00') >= since)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
      .map((w) => ({
        date: new Date(w.entry_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
        kg: w.weight_kg,
      }));
  }, [weights, range, locale]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/25 anim-float">
          <i className="ri-scales-2-line text-3xl text-[#C9A84C]"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">{isPro ? t('mc_w_pro_eyebrow') : t('mc_w_hobby_eyebrow')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            {isPro ? t('mc_w_title_pro') : t('mc_w_title_hobby')}{' '}
            <span className="rk-red-glow">{isPro ? t('mc_w_title_pro_2') : t('mc_w_title_hobby_2')}</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{isPro ? t('mc_w_sub_pro') : t('mc_w_sub_hobby')}</p>
        </div>
        <button onClick={openGoal} className="rk-btn rk-btn-ghost flex items-center gap-2" style={{ fontSize: '0.8rem', padding: '0.6rem 1.2rem' }}>
          <i className="ri-flag-line"></i> {isPro ? t('mc_w_goal_btn_pro') : t('mc_w_goal_btn_hobby')}
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rk-card" style={{ padding: '18px 16px' }}>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{t('mc_w_current')}</p>
          <div className="flex items-end gap-2 mt-1">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, lineHeight: 0.9, color: '#fff' }}>{currentWeight ?? '—'}</span>
            {currentWeight !== null && <span className="text-xs text-zinc-500 mb-1.5">kg</span>}
          </div>
          {weightTrend !== null && weightTrend !== 0 && (
            <p className={`text-xs font-bold mt-1 flex items-center gap-0.5 ${weightTrend < 0 ? 'text-green-400' : 'text-orange-400'}`}>
              <i className={weightTrend < 0 ? 'ri-arrow-down-line' : 'ri-arrow-up-line'}></i>{Math.abs(weightTrend)} kg
            </p>
          )}
        </div>

        <div className="rk-card" style={{ padding: '18px 16px' }}>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{isPro ? t('mc_w_category_target') : t('mc_w_target')}</p>
          <div className="flex items-end gap-2 mt-1">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, lineHeight: 0.9, color: targetWeight ? '#C9A84C' : 'rgba(255,255,255,0.3)' }}>{targetWeight ?? '—'}</span>
            {targetWeight !== null && <span className="text-xs text-zinc-500 mb-1.5">kg</span>}
          </div>
          {isPro && classLabel
            ? <p className="text-xs text-[#C9A84C] mt-1 font-semibold truncate">{classLabel}</p>
            : toTarget !== null && (
              <p className={`text-xs font-bold mt-1 ${Math.abs(toTarget) < 0.1 ? 'text-green-400' : 'text-orange-400'}`}>
                {Math.abs(toTarget) < 0.1 ? t('mc_w_on_weight') : toTarget > 0 ? t('mc_w_over', { n: toTarget }) : t('mc_w_under', { n: Math.abs(toTarget) })}
              </p>
            )}
        </div>

        <div className="rk-card" style={{ padding: '18px 16px' }}>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{t('mc_w_change')}</p>
          <div className="flex items-end gap-2 mt-1">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, lineHeight: 0.9, color: rangeStats ? (rangeStats.delta <= 0 ? '#4ade80' : '#fb923c') : 'rgba(255,255,255,0.3)' }}>
              {rangeStats ? `${rangeStats.delta > 0 ? '+' : ''}${rangeStats.delta}` : '—'}
            </span>
            {rangeStats && <span className="text-xs text-zinc-500 mb-1.5">kg</span>}
          </div>
          <p className="text-xs text-zinc-500 mt-1">{RANGES.find((r) => r.days === range)?.label}</p>
        </div>

        {/* PRO: días al pesaje. Afición: número de registros. */}
        <div className="rk-card" style={{ padding: '18px 16px' }}>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{isPro ? t('mc_fp_weigh_in') : t('mc_w_records')}</p>
          <div className="flex items-end gap-2 mt-1">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, lineHeight: 0.9, color: isPro && daysToWeighIn !== null ? '#E10600' : '#fff' }}>
              {isPro ? (daysToWeighIn !== null ? daysToWeighIn : '—') : weights.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {isPro
              ? (daysToWeighIn !== null ? t('mc_w_days_to_weigh', { n: daysToWeighIn }) : t('mc_w_no_weigh_date'))
              : t('mc_w_weigh_ins')}
          </p>
        </div>
      </div>

      {/* PRO: ritmo necesario para llegar al peso */}
      {isPro && pace && (
        <div className="rk-card flex items-start gap-3.5" style={{ padding: '16px 20px', transform: 'none', borderColor: pace.state === 'fast' ? 'rgba(225,6,0,0.3)' : 'rgba(34,197,94,0.25)' }}>
          <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl border ${pace.state === 'fast' ? 'bg-red-600/12 border-red-500/30 text-red-400' : 'bg-green-500/12 border-green-500/30 text-green-400'}`}>
            <i className="ri-speed-up-line text-lg"></i>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('mc_w_pace_title')}</p>
            <p className="text-sm font-bold text-white">
              {pace.state === 'done' ? t('mc_w_pace_done') : t('mc_w_pace_week', { n: pace.kg })}
            </p>
            {pace.state !== 'done' && (
              <p className={`text-xs mt-0.5 ${pace.state === 'fast' ? 'text-red-400' : 'text-green-400'}`}>
                {pace.state === 'fast' ? t('mc_w_pace_fast') : t('mc_w_pace_ok')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Registrar peso */}
      <div className="rk-card" style={{ padding: '18px 20px' }}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-zinc-400 mb-1.5 font-semibold uppercase tracking-wide">{t('mc_w_today')}</label>
            <div className="relative">
              <input value={weightInput} onChange={(e) => setWeightInput(e.target.value)} inputMode="decimal"
                onKeyDown={(e) => { if (e.key === 'Enter') addWeight(); }} placeholder="72.4"
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-[#C9A84C]" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">kg</span>
            </div>
          </div>
          <button onClick={addWeight} disabled={savingWeight || !weightInput}
            className="rk-btn rk-btn-gold flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ fontSize: '0.85rem', padding: '0.85rem 1.6rem' }}>
            {savingWeight ? <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div> : <><i className="ri-add-line"></i> {t('mc_w_register')}</>}
          </button>
        </div>
        {weights.some((w) => w.entry_date === todayISO()) && (
          <p className="text-[11px] text-green-400 mt-2 flex items-center gap-1.5"><i className="ri-check-line"></i>{t('mc_w_registered_today')}</p>
        )}
      </div>

      {/* Gráfico */}
      {chartData.length >= 2 ? (
        <Reveal>
          <div className="rk-card" style={{ padding: '22px 20px' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_w_evolution')}</h3>
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button key={r.days} onClick={() => setRange(r.days)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${range === r.days ? 'bg-[#C9A84C] text-zinc-900' : 'bg-white/[0.04] text-zinc-400 hover:text-white'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wtgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} minTickGap={24} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={38} />
                  <Tooltip contentStyle={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: 'rgba(255,255,255,0.5)' }} formatter={(v: number) => [`${v} kg`, '']} />
                  {targetWeight !== null && (
                    <ReferenceLine y={targetWeight} stroke="#E10600" strokeDasharray="5 4" strokeOpacity={0.7}
                      label={{ value: `${targetWeight} kg`, fill: '#E10600', fontSize: 10, position: 'insideTopRight' }} />
                  )}
                  <Area type="monotone" dataKey="kg" stroke="#C9A84C" strokeWidth={2.5} fill="url(#wtgrad)" dot={{ r: 3, fill: '#C9A84C' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>
      ) : (
        <div className="rk-card text-center" style={{ padding: '40px 24px' }}>
          <i className="ri-line-chart-line text-4xl text-zinc-700"></i>
          <p className="text-sm text-zinc-400 mt-3 font-medium">{t('mc_w_no_chart')}</p>
          <p className="text-xs text-zinc-600 mt-1">{t('mc_w_no_chart_desc')}</p>
        </div>
      )}

      {/* Historial */}
      {weights.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">{t('mc_w_history')}</h3>
          <div className="space-y-2">
            {weights.slice(0, 12).map((w, i) => {
              const next = weights[i + 1];
              const diff = next ? +(w.weight_kg - next.weight_kg).toFixed(1) : null;
              return (
                <div key={w.id} className="rk-card flex items-center gap-4 group" style={{ padding: '12px 16px' }}>
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/25 text-[#C9A84C] flex-shrink-0">
                    <i className="ri-scales-2-line"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{w.weight_kg} kg</p>
                      {diff !== null && diff !== 0 && (
                        <span className={`text-[11px] font-bold ${diff < 0 ? 'text-green-400' : 'text-orange-400'}`}>{diff > 0 ? '+' : ''}{diff}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 capitalize">{new Date(w.entry_date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  </div>
                  <button onClick={() => deleteWeight(w.id)} aria-label={t('mc_delete')}
                    className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isPro && <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5"><i className="ri-information-line mt-0.5"></i>{t('mc_w_health_note')}</p>}

      {/* PRO: planificador de corte hasta el pesaje */}
      {isPro && (
        <>
          <div className="rk-rule" style={{ width: '100%', opacity: 0.5 }} />
          <WeightCutPlanner
            current={currentWeight}
            target={targetWeight}
            weighIn={weighInDate}
            classLabel={classLabel}
            onSetGoal={openGoal}
          />
        </>
      )}

      {/* Modal objetivo */}
      {showGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowGoal(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full max-w-sm max-h-[90vh] overflow-y-auto" style={{ padding: 24, transform: 'none' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>{isPro ? t('mc_w_modal_pro') : t('mc_w_modal_hobby')}</h3>
              <button onClick={() => setShowGoal(false)} aria-label={t('mc_close')}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              {isPro && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_w_class_label')}</label>
                  <input value={classInput} onChange={(e) => setClassInput(e.target.value)} maxLength={40} placeholder={t('mc_w_class_ph')}
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]" />
                </div>
              )}

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{isPro ? t('mc_w_limit') : t('mc_w_target_hobby')}</label>
                <input value={targetInput} onChange={(e) => setTargetInput(e.target.value)} inputMode="decimal" autoFocus={!isPro} placeholder="70.0"
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]" />
              </div>

              {isPro && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_w_weigh_in_date')}</label>
                  <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C] cursor-pointer" />
                </div>
              )}

              <p className="text-[11px] text-zinc-500 leading-relaxed">{isPro ? t('mc_w_hint_pro') : t('mc_w_hint_hobby')}</p>

              <button onClick={saveGoal} disabled={savingGoal} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem' }}>
                {savingGoal
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
                  : <><i className="ri-check-line"></i> {t('mc_save')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
