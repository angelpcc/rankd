import { Opportunity, Profile } from '@/lib/supabase';

// Tipos que son exclusivamente deportivos (solo fighters pueden postularse)
const FIGHTER_ONLY_TYPES = ['combate', 'sparring', 'contrato', 'campamento', 'entrenamiento', 'scouting'];
// Tipos de patrocinio/marca (fighters NO pueden postularse)
const SPONSORSHIP_TYPES = ['patrocinio'];

export const isSponsorshipType = (type: string) => SPONSORSHIP_TYPES.includes(type);
export const isFighterType = (type: string) => FIGHTER_ONLY_TYPES.includes(type);

const typeConfig: Record<string, { label: string; textColor: string; bgColor: string; borderColor: string; icon: string; accentFrom: string; accentTo: string }> = {
  combate:       { label: 'Combate',       textColor: 'text-red-600',     bgColor: 'bg-red-50',     borderColor: 'border-red-200',     icon: 'ri-boxing-line',        accentFrom: 'from-red-500',     accentTo: 'to-red-700' },
  contrato:      { label: 'Contrato',      textColor: 'text-zinc-700',    bgColor: 'bg-zinc-100',   borderColor: 'border-zinc-200',    icon: 'ri-file-text-line',     accentFrom: 'from-zinc-600',    accentTo: 'to-zinc-800' },
  patrocinio:    { label: 'Patrocinio',    textColor: 'text-yellow-700',  bgColor: 'bg-yellow-50',  borderColor: 'border-yellow-200',  icon: 'ri-hand-coin-line',     accentFrom: 'from-yellow-500',  accentTo: 'to-orange-500' },
  sparring:      { label: 'Sparring',      textColor: 'text-orange-600',  bgColor: 'bg-orange-50',  borderColor: 'border-orange-200',  icon: 'ri-user-shared-line',   accentFrom: 'from-orange-500',  accentTo: 'to-orange-700' },
  campamento:    { label: 'Campamento',    textColor: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', icon: 'ri-tent-line',          accentFrom: 'from-emerald-500', accentTo: 'to-emerald-700' },
  entrenamiento: { label: 'Entrenamiento', textColor: 'text-sky-700',     bgColor: 'bg-sky-50',     borderColor: 'border-sky-200',     icon: 'ri-run-line',           accentFrom: 'from-sky-500',     accentTo: 'to-sky-700' },
  scouting:      { label: 'Scouting',      textColor: 'text-violet-700',  bgColor: 'bg-violet-50',  borderColor: 'border-violet-200',  icon: 'ri-eye-line',           accentFrom: 'from-violet-500',  accentTo: 'to-violet-700' },
};

const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};

