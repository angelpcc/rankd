import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { isMissingColumn } from '@/lib/dbState';
import BottomSheet from '@/components/base/BottomSheet';
import VoiceButton from '@/components/feature/VoiceButton';
import { parseStrengthSessionFromSpeech } from '@/lib/dictation';
import {
  MUSCLE_GROUPS, exercisesByGroup, exerciseDictationTerms, muscleGroupOf,
  weightModeOf, trackingModeOf, usesBar, equipmentOf, filterExercises, exLabel, focusesForGroup,
  type MuscleGroup, type WeightMode, type TrackingMode,
} from '../lib/exercises';
import { hasTechnique } from '../lib/exerciseTechnique';
import type { ExerciseSpec } from '../lib/dayPlan';
import ExerciseTechniqueCard from './ExerciseTechniqueCard';
import PlateCalculator from './PlateCalculator';
import LastPerformanceCard from './LastPerformanceCard';
import { buildLastPerformance, buildSuggestion, type LastPerformance, type Suggestion, type PerfRow } from '../lib/lastPerformance';
import { loadDraft, saveDraft, clearDraft, type StrengthDraft } from '../lib/strengthDraft';
import { useOnline } from '@/hooks/useOnline';

// ── Sesión construida que se devuelve al padre para guardar ──
// reps = valor bajo/fijo; repsMax = tope del rango (undefined = fijo). En
// tracking_mode 'time'/'distance', `reps` guarda segundos / metros. `weight`
// puede ser 0 (peso corporal, o series sin peso).
// `drops` son los escalones de una serie DESCENDENTE: bajadas de peso
// encadenadas sin descanso dentro de la MISMA serie (40x8 → 30x6 → 20x8).
// Se guardan como filas que comparten set_number, no como series sueltas.
export interface BuiltDrop { reps: number; weight: number; repsMax?: number }
export interface BuiltSet { reps: number; weight: number; repsMax?: number; drops?: BuiltDrop[] }
export interface BuiltExercise {
  label: string; sets: BuiltSet[]; weightMode?: WeightMode; trackingMode?: TrackingMode; note?: string;
  /** Máquina o polea concreta en la que se hizo (texto libre corto). */
  machine?: string;
}
export interface BuiltBlock { group: MuscleGroup; exercises: BuiltExercise[] }

function weightLabelKey(mode: WeightMode): string {
  switch (mode) {
    case 'per_side': return 'mc_str_wlabel_per_side';
    case 'per_dumbbell': return 'mc_str_wlabel_per_dumbbell';
    case 'bodyweight': return 'mc_str_wlabel_bodyweight';
    default: return 'mc_str_wlabel_total';
  }
}
export type SessionSlot = 'morning' | 'afternoon' | 'evening';
// slot = null cuando es la única sesión del día (no molestamos al usuario con
// la franja); solo pedimos franja cuando ya hay otra sesión guardada ese día.
export interface BuiltSession { date: string; blocks: BuiltBlock[]; slot: SessionSlot | null }

// ── Editar una sesión ya guardada ──
// El padre reconstruye esto desde las filas de strength_sets de un día+franja y
// lo pasa como `initialSession`: el formulario abre en el paso 2, pre-relleno,
// y al guardar el padre reemplaza las filas (no crea una sesión nueva).
export interface EditSessionSet {
  reps: string;
  weight: string;
  /** Escalones de la serie descendente, si los tenía. */
  drops?: { reps: string; weight: string }[];
}
export interface EditSessionExercise {
  label: string;
  sets: EditSessionSet[];
  note?: string;
  /** Máquina/polea con la que se registró. */
  machine?: string;
}
export interface EditSessionBlock { group: MuscleGroup; exercises: EditSessionExercise[] }
export interface EditSession { date: string; slot: SessionSlot | null; blocks: EditSessionBlock[] }

/**
 * Parsea el valor del input de reps.
 * Acepta:
 *   "8"        → { reps: 8 }
 *   "8-10"     → { reps: 8, repsMax: 10 }
 *   "8 a 10"   → { reps: 8, repsMax: 10 }
 *   "8 - 10"   → { reps: 8, repsMax: 10 }
 * Devuelve null si no se puede parsear o el rango es inválido (min > max).
 */
export function parseRepsInput(raw: string): { reps: number; repsMax?: number } | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  // Rango: "8-10", "8 - 10", "8 a 10", "8 to 10"
  const range = s.match(/^(\d+)\s*(?:-|–|a|to)\s*(\d+)$/);
  if (range) {
    const lo = parseInt(range[1], 10);
    const hi = parseInt(range[2], 10);
    if (!lo || !hi || lo <= 0 || hi <= 0 || hi < lo) return null;
    return lo === hi ? { reps: lo } : { reps: lo, repsMax: hi };
  }
  const single = s.match(/^(\d+)$/);
  if (single) {
    const n = parseInt(single[1], 10);
    return n > 0 ? { reps: n } : null;
  }
  return null;
}

// ── Estado editable interno (inputs como texto) ──
interface FSet {
  reps: string;
  weight: string;
  /** Escalones de una serie descendente. undefined = serie normal. */
  drops?: { reps: string; weight: string }[];
}
interface FExercise {
  id: string; label: string; query: string; open: boolean; sets: FSet[];
  techOpen?: boolean; note?: string; noteOpen?: boolean;
  /** Máquina/polea concreta. Solo se pide en ejercicios de polea o máquina. */
  machine?: string;
  /** Zona elegida en el buscador de ejercicios ('all' = sin acotar). */
  zone?: string;
  machineOpen?: boolean;
}
interface FBlock { group: MuscleGroup; exercises: FExercise[] }

const uid = () => Math.random().toString(36).slice(2, 9);
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

