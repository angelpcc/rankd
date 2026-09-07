import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { loadPhysical, completeness } from '@/lib/physicalProfile';
import SegmentedProgress from '@/components/base/SegmentedProgress';
import PhysicalProfileForm from './PhysicalProfileForm';

// Ruta de activación en 3 pasos para el primer uso. Cada paso explica el
// BENEFICIO concreto de completarlo (no "completa tu perfil" a secas). Con
// progreso visible. Se oculta sola cuando los 3 están hechos.
//
// Paso 1 = perfil físico (mismo form que Ajustes), Paso 2 = objetivo/plan,
// Paso 3 = primer registro. El acento es siempre rojo RANKD.

interface Props {
  profile: Profile;
  /** Nº total de sesiones registradas (viene del Resumen, ya calculado). */
  totalSessions: number;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onDefineGoal: () => void;
  onLogFirst: () => void;
}

interface Step {
  id: 'perfil' | 'objetivo' | 'registro';
  done: boolean;
  titleKey: string;
  benefitKey: string;
  ctaKey: string;
  run: () => void;
}

export default function ActivationSteps({ profile, totalSessions, showToast, onDefineGoal, onLogFirst }: Props) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [physicalPct, setPhysicalPct] = useState(0);
  const [physicalOff, setPhysicalOff] = useState(false); // migración 0031 ausente
  const [hasPlan, setHasPlan] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async () => {
    const [{ data: phys, unavailable }, planRes] = await Promise.all([
      loadPhysical(profile.id),
      supabase.from('objective_plans').select('id').eq('fighter_profile_id', profile.id).eq('status', 'active').limit(1).maybeSingle(),
    ]);
    setPhysicalOff(unavailable);
    setPhysicalPct(unavailable ? 100 : completeness(phys).pct);
    setHasPlan(!isMissingTable(planRes.error) && !!planRes.data);
    setReady(true);
  }, [profile.id]);

  useEffect(() => { reload(); }, [reload]);

  if (!ready) return null;

  const steps: Step[] = [
    ...(physicalOff ? [] : [{
      id: 'perfil' as const,
      done: physicalPct >= 100,
      titleKey: 'mc_act_s1_title',
      benefitKey: 'mc_act_s1_benefit',
      ctaKey: 'mc_act_s1_cta',
      run: () => setFormOpen(true),
    }]),
    {
      id: 'objetivo',
      done: hasPlan,
      titleKey: 'mc_act_s2_title',
      benefitKey: 'mc_act_s2_benefit',
      ctaKey: 'mc_act_s2_cta',
      run: onDefineGoal,
    },
    {
      id: 'registro',
      done: totalSessions > 0,
      titleKey: 'mc_act_s3_title',
      benefitKey: 'mc_act_s3_benefit',
      ctaKey: 'mc_act_s3_cta',
      run: onLogFirst,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  // Todo hecho → no molestamos (igual que PhysicalProfileCard con hideWhenComplete).
  if (doneCount === steps.length) return null;

  return (
    <>
      <div className="rk-card" style={{ padding: 18 }}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-white">{t('mc_act_title')}</p>
          <p className="rk-label" style={{ color: 'var(--t-2)' }}>
            {t('mc_act_progress', { done: doneCount, total: steps.length })}
          </p>
        </div>
        <div className="mt-2.5">
          <SegmentedProgress total={steps.length} done={doneCount} />
        </div>

        <div className="mt-4" style={{ display: 'flex', flexDirection: 'column' }}>
          {steps.map((s, i) => {
            const interactive = !s.done || s.id === 'perfil';
            return (
              <button
                key={s.id}
                type="button"
                onClick={interactive ? s.run : undefined}
                aria-disabled={!interactive}
                className="w-full text-left flex items-start gap-3"
                style={{
                  minHeight: 44, padding: '12px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--s-3)',
                  cursor: interactive ? 'pointer' : 'default',
                  opacity: s.done ? 0.6 : 1,
                }}
              >
                <span
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, lineHeight: 1,
                    background: s.done ? 'var(--accent)' : 'var(--s-2)',
                    border: s.done ? 'none' : '1px solid var(--s-3)',
                    color: s.done ? '#fff' : 'var(--t-2)',
                    marginTop: 1,
                  }}
                >
                  {s.done ? <i className="ri-check-line" style={{ fontSize: 15 }} /> : i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold" style={{ color: s.done ? 'var(--t-2)' : 'var(--t-1)', textDecoration: s.done ? 'line-through' : 'none' }}>
                    {t(s.titleKey)}
                  </span>
                  {!s.done && (
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--t-2)', lineHeight: 1.45 }}>
                      {t(s.benefitKey)}
                    </span>
                  )}
                </span>
                {interactive && (
                  <span
                    className="flex-shrink-0 inline-flex items-center gap-1"
                    style={{ color: s.done ? 'var(--t-3)' : 'var(--accent)', fontSize: 12, fontWeight: 700, marginTop: 2 }}
                  >
                    {!s.done && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t(s.ctaKey)}</span>}
                    <i className={s.done ? 'ri-pencil-line' : 'ri-arrow-right-line'} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <PhysicalProfileForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        profileId={profile.id}
        showToast={showToast}
        onSaved={() => reload()}
      />
    </>
  );
}
