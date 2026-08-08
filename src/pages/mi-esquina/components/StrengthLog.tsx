import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable, isMissingColumn } from '@/lib/dbState';
import { parseStrengthFromSpeech, parseStrengthSessionFromSpeech } from '@/lib/dictation';
import { MUSCLE_GROUPS, exercisesByGroup, libraryLabels, muscleGroupOf, type MuscleGroup } from '../lib/exercises';
import { bestByExercise, weeklyProgressList, startOfWeekISO } from '../lib/strength';
import VoiceButton from '@/components/feature/VoiceButton';
import Reveal from '@/components/base/Reveal';
import BottomSheet from '@/components/base/BottomSheet';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
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
}

// Una serie del formulario: `reps` (valor bajo/fijo) + `repsMax` opcional (tope
// del rango, ej. "8 a 10"). Vacío el máximo = número fijo, sin ambigüedad.
interface SetInput { reps: string; repsMax: string; weight: string }

// Fila del panel de revisión del dictado de una sesión completa (varios
// ejercicios de corrido). Todo editable antes de confirmar el guardado.
interface MultiRow { exercise: string; sets: string; reps: string; repsMax: string; weight: string }

/** Epley: estimación de una repetición máxima. Orientativa, no oficial. */
function epley(weight: number, reps: number): number {
  return +(weight * (1 + reps / 30)).toFixed(1);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Muestra las repeticiones: "8" (fijas) o "8–10" (rango). */
function fmtReps(reps: number, repsMax: number | null | undefined): string {
  return repsMax && repsMax > reps ? `${reps}–${repsMax}` : String(reps);
}

interface ExSession { date: string; sets: StrengthSet[] }

/** Sugerencia de carga a partir de sesiones ya agrupadas (más reciente primero). */
function suggestionFor(sessionsDesc: ExSession[]): { kind: 'up' | 'hold'; next?: number } | null {
  if (sessionsDesc.length < 3) return null;
  const asc = [...sessionsDesc].reverse().map((s) => Math.max(...s.sets.map((x) => Number(x.weight_kg))));
  const n = asc.length;
  const lastW = asc[n - 1];
  let stalled = 1;
  for (let i = n - 2; i >= 0; i--) { if (asc[i] === lastW) stalled++; else break; }
  if (stalled >= 3) return { kind: 'up', next: +(lastW + (lastW < 20 ? 1 : 2.5)).toFixed(1) };
  if (asc[n - 1] > asc[n - 2] && asc[n - 2] > asc[n - 3]) return { kind: 'hold' };
  return null;
}

/** Mini gráfico de tendencia sin ejes, solo para dar sensación de subida/bajada. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 64; const h = 22;
  const min = Math.min(...values); const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Registro de fuerza: series, repeticiones y peso, guardados en el tiempo.
 *
 * Las marcas personales NO se guardan en base de datos: se derivan de las
 * series registradas. Así nunca pueden quedar desincronizadas si se corrige
 * o se borra un registro.
 */
export default function StrengthLog({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [rows, setRows] = useState<StrengthSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string>('');
  // Filtro por grupo muscular de la lista "Tus ejercicios" ('all' = todos).
  const [groupFilter, setGroupFilter] = useState<MuscleGroup | 'other' | 'all'>('all');
  /** Ejercicio cuya marca se acaba de batir: dispara la celebración */
  const [prHit, setPrHit] = useState<{ exercise: string; weight: number } | null>(null);

  const [exercise, setExercise] = useState('');
  const [date, setDate] = useState(todayISO());
  const [sets, setSets] = useState<SetInput[]>([{ reps: '8', repsMax: '', weight: '' }]);
  const [exOpen, setExOpen] = useState(false);
  const [interpreted, setInterpreted] = useState(false);
  const [freeText, setFreeText] = useState('');
  // Panel de revisión cuando el dictado trae VARIOS ejercicios de corrido.
  const [multi, setMulti] = useState<MultiRow[] | null>(null);
  const [savingMulti, setSavingMulti] = useState(false);
  // Grupo muscular elegido en el buscador ('all' = todos, 'mine' = los míos).
  const [group, setGroup] = useState<MuscleGroup | 'all' | 'mine'>('all');
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';
  const library = useMemo(() => libraryLabels(lang), [lang]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('strength_sets').select('*')
      .eq('fighter_profile_id', profile.id)
      .order('session_date', { ascending: false })
      .limit(1500);
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    const list = (data || []) as StrengthSet[];
    setRows(list);
    // Selección por defecto SIN depender de `selected`: así `load` no se recrea
    // al cambiar de ejercicio y no se recarga toda la tabla en cada clic.
    if (list.length) setSelected((cur) => cur || list[0].exercise);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  // ── Marcas personales por ejercicio (derivadas) ──
  // El peso máximo por ejercicio viene del helper compartido con el resumen
  // semanal; aquí se añade además la 1RM estimada (Epley), que solo hace
  // falta en esta vista.
  const records = useMemo(() => {
    const bests = bestByExercise(rows);
    const estByExercise = new Map<string, number>();
    rows.forEach((r) => {
      const est = epley(Number(r.weight_kg), r.reps);
      estByExercise.set(r.exercise, Math.max(est, estByExercise.get(r.exercise) ?? 0));
    });
    return [...bests.values()]
      .map((v) => ({ exercise: v.exercise, label: v.label, best: v.best, bestReps: v.bestReps, date: v.date, est: estByExercise.get(v.exercise) ?? v.best }))
      .sort((a, b) => b.best - a.best);
  }, [rows]);

  const exercises = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.exercise, r.exercise_label));
    return [...m.entries()];
  }, [rows]);

  // Cada ejercicio con su grupo muscular (de la biblioteca; 'other' si es libre
  // y no está en ella). Base del selector y del agrupado de "Tus ejercicios".
  const exercisesWithGroup = useMemo(
    () => exercises.map(([key, label]) => ({ key, label, group: (muscleGroupOf(label) || 'other') as MuscleGroup | 'other' })),
    [exercises],
  );

  // Grupos que el usuario tiene de verdad (para no pintar chips vacíos), en el
  // orden canónico de MUSCLE_GROUPS y con 'other' al final.
  const groupsPresent = useMemo(() => {
    const set = new Set(exercisesWithGroup.map((e) => e.group));
    const ordered: (MuscleGroup | 'other')[] = [...MUSCLE_GROUPS.filter((g) => set.has(g))];
    if (set.has('other')) ordered.push('other');
    return ordered;
  }, [exercisesWithGroup]);

  // Grupos musculares de la ÚLTIMA sesión (mismo día más reciente), para la
  // cabecera "Hoy entrenaste: Espalda + Tríceps".
  const lastSessionGroups = useMemo(() => {
    if (rows.length === 0) return [];
    const lastDate = rows.reduce((a, r) => (r.session_date > a ? r.session_date : a), rows[0].session_date);
    const groups = new Set<MuscleGroup | 'other'>();
    rows.filter((r) => r.session_date === lastDate).forEach((r) => groups.add(muscleGroupOf(r.exercise_label) || 'other'));
    const ordered: (MuscleGroup | 'other')[] = [...MUSCLE_GROUPS.filter((g) => groups.has(g))];
    if (groups.has('other')) ordered.push('other');
    return ordered;
  }, [rows]);

  // ── Progresión del ejercicio elegido: mejor peso por sesión ──
  const progression = useMemo(() => {
    if (!selected) return [];
    const byDate = new Map<string, number>();
    rows.filter((r) => r.exercise === selected).forEach((r) => {
      const w = Number(r.weight_kg);
      byDate.set(r.session_date, Math.max(byDate.get(r.session_date) ?? 0, w));
    });
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, kg]) => ({
        date: new Date(d + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
        kg,
      }));
  }, [rows, selected, locale]);

  const gain = progression.length >= 2
    ? +(progression[progression.length - 1].kg - progression[0].kg).toFixed(1)
    : null;

  // ── Sesiones por ejercicio (más reciente primero): base de las cards
  //    rediseñadas — última sesión, sesión anterior para comparar, e
  //    historial compacto de las últimas 3. ──
  const sessionsByExercise = useMemo(() => {
    const byKey = new Map<string, StrengthSet[]>();
    rows.forEach((r) => {
      const k = `${r.exercise}|${r.session_date}`;
      const l = byKey.get(k) || []; l.push(r); byKey.set(k, l);
    });
    const map = new Map<string, ExSession[]>();
    byKey.forEach((sets, k) => {
      const [ex, date] = k.split('|');
      const l = map.get(ex) || [];
      l.push({ date, sets: [...sets].sort((a, b) => a.set_number - b.set_number) });
      map.set(ex, l);
    });
    map.forEach((list) => list.sort((a, b) => b.date.localeCompare(a.date)));
    return map;
  }, [rows]);

  // ── Semana: sesiones, PRs y volumen medio — lo que de verdad importa de
  //    un vistazo, no el volumen acumulado de toda la vida. ──
  const weekStats = useMemo(() => {
    const weekStart = startOfWeekISO(0);
    const sessionsThisWeek = new Set(rows.filter((r) => r.session_date >= weekStart).map((r) => r.session_date)).size;
    const movers = weeklyProgressList(rows, weekStart);
    const distinctDates = new Set(rows.map((r) => r.session_date));
    const totalVolume = rows.reduce((a, r) => a + Number(r.weight_kg) * r.reps, 0);
    const avgVolume = distinctDates.size ? Math.round(totalVolume / distinctDates.size) : 0;
    const volByDate = new Map<string, number>();
    rows.forEach((r) => volByDate.set(r.session_date, (volByDate.get(r.session_date) || 0) + Number(r.weight_kg) * r.reps));
    const sparkline = [...volByDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([, v]) => Math.round(v));
    return { sessionsThisWeek, movers, avgVolume, sparkline };
  }, [rows]);

  // ── Análisis semanal: 2-3 líneas cortas, derivadas de los datos reales
  //    (sin IA — determinista, así funciona igual con la IA en pausa). ──
  const analysisLines = useMemo(() => {
    const lines: { text: string; color: string }[] = [];
    if (weekStats.movers.length > 0) {
      const avgGain = weekStats.movers.reduce((a, m) => a + m.gain, 0) / weekStats.movers.length;
      lines.push({ text: t('mc_str_an_progress', { n: avgGain.toFixed(1) }), color: '#22c55e' });
    }
    if (weekStats.sessionsThisWeek === 0 && rows.length > 0) {
      lines.push({ text: t('mc_str_an_none'), color: '#fb923c' });
    } else if (weekStats.sessionsThisWeek >= 4) {
      lines.push({ text: t('mc_str_an_consistent'), color: '#22c55e' });
    }
    if (weekStats.movers[0]) {
      lines.push({ text: t('mc_str_an_next_goal', { ex: weekStats.movers[0].label, w: weekStats.movers[0].now }), color: '#C9A84C' });
    }
    return lines.slice(0, 3);
  }, [weekStats, rows.length, t]);

  // Card de un ejercicio (última sesión, progreso, tendencia, historial y
  // sugerencia). Extraída para reutilizarla tanto en la vista agrupada por
  // grupo muscular como en la filtrada por un solo grupo.
  const renderExerciseCard = (ex: string, label: string, i: number) => {
    const sessions = sessionsByExercise.get(ex) || [];
    const latest = sessions[0];
    if (!latest) return null;
    const latestBest = Math.max(...latest.sets.map((s) => Number(s.weight_kg)));
    const prevBest = sessions[1] ? Math.max(...sessions[1].sets.map((s) => Number(s.weight_kg))) : null;
    const delta = prevBest !== null ? +(latestBest - prevBest).toFixed(1) : null;
    const isMover = weekStats.movers.some((m) => m.exercise === ex);
    const suggestion = suggestionFor(sessions);
    const sparkValues = sessions.slice(0, 4).map((s) => Math.max(...s.sets.map((x) => Number(x.weight_kg)))).reverse();
    return (
      <Reveal key={ex} delay={Math.min(i, 6) * 40}>
        <button onClick={() => setSelected(ex)} className="w-full text-left rk-card cursor-pointer" style={{ padding: '16px 18px' }}>
          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-white truncate">{label}</p>
                {isMover && <span className="text-[9px] font-bold uppercase tracking-wide text-[#C9A84C] bg-[#C9A84C]/12 border border-[#C9A84C]/30 px-1.5 py-0.5 rounded-full flex-shrink-0">PR</span>}
              </div>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: '#fff' }} className="mt-0.5">
                {latest.sets.length}×{fmtReps(latest.sets[0].reps, latest.sets[0].reps_max)} <span className="text-zinc-500">@</span> {latestBest}kg
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{agoLabel(latest.date)}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {sparkValues.length >= 2 && <Sparkline values={sparkValues} color={delta && delta > 0 ? '#22c55e' : delta && delta < 0 ? '#fb923c' : '#71717a'} />}
              {delta !== null && delta !== 0 && (
                <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${delta > 0 ? 'text-green-400 bg-green-500/10' : 'text-orange-400 bg-orange-500/10'}`}>
                  {delta > 0 ? '↑ +' : '↓ '}{Math.abs(delta)}kg
                </span>
              )}
            </div>
          </div>

          {sessions.length > 1 && (
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/[0.06] flex-wrap">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mr-1">{t('mc_str_last_3')}</span>
              {sessions.slice(0, 3).map((s, j) => {
                const w = Math.max(...s.sets.map((x) => Number(x.weight_kg)));
                const prevW = sessions[j + 1] ? Math.max(...sessions[j + 1].sets.map((x) => Number(x.weight_kg))) : null;
                const arrow = prevW === null ? '' : w > prevW ? '↑' : w < prevW ? '↓' : '↔';
                const arrowColor = prevW === null ? '#a1a1aa' : w > prevW ? '#4ade80' : w < prevW ? '#fb923c' : '#a1a1aa';
                return (
                  <span key={s.date} title={new Date(s.date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                    className="text-[10px] font-semibold text-zinc-400 bg-white/[0.03] border border-white/10 px-2 py-1 rounded-lg">
                    {w}kg <span style={{ color: arrowColor }}>{arrow}</span>
                  </span>
                );
              })}
            </div>
          )}

          {suggestion && (
            <p className="text-[11px] mt-2.5 flex items-center gap-1.5" style={{ color: suggestion.kind === 'up' ? '#E10600' : '#eab308' }}>
              <i className="ri-lightbulb-flash-line"></i>
              {suggestion.kind === 'up' ? t('mc_str_suggestion_up', { w: suggestion.next }) : t('mc_str_suggestion_hold')}
            </p>
          )}
        </button>
      </Reveal>
    );
  };

  // ── Sesiones agrupadas para el historial ──
  const history = useMemo(() => {
    const m = new Map<string, StrengthSet[]>();
    rows.forEach((r) => {
      const k = `${r.session_date}|${r.exercise}`;
      const l = m.get(k) || []; l.push(r); m.set(k, l);
    });
    return [...m.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .map(([k, list]) => ({
        key: k,
        date: list[0].session_date,
        label: list[0].exercise_label,
        sets: [...list].sort((a, b) => a.set_number - b.set_number),
      }));
  }, [rows]);

  // ── Tarea 4: qué hiciste la última vez + recomendación de carga ──
  // Se calculan sobre el ejercicio que se está escribiendo en el formulario,
  // a partir del historial REAL de ese ejercicio para este usuario.
  const formExKey = normalize(exercise);

  const agoLabel = useCallback((d: string) => {
    const days = Math.floor((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000);
    if (days <= 0) return t('mc_str_today');
    if (days === 1) return t('mc_str_yesterday');
    return t('mc_str_days_ago', { n: days });
  }, [t]);

  const lastFor = useMemo(() => {
    if (!formExKey) return null;
    const mine = rows.filter((r) => r.exercise === formExKey);
    if (!mine.length) return null;
    const lastDate = mine.reduce((a, b) => (a > b.session_date ? a : b.session_date), '');
    const dateSets = mine.filter((r) => r.session_date === lastDate).sort((a, b) => a.set_number - b.set_number);
    return { date: lastDate, sets: dateSets };
  }, [rows, formExKey]);

  // Recomendación discreta y orientativa (nunca médica): solo con ≥3 sesiones.
  const recommendation = useMemo(() => {
    if (!formExKey) return null;
    const mine = rows.filter((r) => r.exercise === formExKey);
    if (!mine.length) return null;
    const byDate = new Map<string, number>();
    mine.forEach((r) => byDate.set(r.session_date, Math.max(byDate.get(r.session_date) ?? 0, Number(r.weight_kg))));
    const sessions = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])); // ascendente
    if (sessions.length < 3) return null;
    const label = mine[0].exercise_label;
    const n = sessions.length;
    const lastW = sessions[n - 1][1];

    // ¿Estancado? Sesiones finales consecutivas con el MISMO mejor peso.
    let stalled = 1;
    for (let i = n - 2; i >= 0; i--) { if (sessions[i][1] === lastW) stalled++; else break; }
    if (stalled >= 3) {
      const firstStalled = sessions[n - stalled][0];
      const spanWeeks = Math.round((new Date(sessions[n - 1][0]).getTime() - new Date(firstStalled).getTime()) / (7 * 86400000));
      const weeks = Math.max(stalled, spanWeeks || 0);
      const step = lastW < 20 ? 1 : 2.5;
      const next = +(lastW + step).toFixed(1);
      return { kind: 'up' as const, ex: label, w: lastW, next, n: weeks };
    }
    // ¿Progresión rápida? Ha subido en las tres últimas sesiones seguidas.
    if (sessions[n - 1][1] > sessions[n - 2][1] && sessions[n - 2][1] > sessions[n - 3][1]) {
      return { kind: 'hold' as const, ex: label };
    }
    return null;
  }, [rows, formExKey]);

  const resetForm = () => { setExercise(''); setDate(todayISO()); setSets([{ reps: '8', repsMax: '', weight: '' }]); setInterpreted(false); setExOpen(false); setGroup('all'); setFreeText(''); };

  // Para que la sesión de fuerza aparezca también en la Agenda, sin que el
  // usuario tenga que registrarla dos veces. No hay grupo muscular en el
  // enum de session_type (solo sparring/tecnica/fuerza/cardio/flexibilidad/
  // recuperacion), así que va como 'fuerza' con los ejercicios en notas.
  // Best-effort: si falla, la sesión de fuerza ya se guardó igualmente.
  const logToAgenda = async (sessionDate: string, exerciseLabels: string[]) => {
    await supabase.from('training_sessions').insert({
      fighter_profile_id: profile.id,
      session_date: sessionDate,
      session_type: 'fuerza',
      duration_min: null,
      intensity: 3,
      notes: exerciseLabels.join(', ').slice(0, 280),
    });
  };

  // Dictado de fuerza. Puede ser un ejercicio suelto ("press banca, tres series
  // de doce con cincuenta kilos") o una SESIÓN entera de corrido con varios
  // ejercicios. Siempre PRE-RELLENA y el usuario confirma; nunca guarda solo.
  const applyStrengthDictation = (text: string) => {
    const pool = [...exercises.map(([, l]) => l), ...library];
    const list = parseStrengthSessionFromSpeech(text, pool);

    // Varios ejercicios → panel de revisión con todos a la vez.
    if (list.length > 1) {
      setMulti(list.map((p) => ({
        exercise: p.exercise || '',
        sets: String(p.sets ?? 1),
        reps: p.reps ? String(p.reps) : '',
        repsMax: p.repsMax ? String(p.repsMax) : '',
        weight: p.weight ? String(p.weight) : '',
      })));
      return;
    }

    // Uno solo → rellena el formulario normal.
    const p = list[0] ?? parseStrengthFromSpeech(text, pool);
    if (p.exercise) setExercise(p.exercise);
    if (p.sets || p.reps || p.weight || p.repsMax) {
      const n = Math.max(1, p.sets ?? sets.length);
      const reps = p.reps ? String(p.reps) : (sets[0]?.reps || '8');
      const repsMax = p.repsMax ? String(p.repsMax) : '';
      const weight = p.weight ? String(p.weight) : '';
      setSets(Array.from({ length: n }, () => ({ reps, repsMax, weight })));
    }
    setInterpreted(true);
  };

  // Guarda TODOS los ejercicios revisados del dictado de sesión, cada uno con
  // sus series replicadas. Mismo insert defensivo que el guardado normal.
  const saveMulti = async () => {
    if (!multi) return;
    const today = date;
    const payloads: { key: string; label: string; set_number: number; reps: number; reps_max: number | null; weight: number }[] = [];
    multi.forEach((r) => {
      const ex = r.exercise.trim();
      if (!ex) return;
      const reps = parseInt(r.reps, 10);
      const max = parseInt(r.repsMax, 10);
      const weight = parseFloat(r.weight.replace(',', '.'));
      const nSets = Math.max(1, parseInt(r.sets, 10) || 1);
      if (!(reps > 0) || !(weight > 0)) return;
      const reps_max = Number.isFinite(max) && max > reps ? max : null;
      const key = normalize(ex);
      for (let i = 0; i < nSets; i++) payloads.push({ key, label: ex, set_number: i + 1, reps, reps_max, weight });
    });
    if (payloads.length === 0) { showToast(t('mc_str_need_sets'), 'error'); return; }

    setSavingMulti(true);
    const base = payloads.map((p) => ({
      fighter_profile_id: profile.id, exercise: p.key, exercise_label: p.label,
      session_date: today, set_number: p.set_number, reps: p.reps, weight_kg: p.weight,
    }));
    let { data, error } = await supabase.from('strength_sets')
      .insert(base.map((r, i) => ({ ...r, reps_max: payloads[i].reps_max }))).select();
    if (isMissingColumn(error)) {
      ({ data, error } = await supabase.from('strength_sets').insert(base).select());
    }
    setSavingMulti(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }

    const inserted = (data as StrengthSet[]).map((r) => ({ ...r, reps_max: r.reps_max ?? null }));
    setRows((prev) => [...inserted, ...prev]);
    const exLabels = [...new Set(payloads.map((p) => p.label))];
    setMulti(null);
    setShowForm(false);
    resetForm();
    showToast(t('mc_str_voice_saved_n', { n: exLabels.length }));
    void logToAgenda(today, exLabels);
  };

  const save = async () => {
    const ex = exercise.trim();
    if (!ex) { showToast(t('mc_str_need_exercise'), 'error'); return; }
    const valid = sets
      .map((s, i) => {
        const reps = parseInt(s.reps, 10);
        const max = parseInt(s.repsMax, 10);
        // Solo es rango si el máximo es válido y estrictamente mayor que el mínimo.
        const reps_max = Number.isFinite(max) && max > reps ? max : null;
        return {
          reps,
          reps_max,
          weight: parseFloat(s.weight.replace(',', '.')),
          set_number: i + 1,
        };
      })
      .filter((s) => s.reps > 0 && s.weight > 0);
    if (valid.length === 0) { showToast(t('mc_str_need_sets'), 'error'); return; }

    // La marca a batir se calcula ANTES de insertar, con lo que ya había.
    const key = normalize(ex);
    const prevBest = records.find((r) => r.exercise === key)?.best ?? 0;
    const newBest = Math.max(...valid.map((s) => s.weight));

    setSaving(true);
    const base = valid.map((s) => ({
      fighter_profile_id: profile.id,
      exercise: key,
      exercise_label: ex,
      session_date: date,
      set_number: s.set_number,
      reps: s.reps,
      weight_kg: s.weight,
    }));
    // Insert con reps_max; si la migración 0026 aún no está aplicada, se
    // reintenta sin esa columna (el registro se guarda igual, como número fijo).
    let { data, error } = await supabase.from('strength_sets')
      .insert(base.map((r, i) => ({ ...r, reps_max: valid[i].reps_max }))).select();
    if (isMissingColumn(error)) {
      ({ data, error } = await supabase.from('strength_sets').insert(base).select());
    }
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }

    // Normaliza reps_max en memoria por si la columna aún no existe.
    const inserted = (data as StrengthSet[]).map((r) => ({ ...r, reps_max: r.reps_max ?? null }));
    setRows((prev) => [...inserted, ...prev]);
    setSelected(key);
    setShowForm(false);
    resetForm();
    showToast(t('mc_str_saved'));
    void logToAgenda(date, [ex]);

    // Celebración solo si de verdad ha superado su mejor peso anterior
    if (prevBest > 0 && newBest > prevBest) {
      setPrHit({ exercise: ex, weight: newBest });
      window.setTimeout(() => setPrHit(null), 5000);
    }
  };

  const removeSession = async (dateKey: string, ex: string) => {
    const ids = rows.filter((r) => r.session_date === dateKey && r.exercise === ex).map((r) => r.id);
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    const { error } = await supabase.from('strength_sets').delete().in('id', ids);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
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

  // Sugerencias del buscador. Con un grupo elegido: solo ese grupo (y aún se
  // puede escribir libre). En "Todos"/"Míos": lo del usuario + biblioteca.
  const ownLabels = exercises.map(([, l]) => l);
  const exPool = group === 'all'
    ? [...new Set([...ownLabels, ...library])]
    : group === 'mine'
      ? ownLabels
      : exercisesByGroup(group, lang);
  const exQuery = normalize(exercise);
  const exSuggestions = (exQuery
    ? exPool.filter((x) => normalize(x).includes(exQuery) && normalize(x) !== exQuery)
    : exPool
  ).slice(0, group === 'all' ? 10 : 40);

  // Pestañas de grupo: Todos, Míos (si el usuario ya tiene ejercicios) y los
  // grupos musculares.
  const groupTabs: (MuscleGroup | 'all' | 'mine')[] = [
    'all', ...(ownLabels.length ? ['mine' as const] : []), ...MUSCLE_GROUPS,
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Celebración de marca personal */}
      {prHit && (
        <div className="rk-card rk-pr-hit flex items-center gap-4" style={{ padding: '16px 20px', transform: 'none', borderColor: 'rgba(201,168,76,0.5)', background: 'rgba(201,168,76,0.07)' }}>
          <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C]">
            <i className="ri-trophy-fill text-2xl"></i>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-[#C9A84C] tracking-wide">{t('mc_str_pr_new')}</p>
            <p className="text-xs text-zinc-300 mt-0.5">{t('mc_str_pr_beat', { ex: prHit.exercise, w: prHit.weight })}</p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">{t('mc_str_eyebrow')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            {t('mc_str_title')} <span className="rk-red-glow">{t('mc_str_title_2')}</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_str_sub')}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="rk-btn rk-btn-primary flex items-center gap-2 w-full sm:w-auto justify-center" style={{ fontSize: '0.85rem', padding: '0.75rem 1.4rem' }}>
          <i className="ri-add-line"></i> {t('mc_str_new')}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '48px 28px' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-hammer-line text-3xl text-zinc-600"></i>
          </div>
          <p className="text-white font-bold">{t('mc_str_empty')}</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{t('mc_str_empty_desc')}</p>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem', padding: '0.7rem 1.6rem' }}>
            {t('mc_str_new')}
          </button>
        </div>
      ) : (
        <>
          {/* Estadísticas de la semana: lo que importa de un vistazo, no el
              acumulado histórico. */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rk-card" style={{ padding: '18px 12px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(24px,5vw,34px)', lineHeight: 1, color: weekStats.sessionsThisWeek >= 4 ? '#22c55e' : '#fff', margin: 0 }}>
                {weekStats.sessionsThisWeek}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1.5 leading-tight">{t('mc_str_week_sessions')}</p>
            </div>
            <div className="rk-card" style={{ padding: '18px 12px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(24px,5vw,34px)', lineHeight: 1, color: weekStats.movers.length > 0 ? '#E10600' : '#fff', margin: 0 }}>
                {weekStats.movers.length > 0 ? '🏆 ' : ''}{weekStats.movers.length}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1.5 leading-tight">{t('mc_str_week_prs')}</p>
            </div>
            <div className="rk-card flex flex-col items-center" style={{ padding: '18px 12px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(24px,5vw,34px)', lineHeight: 1, color: '#C9A84C', margin: 0 }}>
                {weekStats.avgVolume.toLocaleString(locale)}<span className="text-xs text-zinc-500 ml-1">kg</span>
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1.5 leading-tight">{t('mc_str_avg_volume')}</p>
              {weekStats.sparkline.length >= 2 && <div className="mt-1.5"><Sparkline values={weekStats.sparkline} color="#C9A84C" /></div>}
            </div>
          </div>

          {/* Análisis semanal: 2-3 líneas, derivadas de los datos reales */}
          {analysisLines.length > 0 && (
            <div className="rk-card space-y-1.5" style={{ padding: '14px 18px', transform: 'none' }}>
              {analysisLines.map((l) => (
                <p key={l.text} className="text-xs font-semibold flex items-center gap-2" style={{ color: l.color }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: l.color }} />{l.text}
                </p>
              ))}
            </div>
          )}

          {/* Tus mejores esta semana (top 3 con más subida) */}
          {weekStats.movers.length > 0 && (
            <div>
              <h3 className="rk-h3 mb-3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_str_best_this_week')}</h3>
              <div className="grid sm:grid-cols-3 gap-2.5">
                {weekStats.movers.slice(0, 3).map((m, i) => (
                  <Reveal key={m.exercise} delay={i * 50}>
                    <button onClick={() => setSelected(m.exercise)} className="w-full text-left rk-card cursor-pointer" style={{ padding: '14px 16px' }}>
                      <p className="text-sm font-bold text-white truncate">{m.label}</p>
                      <p className="text-xs text-zinc-400 mt-1">{m.before}kg → <span className="text-white font-bold">{m.now}kg</span></p>
                      <span className="inline-block mt-1.5 text-[11px] font-bold text-green-400 bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded-full">↑ +{m.gain}kg</span>
                    </button>
                  </Reveal>
                ))}
              </div>
            </div>
          )}

          {/* Tus ejercicios: agrupados por grupo muscular, con cabecera de la
              última sesión y filtro por grupo. Cada card: última sesión,
              progreso vs la anterior, mini tendencia, historial y sugerencia. */}
          <div>
            {/* Hoy entrenaste: Espalda + Tríceps */}
            {lastSessionGroups.length > 0 && (
              <p className="text-sm mb-3">
                <span className="text-zinc-500">{t('mc_str_today_trained')}: </span>
                <span className="font-bold text-white">{lastSessionGroups.map((g) => t(`mc_str_mg_${g}`)).join(' + ')}</span>
              </p>
            )}

            <div className="flex items-center gap-2 mb-3">
              <i className="ri-trophy-line text-[#C9A84C]"></i>
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_str_all_exercises')}</h3>
            </div>

            {/* Filtro por grupo muscular (solo si hay más de un grupo) */}
            {groupsPresent.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto rk-noscroll-x pb-1 mb-3">
                {(['all', ...groupsPresent] as (MuscleGroup | 'other' | 'all')[]).map((g) => (
                  <button key={g} onClick={() => setGroupFilter(g)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${groupFilter === g ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}>
                    {t(`mc_str_mg_${g}`)}
                  </button>
                ))}
              </div>
            )}

            {groupFilter === 'all' ? (
              <div className="space-y-5">
                {groupsPresent.map((g) => {
                  const inGroup = exercisesWithGroup.filter((e) => e.group === g);
                  if (inGroup.length === 0) return null;
                  return (
                    <div key={g}>
                      {/* Solo mostramos la cabecera de grupo si hay más de uno */}
                      {groupsPresent.length > 1 && (
                        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-zinc-500 mb-2">{t(`mc_str_mg_${g}`)}</p>
                      )}
                      <div className="space-y-2.5">
                        {inGroup.map((e, i) => renderExerciseCard(e.key, e.label, i))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2.5">
                {exercisesWithGroup.filter((e) => e.group === groupFilter).map((e, i) => renderExerciseCard(e.key, e.label, i))}
              </div>
            )}
          </div>

          {/* Progresión */}
          <div className="rk-card" style={{ padding: '20px', transform: 'none' }}>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_str_progress')}</h3>
              {gain !== null && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${gain > 0 ? 'text-green-400 bg-green-500/10 border-green-500/25' : 'text-zinc-400 bg-white/[0.04] border-white/10'}`}>
                  {gain > 0 ? '▲ ' : ''}{t('mc_str_gain', { n: gain })}
                </span>
              )}
            </div>

            {/* Selector de ejercicio: scroll horizontal, cómodo en móvil */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 rk-noscroll-x">
              {exercises.map(([ex, label]) => (
                <button key={ex} onClick={() => setSelected(ex)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${selected === ex ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>

            {progression.length < 2 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">{t('mc_str_no_chart')}</p>
            ) : (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={progression} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="strgrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb923c" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} minTickGap={24} />
                    <YAxis domain={['dataMin - 5', 'dataMax + 5']} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={36} />
                    <Tooltip contentStyle={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontSize: 12 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.5)' }} formatter={(v: number) => [`${v} kg`, '']} />
                    <Area type="monotone" dataKey="kg" stroke="#fb923c" strokeWidth={2.5} fill="url(#strgrad)" dot={{ r: 3, fill: '#fb923c' }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Historial */}
          <div>
            <h3 className="rk-h3 mb-3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_str_history')}</h3>
            <div className="space-y-2">
              {history.map((h) => {
                const vol = Math.round(h.sets.reduce((a, s) => a + Number(s.weight_kg) * s.reps, 0));
                return (
                  <div key={h.key} className="rk-card group" style={{ padding: '14px 16px' }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white">{h.label}</p>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(h.date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {h.sets.map((s) => (
                            <span key={s.id} className="text-[11px] font-semibold text-zinc-300 bg-white/[0.05] border border-white/10 px-2 py-1 rounded-lg">
                              {fmtReps(s.reps, s.reps_max)} × {Number(s.weight_kg)} kg
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-1.5">{t('mc_str_volume')}: {vol.toLocaleString(locale)} kg</p>
                      </div>
                      <button onClick={() => removeSession(h.date, h.sets[0].exercise)} aria-label={t('mc_delete')}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
            <i className="ri-information-line mt-0.5 flex-shrink-0"></i>{t('mc_str_1rm_note')}
          </p>
        </>
      )}

      {/* Modal de registro (bottom sheet con botón Guardar fijo al pie) */}
      <BottomSheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('mc_str_new')}
        footer={
          <button onClick={save} disabled={saving} style={{ minHeight: 48 }}
            className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" >
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
              : <><i className="ri-hammer-line"></i> {t('mc_str_save')}</>}
          </button>
        }
      >
        {/* ── Entrada rápida: escribir o dictar una sesión entera ── */}
        <div className="rounded-2xl border border-red-500/25 bg-red-600/[0.06] p-4 mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-300 flex items-center gap-1.5">
              <i className="ri-flashlight-line"></i>{t('mc_str_quick_entry')}
            </p>
            <VoiceButton onResult={applyStrengthDictation} />
          </div>
          <div className="flex gap-2">
            <input value={freeText} onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && freeText.trim()) { e.preventDefault(); applyStrengthDictation(freeText.trim()); setFreeText(''); } }}
              placeholder={t('mc_str_freetext_ph')} style={{ fontSize: 16, minHeight: 44 }}
              className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
            <button type="button" onClick={() => { if (freeText.trim()) { applyStrengthDictation(freeText.trim()); setFreeText(''); } }}
              disabled={!freeText.trim()} style={{ minHeight: 44 }}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors">
              <i className="ri-magic-line"></i> {t('mc_str_freetext_apply')}
            </button>
          </div>
        </div>

        {interpreted && (
          <p className="text-[11px] text-red-400 flex items-center gap-1.5 mb-3"><i className="ri-sparkling-line"></i>{t('mc_vo_interpreted')}</p>
        )}

        {/* Separador: o rellena el formulario a mano */}
        <div className="flex items-center gap-3 mb-4">
          <span className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">{t('mc_str_or_manual')}</span>
          <span className="flex-1 h-px bg-white/[0.08]" />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_str_exercise')}</label>
            <input value={exercise}
              onChange={(e) => { setExercise(e.target.value); setExOpen(true); }}
              onFocus={() => setExOpen(true)}
              maxLength={50} style={{ fontSize: 16, minHeight: 44 }}
              placeholder={t('mc_str_exercise_ph')}
              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500" />

            {/* Filtro por grupo muscular para acotar la lista. */}
            <div className="flex gap-1.5 overflow-x-auto rk-noscroll-x mt-2 pb-0.5">
              {groupTabs.map((g) => (
                <button key={g} onMouseDown={(e) => e.preventDefault()} onClick={() => { setGroup(g); setExOpen(true); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${group === g ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}>
                  {t(`mc_str_mg_${g}`)}
                </button>
              ))}
            </div>

            {/* Lista de ejercicios del grupo / sugerencias del buscador. */}
            {exOpen && exSuggestions.length > 0 && (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-1.5 max-h-44 overflow-y-auto rk-noscroll-x">
                {exSuggestions.map((c) => (
                  <button key={c} onMouseDown={(e) => e.preventDefault()} onClick={() => { setExercise(c); setExOpen(false); }}
                    className="w-full text-left text-sm text-zinc-300 hover:text-white hover:bg-white/[0.05] px-3 py-2 rounded-lg cursor-pointer flex items-center gap-2">
                    <i className="ri-search-line text-xs text-zinc-600"></i>{c}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-zinc-600 mt-1.5">{t('mc_str_custom_hint')}</p>

            {/* Qué hiciste la última vez con este ejercicio. */}
            {formExKey && lastFor && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('mc_str_last_time')}</span>
                  <span className="text-[10px] text-zinc-600">· {agoLabel(lastFor.date)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {lastFor.sets.map((s) => (
                    <span key={s.id} className="text-[11px] font-semibold text-zinc-300 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-lg">
                      {fmtReps(s.reps, s.reps_max)} × {Number(s.weight_kg)} kg
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendación de carga, discreta y orientativa (no médica). */}
            {formExKey && recommendation && (
              <div className="mt-2 rounded-xl border border-[#C9A84C]/25 bg-[#C9A84C]/[0.06] px-3.5 py-2.5 flex items-start gap-2.5">
                <i className="ri-lightbulb-flash-line text-[#C9A84C] text-sm mt-0.5 flex-shrink-0"></i>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C]">{t('mc_str_rec_title')}</p>
                  <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                    {recommendation.kind === 'up'
                      ? t('mc_str_rec_up', { n: recommendation.n, w: recommendation.w, ex: recommendation.ex, next: recommendation.next })
                      : t('mc_str_rec_hold', { ex: recommendation.ex })}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-1">{t('mc_str_rec_note')}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_str_date')}</label>
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)}
              style={{ fontSize: 16, minHeight: 44 }}
              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 cursor-pointer" />
          </div>

          {/* Series: reps (o rango "mín a máx") + peso con decimales. */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_str_sets')}</label>
            {/* Cabecera de columnas */}
            <div className="flex items-center gap-1.5 px-1 mb-1.5">
              <span className="w-6 flex-shrink-0" />
              <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 text-center">{t('mc_str_reps')}</span>
              <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 text-center">{t('mc_str_weight')}</span>
              {sets.length > 1 && <span className="w-9 flex-shrink-0" />}
            </div>
            <div className="space-y-2">
              {sets.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-6 flex-shrink-0 text-center text-[11px] font-bold text-zinc-500">{i + 1}</span>
                  {/* Reps: valor fijo o rango (máx opcional) */}
                  <div className="flex-1 min-w-0 flex items-center gap-1">
                    <input value={s.reps} inputMode="numeric" placeholder={t('mc_str_reps_min_ph')} style={{ fontSize: 16 }}
                      onChange={(e) => setSets((p) => p.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))}
                      className="w-full min-w-0 bg-white/[0.04] border border-white/10 text-white text-center rounded-xl px-2 py-3 focus:outline-none focus:border-red-500" />
                    <span className="text-[11px] text-zinc-600 flex-shrink-0">{t('mc_str_reps_to')}</span>
                    <input value={s.repsMax} inputMode="numeric" placeholder={t('mc_str_reps_max_ph')} style={{ fontSize: 16 }}
                      onChange={(e) => setSets((p) => p.map((x, j) => j === i ? { ...x, repsMax: e.target.value } : x))}
                      className="w-full min-w-0 bg-white/[0.04] border border-white/10 text-white text-center rounded-xl px-2 py-3 focus:outline-none focus:border-red-500 placeholder:text-zinc-600" />
                  </div>
                  {/* Peso (admite decimales, coma o punto) */}
                  <div className="flex-1 min-w-0 relative">
                    <input value={s.weight} inputMode="decimal" placeholder="0" style={{ fontSize: 16 }}
                      onChange={(e) => setSets((p) => p.map((x, j) => j === i ? { ...x, weight: e.target.value } : x))}
                      className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl pl-3 pr-9 py-3 focus:outline-none focus:border-red-500" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">kg</span>
                  </div>
                  {sets.length > 1 && (
                    <button onClick={() => setSets((p) => p.filter((_, j) => j !== i))}
                      aria-label={t('mc_str_remove_set')}
                      className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer">
                      <i className="ri-close-line"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setSets((p) => [...p, { reps: p[p.length - 1]?.reps || '8', repsMax: p[p.length - 1]?.repsMax || '', weight: p[p.length - 1]?.weight || '' }])}
              style={{ minHeight: 44 }}
              className="w-full mt-2 flex items-center justify-center gap-2 text-xs font-bold text-zinc-300 bg-white/[0.03] border border-white/10 hover:border-white/25 rounded-xl cursor-pointer transition-colors">
              <i className="ri-add-line"></i> {t('mc_str_add_set')}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Revisión del dictado de sesión completa (varios ejercicios) */}
      {multi && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setMulti(null); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            style={{ padding: 24, transform: 'none', paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>{t('mc_str_voice_multi_title')}</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs">{t('mc_str_voice_multi_sub')}</p>
              </div>
              <button onClick={() => setMulti(null)} aria-label={t('mc_close')}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {multi.map((r, i) => {
                const upd = (patch: Partial<MultiRow>) => setMulti((m) => m!.map((x, j) => j === i ? { ...x, ...patch } : x));
                return (
                  <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-red-600/12 border border-red-500/25 text-red-400 text-[11px] font-bold">{i + 1}</span>
                      <input value={r.exercise} onChange={(e) => upd({ exercise: e.target.value })}
                        placeholder={t('mc_str_exercise_ph')}
                        className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-500" />
                      <button onClick={() => setMulti((m) => { const n = m!.filter((_, j) => j !== i); return n.length ? n : null; })}
                        aria-label={t('mc_str_voice_discard')}
                        className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1 min-w-0">
                        <input value={r.sets} inputMode="numeric" onChange={(e) => upd({ sets: e.target.value })}
                          className="w-full bg-white/[0.04] border border-white/10 text-white text-sm text-center rounded-lg px-2 py-2 focus:outline-none focus:border-red-500" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-zinc-500 uppercase">{t('mc_str_sets')}</span>
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-1">
                        <input value={r.reps} inputMode="numeric" placeholder={t('mc_str_reps_min_ph')} onChange={(e) => upd({ reps: e.target.value })}
                          className="w-full min-w-0 bg-white/[0.04] border border-white/10 text-white text-sm text-center rounded-lg px-1.5 py-2 focus:outline-none focus:border-red-500" />
                        <span className="text-[11px] text-zinc-600 flex-shrink-0">{t('mc_str_reps_to')}</span>
                        <input value={r.repsMax} inputMode="numeric" placeholder={t('mc_str_reps_max_ph')} onChange={(e) => upd({ repsMax: e.target.value })}
                          className="w-full min-w-0 bg-white/[0.04] border border-white/10 text-white text-sm text-center rounded-lg px-1.5 py-2 focus:outline-none focus:border-red-500 placeholder:text-zinc-600" />
                      </div>
                      <div className="relative flex-1 min-w-0">
                        <input value={r.weight} inputMode="decimal" placeholder="0" onChange={(e) => upd({ weight: e.target.value })}
                          className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg pl-2.5 pr-7 py-2 focus:outline-none focus:border-red-500" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-zinc-500">kg</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setMulti(null)}
                className="flex-1 rk-btn rk-btn-ghost" style={{ fontSize: '0.85rem' }}>
                {t('mc_str_voice_discard')}
              </button>
              <button onClick={saveMulti} disabled={savingMulti}
                className="flex-[2] rk-btn rk-btn-primary flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem' }}>
                {savingMulti
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
                  : <><i className="ri-save-line"></i> {t('mc_str_voice_save_all')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .rk-noscroll-x::-webkit-scrollbar { display: none; }
        .rk-noscroll-x { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
