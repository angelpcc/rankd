import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, Fighter, FighterVideo, FighterAchievement } from '@/lib/supabase';
import DashboardNav from './DashboardNav';
import AvatarUpload from './AvatarUpload';
import FighterOpportunities from './FighterOpportunities';
import MessagesPanel from './messages/MessagesPanel';
import VerificationPanel from './VerificationPanel';
import ProfileCompletionBanner from './ProfileCompletionBanner';
import { useFighterCompletion } from '@/hooks/useProfileCompletion';

interface Props { profile: Profile; }

const disciplines = ['boxing', 'mma', 'kickboxing', 'muay_thai', 'wrestling', 'bjj', 'other'];
const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};
const weightClasses = [
  'Minimosca', 'Mosca', 'Gallo', 'Pluma', 'Ligero', 'Superligero',
  'Welter', 'Superwelter', 'Medio', 'Supermedio', 'Semipesado', 'Crucero', 'Pesado',
];
const expLevels = [
  { value: 'amateur', label: 'Amateur' },
  { value: 'semi_pro', label: 'Semi-Pro' },
  { value: 'professional', label: 'Profesional' },
];
const lookingForOptions = ['Combates', 'Contrato profesional', 'Patrocinio', 'Manager', 'Promotora', 'Entrenamiento'];

const COUNTRIES = [
  'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Costa Rica', 'Cuba',
  'Ecuador', 'El Salvador', 'España', 'Estados Unidos', 'Francia', 'Alemania',
  'Guatemala', 'Honduras', 'Italia', 'México', 'Nicaragua', 'Panamá', 'Paraguay',
  'Perú', 'Portugal', 'Puerto Rico', 'Reino Unido', 'República Dominicana',
  'Uruguay', 'Venezuela', 'Marruecos', 'Argelia', 'Senegal', 'Nigeria',
  'Japón', 'Corea del Sur', 'Tailandia', 'Australia', 'Otro',
];

type ActiveTab = 'overview' | 'profile' | 'training' | 'opportunities' | 'videos' | 'achievements' | 'messages' | 'verification' | 'settings';

