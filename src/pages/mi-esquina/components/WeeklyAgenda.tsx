import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import BottomSheet from '@/components/base/BottomSheet';
import StrengthPlanBuilder from './StrengthPlanBuilder';
import {
  type DayPlanItem, type DayPlanKind, type StrengthPayload, type ActivityPayload,
  type MealPayload, type SupplementPayload, type NotePayload, type MealSlot, type ExerciseSpec,
  KIND_ORDER, KIND_META, ACTIVITY_KINDS, MEAL_SLOTS, activityKindCfg, summarizeItem, exerciseLines,
  computePace, paceLabel, paceToSec, isoOf,
} from '../lib/dayPlan';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** 'hobby' oculta pesaje y combate en los marcadores. */
  mode?: 'pro' | 'hobby';
  /** Registrar lo que se hizo vive en Progreso › Actividad, no aquí. */
  onGoActivity: (date?: string) => void;
  /** Saltar a la pestaña Planificar (con una fecha opcional ya en mente). */
  onGoPlanificar?: (date?: string) => void;
}

interface CompEvent { id: string; event_date: string; kind: 'fight' | 'weigh_in'; title: string }
interface LoggedAct { id: string; session_date: string; kind: string; duration_min: number; rounds: number | null }
interface LoggedStr { session_date: string; muscle_group: string | null }

