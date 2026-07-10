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
  boxing: 'bg-red-50 text-red-600 border-red-100',
  mma: 'bg-orange-50 text-orange-600 border-orange-100',
  kickboxing: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  muay_thai: 'bg-rose-50 text-rose-600 border-rose-100',
  wrestling: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  bjj: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  other: 'bg-zinc-100 text-zinc-600 border-zinc-200',
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
      className="group bg-white border border-zinc-100 rounded-2xl overflow-hidden hover:border-red-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-red-600/10 transition-all duration-300 cursor-pointer"
    >
      {/* ── FOTO GRANDE tipo ficha de peleador ── */}
      <div className="relative h-52 bg-gradient-to-br from-zinc-900 to-zinc-800 overflow-hidden">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name || 'Fighter'}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-7xl font-black text-white/10">{initials}</span>
          </div>
        )}
        {/* Gradiente inferior para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        {/* Barra de acento */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-600 to-transparent" />

        {/* Disponibilidad */}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${fighter.is_available ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-zinc-800/70 text-zinc-300 border border-zinc-600'}`}>
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
            <h3 className="text-lg font-black text-white leading-tight group-hover:text-red-300 transition-colors drop-shadow-lg">
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
            <span className="text-xs font-medium bg-zinc-50 text-zinc-600 border border-zinc-200 px-2.5 py-1 rounded-full">
              <i className="ri-scales-line mr-1"></i>{fighter.weight_class}
            </span>
          )}
          {fighter.experience_level && (
            <span className="text-xs font-medium bg-zinc-50 text-zinc-600 border border-zinc-200 px-2.5 py-1 rounded-full">
              {expLabels[fighter.experience_level] || fighter.experience_level}
            </span>
          )}
        </div>

        {/* Récord */}
        <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 mb-3.5">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="text-lg font-black text-green-600 leading-none">{fighter.wins}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">Vict</p>
            </div>
            <div className="w-px h-8 bg-zinc-200"></div>
            <div className="text-center">
              <p className="text-lg font-black text-red-500 leading-none">{fighter.losses}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">Derr</p>
            </div>
            <div className="w-px h-8 bg-zinc-200"></div>
            <div className="text-center">
              <p className="text-lg font-black text-yellow-500 leading-none">{fighter.draws}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">Emp</p>
            </div>
            <div className="w-px h-8 bg-zinc-200"></div>
            <div className="text-center">
              <p className="text-lg font-black text-orange-500 leading-none">{fighter.kos}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">KOs</p>
            </div>
          </div>
        </div>

        {/* Redes */}
        {(profile.instagram || profile.tiktok || profile.youtube || profile.twitter) && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {profile.instagram && (
              <span className="flex items-center gap-1 text-xs bg-gradient-to-r from-pink-50 to-orange-50 border border-pink-100 text-pink-500 px-2 py-1 rounded-full whitespace-nowrap">
                <i className="ri-instagram-line text-xs"></i>
                <span className="hidden sm:inline">{profile.instagram}</span>
                <span className="sm:hidden">IG</span>
              </span>
            )}
            {profile.tiktok && (
              <span className="flex items-center gap-1 text-xs bg-zinc-100 border border-zinc-200 text-zinc-600 px-2 py-1 rounded-full whitespace-nowrap">
                <i className="ri-tiktok-line text-xs"></i>
                <span className="hidden sm:inline">{profile.tiktok}</span>
                <span className="sm:hidden">TT</span>
              </span>
            )}
            {profile.youtube && (
              <span className="flex items-center gap-1 text-xs bg-red-50 border border-red-100 text-red-500 px-2 py-1 rounded-full whitespace-nowrap">
                <i className="ri-youtube-line text-xs"></i>
                <span>YT</span>
              </span>
            )}
            {profile.twitter && (
              <span className="flex items-center gap-1 text-xs bg-zinc-100 border border-zinc-200 text-zinc-600 px-2 py-1 rounded-full whitespace-nowrap">
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
          <span className="flex items-center gap-1 text-xs font-bold text-red-600 group-hover:gap-2 transition-all whitespace-nowrap">
            Ver perfil <i className="ri-arrow-right-line"></i>
          </span>
        </div>
      </div>
    </article>
  );
}