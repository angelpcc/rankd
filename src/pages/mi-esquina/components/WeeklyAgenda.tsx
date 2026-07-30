import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable, isMissingColumn } from '@/lib/dbState';
import { parseTrainingFromSpeech } from '@/lib/dictation';
import VoiceButton from '@/components/feature/VoiceButton';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** 'hobby' oculta pesaje y combate. */
  mode?: 'pro' | 'hobby';
}

interface PlannedEvent {
  id: string;
  event_date: string;
  kind: 'training' | 'weigh_in' | 'fight' | 'rest' | 'other';
  session_type: string | null;
  title: string;
  time: string | null;
  notes: string | null;
  done: boolean;
  source?: string | null; // 'ai' = lo propuso el coach; si no, añadido a mano
}

interface TrainingSession {
  id: string;
  session_date: string;
  session_type: string;
  duration_min: number | null;
  intensity: number | null;
  feeling: number | null;
  part_of_day: string | null;
  notes: string | null;
  created_at?: string;
}

const KIND_CFG: Record<PlannedEvent['kind'], { key: string; icon: string; color: string }> = {
  training: { key: 'mc_cal_kind_training', icon: 'ri-boxing-line', color: '#E10600' },
  weigh_in: { key: 'mc_cal_kind_weigh', icon: 'ri-scales-2-line', color: '#C9A84C' },
  fight: { key: 'mc_cal_kind_fight', icon: 'ri-sword-line', color: '#ff2d2d' },
  rest: { key: 'mc_cal_kind_rest', icon: 'ri-heart-pulse-line', color: '#22c55e' },
  other: { key: 'mc_cal_kind_other', icon: 'ri-calendar-event-line', color: '#38bdf8' },
};

const KINDS_BY_MODE: Record<'pro' | 'hobby', PlannedEvent['kind'][]> = {
  pro: ['training', 'weigh_in', 'fight', 'rest', 'other'],
  hobby: ['training', 'rest', 'other'],
};

// Valores idénticos a los del diario para que las estadísticas cuadren.
const SESSION_TYPES = [
  { value: 'sparring', key: 'mc_st_sparring', icon: 'ri-boxing-line', hex: '#E10600' },
  { value: 'tecnica', key: 'mc_st_tecnica', icon: 'ri-focus-3-line', hex: '#38bdf8' },
  { value: 'fuerza', key: 'mc_st_fuerza', icon: 'ri-hammer-line', hex: '#fb923c' },
  { value: 'cardio', key: 'mc_st_cardio', icon: 'ri-run-line', hex: '#4ade80' },
  { value: 'flexibilidad', key: 'mc_st_flexibilidad', icon: 'ri-yoga-line', hex: '#a78bfa' },
  { value: 'recuperacion', key: 'mc_st_recuperacion', icon: 'ri-heart-pulse-line', hex: '#facc15' },
];
const sessionCfg = (v: string) => SESSION_TYPES.find((s) => s.value === v) || SESSION_TYPES[0];

const FEELINGS = [
  { n: 1, key: 'mc_ag_feel_1', icon: 'ri-emotion-unhappy-line', hex: '#ef4444' },
  { n: 2, key: 'mc_ag_feel_2', icon: 'ri-emotion-sad-line', hex: '#fb923c' },
  { n: 3, key: 'mc_ag_feel_3', icon: 'ri-emotion-normal-line', hex: '#facc15' },
  { n: 4, key: 'mc_ag_feel_4', icon: 'ri-emotion-happy-line', hex: '#4ade80' },
  { n: 5, key: 'mc_ag_feel_5', icon: 'ri-emotion-laugh-line', hex: '#22c55e' },
];
const feelingCfg = (n: number) => FEELINGS.find((f) => f.n === n);

const PARTS = [
  { value: 'morning', key: 'mc_ag_part_morning', icon: 'ri-sun-line' },
  { value: 'afternoon', key: 'mc_ag_part_afternoon', icon: 'ri-sun-foggy-line' },
  { value: 'evening', key: 'mc_ag_part_evening', icon: 'ri-moon-line' },
];
const partCfg = (v: string | null) => PARTS.find((p) => p.value === v);