// Normaliza el nombre de máquina para comparar. Vacío, null y undefined son lo
// MISMO ("sin especificar"): esas series se comparan entre ellas, como antes de
// que existiera el campo.
const normMachine = (s?: string | null): string => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  saving: boolean;
  /** Guarda la sesión completa. */
  onSave: (session: BuiltSession) => void;
  /** Ejercicios que el usuario ya ha registrado, para sugerir en su grupo. */
  ownExercises: { label: string; group: MuscleGroup | 'other' }[];
  /** Para sugerir peso/series del último registro de cada ejercicio. */
  fighterProfileId: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /**
   * Franjas ya usadas por día (YYYY-MM-DD → slots ocupadas). Cuando este
   * día tiene al menos una sesión, mostramos el selector de franja y elegimos
   * por defecto la siguiente libre en el orden mañana→tarde→noche.
   */
  slotsByDate?: Record<string, SessionSlot[]>;
  /**
   * Grupo con el que abrir ya elegido (viene de tocar el muñeco muscular):
   * salta directo al paso 2 con ese bloque puesto, sin pasar por el selector
   * de grupos. undefined = flujo normal (paso 1, elegir grupo(s) a mano).
   */
  initialGroup?: MuscleGroup;
  /**
   * Grupos con los que abrir, en bloque. Es lo que usa "Registrar pecho y
   * espalda" cuando ese día hay un entreno planificado: se salta el paso de
   * elegir grupos porque YA los elegiste al planificar. Tiene prioridad sobre
   * `initialGroup`, que solo admite uno (viene del muñeco muscular).
   */
  initialGroups?: MuscleGroup[];
  /**
   * Ejercicios PLANIFICADOS para ese día, con sus series y repes.
   *
   * Vienen del bloque de la Agenda. Si planificaste "pecho y espalda" con seis
   * ejercicios, el formulario se abre con esos seis puestos y solo hay que
   * rellenar el peso real: escribirlos otra vez era repetir a mano lo que ya
   * habías escrito al planificar. Si no planificaste ejercicios, no llega nada
   * y el formulario sale vacío, como siempre.
   */
  initialExercises?: ExerciseSpec[];
  /**
   * Día con el que abrir. Lo manda quien viene a resolver un bloque de la
   * Agenda de OTRO día: sin esto el formulario arrancaba siempre en hoy y ese
   * entreno se guardaba con la fecha equivocada, en silencio.
   * Solo se usa en altas nuevas: al editar manda la fecha de la sesión.
   */
  initialDate?: string;
  /**
   * Sesión existente a editar (día+franja). Abre en el paso 2 con todo
   * pre-relleno; al guardar, el padre reemplaza las filas en vez de crear una
   * sesión nueva. undefined = alta normal.
   */
  initialSession?: EditSession;
  /**
   * Sesión anterior de la que partir para crear una NUEVA (duplicar). Igual que
   * `initialSession` en cuanto a pre-relleno, pero se guarda como alta normal
   * y la fecha se lleva a hoy: repetir el entreno de ayer no debe reescribirlo.
   */
  duplicateFrom?: EditSession;
}

const SLOT_ORDER: SessionSlot[] = ['morning', 'afternoon', 'evening'];

const uidLocal = () => Math.random().toString(36).slice(2, 9);
/**
 * Bloques de partida a partir de lo PLANIFICADO para el día.
 *
 * Cada ejercicio del plan entra con sus series ya creadas y las repes puestas;
 * el peso se deja en blanco a propósito, porque es lo único que de verdad se
 * decide en el gimnasio. Los grupos sin ejercicios planificados entran vacíos,
 * igual que antes.
 *
 * Si un ejercicio pertenece a un grupo que no estaba en el plan (pasa cuando el
 * plan solo nombraba ejercicios), se le crea su bloque: perderlo sería tirar
 * justo el trabajo que se venía a ahorrar.
 */
function blocksFromPlan(groups: MuscleGroup[], specs?: ExerciseSpec[]): FBlock[] {
  const out: FBlock[] = groups.map((g) => ({ group: g, exercises: [] as FExercise[] }));
  for (const s of specs || []) {
    const name = (s.name || '').trim();
    if (!name) continue;
    const g = (muscleGroupOf(name) || groups[0] || 'other') as MuscleGroup;
    let block = out.find((b) => b.group === g);
    if (!block) { block = { group: g, exercises: [] }; out.push(block); }
    const reps = s.reps_min && s.reps_min > 0
      ? (s.reps_max && s.reps_max > s.reps_min ? `${s.reps_min}-${s.reps_max}` : String(s.reps_min))
      : (s.value && s.value > 0 ? String(s.value) : '10');
    block.exercises.push({
      id: uidLocal(), label: name, query: '', open: false,
      sets: Array.from({ length: Math.max(1, s.sets || 1) }, () => ({
        reps,
        // El peso prescrito se propone si lo trae; si no, en blanco.
        weight: s.weight_kg && s.weight_kg > 0 ? String(s.weight_kg) : '',
      })),
    });
  }
  return out;
}

function blocksFromEdit(s: EditSession): FBlock[] {
  return s.blocks.map((b) => ({
    group: b.group,
    exercises: b.exercises.map((e) => ({
      id: uidLocal(), label: e.label, query: '', open: false, note: e.note || undefined,
      machine: e.machine || undefined,
      // Se conservan los escalones: editar una sesión con series descendentes
      // no debe convertirlas en series sueltas.
      sets: e.sets.map((st) => ({
        reps: st.reps,
        weight: st.weight,
        drops: st.drops?.map((d) => ({ reps: d.reps, weight: d.weight })),
      })),
    })),
  }));
}

function blocksFromDraft(d: StrengthDraft): FBlock[] {
  return d.blocks
    .filter((b) => (MUSCLE_GROUPS as string[]).includes(b.group))
    .map((b) => ({
      group: b.group as MuscleGroup,
      exercises: b.exercises.map((e) => ({
        id: uidLocal(), label: e.label, query: '', open: false, note: e.note || undefined,
        sets: e.sets.map((st) => ({ reps: st.reps, weight: st.weight })),
      })),
    }));
}

interface ExPerf { perf: LastPerformance; suggestion: Suggestion; tracking: TrackingMode }

