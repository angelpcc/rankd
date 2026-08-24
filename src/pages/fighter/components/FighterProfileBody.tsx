import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Profile, Fighter, FighterVideo, FighterAchievement } from '@/lib/supabase';

// Historial de combates del peleador (D.3). Deriva de `event_bouts` (mig 0023):
// eventos donde participó como A o B con resultado registrado. La fila incluye
// ya normalizado el oponente, el resultado desde su punto de vista, y el
// evento (fecha, título, ubicación) para navegar al detalle.
export interface FightHistoryRow {
  id: string;
  opponent: string;
  opponentId: string | null;
  outcome: 'win' | 'loss' | 'draw';
  rounds: number | null;
  weightClass: string | null;
  isMain: boolean;
  eventTitle: string | null;
  eventDate: string | null;
  eventLocation: string | null;
  eventId: string | null;
}

interface Props {
  profile: Profile;
  fighter: Fighter | null;
  videos: FighterVideo[];
  achievements: FighterAchievement[];
  history?: FightHistoryRow[];
  views?: number;
  onContact: () => void;
  canContact: boolean;
}

const videoTypeLabels: Record<string, string> = {
  highlight: 'Highlight', fight: 'Combate', training: 'Entrenamiento', interview: 'Entrevista',
};

const lookingForConfig: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  'Combates':           { icon: 'ri-boxing-line',       color: 'text-red-400',     bg: 'bg-red-500/12',     border: 'border-red-500/25' },
  'Contrato profesional':{ icon: 'ri-file-text-line',   color: 'text-zinc-200',    bg: 'bg-white/[0.05]',   border: 'border-white/10' },
  'Patrocinio':         { icon: 'ri-hand-coin-line',    color: 'text-yellow-400',  bg: 'bg-yellow-500/12',  border: 'border-yellow-500/25' },
  'Manager':            { icon: 'ri-user-star-line',    color: 'text-orange-400',  bg: 'bg-orange-500/12',  border: 'border-orange-500/25' },
  'Promotora':          { icon: 'ri-trophy-line',       color: 'text-emerald-400', bg: 'bg-emerald-500/12', border: 'border-emerald-500/25' },
  'Entrenamiento':      { icon: 'ri-run-line',          color: 'text-sky-400',     bg: 'bg-sky-500/12',     border: 'border-sky-500/25' },
  'Sparring':           { icon: 'ri-user-shared-line',  color: 'text-orange-400',  bg: 'bg-orange-500/12',  border: 'border-orange-500/25' },
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

