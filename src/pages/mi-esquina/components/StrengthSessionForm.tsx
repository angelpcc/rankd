import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/base/BottomSheet';
import VoiceButton from '@/components/feature/VoiceButton';
import { parseStrengthSessionFromSpeech } from '@/lib/dictation';
import { MUSCLE_GROUPS, exercisesByGroup, libraryLabels, muscleGroupOf, type MuscleGroup } from '../lib/exercises';

// ── Sesión construida que se devuelve al padre para guardar ──
export interface BuiltSet { reps: number; weight: number }
export interface BuiltExercise { label: string; sets: BuiltSet[] }
export interface BuiltBlock { group: MuscleGroup; exercises: BuiltExercise[] }
export interface BuiltSession { date: string; blocks: BuiltBlock[] }

// ── Estado editable interno (inputs como texto) ──
interface FSet { reps: string; weight: string }
interface FExercise { id: string; label: string; query: string; open: boolean; sets: FSet[] }
interface FBlock { group: MuscleGroup; exercises: FExercise[] }

const uid = () => Math.random().toString(36).slice(2, 9);
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

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
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function StrengthSessionForm({ open, onClose, saving, onSave, ownExercises, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';
  const library = useMemo(() => libraryLabels(lang), [lang]);

  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(todayISO());
  const [blocks, setBlocks] = useState<FBlock[]>([]);
  const [freeText, setFreeText] = useState('');
  const [interpreted, setInterpreted] = useState(false);

  const selectedGroups = useMemo(() => new Set(blocks.map((b) => b.group)), [blocks]);

  const resetAll = () => { setStep(1); setDate(todayISO()); setBlocks([]); setFreeText(''); setInterpreted(false); };

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
        const sets = e.sets
          .map((s) => ({ reps: parseInt(s.reps, 10), weight: parseFloat(s.weight.replace(',', '.')) }))
          .filter((s) => s.reps > 0 && s.weight > 0);
        if (sets.length > 0) exercises.push({ label, sets });
      }
      if (exercises.length > 0) built.push({ group: b.group, exercises });
    }
    if (built.length === 0) { showToast(t('mc_str_no_exercises'), 'error'); return; }
    onSave({ date, blocks: built });
  };

  // Se llama tras guardar con éxito desde el padre (via key remount) — aquí solo
  // limpiamos si el sheet se cierra.
  const handleClose = () => { resetAll(); close(); };

  const totalExercises = blocks.reduce((a, b) => a + b.exercises.filter((e) => e.label.trim()).length, 0);

  const suggestFor = (group: MuscleGroup, query: string): string[] => {
    const own = ownExercises.filter((e) => e.group === group).map((e) => e.label);
    const pool = [...new Set([...own, ...exercisesByGroup(group, lang)])];
    const q = norm(query);
    return (q ? pool.filter((x) => norm(x).includes(q) && norm(x) !== q) : pool).slice(0, 30);
  };

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={step === 1 ? t('mc_str_new') : t('mc_str_step2_title')}
      footer={
        step === 1 ? (
          <button onClick={goStep2} disabled={blocks.length === 0} style={{ minHeight: 48 }}
            className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
            {t('mc_str_continue')} <i className="ri-arrow-right-line"></i>
          </button>
        ) : (
          <button onClick={submit} disabled={saving} style={{ minHeight: 48 }}
            className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
              : <><i className="ri-save-line"></i> {t('mc_str_save_session')}{totalExercises > 0 ? ` (${totalExercises})` : ''}</>}
          </button>
        )
      }
    >
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
                {b.exercises.map((e) => (
                  <div key={e.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                    {/* Nombre del ejercicio + eliminar */}
                    <div className="flex items-center gap-2">
                      <input value={e.label}
                        onChange={(ev) => patchExercise(b.group, e.id, { label: ev.target.value, query: ev.target.value, open: true })}
                        onFocus={() => patchExercise(b.group, e.id, { open: true })}
                        placeholder={t('mc_str_pick_exercise')} maxLength={50} style={{ fontSize: 16, minHeight: 44 }}
                        className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500" />
                      <button onClick={() => removeExercise(b.group, e.id)} aria-label={t('mc_str_remove_exercise')}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                    {/* Sugerencias del grupo (en línea, para no recortarse en el sheet) */}
                    {e.open && (() => {
                      const sug = suggestFor(b.group, e.query || e.label);
                      if (sug.length === 0) return null;
                      return (
                        <div className="mt-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-1.5 max-h-40 overflow-y-auto">
                          {sug.map((c) => (
                            <button key={c} onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => patchExercise(b.group, e.id, { label: c, open: false })}
                              className="w-full text-left text-sm text-zinc-300 hover:text-white hover:bg-white/[0.05] px-3 py-2 rounded-lg cursor-pointer flex items-center gap-2">
                              <i className="ri-search-line text-xs text-zinc-600"></i>{c}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Series: reps + kg */}
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-1.5 px-1">
                        <span className="w-6 flex-shrink-0" />
                        <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 text-center">{t('mc_str_reps')}</span>
                        <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 text-center">{t('mc_str_weight')}</span>
                        {e.sets.length > 1 && <span className="w-8 flex-shrink-0" />}
                      </div>
                      {e.sets.map((s, si) => (
                        <div key={si} className="flex items-center gap-1.5">
                          <span className="w-6 flex-shrink-0 text-center text-[11px] font-bold text-zinc-500">{si + 1}</span>
                          <input value={s.reps} inputMode="numeric" placeholder="10" style={{ fontSize: 16, minHeight: 44 }}
                            onChange={(ev) => patchSet(b.group, e.id, si, { reps: ev.target.value })}
                            className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white text-center rounded-xl px-2 py-2.5 focus:outline-none focus:border-red-500" />
                          <div className="flex-1 min-w-0 relative">
                            <input value={s.weight} inputMode="decimal" placeholder="0" style={{ fontSize: 16, minHeight: 44 }}
                              onChange={(ev) => patchSet(b.group, e.id, si, { weight: ev.target.value })}
                              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl pl-3 pr-9 py-2.5 focus:outline-none focus:border-red-500" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">kg</span>
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
                ))}

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
  );
}
