import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import BottomSheet from '@/components/base/BottomSheet';
import {
  MUSCLE_GROUPS, exercisesByGroup, weightModeOf, trackingModeOf, usesBar,
  type MuscleGroup, type WeightMode,
} from '../lib/exercises';
import { parseRepsInput } from './StrengthSessionForm';
import type { ExerciseSpec } from '../lib/dayPlan';
import PlateCalculator from './PlateCalculator';

interface Props {
  open: boolean;
  onClose: () => void;
  fighterProfileId: string;
  /** Guarda el bloque de fuerza planificado en day_plan_items. */
  onSave: (payload: { groups: string[]; exercises: ExerciseSpec[] }) => Promise<void>;
  /** Grupo con el que abrir ya elegido (del muñeco / bloque). */
  initialGroup?: MuscleGroup;
}

interface PSet { primary: string; weight: string }  // primary = reps | segundos | metros
interface PExercise {
  id: string;
  name: string;
  query: string;
  open: boolean;
  sets: PSet[];
  hist?: { label: string } | null;
}
interface PBlock { group: MuscleGroup; exercises: PExercise[] }

const uid = () => Math.random().toString(36).slice(2, 9);
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

function weightLabelKey(mode: WeightMode): string {
  switch (mode) {
    case 'per_side': return 'mc_str_wlabel_per_side';
    case 'per_dumbbell': return 'mc_str_wlabel_per_dumbbell';
    case 'bodyweight': return 'mc_str_wlabel_bodyweight';
    default: return 'mc_str_wlabel_total';
  }
}

