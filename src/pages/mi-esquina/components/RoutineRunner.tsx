import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateField from '@/components/base/DateField';
import { type Profile } from '@/lib/supabase';
import { fmtSetCount, fmtWeight, todayISO } from '@/pages/mi-esquina/lib/dayPlan';
import { lastWeights, type LoggedSet, type PrescribedExercise, type Routine, type RoutineDay } from '@/pages/mi-esquina/lib/routines';

// Checklist en vivo de un día de rutina (punto 17).
//
// Cada serie es una fila que se marca al hacerla. El peso viene propuesto —lo
// que levantó la última vez, o lo que diga la rutina— pero es EDITABLE en cada
// serie: en un entreno real el peso baja en la última, o sube porque el día
// viene bien, y obligar a que cuadre con lo prescrito convertiría el registro
// en una mentira.
//
// Al terminar se guardan SOLO las series marcadas, en `strength_sets`. Una
// sesión a medias es una sesión a medias, no una sesión completa.

interface Props {
  profile: Profile;
  routine: Routine;
  day: RoutineDay;
  saving: boolean;
  /**
   * Día al que pertenece la sesión. Lo pasa la Agenda cuando el checklist se
   * abre desde el bloque de un día concreto; sin él, hoy. Nunca en el futuro:
   * una sesión "del viernes que viene" no es una sesión hecha.
   */
  initialDate?: string;
  onExit: () => void;
  onFinish: (date: string, slot: string | null, sets: LoggedSet[]) => void;
}

interface SetState {
  done: boolean;
  /** Repeticiones, segundos o metros según el modo del ejercicio. */
  reps: number;
  weight: number;
}

const SLOTS: { id: string | null; labelKey: string }[] = [
  { id: null, labelKey: 'mc_rp_slot_none' },
  { id: 'morning', labelKey: 'mc_rp_slot_morning' },
  { id: 'afternoon', labelKey: 'mc_rp_slot_afternoon' },
  { id: 'evening', labelKey: 'mc_rp_slot_evening' },
];

/** Valor de partida de una serie: lo prescrito, sin inventar nada. */
function initialSet(ex: PrescribedExercise, weight: number): SetState {
  return {
    done: false,
    reps: ex.tracking_mode === 'reps' ? (ex.reps_min || 0) : (ex.value || 0),
    weight,
  };
}

