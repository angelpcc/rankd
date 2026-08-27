import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { type DayPlanItem, KIND_META, KIND_ORDER, summarizeItem } from '../lib/dayPlan';

interface Props {
  profile: Profile;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/**
 * Vista de un vistazo de los próximos 7 días: círculos por día (rojo si hay
 * algo planificado, pulsante si es hoy) + hasta 3 próximos elementos del plan.
 * Lee day_plan_items. Complementa a WeeklyAgenda (el calendario completo).
 */
export default function AgendaWeekStrip({ profile }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [items, setItems] = useState<DayPlanItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayISO = iso(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  useEffect(() => {
    let alive = true;
    supabase.from('day_plan_items').select('*')
      .eq('fighter_profile_id', profile.id)
      .gte('plan_date', todayISO)
      .lte('plan_date', iso(days[6]))
      .order('plan_date', { ascending: true })
      .then(({ data, error }) => {
        if (!alive || isMissingTable(error)) return;
        setItems((data || []) as DayPlanItem[]);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const byDate = new Map<string, DayPlanItem[]>();
  items.forEach((e) => { const l = byDate.get(e.plan_date) || []; l.push(e); byDate.set(e.plan_date, l); });
  for (const list of byDate.values()) list.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));

  const upcoming = [...items].sort((a, b) => a.plan_date.localeCompare(b.plan_date)).slice(0, 3);
  const dayLabel = (d: Date) => d.toLocaleDateString(locale, { weekday: 'narrow' }).toUpperCase();
  const relLabel = (dateISO: string) => {
    if (dateISO === todayISO) return t('mc_today');
    if (dateISO === iso(addDays(today, 1))) return t('mc_cal_tomorrow');
    return new Date(dateISO + 'T12:00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
  };

  if (items.length === 0) return null;

  return (
    <div className="rk-card" style={{ padding: '16px 18px', transform: 'none' }}>
      <div className="flex items-center justify-between gap-2">
        {days.map((d) => {
          const dISO = iso(d);
          const has = (byDate.get(dISO) || []).length > 0;
          const isToday = dISO === todayISO;
          return (
            <button key={dISO} onClick={() => setExpanded((cur) => cur === dISO ? null : dISO)}
              className="flex flex-col items-center gap-1.5 cursor-pointer group flex-1">
              <span className="text-[9px] font-bold text-zinc-600 uppercase">{dayLabel(d)}</span>
              <span className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${expanded === dISO ? 'ring-2 ring-white/40' : ''}`}
                style={has ? { background: '#E10600', color: '#fff' } : { background: 'rgba(255,255,255,0.05)', color: '#71717a' }}>
                {isToday && <span className="absolute inset-0 rounded-full anim-pulse-glow" style={{ boxShadow: `0 0 0 2px ${has ? '#E10600' : 'rgba(255,255,255,0.25)'}` }} />}
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] anim-scale-in">
          {(byDate.get(expanded) || []).length === 0 ? (
            <p className="text-xs text-zinc-600">{t('mc_aws_free_day')}</p>
          ) : (
            <div className="space-y-1.5">
              {(byDate.get(expanded) || []).map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-xs text-zinc-300">
                  <i className={KIND_META[e.kind].icon} style={{ color: KIND_META[e.kind].hex }}></i>
                  <span className="font-semibold truncate">{summarizeItem(e, t)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2">{t('mc_aws_upcoming')}</p>
          {upcoming.map((e) => (
            <div key={e.id} className="group flex items-center gap-2.5 text-xs py-1">
              <i className={`${KIND_META[e.kind].icon} flex-shrink-0`} style={{ color: KIND_META[e.kind].hex }}></i>
              <span className="font-semibold text-zinc-200 truncate">{summarizeItem(e, t)}</span>
              <span className="text-zinc-600 flex-shrink-0">· {relLabel(e.plan_date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
