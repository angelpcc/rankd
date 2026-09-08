import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable, isMissingColumn } from '@/lib/dbState';
import Reveal from '@/components/base/Reveal';
import SegmentedProgress from '@/components/base/SegmentedProgress';
import StateBlock from '@/components/base/StateBlock';
import CountUp from '@/components/base/CountUp';
import GoalGauge from '@/components/base/GoalGauge';
import EmptyArt from '@/components/base/EmptyArt';
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
  recorded_at: string | null;
}

const RANGES = [
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '3M' },
  { days: 3650, label: '∞' },
];

/** Ventana de la media móvil: suaviza el ruido diario (agua, comida, hora). */
const TREND_WINDOW = 7;

interface ChartPoint {
  date: string; iso: string; kg: number; trend: number;
  delta: number | null; toGoal: number | null;
}

/**
 * Tarjeta del gráfico de peso. Se pinta al tocar o pasar por un punto y da el
 * contexto que un número suelto no da: si ese día subiste o bajaste, por dónde
 * iba la tendencia y cuánto faltaba para el objetivo.
 */
function WeightTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  const { t } = useTranslation();
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid var(--s-3)', borderRadius: 12, padding: '10px 12px', minWidth: 148 }}>
      <p style={{ fontSize: 11, color: 'var(--t-3)', margin: 0 }}>{d.date}</p>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1.1, color: 'var(--t-1)', margin: '2px 0 0' }}>
        {d.kg}<span style={{ fontSize: 13, color: 'var(--t-3)', marginLeft: 3 }}>kg</span>
      </p>
      {d.delta !== null && d.delta !== 0 && (
        <p style={{ fontSize: 11, margin: '3px 0 0', color: d.delta < 0 ? '#4ade80' : '#fb923c' }}>
          {d.delta < 0 ? '▼' : '▲'} {Math.abs(d.delta)} kg {t('mc_w_tt_vs_prev')}
        </p>
      )}
      <p style={{ fontSize: 11, margin: '5px 0 0', color: 'var(--t-2)' }}>
        {t('mc_w_tt_trend')}: <strong style={{ color: 'var(--t-1)' }}>{d.trend} kg</strong>
      </p>
      {d.toGoal !== null && (
        <p style={{ fontSize: 11, margin: '2px 0 0', color: 'var(--t-2)' }}>
          {t('mc_w_tt_to_goal')}: <strong style={{ color: 'var(--t-1)' }}>{Math.abs(d.toGoal)} kg</strong>
        </p>
      )}
    </div>
  );
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayISO(): string {
  return iso(new Date());
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
  // Se enciende ~1 s tras registrar: destella el borde de la card y la cifra
  // rebota. Es la confirmación visual del principio 8, además del toast.
  const [justSaved, setJustSaved] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [classInput, setClassInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  // Para qué es el objetivo: cambio físico ('body') o dar el peso de una pelea
  // ('weighin'). NO hace falta columna nueva: se deduce de si hay fecha de
  // pesaje guardada, que es justo lo que distingue un caso del otro.
  const [goalKind, setGoalKind] = useState<'body' | 'weighin'>('body');
  const [savingGoal, setSavingGoal] = useState(false);
  const [range, setRange] = useState(90);
  // Si la migración 0035 aún no está, ocultamos la hora del registro.
  const [recordedReady, setRecordedReady] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [weightRes0, goalRes] = await Promise.all([
      supabase.from('weight_entries').select('id, weight_kg, entry_date, note, recorded_at')
        .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(400),
      // select('*') a propósito: weigh_in_date y weight_class_label son columnas
      // nuevas y pedirlas por nombre fallaría si la migración 0010 no está aplicada.
      supabase.from('nutrition_goals').select('*').eq('fighter_profile_id', profile.id).maybeSingle(),
    ]);
    let weightRes = weightRes0;
    if (weightRes.error && isMissingColumn(weightRes.error)) {
      setRecordedReady(false);
      // Fallback sin recorded_at (migración 0035 sin aplicar): mismo shape,
      // recorded_at queda undefined y la UI oculta la hora.
      weightRes = await supabase.from('weight_entries').select('id, weight_kg, entry_date, note')
        .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(400) as typeof weightRes0;
    }
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
    const now = new Date().toISOString();
    const existing = weights.find((w) => w.entry_date === today);
    if (existing) {
      let recordedOk = true;
      const patch: Record<string, unknown> = { weight_kg: val, recorded_at: now };
      let { error } = await supabase.from('weight_entries').update(patch).eq('id', existing.id);
      if (error && isMissingColumn(error)) {
        recordedOk = false;
        setRecordedReady(false);
        ({ error } = await supabase.from('weight_entries').update({ weight_kg: val }).eq('id', existing.id));
      }
      if (error) { showToast(t('error_save'), 'error'); setSavingWeight(false); return; }
      setWeights((prev) => prev.map((w) => w.id === existing.id ? { ...w, weight_kg: val, recorded_at: recordedOk ? now : w.recorded_at } : w));
    } else {
      const full = { fighter_profile_id: profile.id, weight_kg: val, entry_date: today, recorded_at: now };
      let res = await supabase.from('weight_entries').insert(full)
        .select('id, weight_kg, entry_date, note, recorded_at').maybeSingle();
      if (res.error && isMissingColumn(res.error)) {
        setRecordedReady(false);
        res = await supabase.from('weight_entries')
          .insert({ fighter_profile_id: profile.id, weight_kg: val, entry_date: today })
          .select('id, weight_kg, entry_date, note').maybeSingle();
      }
      if (res.error || !res.data) { showToast(t('error_save'), 'error'); setSavingWeight(false); return; }
      setWeights((prev) => [res.data as WeightEntry, ...prev]);
    }
    // Feedback inmediato con comparación, para que se note el progreso sin
    // tener que abrir el gráfico (prioriza ayer; si no hay, compara con hace
    // una semana).
    const yesterdayEntry = weights.find((w) => w.entry_date === iso(new Date(Date.now() - 86400000)));
    const weekAgoEntry = weights.find((w) => w.entry_date === iso(new Date(Date.now() - 7 * 86400000)));
    const ref = yesterdayEntry ? { entry: yesterdayEntry, labelKey: 'mc_w_vs_yesterday' } : weekAgoEntry ? { entry: weekAgoEntry, labelKey: 'mc_w_vs_week' } : null;
    let msg = t('mc_w_registered_n', { n: val });
    if (ref) {
      const d = +(val - ref.entry.weight_kg).toFixed(1);
      if (d !== 0) msg += ` · ${d > 0 ? '↑ +' : '↓ '}${d}kg ${t(ref.labelKey)}`;
    }
    showToast(msg);
    setWeightInput('');
    setSavingWeight(false);
    // Confirmación visual: la card destella y la cifra rebota mientras cuenta
    // hasta el nuevo valor. Se apaga sola para no dejar la animación pegada.
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1000);
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
    // Si hay fecha de pesaje guardada, el objetivo era de pelea.
    setGoalKind(weighInDate ? 'weighin' : 'body');
    setShowGoal(true);
  };

  const saveGoal = async () => {
    setSavingGoal(true);
    const target = targetInput ? parseFloat(targetInput.replace(',', '.')) : null;
    const isWeighIn = goalKind === 'weighin';
    // Reescribimos la fila entera: nutrition_goals la comparten Peso y Nutrición.
    // Al pasar a objetivo físico se LIMPIAN categoría y fecha: si quedaran, la
    // pantalla seguiría contando días para un pesaje que ya no existe.
    const row: Record<string, unknown> = {
      fighter_profile_id: profile.id,
      target_weight_kg: target,
      daily_water_goal_ml: waterGoal,
      weight_class_label: isWeighIn ? (classInput.trim() || null) : null,
      weigh_in_date: isWeighIn ? (dateInput || null) : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('nutrition_goals').upsert(row, { onConflict: 'fighter_profile_id' });
    if (error) { showToast(t('error_save'), 'error'); setSavingGoal(false); return; }
    setTargetWeight(target);
    setClassLabel(isWeighIn ? (classInput.trim() || null) : null);
    setWeighInDate(isWeighIn ? (dateInput || null) : null);
    setShowGoal(false);
    setSavingGoal(false);
    showToast(t('mc_ci_saved'));
  };

  const currentWeight = weights[0]?.weight_kg ?? null;
  const prevWeight = weights[1]?.weight_kg ?? null;
  const weightTrend = currentWeight !== null && prevWeight !== null ? +(currentWeight - prevWeight).toFixed(1) : null;
  const toTarget = currentWeight !== null && targetWeight !== null ? +(currentWeight - targetWeight).toFixed(1) : null;

  // Progreso visual hacia el objetivo: usa el primer peso registrado como
  // punto de partida (no hay start_weight guardado aparte).
  const goalPct = useMemo(() => {
    if (currentWeight === null || targetWeight === null || weights.length < 2) return null;
    const start = weights[weights.length - 1].weight_kg;
    const total = targetWeight - start;
    if (Math.abs(total) < 0.01) return 100;
    return Math.max(0, Math.min(100, Math.round(((currentWeight - start) / total) * 100)));
  }, [currentWeight, targetWeight, weights]);

  // 10 tramos = pasos de 10 % hacia el objetivo, para la barra segmentada.
  const goalSeg = goalPct === null ? null : { total: 10, done: Math.max(0, Math.min(10, Math.round(goalPct / 10))) };

  const daysToWeighIn = useMemo(() => {
    if (!weighInDate) return null;
    return Math.round((new Date(weighInDate + 'T12:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  }, [weighInDate]);

  /** Ritmo semanal necesario para llegar al peso el día del pesaje. */
  const pace = useMemo(() => {
    // Ritmo de corte: aplica cuando hay PESAJE marcado, no por el tipo de cuenta.
    if (!weighInDate || toTarget === null || daysToWeighIn === null || daysToWeighIn <= 0) return null;
    if (toTarget <= 0.1) return { kg: 0, state: 'done' as const };
    const perWeek = +(toTarget / (daysToWeighIn / 7)).toFixed(2);
    // Por encima de ~1 kg/semana el corte deja de ser cómodo y hay que vigilarlo.
    return { kg: perWeek, state: perWeek > 1 ? ('fast' as const) : ('ok' as const) };
  }, [weighInDate, toTarget, daysToWeighIn]);

  const rangeStats = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - range);
    const inRange = weights.filter((w) => new Date(w.entry_date + 'T12:00:00') >= since);
    if (inRange.length < 2) return null;
    const sorted = [...inRange].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    return { delta: +(sorted[sorted.length - 1].weight_kg - sorted[0].weight_kg).toFixed(1) };
  }, [weights, range]);

  // Serie del gráfico: peso del día + media móvil ("tendencia") + variación
  // frente al registro anterior + distancia al objetivo. Todo se calcula aquí
  // para que el tooltip no tenga que volver a buscar nada.
  const chartData = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - range);
    const inRange = [...weights]
      .filter((w) => new Date(w.entry_date + 'T12:00:00') >= since)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    return inRange.map((w, i) => {
      const window = inRange.slice(Math.max(0, i - (TREND_WINDOW - 1)), i + 1);
      const trend = +(window.reduce((a, x) => a + Number(x.weight_kg), 0) / window.length).toFixed(2);
      const prev = i > 0 ? Number(inRange[i - 1].weight_kg) : null;
      return {
        date: new Date(w.entry_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
        iso: w.entry_date,
        kg: Number(w.weight_kg),
        trend,
        delta: prev === null ? null : +(Number(w.weight_kg) - prev).toFixed(1),
        toGoal: targetWeight === null ? null : +(Number(w.weight_kg) - targetWeight).toFixed(1),
      };
    });
  }, [weights, range, locale, targetWeight]);

  /** Media móvil actual — el número que de verdad indica si subes o bajas. */
  const trendNow = chartData.length ? chartData[chartData.length - 1].trend : null;

  if (loading) {
    return <StateBlock variant="loading" />;
  }

  if (unavailable) {
    return <StateBlock variant="empty" art="weight"
      title={t('mc_coming_soon_title')} description={t('mc_coming_soon_desc')} />;
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

      {/* ── CARD PRINCIPAL: peso actual + progreso hacia el objetivo ── */}
      {/* `justSaved` dispara el destello del borde al registrar (principio 8). */}
      <div className={`card-primary ${justSaved ? 'rk-saved' : ''}`} style={{ padding: 22 }}>
        {currentWeight !== null ? (
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div className="min-w-0">
              <p className="rk-label" style={{ marginBottom: 6 }}>{t('mc_w_current')}</p>
              <div className="flex items-end gap-2">
                <CountUp
                  key={currentWeight}
                  value={currentWeight} decimals={1} duration={800}
                  className={justSaved ? 'rk-pop' : undefined}
                  style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, lineHeight: 0.85, color: '#fff', display: 'inline-block' }}
                />
                <span className="text-sm text-zinc-500 mb-1">kg</span>
                {weightTrend !== null && weightTrend !== 0 && (
                  <span className={`text-xs font-bold mb-1.5 inline-flex items-center gap-0.5 ${weightTrend < 0 ? 'text-green-400' : 'text-orange-400'}`}>
                    <i className={weightTrend < 0 ? 'ri-arrow-down-line' : 'ri-arrow-up-line'}></i>{Math.abs(weightTrend)}
                  </span>
                )}
              </div>
              <div className="mt-4">
                {targetWeight !== null ? (
                  <div className="flex items-center justify-between text-xs mb-2 gap-2">
                    <span className="text-zinc-400 truncate">{classLabel || t('mc_w_target')}</span>
                    <span className="font-bold flex-shrink-0 text-white">{targetWeight} kg</span>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 mb-2">{t('mc_w_no_goal')}</p>
                )}
                {goalSeg && <SegmentedProgress total={goalSeg.total} done={goalSeg.done} height={10} />}
              </div>
            </div>

            {/* Distancia al objetivo, en gráfico: el arco se rellena al entrar */}
            {goalPct !== null && toTarget !== null && (
              <GoalGauge
                pct={goalPct}
                value={Math.abs(toTarget).toFixed(1)}
                label={t('mc_w_to_goal')}
              />
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="flex justify-center mb-1"><EmptyArt kind="weight" size={96} /></div>
            <p className="text-base font-bold text-white mt-2">{t('mc_w_empty')}</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">{t('mc_w_empty_hint')}</p>
          </div>
        )}
      </div>

      {/* PRO: ritmo necesario para llegar al peso */}
      {pace && (
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
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-[#E10600]" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">kg</span>
            </div>
          </div>
          <button onClick={addWeight} disabled={savingWeight || !weightInput}
            className="rk-cta rk-press flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ fontSize: '0.9rem', padding: '0.85rem 1.6rem', minHeight: 48 }}>
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
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_w_evolution')}</h3>
              <div className="flex gap-1" role="group" aria-label={t('mc_w_evolution')}>
                {RANGES.map((r) => (
                  <button key={r.days} onClick={() => setRange(r.days)} aria-pressed={range === r.days}
                    style={{ minHeight: 32 }}
                    className={`text-xs font-bold px-2.5 rounded-lg transition-colors cursor-pointer ${range === r.days ? 'bg-[#E10600] text-white' : 'bg-white/[0.04] text-zinc-400 hover:text-white'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Leyenda: separar "lo que pesaste hoy" de "hacia dónde vas". */}
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--t-2)' }}>
                <span style={{ width: 14, height: 3, borderRadius: 2, background: '#E10600' }} />
                {t('mc_w_legend_daily')}
              </span>
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--t-2)' }}>
                <span style={{ width: 14, height: 0, borderTop: '2px dashed rgba(255,255,255,0.55)' }} />
                {t('mc_w_legend_trend', { n: TREND_WINDOW })}
                {trendNow !== null && <strong style={{ color: 'var(--t-1)' }}>· {trendNow} kg</strong>}
              </span>
            </div>

            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wtgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E10600" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#E10600" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} minTickGap={24} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={38} />
                  {/* Guía vertical roja en el punto activo, en vez del cursor gris. */}
                  <Tooltip content={<WeightTooltip />} cursor={{ stroke: '#E10600', strokeWidth: 1, strokeDasharray: '3 3' }} />
                  {targetWeight !== null && (
                    <ReferenceLine y={targetWeight} stroke="rgba(255,255,255,0.45)" strokeDasharray="5 4"
                      label={{ value: `${targetWeight} kg`, fill: 'rgba(255,255,255,0.6)', fontSize: 10, position: 'insideTopRight' }} />
                  )}
                  {/* La línea se dibuja de izquierda a derecha al entrar; la
                      tendencia entra después para que se lean por separado. */}
                  <Area type="monotone" dataKey="kg" stroke="#E10600" strokeWidth={2.5} fill="url(#wtgrad)"
                    dot={{ r: 3, fill: '#E10600' }}
                    activeDot={{ r: 6, fill: '#E10600', stroke: 'rgba(225,6,0,0.35)', strokeWidth: 6 }}
                    isAnimationActive animationDuration={900} animationEasing="ease-out" />
                  <Area type="monotone" dataKey="trend" stroke="rgba(255,255,255,0.55)" strokeWidth={2}
                    strokeDasharray="4 4" fill="none" dot={false} activeDot={false}
                    isAnimationActive animationBegin={350} animationDuration={800} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>
      ) : (
        <StateBlock variant="empty" art="weight"
          title={t('mc_w_no_chart')} description={t('mc_w_no_chart_desc')} />
      )}

      {/* ── MÉTRICAS SECUNDARIAS ── (bajo el gráfico, no como bloque principal) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rk-card" style={{ padding: 14, background: 'var(--s-2)' }}>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('mc_w_change')}</p>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, lineHeight: 1, marginTop: 4, color: rangeStats ? (rangeStats.delta <= 0 ? '#4ade80' : '#fb923c') : 'var(--t-3)' }}>
            {rangeStats ? `${rangeStats.delta > 0 ? '+' : ''}${rangeStats.delta}` : t('mc_w_no_data')}
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5">{rangeStats ? `kg · ${RANGES.find((r) => r.days === range)?.label}` : ' '}</p>
        </div>

        {/* Estas dos tarjetas siguen el TIPO DE OBJETIVO, no el tipo de cuenta:
            con objetivo físico no se habla de categoría ni de días para el
            pesaje, porque no hay pesaje. */}
        <div className="rk-card" style={{ padding: 14, background: 'var(--s-2)' }}>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{classLabel ? t('mc_w_category_target') : t('mc_w_target')}</p>
          {classLabel ? (
            <p className="text-sm font-bold mt-1.5 truncate text-white">{classLabel}</p>
          ) : targetWeight !== null ? (
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, lineHeight: 1, marginTop: 4, color: 'var(--t-1)' }}>{targetWeight}<span className="text-[10px] text-zinc-500"> kg</span></p>
          ) : (
            <p className="text-xs text-zinc-600 mt-1.5">{t('mc_w_no_goal')}</p>
          )}
        </div>

        <div className="rk-card" style={{ padding: 14, background: 'var(--s-2)' }}>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{weighInDate ? t('mc_fp_weigh_in') : t('mc_w_records')}</p>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, lineHeight: 1, marginTop: 4, color: daysToWeighIn !== null ? '#E10600' : '#fff' }}>
            {weighInDate ? (daysToWeighIn !== null ? daysToWeighIn : t('mc_w_no_data')) : weights.length}
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            {weighInDate ? t('mc_w_to_weigh_days') : t('mc_w_weigh_ins')}
          </p>
        </div>
      </div>

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
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#E10600]/10 border border-[#E10600]/25 text-[#E10600] flex-shrink-0">
                    <i className="ri-scales-2-line"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">
                        {w.weight_kg} kg
                        {recordedReady && w.recorded_at && (
                          <span className="text-zinc-500 font-normal"> · {new Date(w.recorded_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </p>
                      {diff !== null && diff !== 0 && (
                        <span className={`text-[11px] font-bold ${diff < 0 ? 'text-green-400' : 'text-orange-400'}`}>{diff > 0 ? '+' : ''}{diff}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 first-letter:uppercase">{new Date(w.entry_date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
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
              {/* Para qué es el objetivo. Antes esto lo decidía el tipo de
                  cuenta: si competías, SIEMPRE era categoría y pesaje. Pero
                  fuera de campamento un competidor puede querer simplemente
                  subir a 80 kg, y eso no es una categoría. Ahora se elige por
                  objetivo, no por cuenta. */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">{t('mc_w_kind_label')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { k: 'body' as const, icon: 'ri-body-scan-line', labelKey: 'mc_w_kind_body' },
                    { k: 'weighin' as const, icon: 'ri-sword-line', labelKey: 'mc_w_kind_weighin' },
                  ]).map((o) => (
                    <button key={o.k} type="button" onClick={() => setGoalKind(o.k)}
                      aria-pressed={goalKind === o.k} style={{ minHeight: 60 }}
                      className={`rk-press flex flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold cursor-pointer px-2 ${
                        goalKind === o.k
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'}`}>
                      <i className={`${o.icon} text-lg`} />
                      <span className="text-center leading-tight">{t(o.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {goalKind === 'weighin' && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_w_class_label')}</label>
                  <input value={classInput} onChange={(e) => setClassInput(e.target.value)} maxLength={40} placeholder={t('mc_w_class_ph')}
                    style={{ fontSize: 16, minHeight: 44 }}
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#E10600]" />
                </div>
              )}

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  {goalKind === 'weighin' ? t('mc_w_limit') : t('mc_w_target_hobby')}
                </label>
                <input value={targetInput} onChange={(e) => setTargetInput(e.target.value)} inputMode="decimal" placeholder="70.0"
                  style={{ fontSize: 16, minHeight: 44 }}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#E10600]" />
              </div>

              {goalKind === 'weighin' && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_w_weigh_in_date')}</label>
                  <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)}
                    style={{ fontSize: 16, minHeight: 44 }}
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#E10600] cursor-pointer" />
                </div>
              )}

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                {goalKind === 'weighin' ? t('mc_w_hint_pro') : t('mc_w_hint_hobby')}
              </p>

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
