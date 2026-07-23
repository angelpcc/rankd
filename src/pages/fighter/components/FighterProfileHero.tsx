import { Profile, Fighter } from '@/lib/supabase';
import VerifiedBadge from '@/components/base/VerifiedBadge';

const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};
const expLabels: Record<string, string> = {
  amateur: 'Amateur', semi_pro: 'Semi-Pro', professional: 'Profesional',
};
const disciplineIcons: Record<string, string> = {
  boxing: 'ri-boxing-line', mma: 'ri-sword-line', kickboxing: 'ri-boxing-line',
  muay_thai: 'ri-boxing-line', wrestling: 'ri-user-shared-line', bjj: 'ri-user-shared-line', other: 'ri-boxing-line',
};

interface Props {
  profile: Profile;
  fighter: Fighter | null;
  views?: number;
  onContact: () => void;
  canContact: boolean;
  onMessage?: () => void;
  canMessage?: boolean;
  startingChat?: boolean;
}

export default function FighterProfileHero({ profile, fighter, views, onContact, canContact, onMessage, canMessage, startingChat }: Props) {
  const initials = (profile.full_name || 'F').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const totalFights = fighter ? fighter.wins + fighter.losses + fighter.draws : 0;
  const winRate = totalFights > 0 ? Math.round((fighter!.wins / totalFights) * 100) : null;

  return (
    <div className="relative w-full overflow-hidden bg-[#050505] rk-grid-bg">
      {/* Background: tratamiento cinematográfico (sin imágenes de relleno) */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 78% 42%, rgba(225,6,0,0.18) 0%, transparent 55%)' }} />
      <div className="absolute top-0 right-0 w-1/2 h-full" style={{ background: 'radial-gradient(ellipse at 100% 0%, rgba(201,168,76,0.06) 0%, transparent 60%)' }} />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/85 to-[#050505]/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
      <div className="rk-topline" />

      {/* Views badge */}
      {views !== undefined && views > 0 && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 text-white/70 text-xs px-3 py-1.5 rounded-full">
          <i className="ri-eye-line"></i>
          <span>{views.toLocaleString('es-ES')} visitas</span>
        </div>
      )}

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 md:px-10 pt-8 sm:pt-12 pb-0">
        {/* En móvil: columna. En desktop: fila */}
        <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8 lg:gap-12">

          {/* ── AVATAR ── */}
          <div className="flex-shrink-0 relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-red-600/40 to-transparent blur-md"></div>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || 'Fighter'}
                className="relative w-24 h-32 sm:w-44 sm:h-52 md:w-52 md:h-64 rounded-2xl object-cover object-top border border-red-500/30"
              />
            ) : (
              <div className="relative w-24 h-32 sm:w-44 sm:h-52 md:w-52 md:h-64 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-red-500/20 flex items-center justify-center">
                <span className="text-3xl sm:text-6xl font-black text-white/20">{initials}</span>
              </div>
            )}
            {fighter?.is_available && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                Disponible
              </div>
            )}
          </div>

          {/* ── MAIN INFO ── */}
          <div className="flex-1 min-w-0 w-full pb-6 sm:pb-8">
            {/* Discipline + level chips */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {fighter?.discipline && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-600 text-white px-3 py-1.5 rounded-full uppercase tracking-wide">
                  <i className={disciplineIcons[fighter.discipline] || 'ri-boxing-line'}></i>
                  {disciplineLabels[fighter.discipline] || fighter.discipline}
                </span>
              )}
              {fighter?.experience_level && (
                <span className="text-xs font-semibold bg-white/10 text-white/80 border border-white/20 px-3 py-1.5 rounded-full">
                  {expLabels[fighter.experience_level] || fighter.experience_level}
                </span>
              )}
              {fighter?.weight_class && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-white/8 text-white/60 border border-white/10 px-3 py-1.5 rounded-full">
                  <i className="ri-scales-line"></i>
                  {fighter.weight_class}
                </span>
              )}
            </div>

            {/* Name */}
            <div className="flex items-start gap-3 flex-wrap mb-1">
              <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white leading-none tracking-tight break-words">
                {profile.full_name || 'Peleador'}
              </h1>
              {profile.verified && (
                <div className="mt-1">
                  <VerifiedBadge type="fighter" size="lg" showLabel={false} />
                </div>
              )}
            </div>

            {fighter?.nickname && (
              <p className="text-base sm:text-xl text-red-400 font-bold italic mb-3">
                &ldquo;{fighter.nickname}&rdquo;
              </p>
            )}

            {/* Location + gym */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-white/50 mb-4">
              {profile.location && (
                <span className="flex items-center gap-1.5">
                  <i className="ri-map-pin-line text-white/30"></i>
                  {profile.location}
                </span>
              )}
              {fighter?.nationality && (
                <span className="flex items-center gap-1.5">
                  <i className="ri-flag-line text-white/30"></i>
                  {fighter.nationality}
                </span>
              )}
              {fighter?.gym && (
                <span className="flex items-center gap-1.5">
                  <i className="ri-building-4-line text-white/30"></i>
                  {fighter.gym}
                </span>
              )}
              {fighter?.age && (
                <span className="flex items-center gap-1.5">
                  <i className="ri-calendar-line text-white/30"></i>
                  {fighter.age} años
                </span>
              )}
            </div>

            {/* ── RECORD BLOCK ── */}
            {fighter && (
              <div className="flex items-stretch gap-0 mb-5 w-full sm:w-fit overflow-x-auto">
                {[
                  { label: 'Victorias', value: fighter.wins, color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/8' },
                  { label: 'Derrotas', value: fighter.losses, color: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-500/8' },
                  { label: 'Empates', value: fighter.draws, color: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/8' },
                  { label: 'KOs', value: fighter.kos, color: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/8' },
                ].map((s, i, arr) => (
                  <div
                    key={s.label}
                    className={`${s.bg} border-y border-l ${s.border} ${i === arr.length - 1 ? 'border-r rounded-r-xl' : ''} ${i === 0 ? 'rounded-l-xl' : ''} px-4 py-3 text-center flex-1 sm:flex-none sm:min-w-[72px]`}
                  >
                    <p className={`text-2xl sm:text-3xl font-black ${s.color} leading-none`}>{s.value}</p>
                    <p className="text-[10px] sm:text-xs text-white/35 uppercase tracking-widest mt-1 font-medium">{s.label}</p>
                  </div>
                ))}
                {winRate !== null && (
                  <div className="ml-2 flex flex-col justify-center px-3 border border-white/10 rounded-xl bg-white/5 flex-shrink-0">
                    <p className="text-xl sm:text-2xl font-black text-white leading-none">{winRate}%</p>
                    <p className="text-[10px] sm:text-xs text-white/35 uppercase tracking-widest mt-1 font-medium">Win rate</p>
                  </div>
                )}
              </div>
            )}

            {/* Social links */}
            {(profile.instagram || profile.tiktok || profile.youtube || profile.twitter) && (
              <div className="flex flex-wrap gap-2 mb-5">
                {profile.instagram && (
                  <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="nofollow noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-pink-600/20 to-orange-500/20 border border-pink-500/30 text-pink-300 hover:text-pink-200 px-3 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap">
                    <i className="ri-instagram-line text-sm"></i>{profile.instagram}
                  </a>
                )}
                {profile.tiktok && (
                  <a href={`https://tiktok.com/@${profile.tiktok.replace('@', '')}`} target="_blank" rel="nofollow noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 border border-white/15 text-white/70 hover:text-white px-3 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap">
                    <i className="ri-tiktok-line text-sm"></i>{profile.tiktok}
                  </a>
                )}
                {profile.youtube && (
                  <a href={profile.youtube} target="_blank" rel="nofollow noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold bg-red-600/20 border border-red-500/30 text-red-300 hover:text-red-200 px-3 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap">
                    <i className="ri-youtube-line text-sm"></i>YouTube
                  </a>
                )}
                {profile.twitter && (
                  <a href={`https://twitter.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="nofollow noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 border border-white/15 text-white/60 hover:text-white px-3 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap">
                    <i className="ri-twitter-x-line text-sm"></i>{profile.twitter}
                  </a>
                )}
              </div>
            )}

            {/* CTAs */}
            {canContact && (
              <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
                <button
                  onClick={onContact}
                  className="flex items-center gap-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-5 sm:px-7 py-3 sm:py-3.5 rounded-xl transition-all cursor-pointer whitespace-nowrap text-sm w-full sm:w-auto justify-center"
                >
                  <i className="ri-heart-line text-base"></i>
                  Me interesa este peleador
                </button>
                {canMessage && onMessage && (
                  <button
                    onClick={onMessage}
                    disabled={startingChat}
                    className="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 border border-white/25 hover:border-white/40 active:scale-95 text-white font-bold px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl transition-all cursor-pointer whitespace-nowrap text-sm w-full sm:w-auto justify-center disabled:opacity-60"
                  >
                    {startingChat ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <i className="ri-message-3-line text-base"></i>
                    )}
                    Enviar mensaje
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM STRIP ── */}
        {fighter && (
          <div className="mt-6 border-t border-white/8 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/8">
            {[
              { icon: 'ri-boxing-line', label: 'Disciplina', value: disciplineLabels[fighter.discipline || ''] || '—' },
              { icon: 'ri-scales-line', label: 'Categoría', value: fighter.weight_class || '—' },
              { icon: 'ri-bar-chart-line', label: 'Nivel', value: expLabels[fighter.experience_level || ''] || '—' },
              { icon: 'ri-trophy-line', label: 'Récord', value: `${fighter.wins}V · ${fighter.losses}D · ${fighter.draws}E` },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-4">
                <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-white/8 text-white/50 flex-shrink-0">
                  <i className={`${item.icon} text-sm`}></i>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-white/35 uppercase tracking-wider font-medium">{item.label}</p>
                  <p className="text-xs sm:text-sm font-bold text-white/90 mt-0.5 truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}