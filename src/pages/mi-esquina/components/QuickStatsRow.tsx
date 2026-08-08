import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  /** Sesiones registradas esta semana (ya calculado en page.tsx, se reusa aquí). */
  weekSessions: number;
  weekTarget?: number;
  onOpenAgenda: () => void;
  onOpenStrength: () => void;
}

const SESSION_ICONS: Record<string, string> = {
  sparring: 'ri-boxing-line', tecnica: 'ri-focus-3-line', fuerza: 'ri-hammer-line',
  cardio: 'ri-run-line', flexibilidad: 'ri-yoga-line', recuperacion: 'ri-heart-pulse-line',
};

function timeAgo(iso: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return t('mc_qs_mins_ago', { n: Math.max(1, mins) });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('mc_qs_hours_ago', { n: hours });
  const days = Math.floor(hours / 24);
  return t('mc_qs_days_ago', { n: days });
}

/**
 * Tres mini-cards de estado rápido en el resumen: sesiones de la semana,
 * última sesión (cualquier tipo) y objetivo de peso. Datos ligeros, propios
 * (no duplica lo que ya muestran WeeklySummary/LastStrengthSession en detalle).
 */
export default function QuickStatsRow({ profile, weekSessions, weekTarget = 5, onOpenAgenda, onOpenStrength }: Props) {
  const { t } = useTranslation();
  const [last, setLast] = useState<{ type: string; at: string } | null>(null);
  const [weight, setWeight] = useState<{ current: number; target: number } | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.from('training_sessions').select('session_type, created_at')
      .eq('fighter_profile_id', profile.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (!alive || isMissingTable(error) || !data) return;
        setLast({ type: data.session_type, at: data.created_at });
      });
    Promise.all([
      supabase.from('weight_entries').select('weight_kg').eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
    ]).then(([w, g]) => {
      if (!alive) return;
      const current = (w.data as { weight_kg?: number } | null)?.weight_kg;
      const target = (g.data as { target_weight_kg?: number } | null)?.target_weight_kg;
      if (current != null && target != null) setWeight({ current, target });
    });
    return () => { alive = false; };
  }, [profile.id]);

  const weekColor = weekSessions >= weekTarget ? '#22c55e' : weekSessions >= 3 ? '#eab308' : '#E10600';
  const weightPct = weight ? Math.max(0, Math.min(100, Math.round((1 - Math.abs(weight.current - weight.target) / Math.max(weight.current, weight.target, 1)) * 100))) : null;

  const cards = [
    {
      key: 'week', icon: 'ri-calendar-check-line', color: weekColor, onClick: onOpenAgenda,
      big: `${weekSessions}/${weekTarget}`, label: t('mc_qs_week_title'),
      detail: weekSessions >= weekTarget ? t('mc_qs_week_full') : t('mc_qs_week_left', { n: Math.max(0, weekTarget - weekSessions) }),
    },
    {
      key: 'last', icon: last ? (SESSION_ICONS[last.type] || 'ri-boxing-line') : 'ri-time-line', color: '#38bdf8', onClick: onOpenAgenda,
      big: last ? t(`mc_st_${last.type}`) : '—', label: t('mc_qs_last_title'),
      detail: last ? timeAgo(last.at, t) : t('mc_qs_last_empty'),
    },
    {
      key: 'weight', icon: 'ri-scales-2-line', color: '#C9A84C', onClick: onOpenStrength,
      big: weight ? `${weightPct}%` : '—', label: t('mc_qs_weight_title'),
      detail: weight ? `${weight.current}kg → ${weight.target}kg` : t('mc_qs_weight_empty'),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {cards.map((c) => (
        <button key={c.key} onClick={c.onClick}
          className="group rk-card text-left cursor-pointer relative overflow-hidden" style={{ padding: '14px 10px', transform: 'none' }}>
          <i className={c.icon} style={{ color: c.color, fontSize: 16 }}></i>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(18px,4vw,24px)', lineHeight: 1, color: c.color, marginTop: 6 }} className="truncate">
            {c.big}
          </p>
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1 leading-tight truncate">{c.label}</p>
          <p className="text-[10px] text-zinc-600 mt-1 leading-tight opacity-0 max-h-0 group-hover:opacity-100 group-hover:max-h-6 transition-all duration-200 truncate">
            {c.detail}
          </p>
        </button>
      ))}
    </div>
  );
}