export default function RoutineRunner({ profile, routine, day, saving, initialDate, onExit, onFinish }: Props) {
  const { t } = useTranslation();
  const [state, setState] = useState<Record<string, SetState[]>>({});
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(() => {
    const today = todayISO();
    return initialDate && initialDate < today ? initialDate : today;
  });
  const [slot, setSlot] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  // Los pesos propuestos salen de lo último levantado en cada ejercicio. Se
  // pide una sola vez al abrir; si la consulta falla, se cae a lo prescrito.
  useEffect(() => {
    let alive = true;
    (async () => {
      const map = await lastWeights(profile.id, day.exercises.map((e) => e.name));
      if (!alive) return;
      const next: Record<string, SetState[]> = {};
      for (const ex of day.exercises) {
        const key = ex.name.trim().toLowerCase().replace(/\s+/g, ' ');
        const w = map.get(key) ?? ex.weight_kg ?? 0;
        next[ex.id] = Array.from({ length: Math.max(1, ex.sets) }, () => initialSet(ex, w));
      }
      setState(next);
      setReady(true);
    })();
    return () => { alive = false; };
  }, [profile.id, day]);

  const patch = (exId: string, i: number, changes: Partial<SetState>) =>
    setState((s) => ({
      ...s,
      [exId]: (s[exId] || []).map((v, idx) => (idx === i ? { ...v, ...changes } : v)),
    }));

  /** Marcar una serie arrastra el peso a las siguientes sin tocar: es lo que
   *  pasa en el gimnasio y evita reteclearlo cuatro veces. */
  const toggle = (ex: PrescribedExercise, i: number) => setState((s) => {
    const list = s[ex.id] || [];
    const cur = list[i];
    if (!cur) return s;
    const now = !cur.done;
    const next = list.map((v, idx) => {
      if (idx === i) return { ...v, done: now };
      if (now && idx > i && !v.done) return { ...v, weight: cur.weight, reps: cur.reps };
      return v;
    });
    return { ...s, [ex.id]: next };
  });

  const toggleAll = (ex: PrescribedExercise) => setState((s) => {
    const list = s[ex.id] || [];
    const allDone = list.every((v) => v.done);
    return { ...s, [ex.id]: list.map((v) => ({ ...v, done: !allDone })) };
  });

  const { doneSets, totalSets } = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const ex of day.exercises) {
      const list = state[ex.id] || [];
      total += list.length;
      done += list.filter((v) => v.done).length;
    }
    return { doneSets: done, totalSets: total };
  }, [state, day.exercises]);

  const collect = (): LoggedSet[] => {
    const out: LoggedSet[] = [];
    for (const ex of day.exercises) {
      for (const s of state[ex.id] || []) {
        if (!s.done) continue;
        out.push({
          exerciseName: ex.name,
          group: ex.group,
          weightMode: ex.weight_mode,
          trackingMode: ex.tracking_mode,
          reps: s.reps,
          weight: s.weight,
          note: ex.note,
        });
      }
    }
    return out;
  };

  const pct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;
  const title = day.name || routine.name;

  return (
    <div className="fixed inset-0 z-50 flex flex-col rk-screen-bg" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Cabecera */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] flex-shrink-0">
        <div className="min-w-0">
          <p className="rk-label" style={{ fontSize: 10 }}>{routine.name}</p>
          <h3 className="text-sm font-bold text-white truncate">{title}</h3>
        </div>
        <button onClick={() => (doneSets > 0 ? setConfirmExit(true) : onExit())} aria-label={t('mc_close')}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer flex-shrink-0">
          <i className="ri-close-line" />
        </button>
      </div>

      {/* Progreso */}
      <div className="px-5 pt-3 flex-shrink-0">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--s-3)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#fb923c' }} />
        </div>
        <p className="text-[11px] text-zinc-500 mt-1.5">{t('mc_rp_progress', { done: doneSets, total: totalSets })}</p>
      </div>

      {!ready ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : finishing ? (
        // ── Cierre: cuándo se guarda ──
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-sm mx-auto space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-green-500/12 border border-green-500/30 text-green-400">
                <i className="ri-check-double-line text-3xl" />
              </div>
              <h3 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff' }}>{t('mc_rp_finish_title')}</h3>
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                {t('mc_rp_finish_sub', { done: doneSets, total: totalSets })}
              </p>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_rp_finish_date')}</label>
              <DateField value={date} max={todayISO()} onChange={setDate} ariaLabel={t('mc_rp_finish_date')} />
            </div>

            <div>
              <p className="text-xs text-zinc-400 mb-1.5">{t('mc_rp_finish_slot')}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {SLOTS.map((s) => (
                  <button key={s.labelKey} type="button" onClick={() => setSlot(s.id)}
                    className={`rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                      slot === s.id ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'
                    }`} style={{ minHeight: 42 }}>
                    {t(s.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => onFinish(date, slot, collect())} disabled={saving || doneSets === 0}
              className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ minHeight: 50 }}>
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_saving')}</>
                : <><i className="ri-save-line" />{t('mc_rp_finish_save')}</>}
            </button>
            <button onClick={() => setFinishing(false)} disabled={saving}
              className="w-full text-xs text-zinc-500 hover:text-white cursor-pointer" style={{ minHeight: 44 }}>
              {t('mc_rp_finish_back')}
            </button>
          </div>
        </div>
      ) : (
        // ── El checklist ──
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {day.exercises.map((ex, i) => {
            const list = state[ex.id] || [];
            const allDone = list.length > 0 && list.every((v) => v.done);
            const prescribed = fmtSetCount(ex.sets, {
              repsMin: ex.reps_min, repsMax: ex.reps_max, value: ex.value, trackingMode: ex.tracking_mode,
            }, t);
            const prescribedWeight = ex.weight_kg ? fmtWeight(ex.weight_kg, ex.weight_mode, t) : '';

            return (
              <div key={ex.id} className="rk-card" style={{ padding: '14px 14px', opacity: allDone ? 0.75 : 1 }}>
                <div className="flex items-start gap-2.5">
                  <span className="text-[11px] text-zinc-600 flex-shrink-0 w-4 text-center mt-1">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white leading-snug">{ex.name}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {prescribed}{prescribedWeight ? ` · ${prescribedWeight}` : ''}
                      {' · '}{t(`mc_str_mg_${ex.group}`, { defaultValue: ex.group })}
                    </p>
                    {ex.note && <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{ex.note}</p>}
                  </div>
                  <button onClick={() => toggleAll(ex)}
                    className="text-[11px] text-zinc-500 hover:text-white cursor-pointer flex-shrink-0 px-1.5"
                    style={{ minHeight: 40 }}>
                    {allDone ? t('mc_rp_uncheck_all') : t('mc_rp_check_all')}
                  </button>
                </div>

                <div className="mt-3 space-y-1.5">
                  {list.map((s, si) => (
                    <SetRow key={si} index={si} state={s} exercise={ex}
                      onToggle={() => toggle(ex, si)}
                      onReps={(v) => patch(ex.id, si, { reps: v })}
                      onWeight={(v) => patch(ex.id, si, { weight: v })} />
                  ))}
                </div>
              </div>
            );
          })}

          <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5 pt-1">
            <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_rp_runner_hint')}
          </p>
        </div>
      )}

      {/* Pie */}
      {!finishing && ready && (
        <div className="px-5 py-4 border-t border-white/[0.07] flex-shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={() => setFinishing(true)} disabled={doneSets === 0}
            className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ minHeight: 52, fontSize: '1rem' }}>
            <i className="ri-flag-line" />{t('mc_rp_finish_cta')}
          </button>
        </div>
      )}

      {confirmExit && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-5" style={{ background: 'rgba(3,3,3,0.85)' }}>
          <div className="card-primary w-full max-w-xs text-center" style={{ padding: 24 }}>
            <h4 className="rk-h3" style={{ fontSize: '1.05rem', color: '#fff' }}>{t('mc_rp_exit_title')}</h4>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              {t('mc_rp_exit_desc', { done: doneSets, total: totalSets })}
            </p>
            <button onClick={() => { setConfirmExit(false); setFinishing(true); }}
              className="rk-btn rk-btn-primary w-full mt-4" style={{ minHeight: 46, fontSize: '0.9rem' }}>
              {t('mc_rp_exit_save')}
            </button>
            <button onClick={onExit} className="w-full text-xs text-zinc-400 hover:text-red-400 cursor-pointer mt-3"
              style={{ minHeight: 42 }}>
              {t('mc_rp_exit_discard')}
            </button>
            <button onClick={() => setConfirmExit(false)} className="w-full text-xs text-zinc-500 hover:text-white cursor-pointer mt-1"
              style={{ minHeight: 42 }}>
              {t('mc_cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Una serie ──────────────────────────────────────────────────

function SetRow({ index, state, exercise, onToggle, onReps, onWeight }: {
  index: number;
  state: SetState;
  exercise: PrescribedExercise;
  onToggle: () => void;
  onReps: (v: number) => void;
  onWeight: (v: number) => void;
}) {
  const { t } = useTranslation();
  const byReps = exercise.tracking_mode === 'reps';
  const noWeight = exercise.weight_mode === 'bodyweight';
  const unit = byReps ? t('mc_rp_unit_reps') : exercise.tracking_mode === 'time' ? t('mc_str_unit_sec') : t('mc_str_unit_m');

  const cell = 'w-full bg-white/[0.04] border border-white/10 text-white text-sm text-center rounded-lg py-2 focus:outline-none focus:border-red-500';

  return (
    <div className="flex items-center gap-1.5 rounded-xl px-2 py-1.5"
      style={{
        background: state.done ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${state.done ? 'rgba(74,222,128,0.3)' : 'var(--s-3)'}`,
      }}>
      <span className="text-[11px] text-zinc-500 flex-shrink-0 w-11">{t('mc_rp_set_n', { n: index + 1 })}</span>

      <div className="flex-1 min-w-0 relative">
        <input inputMode="numeric" type="number" min={0} max={3600} value={state.reps || ''}
          onChange={(e) => onReps(Math.max(0, parseInt(e.target.value, 10) || 0))}
          aria-label={unit} className={cell} style={{ fontSize: 16, minHeight: 42, paddingRight: 30, paddingLeft: 6 }} />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 pointer-events-none">{unit}</span>
      </div>

      {!noWeight && (
        <div className="flex-1 min-w-0 relative">
          <input inputMode="decimal" type="number" min={0} max={500} step={2.5} value={state.weight || ''}
            onChange={(e) => {
              const n = parseFloat(e.target.value.replace(',', '.'));
              onWeight(Number.isFinite(n) && n >= 0 ? n : 0);
            }}
            aria-label={t('mc_rp_weight')} className={cell}
            style={{ fontSize: 16, minHeight: 42, paddingRight: 26, paddingLeft: 6 }} />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 pointer-events-none">kg</span>
        </div>
      )}

      <button onClick={onToggle} aria-pressed={state.done}
        aria-label={t('mc_rp_set_n', { n: index + 1 })}
        className={`w-11 flex-shrink-0 flex items-center justify-center rounded-lg border cursor-pointer transition-all ${
          state.done
            ? 'bg-green-500/20 border-green-500/50 text-green-300'
            : 'bg-white/[0.05] border-white/12 text-zinc-500 hover:text-white hover:border-white/30'
        }`} style={{ minHeight: 42 }}>
        <i className={state.done ? 'ri-check-line text-lg' : 'ri-checkbox-blank-circle-line'} />
      </button>
    </div>
  );
}
