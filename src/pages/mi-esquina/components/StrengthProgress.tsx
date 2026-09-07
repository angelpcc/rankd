import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import {
  MUSCLE_GROUPS, muscleGroupOf, weightModeOf, trackingModeOf,
  type MuscleGroup, type WeightMode, type TrackingMode,
} from '../lib/exercises';
import { startOfWeekISO } from '../lib/strength';
import StateBlock from '@/components/base/StateBlock';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// FUERZA · PROGRESIÓN EN EL TIEMPO (pestaña de nivel 2).
//   · Por ejercicio: línea temporal del mejor valor de cada sesión —
//     kg / segundos / metros / reps según weight_mode y tracking_mode.
//   · Por grupo muscular: barras del volumen (series) por semana en las
//     últimas 9 semanas, para ver si un grupo sube, se mantiene o baja.
// Todo es cálculo sobre strength_sets ya guardado. Sin IA.

interface Props { profile: Profile }

interface Row {
  exercise: string;
  exercise_label: string;
  session_date: string;
  reps: number;
  reps_max?: number | null;
  weight_kg: number | string;
  muscle_group: string | null;
  weight_mode: string | null;
  tracking_mode: string | null;
  notes?: string | null;
}

type GroupKey = MuscleGroup | 'other';
const ORDER: GroupKey[] = [...MUSCLE_GROUPS, 'other'];
const WEEKS_BACK = 9;
const RED = '#E10600';

/** Ventanas del selector de periodo. days = null → todo el histórico. */
const PERIODS: { key: string; days: number | null; labelKey: string }[] = [
  { key: '4w', days: 28, labelKey: 'mc_sp_period_4w' },
  { key: '12w', days: 84, labelKey: 'mc_sp_period_12w' },
  { key: '6m', days: 180, labelKey: 'mc_sp_period_6m' },
  { key: 'all', days: null, labelKey: 'mc_sp_period_all' },
];

/** Métricas comparables de una misma sesión. */
type Metric = 'weight' | 'reps' | 'volume' | 'e1rm';

/**
 * 1RM estimado (Epley). Es una ESTIMACIÓN aritmética de la carga máxima
 * teórica, no una recomendación de entrenamiento ni un dato de salud; por eso
 * solo se muestra cuando hay peso y repeticiones reales que la sustenten.
 */
function epley(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return +(weight * (1 + reps / 30)).toFixed(1);
}

interface ExPoint {
  date: string;
  iso: string;
  v: number;
  sets: number;
  bestReps: number;
  bestWeight: number;
  volume: number;
  e1rm: number;
  note: string | null;
}

