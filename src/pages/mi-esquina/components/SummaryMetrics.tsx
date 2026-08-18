import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

// Fila de 3 métricas compactas del resumen (bloque C.1). Cards SECUNDARIAS (sin
// glow): entrenos de la semana, peso + delta, y días para el combate (o
// progreso del objetivo de peso si no hay combate). Números clave en oro.

interface Props {
  profile: Profile;
  weekSessions: number;
  weekTarget?: number;
  onOpenAgenda: () => void;
  onOpenWeight: () => void;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SummaryMetrics({ profile, weekSessions, weekTarget = 4, onOpenAgenda, onOpenWeight }: Props) {
  const { t } = useTranslation();
  const [weight, setWeight] = useState<{ current: number; delta: number | null; target: number | null } | null>(null);
  const [fightDays, setFightDays] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: entries, error: wErr }, { data: goal }, { data: fight }] = await Promise.all([
        supabase.from('weight_entries').select('weight_kg, entry_date')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(10),
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
        supabase.from('planned_events').select('event_date').eq('fighter_profile_id', profile.id)
          .eq('kind', 'fight').gte('event_date', todayISO()).order('event_date', { ascending: true }).limit(1).maybeSingle(),
      ]);
      if (!alive) return;
      if (!isMissingTable(wErr) && entries && entries.length) {
        const current = Number(entries[0].weight_kg);
        // Delta vs la referencia más cercana a hace ~7 días (o la anterior).
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const ref = entries.find((e) => new Date(e.entry_date) <= weekAgo) || entries[1];
        const delta = ref ? +(current - Number(ref.weight_kg)).toFixed(1) : null;
        const target = goal?.target_weight_kg ? Number(goal.target_weight_kg) : null;
        setWeight({ current, delta, target });
      }
      if (fight?.event_date) {
        const days = Math.ceil((new Date(fight.event_date + 'T12:00:00').getTime() - Date.now()) / 86400000);
        setFightDays(days >= 0 ? days : null);
      }
    })();
    return () => { alive = false; };
  }, [profile.id]);

  const num = (v: string | number, color = '#C9A84C') => (
    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.6rem,6vw,2rem)', lineHeight: 1, color }}>{v}</span>
  );

  // Tercera métrica: combate si hay fecha, si no progreso de peso hacia objetivo.
  let third: { top: React.ReactNode; label: string; onClick?: () => void };
  if (fightDays !== null) {
    third = { top: <>{num(fightDays, '#E10600')}<span className="text-xs text-zinc-500 ml-1">{t('mc_metric_days')}</span></>, label: t('mc_metric_fight'), onClick: onOpenAgenda };
  } else if (weight?.target) {
    const remaining = +(weight.current - weight.target).toFixed(1);
    third = { top: <>{num(Math.abs(remaining))}<span className="text-xs text-zinc-500 ml-1">kg</span></>, label: remaining > 0 ? t('mc_metric_to_lose') : t('mc_metric_to_gain'), onClick: onOpenWeight };
  } else {
    third = { top: num('—', '#71717a'), label: t('mc_metric_goal'), onClick: onOpenWeight };
  }

  const cards = [
    {
      top: <>{num(weekSessions, weekSessions >= weekTarget ? '#22c55e' : '#ffffff')}<span className="text-lg text-zinc-600">/{weekTarget}</span></>,
      label: t('mc_metric_week'), onClick: onOpenAgenda,
    },
    weight
      ? {
          top: <div className="flex items-baseline gap-1.5 justify-center flex-wrap">
            {num(weight.current)}<span className="text-xs text-zinc-500">kg</span>
            {weight.delta !== null && weight.delta !== 0 && (
              <span className={`text-xs font-bold ${weight.delta < 0 ? 'text-green-400' : 'text-orange-400'}`}>{weight.delta < 0 ? '▼' : '▲'} {Math.abs(weight.delta)}</span>
            )}
          </div>,
          label: t('mc_metric_weight'), onClick: onOpenWeight,
        }
      : { top: num('—', '#71717a'), label: t('mc_metric_weight'), onClick: onOpenWeight },
    third,
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((c, i) => (
        <button key={i} onClick={c.onClick} style={{ minHeight: 92 }}
          className="rk-card flex flex-col items-center justify-center text-center cursor-pointer" >
          <div className="mb-1.5">{c.top}</div>
          <p className="text-[10px] sm:text-[11px] text-zinc-500 uppercase tracking-wider leading-tight px-1">{c.label}</p>
        </button>
      ))}
    </div>
  );
}
