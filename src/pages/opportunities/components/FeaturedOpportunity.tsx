import { useTranslation } from 'react-i18next';
import type { Opportunity, Profile } from '@/lib/supabase';
import { isSponsorshipType } from './OpportunityCard';

// Card DESTACADA del directorio de Oportunidades: la de fecha más próxima, en
// formato banner ancho y distinto del grid (regla: nada de scroll plano).
// Fondo diseñado (degradado + glow del color del tipo + icono ghost), fecha
// grande en rojo y contador de días.

const typeMeta: Record<string, { labelKey: string; icon: string; glow: string }> = {
  combate: { labelKey: 'opp_type_combate', icon: 'ri-boxing-line', glow: 'rgba(225,6,0,0.22)' },
  contrato: { labelKey: 'opp_type_contrato', icon: 'ri-file-text-line', glow: 'rgba(255,255,255,0.10)' },
  patrocinio: { labelKey: 'opp_type_patrocinio', icon: 'ri-hand-coin-line', glow: 'rgba(234,179,8,0.20)' },
  sparring: { labelKey: 'opp_type_sparring', icon: 'ri-user-shared-line', glow: 'rgba(249,115,22,0.20)' },
  campamento: { labelKey: 'opp_type_campamento', icon: 'ri-tent-line', glow: 'rgba(16,185,129,0.18)' },
  entrenamiento: { labelKey: 'opp_type_entrenamiento', icon: 'ri-run-line', glow: 'rgba(56,189,248,0.18)' },
  scouting: { labelKey: 'opp_type_scouting', icon: 'ri-eye-line', glow: 'rgba(139,92,246,0.18)' },
};

interface Props {
  opportunity: Opportunity;
  publisher?: Profile;
  isApplied: boolean;
  canApply: boolean;
  onApply: () => void;
}

export default function FeaturedOpportunity({ opportunity: opp, publisher, isApplied, canApply, onApply }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const meta = typeMeta[opp.type] || typeMeta.combate;
  const isSponsorship = isSponsorshipType(opp.type);

  const d = opp.event_date ? new Date(opp.event_date + 'T12:00:00') : null;
  const daysLeft = d ? Math.ceil((d.getTime() - Date.now()) / 86400000) : null;
  const countdown = daysLeft === null ? null
    : daysLeft <= 0 ? { text: t('op_date_today'), color: '#E10600' }
    : daysLeft === 1 ? { text: t('op_date_tomorrow'), color: '#E10600' }
    : daysLeft <= 7 ? { text: t('op_days_left', { n: daysLeft }), color: '#E10600' }
    : { text: t('op_days_left', { n: daysLeft }), color: '#fb923c' };

  const disciplineLabels: Record<string, string> = {
    boxing: t('disc_boxing'), mma: t('disc_mma'), kickboxing: t('disc_kickboxing'),
    muay_thai: t('disc_muay_thai'), wrestling: t('disc_wrestling'), bjj: t('disc_bjj'), other: t('disc_other'),
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] mb-6" style={{ background: 'linear-gradient(150deg, var(--s-1) 0%, #0d0d0d 100%)' }}>
      <div className="absolute inset-0 rk-grid-bg pointer-events-none" style={{ opacity: 0.35 }} />
      <div className="absolute pointer-events-none" style={{ inset: '-40% 30% auto -10%', height: '150%', background: `radial-gradient(ellipse at 50% 50%, ${meta.glow} 0%, transparent 60%)` }} />
      <i className={meta.icon} style={{ position: 'absolute', right: -24, bottom: -48, fontSize: 200, color: 'rgba(255,255,255,0.045)', lineHeight: 1, pointerEvents: 'none' }} />
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #E10600 0%, rgba(225,6,0,0.3) 55%, transparent 100%)' }} />

      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
        {/* Bloque de fecha */}
        <div className="flex-shrink-0 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">{t('opp_featured')}</span>
          {d ? (
            <div className="flex items-baseline gap-2 sm:block">
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(40px,9vw,64px)', lineHeight: 0.9, color: '#fff' }}>
                {d.getDate()}
              </p>
              <p className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                {d.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">{t('opp_no_date')}</p>
          )}
          {countdown && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full mt-0 sm:mt-1"
              style={{ color: countdown.color, background: `${countdown.color}1a`, border: `1px solid ${countdown.color}44` }}>
              <i className="ri-timer-flash-line" />{countdown.text}
            </span>
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/12 text-white">
              <i className={meta.icon} />{t(meta.labelKey)}
            </span>
            {opp.discipline && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-zinc-300">
                {disciplineLabels[opp.discipline] || opp.discipline}
              </span>
            )}
            {opp.weight_class && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-zinc-400">
                <i className="ri-scales-line mr-1" />{opp.weight_class}
              </span>
            )}
          </div>

          <h2 className="text-lg sm:text-xl font-black text-white leading-snug">{opp.title}</h2>
          {opp.description && (
            <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {opp.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-zinc-500">
            {opp.location && <span className="flex items-center gap-1"><i className="ri-map-pin-line" />{opp.location}</span>}
            {publisher?.full_name && <span className="flex items-center gap-1"><i className="ri-user-line" />{publisher.full_name}</span>}
          </div>

          <div className="mt-4">
            {isSponsorship ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-yellow-400 bg-yellow-500/12 border border-yellow-500/30 px-3 py-2 rounded-xl">
                <i className="ri-hand-coin-line" />{t('op_seeking_sponsors')}
              </span>
            ) : isApplied ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-green-400">
                <i className="ri-check-double-line" />{t('op_applied')}
              </span>
            ) : (
              <button onClick={onApply}
                className="inline-flex items-center gap-1.5 text-sm font-bold bg-red-600 hover:bg-red-700 active:scale-95 text-white px-4 py-2.5 rounded-xl transition-all cursor-pointer">
                {canApply ? t('op_apply') : t('op_see_more')}<i className="ri-arrow-right-line" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
