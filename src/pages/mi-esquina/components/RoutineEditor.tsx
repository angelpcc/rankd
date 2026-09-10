import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { libraryLabels, MUSCLE_GROUPS, type MuscleGroup, type TrackingMode } from '@/pages/mi-esquina/lib/exercises';
import {
  emptyDay, emptyExercise, inferExerciseMeta, localId, routineTotals,
  type PrescribedExercise, type Routine, type RoutineDay,
} from '@/pages/mi-esquina/lib/routines';

// Editor de una rutina preescrita (punto 17).
//
// La idea es teclear lo MÍNIMO. Al escribir el nombre del ejercicio, la
// biblioteca ya sabe su grupo muscular, si va por repeticiones o por tiempo y
// cómo se cuenta el peso: no se le pregunta al usuario nada de eso salvo que
// quiera cambiarlo a mano. Y hay autocompletado con toda la biblioteca, así
// que la mayoría de las veces basta con tres letras.

interface Props {
  initial: Routine;
  saving: boolean;
  onSave: (r: Routine) => void;
  onCancel: () => void;
}

const TRACKING_OPTIONS: { id: TrackingMode; labelKey: string }[] = [
  { id: 'reps', labelKey: 'mc_rp_track_reps' },
  { id: 'time', labelKey: 'mc_rp_track_time' },
  { id: 'distance', labelKey: 'mc_rp_track_distance' },
];

