import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

// Card "HOY" — el elemento PRINCIPAL del Resumen de Mi Esquina.
// PILOTO DE TEMA CLARO (PROMPT_DISEÑO): fondo blanco/crema, texto oscuro, único
// elemento con acento rojo (borde izquierdo 3px). Muestra lo que toca hoy:
//   · Hay entreno planificado hoy  → título del día + tipo + CTA "Empezar".
//   · Plan activo pero hoy descansa → mensaje de descanso + movilidad.
//   · Sin plan                      → "Crea tu plan".

interface Props {
  profile: Profile;
  onStart: () => void;      // abre la agenda del día
  onCreatePlan: () => void; // abre Objetivos (plan IA)
}

interface TodayEvent { kind: string | null; session_type: string | null; title: string | null; notes: string | null }

const REST_TYPES = new Set(['recuperacion', 'descanso', 'rest']);
const isTraining = (e: TodayEvent) =>
  (e.kind === 'training' || (!e.kind && !!e.session_type)) && !REST_TYPES.has(e.session_type || '');

const TYPE_ICON: Record<string, string> = {
  sparring: 'ri-boxing-line', tecnica: 'ri-focus-3-line', fuerza: 'ri-hammer-line',
  cardio: 'ri-run-line', flexibilidad: 'ri-yoga-line', recuperacion: 'ri-heart-pulse-line',
  combate: 'ri-sword-line', pesaje: 'ri-scales-2-line',
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TodayCard({ profile, onStart, onCreatePlan }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState<TodayEvent[]>([]);
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: evs, error: evErr }, { data: plan }] = await Promise.all([
        supabase.from('planned_events').select('kind, session_type, title, notes')
          .eq('fighter_profile_id', profile.id).eq('event_date', todayISO()),
        supabase.from('objective_plans').select('id')
          .eq('fighter_profile_id', profile.id).eq('status', 'active').limit(1).maybeSingle(),
      ]);
      if (!alive) return;
      if (!isMissingTable(evErr)) setTraining((evs || []) as TodayEvent[]);
      setHasPlan(!!plan);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id]);

  if (loading) {
    return (
      <div className="rk-lc-primary" style={{ minHeight: 128, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="w-6 h-6 border-2 border-[#E10600] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const trainingToday = training.filter(isTraining);
  const main = trainingToday[0];

  // ── Estado 1: hay entreno hoy ──
  if (main) {
    const st = main.session_type || 'fuerza';
    const icon = TYPE_ICON[st] || 'ri-fire-line';
    const title = (main.title || t(`mc_st_${st}`, st)).toUpperCase();
    const extra = trainingToday.length - 1;
    return (
      <div className="rk-lc-primary">
        <p className="rk-lc-label" style={{ color: '#E10600' }}>{t('mc_hoy_eyebrow')}</p>
        <div className="flex items-start gap-4 mt-2 flex-wrap sm:flex-nowrap">
          <div style={{ width: 56, height: 56, background: 'rgba(225,6,0,0.08)', border: '1px solid rgba(225,6,0,0.25)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E10600', flexShrink: 0 }}>
            <i className={`${icon} text-2xl`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.6rem,5vw,2.1rem)', lineHeight: 1, color: 'var(--rkl-text-primary)', letterSpacing: '0.01em' }}>{title}</h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.04)', border: '1px solid var(--rkl-border)', color: 'var(--rkl-text-secondary)' }}>
                {t(`mc_st_${st}`, st)}
              </span>
              {extra > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(138,109,31,0.10)', border: '1px solid rgba(138,109,31,0.28)', color: 'var(--rkl-data-highlight)' }}>+{extra}</span>
              )}
            </div>
            {main.notes && <p className="rk-lc-body mt-2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{main.notes}</p>}
          </div>
        </div>
        <button onClick={onStart} className="rk-lc-cta w-full sm:w-auto mt-4 flex items-center justify-center gap-2">
          <i className="ri-play-fill"></i> {t('mc_hoy_start')}
        </button>
      </div>
    );
  }

  // ── Estado 2: plan activo pero hoy descansa ──
  if (hasPlan) {
    return (
      <div className="rk-lc-primary">
        <div className="flex items-start gap-4">
          <div style={{ width: 56, height: 56, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', flexShrink: 0 }}>
            <i className="ri-heart-pulse-line text-2xl"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="rk-lc-label" style={{ color: '#16a34a' }}>{t('mc_hoy_eyebrow')}</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.4rem,4.5vw,1.85rem)', lineHeight: 1.05, color: 'var(--rkl-text-primary)' }} className="mt-1">{t('mc_hoy_rest_title')}</h2>
            <p className="rk-lc-body mt-1.5">{t('mc_hoy_rest_desc')}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Estado 3: sin plan ──
  return (
    <div className="rk-lc-primary">
      <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
        <div style={{ width: 56, height: 56, background: 'rgba(225,6,0,0.08)', border: '1px solid rgba(225,6,0,0.25)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E10600', flexShrink: 0 }}>
          <i className="ri-sparkling-2-line text-2xl"></i>
        </div>
        <div className="flex-1 min-w-0">
          <p className="rk-lc-label" style={{ color: '#E10600' }}>{t('mc_hoy_eyebrow')}</p>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.4rem,4.5vw,1.85rem)', lineHeight: 1.05, color: 'var(--rkl-text-primary)' }} className="mt-1">{t('mc_hoy_noplan_title')}</h2>
          <p className="rk-lc-body mt-1.5">{t('mc_hoy_noplan_desc')}</p>
        </div>
        <button onClick={onCreatePlan} className="rk-lc-cta w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2">
          <i className="ri-add-line"></i> {t('mc_hoy_create')}
        </button>
      </div>
    </div>
  );
}
