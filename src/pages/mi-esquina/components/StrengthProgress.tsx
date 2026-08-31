import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import {
  MUSCLE_GROUPS, muscleGroupOf, weightModeOf, trackingModeOf,
  type MuscleGroup, type WeightMode, type TrackingMode,
} from '../lib/exercises';
import { startOfWeekISO } from '../lib/strength';
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
  weight_kg: number | string;
  muscle_group: string | null;
  weight_mode: string | null;
  tracking_mode: string | null;
}

type GroupKey = MuscleGroup | 'other';
const ORDER: GroupKey[] = [...MUSCLE_GROUPS, 'other'];
const WEEKS_BACK = 9;
const MAX_SESSIONS = 15;
const GOLD = '#C9A84C';
const RED = '#E10600';

function fmtShort(iso: string, locale: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export default function StrengthProgress({ profile }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [view, setView] = useState<'exercise' | 'group'>('exercise');
  const [selectedEx, setSelectedEx] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<GroupKey>('chest');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
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
      setRows((data || []) as Row[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id]);

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
  const exProg = useMemo(() => {
    const exRows = rows.filter((r) => r.exercise === selectedEx);
    const label = exRows[0]?.exercise_label || selectedEx;
    const wm: WeightMode = (exRows.find((r) => r.weight_mode)?.weight_mode as WeightMode) || weightModeOf(label);
    const tm: TrackingMode = (exRows.find((r) => r.tracking_mode)?.tracking_mode as TrackingMode) || trackingModeOf(label);
    // Peso corporal sin lastre en ninguna serie → la progresión útil son las reps.
    const anyLoad = wm === 'bodyweight' && exRows.some((r) => Number(r.weight_kg) > 0);
    const useReps = wm === 'bodyweight' && !anyLoad && tm === 'reps';

    const byDate = new Map<string, number>();
    exRows.forEach((r) => {
      const v = (tm === 'time' || tm === 'distance') ? r.reps : useReps ? r.reps : (Number(r.weight_kg) || 0);
      byDate.set(r.session_date, Math.max(byDate.get(r.session_date) ?? 0, v));
    });
    const dates = [...byDate.keys()].sort();
    const series = dates.slice(-MAX_SESSIONS).map((d) => ({ date: fmtShort(d, locale), v: byDate.get(d)! }));
    const gain = dates.length >= 2 ? +(byDate.get(dates[dates.length - 1])! - byDate.get(dates[0])!).toFixed(1) : null;
    return {
      wm, tm, useReps, series,
      gain,
      firstISO: dates[0],
      lastISO: dates[dates.length - 1],
      times: byDate.size,
    };
  }, [rows, selectedEx, locale]);

  const unitShort = exProg.useReps ? t('mc_sp_u_reps')
    : exProg.tm === 'time' ? t('mc_str_unit_sec')
    : exProg.tm === 'distance' ? t('mc_str_unit_m')
    : 'kg';
  const metricCaption = exProg.useReps ? t('mc_sp_metric_reps')
    : exProg.tm === 'time' ? t('mc_sp_metric_time')
    : exProg.tm === 'distance' ? t('mc_sp_metric_dist')
    : `${t('mc_sp_metric_weight')}${exProg.wm === 'per_side' ? ` ${t('mc_sp_u_side')}`
      : exProg.wm === 'per_dumbbell' ? ` ${t('mc_sp_u_db')}`
      : exProg.wm === 'bodyweight' ? ` ${t('mc_sp_u_load')}` : ''}`;

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

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25">
          <i className="ri-line-chart-line text-3xl text-red-400" />
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
          <i className="ri-line-chart-line text-3xl text-zinc-600" />
        </div>
        <p className="text-white font-bold">{t('mc_sp_no_ex')}</p>
      </div>
    );
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
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 mb-3 focus:outline-none focus:border-[#C9A84C]" />
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

          {exProg.series.length < 2 ? (
            <p className="text-xs text-zinc-500 py-8 text-center leading-relaxed">{t('mc_sp_need_2')}</p>
          ) : (
            <>
              <p className="text-[11px] text-zinc-500 mb-2">{metricCaption}</p>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={exProg.series} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} minTickGap={20} />
                    <YAxis domain={yDomain} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={38} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                      formatter={(v: number) => [`${v} ${unitShort}`, '']} />
                    <Line type="monotone" dataKey="v" stroke={GOLD} strokeWidth={2.5}
                      dot={{ r: 3, fill: GOLD }} activeDot={{ r: 5 }} />
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
                    gold: exProg.gain !== null && exProg.gain > 0,
                  },
                  { v: exProg.lastISO ? fmtShort(exProg.lastISO, locale) : '—', l: t('mc_sp_stat_last'), sub: exProg.lastISO ? agoLabel(exProg.lastISO) : '' },
                  { v: String(exProg.times), l: t('mc_sp_stat_times'), sub: '' },
                ].map((s) => (
                  <div key={s.l} className="text-center" style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)', borderRadius: 'var(--r-cta)', padding: '12px 6px' }}>
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(18px,4vw,22px)', lineHeight: 1, color: s.gold ? GOLD : 'var(--t-1)', margin: 0 }}>{s.v}</p>
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
