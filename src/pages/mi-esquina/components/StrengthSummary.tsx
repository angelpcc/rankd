import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import { isMissingTable, isMissingColumn } from '@/lib/dbState';
import { MUSCLE_GROUPS, muscleGroupOf, type MuscleGroup } from '../lib/exercises';
import { exerciseLines, type StrengthPayload } from '../lib/dayPlan';
import { loadTodayTraining, type TodayTraining } from '../lib/todayTraining';
import MuscleMap, { type MapGroup, type TrainState } from './MuscleMap';
import Reveal from '@/components/base/Reveal';
import { SkeletonBox, SkeletonList } from '@/components/base/Skeleton';

// Fuerza · NIVEL 1 (resumen). Solo consulta: mapa muscular, card de "hoy"
// (day_plan_items kind strength), volumen semanal y últimas sesiones. Un
// botón grande lleva al nivel 2 (pantalla de trabajo).

interface Props {
  profile: Profile;
  onEnter: (tab?: string) => void;
  onGoAsesor: () => void;
  /**
   * Sube al registrar o borrar una sesión. Fuerza a releer el día: lo que se
   * acaba de entrenar tiene que dejar de salir como pendiente al momento.
   */
  refreshKey?: number;
}

type GroupKey = MuscleGroup | 'other';
const ORDER: GroupKey[] = [...MUSCLE_GROUPS, 'other'];
const MAP_GROUPS: MapGroup[] = ['chest', 'shoulders', 'biceps', 'triceps', 'back', 'core', 'legs'];

interface Row { session_date: string; muscle_group: string | null; exercise_label: string; drop_step?: number | null }
interface DaySession { date: string; groups: GroupKey[]; exerciseCount: number }

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StrengthSummary({ profile, onEnter, onGoAsesor, refreshKey = 0 }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [rows, setRows] = useState<Row[]>([]);
  // Pendiente y hecho vienen ya separados por la regla compartida: aquí no se
  // vuelve a decidir qué cuenta como pendiente (ver lib/todayTraining.ts).
  const [today, setToday] = useState<TodayTraining | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const todayI = iso(new Date());
      // `drop_step` viene de la migración 0047. Si no está aplicada, se pide
      // sin ella: entonces no hay dropsets guardados y nada que descontar.
      const setsQuery = (cols: string) => supabase.from('strength_sets').select(cols)
        .eq('fighter_profile_id', profile.id).order('session_date', { ascending: false }).limit(1200);
      const [setsFirst, todayRes, activeRes] = await Promise.all([
        setsQuery('session_date, muscle_group, exercise_label, drop_step'),
        loadTodayTraining(profile.id, ['strength'], todayI),
        supabase.from('objective_plans').select('id')
          .eq('fighter_profile_id', profile.id).eq('status', 'active').limit(1).maybeSingle(),
      ]);
      const setsRes = isMissingColumn(setsFirst.error)
        ? await setsQuery('session_date, muscle_group, exercise_label')
        : setsFirst;
      if (!alive) return;
      if (isMissingTable(setsRes.error)) { setUnavailable(true); setLoading(false); return; }
      // Las bajadas de una serie descendente no son series: se descartan aquí
      // una sola vez, así ni el volumen semanal ni el recuento las cuentan.
      setRows(((setsRes.data || []) as unknown as Row[]).filter((r) => !r.drop_step || r.drop_step === 1));
      setToday(todayRes);
      setHasPlan(!!activeRes.data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id, refreshKey]);

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

  // Un esqueleto con la forma real de la pantalla (mapa, card de hoy, botón,
  // volumen, historial), no una ruedecita: se ve dónde va a aparecer cada cosa
  // y el salto al contenido no mueve el layout.
  if (loading) {
    return (
      <div className="rk-blocks max-w-3xl">
        <SkeletonBox height={260} radius={20} />
        <SkeletonBox height={132} radius={20} />
        <SkeletonBox height={52} radius={14} />
        <SkeletonBox height={196} radius={20} />
        <SkeletonList rows={3} />
      </div>
    );
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

  // ÚNICA condición de la tarjeta "Hoy toca": entradas PLANIFICADAS para hoy y
  // sin completar.
  //
  // `pendingStrength`, no `pending`: esta pantalla es Fuerza y no debe enseñar
  // jamás un bloque de cardio, aunque la consulta llegara a traerlo. La
  // separación se pide explícita para que no dependa de que el `kinds` de la
  // llamada esté bien.
  const todayItems = today?.pendingStrength ?? [];
  // Y si no queda nada pero hoy SÍ se ha entrenado, se confirma en vez de
  // dejar el hueco vacío. Sale de las sesiones reales, no de la Agenda.
  const doneLabel = (today?.trainedGroups ?? [])
    .map((g) => t(`mc_str_mg_${g}`, { defaultValue: g }))
    .join(' + ');

  return (
    <div className="rk-blocks max-w-3xl">
      {/* ── MAPA MUSCULAR ── */}
      <MuscleMap status={mapStatus} onSelect={() => onEnter('registrar')} />

      {/* ── CARD "HOY" ── */}
      <Reveal>
        {todayItems.length > 0 ? (
          <div className="card-primary" style={{ padding: 20 }}>
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400 mb-1.5">
              {t('mc_strs_today')}
            </p>
            {todayItems.map((x, i) => {
              const p = x.payload as StrengthPayload;
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
        ) : today?.trainedStrength ? (
          /* ── Hoy ya está hecho ──
             Sin "Empezar": no hay nada pendiente que empezar. El acceso a
             registrar sigue estando, en tono secundario, por si se mete una
             segunda sesión. */
          <div className="rk-card" style={{ padding: 18, borderColor: 'rgba(74,222,128,0.3)' }}>
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-green-400 mb-1.5 flex items-center gap-1.5">
              <i className="ri-check-double-line" />{t('mc_strs_done_today')}
            </p>
            <p className="text-base font-bold text-white">{doneLabel || t('mc_dp_kind_strength')}</p>
            <p className="text-xs text-zinc-400 mt-1">{t('mc_strs_done_today_desc')}</p>
            <button onClick={() => onEnter('registrar')} className="rk-nav-btn text-xs mt-3 inline-flex items-center gap-1.5" style={{ padding: '0.5rem 1rem' }}>
              <i className="ri-add-line" />{t('mc_strs_done_today_more')}
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

      {/* ── ENTRAR AL NIVEL 2 ── (tras la card destacada: visible nada más entrar)
          Cuando hay entreno hoy, la card ya lleva su propio botón rojo
          "Empezar". Dos botones rojos idénticos y pegados no dicen cuál es la
          acción principal, así que este pasa a segundo plano. Sin entreno hoy
          es la única acción de la pantalla y sí va en rojo. */}
      <button onClick={() => onEnter()}
        className={todayItems.length > 0
          ? 'rk-nav-btn w-full flex items-center justify-center gap-2'
          : 'rk-cta w-full flex items-center justify-center gap-2'}
        style={todayItems.length > 0 ? { minHeight: 44 } : undefined}>
        <i className="ri-hammer-line text-lg" />{t('mc_strs_enter')}
      </button>

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