export default function StrengthPlanBuilder({ open, onClose, fighterProfileId, onSave, initialGroup }: Props) {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';

  const [step, setStep] = useState<1 | 2>(initialGroup ? 2 : 1);
  const [blocks, setBlocks] = useState<PBlock[]>(initialGroup ? [{ group: initialGroup, exercises: [] }] : []);
  const [saving, setSaving] = useState(false);
  const [plateFor, setPlateFor] = useState<{ group: MuscleGroup; id: string; si: number } | null>(null);

  const selectedGroups = useMemo(() => new Set(blocks.map((b) => b.group)), [blocks]);

  const reset = () => { setStep(initialGroup ? 2 : 1); setBlocks(initialGroup ? [{ group: initialGroup, exercises: [] }] : []); };
  const handleClose = () => { reset(); onClose(); };

  const toggleGroup = (g: MuscleGroup) => {
    setBlocks((prev) => {
      if (prev.some((b) => b.group === g)) return prev.filter((b) => b.group !== g);
      const next = [...prev, { group: g, exercises: [] as PExercise[] }];
      next.sort((a, b) => MUSCLE_GROUPS.indexOf(a.group) - MUSCLE_GROUPS.indexOf(b.group));
      return next;
    });
  };

  const patchEx = (group: MuscleGroup, id: string, patch: Partial<PExercise>) =>
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id ? { ...e, ...patch } : e) } : b));

  const addExercise = (group: MuscleGroup) =>
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: [...b.exercises, { id: uid(), name: '', query: '', open: true, sets: [{ primary: '', weight: '' }] }] } : b));

  const removeExercise = (group: MuscleGroup, id: string) =>
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.filter((e) => e.id !== id) } : b));

  const patchSet = (group: MuscleGroup, id: string, si: number, patch: Partial<PSet>) =>
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id
          ? { ...e, sets: e.sets.map((s, j) => j === si ? { ...s, ...patch } : s) } : e) } : b));

  const addSet = (group: MuscleGroup, id: string) =>
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id
          ? { ...e, sets: [...e.sets, { ...(e.sets[e.sets.length - 1] || { primary: '', weight: '' }) }] } : e) } : b));

  const removeSet = (group: MuscleGroup, id: string, si: number) =>
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id
          ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e) } : b));

  // ── Peso sugerido: última vez que se registró ese ejercicio ──
  const applyHistory = async (group: MuscleGroup, id: string, name: string) => {
    const key = norm(name);
    if (!key) { patchEx(group, id, { hist: null }); return; }
    const { data } = await supabase.from('strength_sets')
      .select('session_date, set_number, reps, reps_max, weight_kg, weight_mode, tracking_mode')
      .eq('fighter_profile_id', fighterProfileId).eq('exercise', key)
      .order('session_date', { ascending: false }).limit(20);
    const rows = (data || []) as { session_date: string; reps: number; reps_max: number | null; weight_kg: number; weight_mode: string | null; tracking_mode: string | null }[];
    if (rows.length === 0) { patchEx(group, id, { hist: null }); return; }
    const lastDate = rows[0].session_date;
    const lastSets = rows.filter((r) => r.session_date === lastDate);
    const tm = trackingModeOf(name);
    const w = Math.max(...lastSets.map((r) => Number(r.weight_kg) || 0));
    const primary = tm === 'reps'
      ? (lastSets[0].reps_max && lastSets[0].reps_max > lastSets[0].reps ? `${lastSets[0].reps}-${lastSets[0].reps_max}` : String(lastSets[0].reps))
      : String(lastSets[0].reps);
    // Rellena todas las series con el mismo valor sugerido.
    setBlocks((prev) => prev.map((b) => b.group === group
      ? { ...b, exercises: b.exercises.map((e) => e.id === id
          ? { ...e, sets: Array.from({ length: Math.max(1, lastSets.length) }, () => ({ primary, weight: w > 0 ? String(w) : '' })) }
          : e) } : b));
    const days = Math.floor((Date.now() - new Date(lastDate + 'T12:00:00').getTime()) / 86400000);
    const ago = days <= 0 ? t('mc_str_today') : days === 1 ? t('mc_str_yesterday') : t('mc_str_days_ago', { n: days });
    const countLabel = tm === 'time' ? `${lastSets.length}×${primary} ${t('mc_str_unit_sec')}`
      : tm === 'distance' ? `${lastSets.length}×${primary} ${t('mc_str_unit_m')}`
      : `${lastSets.length}×${primary}`;
    const wLabel = w > 0 ? ` · ${w} kg` : '';
    patchEx(group, id, { hist: { label: t('mc_str_last_time_detail', { detail: `${countLabel}${wLabel} · ${ago}` }) } });
  };

  const suggestFor = (group: MuscleGroup, query: string): string[] => {
    const pool = exercisesByGroup(group, lang);
    const q = norm(query);
    return (q ? pool.filter((x) => norm(x).includes(q) && norm(x) !== q) : pool).slice(0, 20);
  };

  const submit = async () => {
    const out: ExerciseSpec[] = [];
    const groupsUsed = new Set<string>();
    for (const b of blocks) {
      for (const e of b.exercises) {
        const name = e.name.trim();
        if (!name) continue;
        const tm = trackingModeOf(name);
        const wm = weightModeOf(name);
        // Nº de series = las que tengan valor primario; si ninguna, cuenta las filas.
        const filled = e.sets.filter((s) => s.primary.trim() !== '');
        const setsArr = filled.length > 0 ? filled : e.sets;
        const sets = setsArr.length;
        if (sets === 0) continue;
        const first = setsArr[0];
        const weightKg = parseFloat((first.weight || '').replace(',', '.'));
        const spec: ExerciseSpec = { name, sets, weight_mode: wm, tracking_mode: tm };
        if (weightKg > 0) spec.weight_kg = weightKg;
        if (tm === 'reps') {
          const parsed = parseRepsInput(first.primary) || { reps: 0 };
          spec.reps_min = parsed.reps || undefined;
          if (parsed.repsMax) spec.reps_max = parsed.repsMax;
        } else {
          const v = parseInt(first.primary, 10);
          if (v > 0) spec.value = v;
        }
        out.push(spec);
        groupsUsed.add(b.group);
      }
    }
    setSaving(true);
    await onSave({ groups: blocks.map((b) => b.group), exercises: out });
    setSaving(false);
    reset();
  };

  const hasExercises = blocks.some((b) => b.exercises.some((e) => e.name.trim()));

  return (
    <>
      <BottomSheet open={open} onClose={handleClose}
        title={step === 1 ? t('mc_dp_str_title') : t('mc_dp_str_step2')}
        footer={
          step === 1 ? (
            <button onClick={() => blocks.length && setStep(2)} disabled={blocks.length === 0} style={{ minHeight: 48 }}
              className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {t('mc_str_continue')} <i className="ri-arrow-right-line"></i>
            </button>
          ) : (
            <button onClick={submit} disabled={saving || !hasExercises} style={{ minHeight: 48 }}
              className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                : <><i className="ri-check-line"></i> {t('mc_dp_form_save')}</>}
            </button>
          )
        }>
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold text-white">{t('mc_str_step1_q')}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{t('mc_str_step1_hint')}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {MUSCLE_GROUPS.map((g) => {
                const on = selectedGroups.has(g);
                return (
                  <button key={g} onClick={() => toggleGroup(g)} style={{ minHeight: 50 }}
                    className={`flex items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition-all cursor-pointer px-2 ${on ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/25' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'}`}>
                    {on && <i className="ri-check-line"></i>}{t(`mc_str_mg_${g}`)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <button onClick={() => setStep(1)} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer">
              <i className="ri-arrow-left-line"></i>{t('mc_str_edit_groups')}
            </button>

            {blocks.map((b) => (
              <div key={b.group}>
                <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-red-400 mb-2.5">{t(`mc_str_mg_${b.group}`)}</p>
                <div className="space-y-3">
                  {b.exercises.map((e) => {
                    const tm = e.name ? trackingModeOf(e.name) : 'reps';
                    const wm = e.name ? weightModeOf(e.name) : 'total';
                    const showBar = !!e.name && usesBar(e.name) && wm === 'total';
                    const primaryLabel = tm === 'time' ? t('mc_str_field_seconds') : tm === 'distance' ? t('mc_str_field_meters') : t('mc_str_reps');
                    const weightOptional = wm === 'bodyweight' || tm !== 'reps';
                    return (
                      <div key={e.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                        <div className="flex items-center gap-2">
                          <input value={e.name}
                            onChange={(ev) => patchEx(b.group, e.id, { name: ev.target.value, query: ev.target.value, open: true })}
                            onFocus={() => patchEx(b.group, e.id, { open: true })}
                            onBlur={() => { if (e.name.trim()) applyHistory(b.group, e.id, e.name.trim()); }}
                            placeholder={t('mc_str_pick_exercise')} maxLength={50} style={{ fontSize: 16, minHeight: 44 }}
                            className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500" />
                          <button onClick={() => removeExercise(b.group, e.id)} aria-label={t('mc_str_remove_exercise')}
                            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer">
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>

                        {e.open && (() => {
                          const sug = suggestFor(b.group, e.query || e.name);
                          if (sug.length === 0) return null;
                          return (
                            <div className="mt-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-1.5 max-h-40 overflow-y-auto">
                              {sug.map((c) => (
                                <button key={c} onMouseDown={(ev) => ev.preventDefault()}
                                  onClick={() => { patchEx(b.group, e.id, { name: c, open: false }); applyHistory(b.group, e.id, c); }}
                                  className="w-full text-left text-sm text-zinc-300 hover:text-white hover:bg-white/[0.05] px-3 py-2 rounded-lg cursor-pointer flex items-center gap-2">
                                  <i className="ri-search-line text-xs text-zinc-600"></i>{c}
                                </button>
                              ))}
                            </div>
                          );
                        })()}

                        {e.hist && <p className="text-[11px] text-zinc-500 mt-2">{e.hist.label}</p>}

                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="w-6 flex-shrink-0" />
                            <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 text-center">{primaryLabel}</span>
                            <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 text-center">
                              {t(weightLabelKey(wm))}{weightOptional ? ` (${t('mc_optional')})` : ''}
                            </span>
                            {e.sets.length > 1 && <span className="w-8 flex-shrink-0" />}
                          </div>
                          {e.sets.map((s, si) => (
                            <div key={si} className="flex items-center gap-1.5">
                              <span className="w-6 flex-shrink-0 text-center text-[11px] font-bold text-zinc-500">{si + 1}</span>
                              <input value={s.primary} inputMode={tm === 'reps' ? 'text' : 'decimal'}
                                placeholder={tm === 'reps' ? '8-10' : tm === 'time' ? '45' : '20'}
                                onChange={(ev) => patchSet(b.group, e.id, si, { primary: ev.target.value })}
                                style={{ fontSize: 16, minHeight: 44 }}
                                className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white text-center rounded-xl px-2 py-2.5 focus:outline-none focus:border-red-500" />
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
                          ))}
                          <button onClick={() => addSet(b.group, e.id)} style={{ minHeight: 40 }}
                            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-zinc-300 bg-white/[0.03] border border-white/10 hover:border-white/25 rounded-xl cursor-pointer transition-colors">
                            <i className="ri-add-line"></i> {t('mc_str_add_set')}
                          </button>
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
      </BottomSheet>

      <PlateCalculator
        open={!!plateFor}
        onClose={() => setPlateFor(null)}
        onUse={(total) => { if (plateFor) patchSet(plateFor.group, plateFor.id, plateFor.si, { weight: String(total) }); }}
      />
    </>
  );
}