function iso(d: Date): string { return isoOf(d); }
const todayISO = () => iso(new Date());
function mondayOf(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

const TICK_KINDS: DayPlanKind[] = ['strength', 'activity'];

export default function WeeklyAgenda({ profile, showToast, mode = 'pro', onGoActivity, onGoPlanificar }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [dayISO, setDayISO] = useState<string>(todayISO());

  const [items, setItems] = useState<DayPlanItem[]>([]);
  const [comp, setComp] = useState<CompEvent[]>([]);
  const [loggedActs, setLoggedActs] = useState<LoggedAct[]>([]);
  const [loggedStr, setLoggedStr] = useState<LoggedStr[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [sheetFor, setSheetFor] = useState<{ date: string; kind?: DayPlanKind } | null>(null);
  // Fuerza usa su propio planificador en detalle (grupos → ejercicios → series).
  const [strengthSheet, setStrengthSheet] = useState<{ date: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [planRes, compRes, actRes, strRes] = await Promise.all([
      supabase.from('day_plan_items').select('*').eq('fighter_profile_id', profile.id).order('plan_date', { ascending: true }),
      supabase.from('planned_events').select('id, event_date, kind, title')
        .eq('fighter_profile_id', profile.id).in('kind', ['fight', 'weigh_in']),
      supabase.from('activity_sessions').select('id, session_date, kind, duration_min, rounds').eq('fighter_profile_id', profile.id),
      supabase.from('strength_sets').select('session_date, muscle_group').eq('fighter_profile_id', profile.id),
    ]);
    if (isMissingTable(planRes.error)) { setUnavailable(true); setLoading(false); return; }
    setItems((planRes.data || []) as DayPlanItem[]);
    if (!isMissingTable(compRes.error)) setComp((compRes.data || []) as CompEvent[]);
    if (!isMissingTable(actRes.error)) setLoggedActs((actRes.data || []) as LoggedAct[]);
    if (!isMissingTable(strRes.error)) setLoggedStr((strRes.data || []) as LoggedStr[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const itemsByDate = useMemo(() => {
    const m = new Map<string, DayPlanItem[]>();
    items.forEach((e) => { const l = m.get(e.plan_date) || []; l.push(e); m.set(e.plan_date, l); });
    for (const list of m.values()) list.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    return m;
  }, [items]);

  const compByDate = useMemo(() => {
    const m = new Map<string, CompEvent[]>();
    comp.forEach((e) => { const l = m.get(e.event_date) || []; l.push(e); m.set(e.event_date, l); });
    return m;
  }, [comp]);

  // Registrado por día: actividades + grupos de fuerza (para el bloque
  // "Registrado" de la vista Día — Tarea 4: la actividad aparece en la Agenda).
  const loggedByDate = useMemo(() => {
    const m = new Map<string, { acts: LoggedAct[]; strGroups: Set<string> }>();
    loggedActs.forEach((a) => {
      const e = m.get(a.session_date) || { acts: [], strGroups: new Set<string>() };
      e.acts.push(a); m.set(a.session_date, e);
    });
    loggedStr.forEach((s) => {
      const e = m.get(s.session_date) || { acts: [], strGroups: new Set<string>() };
      if (s.muscle_group) e.strGroups.add(s.muscle_group);
      m.set(s.session_date, e);
    });
    return m;
  }, [loggedActs, loggedStr]);

  const MONTHS = useMemo(() => Array.from({ length: 12 }, (_, m) => new Date(2024, m, 1).toLocaleDateString(locale, { month: 'long' })), [locale]);
  const WEEKDAYS_N = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }).toUpperCase()), [locale]);

  const openDay = (date: string) => { setDayISO(date); setView('day'); };

  // ── Escrituras ──
  const addItem = async (date: string, kind: DayPlanKind, payload: DayPlanItem['payload']) => {
    const { data, error } = await supabase.from('day_plan_items')
      .insert({ fighter_profile_id: profile.id, plan_date: date, kind, payload, source: 'manual' })
      .select().maybeSingle();
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setItems((p) => [...p, data as DayPlanItem]);
    showToast(t('mc_dp_added'));
  };

  const removeItem = async (id: string) => {
    setItems((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from('day_plan_items').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); } else showToast(t('mc_ag_item_removed'));
  };

  // Sheets de planificación, compartidos por las vistas Día y Semana.
  const planSheets = (
    <>
      <AddItemSheet
        open={!!sheetFor}
        initialKind={sheetFor?.kind}
        onClose={() => setSheetFor(null)}
        onSubmit={async (kind, payload) => { if (sheetFor) await addItem(sheetFor.date, kind, payload); setSheetFor(null); }}
      />
      <StrengthPlanBuilder
        open={!!strengthSheet}
        fighterProfileId={profile.id}
        onClose={() => setStrengthSheet(null)}
        onSave={async ({ groups, exercises }) => {
          if (strengthSheet) await addItem(strengthSheet.date, 'strength', { groups, exercises });
          setStrengthSheet(null);
        }}
      />
    </>
  );

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

  // ══════════ CABECERA con selector Día · Semana · Mes ══════════
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
        {(['day', 'week', 'month'] as const).map((v) => (
          <button key={v} onClick={() => { if (v === 'day') setDayISO((d) => d || todayISO()); setView(v); }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${view === v ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
            {v === 'day' ? t('mc_ag_view_day') : v === 'week' ? t('mc_ag_view_week') : t('mc_ag_view_month')}
          </button>
        ))}
      </div>
    </div>
  );

  // ══════════ VISTA DÍA ══════════
  if (view === 'day') {
    return (
      <>
        <div className="space-y-6 max-w-3xl">
          {header}
          <DayView
            date={dayISO}
            locale={locale}
            items={itemsByDate.get(dayISO) || []}
            comp={compByDate.get(dayISO) || []}
            logged={loggedByDate.get(dayISO) || { acts: [], strGroups: new Set() }}
            mode={mode}
            onPrev={() => setDayISO(iso(addDays(new Date(dayISO + 'T12:00:00'), -1)))}
            onNext={() => setDayISO(iso(addDays(new Date(dayISO + 'T12:00:00'), 1)))}
            onAdd={(kind) => (kind === 'strength' ? setStrengthSheet({ date: dayISO }) : setSheetFor({ date: dayISO, kind }))}
            onRemove={removeItem}
            onPlanThisDay={() => setStrengthSheet({ date: dayISO })}
            onPlanWeek={onGoPlanificar ? () => onGoPlanificar(dayISO) : undefined}
            onGoActivity={() => onGoActivity(dayISO)}
          />
        </div>
        {planSheets}
      </>
    );
  }

  // ══════════ VISTA SEMANA ══════════
  if (view === 'week') {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekEnd = addDays(weekStart, 6);
    const rangeLabel = `${weekStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;
    const isCurrentWeek = iso(weekStart) === iso(mondayOf(new Date()));
    return (
      <>
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
              const list = itemsByDate.get(dISO) || [];
              const evs = compByDate.get(dISO) || [];
              const isToday = dISO === todayISO();
              const preview = list.slice(0, 2);
              const doneCount = list.filter((x) => TICK_KINDS.includes(x.kind) && x.completed).length;
              const hasFight = evs.some((e) => e.kind === 'fight');
              const hasWeigh = evs.some((e) => e.kind === 'weigh_in');
              return (
                <button key={dISO} onClick={() => openDay(dISO)}
                  className={`group text-left rounded-2xl border p-3 min-h-[116px] flex flex-col transition-all cursor-pointer ${
                    isToday ? 'border-red-500/50 bg-red-600/[0.06]' : hasFight ? 'border-red-500/40' : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-red-400' : 'text-zinc-500'}`}>
                      {d.toLocaleDateString(locale, { weekday: 'short' })}
                    </span>
                    <span className={`text-lg font-bold leading-none ${isToday ? 'text-red-400' : 'text-white'}`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{d.getDate()}</span>
                  </div>

                  <div className="mt-2 flex-1 space-y-1">
                    {preview.map((e) => (
                      <div key={e.id} className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: KIND_META[e.kind].hex }} />
                        <span className={`text-[11px] truncate ${e.completed && TICK_KINDS.includes(e.kind) ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>
                          {summarizeItem(e, t)}
                        </span>
                      </div>
                    ))}
                    {list.length > 2 && <span className="text-[10px] text-zinc-600">{t('mc_ag_more_count', { n: list.length - 2 })}</span>}
                    {list.length === 0 && evs.length === 0 && <span className="text-[11px] text-zinc-700">{t('mc_wp_free_day')}</span>}
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {mode === 'pro' && hasFight && <i className="ri-sword-line text-[12px]" style={{ color: '#ff2d2d' }} title={t('mc_cal_kind_fight')}></i>}
                    {mode === 'pro' && hasWeigh && <i className="ri-scales-2-line text-[12px]" style={{ color: '#C9A84C' }} title={t('mc_cal_kind_weigh')}></i>}
                    {doneCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400">
                        <i className="ri-check-double-line"></i>{doneCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <WeekLegend t={t} mode={mode} />
        </div>
        {planSheets}
      </>
    );
  }

  // ══════════ VISTA MES ══════════
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
            const list = itemsByDate.get(date) || [];
            const evs = compByDate.get(date) || [];
            const isToday = date === todayISO();
            const dayNum = parseInt(date.slice(-2), 10);
            const tickables = list.filter((x) => TICK_KINDS.includes(x.kind));
            const allDone = tickables.length > 0 && tickables.every((x) => x.completed);
            const hasFight = evs.some((e) => e.kind === 'fight');
            const hasWeigh = evs.some((e) => e.kind === 'weigh_in');
            return (
              <button key={date} onClick={() => openDay(date)}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-start p-1 transition-all cursor-pointer border ${
                  isToday ? 'border-red-500/40 bg-red-600/[0.05]' : 'border-transparent hover:border-white/15 hover:bg-white/[0.03]'
                } ${hasFight ? 'ring-1 ring-red-500/50' : ''}`}>
                <span className={`text-xs font-bold mt-0.5 ${isToday ? 'text-red-400' : hasFight ? 'text-red-300' : 'text-zinc-300'}`}>{dayNum}</span>
                <div className="flex flex-wrap items-center justify-center gap-0.5 mt-auto mb-0.5">
                  {mode === 'pro' && hasFight && <i className="ri-sword-line text-[10px]" style={{ color: '#ff2d2d' }}></i>}
                  {mode === 'pro' && hasWeigh && <i className="ri-scales-2-line text-[10px]" style={{ color: '#C9A84C' }}></i>}
                  {allDone
                    ? <i className="ri-check-line text-[11px] text-green-500"></i>
                    : list.length > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#E10600' }} />}
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
      <span className="flex items-center gap-1.5"><i className="ri-check-line text-green-500" />{t('mc_cal_legend_done')}</span>
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
interface DayViewProps {
  date: string;
  locale: string;
  items: DayPlanItem[];
  comp: CompEvent[];
  logged: { acts: LoggedAct[]; strGroups: Set<string> };
  mode: 'pro' | 'hobby';
  onPrev: () => void;
  onNext: () => void;
  onAdd: (kind: DayPlanKind) => void;
  onRemove: (id: string) => void;
  onPlanThisDay: () => void;
  onPlanWeek?: () => void;
  onGoActivity: () => void;
}

function DayView({ date, locale, items, comp, logged, mode, onPrev, onNext, onAdd, onRemove, onPlanThisDay, onPlanWeek, onGoActivity }: DayViewProps) {
  const { t } = useTranslation();
  const dObj = new Date(date + 'T12:00:00');
  const isToday = date === todayISO();
  const relDays = Math.round((dObj.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const rel = relDays === 0 ? t('mc_today') : relDays === 1 ? t('mc_cal_tomorrow') : relDays === -1 ? t('mc_yesterday')
    : relDays > 0 ? t('mc_cal_in_days', { n: relDays }) : '';

  const byKind = (k: DayPlanKind) => items.filter((i) => i.kind === k);
  const empty = items.length === 0;

  return (
    <div className="space-y-5">
      {/* Cabecera del día con navegación */}
      <div className="flex items-center gap-3">
        <button onClick={onPrev} aria-label={t('mc_ag_prev_day')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer flex-shrink-0">
          <i className="ri-arrow-left-s-line text-xl"></i>
        </button>
        <div className="flex-1 min-w-0 text-center">
          <h3 className="uppercase" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.5rem,4.5vw,2.1rem)', letterSpacing: 1, color: '#fff', lineHeight: 1 }}>
            {dObj.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <p className="text-zinc-500 text-xs mt-1">
            {isToday && <span className="text-red-400 font-bold">{t('mc_today')}</span>}
            {isToday && rel && ' · '}{!isToday && rel}
          </p>
        </div>
        <button onClick={onNext} aria-label={t('mc_ag_next_day')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer flex-shrink-0">
          <i className="ri-arrow-right-s-line text-xl"></i>
        </button>
      </div>

      {/* Marcadores de competición (pro) */}
      {mode === 'pro' && comp.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {comp.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border"
              style={e.kind === 'fight'
                ? { color: '#ff2d2d', borderColor: 'rgba(255,45,45,0.4)', background: 'rgba(255,45,45,0.08)' }
                : { color: '#C9A84C', borderColor: 'rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.08)' }}>
              <i className={e.kind === 'fight' ? 'ri-sword-line' : 'ri-scales-2-line'}></i>{e.title}
            </span>
          ))}
        </div>
      )}

      {empty ? (
        <div className="rk-card text-center" style={{ padding: '44px 24px' }}>
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-calendar-line text-2xl text-zinc-600"></i>
          </div>
          <p className="text-white font-bold">{t('mc_ag_day_empty_title')}</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-xs mx-auto leading-relaxed">{t('mc_ag_day_empty_desc')}</p>
          <button onClick={onPlanThisDay} className="rk-btn rk-btn-primary mt-5" style={{ fontSize: '0.85rem', padding: '0.7rem 1.5rem' }}>
            <i className="ri-add-line mr-1"></i> {t('mc_ag_day_plan_this')}
          </button>
          {onPlanWeek && (
            <button onClick={onPlanWeek} className="block mx-auto mt-3 text-xs text-zinc-500 hover:text-white transition-colors cursor-pointer">
              {t('mc_pl_btn')} →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {KIND_ORDER.map((k) => {
            const list = byKind(k);
            if (list.length === 0) return null;
            const meta = KIND_META[k];
            return (
              <div key={k} className="rk-card" style={{ padding: '16px 18px' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold tracking-[0.18em] uppercase flex items-center gap-2" style={{ color: meta.hex }}>
                    <i className={meta.icon}></i>{t(meta.labelKey)}
                  </p>
                  <button onClick={() => onAdd(k)} aria-label={t('mc_ag_add_item')}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer">
                    <i className="ri-add-line"></i>
                  </button>
                </div>
                <div className="space-y-2">
                  {list.map((it) => (
                    <DayItemRow key={it.id} item={it} onRemove={() => onRemove(it.id)} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Añadir un bloque que aún no existe */}
          <div className="flex flex-wrap gap-2">
            {KIND_ORDER.filter((k) => byKind(k).length === 0).map((k) => (
              <button key={k} onClick={() => onAdd(k)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 border border-dashed border-white/15 rounded-lg px-3 py-2 hover:border-white/30 hover:text-white transition-colors cursor-pointer">
                <i className="ri-add-line" style={{ color: KIND_META[k].hex }}></i>{t(KIND_META[k].labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Registrado ese día (solo lectura): lo que de verdad se hizo. */}
      {(logged.acts.length > 0 || logged.strGroups.size > 0) && (
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-green-400 mb-2 flex items-center gap-2">
            <i className="ri-check-double-line"></i>{t('mc_ag_day_summary_logged')}
          </p>
          <div className="flex flex-wrap gap-2">
            {logged.strGroups.size > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300 bg-white/[0.03] border border-white/10 px-2.5 py-1.5 rounded-lg">
                <i className="ri-hammer-line" style={{ color: KIND_META.strength.hex }}></i>
                {[...logged.strGroups].map((g) => t(`mc_str_mg_${g}`, { defaultValue: g })).join(' + ')}
              </span>
            )}
            {logged.acts.map((a) => {
              const cfg = activityKindCfg(a.kind);
              return (
                <span key={a.id} className="inline-flex items-center gap-1.5 text-xs text-zinc-300 bg-white/[0.03] border border-white/10 px-2.5 py-1.5 rounded-lg">
                  <i className={cfg.icon} style={{ color: cfg.hex }}></i>
                  {t(cfg.labelKey)} · {a.duration_min} min{a.rounds ? ` · ${a.rounds}R` : ''}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Registrar lo que se hizo vive en Progreso › Actividad */}
      <button onClick={onGoActivity}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 text-sm font-bold transition-all cursor-pointer">
        <i className="ri-check-double-line"></i>{t('mc_ag_day_go_activity')}
      </button>
    </div>
  );
}

function DayItemRow({ item, onRemove }: { item: DayPlanItem; onRemove: () => void }) {
  const { t } = useTranslation();
  const tickable = KIND_META[item.kind].tick;
  const done = tickable && item.completed;

  let main = '';
  let sub: string | null = null;
  let exLines: string[] = [];
  if (item.kind === 'strength') {
    const p = item.payload as StrengthPayload;
    main = (p.groups || []).map((g) => t(`mc_str_mg_${g}`, { defaultValue: g })).join(' + ') || t('mc_dp_kind_strength');
    exLines = exerciseLines(p.exercises, t);
    if (p.note) sub = p.note;
  } else if (item.kind === 'activity') {
    const p = item.payload as ActivityPayload;
    main = t(activityKindCfg(p.kind).labelKey);
    const bits: string[] = [];
    if (p.duration_min) bits.push(`${p.duration_min} min`);
    if (p.distance_km) bits.push(`${p.distance_km} km`);
    if (p.meters) bits.push(`${p.meters} m`);
    if (p.rounds) bits.push(t('mc_av_rounds_short', { n: p.rounds }));
    if (p.pace_sec_per_km) bits.push(`${paceLabel(p.pace_sec_per_km)} /km`);
    if (p.note) bits.push(p.note);
    sub = bits.join(' · ') || null;
  } else if (item.kind === 'meal') {
    const p = item.payload as MealPayload;
    main = t(`mc_dp_slot_${p.slot}`, { defaultValue: p.slot });
    sub = p.text;
  } else if (item.kind === 'supplement') {
    const p = item.payload as SupplementPayload;
    main = p.name;
    sub = p.time || null;
  } else {
    main = (item.payload as NotePayload).text;
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 group">
      <div className="flex items-center gap-3">
        {tickable ? (
          <span className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0"
            style={{ borderColor: done ? '#22c55e' : 'rgba(255,255,255,0.2)', background: done ? '#22c55e' : 'transparent' }}>
            {done && <i className="ri-check-line text-white text-xs"></i>}
          </span>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: KIND_META[item.kind].hex }} />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${done ? 'text-zinc-500 line-through' : 'text-white'}`}>{main}</p>
          {sub && <p className="text-[11px] text-zinc-500 truncate">{sub}</p>}
        </div>
        {tickable && (
          <span className={`text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${done ? 'text-green-500' : 'text-zinc-600'}`}>
            {done ? t('mc_ag_block_done') : t('mc_ag_block_pending')}
          </span>
        )}
        <button onClick={onRemove} aria-label={t('mc_pl_line_remove')}
          className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <i className="ri-delete-bin-line text-sm"></i>
        </button>
      </div>
      {exLines.length > 0 && (
        <div className="mt-2 pl-8 space-y-0.5">
          {exLines.map((line, i) => {
            const dot = line.lastIndexOf(' · ');
            const name = dot > 0 ? line.slice(0, dot) : line;
            const detail = dot > 0 ? line.slice(dot + 3) : '';
            return (
              <div key={i} className="flex items-baseline gap-2 text-[11px]">
                <span className={`flex-1 min-w-0 truncate ${done ? 'text-zinc-600' : 'text-zinc-300'}`}>{name}</span>
                {detail && <span className="text-zinc-500 flex-shrink-0" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{detail}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function AddItemSheet({ open, initialKind, onClose, onSubmit }: {
  open: boolean;
  initialKind?: DayPlanKind;
  onClose: () => void;
  onSubmit: (kind: DayPlanKind, payload: DayPlanItem['payload']) => Promise<void>;
}) {
  const { t } = useTranslation();
  // Fuerza tiene su propio planificador en detalle: aquí no aparece.
  const KINDS = KIND_ORDER.filter((k) => k !== 'strength');
  const [kind, setKind] = useState<DayPlanKind>(initialKind && initialKind !== 'strength' ? initialKind : 'activity');
  const [actKind, setActKind] = useState(ACTIVITY_KINDS[0].value);
  const [duration, setDuration] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [pace, setPace] = useState('');
  const [meters, setMeters] = useState('');
  const [rounds, setRounds] = useState('');
  const [roundDur, setRoundDur] = useState('');
  const [slot, setSlot] = useState<MealSlot>('comida');
  const [mealText, setMealText] = useState('');
  const [suppName, setSuppName] = useState('');
  const [suppTime, setSuppTime] = useState('');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(initialKind && initialKind !== 'strength' ? initialKind : 'activity');
    setActKind(ACTIVITY_KINDS[0].value); setDuration(''); setDistanceKm(''); setPace(''); setMeters('');
    setRounds(''); setRoundDur(''); setSlot('comida'); setMealText(''); setSuppName(''); setSuppTime(''); setNoteText('');
  }, [open, initialKind]);

  const actCfg = activityKindCfg(actKind);
  // Ritmo previsto: se calcula de duración/distancia y es editable.
  const autoPace = computePace(parseFloat(duration) || undefined, parseFloat(distanceKm) || undefined);
  const shownPace = pace || (autoPace ? paceLabel(autoPace) : '');

  const valid =
    kind === 'activity' ? true :
    kind === 'meal' ? mealText.trim().length > 0 :
    kind === 'supplement' ? suppName.trim().length > 0 :
    noteText.trim().length > 0;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    let payload: DayPlanItem['payload'];
    if (kind === 'activity') {
      const p: ActivityPayload = { kind: actKind };
      if (duration) p.duration_min = parseInt(duration, 10);
      if (actCfg.fields.includes('distance_km') && distanceKm) p.distance_km = parseFloat(distanceKm.replace(',', '.'));
      if (actCfg.fields.includes('pace')) {
        const secs = pace ? paceToSec(pace) : autoPace;
        if (secs) p.pace_sec_per_km = secs;
      }
      if (actCfg.fields.includes('meters') && meters) p.meters = parseInt(meters, 10);
      if (actCfg.fields.includes('rounds') && rounds) p.rounds = parseInt(rounds, 10);
      if (actCfg.fields.includes('round_duration') && roundDur) p.round_duration_sec = parseInt(roundDur, 10);
      payload = p;
    } else if (kind === 'meal') {
      payload = { slot, text: mealText.trim() };
    } else if (kind === 'supplement') {
      payload = { name: suppName.trim(), ...(suppTime ? { time: suppTime } : {}) };
    } else {
      payload = { text: noteText.trim() };
    }
    await onSubmit(kind, payload);
    setSaving(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('mc_dp_form_title')}
      footer={
        <button onClick={submit} disabled={saving || !valid}
          className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem', minHeight: 44 }}>
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><i className="ri-add-line"></i> {t('mc_dp_form_save')}</>}
        </button>
      }>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-2">{t('mc_dp_form_kind')}</label>
          <div className="grid grid-cols-4 gap-1.5">
            {KINDS.map((k) => (
              <button key={k} onClick={() => setKind(k)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${kind === k ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}
                style={{ background: kind === k ? `${KIND_META[k].hex}18` : 'rgba(255,255,255,0.02)', minHeight: 44 }}>
                <i className={KIND_META[k].icon} style={{ color: KIND_META[k].hex, fontSize: 15 }}></i>
                <span className="text-white text-center leading-tight">{t(KIND_META[k].labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        {kind === 'activity' && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">{t('mc_dp_form_activity_type')}</label>
              <div className="grid grid-cols-3 gap-1.5">
                {ACTIVITY_KINDS.map((a) => (
                  <button key={a.value} onClick={() => setActKind(a.value)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${actKind === a.value ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}
                    style={{ background: actKind === a.value ? `${a.hex}18` : 'rgba(255,255,255,0.02)', minHeight: 44 }}>
                    <i className={a.icon} style={{ color: a.hex, fontSize: 15 }}></i>
                    <span className="text-white text-center leading-tight">{t(a.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_dp_form_duration')} <span className="text-zinc-600">({t('mc_optional')})</span></label>
                <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="decimal" type="number" min="1" max="600"
                  style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
              </div>
              {actCfg.fields.includes('distance_km') && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_av_field_km')}</label>
                  <input value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} inputMode="decimal" type="number" min="0" step="0.1"
                    style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
                </div>
              )}
              {actCfg.fields.includes('meters') && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_av_field_meters')}</label>
                  <input value={meters} onChange={(e) => setMeters(e.target.value)} inputMode="decimal" type="number" min="0" step="25"
                    style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
                </div>
              )}
              {actCfg.fields.includes('rounds') && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_av_field_rounds')}</label>
                  <input value={rounds} onChange={(e) => setRounds(e.target.value)} inputMode="decimal" type="number" min="1" max="30"
                    style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
                </div>
              )}
              {actCfg.fields.includes('round_duration') && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_av_field_round_dur')} <span className="text-zinc-600">({t('mc_optional')})</span></label>
                  <input value={roundDur} onChange={(e) => setRoundDur(e.target.value)} inputMode="decimal" type="number" min="10" max="600" step="10"
                    style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
                </div>
              )}
            </div>
            {actCfg.fields.includes('pace') && (
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_av_field_pace')} <span className="text-zinc-600">({t('mc_optional')})</span></label>
                <input value={pace} onChange={(e) => setPace(e.target.value)} inputMode="text" placeholder={autoPace ? paceLabel(autoPace) : '5:30'}
                  style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
                {shownPace && <p className="text-[11px] text-zinc-500 mt-1">{t('mc_av_pace_auto', { pace: shownPace })}</p>}
              </div>
            )}
          </>
        )}

        {kind === 'meal' && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">{t('mc_dp_form_meal_slot')}</label>
              <div className="grid grid-cols-4 gap-1.5">
                {MEAL_SLOTS.map((s) => (
                  <button key={s.value} onClick={() => setSlot(s.value)}
                    className={`py-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${slot === s.value ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:border-white/25'}`}
                    style={{ minHeight: 40 }}>
                    {t(s.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_dp_form_meal_text')}</label>
              <input value={mealText} onChange={(e) => setMealText(e.target.value)} maxLength={160} placeholder={t('mc_dp_form_meal_ph')}
                style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
            </div>
          </>
        )}

        {kind === 'supplement' && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_dp_form_supp_name')}</label>
              <input value={suppName} onChange={(e) => setSuppName(e.target.value)} maxLength={80} placeholder={t('mc_dp_form_supp_ph')}
                style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_dp_form_supp_time')}</label>
              <input type="time" value={suppTime} onChange={(e) => setSuppTime(e.target.value)}
                style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer [color-scheme:dark]" />
            </div>
          </>
        )}

        {kind === 'note' && (
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_dp_form_note_text')}</label>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} maxLength={280} placeholder={t('mc_dp_form_note_ph')}
              style={{ fontSize: 16 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none" />
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
