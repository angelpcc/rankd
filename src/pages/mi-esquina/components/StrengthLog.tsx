import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable, isMissingColumn } from '@/lib/dbState';
import { MUSCLE_GROUPS, muscleGroupOf, type MuscleGroup } from '../lib/exercises';
import Reveal from '@/components/base/Reveal';
import MuscleMap, { type MapGroup, type TrainState } from './MuscleMap';
import StrengthSessionForm, { type BuiltSession } from './StrengthSessionForm';
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
  muscle_group: string | null;
  created_at: string;
}

type GroupKey = MuscleGroup | 'other';
const ORDER: GroupKey[] = [...MUSCLE_GROUPS, 'other'];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Muestra las repeticiones: "8" (fijas) o "8–10" (rango, datos antiguos). */
function fmtReps(reps: number, repsMax: number | null | undefined): string {
  return repsMax && repsMax > reps ? `${reps}–${repsMax}` : String(reps);
}

interface SessExercise { exercise: string; label: string; sets: StrengthSet[] }
interface SessGroup { group: GroupKey; exercises: SessExercise[]; volume: number }
interface DaySession { date: string; groups: SessGroup[]; exerciseCount: number; groupKeys: GroupKey[]; volume: number }

/**
 * Registro de fuerza por SESIÓN (rediseño 2026-08).
 *
 * El registro va en 3 pasos (grupos → ejercicios por grupo → guardar), en
 * StrengthSessionForm. Aquí se muestran las sesiones guardadas: historial por
 * días agrupado por grupo muscular con su volumen, y la progresión por ejercicio.
 * Sigue guardando UNA FILA POR SERIE en strength_sets; nada se almacena derivado.
 */