export default function RoutineEditor({ initial, saving, onSave, onCancel }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'es';
  const suggestions = useMemo(() => libraryLabels(lang as 'es' | 'en'), [lang]);

  const [name, setName] = useState(initial.name);
  const [note, setNote] = useState(initial.note || '');
  const [days, setDays] = useState<RoutineDay[]>(initial.days.length > 0 ? initial.days : [emptyDay('')]);
  const [openDay, setOpenDay] = useState<string | null>(days[0]?.id ?? null);

  const totals = routineTotals({ ...initial, days });
  const inputCls = 'w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500';

  const patchDay = (dayId: string, changes: Partial<RoutineDay>) =>
    setDays((l) => l.map((d) => (d.id === dayId ? { ...d, ...changes } : d)));

  const patchEx = (dayId: string, exId: string, changes: Partial<PrescribedExercise>) =>
    setDays((l) => l.map((d) => (d.id !== dayId ? d : {
      ...d,
      exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...changes } : e)),
    })));

  /** Al terminar de escribir el nombre, se rellenan grupo y modos solos. */
  const applyMeta = (dayId: string, ex: PrescribedExercise) => {
    if (!ex.name.trim()) return;
    const meta = inferExerciseMeta(ex.name);
    patchEx(dayId, ex.id, {
      group: meta.group,
      weight_mode: meta.weight_mode,
      tracking_mode: meta.tracking_mode,
      // Un ejercicio por tiempo no tiene "repeticiones": se le da un valor
      // razonable para que el campo no salga a cero.
      value: meta.tracking_mode === 'reps' ? undefined : (ex.value || (meta.tracking_mode === 'time' ? 45 : 20)),
    });
  };

  const addExercise = (dayId: string) =>
    setDays((l) => l.map((d) => (d.id === dayId ? { ...d, exercises: [...d.exercises, emptyExercise()] } : d)));

  const removeExercise = (dayId: string, exId: string) =>
    setDays((l) => l.map((d) => (d.id !== dayId ? d : {
      ...d,
      exercises: d.exercises.length > 1 ? d.exercises.filter((e) => e.id !== exId) : d.exercises,
    })));

  const moveExercise = (dayId: string, exId: string, dir: -1 | 1) =>
    setDays((l) => l.map((d) => {
      if (d.id !== dayId) return d;
      const i = d.exercises.findIndex((e) => e.id === exId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.exercises.length) return d;
      const copy = [...d.exercises];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return { ...d, exercises: copy };
    }));

  const addDay = () => {
    const fresh = emptyDay('');
    setDays((l) => [...l, fresh]);
    setOpenDay(fresh.id);
  };

  const duplicateDay = (d: RoutineDay) => {
    const copy: RoutineDay = {
      ...d,
      id: localId('day'),
      name: `${d.name || t('mc_rp_day_n', { n: days.length + 1 })} ·`,
      exercises: d.exercises.map((e) => ({ ...e, id: localId() })),
    };
    setDays((l) => [...l, copy]);
    setOpenDay(copy.id);
  };

  const removeDay = (dayId: string) => setDays((l) => (l.length > 1 ? l.filter((d) => d.id !== dayId) : l));

  const save = () => {
    const clean = days
      .map((d) => ({ ...d, exercises: d.exercises.filter((e) => e.name.trim()) }))
      .filter((d) => d.exercises.length > 0);
    onSave({
      ...initial,
      name: name.trim() || t('mc_rp_untitled'),
      note: note.trim() || undefined,
      days: clean,
    });
  };

  const canSave = days.some((d) => d.exercises.some((e) => e.name.trim()));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative rk-card w-full sm:max-w-lg flex flex-col"
        style={{ padding: 0, transform: 'none', maxHeight: '92vh', borderRadius: '20px 20px 0 0' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="min-w-0">
            <p className="rk-label" style={{ fontSize: 10 }}>{t('mc_rp_editor_eyebrow')}</p>
            <h3 className="rk-h3 truncate" style={{ fontSize: '1.05rem', color: '#fff', margin: 0 }}>{t('mc_rp_editor_title')}</h3>
          </div>
          <button onClick={onCancel} aria-label={t('mc_close')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer flex-shrink-0">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_rp_field_name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
              placeholder={t('mc_rp_field_name_ph')} className={inputCls} style={{ fontSize: 16, minHeight: 44 }} />
          </div>

          <datalist id="rk-routine-exercises">
            {suggestions.map((s) => <option key={s} value={s} />)}
          </datalist>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-white">{t('mc_rp_days')}</p>
              <span className="text-[11px] text-zinc-500">
                {t('mc_rp_totals', { days: totals.days, ex: totals.exercises, sets: totals.sets })}
              </span>
            </div>

            <div className="space-y-2">
              {days.map((d, di) => {
                const open = openDay === d.id;
                return (
                  <div key={d.id} className="rounded-xl overflow-hidden"
                    style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)' }}>
                    <button onClick={() => setOpenDay(open ? null : d.id)}
                      className="w-full flex items-center gap-3 text-left cursor-pointer px-3" style={{ minHeight: 52 }}>
                      <span className="flex items-center justify-center rounded-lg flex-shrink-0 text-[11px] font-bold"
                        style={{ width: 26, height: 26, background: 'rgba(251,146,60,0.14)', border: '1px solid rgba(251,146,60,0.3)', color: '#fb923c' }}>
                        {di + 1}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-white truncate">
                          {d.name || t('mc_rp_day_n', { n: di + 1 })}
                        </span>
                        <span className="block text-[11px] text-zinc-500">
                          {t('mc_rp_day_summary', { n: d.exercises.length })}
                        </span>
                      </span>
                      <i className={`ri-arrow-down-s-line text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>

                    {open && (
                      <div className="px-3 pb-3 pt-3 space-y-3 border-t border-white/[0.06]">
                        <input value={d.name} onChange={(e) => patchDay(d.id, { name: e.target.value })}
                          maxLength={60} placeholder={t('mc_rp_field_day_name_ph')}
                          className={inputCls} style={{ fontSize: 16, minHeight: 44 }} />

                        {d.exercises.map((ex, ei) => (
                          <ExerciseRow key={ex.id} ex={ex} index={ei} last={ei === d.exercises.length - 1}
                            single={d.exercises.length === 1}
                            onChange={(changes) => patchEx(d.id, ex.id, changes)}
                            onBlurName={() => applyMeta(d.id, ex)}
                            onMove={(dir) => moveExercise(d.id, ex.id, dir)}
                            onRemove={() => removeExercise(d.id, ex.id)} />
                        ))}

                        <button onClick={() => addExercise(d.id)}
                          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-xs font-semibold text-zinc-300 hover:border-white/35 cursor-pointer transition-colors"
                          style={{ minHeight: 44 }}>
                          <i className="ri-add-line" />{t('mc_rp_add_exercise')}
                        </button>

                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={() => duplicateDay(d)}
                            className="text-[11px] text-zinc-400 hover:text-white cursor-pointer px-2" style={{ minHeight: 40 }}>
                            <i className="ri-file-copy-line" /> {t('mc_rp_duplicate_day')}
                          </button>
                          <button onClick={() => removeDay(d.id)} disabled={days.length === 1}
                            className="ml-auto text-[11px] text-zinc-500 hover:text-red-400 cursor-pointer px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ minHeight: 40 }}>
                            <i className="ri-delete-bin-line" /> {t('mc_rp_delete_day')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={addDay}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-xs font-semibold text-zinc-300 hover:border-white/35 cursor-pointer transition-colors"
              style={{ minHeight: 46 }}>
              <i className="ri-add-line" />{t('mc_rp_add_day')}
            </button>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_rp_field_note')}</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={400}
              placeholder={t('mc_rp_field_note_ph')}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 resize-none" />
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-white/[0.07] flex-shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={onCancel} className="rk-nav-btn text-xs" style={{ padding: '0.7rem 1.2rem', minHeight: 48 }}>
            {t('mc_cancel')}
          </button>
          <button onClick={save} disabled={saving || !canSave}
            className="rk-btn rk-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ minHeight: 48 }}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_saving')}</>
              : <><i className="ri-check-line" />{t('mc_rp_save')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Un ejercicio dentro de un día ──────────────────────────────

function ExerciseRow({ ex, index, last, single, onChange, onBlurName, onMove, onRemove }: {
  ex: PrescribedExercise;
  index: number;
  last: boolean;
  single: boolean;
  onChange: (changes: Partial<PrescribedExercise>) => void;
  onBlurName: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [more, setMore] = useState(false);
  const byReps = ex.tracking_mode === 'reps';
  const cell = 'w-full bg-white/[0.04] border border-white/10 text-white text-sm text-center rounded-lg px-1 py-2 focus:outline-none focus:border-red-500';

  return (
    <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--s-3)' }}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-zinc-600 flex-shrink-0 w-4 text-center">{index + 1}</span>
        <input list="rk-routine-exercises" value={ex.name}
          onChange={(e) => onChange({ name: e.target.value })} onBlur={onBlurName}
          maxLength={80} placeholder={t('mc_rp_field_exercise_ph')}
          className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-500"
          style={{ fontSize: 16, minHeight: 42 }} />
        <button onClick={() => setMore((v) => !v)} aria-expanded={more} aria-label={t('mc_av_more_details')}
          className="w-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 text-zinc-400 hover:text-white cursor-pointer"
          style={{ minHeight: 42 }}>
          <i className={`ri-more-2-line transition-transform ${more ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* Lo imprescindible: series y repeticiones (o segundos / metros). */}
      <div className="grid grid-cols-3 gap-1.5 mt-2">
        <Field label={t('mc_rp_sets')}>
          <input inputMode="numeric" type="number" min={1} max={12} value={ex.sets}
            onChange={(e) => onChange({ sets: Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
            className={cell} style={{ fontSize: 16, minHeight: 42 }} aria-label={t('mc_rp_sets')} />
        </Field>
        {byReps ? (
          <>
            <Field label={t('mc_rp_reps_min')}>
              <input inputMode="numeric" type="number" min={1} max={100} value={ex.reps_min || ''}
                onChange={(e) => onChange({ reps_min: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                className={cell} style={{ fontSize: 16, minHeight: 42 }} aria-label={t('mc_rp_reps_min')} />
            </Field>
            <Field label={t('mc_rp_reps_max')}>
              <input inputMode="numeric" type="number" min={0} max={100} value={ex.reps_max || ''}
                placeholder="—"
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  onChange({ reps_max: Number.isFinite(n) && n > 0 ? n : undefined });
                }}
                className={cell} style={{ fontSize: 16, minHeight: 42 }} aria-label={t('mc_rp_reps_max')} />
            </Field>
          </>
        ) : (
          <Field label={ex.tracking_mode === 'time' ? t('mc_rp_seconds') : t('mc_rp_meters')} span={2}>
            <input inputMode="numeric" type="number" min={1} max={3600} value={ex.value || ''}
              onChange={(e) => onChange({ value: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className={cell} style={{ fontSize: 16, minHeight: 42 }}
              aria-label={ex.tracking_mode === 'time' ? t('mc_rp_seconds') : t('mc_rp_meters')} />
          </Field>
        )}
      </div>

      {more && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <Field label={t('mc_rp_weight')}>
              <input inputMode="decimal" type="number" min={0} max={500} step={2.5} value={ex.weight_kg ?? ''}
                placeholder="—"
                onChange={(e) => {
                  const n = parseFloat(e.target.value.replace(',', '.'));
                  onChange({ weight_kg: Number.isFinite(n) && n >= 0 ? n : undefined });
                }}
                className={cell} style={{ fontSize: 16, minHeight: 42 }} aria-label={t('mc_rp_weight')} />
            </Field>
            <Field label={t('mc_rp_group')}>
              <select value={ex.group} onChange={(e) => onChange({ group: e.target.value as MuscleGroup })}
                className={`${cell} cursor-pointer`} style={{ fontSize: 14, minHeight: 42 }} aria-label={t('mc_rp_group')}>
                {MUSCLE_GROUPS.map((g) => (
                  <option key={g} value={g}>{t(`mc_str_mg_${g}`, { defaultValue: g })}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t('mc_rp_tracking')}>
            <div className="flex gap-1.5">
              {TRACKING_OPTIONS.map((o) => (
                <button key={o.id} type="button"
                  onClick={() => onChange({
                    tracking_mode: o.id,
                    value: o.id === 'reps' ? undefined : (ex.value || (o.id === 'time' ? 45 : 20)),
                    reps_min: o.id === 'reps' ? (ex.reps_min || 8) : 0,
                  })}
                  className={`flex-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                    ex.tracking_mode === o.id ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'
                  }`} style={{ minHeight: 40 }}>
                  {t(o.labelKey)}
                </button>
              ))}
            </div>
          </Field>

          <div className="flex items-center gap-1.5 pt-0.5">
            <button onClick={() => onMove(-1)} disabled={index === 0} aria-label={t('mc_pt_move_up')}
              className="w-10 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 text-zinc-300 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
              style={{ minHeight: 40 }}><i className="ri-arrow-up-line" /></button>
            <button onClick={() => onMove(1)} disabled={last} aria-label={t('mc_pt_move_down')}
              className="w-10 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 text-zinc-300 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
              style={{ minHeight: 40 }}><i className="ri-arrow-down-line" /></button>
            <button onClick={onRemove} disabled={single}
              className="ml-auto text-[11px] text-zinc-500 hover:text-red-400 cursor-pointer px-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ minHeight: 40 }}>
              <i className="ri-delete-bin-line" /> {t('mc_delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, span, children }: { label: string; span?: number; children: React.ReactNode }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <p className="text-[10px] text-zinc-500 mb-1 text-center truncate">{label}</p>
      {children}
    </div>
  );
}
