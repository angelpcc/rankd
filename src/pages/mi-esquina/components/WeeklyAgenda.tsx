import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable, isMissingColumn } from '@/lib/dbState';
import BottomSheet from '@/components/base/BottomSheet';
import StateBlock from '@/components/base/StateBlock';
import SegmentedProgress from '@/components/base/SegmentedProgress';
import StrengthPlanBuilder from './StrengthPlanBuilder';
import SectionHero from './SectionHero';
import RoutineRunner from './RoutineRunner';
import ProtocolPlayer from './ProtocolPlayer';
import { activeSupplementsOn } from '../lib/supplements';
import { loadRoutineById, saveRoutineSession, touchRoutine, type LoggedSet, type Routine, type RoutineDay } from '../lib/routines';
import { finishRun, loadProtocolById, type Protocol } from '../lib/protocols';
import { reconcileDayTicks } from '../lib/planTicks';
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
  /**
   * Registrar lo que se hizo vive en Progreso › Actividad, no aquí.
   * `kind` viaja cuando se sabe (un bloque planificado dice de qué es).
   */
  onGoActivity: (date?: string, kind?: string) => void;
  /** Ir a Fuerza › Registrar para resolver un bloque planificado a mano. */
  onGoStrength?: (date?: string) => void;
  /** Saltar a la pestaña Planificar (con una fecha opcional ya en mente). */
  onGoPlanificar?: (date?: string) => void;
  /**
   * Algo del día ha cambiado de estado desde aquí (se marcó hecho, se terminó
   * una rutina). El Resumen lee la misma tabla, así que tiene que releer o se
   * queda enseñando como pendiente lo que aquí ya está tachado.
   */
  onLogged?: () => void;
}

interface CompEvent { id: string; event_date: string; kind: 'fight' | 'weigh_in'; title: string }
interface LoggedAct { id: string; session_date: string; kind: string; duration_min: number; rounds: number | null }
interface LoggedStr {
  session_date: string;
  muscle_group: string | null;
  exercise_label: string;
  /** Franja (migración 0033). null = sesión única del día. */
  session_slot?: string | null;
}
interface LoggedWeight { entry_date: string; weight_kg: number }
interface LoggedMeal { entry_date: string; meal_type: string | null; description: string }
/** Suplemento de la rutina, con su vigencia (migración 0048). */
interface UserSupp {
  id: string; supplement_id: string | null; custom_name: string | null;
  time_of_day: string | null; slot: string | null;
  started_on?: string | null; ended_on?: string | null;
}

const SUPP_SLOT_LABEL: Record<string, string> = {
  manana: 'mc_sup_slot_manana', con_comidas: 'mc_sup_slot_meals',
  post_entreno: 'mc_sup_slot_post', antes_dormir: 'mc_sup_slot_sleep', otro: 'mc_sup_slot_other',
};

/** Todo lo que de verdad se hizo un día, para el resumen de la vista de día. */
export interface DayLog {
  acts: LoggedAct[];
  strGroups: Set<string>;
  /** Sesiones de fuerza del día, separadas por franja. */
  strSessions: { slot: string | null; groups: string[]; exercises: string[] }[];
  weight: number | null;
  meals: LoggedMeal[];
}

const EMPTY_LOG: DayLog = { acts: [], strGroups: new Set(), strSessions: [], weight: null, meals: [] };

/** ¿Se registró algo ese día? (los suplementos van aparte, no son por día). */
function hasAnyLog(l: DayLog): boolean {
  return l.strSessions.length > 0 || l.acts.length > 0 || l.weight != null || l.meals.length > 0;
}

/**
 * Resumen corto de lo REGISTRADO un día, para las vistas de semana y mes.
 *
 * Devuelve etiquetas cortas con su color, en el mismo orden que los bloques del
 * plan, para que una celda de semana diga "Pecho + Espalda · Correr" en vez de
 * "Día libre" cuando en realidad ese día se entrenó.
 */
function logSummary(l: DayLog, t: (k: string, o?: Record<string, unknown>) => string): { hex: string; text: string }[] {
  const out: { hex: string; text: string }[] = [];
  l.strSessions.forEach((s) => {
    const label = s.groups.length > 0
      ? s.groups.map((g) => t(`mc_str_mg_${g}`, { defaultValue: g })).join(' + ')
      : t('mc_dp_kind_strength');
    out.push({ hex: KIND_META.strength.hex, text: label });
  });
  l.acts.forEach((a) => {
    const cfg = activityKindCfg(a.kind);
    out.push({ hex: cfg.hex, text: `${t(cfg.labelKey)} · ${a.duration_min}′` });
  });
  if (l.meals.length > 0) {
    out.push({ hex: KIND_META.meal.hex, text: t('mc_ag_day_meals', { count: l.meals.length }) });
  }
  if (l.weight != null) {
    out.push({ hex: '#C9A84C', text: `${l.weight} kg` });
  }
  return out;
}

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

