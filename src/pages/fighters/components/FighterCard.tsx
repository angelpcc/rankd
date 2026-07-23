import { useNavigate } from 'react-router-dom';
import { Profile, Fighter } from '@/lib/supabase';
import VerifiedBadge from '@/components/base/VerifiedBadge';

const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};
const expLabels: Record<string, string> = {
  amateur: 'Amateur', semi_pro: 'Semi-Pro', professional: 'Profesional',
};
const disciplineColors: Record<string, string> = {
  boxing: 'bg-red-500/12 text-red-400 border-red-500/25',
  mma: 'bg-orange-500/12 text-orange-400 border-orange-500/25',
  kickboxing: 'bg-[#C9A84C]/12 text-[#C9A84C] border-[#C9A84C]/30',
  muay_thai: 'bg-rose-500/12 text-rose-400 border-rose-500/25',
  wrestling: 'bg-white/[0.06] text-zinc-300 border-white/15',
  bjj: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25',
  other: 'bg-white/[0.06] text-zinc-400 border-white/15',
};

interface Props {
  profile: Profile;
  fighter: Fighter;
}

export default function FighterCard({ profile, fighter }: Props) {
  const navigate = useNavigate();
  const initials = (profile.full_name || 'F').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const disciplineColor = disciplineColors[fighter.discipline || ''] || disciplineColors.other;
  const totalFights = fighter.wins + fighter.losses + fighter.draws;
  const winRate = totalFights > 0 ? Math.round((fighter.wins / totalFights) * 100) : null;

  return (
    <article
      onClick={() => navigate(`/fighter/${fighter.id}`)}
      className="group bg-[#0c0c0c] border border-white/[0.08] rounded-2xl overflow-hidden hover:border-red-500/40 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-red-600/15 transition-all duration-300 cursor-pointer"
    >
      {/* ── FOTO GRANDE tipo ficha de peleador ── */}
      <div className="relative h-52 bg-gradient-to-br from-zinc-900 to-black overflow-hidden">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name || 'Fighter'}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-7xl text-white/10">{initials}</span>
          </div>
        )}
        {/* Gradiente inferior para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] via-[#0c0c0c]/40 to-transparent" />
        {/* Barra de acento */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-600 to-transparent" />

        {/* Disponibilidad */}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${fighter.is_available ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-black/50 text-zinc-300 border border-white/15'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${fighter.is_available ? 'bg-green-400 animate-pulse' : 'bg-zinc-400'}`}></span>
          {fighter.is_available ? 'Disponible' : 'No disponible'}
        </div>

        {/* Win rate */}
        {winRate !== null && (
          <div className="absolute top-3 left-3 flex items-center gap-1 text-xs font-bold text-white bg-white/10 backdrop-blur-sm border border-white/20 px-2.5 py-1 rounded-full">
            <i className="ri-fire-line text-orange-400"></i>
            {winRate}%
          </div>
        )}

        {/* Nombre sobre la foto */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }} className="text-xl text-white leading-tight group-hover:text-red-300 transition-colors drop-shadow-lg">
              {profile.full_name || 'Peleador'}
            </h3>
            {profile.verified && (
              <VerifiedBadge type="fighter" size="sm" showLabel={false} />
            )}
          </div>
          {fighter.nickname && (
            <p className="text-xs text-red-400 italic font-semibold mt-0.5 drop-shadow">&ldquo;{fighter.nickname}&rdquo;</p>
          )}
          {(fighter.nationality || profile.location) && (
            <p className="flex items-center gap-1 text-xs text-zinc-300 mt-1.5 drop-shadow">
              <i className="ri-map-pin-line"></i>
              {fighter.nationality}{fighter.nationality && profile.location ? ' · ' : ''}{profile.location}
            </p>
          )}
        </div>
      </div>

      {/* ── INFO ── */}
      <div className="p-4">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3.5">
          {fighter.discipline && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${disciplineColor}`}>
              {disciplineLabels[fighter.discipline] || fighter.discipline}
            </span>
          )}
          {fighter.weight_class && (
            <span className="text-xs font-medium bg-white/[0.05] text-zinc-300 border border-white/10 px-2.5 py-1 rounded-full">
              <i className="ri-scales-line mr-1"></i>{fighter.weight_class}
            </span>
          )}
          {fighter.experience_level && (
            <span className="text-xs font-medium bg-white/[0.05] text-zinc-300 border border-white/10 px-2.5 py-1 rounded-full">
              {expLabels[fighter.experience_level] || fighter.experience_level}
            </span>
          )}
        </div>

        {/* Récord */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3 mb-3.5">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xl text-green-400 leading-none">{fighter.wins}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">Vict</p>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <p style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xl text-red-400 leading-none">{fighter.losses}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">Derr</p>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <p style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xl text-yellow-400 leading-none">{fighter.draws}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">Emp</p>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <p style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xl text-orange-400 leading-none">{fighter.kos}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">KOs</p>
            </div>
          </div>
        </div>

        {/* Redes */}
        {(profile.instagram || profile.tiktok || profile.youtube || profile.twitter) && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {profile.instagram && (
              <span className="flex items-center gap-1 text-xs bg-pink-500/10 border border-pink-500/20 text-pink-400 px-2 py-1 rounded-full whitespace-nowrap">
                <i className="ri-instagram-line text-xs"></i>
                <span className="hidden sm:inline">{profile.instagram}</span>
                <span className="sm:hidden">IG</span>
              </span>
            )}
            {profile.tiktok && (
              <span className="flex items-center gap-1 text-xs bg-white/[0.05] border border-white/10 text-zinc-300 px-2 py-1 rounded-full whitespace-nowrap">
                <i className="ri-tiktok-line text-xs"></i>
                <span className="hidden sm:inline">{profile.tiktok}</span>
                <span className="sm:hidden">TT</span>
              </span>
            )}
            {profile.youtube && (
              <span className="flex items-center gap-1 text-xs bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-1 rounded-full whitespace-nowrap">
                <i className="ri-youtube-line text-xs"></i>
                <span>YT</span>
              </span>
            )}
            {profile.twitter && (
              <span className="flex items-center gap-1 text-xs bg-white/[0.05] border border-white/10 text-zinc-300 px-2 py-1 rounded-full whitespace-nowrap">
                <i className="ri-twitter-x-line text-xs"></i>
                <span className="hidden sm:inline">{profile.twitter}</span>
                <span className="sm:hidden">X</span>
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            {fighter.gym && <><i className="ri-building-4-line"></i><span className="truncate max-w-[120px]">{fighter.gym}</span></>}
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-red-400 group-hover:gap-2 transition-all whitespace-nowrap">
            Ver perfil <i className="ri-arrow-right-line"></i>
          </span>
        </div>
      </div>
    </article>
  );
}
