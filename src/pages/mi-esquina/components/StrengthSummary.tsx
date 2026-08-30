import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { MUSCLE_GROUPS, muscleGroupOf, type MuscleGroup } from '../lib/exercises';
import { exerciseLines, type StrengthPayload } from '../lib/dayPlan';
import MuscleMap, { type MapGroup, type TrainState } from './MuscleMap';
import Reveal from '@/components/base/Reveal';

// Fuerza · NIVEL 1 (resumen). Solo consulta: mapa muscular, card de "hoy"
// (day_plan_items kind strength), volumen semanal y últimas sesiones. Un
// botón grande lleva al nivel 2 (pantalla de trabajo).

interface Props {
  profile: Profile;
  onEnter: (tab?: string) => void;
  onGoAsesor: () => void;
}

type GroupKey = MuscleGroup | 'other';
const ORDER: GroupKey[] = [...MUSCLE_GROUPS, 'other'];
const MAP_GROUPS: MapGroup[] = ['chest', 'shoulders', 'biceps', 'triceps', 'back', 'core', 'legs'];

interface Row { session_date: string; muscle_group: string | null; exercise_label: string }
interface DaySession { date: string; groups: GroupKey[]; exerciseCount: number }

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StrengthSummary({ profile, onEnter, onGoAsesor }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [rows, setRows] = useState<Row[]>([]);
  const [today, setToday] = useState<StrengthPayload[] | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const todayI = iso(new Date());
      const [setsRes, planRes, activeRes] = await Promise.all([
        supabase.from('strength_sets').select('session_date, muscle_group, exercise_label')
          .eq('fighter_profile_id', profile.id).order('session_date', { ascending: false }).limit(1200),
        supabase.from('day_plan_items').select('payload')
          .eq('fighter_profile_id', profile.id).eq('kind', 'strength').eq('plan_date', todayI),
        supabase.from('objective_plans').select('id')
          .eq('fighter_profile_id', profile.id).eq('status', 'active').limit(1).maybeSingle(),
      ]);
      if (!alive) return;
      if (isMissingTable(setsRes.error)) { setUnavailable(true); setLoading(false); return; }
      setRows((setsRes.data || []) as Row[]);
      if (!isMissingTable(planRes.error)) {
        setToday(((planRes.data || []) as { payload: StrengthPayload }[]).map((r) => r.payload));
      } else {
        setToday([]);
      }
      setHasPlan(!!activeRes.data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id]);

  const groupOf = (r: Row): GroupKey =>
    (r.muscle_group && ORDER.includes(r.muscle_group as GroupKey) ? (r.muscle_group as GroupKey) : (muscleGroupOf(r.exercise_label) || 'other'));

  const mapStatus = useMemo(() => {
    const todayI = iso(new Date());
    const wk = new Date(); const d = wk.getDay() === 0 ? 6 : wk.getDay() - 1;
    wk.setDate(wk.getDate() - d); wk.setHours(0, 0, 0, 0);
    const weekStart = iso(wk);
    const st = {} as Record<MapGroup, TrainState>;
    MAP_GROUPS.forEach((g) => { st[g] = 'none'; });
    rows.forEach((r) => {
      const g = groupOf(r) as MapGroup;
      if (!MAP_GROUPS.includes(g)) return;
      if (r.session_date === todayI) st[g] = 'today';
      else if (r.session_date >= weekStart && st[g] === 'none') st[g] = 'week';
    });
    return st;
  }, [rows]);

  const weekByGroup = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7); cutoff.setHours(0, 0, 0, 0);
    const cut = iso(cutoff);
    const counts = {} as Record<GroupKey, number>;
    ORDER.forEach((g) => { counts[g] = 0; });
    rows.forEach((r) => { if (r.session_date >= cut) counts[groupOf(r)]++; });
    const entries = ORDER.map((g) => [g, counts[g]] as [GroupKey, number]);
    entries.sort((a, b) => (a[1] === 0 && b[1] > 0 ? 1 : b[1] === 0 && a[1] > 0 ? -1 : b[1] - a[1]));
    const max = Math.max(1, ...entries.map(([, n]) => n));
    return { entries, max, total: entries.reduce((s, [, n]) => s + n, 0) };
  }, [rows]);

  const recent = useMemo<DaySession[]>(() => {
    const byDate = new Map<string, Row[]>();
    rows.forEach((r) => { const l = byDate.get(r.session_date) || []; l.push(r); byDate.set(r.session_date, l); });
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 5)
      .map(([date, rs]) => {
        const groups = [...new Set(rs.map(groupOf))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
        const exerciseCount = new Set(rs.map((r) => r.exercise_label)).size;
        return { date, groups, exerciseCount };
      });
  }, [rows]);

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const agoLabel = (d: string) => {
    const days = Math.floor((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000);
    if (days <= 0) return t('mc_str_today');
    if (days === 1) return t('mc_str_yesterday');
    return t('mc_str_days_ago', { n: days });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25">
          <i className="ri-hammer-line text-3xl text-red-400" />
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  const todayItems = today || [];

  return (
    <div className="rk-blocks max-w-3xl">
      {/* ── MAPA MUSCULAR ── */}
      <MuscleMap status={mapStatus} onSelect={() => onEnter('registrar')} />

      {/* ── CARD "HOY" ── */}
      <Reveal>
        {todayItems.length > 0 ? (
          <div className="card-primary" style={{ padding: 20 }}>
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400 mb-1.5">{t('mc_strs_today')}</p>
            {todayItems.map((p, i) => {
              const groups = (p.groups || []).map((g) => t(`mc_str_mg_${g}`, { defaultValue: g })).join(' + ');
              const lines = exerciseLines(p.exercises, t);
              return (
                <div key={i} className={i > 0 ? 'mt-3 pt-3 border-t border-white/[0.08]' : ''}>
                  <p className="text-base font-bold text-white">{groups || t('mc_dp_kind_strength')}</p>
                  {lines.length > 0 && <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{lines.slice(0, 5).join(' · ')}</p>}
                </div>
              );
            })}
            <button onClick={() => onEnter('registrar')} className="rk-cta w-full flex items-center justify-center gap-2 mt-4">
              <i className="ri-play-fill text-lg" />{t('mc_strs_start')}
            </button>
          </div>
        ) : hasPlan ? (
          <div className="rk-card" style={{ padding: 18 }}>
            <p className="text-sm font-bold text-white">{t('mc_strs_none_today')}</p>
            <p className="text-xs text-zinc-400 mt-1">{t('mc_strs_none_today_desc')}</p>
            <button onClick={() => onEnter('programar')} className="rk-nav-btn text-xs mt-3 inline-flex items-center gap-1.5" style={{ padding: '0.5rem 1rem' }}>
              {t('mc_strs_see_week')}<i className="ri-arrow-right-line" />
            </button>
          </div>
        ) : (
          <div className="rk-card" style={{ padding: 18 }}>
            <p className="text-sm font-bold text-white">{t('mc_strs_no_plan')}</p>
            <p className="text-xs text-zinc-400 mt-1">{t('mc_strs_no_plan_desc')}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={onGoAsesor} className="rk-nav-btn text-xs inline-flex items-center gap-1.5" style={{ padding: '0.5rem 1rem' }}>
                <i className="ri-compass-3-line" />{t('mc_nav_advisor')}
              </button>
              <button onClick={() => onEnter('registrar')} className="rk-nav-btn text-xs inline-flex items-center gap-1.5" style={{ padding: '0.5rem 1rem' }}>
                <i className="ri-add-line" />{t('mc_str_new')}
              </button>
            </div>
          </div>
        )}
      </Reveal>

      {/* ── VOLUMEN SEMANAL ── */}
      {weekByGroup.total > 0 && (
        <div className="rk-card" style={{ padding: 20 }}>
          <p className="rk-label mb-3">{t('mc_str_wk_vol_title')}</p>
          <div className="space-y-2">
            {weekByGroup.entries.map(([g, n]) => {
              const pct = n === 0 ? 0 : Math.round((n / weekByGroup.max) * 100);
              const zero = n === 0;
              return (
                <div key={g} className="flex items-center gap-3">
                  <span className="w-20 flex-shrink-0 text-xs font-semibold" style={{ color: zero ? 'var(--t-3)' : 'var(--t-2)' }}>{t(`mc_str_mg_${g}`)}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--s-3)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: zero ? 'transparent' : 'var(--accent)' }} />
                  </div>
                  <span className="w-8 flex-shrink-0 text-right" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: zero ? 'var(--t-3)' : 'var(--gold)' }}>{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ENTRAR AL NIVEL 2 ── (antes del historial: visible sin bajar del todo) */}
      <button onClick={() => onEnter()} className="rk-cta w-full flex items-center justify-center gap-2">
        <i className="ri-hammer-line text-lg" />{t('mc_strs_enter')}
      </button>

      {/* ── ÚLTIMAS SESIONES ── */}
      {recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="rk-label">{t('mc_str_history')}</h3>
            <button onClick={() => onEnter('historial')} className="text-xs text-zinc-400 hover:text-white cursor-pointer inline-flex items-center gap-1">
              {t('mc_strs_see_all')}<i className="ri-arrow-right-line" />
            </button>
          </div>
          <div className="rk-stack">
            {recent.map((s) => (
              <div key={s.date} className="rk-card flex items-center gap-3" style={{ padding: '12px 16px' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">
                    {fmtDate(s.date)} <span className="text-zinc-500 font-normal">· {agoLabel(s.date)}</span>
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">
                    {s.groups.map((g) => t(`mc_str_mg_${g}`)).join(' + ')} · {t('mc_str_ex_count', { count: s.exerciseCount })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
