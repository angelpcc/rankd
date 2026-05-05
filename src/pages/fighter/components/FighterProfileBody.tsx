import { Profile, Fighter, FighterVideo, FighterAchievement } from '@/lib/supabase';

interface Props {
  profile: Profile;
  fighter: Fighter | null;
  videos: FighterVideo[];
  achievements: FighterAchievement[];
  views?: number;
  onContact: () => void;
}

const videoTypeLabels: Record<string, string> = {
  highlight: 'Highlight', fight: 'Combate', training: 'Entrenamiento', interview: 'Entrevista',
};

const lookingForConfig: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  'Combates':           { icon: 'ri-boxing-line',       color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
  'Contrato profesional':{ icon: 'ri-file-text-line',   color: 'text-zinc-700',    bg: 'bg-zinc-100',   border: 'border-zinc-200' },
  'Patrocinio':         { icon: 'ri-hand-coin-line',    color: 'text-yellow-700',  bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  'Manager':            { icon: 'ri-user-star-line',    color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  'Promotora':          { icon: 'ri-trophy-line',       color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Entrenamiento':      { icon: 'ri-run-line',          color: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200' },
  'Sparring':           { icon: 'ri-user-shared-line',  color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200' },
};

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

function getYouTubeThumbnail(url: string): string | null {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export default function FighterProfileBody({ profile, fighter, videos, achievements, views, onContact }: Props) {
  const lookingFor = fighter?.looking_for || [];

  return (
    <div className="bg-zinc-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-7 sm:py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-1 space-y-5">

            {/* Bio */}
            {profile.bio && (
              <div className="bg-white border border-zinc-100 rounded-2xl p-6">
                <h4 id="bio" className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <i className="ri-user-line"></i>
                  <a href="#bio">Sobre el peleador</a>
                </h4>
                <p className="text-sm text-zinc-600 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* ── LOOKING FOR — visual cards ── */}
            {lookingFor.length > 0 && (
              <div className="bg-white border border-zinc-100 rounded-2xl p-6">
                <h4 id="looking" className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-search-line"></i>
                  <a href="#looking">Busca activamente</a>
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {lookingFor.map((item) => {
                    const cfg = lookingForConfig[item] || { icon: 'ri-star-line', color: 'text-zinc-600', bg: 'bg-zinc-50', border: 'border-zinc-200' };
                    return (
                      <div
                        key={item}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}
                      >
                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white ${cfg.color} flex-shrink-0`}>
                          <i className={`${cfg.icon} text-sm`}></i>
                        </div>
                        <span className={`text-sm font-semibold ${cfg.color}`}>{item}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-zinc-400 mt-3 flex items-center gap-1">
                  <i className="ri-information-line"></i>
                  Este peleador está abierto a propuestas
                </p>
              </div>
            )}

            {/* Details */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-6">
              <h4 id="details" className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="ri-file-list-line"></i>
                <a href="#details">Ficha técnica</a>
              </h4>
              <div className="space-y-3">
                {fighter?.gym && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 flex-shrink-0">
                      <i className="ri-building-4-line text-sm"></i>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Gimnasio</p>
                      <p className="text-sm font-semibold text-zinc-800">{fighter.gym}</p>
                    </div>
                  </div>
                )}
                {fighter?.coach && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 flex-shrink-0">
                      <i className="ri-user-star-line text-sm"></i>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Entrenador</p>
                      <p className="text-sm font-semibold text-zinc-800">{fighter.coach}</p>
                    </div>
                  </div>
                )}
                {fighter?.nationality && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 flex-shrink-0">
                      <i className="ri-flag-line text-sm"></i>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Nacionalidad</p>
                      <p className="text-sm font-semibold text-zinc-800">{fighter.nationality}</p>
                    </div>
                  </div>
                )}
                {profile.location && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 flex-shrink-0">
                      <i className="ri-map-pin-line text-sm"></i>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Ubicación</p>
                      <p className="text-sm font-semibold text-zinc-800">{profile.location}</p>
                    </div>
                  </div>
                )}
                {fighter?.age && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 flex-shrink-0">
                      <i className="ri-calendar-line text-sm"></i>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Edad</p>
                      <p className="text-sm font-semibold text-zinc-800">{fighter.age} años</p>
                    </div>
                  </div>
                )}
                {!fighter && !profile.location && (
                  <p className="text-xs text-zinc-400 italic">Este peleador aún no ha completado su ficha deportiva.</p>
                )}
              </div>
            </div>

            {/* Social */}
            {(profile.instagram || profile.tiktok || profile.youtube || profile.twitter) && (
              <div className="bg-white border border-zinc-100 rounded-2xl p-6">
                <h4 id="social" className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-share-line"></i>
                  <a href="#social">Presencia Digital</a>
                </h4>
                <div className="space-y-2.5">
                  {profile.instagram && (
                    <a
                      href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="nofollow noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-pink-50 to-orange-50 border border-pink-100 hover:border-pink-300 transition-all cursor-pointer group"
                    >
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 text-white flex-shrink-0">
                        <i className="ri-instagram-line text-base"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-400">Instagram</p>
                        <p className="text-sm font-semibold text-zinc-800 truncate">{profile.instagram}</p>
                      </div>
                      <i className="ri-external-link-line text-zinc-400 group-hover:text-pink-500 transition-colors flex-shrink-0"></i>
                    </a>
                  )}
                  {profile.tiktok && (
                    <a
                      href={`https://tiktok.com/@${profile.tiktok.replace('@', '')}`}
                      target="_blank"
                      rel="nofollow noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-zinc-400 transition-all cursor-pointer group"
                    >
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-900 text-white flex-shrink-0">
                        <i className="ri-tiktok-line text-base"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-400">TikTok</p>
                        <p className="text-sm font-semibold text-zinc-800 truncate">{profile.tiktok}</p>
                      </div>
                      <i className="ri-external-link-line text-zinc-400 group-hover:text-zinc-700 transition-colors flex-shrink-0"></i>
                    </a>
                  )}
                  {profile.youtube && (
                    <a
                      href={profile.youtube}
                      target="_blank"
                      rel="nofollow noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100 hover:border-red-300 transition-all cursor-pointer group"
                    >
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-600 text-white flex-shrink-0">
                        <i className="ri-youtube-line text-base"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-400">YouTube</p>
                        <p className="text-sm font-semibold text-zinc-800">Ver canal</p>
                      </div>
                      <i className="ri-external-link-line text-zinc-400 group-hover:text-red-500 transition-colors flex-shrink-0"></i>
                    </a>
                  )}
                  {profile.twitter && (
                    <a
                      href={`https://twitter.com/${profile.twitter.replace('@', '')}`}
                      target="_blank"
                      rel="nofollow noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-zinc-400 transition-all cursor-pointer group"
                    >
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-900 text-white flex-shrink-0">
                        <i className="ri-twitter-x-line text-base"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-400">Twitter / X</p>
                        <p className="text-sm font-semibold text-zinc-800 truncate">{profile.twitter}</p>
                      </div>
                      <i className="ri-external-link-line text-zinc-400 group-hover:text-zinc-700 transition-colors flex-shrink-0"></i>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Views card */}
            {views !== undefined && views > 0 && (
              <div className="bg-white border border-zinc-100 rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 flex-shrink-0">
                    <i className="ri-eye-line text-lg"></i>
                  </div>
                  <div>
                    <p className="text-xl font-black text-zinc-800">{views.toLocaleString('es-ES')}</p>
                    <p className="text-xs text-zinc-400">visitas al perfil</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                  Más visitas = más visibilidad ante promotoras y marcas.
                </p>
              </div>
            )}

            {/* CTA sidebar */}
            <div className="bg-zinc-950 rounded-2xl p-6">
              <p className="text-sm font-semibold text-white mb-1">¿Te interesa este peleador?</p>
              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">Contacta directamente para hablar de oportunidades, patrocinios o contratos.</p>
              <button
                onClick={onContact}
                className="w-full bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all cursor-pointer whitespace-nowrap text-sm flex items-center justify-center gap-2"
              >
                <i className="ri-heart-line"></i>
                Contactar ahora
              </button>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Stats */}
            {fighter && (
              <div>
                <h4 id="stats" className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-bar-chart-line"></i>
                  <a href="#stats">Estadísticas de combate</a>
                </h4>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Victorias', value: fighter.wins, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', icon: 'ri-checkbox-circle-line' },
                    { label: 'Derrotas', value: fighter.losses, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', icon: 'ri-close-circle-line' },
                    { label: 'Empates', value: fighter.draws, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100', icon: 'ri-subtract-line' },
                    { label: 'KOs', value: fighter.kos, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', icon: 'ri-flashlight-line' },
                  ].map((s) => (
                    <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-5 text-center`}>
                      <div className={`w-8 h-8 flex items-center justify-center mx-auto mb-2 ${s.color}`}>
                        <i className={`${s.icon} text-xl`}></i>
                      </div>
                      <p className={`text-4xl font-black ${s.color} leading-none`}>{s.value}</p>
                      <p className="text-xs text-zinc-500 font-medium mt-2 uppercase tracking-wide">{s.label}</p>
                    </div>
                  ))}
                </div>
                {fighter.wins + fighter.losses > 0 && (
                  <div className="bg-white border border-zinc-100 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                      <span className="font-medium">Ratio de victorias</span>
                      <span className="font-bold text-zinc-700 text-sm">{Math.round((fighter.wins / (fighter.wins + fighter.losses)) * 100)}%</span>
                    </div>
                    <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                        style={{ width: `${Math.round((fighter.wins / (fighter.wins + fighter.losses)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No fighter data */}
            {!fighter && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-8 text-center">
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-zinc-100 mx-auto mb-3">
                  <i className="ri-user-line text-2xl text-zinc-400"></i>
                </div>
                <p className="text-sm font-semibold text-zinc-700">Perfil deportivo incompleto</p>
                <p className="text-xs text-zinc-400 mt-1">Este peleador aún no ha completado su ficha deportiva.</p>
              </div>
            )}

            {/* ── HIGHLIGHT VIDEO — embedded ── */}
            {fighter?.highlight_video && (
              <div>
                <h4 id="highlight" className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-play-circle-line"></i>
                  <a href="#highlight">Video Destacado</a>
                </h4>
                <div className="rounded-2xl overflow-hidden bg-zinc-950 shadow-lg">
                  <div className="aspect-video">
                    {getYouTubeId(fighter.highlight_video) ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${getYouTubeId(fighter.highlight_video)}?rel=0&modestbranding=1`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="Video destacado"
                      />
                    ) : getVimeoId(fighter.highlight_video) ? (
                      <iframe
                        src={`https://player.vimeo.com/video/${getVimeoId(fighter.highlight_video)}?color=e11d48&title=0&byline=0`}
                        className="w-full h-full"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        title="Video destacado"
                      />
                    ) : (
                      <a
                        href={fighter.highlight_video}
                        target="_blank"
                        rel="nofollow noreferrer"
                        className="flex flex-col items-center justify-center h-full text-white gap-3 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <i className="ri-play-circle-line text-6xl"></i>
                        <span className="text-sm font-medium">Ver video</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Videos gallery */}
            {videos.length > 0 && (
              <div>
                <h4 id="videos" className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-video-line"></i>
                  <a href="#videos">Videos ({videos.length})</a>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {videos.map((v) => {
                    const thumb = getYouTubeThumbnail(v.url);
                    return (
                      <a
                        key={v.id}
                        href={v.url}
                        target="_blank"
                        rel="nofollow noreferrer"
                        className="group bg-white border border-zinc-100 rounded-xl overflow-hidden hover:border-red-200 hover:-translate-y-0.5 transition-all cursor-pointer"
                      >
                        <div className="aspect-video bg-zinc-100 relative overflow-hidden">
                          {thumb ? (
                            <img src={thumb} alt={v.title} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                              <i className="ri-play-circle-line text-4xl text-zinc-600"></i>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-red-600 text-white">
                              <i className="ri-play-fill text-2xl"></i>
                            </div>
                          </div>
                          <span className="absolute top-2 left-2 text-xs bg-zinc-900/80 text-zinc-300 px-2 py-0.5 rounded-full capitalize">
                            {videoTypeLabels[v.video_type || ''] || v.video_type}
                          </span>
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold text-zinc-800 truncate">{v.title}</p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Achievements */}
            {achievements.length > 0 && (
              <div>
                <h4 id="achievements" className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-medal-line"></i>
                  <a href="#achievements">Logros y Títulos</a>
                </h4>
                <div className="space-y-3">
                  {achievements.map((a) => (
                    <div key={a.id} className="bg-white border border-zinc-100 rounded-xl p-4 flex items-start gap-4 hover:border-yellow-200 transition-colors">
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-yellow-50 border border-yellow-100 flex-shrink-0">
                        <i className="ri-medal-line text-yellow-500 text-lg"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-zinc-800">{a.title}</p>
                          {a.year && (
                            <span className="text-xs font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full flex-shrink-0">{a.year}</span>
                          )}
                        </div>
                        {a.description && <p className="text-xs text-zinc-500 mt-1">{a.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom CTA */}
            <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
              <div className="flex-1">
                <p className="text-base sm:text-lg font-black text-white mb-1">¿Listo para trabajar juntos?</p>
                <p className="text-sm text-zinc-400">Contacta con {profile.full_name?.split(' ')[0] || 'este peleador'} directamente para hablar de oportunidades.</p>
              </div>
              <button
                onClick={onContact}
                className="flex-shrink-0 w-full sm:w-auto flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-heart-line"></i>
                Me interesa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