export default function FighterDashboard({ profile }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [fighter, setFighter] = useState<Fighter | null>(null);
  const [videos, setVideos] = useState<FighterVideo[]>([]);
  const [achievements, setAchievements] = useState<FighterAchievement[]>([]);
  const [applicationsCount, setApplicationsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const p = new URLSearchParams(window.location.search).get('tab');
    return (p === 'messages' ? 'messages' : 'overview') as ActiveTab;
  });
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    const loadUnread = async () => {
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`);
      if (!convos || convos.length === 0) { setUnreadMessages(0); return; }
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convos.map((c) => c.id))
        .neq('sender_id', profile.id)
        .is('read_at', null);
      setUnreadMessages(count || 0);
    };
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, [profile.id, activeTab]);

  const [currentProfile, setCurrentProfile] = useState<Profile>(profile);
  const completion = useFighterCompletion(currentProfile, fighter);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [instagram, setInstagram] = useState(profile.instagram || '');
  const [tiktok, setTiktok] = useState(profile.tiktok || '');
  const [youtube, setYoutube] = useState(profile.youtube || '');
  const [twitter, setTwitter] = useState(profile.twitter || '');
  const [nickname, setNickname] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [weightClass, setWeightClass] = useState('');
  const [age, setAge] = useState('');
  const [nationality, setNationality] = useState('');
  const [wins, setWins] = useState('0');
  const [losses, setLosses] = useState('0');
  const [draws, setDraws] = useState('0');
  const [kos, setKos] = useState('0');
  const [expLevel, setExpLevel] = useState('amateur');
  const [gym, setGym] = useState('');
  const [coach, setCoach] = useState('');
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [highlightVideo, setHighlightVideo] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoType, setVideoType] = useState('highlight');
  const [achTitle, setAchTitle] = useState('');
  const [achYear, setAchYear] = useState('');
  const [achDesc, setAchDesc] = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const populateFromFighter = useCallback((f: Fighter) => {
    setNickname(f.nickname || '');
    setDiscipline(f.discipline || '');
    setWeightClass(f.weight_class || '');
    setAge(f.age?.toString() || '');
    setNationality(f.nationality || '');
    setWins(f.wins?.toString() ?? '0');
    setLosses(f.losses?.toString() ?? '0');
    setDraws(f.draws?.toString() ?? '0');
    setKos(f.kos?.toString() ?? '0');
    setExpLevel(f.experience_level || 'amateur');
    setGym(f.gym || '');
    setCoach(f.coach || '');
    setLookingFor(f.looking_for || []);
    setHighlightVideo(f.highlight_video || '');
    setIsAvailable(f.is_available ?? true);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: f } = await supabase.from('fighters').select('*').eq('profile_id', profile.id).maybeSingle();
      if (f) {
        setFighter(f);
        populateFromFighter(f);
        setIsPublic(f.is_public ?? false);
        const [{ data: vids }, { data: achs }] = await Promise.all([
          supabase.from('fighter_videos').select('*').eq('fighter_id', f.id).order('created_at', { ascending: false }),
          supabase.from('fighter_achievements').select('*').eq('fighter_id', f.id).order('year', { ascending: false }),
        ]);
        setVideos(vids || []);
        setAchievements(achs || []);
      }
      const { count } = await supabase.from('applications').select('id', { count: 'exact', head: true }).eq('fighter_profile_id', profile.id);
      setApplicationsCount(count || 0);
      setLoading(false);
    };
    load();
  }, [profile.id, populateFromFighter]);

  const canPublish = (): { ok: boolean; reason?: string } => {
    if (!fullName.trim()) return { ok: false, reason: t('dash_fighter_validation_name') };
    if (!discipline) return { ok: false, reason: t('dash_fighter_validation_discipline') };
    return { ok: true };
  };

  const publishProfile = async () => {
    if (!fighter) return;
    if (!isPublic) {
      const check = canPublish();
      if (!check.ok) { showToast(check.reason || t('dash_fighter_validation_incomplete'), 'error'); setActiveTab('profile'); return; }
    }
    setPublishing(true);
    try {
      const newState = !isPublic;
      const { error } = await supabase.from('fighters').update({ is_public: newState, updated_at: new Date().toISOString() }).eq('id', fighter.id);
      if (error) throw error;
      setIsPublic(newState);
      showToast(newState ? t('dash_published_ok') : t('dash_hidden_ok'));
    } catch { showToast(t('dash_visibility_error'), 'error'); }
    finally { setPublishing(false); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: fullName.trim(), bio: bio.trim(), location: location.trim(),
        instagram: instagram.trim(), tiktok: tiktok.trim(), youtube: youtube.trim(), twitter: twitter.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
      if (profileError) throw profileError;

      const fighterPayload = {
        profile_id: profile.id, nickname: nickname.trim(), discipline: discipline || null,
        weight_class: weightClass || null, age: age ? parseInt(age, 10) : null,
        nationality: nationality.trim(), wins: parseInt(wins, 10) || 0, losses: parseInt(losses, 10) || 0,
        draws: parseInt(draws, 10) || 0, kos: parseInt(kos, 10) || 0, experience_level: expLevel || null,
        gym: gym.trim(), coach: coach.trim(), looking_for: lookingFor, highlight_video: highlightVideo.trim(),
        is_available: isAvailable, updated_at: new Date().toISOString(),
      };

      if (fighter) {
        const { data: updatedFighter, error: updateError } = await supabase.from('fighters').update(fighterPayload).eq('id', fighter.id).select().maybeSingle();
        if (updateError) throw updateError;
        if (updatedFighter) { setFighter(updatedFighter); populateFromFighter(updatedFighter); }
      } else {
        const { data: newFighter, error: insertError } = await supabase.from('fighters').insert(fighterPayload).select().maybeSingle();
        if (insertError) throw insertError;
        if (newFighter) { setFighter(newFighter); populateFromFighter(newFighter); }
      }
      showToast(t('dash_saved_ok'));
    } catch (err) {
      console.error('Error saving profile:', err);
      showToast(t('dash_save_error'), 'error');
    } finally { setSaving(false); }
  };

  const addVideo = async () => {
    if (!fighter || !videoTitle.trim() || !videoUrl.trim()) return;
    const { data, error } = await supabase.from('fighter_videos').insert({ fighter_id: fighter.id, title: videoTitle.trim(), url: videoUrl.trim(), video_type: videoType }).select().maybeSingle();
    if (error) { showToast(t('dash_video_add_error'), 'error'); return; }
    if (data) { setVideos((prev) => [data, ...prev]); setVideoTitle(''); setVideoUrl(''); showToast(t('dash_video_added')); }
  };

  const deleteVideo = async (id: string) => {
    const { error } = await supabase.from('fighter_videos').delete().eq('id', id);
    if (error) { showToast(t('dash_video_del_error'), 'error'); return; }
    setVideos((prev) => prev.filter((v) => v.id !== id));
    showToast(t('dash_video_deleted'));
  };

  const addAchievement = async () => {
    if (!fighter || !achTitle.trim()) return;
    const { data, error } = await supabase.from('fighter_achievements').insert({ fighter_id: fighter.id, title: achTitle.trim(), year: achYear ? parseInt(achYear, 10) : null, description: achDesc.trim() || null }).select().maybeSingle();
    if (error) { showToast(t('dash_ach_add_error'), 'error'); return; }
    if (data) { setAchievements((prev) => [data, ...prev]); setAchTitle(''); setAchYear(''); setAchDesc(''); showToast(t('dash_ach_added')); }
  };

  const deleteAchievement = async (id: string) => {
    const { error } = await supabase.from('fighter_achievements').delete().eq('id', id);
    if (error) { showToast(t('dash_ach_del_error'), 'error'); return; }
    setAchievements((prev) => prev.filter((a) => a.id !== id));
    showToast(t('dash_ach_deleted'));
  };

  const toggleLookingFor = (item: string) => {
    setLookingFor((prev) => prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isHobby = currentProfile.athlete_mode === 'hobby';
  const initials = (fullName || profile.full_name || 'F').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const totalFights = (parseInt(wins, 10) || 0) + (parseInt(losses, 10) || 0) + (parseInt(draws, 10) || 0);
  const winRate = totalFights > 0 ? Math.round(((parseInt(wins, 10) || 0) / totalFights) * 100) : null;

  const tabs: { id: ActiveTab; label: string; icon: string; badge?: number }[] = [
    { id: 'overview', label: 'Inicio', icon: 'ri-dashboard-line' },
    { id: 'profile', label: t('dash_tab_profile'), icon: 'ri-user-line' },
    { id: 'training', label: 'Mi Esquina', icon: 'ri-boxing-line' },
    { id: 'opportunities', label: t('dash_tab_opportunities'), icon: 'ri-megaphone-line' },
    { id: 'messages', label: t('dash_tab_messages'), icon: 'ri-message-3-line', badge: unreadMessages || undefined },
    { id: 'verification', label: t('dash_tab_verification'), icon: currentProfile.verified ? 'ri-shield-check-fill' : 'ri-shield-line' },
    { id: 'videos', label: t('dash_tab_videos'), icon: 'ri-video-line', badge: videos.length || undefined },
    { id: 'achievements', label: t('dash_tab_achievements'), icon: 'ri-medal-line', badge: achievements.length || undefined },
    { id: 'settings', label: t('dash_tab_settings'), icon: 'ri-settings-3-line' },
  ].filter((tab) => !isHobby || !['opportunities', 'verification', 'videos', 'achievements'].includes(tab.id));

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashboardNav profile={profile} />
      {toast && (
        <div className={`fixed bottom-20 lg:bottom-6 right-6 z-50 text-white text-sm px-5 py-3 rounded-xl flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          <i className={toast.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'}></i>{toast.msg}
        </div>
      )}

      <div className="pt-14 sm:pt-16 flex min-h-screen">

        {/* ── SIDEBAR (desktop) ── */}
        <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 fixed top-16 bottom-0 left-0 z-30 overflow-y-auto">
          <div className="p-5 border-b border-zinc-800">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-12 h-12 rounded-xl object-cover object-top border border-red-500/30 mb-3" />
            ) : (
              <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-red-500/20 mb-3">
                <span className="text-sm font-black text-white/40">{initials}</span>
              </div>
            )}
            <p className="text-sm font-semibold text-white truncate">{fullName || profile.full_name || t('dash_tab_profile')}</p>
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border mt-1 bg-red-600/20 text-red-400 border-red-500/30">
              {t('dash_fighter_label')}
            </span>
            <div className={`flex items-center gap-1.5 text-xs mt-2 ${isAvailable ? 'text-green-400' : 'text-zinc-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-green-400' : 'bg-zinc-500'}`}></span>
              {isAvailable ? t('dash_fighter_available') : t('dash_fighter_not_available')}
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.id === 'training' ? navigate('/mi-esquina') : setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${activeTab === tab.id ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
              >
                <i className={`${tab.icon} text-base flex-shrink-0`}></i>
                <span className="flex-1">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-red-600/20 text-red-400'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-3 border-t border-zinc-800 space-y-2">
            {isHobby ? null : fighter && isPublic ? (
              <Link to={`/fighter/${fighter.id}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-external-link-line"></i>
                {t('dash_fighter_view_profile')}
              </Link>
            ) : fighter ? (
              <button onClick={publishProfile} disabled={publishing} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-900 text-xs font-bold px-3 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60">
                <i className="ri-eye-line"></i>
                {publishing ? t('dash_saving') : t('dash_fighter_publish')}
              </button>
            ) : null}
          </div>
        </aside>

        {/* ── MOBILE BOTTOM TABS ── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-800 flex">
          {tabs.slice(0, 4).map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.id === 'training' ? navigate('/mi-esquina') : setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors cursor-pointer relative ${activeTab === tab.id ? 'text-red-400' : 'text-zinc-500'}`}
            >
              <i className={`${tab.icon} text-lg`}></i>
              <span>{tab.label}</span>
            </button>
          ))}
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors cursor-pointer ${['settings', 'videos', 'achievements', 'verification'].includes(activeTab) ? 'text-red-400' : 'text-zinc-500'}`}
          >
            <i className="ri-more-line text-lg"></i>
            <span>Más</span>
          </button>
        </div>

        {/* ── MAIN ── */}
        <main className="flex-1 lg:ml-56 px-4 md:px-6 lg:px-8 py-6 sm:py-8 pb-24 lg:pb-8 max-w-full overflow-x-hidden">

          {/* ══ OVERVIEW ══ */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h1 className="text-2xl font-bold text-white">Hola, {(fullName || profile.full_name || '').split(' ')[0] || 'Peleador'} 👊</h1>
                <p className="text-zinc-400 text-sm mt-1">Este es el estado de tu carrera en Rankd</p>
              </div>

              {/* Visibility banners */}
              {!isHobby && fighter && !isPublic && (
                <div className="rounded-2xl overflow-hidden border-2 border-amber-500/50">
                  <div className="bg-amber-500/15 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-amber-500/25 text-amber-400 flex-shrink-0"><i className="ri-eye-off-line text-xl"></i></div>
                      <div>
                        <p className="text-sm font-bold text-amber-300">{t('dash_fighter_private_title')}</p>
                        <p className="text-xs text-amber-400/80 mt-0.5 leading-relaxed">{t('dash_fighter_private_desc')}</p>
                      </div>
                    </div>
                    <button onClick={publishProfile} disabled={publishing}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-900 text-sm font-bold px-5 py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex-shrink-0 w-full sm:w-auto justify-center">
                      {publishing ? <><div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div> {t('dash_saving')}</> : <><i className="ri-eye-line text-base"></i> {t('dash_fighter_private_cta')}</>}
                    </button>
                  </div>
                </div>
              )}
              {!isHobby && fighter && isPublic && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/20 text-green-400 flex-shrink-0"><i className="ri-eye-line"></i></div>
                    <div>
                      <p className="text-sm font-semibold text-green-300">Tu perfil está visible</p>
                      <p className="text-xs text-green-400/70">Promotoras y marcas pueden encontrarte en el directorio</p>
                    </div>
                  </div>
                  <button onClick={publishProfile} disabled={publishing} className="text-xs text-zinc-400 hover:text-red-400 cursor-pointer whitespace-nowrap transition-colors disabled:opacity-60">
                    {publishing ? t('dash_saving') : 'Ocultar'}
                  </button>
                </div>
              )}

              {!isHobby && <ProfileCompletionBanner completion={completion} onComplete={() => setActiveTab('profile')} userType="fighter" />}

              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Visitas a tu perfil', value: fighter?.profile_views ?? 0, icon: 'ri-eye-line', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', action: () => { if (fighter && isPublic) window.open(`/fighter/${fighter.id}`, '_blank'); } },
                  ...(!isHobby ? [{ label: 'Postulaciones enviadas', value: applicationsCount, icon: 'ri-send-plane-line', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', action: () => setActiveTab('opportunities') }] : []),
                  ...(!isHobby ? [
                    { label: 'Videos subidos', value: videos.length, icon: 'ri-video-line', color: 'text-zinc-300', bg: 'bg-zinc-800 border-zinc-700', action: () => setActiveTab('videos') },
                    { label: 'Logros y títulos', value: achievements.length, icon: 'ri-medal-line', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', action: () => setActiveTab('achievements') },
                  ] : [
                    { label: 'Ir a Mi Esquina', value: '🥊' as unknown as number, icon: 'ri-boxing-line', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', action: () => navigate('/mi-esquina') },
                  ]),
                ].map((kpi) => (
                  <button key={kpi.label} onClick={kpi.action} className={`${kpi.bg} border rounded-2xl p-5 text-left hover:opacity-80 transition-opacity cursor-pointer`}>
                    <div className={`w-8 h-8 flex items-center justify-center mb-3 ${kpi.color}`}><i className={`${kpi.icon} text-xl`}></i></div>
                    <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-xs text-zinc-400 mt-1 leading-tight">{kpi.label}</p>
                  </button>
                ))}
              </div>

              {/* Récord */}
              {!isHobby && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-white">Tu récord</h2>
                  {winRate !== null && (
                    <span className="text-xs font-bold text-white bg-white/10 border border-white/15 px-2.5 py-1 rounded-full">{winRate}% win rate</span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { label: t('dash_fighter_wins'), value: wins, color: 'text-green-400' },
                    { label: t('dash_fighter_losses'), value: losses, color: 'text-red-400' },
                    { label: t('dash_fighter_draws'), value: draws, color: 'text-yellow-400' },
                    { label: t('dash_fighter_kos'), value: kos, color: 'text-orange-400' },
                  ].map((s) => (
                    <div key={s.label} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 sm:p-4 text-center">
                      <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value || '0'}</p>
                      <p className="text-[10px] sm:text-xs text-zinc-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Accesos rápidos */}
              <div>
                <h2 className="text-sm font-semibold text-white mb-3">Accesos rápidos</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Mi Esquina', icon: 'ri-boxing-line', action: () => navigate('/mi-esquina') },
                    { label: 'Editar mi perfil', icon: 'ri-edit-line', action: () => setActiveTab('profile') },
                    ...(!isHobby ? [{ label: 'Ver oportunidades', icon: 'ri-megaphone-line', action: () => setActiveTab('opportunities') }] : []),
                    { label: 'Mensajes', icon: 'ri-message-3-line', action: () => setActiveTab('messages') },
                  ].map((q) => (
                    <button key={q.label} onClick={q.action} className="bg-zinc-900 border border-zinc-800 hover:border-red-500/40 rounded-2xl p-4 flex items-center gap-3 transition-colors cursor-pointer text-left">
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-600/15 text-red-400 flex-shrink-0"><i className={q.icon}></i></div>
                      <span className="text-sm font-medium text-white leading-tight">{q.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ PROFILE ══ */}
          {activeTab === 'profile' && (
            <div className="max-w-4xl">
              {/* Header con avatar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 sm:mb-8">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="flex-shrink-0">
                    <AvatarUpload userId={profile.id} currentAvatarUrl={avatarUrl} displayName={fullName || profile.full_name || 'F'}
                      onUploadSuccess={(url) => { setAvatarUrl(url); showToast('Foto de perfil actualizada'); }}
                      onError={(msg) => showToast(msg, 'error')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-lg sm:text-2xl font-bold text-white truncate">{fullName || profile.full_name || t('dash_tab_profile')}</h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs bg-red-600/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full whitespace-nowrap">{t('dash_fighter_label')}</span>
                      {discipline && <span className="text-xs text-zinc-400 whitespace-nowrap">{disciplineLabels[discipline] || discipline}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
                  {fighter && (
                    <button onClick={publishProfile} disabled={publishing}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-semibold border transition-all cursor-pointer whitespace-nowrap disabled:opacity-60 ${isPublic ? 'bg-green-500/15 border-green-500/40 text-green-400 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-400' : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-green-500/15 hover:border-green-500/40 hover:text-green-400'}`}>
                      {publishing ? <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div> {t('dash_saving')}</> : isPublic ? <><i className="ri-eye-line"></i><span className="hidden sm:inline">{t('dash_fighter_visible')}</span></> : <><i className="ri-eye-off-line"></i><span className="hidden sm:inline">{t('dash_fighter_make_public')}</span></>}
                    </button>
                  )}
                  {!isHobby && fighter && isPublic && (
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/fighter/${fighter.id}`); showToast(t('dash_settings_copied')); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-share-line"></i>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-white mb-2">{t('dash_personal_info')}</h2>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_full_name')}</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('dash_full_name')} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_nickname')}</label>
                <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="El Toro, The Machine..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_age')}</label>
                  <input type="number" min="14" max="60" value={age} onChange={(e) => setAge(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="25" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_nationality')}</label>
                  <select value={nationality} onChange={(e) => setNationality(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer">
                    <option value="">Selecciona país</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_location')}</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="Madrid, España" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bio')}</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none" placeholder="..." />
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-white mb-2">{t('dash_sport_info')}</h2>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_discipline')}</label>
                <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer">
                  <option value="">Seleccionar...</option>
                  {disciplines.map((d) => <option key={d} value={d}>{disciplineLabels[d]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_weight_class')}</label>
                <select value={weightClass} onChange={(e) => setWeightClass(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer">
                  <option value="">Seleccionar...</option>
                  {weightClasses.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_exp_level')}</label>
                <div className="flex gap-2">
                  {expLevels.map((e) => (
                    <button key={e.value} type="button" onClick={() => setExpLevel(e.value)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer whitespace-nowrap ${expLevel === e.value ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_gym')}</label>
                  <input value={gym} onChange={(e) => setGym(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="..." />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_coach')}</label>
                  <input value={coach} onChange={(e) => setCoach(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="..." />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_record')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'W', val: wins, set: setWins, color: 'text-green-400' },
                    { label: 'L', val: losses, set: setLosses, color: 'text-red-400' },
                    { label: 'D', val: draws, set: setDraws, color: 'text-yellow-400' },
                    { label: 'KO', val: kos, set: setKos, color: 'text-orange-400' },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className={`text-xs text-center mb-1 font-semibold ${s.color}`}>{s.label}</p>
                      <input type="number" min="0" value={s.val} onChange={(e) => s.set(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 text-center" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-white mb-2">{t('dash_looking_for')}</h2>
              <div className="flex flex-wrap gap-2">
                {lookingForOptions.map((opt) => (
                  <button key={opt} type="button" onClick={() => toggleLookingFor(opt)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all cursor-pointer whitespace-nowrap ${lookingFor.includes(opt) ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                    {opt}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_highlight_video')}</label>
                <input value={highlightVideo} onChange={(e) => setHighlightVideo(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-sm text-zinc-300">{t('dash_available_toggle')}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{t('dash_available_desc')}</p>
                </div>
                <button type="button" onClick={() => setIsAvailable(!isAvailable)} className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${isAvailable ? 'bg-red-600' : 'bg-zinc-700'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isAvailable ? 'left-7' : 'left-1'}`}></span>
                </button>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold text-white">{t('dash_digital_presence')}</h2>
                <span className="text-xs text-zinc-500">{t('dash_digital_visible')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Instagram', val: instagram, set: setInstagram, icon: 'ri-instagram-line', iconBg: 'bg-gradient-to-br from-pink-500 to-orange-400', focus: 'focus:border-pink-500', ph: '@usuario' },
                  { label: 'TikTok', val: tiktok, set: setTiktok, icon: 'ri-tiktok-line', iconBg: 'bg-zinc-800 border border-zinc-600', focus: 'focus:border-zinc-500', ph: '@usuario' },
                  { label: 'YouTube', val: youtube, set: setYoutube, icon: 'ri-youtube-line', iconBg: 'bg-red-600', focus: 'focus:border-red-500', ph: 'https://youtube.com/@canal' },
                  { label: 'Twitter / X', val: twitter, set: setTwitter, icon: 'ri-twitter-x-line', iconBg: 'bg-zinc-900 border border-zinc-600', focus: 'focus:border-zinc-500', ph: '@usuario' },
                ].map((s) => (
                  <div key={s.label}>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1.5">
                      <span className={`w-5 h-5 flex items-center justify-center rounded ${s.iconBg} text-white text-xs`}><i className={s.icon}></i></span>
                      {s.label}
                    </label>
                    <input value={s.val} onChange={(e) => s.set(e.target.value)} className={`w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none ${s.focus}`} placeholder={s.ph} />
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <button onClick={saveProfile} disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('dash_saving')}</> : <><i className="ri-save-line"></i> {t('dash_save_profile')}</>}
              </button>
              {fighter && (
                <p className="text-center text-xs text-zinc-500 mt-3">
                  {t('dash_public_profile')}: <button onClick={() => navigate(`/fighter/${fighter.id}`)} className="text-red-400 hover:text-red-300 cursor-pointer underline underline-offset-2">/fighter/{fighter.id.slice(0, 8)}...</button>
                </p>
              )}
            </div>
              </div>
            </div>
          )}

          {activeTab === 'opportunities' && <FighterOpportunities profile={profile} fighter={fighter} showToast={showToast} />}
          {activeTab === 'messages' && <MessagesPanel currentUserId={profile.id} />}

          {activeTab === 'verification' && (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {t('dash_verification_title')}{currentProfile.verified && <i className="ri-shield-check-fill text-green-400"></i>}
                </h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_verification_desc')}</p>
              </div>
              <VerificationPanel profile={currentProfile} showToast={showToast} onUpdate={async () => {
                const { data } = await supabase.from('profiles').select('*').eq('id', profile.id).maybeSingle();
                if (data) setCurrentProfile(data);
              }} />
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="space-y-6 max-w-5xl">
              {!fighter && <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-400 flex items-center gap-2"><i className="ri-information-line"></i>{t('dash_video_save_first')}</div>}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">{t('dash_video_add')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('dash_video_title_ph')} disabled={!fighter} />
                  <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('dash_video_url_ph')} disabled={!fighter} />
                  <div className="flex gap-2">
                    <select value={videoType} onChange={(e) => setVideoType(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer" disabled={!fighter}>
                      <option value="highlight">Highlight</option><option value="fight">Combate</option>
                      <option value="training">Entrenamiento</option><option value="interview">Entrevista</option>
                    </select>
                    <button onClick={addVideo} disabled={!fighter || !videoTitle.trim() || !videoUrl.trim()} className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 rounded-xl transition-colors cursor-pointer whitespace-nowrap"><i className="ri-add-line"></i></button>
                  </div>
                </div>
              </div>
              {videos.length === 0 ? (
                <div className="text-center py-16 text-zinc-500"><div className="w-16 h-16 flex items-center justify-center mx-auto mb-4"><i className="ri-video-line text-4xl"></i></div><p className="text-sm">{t('dash_video_empty')}</p></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map((v) => (
                    <div key={v.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group">
                      <div className="aspect-video bg-zinc-800 flex items-center justify-center relative">
                        <i className="ri-play-circle-line text-4xl text-zinc-600"></i>
                        <span className="absolute top-2 right-2 text-xs bg-zinc-900/80 text-zinc-300 px-2 py-0.5 rounded-full capitalize">{v.video_type}</span>
                      </div>
                      <div className="p-3 flex items-center justify-between">
                        <div className="min-w-0 flex-1"><p className="text-sm font-medium text-white truncate">{v.title}</p><a href={v.url} target="_blank" rel="nofollow noreferrer" className="text-xs text-red-400 hover:text-red-300 truncate block">{t('dash_video_watch')}</a></div>
                        <button onClick={() => deleteVideo(v.id)} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"><i className="ri-delete-bin-line"></i></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'achievements' && (
            <div className="space-y-6 max-w-5xl">
              {!fighter && <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-400 flex items-center gap-2"><i className="ri-information-line"></i>{t('dash_ach_save_first')}</div>}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">{t('dash_ach_add')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input value={achTitle} onChange={(e) => setAchTitle(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('dash_ach_title_ph')} disabled={!fighter} />
                  <input type="number" value={achYear} onChange={(e) => setAchYear(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('dash_ach_year_ph')} disabled={!fighter} />
                  <div className="flex gap-2">
                    <input value={achDesc} onChange={(e) => setAchDesc(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('dash_ach_desc_ph')} disabled={!fighter} />
                    <button onClick={addAchievement} disabled={!fighter || !achTitle.trim()} className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 rounded-xl transition-colors cursor-pointer whitespace-nowrap"><i className="ri-add-line"></i></button>
                  </div>
                </div>
              </div>
              {achievements.length === 0 ? (
                <div className="text-center py-16 text-zinc-500"><div className="w-16 h-16 flex items-center justify-center mx-auto mb-4"><i className="ri-medal-line text-4xl"></i></div><p className="text-sm">{t('dash_ach_empty')}</p></div>
              ) : (
                <div className="space-y-3">
                  {achievements.map((a) => (
                    <div key={a.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 group">
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400 flex-shrink-0"><i className="ri-medal-line text-lg"></i></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{a.title}</p>
                        {a.year && <p className="text-xs text-zinc-500">{a.year}</p>}
                        {a.description && <p className="text-xs text-zinc-400 mt-0.5">{a.description}</p>}
                      </div>
                      <button onClick={() => deleteAchievement(a.id)} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"><i className="ri-delete-bin-line"></i></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-lg space-y-4">
              {/* Acceso rápido móvil a tabs secundarios */}
              <div className="lg:hidden grid grid-cols-3 gap-2 mb-2">
                {[
                  { id: 'videos' as ActiveTab, label: t('dash_tab_videos'), icon: 'ri-video-line' },
                  { id: 'achievements' as ActiveTab, label: t('dash_tab_achievements'), icon: 'ri-medal-line' },
                  { id: 'verification' as ActiveTab, label: t('dash_tab_verification'), icon: 'ri-shield-line' },
                ].map((tb) => (
                  <button key={tb.id} onClick={() => setActiveTab(tb.id)} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col items-center gap-1 text-zinc-300 hover:text-white cursor-pointer">
                    <i className={`${tb.icon} text-lg`}></i>
                    <span className="text-[10px]">{tb.label}</span>
                  </button>
                ))}
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">{t('dash_settings_account')}</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                    <div><p className="text-sm text-white">{t('dash_settings_type')}</p><p className="text-xs text-zinc-500">{t('dash_fighter_label')}</p></div>
                    <span className="text-xs bg-red-600/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full">{t('dash_settings_active')}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                    <div><p className="text-sm text-white">{t('dash_settings_availability')}</p><p className="text-xs text-zinc-500">{t('dash_settings_availability_desc')}</p></div>
                    <button type="button" onClick={() => setIsAvailable(!isAvailable)} className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${isAvailable ? 'bg-red-600' : 'bg-zinc-700'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isAvailable ? 'left-7' : 'left-1'}`}></span>
                    </button>
                  </div>
                  {fighter && (
                    <div className="py-3">
                      <p className="text-sm text-white mb-1">{t('dash_settings_public_profile')}</p>
                      <p className="text-xs text-zinc-500 mb-2">{t('dash_settings_share_desc')}</p>
                      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5">
                        <span className="text-xs text-zinc-400 flex-1 truncate">/fighter/{fighter.id}</span>
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/fighter/${fighter.id}`); showToast(t('dash_settings_copied_short')); }} className="text-xs text-red-400 hover:text-red-300 cursor-pointer whitespace-nowrap flex items-center gap-1">
                          <i className="ri-clipboard-line"></i> {t('dash_settings_copy')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {isAvailable !== (fighter?.is_available ?? true) && (
                <button onClick={saveProfile} disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                  {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('dash_saving')}</> : <><i className="ri-save-line"></i> {t('dash_settings_save')}</>}
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}