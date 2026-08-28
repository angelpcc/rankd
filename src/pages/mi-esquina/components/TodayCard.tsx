import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import PhotoCard from '@/components/base/PhotoCard';
import { type DayPlanItem, type StrengthPayload, type ActivityPayload, activityKindCfg, exerciseLines, KIND_META } from '../lib/dayPlan';

// Card "HOY" — el elemento PRINCIPAL del Resumen. Es una PhotoCard: fondo a
// sangre (imagen o fondo diseñado) con el degradado de legibilidad y el texto
// encima. Tres estados: hay entreno hoy / descanso / sin plan.
//
// Fotos reales (Unsplash, licencia libre) para entreno de fuerza y actividad;
// descanso y "sin plan" usan SVG diseñado (hero-rest / hero-plan) porque no
// hay foto que encaje mejor que la ilustración para esos estados.

interface Props {
  profile: Profile;
  onStart: () => void;      // abre la agenda del día
  onCreatePlan: () => void; // abre Objetivos (plan IA)
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface TrainToday { icon: string; title: string; typeLabelKey: string; note: string | null }

export default function TodayCard({ profile, onStart, onCreatePlan }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState<TrainToday[]>([]);
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: rows, error: evErr }, { data: plan }] = await Promise.all([
        supabase.from('day_plan_items').select('kind, payload')
          .eq('fighter_profile_id', profile.id).eq('plan_date', todayISO()).in('kind', ['strength', 'activity']),
        supabase.from('objective_plans').select('id')
          .eq('fighter_profile_id', profile.id).eq('status', 'active').limit(1).maybeSingle(),
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
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id, t]);

  if (loading) {
    return (
      <div className="rk-card" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="w-6 h-6 border-2 border-[#E10600] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pill = (text: string, gold = false) => (
    <span style={{
      background: gold ? 'rgba(201,168,76,0.16)' : 'var(--accent)',
      color: gold ? 'var(--gold)' : '#fff',
      borderRadius: 'var(--r-pill)', padding: '4px 12px', fontSize: 12, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{text}</span>
  );

  const main = training[0];

  // ── Estado 1: hay entreno hoy ──
  if (main) {
    const extra = training.length - 1;
    const isStrength = main.typeLabelKey === 'mc_dp_kind_strength';
    return (
      <PhotoCard
        primary
        image={isStrength ? '/images/fuerza.webp' : '/images/correr.webp'}
        icon={main.icon}
        chips={<>{pill(t(main.typeLabelKey))}{extra > 0 && pill(`+${extra}`, true)}</>}
        title={main.title.toUpperCase()}
        subtitle={main.note || undefined}
        footer={
          <button onClick={onStart} className="rk-nav-btn inline-flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <i className="ri-play-fill"></i> {t('mc_hoy_start')}
          </button>
        }
      />
    );
  }

  // ── Estado 2: plan activo pero hoy descansa ──
  if (hasPlan) {
    return (
      <PhotoCard
        image="/images/hero-rest.svg"
        icon="ri-heart-pulse-line"
        chips={pill(t('mc_hoy_eyebrow'))}
        title={t('mc_hoy_rest_title').toUpperCase()}
        subtitle={t('mc_hoy_rest_desc')}
      />
    );
  }

  // ── Estado 3: sin plan ──
  return (
    <PhotoCard
      primary
      image="/images/hero-plan.svg"
      icon="ri-sparkling-2-line"
      chips={pill(t('mc_hoy_eyebrow'))}
      title={t('mc_hoy_noplan_title').toUpperCase()}
      subtitle={t('mc_hoy_noplan_desc')}
      footer={
        <button onClick={onCreatePlan} className="rk-nav-btn inline-flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <i className="ri-add-line"></i> {t('mc_hoy_create')}
        </button>
      }
    />
  );
}
