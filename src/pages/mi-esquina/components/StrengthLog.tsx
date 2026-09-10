import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable, writeDroppingMissingColumns } from '@/lib/dbState';
import {
  MUSCLE_GROUPS, muscleGroupOf, weightModeOf, trackingModeOf,
  type MuscleGroup, type WeightMode, type TrackingMode,
} from '../lib/exercises';
import { fmtWeight, fmtSetCount, fmtSetValue, type StrengthPayload } from '../lib/dayPlan';
import { reconcileDayTicks } from '../lib/planTicks';
import { loadTodayTraining } from '../lib/todayTraining';
import { clearDraft } from '../lib/strengthDraft';
import { computePRs, prKey, type PRHit } from '../lib/prs';
import { groupSeries, isDropStep } from '../lib/strength';
import StateBlock from '@/components/base/StateBlock';
import { SkeletonBox, SkeletonList } from '@/components/base/Skeleton';
import SectionHero from './SectionHero';
import Reveal from '@/components/base/Reveal';
import MuscleMap, { type MapGroup, type TrainState } from './MuscleMap';
import StrengthSessionForm, { type BuiltSession, type SessionSlot, type EditSession } from './StrengthSessionForm';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** El mapa muscular y el volumen semanal viven en el nivel 1 (resumen). */
  hideSummaryBlocks?: boolean;
  /** Oculta la lista de historial por días (tiene su propia pestaña). */
  hideHistory?: boolean;
  /** Oculta el CTA de "nueva sesión" (vista de solo lectura / historial). */
  hideRegisterCta?: boolean;
  /** Enlace opcional "ver historial completo" cuando hideHistory. */
  onSeeHistory?: () => void;
  /**
   * Día con el que abrir el formulario de alta. Llega de un bloque de la Agenda
   * que se ha tocado para resolverlo: sin esto, un entreno planificado para el
   * martes se guardaba con la fecha de hoy sin avisar.
   */
  initialDate?: string;
  /**
   * Se llama DESPUÉS de que la Agenda se haya sincronizado con lo registrado.
   *
   * El orden importa: `reconcileDayTicks` es quien marca el bloque del día como
   * hecho (o lo crea, si el entreno no estaba planificado). Avisar antes de que
   * termine haría que las tarjetas de "hoy toca" se recargasen con los datos
   * viejos y siguieran enseñando como pendiente lo que se acaba de hacer.
   */
  onLogged?: () => void;
}

interface StrengthSet {
  id: string;
  exercise: string;
  exercise_label: string;
  session_date: string;
  set_number: number;
  reps: number;
  reps_max: number | null;
  weight_kg: number;
  muscle_group: string | null;
  session_slot: SessionSlot | null;
  weight_mode: string | null;
  tracking_mode: string | null;
  /** Nota libre del ejercicio (columna de la migración 0014). */
  notes: string | null;
  /** Máquina o polea concreta (migración 0047). null = sin especificar. */
  machine_label: string | null;
  /**
   * Escalón dentro de una serie descendente (migración 0047).
   * null = serie normal. 1 = la serie de verdad de un dropset. 2, 3… = bajadas.
   */
  drop_step: number | null;
  created_at: string;
}

type GroupKey = MuscleGroup | 'other';
const ORDER: GroupKey[] = [...MUSCLE_GROUPS, 'other'];


function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Modos del ejercicio: se leen de las filas guardadas y, si son antiguas y no
// los traen, se derivan del nombre con la biblioteca.
function exModes(label: string, sets: StrengthSet[]): { wm: WeightMode; tm: TrackingMode } {
  const wm = (sets.find((s) => s.weight_mode)?.weight_mode as WeightMode) || weightModeOf(label);
  const tm = (sets.find((s) => s.tracking_mode)?.tracking_mode as TrackingMode) || trackingModeOf(label);
  return { wm, tm };
}

interface SessExercise { exercise: string; label: string; sets: StrengthSet[]; wm: WeightMode; tm: TrackingMode }

/** Etiqueta de "volumen" del grupo según lo que aplica: kg (reps+peso), segundos
 * (time), metros (distance) o repeticiones (reps sin peso). */
function groupVolumeLabel(g: { exercises: SessExercise[]; volume: number }, t: (k: string, o?: Record<string, unknown>) => string, locale: string): string {
  if (g.volume > 0) return `${g.volume.toLocaleString(locale)} kg`;
  let sec = 0, m = 0, reps = 0;
  g.exercises.forEach((ex) => ex.sets.forEach((s) => {
    if (ex.tm === 'time') sec += s.reps;
    else if (ex.tm === 'distance') m += s.reps;
    else reps += s.reps;
  }));
  if (sec > 0) return `${sec} ${t('mc_str_unit_sec')}`;
  if (m > 0) return `${m} ${t('mc_str_unit_m')}`;
  if (reps > 0) return `${reps} ${t('mc_str_unit_reps')}`;
  return '—';
}
interface SessGroup { group: GroupKey; exercises: SessExercise[]; volume: number }
// Doble sesión por día: cada día tiene una o varias franjas (mañana/tarde/
// noche o "única" cuando slot=null). Cada franja tiene sus grupos y volumen.
interface DaySlot { slot: SessionSlot | null; groups: SessGroup[]; exerciseCount: number; groupKeys: GroupKey[]; volume: number }
interface DaySession { date: string; slots: DaySlot[]; exerciseCount: number; volume: number }
const SLOT_ORDER: SessionSlot[] = ['morning', 'afternoon', 'evening'];
function slotKey(s: SessionSlot | null): string { return s || '_none'; }

/**
 * Registro de fuerza por SESIÓN (rediseño 2026-08).
 *
 * El registro va en 3 pasos (grupos → ejercicios por grupo → guardar), en
 * StrengthSessionForm. Aquí se muestran las sesiones guardadas: historial por
 * días agrupado por grupo muscular con su volumen, y la progresión por ejercicio.
 * Sigue guardando UNA FILA POR SERIE en strength_sets; nada se almacena derivado.
 */