const expLabels: Record<string, string> = {
  amateur: 'Amateur', semi_pro: 'Semi-Pro', professional: 'Profesional',
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
  const isSponsorship = isSponsorshipType(opp.type);
  const cfg = typeConfig[opp.type] || typeConfig.combate;
  const initials = (publisher?.full_name || 'E').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const formatDate = (d: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays <= 7) return `En ${diffDays} días`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isUrgent = opp.event_date
    ? Math.ceil((new Date(opp.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 7
    : false;

  return (
    <article className="bg-white border border-zinc-100 rounded-2xl overflow-hidden hover:border-zinc-200 hover:-translate-y-1 hover:shadow-sm transition-all duration-200 flex flex-col group">
      {/* Top accent bar */}
      <div className={`h-1.5 bg-gradient-to-r ${cfg.accentFrom} ${cfg.accentTo}`}></div>

      <div className="p-5 flex flex-col flex-1">

        {/* Header row: type badge + status */}
        <div className="flex items-center justify-between mb-4">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`}>
            <i className={cfg.icon}></i>
            {cfg.label}
          </span>
          <div className="flex items-center gap-2">
            {isUrgent && opp.event_date && (
              <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full animate-pulse">
                <i className="ri-alarm-line"></i>
                Urgente
              </span>
            )}
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${opp.status === 'open' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${opp.status === 'open' ? 'bg-green-500' : 'bg-zinc-400'}`}></span>
              {opp.status === 'open' ? 'Activa' : 'Cerrada'}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-black text-zinc-900 leading-snug mb-2 group-hover:text-red-700 transition-colors">{opp.title}</h3>

        {/* Description */}
        {opp.description && (
          <p className="text-xs text-zinc-500 leading-relaxed mb-4 line-clamp-2">{opp.description}</p>
        )}

        {/* ── KEY INFO GRID ── */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {opp.discipline && (
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
              <i className="ri-boxing-line text-zinc-400 text-xs flex-shrink-0"></i>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 leading-none">Disciplina</p>
                <p className="text-xs font-semibold text-zinc-700 mt-0.5 truncate">{disciplineLabels[opp.discipline] || opp.discipline}</p>
              </div>
            </div>
          )}
          {opp.weight_class && (
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
              <i className="ri-scales-line text-zinc-400 text-xs flex-shrink-0"></i>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 leading-none">Categoría</p>
                <p className="text-xs font-semibold text-zinc-700 mt-0.5 truncate">{opp.weight_class}</p>
              </div>
            </div>
          )}
          {opp.experience_level && (
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
              <i className="ri-bar-chart-line text-zinc-400 text-xs flex-shrink-0"></i>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 leading-none">Nivel</p>
                <p className="text-xs font-semibold text-zinc-700 mt-0.5 truncate">{expLabels[opp.experience_level] || opp.experience_level}</p>
              </div>
            </div>
          )}
          {opp.location && (
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
              <i className="ri-map-pin-line text-zinc-400 text-xs flex-shrink-0"></i>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 leading-none">Ubicación</p>
                <p className="text-xs font-semibold text-zinc-700 mt-0.5 truncate">{opp.location}</p>
              </div>
            </div>
          )}
        </div>

        {/* Date */}
        {opp.event_date && (
          <div className={`flex items-center gap-2 text-xs mb-4 px-3 py-2 rounded-lg border ${isUrgent ? 'bg-red-50 border-red-200 text-red-600' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}>
            <i className={`ri-calendar-event-line ${isUrgent ? 'text-red-500' : 'text-zinc-400'}`}></i>
            <span className="font-medium">{formatDate(opp.event_date)}</span>
            {isUrgent && <span className="ml-auto font-bold text-red-600">¡Pronto!</span>}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* ── FOOTER: publisher + CTA ── */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100 gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {publisher?.avatar_url ? (
              <img src={publisher.avatar_url} alt={publisher.full_name || ''} className="w-8 h-8 rounded-full object-cover object-top flex-shrink-0 border border-zinc-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-700 truncate">{publisher?.full_name || 'Organización'}</p>
              <p className="text-xs text-zinc-400 capitalize">{publisher?.user_type || 'promotora'}</p>
            </div>
          </div>

          {/* CTA diferenciado por tipo de oportunidad */}
          {isSponsorship ? (
            // Oportunidad de PATROCINIO — no aplican fighters
            <div className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-xl whitespace-nowrap">
                <i className="ri-hand-coin-line"></i>
                Buscando sponsors
              </span>
              {userType === 'fighter' && (
                <span className="text-xs text-zinc-400">Solo para marcas</span>
              )}
            </div>
          ) : isApplied ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-3 py-2 rounded-xl whitespace-nowrap">
              <i className="ri-check-double-line"></i>
              Postulado
            </span>
          ) : canApply ? (
            <button
              onClick={onApply}
              className="flex items-center gap-1.5 text-sm font-bold bg-red-600 hover:bg-red-700 active:scale-95 text-white px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-send-plane-fill"></i>
              Postularme
            </button>
          ) : (
            <button
              onClick={onApply}
              className="flex items-center gap-1.5 text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-login-box-line"></i>
              Ver más
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
