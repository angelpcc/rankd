import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  onOpen: () => void;
}

interface Row {
  exercise: string;
  exercise_label: string;
  reps: number;
  reps_max: number | null;
  weight_kg: number;
  session_date: string;
  created_at: string | null;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function yesterdayISO(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "8" o "8–10" si hubo rango de repeticiones en alguna serie del ejercicio. */
function fmtReps(reps: number, repsMax: number | null): string {
  return repsMax && repsMax > reps ? `${reps}–${repsMax}` : String(reps);
}

/**
 * Card del resumen de Mi Esquina con la última sesión de fuerza registrada
 * (agrupa por session_date, como hace la Agenda). Solo lectura: lleva a
 * Progreso → Fuerza para ver o editar el detalle completo.
 */
export default function LastStrengthSession({ profile, onOpen }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('strength_sets')
      .select('exercise, exercise_label, reps, reps_max, weight_kg, session_date, created_at')
      .eq('fighter_profile_id', profile.id)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(80)
      .then(({ data, error }) => {
        if (!alive) return;
        if (isMissingTable(error) || !data || data.length === 0) { setRows(null); return; }
        const lastDate = (data[0] as Row).session_date;
        setRows((data as Row[]).filter((r) => r.session_date === lastDate));
      });
    return () => { alive = false; };
  }, [profile.id]);

  if (!rows || rows.length === 0) return null;

  const byExercise = new Map<string, Row[]>();
  rows.forEach((r) => { const l = byExercise.get(r.exercise) || []; l.push(r); byExercise.set(r.exercise, l); });
  const exercises = [...byExercise.entries()].map(([key, sets]) => ({
    key,
    label: sets[0].exercise_label,
    sets: sets.length,
    reps: sets[0].reps,
    repsMax: sets[0].reps_max,
    weight: Math.max(...sets.map((s) => Number(s.weight_kg))),
  }));
  const totalVolume = Math.round(rows.reduce((a, r) => a + Number(r.weight_kg) * r.reps, 0));
  const date = rows[0].session_date;
  const firstAt = rows.reduce((a: string | null, r) => (r.created_at && (!a || r.created_at < a) ? r.created_at : a), null as string | null);
  const time = firstAt ? new Date(firstAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null;

  const when = date === todayISO()
    ? (time ? t('mc_last_session_today', { time }) : t('mc_str_today'))
    : date === yesterdayISO()
      ? (time ? t('mc_last_session_yesterday', { time }) : t('mc_str_yesterday'))
      : new Date(date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <div className="rk-card relative overflow-hidden cursor-pointer" style={{ padding: '18px 20px' }} onClick={onOpen}>
      <div className="rk-glow-red" style={{ width: 160, height: 160, top: -70, right: -50, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,146,60,0.14) 0%, transparent 68%)' }} />
      <div className="relative flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-orange-500/12 border border-orange-500/30 text-orange-400">
            <i className="ri-hammer-line"></i>
          </div>
          <div>
            <p className="text-sm font-bold text-white">{t('mc_last_session_title')}</p>
            <p className="text-[11px] text-zinc-500">{when}</p>
          </div>
        </div>
        <i className="ri-arrow-right-line text-zinc-600"></i>
      </div>
      <div className="relative space-y-1.5">
        {exercises.slice(0, 4).map((e) => (
          <div key={e.key} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-zinc-300 flex items-center gap-1.5 min-w-0">
              <i className="ri-check-line text-green-400 flex-shrink-0"></i>
              <span className="truncate">{e.label}</span>
            </span>
            <span className="text-zinc-500 font-semibold flex-shrink-0">{e.sets}×{fmtReps(e.reps, e.repsMax)} @ {e.weight}kg</span>
          </div>
        ))}
        {exercises.length > 4 && (
          <p className="text-[10px] text-zinc-600">+{exercises.length - 4}</p>
        )}
      </div>
      <p className="relative text-[11px] text-zinc-500 mt-3 pt-3 border-t border-white/[0.06]">
        {t('mc_last_session_volume', { n: totalVolume.toLocaleString(locale) })}
      </p>
    </div>
  );
}