export default function StrengthSessionForm({ open, onClose, saving, onSave, ownExercises, fighterProfileId, showToast, slotsByDate, initialGroup, initialGroups, initialExercises, initialDate, initialSession, duplicateFrom }: Props) {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';
  // Términos de reconocimiento, no solo los nombres: incluyen la forma sin el
  // paréntesis del equipo y los alias antiguos, que es como se dicta de verdad.
  const library = useMemo(() => exerciseDictationTerms(lang), [lang]);
  const prefill = initialSession ?? duplicateFrom;

  // Grupos con los que arrancar: los del plan del día si vienen, si no el del
  // muñeco muscular. Con cualquiera de los dos se salta el paso 1.
  const startGroups: MuscleGroup[] = (initialGroups && initialGroups.length > 0)
    ? initialGroups
    : (initialGroup ? [initialGroup] : []);

  const [step, setStep] = useState<1 | 2>(prefill || startGroups.length > 0 ? 2 : 1);
  // Al editar manda la fecha de la sesión; si no, la que pida quien abre el
  // formulario (un bloque de la Agenda de otro día); y en último término, hoy.
  const [date, setDate] = useState(initialSession?.date ?? initialDate ?? todayISO());
  const [blocks, setBlocks] = useState<FBlock[]>(
    prefill ? blocksFromEdit(prefill)
      : startGroups.map((g) => ({ group: g, exercises: [] as FExercise[] })),
  );
  const [freeText, setFreeText] = useState('');
  const [interpreted, setInterpreted] = useState(false);
  // Franja elegida. null = "sesión única del día" (implícito, no se pide).
  const [slot, setSlot] = useState<SessionSlot | null>(initialSession?.slot ?? null);
  const [plateFor, setPlateFor] = useState<{ group: MuscleGroup; id: string; si: number } | null>(null);
  const [perfByEx, setPerfByEx] = useState<Record<string, ExPerf>>({});
  const online = useOnline();

  // ── Borrador local ──
  // `pendingDraft` = borrador encontrado al abrir, aún sin decidir. Mientras
  // esté puesto se muestra la banda "tienes un entreno sin terminar" y NO se
  // autoguarda (para no pisarlo con el formulario vacío).
  const [pendingDraft, setPendingDraft] = useState<StrengthDraft | null>(null);
  const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draftAt, setDraftAt] = useState<number | null>(null);
  // Editar y duplicar parten de datos ya guardados: ahí el borrador estorba.
  const draftEnabled = !initialSession && !duplicateFrom;

  useEffect(() => {
    if (!open || !draftEnabled) return;
    // Solo al abrir: si dependiera de `blocks`, la banda reaparecería al teclear.
    const d = loadDraft(fighterProfileId);
    if (d) setPendingDraft(d);
  }, [open, draftEnabled, fighterProfileId]);

  const resumeDraft = () => {
    if (!pendingDraft) return;
    setBlocks(blocksFromDraft(pendingDraft));
    if (pendingDraft.date) setDate(pendingDraft.date);
    setSlot(pendingDraft.slot);
    setStep(2);
    setPendingDraft(null);
  };

  const discardDraft = () => {
    clearDraft(fighterProfileId);
    setPendingDraft(null);
    setDraftState('idle');
    setDraftAt(null);
  };

  // Autoguardado con rebote: escribir en cada pulsación sería un write por
  // tecla; 800 ms basta para no perder nada real si se cierra la app.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open || !draftEnabled || pendingDraft) return;
    const hasContent = blocks.some((b) => b.exercises.some((e) => e.label.trim() !== ''));
    if (!hasContent) return;
    setDraftState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const ok = saveDraft(fighterProfileId, {
        date,
        slot,
        blocks: blocks.map((b) => ({
          group: b.group,
          exercises: b.exercises.map((e) => ({ label: e.label, note: e.note, sets: e.sets })),
        })),
      });
      setDraftState(ok ? 'saved' : 'idle');
      if (ok) setDraftAt(Date.now());
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [blocks, date, slot, open, draftEnabled, pendingDraft, fighterProfileId]);

  // Última vez que se registró un ejercicio: guarda el rendimiento previo para
  // pintar la tarjeta. Ya NO pre-rellena solo: el usuario decide con un botón.
  const applyHistory = async (group: MuscleGroup, id: string, name: string, machine?: string) => {
    const key = norm(name);
    if (!key) return;
    // 200 filas cubren un histórico largo del mismo ejercicio sin traer la
    // tabla entera; el índice (fighter, exercise, date desc) lo resuelve bien.
    const q = (cols: string) => supabase.from('strength_sets')
      .select(cols)
      .eq('fighter_profile_id', fighterProfileId).eq('exercise', key)
      .order('session_date', { ascending: false }).limit(200);

    let res = await q('session_date, reps, reps_max, weight_kg, notes, machine_label, drop_step');
    // Si la migración 0047 no está aplicada, se pide sin las columnas nuevas:
    // se pierde el filtro por máquina, no la tarjeta entera.
    if (isMissingColumn(res.error)) res = await q('session_date, reps, reps_max, weight_kg, notes');
    let rows = (res.data || []) as unknown as PerfRow[];
    // Comparar 18 kg de una polea con 30 kg de otra no significa nada, así que
    // "la última vez" solo mira series de la MISMA máquina. Sin máquina puesta
    // se comparan entre sí las que tampoco la tienen.
    const wanted = normMachine(machine);
    rows = rows.filter((r) => normMachine(r.machine_label) === wanted);
    // Los escalones de un dropset pesan menos por definición; si entraran en la
    // comparación, "la última vez" parecería siempre peor de lo que fue.
    rows = rows.filter((r) => !r.drop_step || r.drop_step === 1);
    const perf = buildLastPerformance(rows);
    if (!perf) { setPerfByEx((prev) => { const n = { ...prev }; delete n[id]; return n; }); return; }
    const tracking = trackingModeOf(name);
    const suggestion = buildSuggestion(perf, tracking, weightModeOf(name));
    setPerfByEx((prev) => ({ ...prev, [id]: { perf, suggestion, tracking } }));
  };

  /** Pone en el ejercicio las series de la última vez (opcionalmente con más carga). */
  const applySuggestion = (group: MuscleGroup, id: string, stepUp: boolean) => {
    const entry = perfByEx[id];
    if (!entry) return;
    const { suggestion } = entry;
    const sets = suggestion.sets.map((s) => ({
      reps: s.reps,
      weight: stepUp && suggestion.nextWeight !== null ? String(suggestion.nextWeight) : s.weight,
    }));
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id ? { ...e, sets } : e) }
      : b));
  };

  // Franjas ya usadas ese día. Si hay alguna, mostramos el selector de franja
  // y proponemos por defecto la siguiente libre.
  const usedSlots = (slotsByDate && slotsByDate[date]) || [];
  const dayHasSession = usedSlots.length > 0;
  const nextFreeSlot: SessionSlot = SLOT_ORDER.find((s) => !usedSlots.includes(s)) || 'evening';
  // Al abrir la sesión (o cambiar el día), si el día ya tiene sesión, elegimos
  // la próxima franja libre. Si no, dejamos null (no se pide franja). Al editar
  // respetamos la franja original (initialSession.slot) y no la tocamos.
  useMemo(() => {
    if (!open || initialSession) return;
    setSlot(dayHasSession ? nextFreeSlot : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, dayHasSession]);

  const selectedGroups = useMemo(() => new Set(blocks.map((b) => b.group)), [blocks]);

  const resetAll = () => {
    setStep(1); setDate(todayISO()); setBlocks([]); setFreeText(''); setInterpreted(false); setSlot(null);
    setPerfByEx({}); setPendingDraft(null); setDraftState('idle'); setDraftAt(null);
  };

  const close = () => { onClose(); };

  // ── Paso 1: marcar/desmarcar grupos ──
  const toggleGroup = (g: MuscleGroup) => {
    setBlocks((prev) => {
      if (prev.some((b) => b.group === g)) return prev.filter((b) => b.group !== g);
      // Insertar respetando el orden canónico.
      const next = [...prev, { group: g, exercises: [] as FExercise[] }];
      next.sort((a, b) => MUSCLE_GROUPS.indexOf(a.group) - MUSCLE_GROUPS.indexOf(b.group));
      return next;
    });
  };

  const goStep2 = () => {
    if (blocks.length === 0) { showToast(t('mc_str_select_group'), 'error'); return; }
    setStep(2);
  };

  // ── Paso 2: ejercicios y series por bloque ──
  const addExercise = (group: MuscleGroup) => {
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: [...b.exercises, { id: uid(), label: '', query: '', open: true, sets: [{ reps: '10', weight: '' }] }] }
      : b));
  };

  const patchExercise = (group: MuscleGroup, id: string, patch: Partial<FExercise>) => {
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id ? { ...e, ...patch } : e) }
      : b));
  };

  const removeExercise = (group: MuscleGroup, id: string) => {
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.filter((e) => e.id !== id) }
      : b));
  };

  /** Clona un ejercicio con sus series justo debajo (variantes, drop sets…). */
  const duplicateExercise = (group: MuscleGroup, id: string) => {
    setBlocks((prev) => prev.map((b) => {
      if (b.group !== group) return b;
      const i = b.exercises.findIndex((e) => e.id === id);
      if (i < 0) return b;
      const src = b.exercises[i];
      const copy: FExercise = {
        ...src, id: uid(), open: false, techOpen: false,
        sets: src.sets.map((s) => ({ ...s })),
      };
      const exercises = [...b.exercises];
      exercises.splice(i + 1, 0, copy);
      return { ...b, exercises };
    }));
  };

  /**
   * Convierte una serie normal en descendente (o al revés).
   *
   * Al activarla se crea el primer escalón ya con menos peso que la serie de
   * arriba, que es lo que se hace de verdad en un dropset: la bajada nunca
   * empieza con el mismo kilaje.
   */
  const toggleDropset = (group: MuscleGroup, id: string, si: number) => {
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id
          ? { ...e, sets: e.sets.map((s, i) => {
              if (i !== si) return s;
              if (s.drops) return { reps: s.reps, weight: s.weight };
              const w = parseFloat(s.weight.replace(',', '.'));
              const lower = Number.isFinite(w) && w > 0 ? String(+(Math.round((w * 0.75) / 0.5) * 0.5).toFixed(2)) : '';
              return { ...s, drops: [{ reps: s.reps, weight: lower }] };
            }) }
          : e) }
      : b));
  };

  const addDrop = (group: MuscleGroup, id: string, si: number) => {
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id
          ? { ...e, sets: e.sets.map((s, i) => {
              if (i !== si || !s.drops) return s;
              const last = s.drops[s.drops.length - 1];
              const w = parseFloat((last?.weight || s.weight).replace(',', '.'));
              const lower = Number.isFinite(w) && w > 0 ? String(+(Math.round((w * 0.75) / 0.5) * 0.5).toFixed(2)) : '';
              return { ...s, drops: [...s.drops, { reps: last?.reps || s.reps, weight: lower }] };
            }) }
          : e) }
      : b));
  };

  const patchDrop = (group: MuscleGroup, id: string, si: number, di: number, patch: Partial<{ reps: string; weight: string }>) => {
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id
          ? { ...e, sets: e.sets.map((s, i) => i === si && s.drops
              ? { ...s, drops: s.drops.map((d, j) => j === di ? { ...d, ...patch } : d) }
              : s) }
          : e) }
      : b));
  };

  const removeDrop = (group: MuscleGroup, id: string, si: number, di: number) => {
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id
          ? { ...e, sets: e.sets.map((s, i) => {
              if (i !== si || !s.drops) return s;
              const drops = s.drops.filter((_, j) => j !== di);
              // Sin escalones ya no es una serie descendente.
              return drops.length ? { ...s, drops } : { reps: s.reps, weight: s.weight };
            }) }
          : e) }
      : b));
  };

  const addSet = (group: MuscleGroup, id: string) => {
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id
          ? { ...e, sets: [...e.sets, { reps: e.sets[e.sets.length - 1]?.reps || '10', weight: e.sets[e.sets.length - 1]?.weight || '' }] }
          : e) }
      : b));
  };

  const patchSet = (group: MuscleGroup, id: string, si: number, patch: Partial<FSet>) => {
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id
          ? { ...e, sets: e.sets.map((s, j) => j === si ? { ...s, ...patch } : s) }
          : e) }
      : b));
  };

  const removeSet = (group: MuscleGroup, id: string, si: number) => {
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id
          ? { ...e, sets: e.sets.filter((_, j) => j !== si) }
          : e) }
      : b));
  };

  // ── Dictado / texto: rellena grupos + ejercicios ──
  const applyDictation = (text: string) => {
    const pool = [...ownExercises.map((e) => e.label), ...library];
    const parsed = parseStrengthSessionFromSpeech(text, pool);
    if (parsed.length === 0) { showToast(t('mc_str_need_exercise'), 'error'); return; }

    setBlocks((prev) => {
      const next = prev.map((b) => ({ ...b, exercises: [...b.exercises] }));
      const ensure = (g: MuscleGroup): FBlock => {
        let blk = next.find((b) => b.group === g);
        if (!blk) { blk = { group: g, exercises: [] }; next.push(blk); }
        return blk;
      };
      parsed.forEach((p) => {
        const label = (p.exercise || '').trim();
        if (!label) return;
        const g = muscleGroupOf(label) || 'full_body';
        const blk = ensure(g);
        const nSets = Math.max(1, p.sets ?? 1);
        const reps = p.reps ? String(p.reps) : '10';
        const weight = p.weight ? String(p.weight) : '';
        blk.exercises.push({ id: uid(), label, query: '', open: false, sets: Array.from({ length: nSets }, () => ({ reps, weight })) });
      });
      next.sort((a, b) => MUSCLE_GROUPS.indexOf(a.group) - MUSCLE_GROUPS.indexOf(b.group));
      return next;
    });
    setInterpreted(true);
    setStep(2);
  };

  // ── Guardar ──
  const submit = () => {
    const built: BuiltBlock[] = [];
    for (const b of blocks) {
      const exercises: BuiltExercise[] = [];
      for (const e of b.exercises) {
        const label = e.label.trim();
        if (!label) continue;
        const tm = trackingModeOf(label);
        const wm = weightModeOf(label);
        // Lee un par (reps/segundos/metros, peso) según cómo se mida el
        // ejercicio. Devuelve null si el valor principal no es válido.
        const readPair = (raw: { reps: string; weight: string }): BuiltDrop | null => {
          const weight = parseFloat(raw.weight.replace(',', '.')) || 0;
          if (tm === 'reps') {
            const parsed = parseRepsInput(raw.reps);
            if (!parsed) return null;
            return parsed.repsMax !== undefined
              ? { reps: parsed.reps, repsMax: parsed.repsMax, weight }
              : { reps: parsed.reps, weight };
          }
          const v = parseInt(raw.reps, 10);
          if (!v || v <= 0) return null;
          return { reps: v, weight };
        };

        const sets: BuiltSet[] = [];
        for (const s of e.sets) {
          const main = readPair(s);
          if (!main) continue;
          // Los escalones incompletos se descartan sin tirar la serie entera:
          // dejarse una bajada a medias no debe hacer perder el registro.
          const drops = (s.drops || []).map(readPair).filter((d): d is BuiltDrop => d !== null);
          sets.push(drops.length ? { ...main, drops } : main);
        }
        if (sets.length > 0) {
          exercises.push({
            label, sets, weightMode: wm, trackingMode: tm,
            note: e.note?.trim() || undefined,
            machine: e.machine?.trim() || undefined,
          });
        }
      }
      if (exercises.length > 0) built.push({ group: b.group, exercises });
    }
    if (built.length === 0) { showToast(t('mc_str_no_exercises'), 'error'); return; }
    onSave({ date, blocks: built, slot });
  };

  // Se llama tras guardar con éxito desde el padre (via key remount) — aquí solo
  // limpiamos si el sheet se cierra.
  const handleClose = () => { resetAll(); close(); };

  const totalExercises = blocks.reduce((a, b) => a + b.exercises.filter((e) => e.label.trim()).length, 0);

  /**
   * Ejercicios sugeridos para un grupo, opcionalmente acotados por ZONA.
   *
   * Con 30 ejercicios de espalda, la lista sin filtrar no ayuda: hay que
   * leérsela entera. La zona (tirón vertical, remo, dorsal aislado...) la parte
   * en trozos de 4-8, que es lo que se puede mirar de un vistazo. Lo que el
   * usuario ya ha registrado va SIEMPRE primero, y no se filtra por zona: es
   * suyo y puede no estar en la biblioteca.
   */
  const suggestFor = (group: MuscleGroup, query: string, zone: string): string[] => {
    const own = ownExercises.filter((e) => e.group === group).map((e) => e.label);
    const lib = zone === 'all'
      ? exercisesByGroup(group, lang)
      : filterExercises({ group, focus: zone }).map((e) => exLabel(e, lang));
    const pool = [...new Set([...own, ...lib])];
    const q = norm(query);
    return (q ? pool.filter((x) => norm(x).includes(q) && norm(x) !== q) : pool).slice(0, 30);
  };

  return (
    <>
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={initialSession ? t('mc_str_edit_session') : step === 1 ? t('mc_str_new') : t('mc_str_step2_title')}
      footer={
        pendingDraft ? undefined : step === 1 ? (
          <button onClick={goStep2} disabled={blocks.length === 0} style={{ minHeight: 48 }}
            className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
            {t('mc_str_continue')} <i className="ri-arrow-right-line"></i>
          </button>
        ) : (
          <>
            {/* Sin red no se puede guardar en Supabase, pero el borrador local
                sigue intacto: hay que decirlo antes de que pulse guardar. */}
            {!online && (
              <p className="text-[11px] mb-2 flex items-center gap-1.5" style={{ color: '#fb923c' }} role="alert">
                <i className="ri-wifi-off-line" /> {t('mc_str_offline_warn')}
              </p>
            )}
            <button onClick={submit} disabled={saving} style={{ minHeight: 48 }}
              className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
                : initialSession
                  ? <><i className="ri-save-line"></i> {t('mc_str_save_changes')}</>
                  : <><i className="ri-save-line"></i> {t('mc_str_save_session')}{totalExercises > 0 ? ` (${totalExercises})` : ''}</>}
            </button>
          </>
        )
      }
    >
      {/* ── Borrador sin terminar: bifurcación explícita antes de nada ── */}
      {pendingDraft && (
        <div className="rk-card" style={{ padding: 18 }}>
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl"
              style={{ background: 'var(--accent-dim)', border: '1px solid rgba(225,6,0,0.28)', color: 'var(--accent)' }}>
              <i className="ri-history-line text-lg" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">{t('mc_dft_title')}</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--t-2)' }}>
                {t('mc_dft_desc', {
                  n: pendingDraft.blocks.reduce((a, b) => a + b.exercises.filter((e) => e.label.trim()).length, 0),
                  when: new Date(pendingDraft.savedAt).toLocaleString(i18n.language === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
                })}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={resumeDraft} style={{ minHeight: 44 }}
              className="rk-cta flex-1 flex items-center justify-center gap-2">
              <i className="ri-play-fill" /> {t('mc_dft_resume')}
            </button>
            <button type="button" onClick={discardDraft} style={{ minHeight: 44, padding: '0 16px' }}
              className="rk-nav-btn text-sm font-bold">
              {t('mc_dft_discard')}
            </button>
          </div>
        </div>
      )}

      {!pendingDraft && (<>
      {/* Entrada rápida por voz/texto: rellena grupos + ejercicios */}
      <div className="rounded-2xl border border-red-500/25 bg-red-600/[0.06] p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-300 flex items-center gap-1.5">
            <i className="ri-flashlight-line"></i>{t('mc_str_quick_entry')}
          </p>
          <VoiceButton onResult={applyDictation} />
        </div>
        <div className="flex gap-2">
          <input value={freeText} onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && freeText.trim()) { e.preventDefault(); applyDictation(freeText.trim()); setFreeText(''); } }}
            placeholder={t('mc_str_freetext_ph')} style={{ fontSize: 16, minHeight: 44 }}
            className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
          <button type="button" onClick={() => { if (freeText.trim()) { applyDictation(freeText.trim()); setFreeText(''); } }}
            disabled={!freeText.trim()} style={{ minHeight: 44 }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors">
            <i className="ri-magic-line"></i> {t('mc_str_freetext_apply')}
          </button>
        </div>
        {interpreted && (
          <p className="text-[11px] text-red-400 flex items-center gap-1.5 mt-2"><i className="ri-sparkling-line"></i>{t('mc_vo_interpreted')}</p>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="flex-1 h-px bg-white/[0.08]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">{t('mc_str_or_manual')}</span>
        <span className="flex-1 h-px bg-white/[0.08]" />
      </div>

      {/* ── PASO 1: ¿qué has entrenado hoy? ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-bold text-white">{t('mc_str_step1_q')}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{t('mc_str_step1_hint')}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {MUSCLE_GROUPS.map((g) => {
              const on = selectedGroups.has(g);
              return (
                <button key={g} onClick={() => toggleGroup(g)} style={{ minHeight: 52 }}
                  className={`flex items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition-all cursor-pointer px-2 ${on ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/25' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'}`}>
                  {on && <i className="ri-check-line"></i>}{t(`mc_str_mg_${g}`)}
                </button>
              );
            })}
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_str_date')}</label>
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)}
              style={{ fontSize: 16, minHeight: 44 }}
              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 cursor-pointer" />
          </div>
          {/* Selector de franja: solo cuando ese día ya tiene otra sesión */}
          {dayHasSession && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                {t('mc_str_slot_label')}
                <span className="text-zinc-500 font-normal ml-2">{t('mc_str_slot_used_hint', { n: usedSlots.length })}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SLOT_ORDER.map((s) => {
                  const used = usedSlots.includes(s);
                  const active = slot === s;
                  return (
                    <button key={s} type="button" onClick={() => setSlot(s)} disabled={used && !active} style={{ minHeight: 44 }}
                      className={`px-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${active ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'}`}>
                      {t(`mc_str_slot_${s}`)}
                      {used && !active && <span className="block text-[9px] font-normal opacity-70 mt-0.5">{t('mc_str_slot_taken')}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PASO 2: ejercicios por grupo ── */}
      {step === 2 && (
        <div className="space-y-5">
          <button onClick={() => setStep(1)} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer">
            <i className="ri-arrow-left-line"></i>{t('mc_str_edit_groups')}
          </button>

          {blocks.map((b) => (
            <div key={b.group}>
              <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-red-400 mb-2.5">{t(`mc_str_mg_${b.group}`)}</p>

              <div className="space-y-3">
                {b.exercises.map((e) => {
                  const tm: TrackingMode = e.label ? trackingModeOf(e.label) : 'reps';
                  const wm: WeightMode = e.label ? weightModeOf(e.label) : 'total';
                  const showBar = !!e.label && usesBar(e.label) && wm === 'total';
                  // El peso de polea y máquina depende del aparato; el de barra
                  // y mancuerna, no. Por eso el campo solo sale en los primeros.
                  const eq = e.label ? equipmentOf(e.label) : null;
                  const needsMachine = eq === 'cable' || eq === 'machine';
                  const primaryLabel = tm === 'time' ? t('mc_str_field_seconds') : tm === 'distance' ? t('mc_str_field_meters') : t('mc_str_reps');
                  const weightOptional = wm === 'bodyweight' || tm !== 'reps';
                  return (
                  <div key={e.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                    {/* Nombre del ejercicio + info + eliminar */}
                    <div className="flex items-center gap-2">
                      <input value={e.label}
                        onChange={(ev) => patchExercise(b.group, e.id, { label: ev.target.value, query: ev.target.value, open: true })}
                        onFocus={() => patchExercise(b.group, e.id, { open: true })}
                        onBlur={() => { if (e.label.trim()) applyHistory(b.group, e.id, e.label.trim(), e.machine); }}
                        placeholder={t('mc_str_pick_exercise')} maxLength={50} style={{ fontSize: 16, minHeight: 44 }}
                        className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500" />
                      {hasTechnique(e.label) && (
                        <button type="button" onClick={() => patchExercise(b.group, e.id, { techOpen: !e.techOpen, open: false })}
                          aria-label={t('mc_ex_tech_toggle')} title={t('mc_ex_tech_toggle')}
                          className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${e.techOpen ? 'text-red-400 bg-red-600/12 border border-red-500/30' : 'text-zinc-500 hover:text-white'}`}>
                          <i className="ri-information-line"></i>
                        </button>
                      )}
                      <button type="button" onClick={() => duplicateExercise(b.group, e.id)}
                        aria-label={t('mc_str_duplicate_exercise')} title={t('mc_str_duplicate_exercise')}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white cursor-pointer">
                        <i className="ri-file-copy-line"></i>
                      </button>
                      <button onClick={() => removeExercise(b.group, e.id)} aria-label={t('mc_str_remove_exercise')}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                    {e.techOpen && <ExerciseTechniqueCard name={e.label} />}
                    {e.open && (() => {
                      const zone = e.zone || 'all';
                      const sug = suggestFor(b.group, e.query || e.label, zone);
                      const zones = focusesForGroup(b.group);
                      return (
                        <div className="mt-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-1.5">
                          {/* Acotar por zona antes de leer la lista. Con 30
                              ejercicios de espalda, "tirón vertical" o "remo"
                              la dejan en 5 y se elige de un vistazo. */}
                          {zones.length > 1 && (
                            <div className="flex gap-1 overflow-x-auto pb-1.5 mb-1 rk-noscroll-x">
                              {['all', ...zones].map((z) => (
                                <button key={z} type="button" onMouseDown={(ev) => ev.preventDefault()}
                                  onClick={() => patchExercise(b.group, e.id, { zone: z })}
                                  aria-pressed={zone === z} style={{ minHeight: 30 }}
                                  className={`text-[11px] font-bold whitespace-nowrap px-2.5 rounded-lg cursor-pointer transition-colors ${
                                    zone === z ? 'bg-white/[0.14] text-white' : 'bg-white/[0.04] text-zinc-400 hover:text-white'}`}>
                                  {z === 'all' ? t('mc_exlib_all') : t(`mc_focus_${z}`)}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="max-h-40 overflow-y-auto">
                            {sug.length === 0
                              ? <p className="text-xs px-3 py-2" style={{ color: 'var(--t-3)' }}>{t('mc_exlib_no_results')}</p>
                              : sug.map((c) => (
                                <button key={c} onMouseDown={(ev) => ev.preventDefault()}
                                  onClick={() => { patchExercise(b.group, e.id, { label: c, open: false }); applyHistory(b.group, e.id, c, e.machine); }}
                                  className="w-full text-left text-sm text-zinc-300 hover:text-white hover:bg-white/[0.05] px-3 py-2 rounded-lg cursor-pointer flex items-center gap-2">
                                  <i className="ri-search-line text-xs text-zinc-600"></i>{c}
                                </button>
                              ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Máquina / polea concreta ──
                        Solo en ejercicios de polea o máquina: ahí el número que
                        marca el aparato depende de la marca y la polea, y
                        comparar 18 de un sitio con 30 de otro no dice nada. En
                        barra y mancuernas el peso SÍ es comparable siempre, así
                        que el campo ni aparece. */}
                    {needsMachine && (
                      e.machineOpen || e.machine ? (
                        <div className="mt-2">
                          <label className="block text-[11px] text-zinc-400 mb-1" htmlFor={`machine-${e.id}`}>
                            {t('mc_str_machine_label')}
                          </label>
                          <input id={`machine-${e.id}`} value={e.machine || ''} maxLength={40}
                            onChange={(ev) => patchExercise(b.group, e.id, { machine: ev.target.value })}
                            onBlur={() => { if (e.label.trim()) applyHistory(b.group, e.id, e.label.trim(), e.machine); }}
                            placeholder={t('mc_str_machine_ph')} style={{ fontSize: 16, minHeight: 44 }}
                            className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500" />
                          <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{t('mc_str_machine_hint')}</p>
                        </div>
                      ) : (
                        <button type="button" onClick={() => patchExercise(b.group, e.id, { machineOpen: true })}
                          style={{ minHeight: 36 }}
                          className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 hover:text-white cursor-pointer">
                          <i className="ri-settings-3-line" /> {t('mc_str_machine_add')}
                        </button>
                      )
                    )}

                    {perfByEx[e.id] && (
                      <LastPerformanceCard
                        perf={perfByEx[e.id].perf}
                        suggestion={perfByEx[e.id].suggestion}
                        tracking={perfByEx[e.id].tracking}
                        onRepeat={() => applySuggestion(b.group, e.id, false)}
                        onStepUp={() => applySuggestion(b.group, e.id, true)}
                      />
                    )}

                    {/* Series: primario (reps / seg / m) + peso (según modo) */}
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-1.5 px-1">
                        <span className="w-6 flex-shrink-0" />
                        <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 text-center">{primaryLabel}</span>
                        <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 text-center">
                          {t(weightLabelKey(wm))}{weightOptional ? ` (${t('mc_optional')})` : ''}
                        </span>
                        {e.sets.length > 1 && <span className="w-8 flex-shrink-0" />}
                      </div>
                      {e.sets.map((s, si) => {
                        const repsInvalid = tm === 'reps' && s.reps.trim() !== '' && !parseRepsInput(s.reps);
                        return (
                        <div key={si} className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 flex-shrink-0 text-center text-[11px] font-bold text-zinc-500">{si + 1}</span>
                          <input value={s.reps} inputMode={tm === 'reps' ? 'text' : 'decimal'}
                            placeholder={tm === 'reps' ? '8-10' : tm === 'time' ? '45' : '20'} style={{ fontSize: 16, minHeight: 44 }}
                            aria-invalid={repsInvalid || undefined} aria-label={primaryLabel}
                            onChange={(ev) => patchSet(b.group, e.id, si, { reps: ev.target.value })}
                            className={`flex-1 min-w-0 bg-white/[0.04] border text-white text-center rounded-xl px-2 py-2.5 focus:outline-none ${repsInvalid ? 'border-red-500/70 focus:border-red-500' : 'border-white/10 focus:border-red-500'}`} />
                          <div className="flex-1 min-w-0 relative flex items-center gap-1">
                            <input value={s.weight} inputMode="decimal" placeholder="0" style={{ fontSize: 16, minHeight: 44 }}
                              onChange={(ev) => patchSet(b.group, e.id, si, { weight: ev.target.value })}
                              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl pl-3 pr-8 py-2.5 focus:outline-none focus:border-red-500" />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 pointer-events-none">kg</span>
                            {showBar && (
                              <button type="button" onClick={() => setPlateFor({ group: b.group, id: e.id, si })}
                                aria-label={t('mc_plc_title')} title={t('mc_plc_title')}
                                className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white cursor-pointer">
                                <i className="ri-calculator-line"></i>
                              </button>
                            )}
                          </div>
                          {e.sets.length > 1 && (
                            <button onClick={() => removeSet(b.group, e.id, si)} aria-label={t('mc_str_remove_set')}
                              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer">
                              <i className="ri-close-line"></i>
                            </button>
                          )}
                        </div>

                        {/* ── Serie descendente (dropset) ──
                            Los escalones son parte de ESTA serie, no series
                            nuevas: van indentados y sin numerar aparte, para
                            que se lea "la serie 2 tuvo dos bajadas". */}
                        {s.drops && s.drops.map((d, di) => (
                          <div key={`d${di}`} className="flex items-center gap-1.5" style={{ paddingLeft: '1.5rem' }}>
                            <span className="w-6 flex-shrink-0 flex items-center justify-center text-zinc-600" aria-hidden>
                              <i className="ri-corner-down-right-line text-xs" />
                            </span>
                            <input value={d.reps} inputMode={tm === 'reps' ? 'text' : 'decimal'}
                              placeholder={tm === 'reps' ? '6' : '30'} style={{ fontSize: 16, minHeight: 40 }}
                              aria-label={`${t('mc_str_drop_step')} ${di + 1} · ${primaryLabel}`}
                              onChange={(ev) => patchDrop(b.group, e.id, si, di, { reps: ev.target.value })}
                              className="flex-1 min-w-0 bg-white/[0.02] border border-white/[0.08] text-white text-center rounded-xl px-2 py-2 focus:outline-none focus:border-red-500" />
                            <div className="flex-1 min-w-0 relative">
                              <input value={d.weight} inputMode="decimal" placeholder="0" style={{ fontSize: 16, minHeight: 40 }}
                                aria-label={`${t('mc_str_drop_step')} ${di + 1} · ${t(weightLabelKey(wm))}`}
                                onChange={(ev) => patchDrop(b.group, e.id, si, di, { weight: ev.target.value })}
                                className="w-full bg-white/[0.02] border border-white/[0.08] text-white rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-red-500" />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 pointer-events-none">kg</span>
                            </div>
                            <button onClick={() => removeDrop(b.group, e.id, si, di)} aria-label={t('mc_str_drop_remove')}
                              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer">
                              <i className="ri-close-line"></i>
                            </button>
                          </div>
                        ))}

                        <div style={{ paddingLeft: '1.5rem' }}>
                          <button type="button"
                            onClick={() => (s.drops ? addDrop(b.group, e.id, si) : toggleDropset(b.group, e.id, si))}
                            style={{ minHeight: 34 }}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 hover:text-white cursor-pointer">
                            <i className="ri-arrow-down-line" />
                            {s.drops ? t('mc_str_drop_add_more') : t('mc_str_drop_make')}
                          </button>
                        </div>
                        </div>
                        );
                      })}
                      <button onClick={() => addSet(b.group, e.id)} style={{ minHeight: 40 }}
                        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-zinc-300 bg-white/[0.03] border border-white/10 hover:border-white/25 rounded-xl cursor-pointer transition-colors">
                        <i className="ri-add-line"></i> {t('mc_str_add_set')}
                      </button>

                      {/* Nota de la serie: la lee el "última vez" del próximo día. */}
                      {e.noteOpen || e.note ? (
                        <input value={e.note || ''} maxLength={200}
                          onChange={(ev) => patchExercise(b.group, e.id, { note: ev.target.value })}
                          placeholder={t('mc_str_note_ph')} aria-label={t('mc_str_note_label')}
                          style={{ fontSize: 16, minHeight: 44 }}
                          className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500" />
                      ) : (
                        <button type="button" onClick={() => patchExercise(b.group, e.id, { noteOpen: true })}
                          style={{ minHeight: 36 }}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 hover:text-white cursor-pointer">
                          <i className="ri-sticky-note-line" /> {t('mc_str_note_add')}
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}

                <button onClick={() => addExercise(b.group)} style={{ minHeight: 46 }}
                  className="w-full flex items-center justify-center gap-2 text-sm font-bold text-red-300 bg-red-600/[0.08] border border-red-500/25 hover:border-red-500/50 rounded-xl cursor-pointer transition-colors">
                  <i className="ri-add-line"></i> {t('mc_str_add_exercise')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Estado del borrador: que se vea que no se está perdiendo nada. */}
      {draftEnabled && draftState !== 'idle' && (
        <p className="text-[11px] mt-4 flex items-center gap-1.5" style={{ color: 'var(--t-3)' }} role="status">
          {draftState === 'saving' ? (
            <><i className="ri-loader-4-line animate-spin" /> {t('mc_dft_saving')}</>
          ) : (
            <><i className="ri-check-line" style={{ color: '#4ade80' }} /> {t('mc_dft_saved', {
              time: draftAt ? new Date(draftAt).toLocaleTimeString(i18n.language === 'en' ? 'en-GB' : 'es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
            })}</>
          )}
        </p>
      )}
      </>)}
    </BottomSheet>
    <PlateCalculator
      open={!!plateFor}
      onClose={() => setPlateFor(null)}
      onUse={(total) => { if (plateFor) patchSet(plateFor.group, plateFor.id, plateFor.si, { weight: String(total) }); }}
    />
    </>
  );
}
