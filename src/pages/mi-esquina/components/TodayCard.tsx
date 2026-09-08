import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import PhotoCard from '@/components/base/PhotoCard';
import { SkeletonBox } from '@/components/base/Skeleton';
import { type DayPlanItem, type StrengthPayload, type ActivityPayload, activityKindCfg, exerciseLines, KIND_META } from '../lib/dayPlan';

// "Tu siguiente acción" — el elemento PRINCIPAL del Resumen y el ÚNICO CTA rojo
// de la pantalla. Es una PhotoCard (fondo a sangre + degradado + texto) cuyo
// estado cambia por prioridad:
//
//   1. combate próximo  (solo PRO, pelea a ≤7 días)
//   2. entrenamiento pendiente hoy
//   3. peso sin registrar (≥4 días, o pesaje PRO cerca)
//   4. día de descanso / sin nada planificado
//   5. sin plan
//
// El botón interno es el CTA principal (rk-cta rojo). No debe haber otro CTA
// rojo en el Resumen.

interface Props {
  profile: Profile;
  mode: 'pro' | 'hobby';
  onStart: () => void;       // abre la agenda del día
  onCreatePlan: () => void;  // abre Asesor (plan)
  onLogWeight: () => void;    // abre Peso
  onLogToday: () => void;     // abre Actividad con hoy puesto
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Días de diferencia entre `iso` y hoy, ambos a medianoche. Positivo = futuro
// (faltan N días), negativo = pasado (hace N días).
function dayDelta(iso: string): number {
  const a = new Date(iso + 'T00:00:00'); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

interface TrainToday { icon: string; title: string; typeLabelKey: string; note: string | null }
interface FightRow { event_date: string; title: string; kind: string }

export default function TodayCard({ profile, mode, onStart, onCreatePlan, onLogWeight, onLogToday }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState<TrainToday[]>([]);
  const [hasPlan, setHasPlan] = useState(false);
  const [daysSinceWeight, setDaysSinceWeight] = useState<number | null>(null);
  const [nextFight, setNextFight] = useState<FightRow | null>(null);
  const [nextWeighIn, setNextWeighIn] = useState<FightRow | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const isPro = mode === 'pro';
      const [{ data: rows, error: evErr }, { data: plan }, { data: wRows }, fightRes] = await Promise.all([
        supabase.from('day_plan_items').select('kind, payload')
          .eq('fighter_profile_id', profile.id).eq('plan_date', todayISO()).in('kind', ['strength', 'activity']),
        supabase.from('objective_plans').select('id')
          .eq('fighter_profile_id', profile.id).eq('status', 'active').limit(1).maybeSingle(),
        supabase.from('weight_entries').select('entry_date')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1),
        isPro
          ? supabase.from('planned_events').select('event_date, title, kind')
              .eq('fighter_profile_id', profile.id).in('kind', ['fight', 'weigh_in'])
              .gte('event_date', todayISO()).order('event_date', { ascending: true })
          : Promise.resolve({ data: null, error: null } as { data: FightRow[] | null; error: null }),
      ]);
      if (!alive) return;

      if (!isMissingTable(evErr)) {
        const list = ((rows || []) as Pick<DayPlanItem, 'kind' | 'payload'>[]).map((r): TrainToday => {
          if (r.kind === 'strength') {
            const p = r.payload as StrengthPayload;
            const exLine = exerciseLines(p.exercises, t).join(' · ');
            return {
              icon: KIND_META.strength.icon,
              title: (p.groups || []).map((g) => t(`mc_str_mg_${g}`, { defaultValue: g })).join(' + ') || t('mc_dp_kind_strength'),
              typeLabelKey: 'mc_dp_kind_strength',
              note: exLine || p.note || null,
            };
          }
          const p = r.payload as ActivityPayload;
          const cfg = activityKindCfg(p.kind);
          return { icon: cfg.icon, title: t(cfg.labelKey), typeLabelKey: cfg.labelKey, note: p.note || null };
        });
        setTraining(list);
      }

      setHasPlan(!!plan);

      const lastW = (wRows || [])[0] as { entry_date: string } | undefined;
      setDaysSinceWeight(lastW ? -dayDelta(lastW.entry_date) : null);

      const fr = (fightRes.data || []) as FightRow[];
      setNextFight(fr.find((r) => r.kind === 'fight') || null);
      setNextWeighIn(fr.find((r) => r.kind === 'weigh_in') || null);

      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id, mode, t]);

  if (loading) {
    // Esqueleto con la forma de la PhotoCard: chip arriba, titular abajo y
    // botón, para que al llegar los datos no salte el layout.
    return (
      <div className="rk-card" style={{ minHeight: 210, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} role="status" aria-busy="true">
        <SkeletonBox width={110} height={22} radius={999} />
        <div>
          <SkeletonBox width="65%" height={26} />
          <SkeletonBox width="85%" height={12} style={{ marginTop: 10 }} />
          <SkeletonBox width="100%" height={48} radius={14} style={{ marginTop: 16 }} />
        </div>
      </div>
    );
  }

  const pill = (text: string, tone: 'accent' | 'ghost' = 'accent') => (
    <span style={{
      background: tone === 'accent' ? 'var(--accent)' : 'rgba(255,255,255,0.14)',
      color: '#fff',
      borderRadius: 'var(--r-pill)', padding: '4px 12px', fontSize: 12, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{text}</span>
  );

  const cta = (label: string, icon: string, onClick: () => void) => (
    <button onClick={onClick} className="rk-cta rk-press w-full flex items-center justify-center gap-2" style={{ minHeight: 48 }}>
      <i className={`${icon} text-lg`} /> {label}
    </button>
  );

  const main = training[0];
  const fightDays = nextFight ? dayDelta(nextFight.event_date) : null;

  // ── Estado 1: combate próximo (PRO, ≤7 días) ──
  if (mode === 'pro' && nextFight && fightDays != null && fightDays >= 0 && fightDays <= 7) {
    const sub = nextWeighIn
      ? t('mc_hoy_fight_weighin', { date: new Date(nextWeighIn.event_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long' }) })
      : t('mc_hoy_fight_desc');
    return (
      <PhotoCard
        primary
        image="/images/sparring.webp"
        icon="ri-sword-line"
        chips={pill(fightDays <= 0 ? t('mc_hoy_fight_today') : t('mc_hoy_fight_in', { n: fightDays }))}
        title={nextFight.title.toUpperCase()}
        subtitle={sub}
        footer={cta(t('mc_hoy_fight_cta'), 'ri-focus-3-line', onStart)}
      />
    );
  }

  // ── Estado 2: hay entreno hoy ──
  if (main) {
    const extra = training.length - 1;
    const isStrength = main.typeLabelKey === 'mc_dp_kind_strength';
    return (
      <PhotoCard
        primary
        image={isStrength ? '/images/fuerza.webp' : '/images/correr.webp'}
        icon={main.icon}
        chips={<>{pill(t('mc_hoy_pending'))}{extra > 0 && pill(`+${extra}`, 'ghost')}</>}
        title={main.title.toUpperCase()}
        subtitle={main.note || t('mc_hoy_pending_desc')}
        footer={cta(t('mc_hoy_start'), 'ri-play-fill', onStart)}
      />
    );
  }

  // ── Estado 3: peso sin registrar (≥4 días) ──
  if (daysSinceWeight != null && daysSinceWeight >= 4) {
    return (
      <PhotoCard
        primary
        image="/images/hero-plan.svg"
        icon="ri-scales-2-line"
        chips={pill(t('mc_hoy_weight_chip'))}
        title={t('mc_hoy_weight_title').toUpperCase()}
        subtitle={t('mc_hoy_weight_desc', { n: daysSinceWeight })}
        footer={cta(t('mc_hoy_weight_cta'), 'ri-scales-2-line', onLogWeight)}
      />
    );
  }

  // ── Estado 4: plan activo, hoy sin nada planificado (descanso / suelto) ──
  if (hasPlan) {
    return (
      <PhotoCard
        primary
        image="/images/hero-rest.svg"
        icon="ri-heart-pulse-line"
        chips={pill(t('mc_hoy_eyebrow'), 'ghost')}
        title={t('mc_hoy_rest_title').toUpperCase()}
        subtitle={t('mc_hoy_rest_desc')}
        footer={cta(t('mc_hoy_rest_cta'), 'ri-add-line', onLogToday)}
      />
    );
  }

  // ── Estado 5: sin plan ──
  return (
    <PhotoCard
      primary
      image="/images/hero-plan.svg"
      icon="ri-sparkling-2-line"
      chips={pill(t('mc_hoy_eyebrow'), 'ghost')}
      title={t('mc_hoy_noplan_title').toUpperCase()}
      subtitle={t('mc_hoy_noplan_desc')}
      footer={cta(t('mc_hoy_create'), 'ri-add-line', onCreatePlan)}
    />
  );
}