export default function WeeklyAgenda({ profile, showToast, mode = 'pro', onGoActivity, onGoStrength, onGoPlanificar, onLogged }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  // Se abre en DÍA: al entrar en Agenda lo que se quiere ver es lo de hoy, no
  // el panorama de la semana. La semana y el mes siguen a un toque.
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [dayISO, setDayISO] = useState<string>(todayISO());

  const [items, setItems] = useState<DayPlanItem[]>([]);
  const [comp, setComp] = useState<CompEvent[]>([]);
  const [loggedActs, setLoggedActs] = useState<LoggedAct[]>([]);
  const [loggedStr, setLoggedStr] = useState<LoggedStr[]>([]);
  const [loggedWeights, setLoggedWeights] = useState<LoggedWeight[]>([]);
  const [loggedMeals, setLoggedMeals] = useState<LoggedMeal[]>([]);
  const [supps, setSupps] = useState<UserSupp[]>([]);
  const [suppNames, setSuppNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [sheetFor, setSheetFor] = useState<{ date: string; kind?: DayPlanKind } | null>(null);
  // Fuerza usa su propio planificador en detalle (grupos → ejercicios → series).
  const [strengthSheet, setStrengthSheet] = useState<{ date: string } | null>(null);
  // Reprogramar: id del elemento que se está moviendo de día.
  const [moveFor, setMoveFor] = useState<DayPlanItem | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  // ── ACCESO DIRECTO A LA EJECUCIÓN (punto 21bis) ──
  // Un bloque que viene de un plan del Asesor sabe qué lo resuelve
  // (routine_id / protocol_id). Al tocarlo se abre AQUÍ MISMO el checklist o el
  // reproductor, en vez de mandar al usuario a Fuerza o Actividad a buscarlo.
  const [runner, setRunner] = useState<{ item: DayPlanItem; routine: Routine; day: RoutineDay } | null>(null);
  const [player, setPlayer] = useState<{ item: DayPlanItem; protocol: Protocol } | null>(null);
  // id del bloque que se está abriendo, para que el botón muestre que va.
  const [opening, setOpening] = useState<string | null>(null);
  const [runSaving, setRunSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // `session_slot` viene de la 0033. Si no está aplicada se pide sin ella:
    // se pierde la separación mañana/tarde, no el resumen entero.
    const strQuery = (cols: string) => supabase.from('strength_sets').select(cols)
      .eq('fighter_profile_id', profile.id);
    const [planRes, compRes, actRes, strFirst, weightRes, mealRes, suppRes, catRes] = await Promise.all([
      supabase.from('day_plan_items').select('*').eq('fighter_profile_id', profile.id).order('plan_date', { ascending: true }),
      supabase.from('planned_events').select('id, event_date, kind, title')
        .eq('fighter_profile_id', profile.id).in('kind', ['fight', 'weigh_in']),
      supabase.from('activity_sessions').select('id, session_date, kind, duration_min, rounds').eq('fighter_profile_id', profile.id),
      strQuery('session_date, muscle_group, exercise_label, session_slot'),
      supabase.from('weight_entries').select('entry_date, weight_kg').eq('fighter_profile_id', profile.id),
      supabase.from('meal_entries').select('entry_date, meal_type, description').eq('fighter_profile_id', profile.id),
      supabase.from('user_supplements').select('*').eq('fighter_profile_id', profile.id),
      supabase.from('common_supplements').select('id, name'),
    ]);
    if (isMissingTable(planRes.error)) { setUnavailable(true); setLoading(false); return; }
    const strRes = isMissingColumn(strFirst.error)
      ? await strQuery('session_date, muscle_group, exercise_label')
      : strFirst;
    setItems((planRes.data || []) as DayPlanItem[]);
    if (!isMissingTable(compRes.error)) setComp((compRes.data || []) as CompEvent[]);
    if (!isMissingTable(actRes.error)) setLoggedActs((actRes.data || []) as LoggedAct[]);
    if (!isMissingTable(strRes.error)) setLoggedStr((strRes.data || []) as unknown as LoggedStr[]);
    if (!isMissingTable(weightRes.error)) setLoggedWeights((weightRes.data || []) as LoggedWeight[]);
    if (!isMissingTable(mealRes.error)) setLoggedMeals((mealRes.data || []) as LoggedMeal[]);
    if (!isMissingTable(suppRes.error)) setSupps((suppRes.data || []) as UserSupp[]);
    if (!isMissingTable(catRes.error)) {
      setSuppNames(new Map(((catRes.data || []) as { id: string; name: string }[]).map((c) => [c.id, c.name])));
    }
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

  // Todo lo REGISTRADO por día: actividades, sesiones de fuerza separadas por
  // franja y con sus ejercicios, peso del día y comidas. Es lo que alimenta el
  // resumen "Lo que hiciste" de la vista de día, para que la Agenda sirva como
  // historial real y no solo como lista de lo previsto.
  const loggedByDate = useMemo(() => {
    const m = new Map<string, DayLog>();
    const get = (d: string): DayLog => {
      let e = m.get(d);
      if (!e) { e = { acts: [], strGroups: new Set<string>(), strSessions: [], weight: null, meals: [] }; m.set(d, e); }
      return e;
    };

    loggedActs.forEach((a) => { get(a.session_date).acts.push(a); });

    // Fuerza: agrupada por día Y FRANJA. Entrenar mañana y tarde el mismo día
    // son dos sesiones, y el resumen debe decirlo.
    const bySlot = new Map<string, { date: string; slot: string | null; groups: Set<string>; exercises: Set<string> }>();
    loggedStr.forEach((s) => {
      const slot = s.session_slot ?? null;
      const key = `${s.session_date}|${slot ?? ''}`;
      let e = bySlot.get(key);
      if (!e) { e = { date: s.session_date, slot, groups: new Set(), exercises: new Set() }; bySlot.set(key, e); }
      if (s.muscle_group) e.groups.add(s.muscle_group);
      const label = (s.exercise_label || '').trim();
      if (label) e.exercises.add(label);
      const day = get(s.session_date);
      if (s.muscle_group) day.strGroups.add(s.muscle_group);
    });
    bySlot.forEach((e) => {
      get(e.date).strSessions.push({ slot: e.slot, groups: [...e.groups], exercises: [...e.exercises] });
    });

    // Peso: si hubo varias pesadas ese día, se queda la última registrada.
    loggedWeights.forEach((w) => { get(w.entry_date).weight = Number(w.weight_kg); });
    loggedMeals.forEach((mm) => { get(mm.entry_date).meals.push(mm); });

    return m;
  }, [loggedActs, loggedStr, loggedWeights, loggedMeals]);

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

  /**
   * Reprogramar: solo cambia la fecha, conserva el contenido. Antes había que
   * borrar y volver a crear, que perdía los ejercicios ya detallados.
   */
  const moveItem = async (id: string, newDate: string) => {
    const prev = items.find((i) => i.id === id);
    if (!prev || prev.plan_date === newDate) { setMoveFor(null); return; }
    // Al mover se pierde el tick: el "hecho" era de aquel día, no de este.
    const { error } = await supabase.from('day_plan_items')
      .update({ plan_date: newDate, completed: false }).eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); return; }
    setItems((list) => list.map((i) => (i.id === id ? { ...i, plan_date: newDate, completed: false } : i)));
    setMoveFor(null);
    showToast(t('mc_ag_moved'));
  };

  /**
   * Copiar la semana anterior a la que se está viendo. Solo duplica el plan
   * (day_plan_items), nunca lo registrado, y siempre sin marcar como hecho.
   */
  const duplicatePrevWeek = async () => {
    const prevStart = addDays(weekStart, -7);
    const prevRange = Array.from({ length: 7 }, (_, i) => iso(addDays(prevStart, i)));
    const source = items.filter((i) => prevRange.includes(i.plan_date));
    if (source.length === 0) { showToast(t('mc_ag_dup_empty'), 'error'); return; }
    setDuplicating(true);
    const rows = source.map((i) => ({
      fighter_profile_id: profile.id,
      plan_date: iso(addDays(new Date(i.plan_date + 'T12:00:00'), 7)),
      kind: i.kind,
      payload: i.payload,
      source: 'manual',
      completed: false,
    }));
    const { data, error } = await supabase.from('day_plan_items').insert(rows).select();
    setDuplicating(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setItems((list) => [...list, ...(data as DayPlanItem[])]);
    showToast(t('mc_ag_dup_done', { n: data.length }));
  };

  const removeItem = async (id: string) => {
    setItems((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from('day_plan_items').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); } else showToast(t('mc_ag_item_removed'));
  };

  // ── ACCESO DIRECTO A LA EJECUCIÓN (punto 21bis) ──

  /** Marca (o desmarca) un bloque como hecho. Optimista: se pinta y se guarda. */
  const setCompleted = useCallback(async (id: string, value: boolean) => {
    setItems((p) => p.map((x) => (x.id === id ? { ...x, completed: value } : x)));
    const { error } = await supabase.from('day_plan_items').update({ completed: value }).eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); return; }
    // El Resumen lee ESTA misma tabla para decidir qué está pendiente. Si no se
    // le avisa, se queda con la foto anterior: aquí tachado, allí pendiente.
    // Era justo el desajuste reportado, visto desde el otro lado.
    onLogged?.();
  }, [load, showToast, t, onLogged]);

  /**
   * Abre lo que resuelve ese bloque. Dos caminos, y SIEMPRE hay uno:
   *
   *   · Con rutina o protocolo detrás → se ejecuta aquí mismo (checklist en
   *     vivo / reproductor de tramos) y al terminar el bloque queda hecho.
   *   · Sin ellos (un entreno escrito a mano) → se va a la pantalla de registro
   *     con el día puesto, y el tipo de actividad también. Antes esta rama no
   *     existía y la fila simplemente no hacía nada.
   *
   * Si la rutina o el protocolo ya no existen (el usuario los borró después de
   * generar el plan) no se deja al usuario tirado: se avisa y se cae al registro
   * manual, que resuelve el bloque igual.
   */
  const openItem = useCallback(async (item: DayPlanItem) => {
    setOpening(item.id);
    try {
      if (item.kind === 'strength') {
        const p = item.payload as StrengthPayload;
        if (p.routine_id) {
          const routine = await loadRoutineById(profile.id, p.routine_id);
          const day = routine?.days.find((d) => d.id === p.routine_day_id) ?? routine?.days[0] ?? null;
          if (routine && day) { setRunner({ item, routine, day }); return; }
          showToast(t('mc_ag_run_missing'), 'error');
        }
        onGoStrength?.(item.plan_date);
        return;
      }
      if (item.kind === 'activity') {
        const p = item.payload as ActivityPayload;
        if (p.protocol_id) {
          const protocol = await loadProtocolById(profile.id, p.protocol_id);
          if (protocol) { setPlayer({ item, protocol }); return; }
          showToast(t('mc_ag_run_missing'), 'error');
        }
        // El tipo va delante: llegar a Actividad con "correr" ya elegido ahorra
        // el paso que el bloque ya había contestado.
        onGoActivity(item.plan_date, p.kind);
      }
    } finally {
      setOpening(null);
    }
  }, [profile.id, showToast, t, onGoStrength, onGoActivity]);

  /** Cierre del checklist de fuerza abierto desde un día. */
  const finishRoutine = async (date: string, slot: string | null, sets: LoggedSet[]) => {
    if (!runner) return;
    setRunSaving(true);
    const res = await saveRoutineSession(profile.id, date, slot, sets);
    setRunSaving(false);
    if (!res.ok) { showToast(t('error_save'), 'error'); return; }

    const item = runner.item;
    setRunner(null);
    void touchRoutine(profile.id, runner.routine);
    // El tick del bloque se pone a mano además de dejar que `reconcileDayTicks`
    // haga su trabajo: la heurística por grupo muscular acierta casi siempre,
    // pero "casi" no vale cuando el usuario acaba de terminar ESE bloque.
    await setCompleted(item.id, true);
    void reconcileDayTicks(profile.id, date).then(() => onLogged?.());
    showToast(t('mc_ag_run_done'));
  };

  /** Cierre del reproductor de cardio abierto desde un día. */
  const finishProtocol = async (done: { secondsDone: number; segmentsDone: number; completed: boolean; distanceMeters: number }) => {
    if (!player) return;
    setRunSaving(true);
    const res = await finishRun(profile.id, player.protocol, done, player.item.plan_date);
    setRunSaving(false);
    if (res.sessionFailed) { showToast(t('error_save'), 'error'); return; }

    const item = player.item;
    setPlayer(null);
    // `setCompleted` ya avisa al Resumen. No se lanza aquí un
    // `reconcileDayTicks`: `finishRun` lanza el suyo al guardar la sesión, y dos
    // a la vez sobre el mismo día pueden pisarse y duplicar el bloque de
    // recibo. Marcar el bloque a mano es lo que de verdad importa aquí.
    await setCompleted(item.id, true);
    showToast(t('mc_ag_run_done'));
  };

  /** Los dos ejecutores, montados una sola vez y compartidos por las vistas. */
  const runnerOverlays = (
    <>
      {runner && (
        <RoutineRunner profile={profile} routine={runner.routine} day={runner.day} saving={runSaving}
          initialDate={runner.item.plan_date}
          onExit={() => setRunner(null)} onFinish={finishRoutine} />
      )}
      {player && (
        <ProtocolPlayer protocol={player.protocol} saving={runSaving}
          onExit={() => setPlayer(null)} onFinish={finishProtocol} />
      )}
    </>
  );

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
      {/* Reprogramar: elegir el nuevo día sin perder el contenido */}
      <BottomSheet open={!!moveFor} onClose={() => setMoveFor(null)} title={t('mc_ag_move_title')}>
        {moveFor && (
          <>
            <p className="text-sm mb-4" style={{ color: 'var(--t-2)' }}>
              {t('mc_ag_move_desc', { what: summarizeItem(moveFor, t) })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 14 }, (_, i) => addDays(mondayOf(new Date(moveFor.plan_date + 'T12:00:00')), i)).map((d) => {
                const dISO = iso(d);
                const current = dISO === moveFor.plan_date;
                return (
                  <button key={dISO} onClick={() => moveItem(moveFor.id, dISO)} disabled={current}
                    style={{ minHeight: 48 }}
                    className={`rounded-xl border text-left px-3 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      current ? 'border-white/10 bg-white/[0.02]' : 'border-white/12 bg-white/[0.04] hover:border-white/30'}`}>
                    <span className="block text-[11px] uppercase tracking-wider" style={{ color: 'var(--t-3)' }}>
                      {d.toLocaleDateString(locale, { weekday: 'short' })}
                      {dISO === todayISO() && ` · ${t('mc_today')}`}
                    </span>
                    <span className="block text-sm font-semibold text-white">
                      {d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );

  if (loading) return <StateBlock variant="loading" />;

  if (unavailable) {
    return <StateBlock variant="empty" art="agenda"
      title={t('mc_coming_soon_title')} description={t('mc_coming_soon_desc')} />;
  }

  // ══════════ CABECERA hero + selector Día · Semana · Mes ══════════
  const weekPlanned = (() => {
    const ws = iso(weekStart); const we = iso(addDays(weekStart, 6));
    return items.filter((i) => i.plan_date >= ws && i.plan_date <= we).length;
  })();
  const header = (
    <div className="space-y-3">
      <SectionHero kind="agenda" eyebrow={t('mc_ag_eyebrow')}
        title={`${t('mc_ag_title')} ${t('mc_ag_title_2')}`}
        subtitle={weekPlanned ? t('mc_ag_hero_sub', { n: weekPlanned }) : t('mc_ag_sub')} />
      <div className="flex gap-1.5">
        {(['day', 'week', 'month'] as const).map((v) => (
          <button key={v} onClick={() => { if (v === 'day') setDayISO((d) => d || todayISO()); setView(v); }}
            className={`rk-nav-btn text-xs font-bold ${view === v ? 'is-active' : ''}`} style={{ padding: '8px 14px' }}>
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
            supps={supps}
            suppNames={suppNames}
            date={dayISO}
            locale={locale}
            items={itemsByDate.get(dayISO) || []}
            comp={compByDate.get(dayISO) || []}
            logged={loggedByDate.get(dayISO) || EMPTY_LOG}
            mode={mode}
            onPrev={() => setDayISO(iso(addDays(new Date(dayISO + 'T12:00:00'), -1)))}
            onNext={() => setDayISO(iso(addDays(new Date(dayISO + 'T12:00:00'), 1)))}
            onAdd={(kind) => (kind === 'strength' ? setStrengthSheet({ date: dayISO }) : setSheetFor({ date: dayISO, kind }))}
            onRemove={removeItem}
            onMove={(it) => setMoveFor(it)}
            onPlanThisDay={() => setStrengthSheet({ date: dayISO })}
            onPlanWeek={onGoPlanificar ? () => onGoPlanificar(dayISO) : undefined}
            onGoActivity={() => onGoActivity(dayISO)}
            onRun={openItem}
            opening={opening}
            onToggleDone={setCompleted}
          />
        </div>
        {planSheets}
        {runnerOverlays}
      </>
    );
  }

  // ══════════ VISTA SEMANA ══════════
  if (view === 'week') {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekEnd = addDays(weekStart, 6);
    // Resumen de la semana: lo previsto (day_plan_items que se pueden marcar),
    // lo completado y los minutos REALMENTE registrados en activity_sessions.
    const wsISO = iso(weekStart); const weISO = iso(weekEnd);
    const inWeek = items.filter((i) => i.plan_date >= wsISO && i.plan_date <= weISO);
    const tickable = inWeek.filter((i) => TICK_KINDS.includes(i.kind));
    const doneWeek = tickable.filter((i) => i.completed).length;
    const minutesWeek = loggedActs
      .filter((a) => a.session_date >= wsISO && a.session_date <= weISO)
      .reduce((acc, a) => acc + (a.duration_min || 0), 0);
    const strDaysWeek = new Set(loggedStr.filter((s) => s.session_date >= wsISO && s.session_date <= weISO).map((s) => s.session_date)).size;
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

          {/* Resumen de la semana: previsto vs hecho, en una línea */}
          <div className="rk-card" style={{ padding: 16 }}>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p className="rk-label" style={{ color: 'var(--t-2)' }}>{t('mc_ag_week_summary')}</p>
              <p className="text-xs" style={{ color: 'var(--t-3)' }}>
                {t('mc_ag_week_done', { done: doneWeek, total: tickable.length })}
              </p>
            </div>
            <div className="mt-2.5">
              <SegmentedProgress total={Math.max(tickable.length, 1)} done={doneWeek} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { v: String(tickable.length), l: t('mc_ag_week_planned') },
                { v: String(minutesWeek), l: t('mc_ag_week_minutes') },
                { v: String(strDaysWeek), l: t('mc_ag_week_strength_days') },
              ].map((s) => (
                <div key={s.l} className="rk-surface-2 text-center" style={{ padding: '10px 6px' }}>
                  <p className="rk-num" style={{ fontSize: 22 }}>{s.v}</p>
                  <p className="rk-label" style={{ fontSize: 9, marginTop: 4 }}>{s.l}</p>
                </div>
              ))}
            </div>
            {tickable.length === 0 && (
              <button onClick={duplicatePrevWeek} disabled={duplicating} style={{ minHeight: 44 }}
                className="rk-nav-btn w-full mt-3 text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                <i className="ri-file-copy-line" /> {duplicating ? t('mc_saving') : t('mc_ag_dup_prev_week')}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {days.map((d) => {
              const dISO = iso(d);
              const list = itemsByDate.get(dISO) || [];
              const evs = compByDate.get(dISO) || [];
              const isToday = dISO === todayISO();
              const preview = list.slice(0, 2);
              const dayLog = logSummary(loggedByDate.get(dISO) || EMPTY_LOG, t);
              const doneCount = list.filter((x) => TICK_KINDS.includes(x.kind) && x.completed).length;
              const hasFight = evs.some((e) => e.kind === 'fight');
              const hasWeigh = evs.some((e) => e.kind === 'weigh_in');
              // Intensidad de fondo según la carga del día: un día con 4 cosas
              // se ve más "lleno" que uno con 1, sin tener que contar puntos.
              const load = Math.min(4, list.length);
              const loadBg = load === 0 ? undefined : `rgba(225,6,0,${0.04 + load * 0.035})`;
              return (
                <button key={dISO} onClick={() => openDay(dISO)}
                  style={{ background: isToday ? undefined : loadBg }}
                  className={`group text-left rounded-2xl border p-3 min-h-[116px] flex flex-col cursor-pointer rk-press ${
                    isToday ? 'border-red-500/50 bg-red-600/[0.06]' : hasFight ? 'border-red-500/40' : 'border-white/10 hover:border-white/25'
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

                    {/* Lo que se REGISTRÓ ese día. Va con el tic verde delante
                        para distinguirlo de lo previsto. Solo se pinta si no
                        estaba ya planificado (si lo estaba, la línea de arriba
                        aparece tachada y sería repetirlo). */}
                    {list.length === 0 && dayLog.slice(0, 2).map((s, si) => (
                      <div key={`l${si}`} className="flex items-center gap-1.5 min-w-0">
                        <i className="ri-check-line text-[10px] flex-shrink-0 text-green-500" />
                        <span className="text-[11px] truncate text-zinc-300">{s.text}</span>
                      </div>
                    ))}
                    {list.length === 0 && dayLog.length > 2 && (
                      <span className="text-[10px] text-zinc-600">{t('mc_ag_more_count', { n: dayLog.length - 2 })}</span>
                    )}

                    {/* "Día libre" SOLO si de verdad no hay nada: ni previsto,
                        ni competición, ni nada registrado. */}
                    {list.length === 0 && evs.length === 0 && dayLog.length === 0 && (
                      <span className="text-[11px] text-zinc-700">{t('mc_wp_free_day')}</span>
                    )}
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
        {runnerOverlays}
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
            // Registrado ese día aunque no estuviera planificado: el mes tiene
            // que enseñar en qué días entrenaste de verdad, no solo lo previsto.
            const didLog = hasAnyLog(loggedByDate.get(date) || EMPTY_LOG);
            return (
              <button key={date} onClick={() => openDay(date)}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-start p-1 transition-all cursor-pointer border ${
                  isToday ? 'border-red-500/40 bg-red-600/[0.05]' : 'border-transparent hover:border-white/15 hover:bg-white/[0.03]'
                } ${hasFight ? 'ring-1 ring-red-500/50' : ''}`}>
                <span className={`text-xs font-bold mt-0.5 ${isToday ? 'text-red-400' : hasFight ? 'text-red-300' : 'text-zinc-300'}`}>{dayNum}</span>
                <div className="flex flex-wrap items-center justify-center gap-0.5 mt-auto mb-0.5">
                  {mode === 'pro' && hasFight && <i className="ri-sword-line text-[10px]" style={{ color: '#ff2d2d' }}></i>}
                  {mode === 'pro' && hasWeigh && <i className="ri-scales-2-line text-[10px]" style={{ color: '#C9A84C' }}></i>}
                  {/* Verde = ese día entrenaste (planificado o no).
                      Rojo = hay algo previsto que aún no has hecho. */}
                  {allDone || didLog
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
  /** Suplementos vigentes ese día (solo lectura). */
  supps: UserSupp[];
  suppNames: Map<string, string>;
  date: string;
  locale: string;
  items: DayPlanItem[];
  comp: CompEvent[];
  logged: DayLog;
  mode: 'pro' | 'hobby';
  onPrev: () => void;
  onNext: () => void;
  onAdd: (kind: DayPlanKind) => void;
  onRemove: (id: string) => void;
  /** Reprogramar el elemento a otro día conservando su contenido. */
  onMove?: (item: DayPlanItem) => void;
  onPlanThisDay: () => void;
  onPlanWeek?: () => void;
  onGoActivity: () => void;
  /** Abrir lo que resuelve el bloque (checklist de fuerza o cardio en vivo). */
  onRun?: (item: DayPlanItem) => void;
  /** id del bloque que se está abriendo, para enseñar que va. */
  opening?: string | null;
  /** Marcar o desmarcar el bloque como hecho. */
  onToggleDone?: (id: string, value: boolean) => void;
}

function DayView({ supps, suppNames, date, locale, items, comp, logged, mode, onPrev, onNext, onAdd, onRemove, onMove, onPlanThisDay, onPlanWeek, onGoActivity, onRun, opening, onToggleDone }: DayViewProps) {
  const { t } = useTranslation();
  const dObj = new Date(date + 'T12:00:00');
  const isToday = date === todayISO();
  const relDays = Math.round((dObj.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const rel = relDays === 0 ? t('mc_today') : relDays === 1 ? t('mc_cal_tomorrow') : relDays === -1 ? t('mc_yesterday')
    : relDays > 0 ? t('mc_cal_in_days', { n: relDays }) : '';

  const byKind = (k: DayPlanKind) => items.filter((i) => i.kind === k);
  const empty = items.length === 0;

  // Suplementos que estaban vigentes ESE día, ordenados por hora de toma.
  const daySupps = activeSupplementsOn(supps, date)
    .slice()
    .sort((a, b) => (a.time_of_day || '99:99').localeCompare(b.time_of_day || '99:99'));

  // ¿Hay algo que resumir? Los suplementos cuentan: un día en el que solo
  // tomaste creatina sigue siendo un día con algo registrado.
  const hasLog = logged.strSessions.length > 0 || logged.acts.length > 0
    || logged.weight != null || logged.meals.length > 0 || daySupps.length > 0;

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

      {/* ── LO QUE HICISTE ESE DÍA ──
          Va SIEMPRE, tenga o no plan. Antes vivía dentro de la rama "hay algo
          planificado", así que un día sin plan no mostraba nada: ni el entreno
          que habías registrado, ni los suplementos. La Agenda tiene que servir
          para mirar atrás y ver lo que de verdad hiciste. Todo solo lectura:
          cada cosa se edita en su sección. */}
      {hasLog && (
        <div className="rk-card" style={{ padding: '16px 18px' }}>
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-green-400 mb-3 flex items-center gap-2">
            <i className="ri-check-double-line"></i>{t('mc_ag_day_summary_logged')}
          </p>

          <div className="space-y-3">
            {/* Fuerza: una línea por sesión, con su franja y sus ejercicios. */}
            {logged.strSessions.map((s, i) => (
              <div key={`s${i}`} className="flex items-start gap-2.5">
                <i className="ri-hammer-line mt-0.5 flex-shrink-0" style={{ color: KIND_META.strength.hex }} />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200">
                    {s.groups.length > 0
                      ? s.groups.map((g) => t(`mc_str_mg_${g}`, { defaultValue: g })).join(' + ')
                      : t('mc_dp_kind_strength')}
                    {s.slot && <span className="text-zinc-500"> · {t(`mc_str_slot_${s.slot}`, { defaultValue: s.slot })}</span>}
                  </p>
                  {s.exercises.length > 0 && (
                    <p className="text-[11px] text-zinc-500 leading-relaxed">{s.exercises.join(' · ')}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Actividad */}
            {logged.acts.map((a) => {
              const cfg = activityKindCfg(a.kind);
              return (
                <div key={a.id} className="flex items-start gap-2.5">
                  <i className={`${cfg.icon} mt-0.5 flex-shrink-0`} style={{ color: cfg.hex }} />
                  <p className="text-sm text-zinc-200">
                    {t(cfg.labelKey)}
                    <span className="text-zinc-500"> · {a.duration_min} min{a.rounds ? ` · ${a.rounds}R` : ''}</span>
                  </p>
                </div>
              );
            })}

            {/* Peso del día */}
            {logged.weight != null && (
              <div className="flex items-start gap-2.5">
                <i className="ri-scales-2-line mt-0.5 flex-shrink-0" style={{ color: '#C9A84C' }} />
                <p className="text-sm text-zinc-200">
                  {t('mc_ag_day_weight')}<span className="text-zinc-500"> · {logged.weight} kg</span>
                </p>
              </div>
            )}

            {/* Comidas registradas */}
            {logged.meals.length > 0 && (
              <div className="flex items-start gap-2.5">
                <i className="ri-restaurant-2-line mt-0.5 flex-shrink-0" style={{ color: KIND_META.meal.hex }} />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200">{t('mc_ag_day_meals', { count: logged.meals.length })}</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    {logged.meals.map((m) => m.description).join(' · ')}
                  </p>
                </div>
              </div>
            )}

            {/* Suplementos VIGENTES ese día. Se gestionan en Nutrición, pero
                aparecen aquí porque son parte de la rutina del día. Al quitar
                uno se le pone fecha de fin, así que los días anteriores lo
                siguen mostrando y los siguientes no. */}
            {daySupps.length > 0 && (
              <div className="flex items-start gap-2.5">
                <i className="ri-capsule-line mt-0.5 flex-shrink-0" style={{ color: KIND_META.supplement.hex }} />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200">{t('mc_sup_today_title')}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {daySupps.map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 bg-white/[0.04] border border-white/10 px-2 py-1 rounded-lg">
                        {s.slot && SUPP_SLOT_LABEL[s.slot] && s.slot !== 'otro' && (
                          <span style={{ color: 'var(--t-3)' }}>{t(SUPP_SLOT_LABEL[s.slot])}</span>
                        )}
                        {s.custom_name || suppNames.get(s.supplement_id || '') || '—'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* El cartel de "día sin planificar" SOLO cuando el día está de verdad
          vacío. Si entrenaste y lo registraste, el día tiene contenido: decir
          que está sin planificar sería mentir y tapaba lo que sí hiciste. */}
      {empty && !hasLog ? (
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
                    <DayItemRow key={it.id} item={it}
                      onRemove={() => onRemove(it.id)}
                      onMove={onMove ? () => onMove(it) : undefined}
                      onRun={onRun ? () => onRun(it) : undefined}
                      opening={opening === it.id}
                      onToggleDone={onToggleDone ? (v) => onToggleDone(it.id, v) : undefined} />
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

      {/* Registrar lo que se hizo vive en Progreso › Actividad */}
      <button onClick={onGoActivity}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 text-sm font-bold transition-all cursor-pointer">
        <i className="ri-check-double-line"></i>{t('mc_ag_day_go_activity')}
      </button>
    </div>
  );
}

function DayItemRow({ item, onRemove, onMove, onRun, opening, onToggleDone }: {
  item: DayPlanItem;
  onRemove: () => void;
  onMove?: () => void;
  /** Abrir lo que resuelve el bloque. Solo si hay algo que abrir. */
  onRun?: () => void;
  opening?: boolean;
  onToggleDone?: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const tickable = KIND_META[item.kind].tick;
  // Las comidas no llevan checkbox en el modelo, pero SÍ se pueden dar por
  // hechas desde aquí (punto 21bis): el estado es el mismo `completed`, solo
  // cambia que no se pinta la casilla a la izquierda.
  const done = item.completed;

  // ── ¿Hay algo que abrir? ──
  //
  // TODO bloque de entreno planificado y sin hacer se abre. Antes solo se abrían
  // los que traían rutina o protocolo detrás (los del Asesor), así que un
  // entreno escrito a mano era una línea muerta: se veía, no se podía tocar, y
  // había que ir a buscar la sección correspondiente por el menú.
  //
  // Los que no tienen rutina ni protocolo llevan a la pantalla de registro con
  // el día (y el tipo de actividad) ya puestos. Quien decide adónde es
  // `openItem`; aquí solo se dice que la fila es tocable.
  //
  // Un bloque YA HECHO no se abre: es un registro, no una tarea. Y los
  // `source: 'logged'` tampoco: son el recibo de algo que ya está en el
  // historial.
  const strengthPayload = item.kind === 'strength' ? (item.payload as StrengthPayload) : null;
  const activityPayload = item.kind === 'activity' ? (item.payload as ActivityPayload) : null;
  const isTraining = item.kind === 'strength' || item.kind === 'activity';
  // Resumen de lo realmente entrenado, si el bloque ya está resuelto. Lo escribe
  // `lib/planTicks.ts` leyendo las sesiones; aquí solo se pinta.
  const hecho = done ? (strengthPayload?.done || activityPayload?.done || null) : null;
  /** Con rutina/protocolo se ejecuta aquí mismo; sin ellos, se va a registrar. */
  const runsInPlace = !!strengthPayload?.routine_id || !!activityPayload?.protocol_id;
  // Un bloque de MAÑANA no se puede registrar: no ha pasado. Los formularios de
  // registro no aceptan fechas futuras, así que ofrecer el atajo llevaría a una
  // pantalla que rechaza lo que se acaba de pedir. Ejecutarlo en vivo sí se
  // permite —quien le da al play lo está haciendo ahora—; lo que se corta es
  // solo el atajo a "registrar a mano".
  const future = item.plan_date > todayISO();
  const runnable = !!onRun && isTraining && !done && item.source !== 'logged'
    && (runsInPlace || !future);

  let main = '';
  let sub: string | null = null;
  let exLines: string[] = [];
  if (item.kind === 'strength') {
    const p = strengthPayload as StrengthPayload;
    main = (p.groups || []).map((g) => t(`mc_str_mg_${g}`, { defaultValue: g })).join(' + ') || t('mc_dp_kind_strength');
    exLines = exerciseLines(p.exercises, t);
    if (p.note) sub = p.note;
  } else if (item.kind === 'activity') {
    const p = activityPayload as ActivityPayload;
    // Con protocolo detrás manda SU nombre: "Cardio tarde — grasa" dice mucho
    // más que "Cinta", que es lo único que se veía antes.
    main = p.protocol_name || t(activityKindCfg(p.kind).labelKey);
    const bits: string[] = [];
    if (p.protocol_name) bits.push(t(activityKindCfg(p.kind).labelKey));
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

  // El contenido del bloque. Cuando hay algo que abrir se envuelve en un botón:
  // toda la fila es el acceso directo, no un icono escondido a la derecha.
  const body = (
    <>
      <p className={`text-sm font-semibold flex items-center gap-1.5 ${done ? 'text-zinc-500 line-through' : 'text-white'}`}>
        {main}
        {runnable && (
          <i className={runsInPlace ? 'ri-play-circle-line flex-shrink-0' : 'ri-edit-box-line flex-shrink-0'}
            style={{ color: 'var(--accent)' }} />
        )}
      </p>
      {sub && <p className="text-[11px] text-zinc-500 truncate">{sub}</p>}
      {/* ── Lo que se hizo DE VERDAD ──
          Dos líneas como mucho: "Press banca ×4 · Remo ×3" y las series totales.
          Es el resumen del día de un vistazo; el detalle sigue viviendo en
          Fuerza (o en Actividad). Sin esto, un bloque planificado como "pecho y
          espalda" quedaba tachado pero sin decir qué se habia hecho. */}
      {hecho && (
        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--accent)' }}>
          <i className="ri-check-line mr-1" />
          {hecho.text}
          {hecho.total ? (
            <span className="text-zinc-500">
              {' · '}
              {item.kind === 'strength'
                ? t('mc_ag_done_sets', { count: hecho.total })
                : t('mc_hoy_act_min', { n: hecho.total })}
            </span>
          ) : null}
        </p>
      )}
      {runnable && (
        <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--accent)' }}>
          {opening
            ? t('mc_ag_run_opening')
            : runsInPlace
              ? t(item.kind === 'strength' ? 'mc_ag_run_strength' : 'mc_ag_run_activity')
              : t('mc_ag_go_log')}
        </p>
      )}
    </>
  );

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
        {runnable ? (
          <button onClick={onRun} disabled={opening}
            className="flex-1 min-w-0 text-left cursor-pointer disabled:opacity-60"
            style={{ minHeight: 40 }}>
            {body}
          </button>
        ) : (
          <div className="flex-1 min-w-0">{body}</div>
        )}
        {tickable && (
          <span className={`text-[10px] font-bold uppercase tracking-wider flex-shrink-0 inline-flex items-center gap-1 ${done ? 'text-green-500' : 'text-zinc-600'}`}>
            {done && (
              // El check se dibuja en el momento en que el bloque pasa a hecho
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="rk-check-draw" />
              </svg>
            )}
            {done ? t('mc_ag_block_done') : t('mc_ag_block_pending')}
          </span>
        )}
        {/* Marcar a mano. Es la salida para cuando el entreno se hizo sin abrir
            el checklist, y la ÚNICA para las comidas, que no tienen ejecutor.
            Las observaciones quedan fuera: una nota no se "cumple". */}
        {onToggleDone && item.kind !== 'note' && (
          <button onClick={() => onToggleDone(!done)}
            aria-pressed={done}
            aria-label={t(done ? 'mc_sem_mark_undone' : 'mc_sem_mark_done')}
            title={t(done ? 'mc_sem_mark_undone' : 'mc_sem_mark_done')}
            className="w-7 h-7 flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors"
            style={{ color: done ? '#4ade80' : 'var(--t-3)' }}>
            <i className={done ? 'ri-checkbox-circle-fill text-base' : 'ri-checkbox-circle-line text-base'} />
          </button>
        )}
        {onMove && (
          <button onClick={onMove} aria-label={t('mc_ag_move_title')} title={t('mc_ag_move_title')}
            className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-white cursor-pointer flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <i className="ri-calendar-event-line text-sm"></i>
          </button>
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
        {/* ── El selector de tipo solo sale si NO se sabe a qué has venido ──
            Se entra aquí desde un botón que ya dice el tipo ("Actividad"), así
            que volver a preguntarlo sobraba: elegías Actividad y la pantalla te
            ofrecía comida, suplemento y nota, como si no te hubiera oído. Y
            Fuerza, que tiene su propio planificador, ni siquiera aparecía en la
            lista, con lo que el selector encima estaba incompleto.
            Ahora, con el tipo ya sabido, se enseña como encabezado. */}
        {initialKind && initialKind !== 'strength' ? (
          <div className="flex items-center gap-2">
            <i className={KIND_META[kind].icon} style={{ color: KIND_META[kind].hex, fontSize: 18 }}></i>
            <span className="text-white font-bold">{t(KIND_META[kind].labelKey)}</span>
          </div>
        ) : (
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
        )}

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
                <label className="flex items-end text-sm text-zinc-400 mb-1.5" style={{ minHeight: '2.4rem' }}>{t('mc_dp_form_duration')} <span className="text-zinc-600">({t('mc_optional')})</span></label>
                <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="decimal" type="number" min="1" max="600"
                  style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
              </div>
              {actCfg.fields.includes('distance_km') && (
                <div>
                  <label className="flex items-end text-sm text-zinc-400 mb-1.5" style={{ minHeight: '2.4rem' }}>{t('mc_av_field_km')}</label>
                  <input value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} inputMode="decimal" type="number" min="0" step="0.1"
                    style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
                </div>
              )}
              {actCfg.fields.includes('meters') && (
                <div>
                  <label className="flex items-end text-sm text-zinc-400 mb-1.5" style={{ minHeight: '2.4rem' }}>{t('mc_av_field_meters')}</label>
                  <input value={meters} onChange={(e) => setMeters(e.target.value)} inputMode="decimal" type="number" min="0" step="25"
                    style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
                </div>
              )}
              {actCfg.fields.includes('rounds') && (
                <div>
                  <label className="flex items-end text-sm text-zinc-400 mb-1.5" style={{ minHeight: '2.4rem' }}>{t('mc_av_field_rounds')}</label>
                  <input value={rounds} onChange={(e) => setRounds(e.target.value)} inputMode="decimal" type="number" min="1" max="30"
                    style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
                </div>
              )}
              {actCfg.fields.includes('round_duration') && (
                <div>
                  <label className="flex items-end text-sm text-zinc-400 mb-1.5" style={{ minHeight: '2.4rem' }}>{t('mc_av_field_round_dur')} <span className="text-zinc-600">({t('mc_optional')})</span></label>
                  <input value={roundDur} onChange={(e) => setRoundDur(e.target.value)} inputMode="decimal" type="number" min="10" max="600" step="10"
                    style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
                </div>
              )}
            </div>
            {actCfg.fields.includes('pace') && (
              <div>
                <label className="flex items-end text-sm text-zinc-400 mb-1.5" style={{ minHeight: '2.4rem' }}>{t('mc_av_field_pace')} <span className="text-zinc-600">({t('mc_optional')})</span></label>
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
              <label className="flex items-end text-sm text-zinc-400 mb-1.5" style={{ minHeight: '2.4rem' }}>{t('mc_dp_form_meal_text')}</label>
              <input value={mealText} onChange={(e) => setMealText(e.target.value)} maxLength={160} placeholder={t('mc_dp_form_meal_ph')}
                style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
            </div>
          </>
        )}

        {kind === 'supplement' && (
          <>
            <div>
              <label className="flex items-end text-sm text-zinc-400 mb-1.5" style={{ minHeight: '2.4rem' }}>{t('mc_dp_form_supp_name')}</label>
              <input value={suppName} onChange={(e) => setSuppName(e.target.value)} maxLength={80} placeholder={t('mc_dp_form_supp_ph')}
                style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="flex items-end text-sm text-zinc-400 mb-1.5" style={{ minHeight: '2.4rem' }}>{t('mc_dp_form_supp_time')}</label>
              <input type="time" value={suppTime} onChange={(e) => setSuppTime(e.target.value)}
                style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer [color-scheme:dark]" />
            </div>
          </>
        )}

        {kind === 'note' && (
          <div>
            <label className="flex items-end text-sm text-zinc-400 mb-1.5" style={{ minHeight: '2.4rem' }}>{t('mc_dp_form_note_text')}</label>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} maxLength={280} placeholder={t('mc_dp_form_note_ph')}
              style={{ fontSize: 16 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none" />
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