export default function FighterProfileBody({ profile, fighter, videos, achievements, history = [], views, onContact, canContact }: Props) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const lookingFor = fighter?.looking_for || [];

  const fmtDate = (d: string | null) => d
    ? new Date(d + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const outcomeCfg: Record<'win' | 'loss' | 'draw', { label: string; letter: string; color: string; bg: string; border: string }> = {
    win:  { label: t('fh_win'),  letter: t('fh_win_letter'),  color: 'text-green-400',  bg: 'bg-green-500/12',  border: 'border-green-500/25' },
    loss: { label: t('fh_loss'), letter: t('fh_loss_letter'), color: 'text-red-400',    bg: 'bg-red-500/12',    border: 'border-red-500/25' },
    draw: { label: t('fh_draw'), letter: t('fh_draw_letter'), color: 'text-yellow-400', bg: 'bg-yellow-500/12', border: 'border-yellow-500/25' },
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-7 sm:py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-1 space-y-5">

            {/* Bio */}
            {profile.bio && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <i className="ri-user-line"></i>Sobre el peleador
                </h4>
                <p className="text-sm text-zinc-300 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* Looking for */}
            {lookingFor.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-search-line"></i>Busca activamente
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {lookingFor.map((item) => {
                    const cfg = lookingForConfig[item] || { icon: 'ri-star-line', color: 'text-zinc-300', bg: 'bg-white/[0.03]', border: 'border-white/10' };
                    return (
                      <div key={item} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.03] ${cfg.color} flex-shrink-0`}>
                          <i className={`${cfg.icon} text-sm`}></i>
                        </div>
                        <span className={`text-sm font-semibold ${cfg.color}`}>{item}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-zinc-400 mt-3 flex items-center gap-1">
                  <i className="ri-information-line"></i>Este peleador está abierto a propuestas
                </p>
              </div>
            )}

            {/* Ficha técnica */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="ri-file-list-line"></i>Ficha técnica
              </h4>
              <div className="space-y-3">
                {fighter?.gym && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-zinc-500 flex-shrink-0"><i className="ri-building-4-line text-sm"></i></div>
                    <div><p className="text-xs text-zinc-400">Gimnasio</p><p className="text-sm font-semibold text-white">{fighter.gym}</p></div>
                  </div>
                )}
                {fighter?.coach && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-zinc-500 flex-shrink-0"><i className="ri-user-star-line text-sm"></i></div>
                    <div><p className="text-xs text-zinc-400">Entrenador</p><p className="text-sm font-semibold text-white">{fighter.coach}</p></div>
                  </div>
                )}
                {fighter?.nationality && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-zinc-500 flex-shrink-0"><i className="ri-flag-line text-sm"></i></div>
                    <div><p className="text-xs text-zinc-400">Nacionalidad</p><p className="text-sm font-semibold text-white">{fighter.nationality}</p></div>
                  </div>
                )}
                {profile.location && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-zinc-500 flex-shrink-0"><i className="ri-map-pin-line text-sm"></i></div>
                    <div><p className="text-xs text-zinc-400">Ubicación</p><p className="text-sm font-semibold text-white">{profile.location}</p></div>
                  </div>
                )}
                {fighter?.age && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-zinc-500 flex-shrink-0"><i className="ri-calendar-line text-sm"></i></div>
                    <div><p className="text-xs text-zinc-400">Edad</p><p className="text-sm font-semibold text-white">{fighter.age} años</p></div>
                  </div>
                )}
              </div>
            </div>

            {/* Social */}
            {(profile.instagram || profile.tiktok || profile.youtube || profile.twitter) && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-share-line"></i>Presencia Digital
                </h4>
                <div className="space-y-2.5">
                  {profile.instagram && (
                    <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="nofollow noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-pink-500/12 to-orange-500/12 border border-pink-500/25 hover:border-pink-300 transition-all cursor-pointer group">
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 text-white flex-shrink-0"><i className="ri-instagram-line text-base"></i></div>
                      <div className="flex-1 min-w-0"><p className="text-xs text-zinc-400">Instagram</p><p className="text-sm font-semibold text-white truncate">{profile.instagram}</p></div>
                      <i className="ri-external-link-line text-zinc-400 group-hover:text-pink-500 transition-colors flex-shrink-0"></i>
                    </a>
                  )}
                  {profile.tiktok && (
                    <a href={`https://tiktok.com/@${profile.tiktok.replace('@', '')}`} target="_blank" rel="nofollow noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-zinc-400 transition-all cursor-pointer group">
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-900 text-white flex-shrink-0"><i className="ri-tiktok-line text-base"></i></div>
                      <div className="flex-1 min-w-0"><p className="text-xs text-zinc-400">TikTok</p><p className="text-sm font-semibold text-white truncate">{profile.tiktok}</p></div>
                      <i className="ri-external-link-line text-zinc-400 group-hover:text-zinc-200 transition-colors flex-shrink-0"></i>
                    </a>
                  )}
                  {profile.youtube && (
                    <a href={profile.youtube} target="_blank" rel="nofollow noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-red-500/12 border border-red-500/25 hover:border-red-300 transition-all cursor-pointer group">
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-600 text-white flex-shrink-0"><i className="ri-youtube-line text-base"></i></div>
                      <div className="flex-1 min-w-0"><p className="text-xs text-zinc-400">YouTube</p><p className="text-sm font-semibold text-white">Ver canal</p></div>
                      <i className="ri-external-link-line text-zinc-400 group-hover:text-red-500 transition-colors flex-shrink-0"></i>
                    </a>
                  )}
                  {profile.twitter && (
                    <a href={`https://twitter.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="nofollow noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-zinc-400 transition-all cursor-pointer group">
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-900 text-white flex-shrink-0"><i className="ri-twitter-x-line text-base"></i></div>
                      <div className="flex-1 min-w-0"><p className="text-xs text-zinc-400">Twitter / X</p><p className="text-sm font-semibold text-white truncate">{profile.twitter}</p></div>
                      <i className="ri-external-link-line text-zinc-400 group-hover:text-zinc-200 transition-colors flex-shrink-0"></i>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Views */}
            {views !== undefined && views > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.05] text-zinc-500 flex-shrink-0"><i className="ri-eye-line text-lg"></i></div>
                  <div><p className="text-xl font-black text-white">{views.toLocaleString('es-ES')}</p><p className="text-xs text-zinc-400">visitas al perfil</p></div>
                </div>
              </div>
            )}

            {/* CTA sidebar — solo para promotoras/marcas */}
            {canContact && (
              <div className="bg-zinc-950 rounded-2xl p-6">
                <p className="text-sm font-semibold text-white mb-1">¿Te interesa este peleador?</p>
                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">Contacta directamente para hablar de oportunidades, patrocinios o contratos.</p>
                <button onClick={onContact} className="w-full bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all cursor-pointer whitespace-nowrap text-sm flex items-center justify-center gap-2">
                  <i className="ri-heart-line"></i>Contactar ahora
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Stats */}
            {fighter && (
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-bar-chart-line"></i>Estadísticas de combate
                </h4>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Victorias', value: fighter.wins, color: 'text-green-400', bg: 'bg-green-500/12', border: 'border-green-500/25', icon: 'ri-checkbox-circle-line' },
                    { label: 'Derrotas', value: fighter.losses, color: 'text-red-400', bg: 'bg-red-500/12', border: 'border-red-500/25', icon: 'ri-close-circle-line' },
                    { label: 'Empates', value: fighter.draws, color: 'text-yellow-400', bg: 'bg-yellow-500/12', border: 'border-yellow-500/25', icon: 'ri-subtract-line' },
                    { label: 'KOs', value: fighter.kos, color: 'text-orange-400', bg: 'bg-orange-500/12', border: 'border-orange-500/25', icon: 'ri-flashlight-line' },
                  ].map((s) => (
                    <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-5 text-center`}>
                      <div className={`w-8 h-8 flex items-center justify-center mx-auto mb-2 ${s.color}`}><i className={`${s.icon} text-xl`}></i></div>
                      <p className={`text-4xl font-black ${s.color} leading-none`}>{s.value}</p>
                      <p className="text-xs text-zinc-500 font-medium mt-2 uppercase tracking-wide">{s.label}</p>
                    </div>
                  ))}
                </div>
                {fighter.wins + fighter.losses > 0 && (
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                      <span className="font-medium">Ratio de victorias</span>
                      <span className="font-bold text-zinc-200 text-sm">{Math.round((fighter.wins / (fighter.wins + fighter.losses)) * 100)}%</span>
                    </div>
                    <div className="h-2.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all" style={{ width: `${Math.round((fighter.wins / (fighter.wins + fighter.losses)) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {!fighter && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center">
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/[0.05] mx-auto mb-3"><i className="ri-user-line text-2xl text-zinc-400"></i></div>
                <p className="text-sm font-semibold text-zinc-200">Perfil deportivo incompleto</p>
                <p className="text-xs text-zinc-400 mt-1">Este peleador aún no ha completado su ficha deportiva.</p>
              </div>
            )}

            {/* Historial de combates (D.3): derivado de event_bouts confirmados */}
            {history.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-history-line"></i>{t('fh_title')} ({history.length})
                </h4>
                <div className="space-y-2">
                  {history.map((h) => {
                    const oc = outcomeCfg[h.outcome];
                    return (
                      <div key={h.id} className={`flex items-stretch gap-3 rounded-xl border ${oc.border} ${oc.bg} overflow-hidden`}>
                        {/* Franja de resultado con la letra grande */}
                        <div className={`flex items-center justify-center w-12 sm:w-14 flex-shrink-0 ${oc.color} border-r ${oc.border}`} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28 }}>
                          {oc.letter}
                        </div>
                        <div className="flex-1 min-w-0 py-3 pr-3">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-white truncate">
                                {t('fh_vs')} <span className={h.opponentId ? 'hover:underline cursor-pointer' : ''} onClick={h.opponentId ? (e) => { e.stopPropagation(); navigate(`/fighter/${h.opponentId}`); } : undefined}>{h.opponent}</span>
                                {h.isMain && <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-[#C9A84C] bg-[#C9A84C]/12 border border-[#C9A84C]/30 px-1.5 py-0.5 rounded-full align-middle">{t('fh_main')}</span>}
                              </p>
                              <p className="text-xs text-zinc-400 mt-0.5">{oc.label}{h.rounds ? ` · ${h.rounds}R` : ''}{h.weightClass ? ` · ${h.weightClass}` : ''}</p>
                            </div>
                            <span className="text-[11px] text-zinc-500 whitespace-nowrap flex-shrink-0">{fmtDate(h.eventDate)}</span>
                          </div>
                          {h.eventTitle && (
                            <button
                              onClick={() => h.eventId && navigate(`/evento/${h.eventId}`)}
                              disabled={!h.eventId}
                              className="mt-1 text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-default text-left"
                            >
                              <i className="ri-calendar-event-line text-zinc-500"></i>
                              <span className="truncate">{h.eventTitle}{h.eventLocation ? ` · ${h.eventLocation}` : ''}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Highlight video */}
            {fighter?.highlight_video && (
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-play-circle-line"></i>Video Destacado
                </h4>
                <div className="rounded-2xl overflow-hidden bg-zinc-950 shadow-lg">
                  <div className="aspect-video">
                    {getYouTubeId(fighter.highlight_video) ? (
                      <iframe src={`https://www.youtube.com/embed/${getYouTubeId(fighter.highlight_video)}?rel=0&modestbranding=1`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Video destacado" />
                    ) : getVimeoId(fighter.highlight_video) ? (
                      <iframe src={`https://player.vimeo.com/video/${getVimeoId(fighter.highlight_video)}?color=e11d48&title=0&byline=0`} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="Video destacado" />
                    ) : (
                      <a href={fighter.highlight_video} target="_blank" rel="nofollow noreferrer" className="flex flex-col items-center justify-center h-full text-white gap-3 hover:text-red-400 transition-colors cursor-pointer">
                        <i className="ri-play-circle-line text-6xl"></i>
                        <span className="text-sm font-medium">Ver video</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Videos */}
            {videos.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-video-line"></i>Videos ({videos.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {videos.map((v) => {
                    const thumb = getYouTubeThumbnail(v.url);
                    return (
                      <a key={v.id} href={v.url} target="_blank" rel="nofollow noreferrer" className="group bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden hover:border-red-500/25 hover:-translate-y-0.5 transition-all cursor-pointer">
                        <div className="aspect-video bg-white/[0.05] relative overflow-hidden">
                          {thumb ? <img src={thumb} alt={v.title} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center bg-zinc-900"><i className="ri-play-circle-line text-4xl text-zinc-300"></i></div>}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><div className="w-14 h-14 flex items-center justify-center rounded-full bg-red-600 text-white"><i className="ri-play-fill text-2xl"></i></div></div>
                          <span className="absolute top-2 left-2 text-xs bg-zinc-900/80 text-zinc-300 px-2 py-0.5 rounded-full capitalize">{videoTypeLabels[v.video_type || ''] || v.video_type}</span>
                        </div>
                        <div className="p-3"><p className="text-sm font-semibold text-white truncate">{v.title}</p></div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Achievements */}
            {achievements.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="ri-medal-line"></i>Logros y Títulos
                </h4>
                <div className="space-y-3">
                  {achievements.map((a) => (
                    <div key={a.id} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex items-start gap-4 hover:border-yellow-500/25 transition-colors">
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-yellow-500/12 border border-yellow-500/25 flex-shrink-0"><i className="ri-medal-line text-yellow-500 text-lg"></i></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-white">{a.title}</p>
                          {a.year && <span className="text-xs font-bold text-zinc-400 bg-white/[0.05] px-2 py-0.5 rounded-full flex-shrink-0">{a.year}</span>}
                        </div>
                        {a.description && <p className="text-xs text-zinc-500 mt-1">{a.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom CTA — solo para promotoras/marcas */}
            {canContact && (
              <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
                <div className="flex-1">
                  <p className="text-base sm:text-lg font-black text-white mb-1">¿Listo para trabajar juntos?</p>
                  <p className="text-sm text-zinc-400">Contacta con {profile.full_name?.split(' ')[0] || 'este peleador'} directamente para hablar de oportunidades.</p>
                </div>
                <button onClick={onContact} className="flex-shrink-0 w-full sm:w-auto flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl transition-all cursor-pointer whitespace-nowrap">
                  <i className="ri-heart-line"></i>Me interesa
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}