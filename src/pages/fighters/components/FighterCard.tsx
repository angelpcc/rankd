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
  const record = `${fighter.wins}-${fighter.losses}-${fighter.draws}`;
  const disciplineColor = disciplineColors[fighter.discipline || ''] || disciplineColors.other;

  return (
    <article
      onClick={() => navigate(`/fighter/${fighter.id}`)}
      className="group bg-white border border-zinc-100 rounded-2xl overflow-hidden hover:border-red-200 hover:-translate-y-1 transition-all duration-200 cursor-pointer"
    >
      {/* Top section */}
      <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 p-4 sm:p-6 pb-6 sm:pb-8">
        <div className="flex items-start justify-between mb-4">
          {/* Avatar with verified overlay */}
          <div className="relative">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || 'Fighter'}
                className="w-16 h-16 rounded-xl object-cover object-top border-2 border-white/10"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white text-xl font-black border-2 border-white/10">
                {initials}
              </div>
            )}
            {profile.verified && (
              <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 flex items-center justify-center bg-green-500 rounded-full border-2 border-zinc-900">
                <i className="ri-shield-check-fill text-white text-xs"></i>
              </div>
            )}
          </div>
          {/* Availability */}
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${fighter.is_available ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-zinc-700 text-zinc-400 border border-zinc-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${fighter.is_available ? 'bg-green-400' : 'bg-zinc-500'}`}></span>
            {fighter.is_available ? 'Disponible' : 'No disponible'}
          </div>
        </div>

        {/* Name + verified badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-black text-white leading-tight group-hover:text-red-300 transition-colors">
            {profile.full_name || 'Peleador'}
          </h3>
          {profile.verified && (
            <VerifiedBadge type="fighter" size="sm" showLabel={false} />
          )}
        </div>
        {fighter.nickname && (
          <p className="text-xs text-red-400 italic mt-0.5">&ldquo;{fighter.nickname}&rdquo;</p>
        )}

        {/* Location */}
        {(fighter.nationality || profile.location) && (
          <p className="flex items-center gap-1 text-xs text-zinc-400 mt-2">
            <i className="ri-map-pin-line"></i>
            {fighter.nationality}{fighter.nationality && profile.location ? ', ' : ''}{profile.location}
          </p>
        )}
      </div>

      {/* Bottom section */}
      <div className="p-4 sm:p-5">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {fighter.discipline && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${disciplineColor}`}>
              {disciplineLabels[fighter.discipline] || fighter.discipline}
            </span>
          )}
          {fighter.weight_class && (
            <span className="text-xs font-medium bg-zinc-50 text-zinc-600 border border-zinc-200 px-2.5 py-1 rounded-full">
              {fighter.weight_class}
            </span>
          )}
          {fighter.experience_level && (
            <span className="text-xs font-medium bg-zinc-50 text-zinc-500 border border-zinc-200 px-2.5 py-1 rounded-full">
              {expLabels[fighter.experience_level] || fighter.experience_level}
            </span>
          )}
        </div>

        {/* Record */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 bg-zinc-50 rounded-xl p-3">
            <div className="flex items-center justify-around">
              <div className="text-center">
                <p className="text-lg font-black text-green-600">{fighter.wins}</p>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">V</p>
              </div>
              <div className="w-px h-8 bg-zinc-200"></div>
              <div className="text-center">
                <p className="text-lg font-black text-red-500">{fighter.losses}</p>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">D</p>
              </div>
              <div className="w-px h-8 bg-zinc-200"></div>
              <div className="text-center">
                <p className="text-lg font-black text-yellow-500">{fighter.draws}</p>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">E</p>
              </div>
              <div className="w-px h-8 bg-zinc-200"></div>
              <div className="text-center">
                <p className="text-lg font-black text-orange-500">{fighter.kos}</p>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">KO</p>
              </div>
            </div>
          </div>
        </div>

        {/* Social presence */}
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
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            {fighter.gym && <><i className="ri-building-4-line"></i><span className="truncate max-w-[120px]">{fighter.gym}</span></>}
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 group-hover:gap-2 transition-all whitespace-nowrap">
            Ver perfil <i className="ri-arrow-right-line"></i>
          </span>
        </div>
      </div>
    </article>
  );
}