export default function StrengthLog({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [rows, setRows] = useState<StrengthSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState('');
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [openEx, setOpenEx] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  // Signature moment: destello full-screen cuando se bate marca personal.
  const [showPRFlash, setShowPRFlash] = useState(false);
  // Grupo muscular seleccionado en el mapa: filtra la progresión y resalta las
  // sesiones que lo trabajaron. null = sin filtro.
  const [mapFilter, setMapFilter] = useState<MapGroup | null>(null);

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
    if (list.length) setSelected((cur) => cur || list[0].exercise);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

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

  const exerciseList = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.exercise, r.exercise_label));
    return [...m.entries()];
  }, [rows]);

  // ── Sesiones por día, agrupadas por grupo muscular ──
  const sessions = useMemo<DaySession[]>(() => {
    const byDate = new Map<string, StrengthSet[]>();
    rows.forEach((r) => { const l = byDate.get(r.session_date) || []; l.push(r); byDate.set(r.session_date, l); });
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, sets]) => {
        const byGroup = new Map<GroupKey, StrengthSet[]>();
        sets.forEach((r) => { const g = groupOfRow(r); const l = byGroup.get(g) || []; l.push(r); byGroup.set(g, l); });
        const groups: SessGroup[] = ORDER.filter((g) => byGroup.has(g)).map((g) => {
          const gsets = byGroup.get(g)!;
          const byEx = new Map<string, StrengthSet[]>();
          gsets.forEach((r) => { const l = byEx.get(r.exercise) || []; l.push(r); byEx.set(r.exercise, l); });
          const exercises: SessExercise[] = [...byEx.entries()].map(([ex, es]) => ({
            exercise: ex, label: es[0].exercise_label, sets: [...es].sort((a, b) => a.set_number - b.set_number),
          }));
          const volume = Math.round(gsets.reduce((a, r) => a + Number(r.weight_kg) * r.reps, 0));
          return { group: g, exercises, volume };
        });
        const exerciseCount = groups.reduce((a, g) => a + g.exercises.length, 0);
        const volume = groups.reduce((a, g) => a + g.volume, 0);
        return { date, groups, exerciseCount, groupKeys: groups.map((g) => g.group), volume };
      });
  }, [rows, groupOfRow]);

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

  // Ejercicios del selector de progresión, filtrados por el grupo del mapa.
  const progExercises = useMemo(() => {
    if (!mapFilter) return exerciseList;
    const keys = new Set(ownExercises.filter((e) => e.group === mapFilter).map((e) => e.label));
    return exerciseList.filter(([, label]) => keys.has(label));
  }, [exerciseList, ownExercises, mapFilter]);

  // Al filtrar por un grupo, si el ejercicio de la progresión no es de ese grupo,
  // salta al primero que sí lo sea.
  useEffect(() => {
    if (mapFilter && progExercises.length && !progExercises.some(([ex]) => ex === selected)) {
      setSelected(progExercises[0][0]);
    }
  }, [mapFilter, progExercises, selected]);

  // ── Progresión del ejercicio elegido: mejor peso por sesión ──
  const progression = useMemo(() => {
    if (!selected) return [];
    const byDate = new Map<string, number>();
    rows.filter((r) => r.exercise === selected).forEach((r) => {
      byDate.set(r.session_date, Math.max(byDate.get(r.session_date) ?? 0, Number(r.weight_kg)));
    });
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, kg]) => ({ date: new Date(d + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }), kg }));
  }, [rows, selected, locale]);

  const gain = progression.length >= 2 ? +(progression[progression.length - 1].kg - progression[0].kg).toFixed(1) : null;

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

  // Si el Plan IA tenía algo agendado para el día de la sesión, márcalo hecho.
  // Filtro por source='ai' para no tocar entradas planificadas a mano por el
  // usuario. Best-effort y silencioso: si la migración 0021 no está aplicada,
  // `source` no existe y no marcamos nada (mejor omitir que marcar de más).
  const markPlanDayDone = async (sessionDate: string) => {
    try {
      const { error } = await supabase.from('planned_events')
        .update({ done: true })
        .eq('fighter_profile_id', profile.id)
        .eq('event_date', sessionDate)
        .eq('source', 'ai')
        .eq('done', false);
      if (error && isMissingColumn(error)) return;  // 0021 pending → no-op
    } catch { /* silencioso: no bloqueamos el guardado por esto */ }
  };

  const saveSession = async (session: BuiltSession) => {
    // reps_max = null cuando la serie es "8" (fijo); = 10 cuando es "8-10".
    // Solo se envía si la fila NEW lo trae; la degradación por si la
    // migración 0026 aún no está aplicada vive más abajo.
    const base = session.blocks.flatMap((b) =>
      b.exercises.flatMap((e) => e.sets.map((s, i) => ({
        fighter_profile_id: profile.id,
        exercise: normalize(e.label),
        exercise_label: e.label.trim(),
        session_date: session.date,
        set_number: i + 1,
        reps: s.reps,
        reps_max: s.repsMax ?? null,
        weight_kg: s.weight,
        muscle_group: b.group,
      }))),
    );
    if (base.length === 0) return;

    // ── Detección de récord personal antes de insertar ──
    // Se compara cada peso nuevo con el máximo histórico del mismo ejercicio.
    // Solo se marca PR si el histórico ya existía (evita "PR" en la 1ª sesión).
    const bestByExercise = new Map<string, number>();
    rows.forEach((r) => {
      const cur = bestByExercise.get(r.exercise) ?? 0;
      if (Number(r.weight_kg) > cur) bestByExercise.set(r.exercise, Number(r.weight_kg));
    });
    const isPR = base.some((s) => {
      const prev = bestByExercise.get(s.exercise);
      return prev !== undefined && prev > 0 && s.weight_kg > prev;
    });

    setSaving(true);
    // Insert con las columnas nuevas (muscle_group de 0029, reps_max de 0026).
    // Si cualquiera de las dos migraciones no está aplicada, isMissingColumn
    // lo detecta y se reintenta sin ellas: la sesión se guarda igual
    // (el grupo se deriva del nombre y el rango se pierde como fijo).
    let { data, error } = await supabase.from('strength_sets').insert(base).select();
    if (isMissingColumn(error)) {
      const noExtras = base.map(({ muscle_group, reps_max, ...r }) => r);
      ({ data, error } = await supabase.from('strength_sets').insert(noExtras).select());
    }
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }

    const inserted = (data as StrengthSet[]).map((r) => ({ ...r, reps_max: r.reps_max ?? null, muscle_group: r.muscle_group ?? null }));
    setRows((prev) => [...inserted, ...prev]);
    setShowForm(false);
    setFormKey((k) => k + 1);
    if (!selected) setSelected(base[0].exercise);

    const groupNames = session.blocks.map((b) => t(`mc_str_mg_${b.group}`)).join(' + ');
    const exCount = session.blocks.reduce((a, b) => a + b.exercises.length, 0);
    showToast(t('mc_str_session_saved', { groups: groupNames, n: exCount }));
    void logToAgenda(session.date, session.blocks.flatMap((b) => b.exercises.map((e) => e.label)));
    // Si había un día del Plan IA agendado para esta fecha, se marca hecho.
    void markPlanDayDone(session.date);

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

  const groupLabels = (keys: GroupKey[]) => keys.map((g) => t(`mc_str_mg_${g}`)).join(' + ');

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">{t('mc_str_eyebrow')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            {t('mc_str_title')} <span className="rk-red-glow">{t('mc_str_title_2')}</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_str_sub')}</p>
        </div>
        <button onClick={() => setShowForm(true)}
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
          <button onClick={() => setShowForm(true)} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem', padding: '0.7rem 1.6rem' }}>
            {t('mc_str_new')}
          </button>
        </div>
      ) : (
        <>
          {/* ── MAPA MUSCULAR (bloque C.3): qué has entrenado, tocable para filtrar ── */}
          <MuscleMap status={groupStatus} selected={mapFilter}
            onSelect={(g) => setMapFilter((cur) => (cur === g ? null : g))} />

          {/* ── HISTORIAL POR DÍAS ── */}
          <div>
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_str_history')}</h3>
              {mapFilter && (
                <button onClick={() => setMapFilter(null)}
                  className="text-[11px] font-bold text-[#C9A84C] flex items-center gap-1 cursor-pointer">
                  {t(`mc_str_mg_${mapFilter}`)} <i className="ri-close-line"></i>
                </button>
              )}
            </div>
            <div className="space-y-2.5">
              {sessions.map((s, i) => {
                const isOpen = openDay === s.date;
                const inFilter = !mapFilter || s.groupKeys.includes(mapFilter);
                return (
                  <Reveal key={s.date} delay={Math.min(i, 6) * 40}>
                    <div className="rk-card" style={{ padding: 0, overflow: 'hidden', opacity: inFilter ? 1 : 0.4, borderColor: mapFilter && inFilter ? 'rgba(201,168,76,0.35)' : undefined, transition: 'opacity 0.2s' }}>
                      {/* Cabecera de la sesión */}
                      <button onClick={() => { setOpenDay(isOpen ? null : s.date); setOpenEx(null); }}
                        className="w-full text-left flex items-center gap-3 px-4 py-3.5 cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white">
                            {fmtDate(s.date)} <span className="text-zinc-500 font-normal">· {agoLabel(s.date)}</span>
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5 truncate">
                            {groupLabels(s.groupKeys)} · {t('mc_str_ex_count', { count: s.exerciseCount })}
                          </p>
                        </div>
                        <i className={`ri-arrow-down-s-line text-zinc-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                      </button>

                      {/* Detalle agrupado por grupo muscular */}
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-4 border-t border-white/[0.06] pt-3">
                          {s.groups.map((g) => (
                            <div key={g.group}>
                              <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-red-400 mb-2">{t(`mc_str_mg_${g.group}`)}</p>
                              <div className="space-y-1">
                                {g.exercises.map((ex) => {
                                  const exOpen = openEx === `${s.date}|${ex.exercise}`;
                                  const maxW = Math.max(...ex.sets.map((x) => Number(x.weight_kg)));
                                  const hist = exOpen ? historyOf(ex.exercise) : [];
                                  return (
                                    <div key={ex.exercise}>
                                      <button onClick={() => setOpenEx(exOpen ? null : `${s.date}|${ex.exercise}`)}
                                        className="w-full flex items-center gap-3 py-1.5 text-left cursor-pointer group">
                                        <span className="flex-1 min-w-0 text-sm text-zinc-200 truncate group-hover:text-white">{ex.label}</span>
                                        <span className="text-sm font-semibold text-zinc-300 flex-shrink-0" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                          {ex.sets.length}×{fmtReps(ex.sets[0].reps, ex.sets[0].reps_max)} <span className="text-zinc-600">@</span> {maxW} kg
                                        </span>
                                        <i className={`ri-arrow-down-s-line text-xs text-zinc-600 flex-shrink-0 transition-transform ${exOpen ? 'rotate-180' : ''}`}></i>
                                      </button>
                                      {exOpen && (
                                        <div className="pl-1 pb-2 space-y-2">
                                          {/* Series individuales */}
                                          <div className="flex flex-wrap gap-1.5">
                                            {ex.sets.map((st) => (
                                              <span key={st.id} className="text-[11px] font-semibold text-zinc-300 bg-white/[0.05] border border-white/10 px-2 py-1 rounded-lg">
                                                {fmtReps(st.reps, st.reps_max)} × {Number(st.weight_kg)} kg
                                              </span>
                                            ))}
                                          </div>
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
                              <p className="text-[11px] text-zinc-600 mt-1.5">{t('mc_str_vol_group', { group: t(`mc_str_mg_${g.group}`) })}: {g.volume.toLocaleString(locale)} kg</p>
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

          {/* ── PROGRESIÓN ── (card primaria: 1 por pantalla) */}
          <div className="card-primary" style={{ padding: '22px' }}>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_str_progress')}</h3>
              {gain !== null && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${gain > 0 ? 'text-green-400 bg-green-500/10 border-green-500/25' : 'text-zinc-400 bg-white/[0.04] border-white/10'}`}>
                  {gain > 0 ? '▲ ' : ''}{t('mc_str_gain', { n: gain })}
                </span>
              )}
            </div>

            {/* Selector de ejercicio · pill (rk-nav-btn) para diferenciar de CTAs.
                Filtrado por el grupo del mapa muscular si hay uno seleccionado. */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 rk-noscroll-x">
              {progExercises.map(([ex, label]) => (
                <button key={ex} onClick={() => setSelected(ex)}
                  className={`rk-nav-btn text-xs font-bold whitespace-nowrap ${selected === ex ? 'is-active' : ''}`}
                  style={{ padding: '0.4rem 0.9rem' }}>
                  {label}
                </button>
              ))}
              {progExercises.length === 0 && (
                <p className="text-xs text-zinc-500 py-2">{t('mc_str_map_no_ex')}</p>
              )}
            </div>

            {progression.length < 2 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">{t('mc_str_no_chart')}</p>
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

          <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
            <i className="ri-information-line mt-0.5 flex-shrink-0"></i>{t('mc_str_1rm_note')}
          </p>
        </>
      )}

      {/* Formulario de registro (3 pasos). key = remonta y limpia tras guardar. */}
      <StrengthSessionForm
        key={formKey}
        open={showForm}
        onClose={() => setShowForm(false)}
        saving={saving}
        onSave={saveSession}
        ownExercises={ownExercises}
        showToast={showToast}
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
