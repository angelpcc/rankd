import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  onOpenHistory: () => void;
}

interface SetRow { session_date: string; muscle_group: string | null; exercise_label: string; exercise: string }
interface DaySummary { date: string; groups: string[]; exerciseCount: number }

function fmtDate(d: string, locale: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/**
 * "Últimas sesiones" (rediseño UI/UX, sección 4): máximo 3, Card Plana.
 * No renderiza nada si no hay sesiones — Resumen no muestra estados vacíos
 * de esta sección (simplemente no aparece).
 */
export default function RecentSessions({ profile, onOpenHistory }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [days, setDays] = useState<DaySummary[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from('strength_sets')
        .select('session_date, muscle_group, exercise_label, exercise')
        .eq('fighter_profile_id', profile.id)
        .order('session_date', { ascending: false })
        .limit(120);
      if (!alive || isMissingTable(error) || !data) return;
      const byDate = new Map<string, SetRow[]>();
      (data as SetRow[]).forEach((r) => { const l = byDate.get(r.session_date) || []; l.push(r); byDate.set(r.session_date, l); });
      const summaries = [...byDate.entries()].slice(0, 3).map(([date, rows]) => ({
        date,
        groups: [...new Set(rows.map((r) => r.muscle_group).filter(Boolean))] as string[],
        exerciseCount: new Set(rows.map((r) => r.exercise)).size,
      }));
      setDays(summaries);
    })();
    return () => { alive = false; };
  }, [profile.id]);

  if (days.length === 0) return null;

  return (
    <div>
      <p className="t-label mb-2">{t('mc_recent_sessions')}</p>
      <div className="space-y-2">
        {days.map((d) => (
          <button key={d.date} onClick={onOpenHistory} className="card-flat w-full flex items-center justify-between gap-3 text-left cursor-pointer">
            <div className="min-w-0">
              <p className="t-body" style={{ color: 'var(--text-1)', fontWeight: 600 }}>{fmtDate(d.date, locale)}</p>
              <p className="t-body mt-0.5" style={{ fontSize: 13 }}>
                {d.groups.length > 0 ? d.groups.map((g) => t(`mc_str_mg_${g}`, g)).join(' + ') : t('mc_recent_free')}
                {' · '}{t('mc_str_ex_count', { count: d.exerciseCount })}
              </p>
            </div>
            <ChevronRight size={16} color="var(--text-3)" strokeWidth={1.5} style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
      <button onClick={onOpenHistory} className="t-body mt-2 flex items-center gap-1 cursor-pointer" style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 13 }}>
        {t('mc_recent_view_all')} <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