export default function StrengthLog({ profile, showToast, hideSummaryBlocks, hideHistory, hideRegisterCta, onSeeHistory, onLogged, initialDate }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [rows, setRows] = useState<StrengthSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [formInitialGroup, setFormInitialGroup] = useState<MuscleGroup | undefined>(undefined);
  // Grupos del entreno PLANIFICADO para hoy, si lo hay. Alimentan el botón
  // "Registrar pecho y espalda" y abren el formulario ya con esos bloques.
  const [formInitialGroups, setFormInitialGroups] = useState<MuscleGroup[] | undefined>(undefined);
  const [plannedToday, setPlannedToday] = useState<MuscleGroup[]>([]);
  // Edición de una sesión ya guardada: editCtx = qué día+franja se está
  // editando (para borrar sus filas al guardar); editData = lo que pinta el form.
  const [editCtx, setEditCtx] = useState<{ date: string; slot: SessionSlot | null } | null>(null);
  const [editData, setEditData] = useState<EditSession | undefined>(undefined);
  // Duplicar: mismo pre-relleno que editar, pero se guarda como sesión NUEVA.
  const [duplicateData, setDuplicateData] = useState<EditSession | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [openEx, setOpenEx] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  // Signature moment: destello full-screen cuando se bate marca personal.
  const [showPRFlash, setShowPRFlash] = useState(false);

  // Abre el formulario. Desde el muñeco muscular llega con el grupo ya
  // decidido (salta directo al paso 2); desde "Nueva sesión" llega vacío.
  const openForm = (group?: MapGroup) => {
    setEditCtx(null);
    setEditData(undefined);
    setFormInitialGroup(group);
    setFormInitialGroups(undefined);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  /**
   * Abre el formulario con los grupos que YA planificaste para hoy.
   *
   * Si el lunes dejaste puesto "pecho y espalda", al entrar en Fuerza el botón
   * dice "Registrar pecho y espalda" y entra directo con esos dos bloques
   * puestos: no tiene sentido volver a elegirlos. Al guardar, el tick del plan
   * se marca solo (reconcileDayTicks ya lo hace).
   */
  const openFormForPlan = (groups: MuscleGroup[]) => {
    setEditCtx(null);
    setEditData(undefined);
    setFormInitialGroup(undefined);
    setFormInitialGroups(groups);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('strength_sets').select('*')
      .eq('fighter_profile_id', profile.id)
      .order('session_date', { ascending: false })
      .limit(2000);
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    const list = (data || []) as StrengthSet[];
    setRows(list);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  // Entreno de fuerza PLANIFICADO para hoy y todavía sin hacer. Es lo que
  // convierte el botón genérico "Registrar" en "Registrar pecho y espalda".
  //
  // Usa la misma regla que las tarjetas de "hoy toca" (lib/todayTraining.ts):
  // este botón es otra forma de decir "esto te queda", así que no puede tener
  // su propio criterio de qué cuenta como pendiente.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { pendingStrength } = await loadTodayTraining(profile.id, ['strength']);
      if (!alive) return;
      const groups = pendingStrength
        .flatMap((b) => (b.payload as StrengthPayload).groups || [])
        .filter((g): g is MuscleGroup => MUSCLE_GROUPS.includes(g as MuscleGroup));
      setPlannedToday([...new Set(groups)]);
    })();
    return () => { alive = false; };
  }, [profile.id, rows]);

  /** "Pecho + Espalda" a partir de los grupos del plan. */
  const plannedLabel = plannedToday.map((g) => t(`mc_str_mg_${g}`)).join(' + ');

  const groupOfRow = useCallback(
    (r: StrengthSet): GroupKey =>
      (r.muscle_group && ORDER.includes(r.muscle_group as GroupKey) ? (r.muscle_group as GroupKey) : (muscleGroupOf(r.exercise_label) || 'other')),
    [],
  );

  // Todos los ejercicios del usuario con su grupo (para sugerir en el formulario
  // y para el selector de progresión).
  const ownExercises = useMemo(() => {
    const m = new Map<string, { label: string; group: GroupKey }>();
    rows.forEach((r) => { if (!m.has(r.exercise)) m.set(r.exercise, { label: r.exercise_label, group: groupOfRow(r) }); });
    return [...m.values()];
  }, [rows, groupOfRow]);

  // ── Sesiones por día → franja → grupo muscular (doble sesión por día) ──
  const sessions = useMemo<DaySession[]>(() => {
    const byDate = new Map<string, StrengthSet[]>();
    rows.forEach((r) => { const l = byDate.get(r.session_date) || []; l.push(r); byDate.set(r.session_date, l); });

    const buildGroups = (sets: StrengthSet[]): SessGroup[] => {
      const byGroup = new Map<GroupKey, StrengthSet[]>();
      sets.forEach((r) => { const g = groupOfRow(r); const l = byGroup.get(g) || []; l.push(r); byGroup.set(g, l); });
      return ORDER.filter((g) => byGroup.has(g)).map((g) => {
        const gsets = byGroup.get(g)!;
        const byEx = new Map<string, StrengthSet[]>();
        gsets.forEach((r) => { const l = byEx.get(r.exercise) || []; l.push(r); byEx.set(r.exercise, l); });
        const exercises: SessExercise[] = [...byEx.entries()].map(([ex, es]) => {
          const sorted = [...es].sort((a, b) => a.set_number - b.set_number);
          const { wm, tm } = exModes(sorted[0].exercise_label, sorted);
          return { exercise: ex, label: sorted[0].exercise_label, sets: sorted, wm, tm };
        });
        // El "volumen en kg" solo tiene sentido en reps con peso. En otros modos
        // no se calcula aquí (se muestra otra cosa en el render).
        const volume = Math.round(gsets.reduce((a, r) => {
          if (r.tracking_mode && r.tracking_mode !== 'reps') return a;
          if (r.weight_mode === 'bodyweight') return a;
          return a + Number(r.weight_kg) * r.reps;
        }, 0));
        return { group: g, exercises, volume };
      });
    };

    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, sets]) => {
        // Partimos por franja. Mañana → tarde → noche → "única" (null) al final.
        const bySlot = new Map<string, StrengthSet[]>();
        sets.forEach((r) => { const k = slotKey(r.session_slot); const l = bySlot.get(k) || []; l.push(r); bySlot.set(k, l); });
        const orderedKeys = [...SLOT_ORDER.map((s) => s as SessionSlot | null), null as SessionSlot | null]
          .filter((s, i, arr) => arr.indexOf(s) === i)
          .filter((s) => bySlot.has(slotKey(s)));
        const slots: DaySlot[] = orderedKeys.map((s) => {
          const slotSets = bySlot.get(slotKey(s))!;
          const groups = buildGroups(slotSets);
          const exerciseCount = groups.reduce((a, g) => a + g.exercises.length, 0);
          const volume = groups.reduce((a, g) => a + g.volume, 0);
          return { slot: s, groups, exerciseCount, groupKeys: groups.map((g) => g.group), volume };
        });
        const exerciseCount = slots.reduce((a, sl) => a + sl.exerciseCount, 0);
        const volume = slots.reduce((a, sl) => a + sl.volume, 0);
        return { date, slots, exerciseCount, volume };
      });
  }, [rows, groupOfRow]);

  // ── Marcas personales, derivadas del histórico completo ──
  // Se calculan sobre `rows` (no sobre lo filtrado): una marca lo es frente a
  // todo tu histórico, no frente a lo que tengas filtrado en pantalla.
  const prs = useMemo(() => computePRs(rows), [rows]);

  // ── Filtros del historial ──
  const [hQuery, setHQuery] = useState('');
  const [hGroup, setHGroup] = useState<GroupKey | 'all'>('all');
  const [hDays, setHDays] = useState<number | null>(null); // null = todo

  // Búsqueda insensible a tildes: "jalon" tiene que encontrar "Jalón al pecho".
  const searchNorm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const filteredSessions = useMemo(() => {
    const needle = searchNorm(hQuery);
    let since = '';
    if (hDays !== null) {
      const d = new Date(); d.setDate(d.getDate() - hDays);
      since = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return sessions
      .filter((s) => hDays === null || s.date >= since)
      .map((s) => {
        // Se filtra DENTRO del día: si un día tiene pecho y pierna y filtras
        // pierna, el día sigue apareciendo pero solo con el bloque de pierna.
        const slots = s.slots.map((sl) => ({
          ...sl,
          groups: sl.groups
            .filter((g) => hGroup === 'all' || g.group === hGroup)
            .map((g) => ({
              ...g,
              exercises: g.exercises.filter((ex) => !needle || searchNorm(ex.label).includes(needle)),
            }))
            .filter((g) => g.exercises.length > 0),
        })).filter((sl) => sl.groups.length > 0);
        const exerciseCount = slots.reduce((a, sl) => a + sl.groups.reduce((b, g) => b + g.exercises.length, 0), 0);
        return { ...s, slots, exerciseCount };
      })
      .filter((s) => s.slots.length > 0);
  }, [sessions, hQuery, hGroup, hDays]);

  const historyFiltered = hQuery.trim() !== '' || hGroup !== 'all' || hDays !== null;

  // Franjas ocupadas por día — se pasa al form para deshabilitar/proponer libre.
  const slotsByDate = useMemo<Record<string, SessionSlot[]>>(() => {
    const m: Record<string, Set<SessionSlot>> = {};
    rows.forEach((r) => {
      if (!r.session_slot) return;
      (m[r.session_date] = m[r.session_date] || new Set()).add(r.session_slot);
    });
    const out: Record<string, SessionSlot[]> = {};
    Object.keys(m).forEach((d) => { out[d] = [...m[d]]; });
    return out;
  }, [rows]);

  // ── Estado por grupo muscular para el mapa: entrenado hoy / esta semana ──
  const MAP_GROUPS: MapGroup[] = ['chest', 'shoulders', 'biceps', 'triceps', 'back', 'core', 'legs'];
  const groupStatus = useMemo(() => {
    const today = todayISO();
    const wk = new Date(); const day = wk.getDay() === 0 ? 6 : wk.getDay() - 1;
    wk.setDate(wk.getDate() - day); wk.setHours(0, 0, 0, 0);
    const weekStart = `${wk.getFullYear()}-${String(wk.getMonth() + 1).padStart(2, '0')}-${String(wk.getDate()).padStart(2, '0')}`;
    const st = {} as Record<MapGroup, TrainState>;
    MAP_GROUPS.forEach((g) => { st[g] = 'none'; });
    rows.forEach((r) => {
      const g = groupOfRow(r) as MapGroup;
      if (!MAP_GROUPS.includes(g)) return;
      if (r.session_date === today) st[g] = 'today';
      else if (r.session_date >= weekStart && st[g] === 'none') st[g] = 'week';
    });
    return st;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, groupOfRow]);

  // ── Volumen semanal por grupo muscular (últimos 7 días) ──
  // Suma DE SERIES por grupo primario. Sin umbrales ni valoraciones: solo el
  // dato bruto para que el usuario vea qué está cubriendo y qué no.
  const weekSetsByGroup = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7); cutoff.setHours(0, 0, 0, 0);
    const cutoffISO = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const counts = {} as Record<GroupKey, number>;
    ORDER.forEach((g) => { counts[g] = 0; });
    // Las bajadas de una serie descendente NO son series aparte: si contaran,
    // un dropset de tres bajadas inflaría el volumen semanal a cuatro series.
    rows.forEach((r) => {
      if (r.session_date < cutoffISO) return;
      if (isDropStep(r)) return;
      counts[groupOfRow(r)]++;
    });
    // Ordenar de más a menos, y los de 0 al final.
    const entries: [GroupKey, number][] = ORDER.map((g) => [g, counts[g]]);
    entries.sort((a, b) => {
      if (a[1] === 0 && b[1] > 0) return 1;
      if (b[1] === 0 && a[1] > 0) return -1;
      return b[1] - a[1];
    });
    const max = Math.max(1, ...entries.map(([, n]) => n));
    return { entries, max };
  }, [rows, groupOfRow]);

  const agoLabel = useCallback((d: string) => {
    const days = Math.floor((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000);
    if (days <= 0) return t('mc_str_today');
    if (days === 1) return t('mc_str_yesterday');
    return t('mc_str_days_ago', { n: days });
  }, [t]);

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  // Historial por ejercicio (mejor peso por sesión, desc) para el desplegable.
  const historyOf = useCallback((exKey: string) => {
    const byDate = new Map<string, number>();
    rows.filter((r) => r.exercise === exKey).forEach((r) => byDate.set(r.session_date, Math.max(byDate.get(r.session_date) ?? 0, Number(r.weight_kg))));
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 5);
  }, [rows]);

  // Para que la sesión de fuerza aparezca también en la Agenda del día.
  const logToAgenda = async (sessionDate: string, exerciseLabels: string[]) => {
    await supabase.from('training_sessions').insert({
      fighter_profile_id: profile.id, session_date: sessionDate, session_type: 'fuerza',
      duration_min: null, intensity: 3, notes: exerciseLabels.join(', ').slice(0, 280),
    });
  };


  // Reconstruye una sesión guardada (día + franja) para editarla en el
  // formulario. Los ejercicios libres que no casan con la biblioteca caen a
  // "full_body" (el form necesita un grupo válido, sin 'other').
  const buildSessionFrom = (date: string, slot: SessionSlot | null): EditSession | null => {
    const slotRows = rows.filter((r) => r.session_date === date && (r.session_slot ?? null) === slot);
    if (slotRows.length === 0) return null;
    const mgOf = (r: StrengthSet): MuscleGroup =>
      (r.muscle_group && (MUSCLE_GROUPS as string[]).includes(r.muscle_group)
        ? (r.muscle_group as MuscleGroup)
        : (muscleGroupOf(r.exercise_label) || 'full_body'));
    const byGroup = new Map<MuscleGroup, Map<string, StrengthSet[]>>();
    slotRows.forEach((r) => {
      const g = mgOf(r);
      if (!byGroup.has(g)) byGroup.set(g, new Map());
      const byEx = byGroup.get(g)!;
      byEx.set(r.exercise, [...(byEx.get(r.exercise) || []), r]);
    });
    const blocks = MUSCLE_GROUPS.filter((g) => byGroup.has(g)).map((g) => ({
      group: g,
      exercises: [...byGroup.get(g)!.values()].map((sets) => {
        const sorted = [...sets].sort((a, b) => a.set_number - b.set_number);
        const txt = (r: StrengthSet) => ({
          reps: r.reps_max && r.reps_max > r.reps ? `${r.reps}-${r.reps_max}` : String(r.reps),
          weight: Number(r.weight_kg) > 0 ? String(Number(r.weight_kg)) : '',
        });
        return {
          label: sorted[0].exercise_label,
          note: sorted.map((r) => (r.notes || '').trim()).find((n) => n !== '') || undefined,
          machine: sorted.map((r) => (r.machine_label || '').trim()).find((m) => m !== '') || undefined,
          // Agrupado por serie: las bajadas vuelven al formulario como bajadas.
          sets: groupSeries(sorted).map((se) => ({
            ...txt(se.main),
            drops: se.drops.length ? se.drops.map(txt) : undefined,
          })),
        };
      }),
    }));
    return { date, slot, blocks };
  };

  const openEdit = (date: string, slot: SessionSlot | null) => {
    const built = buildSessionFrom(date, slot);
    if (!built) return;
    setEditCtx({ date, slot });
    setEditData(built);
    setDuplicateData(undefined);
    setFormInitialGroup(undefined);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  /** Repetir una sesión anterior tal cual, con la fecha llevada a hoy. */
  const openDuplicate = (date: string, slot: SessionSlot | null) => {
    const built = buildSessionFrom(date, slot);
    if (!built) return;
    setEditCtx(null);
    setEditData(undefined);
    setDuplicateData({ ...built, date: todayISO(), slot: null });
    setFormInitialGroup(undefined);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const saveSession = async (session: BuiltSession) => {
    // reps_max = null cuando la serie es "8" (fijo); = 10 cuando es "8-10".
    // Solo se envía si la fila NEW lo trae; la degradación por si la
    // migración 0026 aún no está aplicada vive más abajo.
    // Una serie descendente NO son varias series: es una sola con bajadas de
    // peso encadenadas. Se sigue guardando una fila por escalón (así el volumen
    // levantado sale solo y no hay que tocar el modelo), pero todos los
    // escalones comparten `set_number` y se numeran con `drop_step` 1, 2, 3…
    // Sin la migración 0047 el fallback de abajo los guarda como series
    // sueltas: el dato sigue siendo correcto, solo se pierde la agrupación.
    const base = session.blocks.flatMap((b) =>
      b.exercises.flatMap((e) => e.sets.flatMap((s, i) => {
        const common = {
          fighter_profile_id: profile.id,
          exercise: normalize(e.label),
          exercise_label: e.label.trim(),
          session_date: session.date,
          set_number: i + 1,
          muscle_group: b.group,
          session_slot: session.slot,
          weight_mode: e.weightMode ?? 'total',
          tracking_mode: e.trackingMode ?? 'reps',
          machine_label: e.machine ?? null,
        };
        const hasDrops = !!s.drops && s.drops.length > 0;
        const rows = [{
          ...common,
          reps: s.reps,
          reps_max: s.repsMax ?? null,
          weight_kg: s.weight,
          drop_step: hasDrops ? 1 : null,
          // La nota va solo en la 1ª serie: es del ejercicio, no de cada serie.
          // `notes` viene de la migración 0014, así que existe siempre que
          // exista la tabla (no necesita el fallback de isMissingColumn).
          notes: i === 0 ? (e.note ?? null) : null,
        }];
        (s.drops || []).forEach((d, di) => rows.push({
          ...common,
          reps: d.reps,
          reps_max: d.repsMax ?? null,
          weight_kg: d.weight,
          drop_step: di + 2,
          notes: null,
        }));
        return rows;
      })),
    );
    if (base.length === 0) return;

    /**
     * Inserta quitando SOLO las columnas que esta base no tenga.
     *
     * Antes un único reintento tiraba TODAS las opcionales: bastaba con que
     * faltara una (p. ej. session_slot de la 0033) para guardar filas peladas
     * y perder grupo muscular, rango de repeticiones y modos de peso que la
     * base sí admitía. Ahora se quita exactamente la que falta y se reintenta.
     */
    const insertDegrading = () => writeDroppingMissingColumns(
      base,
      (rows) => supabase.from('strength_sets').insert(rows).select(),
      ['fighter_profile_id', 'exercise', 'exercise_label', 'session_date', 'set_number', 'reps', 'weight_kg'],
    ).then(({ result }) => result);

    // ── Edición: se reemplazan las filas de la sesión original ──
    // Se borran las de editCtx (día+franja de partida) y se insertan las nuevas
    // en session.date/slot (que el usuario puede haber cambiado en el form).
    if (editCtx) {
      const oldIds = rows
        .filter((r) => r.session_date === editCtx.date && (r.session_slot ?? null) === editCtx.slot)
        .map((r) => r.id);
      setSaving(true);
      const del = await supabase.from('strength_sets').delete().in('id', oldIds);
      if (del.error) { setSaving(false); showToast(t('error_save'), 'error'); return; }
      const ins = await insertDegrading();
      setSaving(false);
      if (ins.error || !ins.data) { showToast(t('error_save'), 'error'); load(); return; }
      const inserted = (ins.data as StrengthSet[]).map((r) => ({ ...r, reps_max: r.reps_max ?? null, muscle_group: r.muscle_group ?? null, session_slot: r.session_slot ?? null, weight_mode: r.weight_mode ?? null, tracking_mode: r.tracking_mode ?? null }));
      setRows((prev) => [...inserted, ...prev.filter((r) => !oldIds.includes(r.id))]);
      setShowForm(false);
      setFormKey((k) => k + 1);
      setEditCtx(null);
      setEditData(undefined);
      showToast(t('mc_str_session_updated'));
      void reconcileDayTicks(profile.id, editCtx.date)
        .then(() => (session.date !== editCtx.date ? reconcileDayTicks(profile.id, session.date) : null))
        .then(() => onLogged?.());
      return;
    }

    // ── Detección de récord personal antes de insertar ──
    // Se compara cada peso nuevo con el máximo histórico del mismo ejercicio.
    // Solo se marca PR si el histórico ya existía (evita "PR" en la 1ª sesión).
    const bestByExercise = new Map<string, number>();
    rows.forEach((r) => {
      const cur = bestByExercise.get(r.exercise) ?? 0;
      if (Number(r.weight_kg) > cur) bestByExercise.set(r.exercise, Number(r.weight_kg));
    });
    // Solo cuenta PR en modo reps con peso: en tiempo/distancia/peso corporal
    // no hay "más peso que la última vez".
    const isPR = base.some((s) => {
      if (s.tracking_mode !== 'reps' || s.weight_mode === 'bodyweight') return false;
      const prev = bestByExercise.get(s.exercise);
      return prev !== undefined && prev > 0 && s.weight_kg > prev;
    });

    setSaving(true);
    const { data, error } = await insertDegrading();
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }

    const inserted = (data as StrengthSet[]).map((r) => ({ ...r, reps_max: r.reps_max ?? null, muscle_group: r.muscle_group ?? null, session_slot: r.session_slot ?? null, weight_mode: r.weight_mode ?? null, tracking_mode: r.tracking_mode ?? null }));
    setRows((prev) => [...inserted, ...prev]);
    // La sesión está en la BD: solo ahora se tira el borrador local.
    clearDraft(profile.id);
    setShowForm(false);
    setFormKey((k) => k + 1);
    setDuplicateData(undefined);

    const groupNames = session.blocks.map((b) => t(`mc_str_mg_${b.group}`)).join(' + ');
    const exCount = session.blocks.reduce((a, b) => a + b.exercises.length, 0);
    showToast(t('mc_str_session_saved', { groups: groupNames, n: exCount }));
    void logToAgenda(session.date, session.blocks.flatMap((b) => b.exercises.map((e) => e.label)));
    // Tick automático del plan del día: marca los bloques de fuerza que
    // comparten grupo muscular con lo que se acaba de registrar (Tarea 3), y
    // da de alta el bloque si el entreno no estaba planificado.
    //
    // El aviso a las tarjetas de "hoy toca" va DESPUÉS de que esto termine: si
    // se avisara antes, volverían a leer la Agenda sin el tick puesto y
    // seguirían enseñando como pendiente lo que se acaba de hacer.
    void reconcileDayTicks(profile.id, session.date).then(() => onLogged?.());

    // Marca personal: destello único de 600 ms sin loop.
    if (isPR) {
      setShowPRFlash(true);
      setTimeout(() => setShowPRFlash(false), 650);
    }
  };

  const deleteSession = async (date: string) => {
    const ids = rows.filter((r) => r.session_date === date).map((r) => r.id);
    setRows((prev) => prev.filter((r) => r.session_date !== date));
    setConfirmDel(null);
    const { error } = await supabase.from('strength_sets').delete().in('id', ids);
    if (error) { showToast(t('error_save'), 'error'); load(); return; }
    // Borrar una sesión también cambia lo que toca hoy: `reconcileDayTicks`
    // retira el bloque que se había creado solo y el día vuelve a estar
    // pendiente. Sin esto, la Agenda seguiría diciendo que entrenaste.
    void reconcileDayTicks(profile.id, date).then(() => onLogged?.());
  };

  // Esqueleto con la forma de la pantalla en vez de una ruedecita: se ve
  // enseguida que va a haber cabecera, mapa y sesiones, y nada salta de sitio
  // cuando llegan los datos.
  if (loading) {
    return (
      <div className="rk-blocks max-w-3xl">
        <SkeletonBox height={96} radius={20} />
        {!hideSummaryBlocks && <SkeletonBox height={260} radius={20} />}
        <SkeletonList rows={4} />
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-hammer-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  const groupLabels = (keys: GroupKey[]) => keys.map((g) => t(`mc_str_mg_${g}`)).join(' + ');

  return (
    <div className="rk-blocks max-w-3xl">
      {/* Cabecera hero */}
      <SectionHero kind="strength" eyebrow={t('mc_str_eyebrow')}
        title={`${t('mc_str_title')} ${t('mc_str_title_2')}`}
        subtitle={rows.length ? t('mc_str_hero_sub', { n: sessions.length }) : undefined}
        action={hideRegisterCta ? undefined : (
          // Con plan para hoy, el botón dice QUÉ vas a registrar y entra
          // directo con esos grupos. Sin plan, el botón genérico de siempre.
          plannedToday.length > 0
            ? { label: t('mc_str_register_planned', { groups: plannedLabel }), icon: 'ri-play-fill', onClick: () => openFormForPlan(plannedToday) }
            : { label: t('mc_str_new'), icon: 'ri-add-line', onClick: () => openForm() }
        )} />

      {rows.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '48px 28px' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-hammer-line text-3xl text-zinc-600"></i>
          </div>
          <p className="text-white font-bold">{t('mc_str_empty')}</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{t('mc_str_empty_desc')}</p>
          {!hideRegisterCta && (
            <button onClick={() => openForm()} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem', padding: '0.7rem 1.6rem' }}>
              {t('mc_str_new')}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── MAPA MUSCULAR: selector de grupo, abre el formulario al tocar ── */}
          {!hideSummaryBlocks && <MuscleMap status={groupStatus} onSelect={(g) => openForm(g)} />}

          {/* ── VOLUMEN SEMANAL POR GRUPO (últimos 7 días) ──
              Solo el dato bruto, sin marcar bueno/malo. */}
          {!hideSummaryBlocks && rows.length > 0 && (
            <div className="rk-card" style={{ padding: 20 }}>
              <p className="rk-label mb-3">{t('mc_str_wk_vol_title')}</p>
              <div className="space-y-2">
                {weekSetsByGroup.entries.map(([g, n]) => {
                  const pct = n === 0 ? 0 : Math.round((n / weekSetsByGroup.max) * 100);
                  const zero = n === 0;
                  return (
                    <div key={g} className="flex items-center gap-3">
                      <span className="w-20 flex-shrink-0 text-xs font-semibold" style={{ color: zero ? 'var(--t-3)' : 'var(--t-2)' }}>{t(`mc_str_mg_${g}`)}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--s-3)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: zero ? 'transparent' : 'var(--accent)' }} />
                      </div>
                      <span className="w-8 flex-shrink-0 text-right" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: zero ? 'var(--t-3)' : 'var(--gold)' }}>
                        {n}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── HISTORIAL POR DÍAS ── */}
          {!hideHistory && (
          <div>
            <h3 className="rk-label mb-3">{t('mc_str_history')}</h3>

            {/* Filtros: búsqueda de ejercicio + grupo + periodo */}
            <div className="space-y-2 mb-4">
              <input value={hQuery} onChange={(e) => setHQuery(e.target.value)}
                placeholder={t('mc_str_h_search_ph')} aria-label={t('mc_str_h_search_ph')}
                style={{ fontSize: 16, minHeight: 44 }}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
              <div className="flex gap-1.5 overflow-x-auto pb-1 rk-noscroll-x" role="group" aria-label={t('mc_str_h_filter_group')}>
                <button onClick={() => setHGroup('all')} aria-pressed={hGroup === 'all'} style={{ minHeight: 36 }}
                  className={`rk-nav-btn text-xs font-bold whitespace-nowrap ${hGroup === 'all' ? 'is-active' : ''}`} >
                  {t('mc_exlib_all')}
                </button>
                {ORDER.filter((g) => rows.some((r) => groupOfRow(r) === g)).map((g) => (
                  <button key={g} onClick={() => setHGroup(g)} aria-pressed={hGroup === g} style={{ minHeight: 36 }}
                    className={`rk-nav-btn text-xs font-bold whitespace-nowrap ${hGroup === g ? 'is-active' : ''}`}>
                    {g === 'other' ? t('mc_str_mg_other') : t(`mc_str_mg_${g}`)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[{ d: 30, k: 'mc_str_h_30d' }, { d: 90, k: 'mc_str_h_90d' }, { d: null, k: 'mc_sp_period_all' }].map((p) => (
                  <button key={String(p.d)} onClick={() => setHDays(p.d)} aria-pressed={hDays === p.d} style={{ minHeight: 32 }}
                    className={`text-xs font-bold px-2.5 rounded-lg cursor-pointer transition-colors ${hDays === p.d ? 'bg-[#E10600] text-white' : 'bg-white/[0.04] text-zinc-400 hover:text-white'}`}>
                    {t(p.k)}
                  </button>
                ))}
                <span className="text-xs ml-auto" style={{ color: 'var(--t-3)' }}>
                  {t('mc_str_h_count', { n: filteredSessions.length })}
                </span>
              </div>
            </div>

            {filteredSessions.length === 0 && historyFiltered && (
              <StateBlock variant="empty" art="search" title={t('mc_str_h_none')}
                action={{ label: t('mc_exlib_clear'), onClick: () => { setHQuery(''); setHGroup('all'); setHDays(null); } }} />
            )}

            <div className="rk-stack">
              {filteredSessions.map((s, i) => {
                const isOpen = openDay === s.date;
                const hasSlots = s.slots.some((sl) => sl.slot !== null);
                return (
                  <Reveal key={s.date} delay={Math.min(i, 6) * 40}>
                    <div className="rk-card" style={{ padding: 0, overflow: 'hidden' }}>
                      {/* Cabecera del día */}
                      <button onClick={() => { setOpenDay(isOpen ? null : s.date); setOpenEx(null); }}
                        className="w-full text-left flex items-center gap-3 px-4 py-3.5 cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white">
                            {fmtDate(s.date)} <span className="text-zinc-500 font-normal">· {agoLabel(s.date)}</span>
                            {s.slots.length > 1 && (
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[#C9A84C] bg-[#C9A84C]/12 border border-[#C9A84C]/30 px-1.5 py-0.5 rounded-full align-middle">
                                {t('mc_str_double_session', { count: s.slots.length })}
                              </span>
                            )}
                          </p>
                          {hasSlots ? (
                            <div className="text-xs text-zinc-400 mt-0.5 space-y-0.5">
                              {s.slots.map((sl, si) => (
                                <p key={si} className="truncate">
                                  <span className="text-zinc-500">↳ </span>
                                  {sl.slot ? <span className="text-[#C9A84C] font-semibold">{t(`mc_str_slot_${sl.slot}`)} · </span> : null}
                                  {groupLabels(sl.groupKeys)} · {t('mc_str_ex_count', { count: sl.exerciseCount })}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-400 mt-0.5 truncate">
                              {groupLabels(s.slots[0]?.groupKeys || [])} · {t('mc_str_ex_count', { count: s.exerciseCount })}
                            </p>
                          )}
                        </div>
                        <i className={`ri-arrow-down-s-line text-zinc-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                      </button>

                      {/* Detalle: una franja tras otra, con sus grupos dentro */}
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-4 border-t border-white/[0.06] pt-3">
                          {s.slots.map((sl, slotIdx) => (
                            <div key={slotIdx} className="space-y-3">
                              {(hasSlots || s.slots.length > 1) && sl.slot && (
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-[#C9A84C]/12 border border-[#C9A84C]/30 text-[#C9A84C]">
                                    <i className={sl.slot === 'morning' ? 'ri-sun-line' : sl.slot === 'afternoon' ? 'ri-sun-cloudy-line' : 'ri-moon-line'} />
                                  </span>
                                  <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#C9A84C]">{t(`mc_str_slot_${sl.slot}`)}</p>
                                </div>
                              )}
                          {sl.groups.map((g) => (
                            <div key={g.group}>
                              <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-red-400 mb-2">{t(`mc_str_mg_${g.group}`)}</p>
                              <div className="space-y-1">
                                {g.exercises.map((ex) => {
                                  const exOpen = openEx === `${s.date}|${ex.exercise}`;
                                  const maxW = Math.max(...ex.sets.map((x) => Number(x.weight_kg)));
                                  const hist = exOpen ? historyOf(ex.exercise) : [];
                                  // Un dropset es UNA serie con bajadas, no tres
                                  // series: se cuenta agrupado o el resumen miente.
                                  const series = groupSeries(ex.sets);
                                  const hasDrops = series.some((se) => se.drops.length > 0);
                                  const machine = ex.sets.map((x) => (x.machine_label || '').trim()).find((m) => m !== '');
                                  const first = series[0].main;
                                  const summary = [
                                    fmtSetCount(series.length, { repsMin: first.reps, repsMax: first.reps_max ?? undefined, value: first.reps, trackingMode: ex.tm }, t),
                                    fmtWeight(maxW, ex.wm, t),
                                  ].filter(Boolean).join(' · ');
                                  const exPRs = prs.get(prKey(s.date, ex.exercise)) || [];
                                  return (
                                    <div key={ex.exercise}>
                                      <button onClick={() => setOpenEx(exOpen ? null : `${s.date}|${ex.exercise}`)}
                                        className="w-full flex items-center gap-3 py-1.5 text-left cursor-pointer group">
                                        <span className="flex-1 min-w-0 text-sm text-zinc-200 truncate group-hover:text-white">
                                          {ex.label}
                                          {exPRs.length > 0 && (
                                            <span className="ml-1.5 align-middle" title={t('mc_pr_badge')} aria-label={t('mc_pr_badge')}>
                                              <i className="ri-trophy-fill text-[11px]" style={{ color: 'var(--accent)' }} />
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-sm font-semibold text-zinc-300 flex-shrink-0" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                          {summary}
                                        </span>
                                        <i className={`ri-arrow-down-s-line text-xs text-zinc-600 flex-shrink-0 transition-transform ${exOpen ? 'rotate-180' : ''}`}></i>
                                      </button>
                                      {exOpen && (
                                        <div className="pl-1 pb-2 space-y-2">
                                          {exPRs.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                              {exPRs.map((p: PRHit, pi) => (
                                                <span key={pi} className="text-[11px] font-semibold px-2 py-1 rounded-lg inline-flex items-center gap-1.5"
                                                  style={{ background: 'var(--accent-dim)', border: '1px solid rgba(225,6,0,0.3)', color: '#fff' }}>
                                                  <i className="ri-trophy-fill" style={{ color: 'var(--accent)' }} />
                                                  {p.kind === 'weight' && t('mc_pr_weight', { v: p.value, prev: p.prev })}
                                                  {p.kind === 'reps_at_weight' && t('mc_pr_reps', { v: p.value, prev: p.prev, w: p.atWeight })}
                                                  {p.kind === 'volume' && t('mc_pr_volume', { v: p.value })}
                                                  {p.kind === 'time' && t('mc_pr_time', { v: p.value })}
                                                  {p.kind === 'distance' && t('mc_pr_distance', { v: p.value })}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          {/* En qué máquina se hizo, si consta */}
                                          {machine && (
                                            <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                                              <i className="ri-settings-3-line text-zinc-600" />{machine}
                                            </p>
                                          )}
                                          {/* Series individuales. Una serie descendente va en
                                              UNA sola etiqueta con sus bajadas encadenadas por
                                              flechas: "8·40kg → 6·30kg → 8·20kg". Suelta se
                                              leería como tres series normales, que es falso. */}
                                          <div className="flex flex-wrap gap-1.5">
                                            {series.map((se) => {
                                              const txt = (st: StrengthSet) => [
                                                fmtSetValue({ repsMin: st.reps, repsMax: st.reps_max ?? undefined, value: st.reps, trackingMode: ex.tm }, t),
                                                fmtWeight(Number(st.weight_kg), ex.wm, t),
                                              ].filter(Boolean).join(' · ');
                                              const isDrop = se.drops.length > 0;
                                              return (
                                                <span key={se.main.id}
                                                  className="text-[11px] font-semibold text-zinc-300 px-2 py-1 rounded-lg inline-flex items-center gap-1"
                                                  style={isDrop
                                                    ? { background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.30)' }
                                                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                                                  {isDrop && <i className="ri-arrow-down-line text-[10px]" style={{ color: '#C9A84C' }} />}
                                                  {txt(se.main)}
                                                  {se.drops.map((d) => (
                                                    <span key={d.id} className="text-zinc-400">→ {txt(d)}</span>
                                                  ))}
                                                </span>
                                              );
                                            })}
                                          </div>
                                          {hasDrops && (
                                            <p className="text-[10px]" style={{ color: '#C9A84C' }}>
                                              <i className="ri-arrow-down-line" /> {t('mc_str_drop_badge')}
                                            </p>
                                          )}
                                          {/* Histórico rápido del ejercicio */}
                                          {hist.length > 1 && (
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">{t('mc_str_last_3')}</span>
                                              {hist.map(([d, w]) => (
                                                <span key={d} className="text-[10px] font-semibold text-zinc-400 bg-white/[0.03] border border-white/10 px-2 py-0.5 rounded-md">
                                                  {new Date(d + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })}: {w}kg
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="text-[11px] text-zinc-600 mt-1.5">
                                {t('mc_str_vol_group', { group: t(`mc_str_mg_${g.group}`) })}: {groupVolumeLabel(g, t, locale)}
                              </p>
                            </div>
                          ))}
                              {/* Editar / repetir esta sesión (día + franja) */}
                              <div className="flex items-center gap-4 pt-1 flex-wrap">
                                <button onClick={() => openEdit(s.date, sl.slot)} style={{ minHeight: 36 }}
                                  className="text-xs text-zinc-500 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors">
                                  <i className="ri-pencil-line"></i>{t('mc_str_edit_session')}
                                </button>
                                <button onClick={() => openDuplicate(s.date, sl.slot)} style={{ minHeight: 36 }}
                                  className="text-xs text-zinc-500 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors">
                                  <i className="ri-file-copy-line"></i>{t('mc_str_duplicate_session')}
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Borrar sesión (con confirmación) */}
                          <div className="pt-1">
                            {confirmDel === s.date ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400 flex-1">{t('mc_str_delete_confirm')}</span>
                                <button onClick={() => setConfirmDel(null)} className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 cursor-pointer">{t('mc_cancel')}</button>
                                <button onClick={() => deleteSession(s.date)} className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg cursor-pointer">{t('mc_delete')}</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDel(s.date)}
                                className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1.5 cursor-pointer transition-colors">
                                <i className="ri-delete-bin-line"></i>{t('mc_str_delete_session')}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
          )}

          {hideHistory && onSeeHistory && (
            <button onClick={onSeeHistory}
              className="text-xs text-zinc-400 hover:text-white cursor-pointer inline-flex items-center gap-1.5">
              <i className="ri-history-line" />{t('mc_strs_see_all')}
            </button>
          )}
        </>
      )}

      {/* Formulario de registro (3 pasos). key = remonta y limpia tras guardar.
          Con initialSession abre en modo edición (paso 2, pre-relleno). */}
      <StrengthSessionForm
        key={formKey}
        open={showForm}
        onClose={() => { setShowForm(false); setEditCtx(null); setEditData(undefined); setDuplicateData(undefined); }}
        saving={saving}
        onSave={saveSession}
        ownExercises={ownExercises}
        fighterProfileId={profile.id}
        showToast={showToast}
        slotsByDate={slotsByDate}
        initialGroup={formInitialGroup}
        initialGroups={formInitialGroups}
        initialDate={initialDate}
        initialSession={editData}
        duplicateFrom={duplicateData}
      />

      {/* Signature moment: destello full-screen al batir marca. Se desmonta
          solo tras 650 ms (setShowPRFlash), por lo que no hay loop posible. */}
      {showPRFlash && <div className="rk-pr-flash" aria-hidden />}

      <style>{`
        .rk-noscroll-x::-webkit-scrollbar { display: none; }
        .rk-noscroll-x { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
