import { useTranslation } from 'react-i18next';
import { Opportunity, Profile } from '@/lib/supabase';

// Tipos que son exclusivamente deportivos (solo fighters pueden postularse)
const FIGHTER_ONLY_TYPES = ['combate', 'sparring', 'contrato', 'campamento', 'entrenamiento', 'scouting'];
// Tipos de patrocinio/marca (fighters NO pueden postularse)
const SPONSORSHIP_TYPES = ['patrocinio'];

export const isSponsorshipType = (type: string) => SPONSORSHIP_TYPES.includes(type);
export const isFighterType = (type: string) => FIGHTER_ONLY_TYPES.includes(type);

const typeConfig: Record<string, { labelKey: string; textColor: string; bgColor: string; borderColor: string; icon: string; accentFrom: string; accentTo: string }> = {
  combate:       { labelKey: 'opp_type_combate',       textColor: 'text-red-400',     bgColor: 'bg-red-500/12',     borderColor: 'border-red-200',     icon: 'ri-boxing-line',        accentFrom: 'from-red-500',     accentTo: 'to-red-700' },
  contrato:      { labelKey: 'opp_type_contrato',      textColor: 'text-zinc-200',    bgColor: 'bg-white/[0.03]',   borderColor: 'border-white/10',    icon: 'ri-file-text-line',     accentFrom: 'from-zinc-600',    accentTo: 'to-zinc-800' },
  patrocinio:    { labelKey: 'opp_type_patrocinio',    textColor: 'text-yellow-400',  bgColor: 'bg-yellow-500/12',  borderColor: 'border-yellow-200',  icon: 'ri-hand-coin-line',     accentFrom: 'from-yellow-500',  accentTo: 'to-orange-500' },
  sparring:      { labelKey: 'opp_type_sparring',      textColor: 'text-orange-400',  bgColor: 'bg-orange-500/12',  borderColor: 'border-orange-200',  icon: 'ri-user-shared-line',   accentFrom: 'from-orange-500',  accentTo: 'to-orange-700' },
  campamento:    { labelKey: 'opp_type_campamento',    textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/12', borderColor: 'border-emerald-200', icon: 'ri-tent-line',          accentFrom: 'from-emerald-500', accentTo: 'to-emerald-700' },
  entrenamiento: { labelKey: 'opp_type_entrenamiento', textColor: 'text-sky-400',     bgColor: 'bg-sky-500/12',     borderColor: 'border-sky-200',     icon: 'ri-run-line',           accentFrom: 'from-sky-500',     accentTo: 'to-sky-700' },
  scouting:      { labelKey: 'opp_type_scouting',      textColor: 'text-violet-700',  bgColor: 'bg-violet-50',  borderColor: 'border-violet-200',  icon: 'ri-eye-line',           accentFrom: 'from-violet-500',  accentTo: 'to-violet-700' },
};

interface Props {
  opportunity: Opportunity;
  publisher?: Profile;
  isApplied: boolean;
  canApply: boolean;
  userType?: string | null;
  onApply: () => void;
}

export default function OpportunityCard({ opportunity: opp, publisher, isApplied, canApply, userType, onApply }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const isSponsorship = isSponsorshipType(opp.type);
  const cfg = typeConfig[opp.type] || typeConfig.combate;
  const initials = (publisher?.full_name || 'E').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const disciplineLabels: Record<string, string> = {
    boxing: t('disc_boxing'), mma: t('disc_mma'), kickboxing: t('disc_kickboxing'),
    muay_thai: t('disc_muay_thai'), wrestling: t('disc_wrestling'), bjj: t('disc_bjj'), other: t('disc_other'),
  };
  const expLabels: Record<string, string> = {
    amateur: t('exp_amateur'), semi_pro: t('exp_semipro'), professional: t('exp_professional'),
  };

  const formatDate = (d: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    if (diffDays === 0) return t('op_date_today');
    if (diffDays === 1) return t('op_date_tomorrow');
    if (diffDays <= 7) return t('op_date_in_days', { n: diffDays });
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const daysLeft = opp.event_date
    ? Math.ceil((new Date(opp.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
  // Contador de días: rojo si queda menos de un día, naranja si queda menos
  // de una semana. Nada si ya pasó (no debería llegar aquí, pero por si
  // acaso) o si aún queda tiempo de sobra.
  const countdown = daysLeft === null || daysLeft < 0 || daysLeft > 7 ? null
    : daysLeft <= 1 ? { text: daysLeft <= 0 ? t('op_date_today') : t('op_date_tomorrow'), color: '#E10600' }
    : { text: t('op_days_left', { n: daysLeft }), color: '#fb923c' };

  return (
    <article className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden hover:border-white/10 hover:-translate-y-1 hover:shadow-sm transition-all duration-200 flex flex-col group">
      {/* Top accent bar */}
      <div className={`h-1.5 bg-gradient-to-r ${cfg.accentFrom} ${cfg.accentTo}`}></div>

      <div className="p-5 flex flex-col flex-1">

        {/* Header row: type badge + status */}
        <div className="flex items-center justify-between mb-4">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`}>
            <i className={cfg.icon}></i>
            {t(cfg.labelKey)}
          </span>
          <div className="flex items-center gap-2">
            {isUrgent && opp.event_date && (
              <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/12 border border-red-200 px-2 py-1 rounded-full animate-pulse">
                <i className="ri-alarm-line"></i>
                {t('op_urgent')}
              </span>
            )}
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${opp.status === 'open' ? 'bg-green-500/12 text-green-400 border border-green-200' : 'bg-white/[0.03] text-zinc-500 border border-white/10'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${opp.status === 'open' ? 'bg-green-500' : 'bg-zinc-400'}`}></span>
              {opp.status === 'open' ? t('op_active') : t('op_closed')}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-black text-white leading-snug mb-2 group-hover:text-red-400 transition-colors">{opp.title}</h3>

        {/* Description */}
        {opp.description && (
          <p className="text-xs text-zinc-500 leading-relaxed mb-4 line-clamp-2">{opp.description}</p>
        )}

        {/* ── KEY INFO GRID ── */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {opp.discipline && (
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2">
              <i className="ri-boxing-line text-zinc-400 text-xs flex-shrink-0"></i>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 leading-none">{t('fd_discipline')}</p>
                <p className="text-xs font-semibold text-zinc-200 mt-0.5 truncate">{disciplineLabels[opp.discipline] || opp.discipline}</p>
              </div>
            </div>
          )}
          {opp.weight_class && (
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2">
              <i className="ri-scales-line text-zinc-400 text-xs flex-shrink-0"></i>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 leading-none">{t('op_l_category')}</p>
                <p className="text-xs font-semibold text-zinc-200 mt-0.5 truncate">{opp.weight_class}</p>
              </div>
            </div>
          )}
          {opp.experience_level && (
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2">
              <i className="ri-bar-chart-line text-zinc-400 text-xs flex-shrink-0"></i>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 leading-none">{t('fd_level')}</p>
                <p className="text-xs font-semibold text-zinc-200 mt-0.5 truncate">{expLabels[opp.experience_level] || opp.experience_level}</p>
              </div>
            </div>
          )}
          {opp.location && (
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2">
              <i className="ri-map-pin-line text-zinc-400 text-xs flex-shrink-0"></i>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 leading-none">{t('op_l_location')}</p>
                <p className="text-xs font-semibold text-zinc-200 mt-0.5 truncate">{opp.location}</p>
              </div>
            </div>
          )}
        </div>

        {/* Date */}
        {opp.event_date && (
          <div className={`flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg border ${isUrgent ? 'bg-red-500/12 border-red-200' : 'bg-white/[0.03] border-white/[0.08]'}`}>
            <i className={`ri-calendar-event-line ${isUrgent ? 'text-red-500' : 'text-zinc-400'}`}></i>
            <span className={isUrgent ? 'text-sm font-bold text-red-400' : 'text-xs font-medium text-zinc-500'}>{formatDate(opp.event_date)}</span>
            {countdown && (
              <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: countdown.color, background: `${countdown.color}1a`, border: `1px solid ${countdown.color}44` }}>
                {countdown.text}
              </span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* ── FOOTER: publisher + CTA ── */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08] gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {publisher?.avatar_url ? (
              <img src={publisher.avatar_url} alt={publisher.full_name || ''} className="w-8 h-8 rounded-full object-cover object-top flex-shrink-0 border border-white/10" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-200 truncate">{publisher?.full_name || t('op_org_fallback')}</p>
              <p className="text-xs text-zinc-400 capitalize">{publisher?.user_type || t('op_promoter_fallback')}</p>
            </div>
          </div>

          {/* CTA diferenciado por tipo de oportunidad */}
          {isSponsorship ? (
            // Oportunidad de PATROCINIO — no aplican fighters
            <div className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-yellow-400 bg-yellow-500/12 border border-yellow-200 px-3 py-2 rounded-xl whitespace-nowrap">
                <i className="ri-hand-coin-line"></i>
                {t('op_seeking_sponsors')}
              </span>
              {userType === 'fighter' && (
                <span className="text-xs text-zinc-400">{t('op_brands_only')}</span>
              )}
            </div>
          ) : isApplied ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-500/12 border border-green-200 px-3 py-2 rounded-xl whitespace-nowrap">
              <i className="ri-check-double-line"></i>
              {t('op_applied')}
            </span>
          ) : canApply ? (
            <button
              onClick={onApply}
              className="flex items-center gap-1.5 text-sm font-bold bg-red-600 hover:bg-red-700 active:scale-95 text-white px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-send-plane-fill"></i>
              {t('op_apply')}
            </button>
          ) : (
            <button
              onClick={onApply}
              className="flex items-center gap-1.5 text-xs font-semibold border border-red-200 text-red-400 hover:bg-red-500/12 px-3 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-login-box-line"></i>
              {t('op_see_more')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
