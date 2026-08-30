import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Pantalla de revisión OBLIGATORIA antes de aplicar un ajuste del plan o una
// rutina importada por foto (PROMPT 1 · parte B · tarea 8). Muestra el plan
// propuesto día a día, marca qué cambia frente al plan actual y deja aceptar
// los cambios por día o todos a la vez. Nunca guarda sin pasar por aquí.

interface PlanDay {
  day: string;
  training: string | null;
  cardio: string | null;
  nutrition: string | null;
  notes: string | null;
}
interface PlanWeek { week: number; days: PlanDay[] }
interface Plan { plan_name: string; summary: string; disclaimer: string; weeks: PlanWeek[] }

interface Props {
  /** Plan activo, para comparar. null = no hay plan previo (todo es nuevo). */
  current: Plan | null;
  proposed: Plan;
  applying: boolean;
  mode: 'adjust' | 'import';
  onApply: (merged: Plan) => void;
  onDiscard: () => void;
}

const DAY_KEYS: Record<string, string> = {
  Lunes: 'op_day_monday', Martes: 'op_day_tuesday', 'Miércoles': 'op_day_wednesday',
  Jueves: 'op_day_thursday', Viernes: 'op_day_friday', 'Sábado': 'op_day_saturday', Domingo: 'op_day_sunday',
};

const norm = (s: string | null) => (s || '').trim().replace(/\s+/g, ' ');
function dayEq(a: PlanDay | undefined, b: PlanDay): boolean {
  if (!a) return false;
  return norm(a.training) === norm(b.training) && norm(a.cardio) === norm(b.cardio)
    && norm(a.nutrition) === norm(b.nutrition) && norm(a.notes) === norm(b.notes);
}
const keyOf = (w: number, day: string) => `${w}|${day}`;

export default function AdjustPlanReview({ current, proposed, applying, mode, onApply, onDiscard }: Props) {
  const { t } = useTranslation();

  // Índice del plan actual por semana+día.
  const currentIndex = useMemo(() => {
    const m = new Map<string, PlanDay>();
    (current?.weeks || []).forEach((w) => w.days.forEach((d) => m.set(keyOf(w.week, d.day), d)));
    return m;
  }, [current]);

  // Estado de cada día propuesto: 'new' | 'changed' | 'same'.
  const dayState = useMemo(() => {
    const m = new Map<string, 'new' | 'changed' | 'same'>();
    proposed.weeks.forEach((w) => w.days.forEach((d) => {
      const cur = currentIndex.get(keyOf(w.week, d.day));
      m.set(keyOf(w.week, d.day), !cur ? 'new' : dayEq(cur, d) ? 'same' : 'changed');
    }));
    return m;
  }, [proposed, currentIndex]);

  const changedKeys = useMemo(
    () => [...dayState.entries()].filter(([, s]) => s !== 'same').map(([k]) => k),
    [dayState],
  );

  // Por defecto se aceptan todos los cambios/nuevos.
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set(changedKeys));
  const toggle = (k: string) => setAccepted((prev) => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const noChanges = changedKeys.length === 0;

  const buildMerged = (): Plan => {
    // Para cada día propuesto: si su cambio está aceptado (o no había plan
    // previo), se usa el propuesto; si no, se conserva el del plan actual.
    const weeks = proposed.weeks.map((w) => ({
      week: w.week,
      days: w.days.map((d) => {
        const k = keyOf(w.week, d.day);
        const st = dayState.get(k);
        if (st === 'same') return d;
        if (accepted.has(k)) return d;
        return currentIndex.get(k) || d;
      }),
    }));
    return { ...proposed, weeks };
  };

  const badge = (st: 'new' | 'changed' | 'same') => {
    if (st === 'same') return null;
    const cfg = st === 'new'
      ? { label: t('op_rev_new'), cls: 'text-green-400 bg-green-500/10 border-green-500/25' }
      : { label: t('op_rev_changed'), cls: 'text-[#C9A84C] bg-[#C9A84C]/12 border-[#C9A84C]/30' };
    return <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>;
  };

  return (
    <div className="space-y-5">
      <div className="card-primary" style={{ padding: 20 }}>
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400 mb-1">
          {mode === 'import' ? t('op_rev_import_title') : t('op_rev_adjust_title')}
        </p>
        <h3 className="rk-title-card" style={{ fontSize: '1.2rem' }}>{proposed.plan_name}</h3>
        <p className="rk-body-14 mt-1.5">{proposed.summary}</p>
        <p className="rk-meta mt-2">
          {noChanges ? t('op_rev_no_changes') : t('op_rev_count', { n: changedKeys.length, accepted: accepted.size })}
        </p>
      </div>

      <div className="space-y-3">
        {proposed.weeks.map((w) => (
          <div key={w.week} className="rk-card" style={{ padding: '14px 16px' }}>
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400 mb-2.5">{t('op_week')} {w.week}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {w.days.map((d) => {
                const k = keyOf(w.week, d.day);
                const st = dayState.get(k) || 'same';
                const label = DAY_KEYS[d.day] ? t(DAY_KEYS[d.day]) : d.day;
                const isRest = !d.training && !d.cardio && !d.nutrition && !d.notes;
                const cur = currentIndex.get(k);
                return (
                  <div key={d.day} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
                    style={{ opacity: st !== 'same' && !accepted.has(k) ? 0.5 : 1 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.2, color: '#fff' }}>{label.toUpperCase()}</span>
                      {badge(st)}
                      {st !== 'same' && (
                        <label className="ml-auto flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={accepted.has(k)} onChange={() => toggle(k)}
                            className="accent-red-600 w-3.5 h-3.5" />
                          <span className="text-[10px] text-zinc-400">{t('op_rev_apply_day')}</span>
                        </label>
                      )}
                    </div>
                    {isRest ? (
                      <p className="text-[11px] text-zinc-500 italic">{t('op_day_rest_hint')}</p>
                    ) : (
                      <div className="space-y-0.5">
                        {d.training && <Line label={t('op_field_training')} value={d.training} color="#E10600" />}
                        {d.cardio && <Line label={t('op_field_cardio')} value={d.cardio} color="#fb923c" />}
                        {d.nutrition && <Line label={t('op_field_nutrition')} value={d.nutrition} color="#4ade80" />}
                        {d.notes && <Line label={t('op_field_notes')} value={d.notes} color="#C9A84C" />}
                      </div>
                    )}
                    {st === 'changed' && cur && (
                      <p className="text-[10px] text-zinc-600 mt-1.5 pt-1.5 border-t border-white/[0.05] leading-relaxed">
                        {t('op_rev_was')}: {[cur.training, cur.cardio, cur.nutrition].filter(Boolean).join(' · ') || t('op_day_rest_hint')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {proposed.disclaimer && (
        <p className="rk-meta leading-relaxed">
          <strong className="text-zinc-400">{t('op_disclaimer_prefix')}</strong> {proposed.disclaimer}
        </p>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={onDiscard} className="rk-nav-btn text-sm">{t('op_rev_discard')}</button>
        <button onClick={() => onApply(buildMerged())} disabled={applying || (noChanges)}
          className="rk-cta text-sm disabled:opacity-50">
          {applying
            ? <><span className="inline-block w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin mr-2" />{t('op_saving')}</>
            : <><i className="ri-check-line mr-1" />{t('op_rev_apply', { n: accepted.size })}</>}
        </button>
      </div>
    </div>
  );
}

function Line({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <p className="text-[11px] leading-relaxed">
      <span className="font-bold uppercase tracking-wider mr-1.5" style={{ color }}>{label}:</span>
      <span className="text-zinc-300">{value}</span>
    </p>
  );
}