const INT_LABELS = ['mc_ag_int_1', 'mc_ag_int_2', 'mc_ag_int_3', 'mc_ag_int_4', 'mc_ag_int_5'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayISO = () => iso(new Date());
function mondayOf(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export default function WeeklyAgenda({ profile, showToast, mode = 'pro' }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const availableKinds = KINDS_BY_MODE[mode];

  const [view, setView] = useState<'week' | 'month' | 'day'>('week');
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [selected, setSelected] = useState<string | null>(null);
  const [prevView, setPrevView] = useState<'week' | 'month'>('week');

  const [planned, setPlanned] = useState<PlannedEvent[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  // Si las columnas feeling/part_of_day no existen (migración 0019 sin aplicar).
  const [extraCols, setExtraCols] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [planRes, sessRes] = await Promise.all([
      supabase.from('planned_events').select('*').eq('fighter_profile_id', profile.id).order('event_date', { ascending: true }),
      supabase.from('training_sessions').select('*').eq('fighter_profile_id', profile.id).order('session_date', { ascending: false }).limit(400),
    ]);
    if (isMissingTable(planRes.error)) { setUnavailable(true); setLoading(false); return; }
    setPlanned((planRes.data || []) as PlannedEvent[]);
    setSessions((sessRes.data || []) as TrainingSession[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const plannedByDate = useMemo(() => {
    const m = new Map<string, PlannedEvent[]>();
    planned.forEach((e) => { const l = m.get(e.event_date) || []; l.push(e); m.set(e.event_date, l); });
    return m;
  }, [planned]);

  const sessionsByDate = useMemo(() => {
    const m = new Map<string, TrainingSession[]>();
    sessions.forEach((s) => { const l = m.get(s.session_date) || []; l.push(s); m.set(s.session_date, l); });
    return m;
  }, [sessions]);

  const MONTHS = useMemo(() => Array.from({ length: 12 }, (_, m) => new Date(2024, m, 1).toLocaleDateString(locale, { month: 'long' })), [locale]);
  const WEEKDAYS = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' })), [locale]);
  const WEEKDAYS_N = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }).toUpperCase()), [locale]);

  const openDay = (date: string) => { setPrevView(view === 'day' ? prevView : (view as 'week' | 'month')); setSelected(date); setView('day'); };
  const closeDay = () => { setSelected(null); setView(prevView); };

  // ── Escrituras ──
  const insertPlan = async (payload: Omit<PlannedEvent, 'id' | 'done'>) => {
    const { data, error } = await supabase.from('planned_events').insert({ fighter_profile_id: profile.id, ...payload }).select().maybeSingle();
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setPlanned((p) => [...p, data as PlannedEvent].sort((a, b) => a.event_date.localeCompare(b.event_date)));
    showToast(t('mc_ag_plan_saved'));
  };

  const insertSession = async (payload: Omit<TrainingSession, 'id'>) => {
    let res = await supabase.from('training_sessions').insert({ fighter_profile_id: profile.id, ...payload }).select().maybeSingle();
    if (res.error && isMissingColumn(res.error)) {
      // La migración 0019 no está aplicada: reintenta sin los campos nuevos.
      setExtraCols(false);
      const { feeling: _f, part_of_day: _p, ...base } = payload;
      void _f; void _p;
      res = await supabase.from('training_sessions').insert({ fighter_profile_id: profile.id, ...base }).select().maybeSingle();
    }
    if (res.error || !res.data) { showToast(t('error_save'), 'error'); return; }
    setSessions((s) => [res.data as TrainingSession, ...s]);
    showToast(t('mc_ag_session_saved'));
  };

  const toggleDone = async (e: PlannedEvent) => {
    const next = !e.done;
    setPlanned((p) => p.map((x) => x.id === e.id ? { ...x, done: next } : x));
    const { error } = await supabase.from('planned_events').update({ done: next }).eq('id', e.id);
    if (error) { setPlanned((p) => p.map((x) => x.id === e.id ? { ...x, done: !next } : x)); showToast(t('error_save'), 'error'); }
  };

  const removePlan = async (id: string) => {
    setPlanned((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from('planned_events').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); } else showToast(t('mc_ag_deleted'));
  };

  const removeSession = async (id: string) => {
    setSessions((s) => s.filter((x) => x.id !== id));
    const { error } = await supabase.from('training_sessions').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); } else showToast(t('mc_ag_deleted'));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-calendar-todo-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  // ══════════ VISTA DE DÍA ══════════
  if (view === 'day' && selected) {
    return (
      <DayDetail
        date={selected}
        locale={locale}
        mode={mode}
        availableKinds={availableKinds}
        planned={plannedByDate.get(selected) || []}
        sessions={sessionsByDate.get(selected) || []}
        extraCols={extraCols}
        onBack={closeDay}
        onToggleDone={toggleDone}
        onRemovePlan={removePlan}
        onRemoveSession={removeSession}
        onAddPlan={insertPlan}
        onAddSession={insertSession}
      />
    );
  }

  // ══════════ CABECERA (semana / mes) ══════════
  const header = (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <p className="rk-eyebrow">{t('mc_ag_eyebrow')}</p>
        <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
          {t('mc_ag_title')} <span className="rk-red-glow">{t('mc_ag_title_2')}</span>
        </h2>
        <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_ag_sub')}</p>
      </div>
      <div className="flex bg-white/[0.04] border border-white/10 rounded-xl p-1">
        {(['week', 'month'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${view === v ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
            {v === 'week' ? t('mc_ag_view_week') : t('mc_ag_view_month')}
          </button>
        ))}
      </div>
    </div>
  );

  // ══════════ VISTA DE SEMANA ══════════
  if (view === 'week') {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekEnd = addDays(weekStart, 6);
    const rangeLabel = `${weekStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;
    const isCurrentWeek = iso(weekStart) === iso(mondayOf(new Date()));
    return (
      <div className="space-y-6 max-w-5xl">
        {header}
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <i className="ri-arrow-left-s-line text-xl"></i>
          </button>
          <div className="text-center flex items-center gap-3">
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1.5, color: '#fff' }}>{rangeLabel}</h3>
            {!isCurrentWeek && (
              <button onClick={() => setWeekStart(mondayOf(new Date()))} className="text-[11px] font-bold uppercase tracking-wider text-red-400 bg-red-600/10 border border-red-500/30 px-2.5 py-1 rounded-full cursor-pointer hover:bg-red-600/20 transition-colors">{t('mc_today')}</button>
            )}
          </div>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <i className="ri-arrow-right-s-line text-xl"></i>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {days.map((d) => {
            const dISO = iso(d);
            const items = plannedByDate.get(dISO) || [];
            const sess = sessionsByDate.get(dISO) || [];
            const isToday = dISO === todayISO();
            const hasFight = items.some((e) => e.kind === 'fight');
            const hasWeigh = items.some((e) => e.kind === 'weigh_in');
            const pending = items.filter((e) => !e.done).length;
            return (
              <button key={dISO} onClick={() => openDay(dISO)}
                className={`group text-left rounded-2xl border p-3 min-h-[112px] flex flex-col transition-all cursor-pointer ${
                  isToday ? 'border-red-500/50 bg-red-600/[0.06]' : hasFight ? 'border-red-500/40' : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'
                }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-red-400' : 'text-zinc-500'}`}>
                    {d.toLocaleDateString(locale, { weekday: 'short' })}
                  </span>
                  <span className={`text-lg font-bold leading-none ${isToday ? 'text-red-400' : 'text-white'}`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{d.getDate()}</span>
                </div>

                <div className="mt-2 flex-1 space-y-1">
                  {items.slice(0, 3).map((e) => {
                    const cfg = KIND_CFG[e.kind];
                    return (
                      <div key={e.id} className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                        {e.source === 'ai' && <i className="ri-sparkling-fill text-[9px] flex-shrink-0" style={{ color: cfg.color }} title={t('mc_ai_from_ai')}></i>}
                        <span className={`text-[11px] truncate ${e.done ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>{e.title}</span>
                      </div>
                    );
                  })}
                  {items.length > 3 && <span className="text-[10px] text-zinc-600">+{items.length - 3}</span>}
                  {items.length === 0 && sess.length === 0 && <span className="text-[11px] text-zinc-700">{t('mc_wp_free_day')}</span>}
                </div>

                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {hasFight && <i className="ri-sword-line text-[12px]" style={{ color: '#ff2d2d' }} title={t('mc_cal_kind_fight')}></i>}
                  {hasWeigh && <i className="ri-scales-2-line text-[12px]" style={{ color: '#C9A84C' }} title={t('mc_cal_kind_weigh')}></i>}
                  {sess.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400">
                      <i className="ri-check-double-line"></i>{sess.length}
                    </span>
                  )}
                  {pending > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500">
                      <i className="ri-time-line"></i>{pending}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <WeekLegend t={t} mode={mode} />
      </div>
    );
  }

  // ══════════ VISTA DE MES ══════════
  const firstDay = new Date(monthCursor);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const goMonth = (delta: number) => { const d = new Date(monthCursor); d.setMonth(d.getMonth() + delta); setMonthCursor(d); };

  return (
    <div className="space-y-6 max-w-5xl">
      {header}
      <div className="flex items-center justify-between">
        <button onClick={() => goMonth(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer">
          <i className="ri-arrow-left-s-line text-xl"></i>
        </button>
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: '#fff' }}>
          {MONTHS[monthCursor.getMonth()]} <span className="text-zinc-500">{monthCursor.getFullYear()}</span>
        </h3>
        <button onClick={() => goMonth(1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer">
          <i className="ri-arrow-right-s-line text-xl"></i>
        </button>
      </div>
      <div className="rk-card" style={{ padding: '14px', transform: 'none' }}>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS_N.map((w, i) => <div key={i} className="text-center text-[11px] font-bold text-zinc-600 uppercase tracking-wider py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const items = plannedByDate.get(date) || [];
            const sess = sessionsByDate.get(date) || [];
            const isToday = date === todayISO();
            const dayNum = parseInt(date.slice(-2), 10);
            const hasFight = items.some((e) => e.kind === 'fight');
            const hasWeigh = items.some((e) => e.kind === 'weigh_in');
            return (
              <button key={date} onClick={() => openDay(date)}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-start p-1 transition-all cursor-pointer border ${
                  isToday ? 'border-red-500/40 bg-red-600/[0.05]' : 'border-transparent hover:border-white/15 hover:bg-white/[0.03]'
                } ${hasFight ? 'ring-1 ring-red-500/50' : ''}`}>
                <span className={`text-xs font-bold mt-0.5 ${isToday ? 'text-red-400' : hasFight ? 'text-red-300' : 'text-zinc-300'}`}>{dayNum}</span>
                <div className="flex flex-wrap items-center justify-center gap-0.5 mt-auto mb-0.5">
                  {hasFight && <i className="ri-sword-line text-[10px]" style={{ color: '#ff2d2d' }}></i>}
                  {hasWeigh && <i className="ri-scales-2-line text-[10px]" style={{ color: '#C9A84C' }}></i>}
                  {items.some((e) => e.kind === 'training' && !e.done) && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#E10600' }} />}
                  {sess.length > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />}
                </div>
              </button>
            );
          })}
        </div>
        <WeekLegend t={t} mode={mode} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function WeekLegend({ t, mode }: { t: (k: string) => string; mode: 'pro' | 'hobby' }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 mt-1 border-t border-white/[0.06] text-[11px] text-zinc-500">
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E10600]" />{t('mc_cal_legend_planned')}</span>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />{t('mc_cal_legend_done')}</span>
      {mode === 'pro' && (
        <>
          <span className="flex items-center gap-1.5"><i className="ri-scales-2-line text-[#C9A84C]" />{t('mc_cal_kind_weigh')}</span>
          <span className="flex items-center gap-1.5"><i className="ri-sword-line" style={{ color: '#ff2d2d' }} />{t('mc_cal_kind_fight')}</span>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
interface DayDetailProps {
  date: string;
  locale: string;
  mode: 'pro' | 'hobby';
  availableKinds: PlannedEvent['kind'][];
  planned: PlannedEvent[];
  sessions: TrainingSession[];
  extraCols: boolean;
  onBack: () => void;
  onToggleDone: (e: PlannedEvent) => void;
  onRemovePlan: (id: string) => void;
  onRemoveSession: (id: string) => void;
  onAddPlan: (p: Omit<PlannedEvent, 'id' | 'done'>) => Promise<void>;
  onAddSession: (s: Omit<TrainingSession, 'id'>) => Promise<void>;
}

function DayDetail({ date, locale, mode, availableKinds, planned, sessions, extraCols, onBack, onToggleDone, onRemovePlan, onRemoveSession, onAddPlan, onAddSession }: DayDetailProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'plan' | 'log' | null>(null);
  const isToday = date === todayISO();
  const isPast = date < todayISO();
  const dObj = new Date(date + 'T12:00:00');
  const relDays = Math.round((new Date(date + 'T12:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const rel = relDays === 0 ? t('mc_today') : relDays === 1 ? t('mc_cal_tomorrow') : relDays === -1 ? t('mc_yesterday') : relDays > 0 ? t('mc_cal_in_days', { n: relDays }) : '';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Cabecera del día */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer flex-shrink-0">
          <i className="ri-arrow-left-line text-lg"></i>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="rk-h2 capitalize" style={{ fontSize: 'clamp(1.4rem,3.5vw,2rem)', color: '#fff', margin: 0 }}>
              {dObj.toLocaleDateString(locale, { weekday: 'long', day: 'numeric' })}
            </h2>
            {isToday && <span className="text-[10px] font-black uppercase tracking-wider text-red-400 bg-red-600/15 border border-red-500/30 px-2 py-0.5 rounded-full">{t('mc_today')}</span>}
          </div>
          <p className="text-zinc-500 text-sm capitalize">{dObj.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}{rel ? ` · ${rel}` : ''}</p>
        </div>
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={() => setTab(tab === 'plan' ? null : 'plan')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${tab === 'plan' ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:border-white/25'}`}>
          <i className="ri-calendar-todo-line"></i>{t('mc_ag_add_plan')}
        </button>
        <button onClick={() => setTab(tab === 'log' ? null : 'log')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${tab === 'log' ? 'bg-green-600 border-green-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:border-white/25'}`}>
          <i className="ri-check-double-line"></i>{t('mc_ag_add_session')}
        </button>
      </div>

      {/* Formularios */}
      {tab === 'plan' && <PlanForm date={date} mode={mode} availableKinds={availableKinds} onSubmit={onAddPlan} onDone={() => setTab(null)} />}
      {tab === 'log' && <LogForm extraCols={extraCols} onSubmit={onAddSession} date={date} onDone={() => setTab(null)} />}

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* Planificado */}
        <div>
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-3 flex items-center gap-2">
            <i className="ri-calendar-todo-line text-red-400"></i>{t('mc_ag_planned')}
          </p>
          {planned.length === 0 ? (
            <div className="rk-card text-center text-zinc-600 text-sm" style={{ padding: '28px 16px' }}>{t('mc_ag_no_plan')}</div>
          ) : (
            <div className="space-y-2">
              {planned.map((e) => {
                const cfg = KIND_CFG[e.kind];
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl border p-2.5 group" style={{ borderColor: `${cfg.color}30`, background: `${cfg.color}0d` }}>
                    <button onClick={() => onToggleDone(e)} className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 cursor-pointer" style={{ borderColor: e.done ? '#22c55e' : cfg.color + '77', background: e.done ? '#22c55e' : 'transparent' }} title={t('mc_ag_mark_done')}>
                      {e.done && <i className="ri-check-line text-white text-xs"></i>}
                    </button>
                    <i className={cfg.icon} style={{ color: cfg.color }}></i>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-sm font-semibold ${e.done ? 'text-zinc-500 line-through' : 'text-white'}`}>{e.title}</p>
                        {e.source === 'ai' && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-red-300 bg-red-600/12 border border-red-500/30">
                            <i className="ri-sparkling-fill"></i>{t('mc_ai_from_ai')}
                          </span>
                        )}
                      </div>
                      {(e.time || e.notes) && <p className="text-[11px] text-zinc-500 truncate">{[e.time, e.notes].filter(Boolean).join(' · ')}</p>}
                    </div>
                    <button onClick={() => onRemovePlan(e.id)} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Registrado */}
        <div>
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-3 flex items-center gap-2">
            <i className="ri-check-double-line text-green-400"></i>{t('mc_ag_logged')}
          </p>
          {sessions.length === 0 ? (
            <div className="rk-card text-center text-zinc-600 text-sm" style={{ padding: '28px 16px' }}>
              {isPast || isToday ? t('mc_ag_no_session') : t('mc_ag_future_hint')}
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                const cfg = sessionCfg(s.session_type);
                const feel = s.feeling ? feelingCfg(s.feeling) : null;
                const part = partCfg(s.part_of_day);
                return (
                  <div key={s.id} className="rk-card group" style={{ padding: '12px 14px' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 flex items-center justify-center rounded-lg border flex-shrink-0" style={{ background: `${cfg.hex}1a`, borderColor: `${cfg.hex}40`, color: cfg.hex }}>
                        <i className={cfg.icon}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white">{t(cfg.key)}</p>
                          {s.duration_min ? <span className="text-[10px] text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded-full">{s.duration_min} min</span> : null}
                          {part && <span className="text-[10px] text-zinc-500 inline-flex items-center gap-1"><i className={part.icon}></i>{t(part.key)}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.intensity ? (
                            <span className="flex items-center gap-0.5">{Array.from({ length: s.intensity }).map((_, i) => <i key={i} className="ri-fire-fill text-red-400 text-[10px]"></i>)}</span>
                          ) : null}
                          {feel && <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: feel.hex }}><i className={feel.icon}></i>{t(feel.key)}</span>}
                        </div>
                      </div>
                      <button onClick={() => onRemoveSession(s.id)} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>
                    {s.notes && <p className="text-xs text-zinc-400 mt-2 pl-2.5 border-l-2 border-white/10 leading-relaxed">{s.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function PlanForm({ date, mode, availableKinds, onSubmit, onDone }: {
  date: string; mode: 'pro' | 'hobby'; availableKinds: PlannedEvent['kind'][];
  onSubmit: (p: Omit<PlannedEvent, 'id' | 'done'>) => Promise<void>; onDone: () => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<PlannedEvent['kind']>('training');
  const [sessionType, setSessionType] = useState('tecnica');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('18:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  void mode;

  const submit = async () => {
    setSaving(true);
    const cfg = KIND_CFG[kind];
    const stKey = SESSION_TYPES.find((x) => x.value === sessionType)?.key;
    const finalTitle = title.trim() || (kind === 'training' && stKey ? t(stKey) : t(cfg.key));
    await onSubmit({
      event_date: date, kind,
      session_type: kind === 'training' ? sessionType : null,
      title: finalTitle,
      time: kind === 'training' && time ? time : null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    onDone();
  };

  return (
    <div className="rk-card space-y-3" style={{ padding: 18 }}>
      <p className="text-[11px] font-bold tracking-widest uppercase text-zinc-500">{t('mc_ag_plan_form_title')}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {availableKinds.map((k) => {
          const cfg = KIND_CFG[k];
          return (
            <button key={k} onClick={() => setKind(k)} className={`flex flex-col items-center gap-1 py-2 rounded-xl border transition-all cursor-pointer ${kind === k ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`} style={{ background: kind === k ? `${cfg.color}18` : 'rgba(255,255,255,0.02)' }}>
              <i className={cfg.icon} style={{ color: cfg.color, fontSize: 15 }}></i>
              <span className="text-[9px] font-semibold text-white leading-none text-center">{t(cfg.key)}</span>
            </button>
          );
        })}
      </div>
      {kind === 'training' && (
        <div className="grid grid-cols-2 gap-2">
          <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} className="bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer">
            {SESSION_TYPES.map((s) => <option key={s.value} value={s.value}>{t(s.key)}</option>)}
          </select>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer" />
        </div>
      )}
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500" placeholder={kind === 'fight' ? t('mc_cal_ph_fight') : kind === 'weigh_in' ? t('mc_cal_ph_weigh') : t('mc_cal_ph_other')} />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={280} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 resize-none" placeholder={t('mc_rt_notes_ph')} />
      <button onClick={submit} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem' }}>
        {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><i className="ri-add-line"></i> {t('mc_cal_add')}</>}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function LogForm({ date, extraCols, onSubmit, onDone }: {
  date: string; extraCols: boolean;
  onSubmit: (s: Omit<TrainingSession, 'id'>) => Promise<void>; onDone: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState('sparring');
  const [duration, setDuration] = useState('60');
  const [intensity, setIntensity] = useState(3);
  const [feeling, setFeeling] = useState(0);
  const [part, setPart] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [interpreted, setInterpreted] = useState(false);

  // Dictado: interpreta el lenguaje natural y PRE-RELLENA. No guarda: el
  // peleador revisa los campos y confirma con el botón de guardar.
  const applyDictation = (text: string) => {
    const p = parseTrainingFromSpeech(text);
    if (p.type) setType(p.type);
    if (p.durationMin) setDuration(String(p.durationMin));
    if (p.intensity) setIntensity(p.intensity);
    if (p.feeling) setFeeling(p.feeling);
    if (p.part) setPart(p.part);
    setNotes((prev) => (prev.trim() ? prev : p.notes));
    setInterpreted(true);
  };

  const submit = async () => {
    setSaving(true);
    await onSubmit({
      session_date: date,
      session_type: type,
      duration_min: duration ? parseInt(duration, 10) : null,
      intensity,
      feeling: feeling || null,
      part_of_day: part || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    onDone();
  };

  return (
    <div className="rk-card space-y-3.5" style={{ padding: 18 }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] font-bold tracking-widest uppercase text-zinc-500">{t('mc_ag_log_form_title')}</p>
        <VoiceButton onResult={applyDictation} />
      </div>
      {interpreted && (
        <p className="text-[11px] text-red-400 flex items-center gap-1.5"><i className="ri-sparkling-line"></i>{t('mc_vo_interpreted')}</p>
      )}
      <div>
        <label className="block text-xs text-zinc-400 mb-2">{t('mc_rt_type')}</label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SESSION_TYPES.map((s) => (
            <button key={s.value} onClick={() => setType(s.value)} className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-[11px] font-medium transition-all cursor-pointer ${type === s.value ? 'text-white' : 'bg-white/[0.03] border-white/10 text-zinc-500 hover:border-white/25'}`}
              style={type === s.value ? { background: `${s.hex}1f`, borderColor: `${s.hex}66`, color: s.hex } : undefined}>
              <i className={`${s.icon} text-base`}></i>{t(s.key)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_rt_duration')}</label>
          <input type="number" min="5" max="600" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="60" />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_ag_part')}</label>
          <div className="grid grid-cols-3 gap-1">
            {PARTS.map((p) => (
              <button key={p.value} onClick={() => setPart(part === p.value ? '' : p.value)} title={t(p.key)}
                className={`py-2.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${part === p.value ? 'bg-red-600/20 border-red-500/40 text-red-400' : 'bg-white/[0.03] border-white/10 text-zinc-500 hover:border-white/25'}`}>
                <i className={p.icon}></i>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs text-zinc-400 mb-2">{t('mc_rt_intensity')}</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setIntensity(n)} className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all cursor-pointer ${intensity >= n ? 'bg-red-600/20 border-red-500/40 text-red-400' : 'bg-white/[0.03] border-white/10 text-zinc-600 hover:border-white/25'}`}>
              <i className="ri-fire-fill"></i>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500 mt-1.5">{t(INT_LABELS[intensity - 1])}</p>
      </div>
      {extraCols && (
        <div>
          <label className="block text-xs text-zinc-400 mb-2">{t('mc_ag_feeling')}</label>
          <div className="flex gap-2">
            {FEELINGS.map((f) => (
              <button key={f.n} onClick={() => setFeeling(feeling === f.n ? 0 : f.n)} title={t(f.key)}
                className={`flex-1 py-2.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${feeling === f.n ? '' : 'bg-white/[0.03] border-white/10 text-zinc-600 hover:border-white/25'}`}
                style={feeling === f.n ? { background: `${f.hex}22`, borderColor: `${f.hex}66`, color: f.hex } : undefined}>
                <i className={`${f.icon} text-lg`}></i>
              </button>
            ))}
          </div>
          {feeling > 0 && <p className="text-[11px] mt-1.5" style={{ color: feelingCfg(feeling)?.hex }}>{t(FEELINGS[feeling - 1].key)}</p>}
        </div>
      )}
      <div>
        <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_rt_notes')}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={400} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none" placeholder={t('mc_rt_notes_ph')} />
      </div>
      <button onClick={submit} disabled={saving} className="rk-btn w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem', background: '#16a34a', color: '#fff' }}>
        {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><i className="ri-check-line"></i> {t('mc_ag_save_session')}</>}
      </button>
    </div>
  );
}
