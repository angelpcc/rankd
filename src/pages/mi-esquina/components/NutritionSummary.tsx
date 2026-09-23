import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import SegmentedProgress from '@/components/base/SegmentedProgress';
import MacroRings from './MacroRings';
import SectionHero from './SectionHero';
import WeekBars from '@/components/base/WeekBars';
import { last7Days } from '@/components/base/weekBarsData';
import ObjetivoDiarioCard from './ObjetivoDiarioCard';
import { cargarObjetivoDiario, type DailyTarget } from '../lib/objetivoDiario';

// Nutrición · NIVEL 1 (resumen). Solo consulta: anillos de macros, barra de
// calorías segmentada y diario del día compacto (4 franjas). Un botón lleva al
// nivel 2 (pantalla de trabajo).

interface Props {
  profile: Profile;
  onEnter: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface MealRow { meal_type: string; description: string; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }

const SLOTS = [
  { value: 'desayuno', labelKey: 'mc_meal_breakfast', icon: 'ri-sun-line' },
  { value: 'comida', labelKey: 'mc_meal_lunch', icon: 'ri-restaurant-2-line' },
  { value: 'cena', labelKey: 'mc_meal_dinner', icon: 'ri-moon-line' },
  { value: 'snack', labelKey: 'mc_meal_snack', icon: 'ri-cake-3-line' },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NutritionSummary({ profile, onEnter, showToast }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<MealRow[]>([]);
  const [loading, setLoading] = useState(true);
  // El objetivo del día (lib/objetivoDiario.ts), el mismo que ven el Resumen,
  // el plan de comidas y las IAs. Estaba preparado aquí con un null fijo
  // "hasta que existiera", y existía: solo que en otra pestaña.
  const [objetivo, setObjetivo] = useState<DailyTarget | null>(null);
  const [recarga, setRecarga] = useState(0);
  const kcalGoal = objetivo?.kcal ?? null;

  useEffect(() => {
    let alive = true;
    cargarObjetivoDiario(profile.id).then((o) => { if (alive) setObjetivo(o); }).catch(() => {});
    return () => { alive = false; };
  }, [profile.id, recarga]);

  // Últimos 7 días para la tira semanal. Una cifra suelta de hoy no dice si
  // estás siendo constante; siete barras sí.
  const [week, setWeek] = useState<{ entry_date: string; calories: number | null }[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - 6);
      const sinceISO = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
      const [meals, weekRes] = await Promise.all([
        supabase.from('meal_entries')
          .select('meal_type, description, calories, protein_g, carbs_g, fat_g')
          .eq('fighter_profile_id', profile.id).eq('entry_date', todayISO()),
        supabase.from('meal_entries')
          .select('entry_date, calories')
          .eq('fighter_profile_id', profile.id).gte('entry_date', sinceISO),
      ]);
      if (!alive) return;
      setRows((meals.data || []) as MealRow[]);
      setWeek((weekRes.data || []) as { entry_date: string; calories: number | null }[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id]);

  // Si no hay macros guardadas, la barra cuenta COMIDAS registradas: sigue
  // diciendo si has apuntado o no, que es lo que importa para la constancia.
  const weekBars = useMemo(() => {
    const anyKcal = week.some((r) => (r.calories || 0) > 0);
    const m = new Map<string, number>();
    week.forEach((r) => {
      const add = anyKcal ? (r.calories || 0) : 1;
      m.set(r.entry_date, (m.get(r.entry_date) || 0) + add);
    });
    return { days: last7Days(m), unit: anyKcal ? 'kcal' : undefined };
  }, [week]);

  const totals = useMemo(() => {
    const withMacros = rows.filter((r) => r.calories !== null);
    return withMacros.reduce((a, r) => ({
      kcal: a.kcal + (r.calories || 0),
      protein: a.protein + (r.protein_g || 0),
      carbs: a.carbs + (r.carbs_g || 0),
      fat: a.fat + (r.fat_g || 0),
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }, [rows]);

  const bySlot = useMemo(() => {
    const m = new Map<string, { count: number; kcal: number; sample: string }>();
    rows.forEach((r) => {
      const e = m.get(r.meal_type) || { count: 0, kcal: 0, sample: '' };
      e.count += 1;
      e.kcal += r.calories || 0;
      if (!e.sample) e.sample = r.description;
      else if (e.count === 2) e.sample += ` · ${r.description}`;
      m.set(r.meal_type, e);
    });
    return m;
  }, [rows]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const slotsLogged = SLOTS.filter((s) => bySlot.has(s.value)).length;
  const calSeg = kcalGoal && kcalGoal > 0
    ? { done: Math.min(12, Math.round((totals.kcal / kcalGoal) * 12)), total: 12 }
    : { done: slotsLogged, total: SLOTS.length };

  return (
    <div className="rk-blocks max-w-3xl xl:max-w-[1120px]">
      {/* v4: la cabecera común; la portada de Nutrición entraba sin ella. */}
      <SectionHero kind="nutrition" title={t('mc_ng_hero_title')} subtitle={t('mc_ng_hero_sub')}
        action={{ label: t('mc_ns_enter'), icon: 'ri-restaurant-line', onClick: onEnter }} />
      {/* ── CABECERA: lo de hoy y el objetivo ──
          En el ordenador, lado a lado: lo que llevas a la izquierda y contra
          qué se mide a la derecha. En el móvil, uno debajo del otro. */}
      <div className={`grid gap-4 items-start ${objetivo ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
      <Reveal>
        <div className="card-primary" style={{ padding: 22 }}>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400">{t('mc_ns_today')}</p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: 'var(--t-1)', lineHeight: 1 }}>
              {Math.round(totals.kcal)} <span className="text-zinc-500 text-sm">{kcalGoal ? `/ ${kcalGoal} kcal` : 'kcal'}</span>
            </p>
          </div>
          <SegmentedProgress done={calSeg.done} total={calSeg.total} className="mb-1" />
          <p className="text-[10px] text-zinc-500 mb-5">
            {kcalGoal
              ? (totals.kcal <= kcalGoal
                ? t('mc_ns_cal_left', { n: Math.round(kcalGoal - totals.kcal) })
                : t('mc_ns_cal_over', { n: Math.round(totals.kcal - kcalGoal) }))
              : t('mc_ns_cal_no_goal_hint', { n: slotsLogged, total: SLOTS.length })}
          </p>
          <MacroRings protein={totals.protein} carbs={totals.carbs} fat={totals.fat}
            goals={objetivo ? { protein: objetivo.protein, carbs: objetivo.carbs, fat: objetivo.fat } : null} />
        </div>
      </Reveal>
      {objetivo && (
        <Reveal delay={40}>
          <ObjetivoDiarioCard profileId={profile.id} target={objetivo} showToast={showToast}
            onChanged={() => setRecarga((k) => k + 1)} />
        </Reveal>
      )}
      </div>

      {/* ── LA SEMANA DE UN VISTAZO ── */}
      <Reveal delay={60}>
        <div className="rk-card" style={{ padding: 16 }}>
          <p className="rk-label mb-3">{t('mc_ns_week')}</p>
          <WeekBars days={weekBars.days} unit={weekBars.unit} color="#4ade80" />
        </div>
      </Reveal>

      {/* ── DIARIO DEL DÍA COMPACTO ── */}
      <Reveal delay={80}>
        <div className="rk-card" style={{ padding: 16 }}>
          <p className="rk-label mb-3">{t('mc_ns_diary')}</p>
          <div className="space-y-2">
            {SLOTS.map((s) => {
              const e = bySlot.get(s.value);
              return (
                <div key={s.value} className="flex items-center gap-3">
                  <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-zinc-400">
                    <i className={`${s.icon} text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{t(s.labelKey)}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{e ? e.sample : t('mc_ns_slot_empty')}</p>
                  </div>
                  {e && (
                    <span className="text-xs font-semibold text-zinc-400 flex-shrink-0">
                      {e.kcal > 0 ? `${Math.round(e.kcal)} kcal` : t('mc_ns_slot_n', { n: e.count })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      <button onClick={onEnter} className="rk-cta w-full flex items-center justify-center gap-2">
        <i className="ri-restaurant-line text-lg" />{t('mc_ns_enter')}
      </button>
    </div>
  );
}