function fmtShort(iso: string, locale: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export default function StrengthProgress({ profile }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<'exercise' | 'group'>('exercise');
  const [selectedEx, setSelectedEx] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<GroupKey>('chest');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<string>('12w');
  const [metric, setMetric] = useState<Metric>('weight');

  useEffect(() => {
    let alive = true;
    setLoading(true); setLoadError(false);
    (async () => {
      // select('*') a propósito: si la migración 0044 (weight_mode/tracking_mode)
      // no está, esas claves llegan como undefined y se derivan del nombre.
      const { data, error } = await supabase
        .from('strength_sets').select('*')
        .eq('fighter_profile_id', profile.id)
        .order('session_date', { ascending: false })
        .limit(4000);
      if (!alive) return;
      if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
      // Cualquier otro fallo (red, RLS, timeout) es un error real recuperable:
      // se ofrece reintentar en vez de pintar un "todavía no hay datos" falso.
      if (error) { setLoadError(true); setLoading(false); return; }
      setRows((data || []) as Row[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id, reloadKey]);

  const groupOf = (r: Row): GroupKey =>
    (r.muscle_group && ORDER.includes(r.muscle_group as GroupKey)
      ? (r.muscle_group as GroupKey)
      : (muscleGroupOf(r.exercise_label) || 'other'));

  // ── Ejercicios con histórico (más reciente primero) ──
  const exercises = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => { if (!seen.has(r.exercise)) seen.set(r.exercise, r.exercise_label); });
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [rows]);

  useEffect(() => {
    if (!selectedEx && exercises.length) setSelectedEx(exercises[0].key);
  }, [exercises, selectedEx]);

  const filteredEx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? exercises.filter((e) => e.label.toLowerCase().includes(q)) : exercises;
  }, [exercises, search]);

  // ── Progresión del ejercicio elegido ──
  // Por cada sesión se agrega: mejor carga, mejores reps, volumen (Σ reps×peso),
  // e1RM de la mejor serie y la nota. Así el tooltip puede contarlo todo sin
  // volver a consultar nada.
  const exProg = useMemo(() => {
    const exRows = rows.filter((r) => r.exercise === selectedEx);
    const label = exRows[0]?.exercise_label || selectedEx;
    const wm: WeightMode = (exRows.find((r) => r.weight_mode)?.weight_mode as WeightMode) || weightModeOf(label);
    const tm: TrackingMode = (exRows.find((r) => r.tracking_mode)?.tracking_mode as TrackingMode) || trackingModeOf(label);
    // Peso corporal sin lastre en ninguna serie → la progresión útil son las reps.
    const anyLoad = wm === 'bodyweight' && exRows.some((r) => Number(r.weight_kg) > 0);
    const useReps = wm === 'bodyweight' && !anyLoad && tm === 'reps';
    const hasLoad = exRows.some((r) => Number(r.weight_kg) > 0);

    const days = PERIODS.find((p) => p.key === period)?.days ?? null;
    let since = '';
    if (days !== null) {
      const d = new Date(); d.setDate(d.getDate() - days);
      since = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const inRange = days === null ? exRows : exRows.filter((r) => r.session_date >= since);

    const agg = new Map<string, { sets: number; bestReps: number; bestWeight: number; volume: number; e1rm: number; note: string | null }>();
    inRange.forEach((r) => {
      const w = Number(r.weight_kg) || 0;
      const cur = agg.get(r.session_date) ?? { sets: 0, bestReps: 0, bestWeight: 0, volume: 0, e1rm: 0, note: null };
      cur.sets += 1;
      cur.bestReps = Math.max(cur.bestReps, r.reps);
      cur.bestWeight = Math.max(cur.bestWeight, w);
      cur.volume += (tm === 'reps' ? r.reps : 1) * w;
      cur.e1rm = Math.max(cur.e1rm, tm === 'reps' ? epley(w, r.reps) : 0);
      if (!cur.note) { const n = (r.notes || '').trim(); if (n) cur.note = n; }
      agg.set(r.session_date, cur);
    });

    // Qué métrica puede elegirse para este ejercicio.
    const metrics: Metric[] = (tm === 'time' || tm === 'distance')
      ? []
      : useReps
        ? ['reps']
        : hasLoad ? ['weight', 'reps', 'volume', 'e1rm'] : ['reps'];
    const active: Metric = metrics.includes(metric) ? metric : (metrics[0] ?? 'weight');

    const valueOf = (a: NonNullable<ReturnType<typeof agg.get>>): number => {
      if (tm === 'time' || tm === 'distance') return a.bestReps;
      switch (active) {
        case 'reps': return a.bestReps;
        case 'volume': return +a.volume.toFixed(1);
        case 'e1rm': return a.e1rm;
        default: return a.bestWeight;
      }
    };

    const dates = [...agg.keys()].sort();
    const series: ExPoint[] = dates.map((d) => {
      const a = agg.get(d)!;
      return {
        date: fmtShort(d, locale), iso: d, v: valueOf(a),
        sets: a.sets, bestReps: a.bestReps, bestWeight: a.bestWeight,
        volume: +a.volume.toFixed(1), e1rm: a.e1rm, note: a.note,
      };
    });
    const gain = series.length >= 2 ? +(series[series.length - 1].v - series[0].v).toFixed(1) : null;

    return {
      wm, tm, useReps, series, metrics, active, gain,
      firstISO: dates[0],
      lastISO: dates[dates.length - 1],
      times: agg.size,
      /** Nº total de sesiones del ejercicio, ignorando el periodo. */
      totalSessions: new Set(exRows.map((r) => r.session_date)).size,
    };
  }, [rows, selectedEx, locale, period, metric]);

  const unitShort = exProg.tm === 'time' ? t('mc_str_unit_sec')
    : exProg.tm === 'distance' ? t('mc_str_unit_m')
    : exProg.active === 'reps' ? t('mc_sp_u_reps')
    : 'kg';
  const metricCaption = exProg.tm === 'time' ? t('mc_sp_metric_time')
    : exProg.tm === 'distance' ? t('mc_sp_metric_dist')
    : exProg.active === 'reps' ? t('mc_sp_metric_reps')
    : exProg.active === 'volume' ? t('mc_sp_metric_volume')
    : exProg.active === 'e1rm' ? t('mc_sp_metric_e1rm')
    : `${t('mc_sp_metric_weight')}${exProg.wm === 'per_side' ? ` ${t('mc_sp_u_side')}`
      : exProg.wm === 'per_dumbbell' ? ` ${t('mc_sp_u_db')}`
      : exProg.wm === 'bodyweight' ? ` ${t('mc_sp_u_load')}` : ''}`;

  const metricLabel = (m: Metric): string =>
    m === 'weight' ? t('mc_sp_m_weight') : m === 'reps' ? t('mc_sp_m_reps')
      : m === 'volume' ? t('mc_sp_m_volume') : t('mc_sp_m_e1rm');

  /** Tarjeta del gráfico: la sesión entera, no solo el número del eje. */
  const ExTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: ExPoint }[] }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    const isTimed = exProg.tm === 'time' || exProg.tm === 'distance';
    return (
      <div style={{ background: '#0d0d0d', border: '1px solid var(--s-3)', borderRadius: 12, padding: '10px 12px', minWidth: 160, maxWidth: 230 }}>
        <p style={{ fontSize: 11, color: 'var(--t-3)', margin: 0 }}>{d.date}</p>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, lineHeight: 1.1, color: 'var(--t-1)', margin: '2px 0 6px' }}>
          {d.v}<span style={{ fontSize: 12, color: 'var(--t-3)', marginLeft: 3 }}>{unitShort}</span>
        </p>
        <p style={{ fontSize: 11, color: 'var(--t-2)', margin: 0 }}>
          {t('mc_sp_tt_sets', { n: d.sets })}
          {!isTimed && ` · ${t('mc_sp_tt_bestreps', { n: d.bestReps })}`}
        </p>
        {!isTimed && d.bestWeight > 0 && (
          <>
            <p style={{ fontSize: 11, color: 'var(--t-2)', margin: '2px 0 0' }}>
              {t('mc_sp_tt_bestset')}: <strong style={{ color: 'var(--t-1)' }}>{d.bestWeight} kg</strong>
            </p>
            <p style={{ fontSize: 11, color: 'var(--t-2)', margin: '2px 0 0' }}>
              {t('mc_sp_m_volume')}: <strong style={{ color: 'var(--t-1)' }}>{d.volume} kg</strong>
            </p>
            {d.e1rm > 0 && (
              <p style={{ fontSize: 11, color: 'var(--t-2)', margin: '2px 0 0' }}>
                {t('mc_sp_m_e1rm')}: <strong style={{ color: 'var(--t-1)' }}>{d.e1rm} kg</strong>
              </p>
            )}
          </>
        )}
        {d.note && (
          <p style={{ fontSize: 11, color: 'var(--t-2)', margin: '6px 0 0', fontStyle: 'italic', lineHeight: 1.4 }}>“{d.note}”</p>
        )}
      </div>
    );
  };

  const yDomain = useMemo<[number, number]>(() => {
    const vals = exProg.series.map((d) => d.v);
    if (!vals.length) return [0, 1];
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = Math.max(1, Math.round((hi - lo || hi) * 0.15));
    return [Math.max(0, lo - pad), hi + pad];
  }, [exProg.series]);

  const agoLabel = (iso: string): string => {
    const days = Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000);
    if (days <= 0) return t('mc_str_today');
    if (days === 1) return t('mc_str_yesterday');
    if (days < 7) return t('mc_str_days_ago', { n: days });
    return fmtShort(iso, locale);
  };

  // ── Vista por grupo: series por semana en las últimas WEEKS_BACK ──
  const groupsWithData = useMemo(() => {
    const set = new Set<GroupKey>();
    rows.forEach((r) => set.add(groupOf(r)));
    return MUSCLE_GROUPS.filter((g) => set.has(g));
  }, [rows]);

  useEffect(() => {
    if (groupsWithData.length && !groupsWithData.includes(selectedGroup as MuscleGroup)) {
      setSelectedGroup(groupsWithData[0]);
    }
  }, [groupsWithData, selectedGroup]);

  const groupWeekly = useMemo(() => {
    const weeks = Array.from({ length: WEEKS_BACK }, (_, i) => {
      const start = startOfWeekISO(-(WEEKS_BACK - 1 - i));
      return { start, label: fmtShort(start, locale), sets: 0 };
    });
    const firstStart = weeks[0].start;
    rows.forEach((r) => {
      if (groupOf(r) !== selectedGroup || r.session_date < firstStart) return;
      for (let w = weeks.length - 1; w >= 0; w--) {
        if (r.session_date >= weeks[w].start) { weeks[w].sets++; break; }
      }
    });
    const half = Math.floor(weeks.length / 2);
    const older = weeks.slice(0, half).reduce((a, w) => a + w.sets, 0);
    const recent = weeks.slice(weeks.length - half).reduce((a, w) => a + w.sets, 0);
    const trend: 'up' | 'flat' | 'down' =
      recent > older * 1.15 ? 'up' : recent < older * 0.85 ? 'down' : 'flat';
    return { weeks, trend, total: weeks.reduce((a, w) => a + w.sets, 0) };
  }, [rows, selectedGroup, locale]);

  if (loading) return <StateBlock variant="loading" />;
  if (unavailable) {
    return <StateBlock variant="empty" icon="ri-line-chart-line"
      title={t('mc_coming_soon_title')} description={t('mc_coming_soon_desc')} />;
  }
  if (loadError) {
    return <StateBlock variant="error" action={{ label: t('mc_state_retry'), onClick: () => setReloadKey((k) => k + 1) }} />;
  }
  if (rows.length === 0) {
    return <StateBlock variant="empty" icon="ri-line-chart-line" title={t('mc_sp_no_ex')} />;
  }

  const tooltipStyle = { background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontSize: 12 };

  return (
    <div className="rk-blocks max-w-3xl">
      {/* Toggle de vista */}
      <div className="flex gap-1.5">
        <button onClick={() => setView('exercise')}
          className={`rk-nav-btn text-xs font-bold ${view === 'exercise' ? 'is-active' : ''}`} style={{ padding: '0.5rem 1rem' }}>
          {t('mc_sp_view_ex')}
        </button>
        <button onClick={() => setView('group')}
          className={`rk-nav-btn text-xs font-bold ${view === 'group' ? 'is-active' : ''}`} style={{ padding: '0.5rem 1rem' }}>
          {t('mc_sp_view_group')}
        </button>
      </div>

      {/* ═══════ POR EJERCICIO ═══════ */}
      {view === 'exercise' && (
        <div className="card-primary" style={{ padding: 22 }}>
          {exercises.length > 8 && (
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('mc_sp_search_ph')}
              aria-label={t('mc_sp_search_ph')} style={{ minHeight: 44 }}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 mb-3 focus:outline-none focus:border-[#E10600]" />
          )}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 rk-noscroll-x">
            {filteredEx.map((e) => (
              <button key={e.key} onClick={() => setSelectedEx(e.key)}
                className={`rk-nav-btn text-xs font-bold whitespace-nowrap ${selectedEx === e.key ? 'is-active' : ''}`}
                style={{ padding: '0.4rem 0.9rem' }}>
                {e.label}
              </button>
            ))}
            {filteredEx.length === 0 && <p className="text-xs text-zinc-500 py-2">{t('mc_sp_no_match')}</p>}
          </div>

          {/* Periodo + métrica */}
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div className="flex gap-1" role="group" aria-label={t('mc_sp_period_label')}>
              {PERIODS.map((p) => (
                <button key={p.key} onClick={() => setPeriod(p.key)} aria-pressed={period === p.key}
                  style={{ minHeight: 32 }}
                  className={`text-xs font-bold px-2.5 rounded-lg transition-colors cursor-pointer ${period === p.key ? 'bg-[#E10600] text-white' : 'bg-white/[0.04] text-zinc-400 hover:text-white'}`}>
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
            {exProg.metrics.length > 1 && (
              <div className="flex gap-1 flex-wrap" role="group" aria-label={t('mc_sp_metric_label')}>
                {exProg.metrics.map((m) => (
                  <button key={m} onClick={() => setMetric(m)} aria-pressed={exProg.active === m}
                    style={{ minHeight: 32 }}
                    className={`text-xs font-bold px-2.5 rounded-lg transition-colors cursor-pointer ${exProg.active === m ? 'bg-white/[0.14] text-white' : 'bg-white/[0.04] text-zinc-400 hover:text-white'}`}>
                    {metricLabel(m)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {exProg.series.length < 2 ? (
            <p className="text-xs text-zinc-500 py-8 text-center leading-relaxed">
              {exProg.totalSessions >= 2 ? t('mc_sp_need_2_period') : t('mc_sp_need_2')}
            </p>
          ) : (
            <>
              <p className="text-[11px] text-zinc-500 mb-2">{metricCaption}</p>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={exProg.series} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} minTickGap={20} />
                    <YAxis domain={yDomain} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={38} />
                    <Tooltip content={<ExTooltip />} cursor={{ stroke: RED, strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Line type="monotone" dataKey="v" stroke={RED} strokeWidth={2.5}
                      dot={{ r: 3, fill: RED }}
                      activeDot={{ r: 6, fill: RED, stroke: 'rgba(225,6,0,0.35)', strokeWidth: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 3 datos rápidos */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[
                  {
                    v: exProg.gain === null ? '—' : `${exProg.gain > 0 ? '+' : ''}${exProg.gain} ${unitShort}`,
                    l: t('mc_sp_stat_gain'),
                    sub: exProg.firstISO ? t('mc_sp_stat_gain_since', { date: fmtShort(exProg.firstISO, locale) }) : '',
                    up: exProg.gain !== null && exProg.gain > 0,
                  },
                  { v: exProg.lastISO ? fmtShort(exProg.lastISO, locale) : '—', l: t('mc_sp_stat_last'), sub: exProg.lastISO ? agoLabel(exProg.lastISO) : '' },
                  { v: String(exProg.times), l: t('mc_sp_stat_times'), sub: '' },
                ].map((s) => (
                  <div key={s.l} className="text-center" style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)', borderRadius: 'var(--r-cta)', padding: '12px 6px' }}>
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(18px,4vw,22px)', lineHeight: 1, color: s.up ? RED : 'var(--t-1)', margin: 0 }}>{s.v}</p>
                    <p className="rk-label" style={{ fontSize: 9, marginTop: 5 }}>{s.l}</p>
                    {s.sub && <p className="text-[9px] text-zinc-600 mt-0.5 leading-tight">{s.sub}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════ POR GRUPO MUSCULAR ═══════ */}
      {view === 'group' && (
        <div className="card-primary" style={{ padding: 22 }}>
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 rk-noscroll-x">
            {groupsWithData.map((g) => (
              <button key={g} onClick={() => setSelectedGroup(g)}
                className={`rk-nav-btn text-xs font-bold whitespace-nowrap ${selectedGroup === g ? 'is-active' : ''}`}
                style={{ padding: '0.4rem 0.9rem' }}>
                {t(`mc_str_mg_${g}`)}
              </button>
            ))}
          </div>

          {groupWeekly.total === 0 ? (
            <p className="text-xs text-zinc-500 py-8 text-center">{t('mc_sp_group_none')}</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] text-zinc-500">{t('mc_sp_group_weekly')} · {t('mc_sp_group_sub', { n: WEEKS_BACK })}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  groupWeekly.trend === 'up' ? 'text-green-400 bg-green-500/10 border-green-500/25'
                  : groupWeekly.trend === 'down' ? 'text-orange-400 bg-orange-500/10 border-orange-500/25'
                  : 'text-zinc-400 bg-white/[0.04] border-white/10'}`}>
                  {groupWeekly.trend === 'up' ? `▲ ${t('mc_sp_trend_up')}` : groupWeekly.trend === 'down' ? `▼ ${t('mc_sp_trend_down')}` : `▬ ${t('mc_sp_trend_flat')}`}
                </span>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupWeekly.weeks} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} interval="preserveStartEnd" minTickGap={8} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={28} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      formatter={(v: number) => [`${v} ${t('mc_sp_sets')}`, '']} />
                    <Bar dataKey="sets" radius={[5, 5, 0, 0]} maxBarSize={34}>
                      {groupWeekly.weeks.map((w, i) => (
                        <Cell key={w.start} fill={i === groupWeekly.weeks.length - 1 ? RED : 'rgba(225,6,0,0.35)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_sp_note')}
      </p>

      <style>{`
        .rk-noscroll-x::-webkit-scrollbar { display: none; }
        .rk-noscroll-x { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
