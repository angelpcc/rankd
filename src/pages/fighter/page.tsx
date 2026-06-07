import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, Fighter, FighterVideo, FighterAchievement } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import FighterProfileHero from './components/FighterProfileHero';
import FighterProfileBody from './components/FighterProfileBody';
import FighterContactModal from './components/FighterContactModal';

export default function FighterPublicPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile: currentUserProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fighter, setFighter] = useState<Fighter | null>(null);
  const [views, setViews] = useState<number>(0);
  const [videos, setVideos] = useState<FighterVideo[]>([]);
  const [achievements, setAchievements] = useState<FighterAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showContact, setShowContact] = useState(false);

  // Solo promotoras y marcas pueden dar "Me interesa"
  const canContact = !user || (currentUserProfile?.user_type !== 'fighter');

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    const load = async () => {
      let fighterData: Fighter | null = null;
      let profileData: Profile | null = null;

      const { data: f1 } = await supabase.from('fighters').select('*').eq('id', id).maybeSingle();
      if (f1) {
        fighterData = f1;
        const { data: p } = await supabase.from('profiles').select('*').eq('id', f1.profile_id).maybeSingle();
        profileData = p;
      } else {
        const { data: f2 } = await supabase.from('fighters').select('*').eq('profile_id', id).maybeSingle();
        if (f2) {
          fighterData = f2;
          const { data: p } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
          profileData = p;
        }
      }

      if (!fighterData) {
        const { data: profileOnly } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
        if (profileOnly && profileOnly.user_type === 'fighter') {
          setProfile(profileOnly);
          setFighter(null);
          setLoading(false);
          return;
        }
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!profileData) { setNotFound(true); setLoading(false); return; }

      const currentViews = fighterData.profile_views ?? 0;
      const newViews = currentViews + 1;
      setViews(newViews);
      supabase.from('fighters').update({ profile_views: newViews }).eq('id', fighterData.id).then(() => {});

      setFighter({ ...fighterData, profile_views: newViews });
      setProfile(profileData);

      const [{ data: vids }, { data: achs }] = await Promise.all([
        supabase.from('fighter_videos').select('*').eq('fighter_id', fighterData.id).order('created_at', { ascending: false }),
        supabase.from('fighter_achievements').select('*').eq('fighter_id', fighterData.id).order('year', { ascending: false }),
      ]);
      setVideos(vids || []);
      setAchievements(achs || []);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleContactClick = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (currentUserProfile?.user_type === 'fighter') return;
    setShowContact(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 flex items-center justify-center rounded-full bg-zinc-100">
          <i className="ri-user-unfollow-line text-3xl text-zinc-400"></i>
        </div>
        <h1 className="text-xl font-bold text-zinc-800">Peleador no encontrado</h1>
        <p className="text-sm text-zinc-500">Este perfil no existe o no está disponible.</p>
        <button onClick={() => navigate('/fighters')} className="mt-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer whitespace-nowrap transition-colors">
          {t('nav_directory')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar */}
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 h-12 sm:h-14 flex items-center justify-between">
          <button onClick={() => navigate('/fighters')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
            <i className="ri-arrow-left-line"></i>
            {t('nav_directory')}
          </button>
          <a href="/" className="flex items-center gap-0 cursor-pointer">
            <span className="font-unbounded font-black tracking-tighter leading-none text-[17px] text-white" style={{ letterSpacing: '-0.04em' }}>RAN</span>
            <span className="font-unbounded font-black tracking-tighter leading-none text-[17px] text-[#E10600]" style={{ letterSpacing: '-0.04em' }}>KD</span>
          </a>
          {/* Botón solo visible para no-peleadores */}
          {canContact ? (
            <button
              onClick={handleContactClick}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-heart-line"></i>
              <span className="hidden sm:inline">Me interesa</span>
            </button>
          ) : (
            <div className="w-20" /> /* Spacer para mantener el logo centrado */
          )}
        </div>
      </div>

      <div className="pt-14">
        <FighterProfileHero
          profile={profile}
          fighter={fighter}
          views={views}
          onContact={handleContactClick}
          canContact={canContact}
        />
        <FighterProfileBody
          profile={profile}
          fighter={fighter}
          videos={videos}
          achievements={achievements}
          views={views}
          onContact={handleContactClick}
          canContact={canContact}
        />
      </div>

      {showContact && (
        <FighterContactModal profile={profile} fighter={fighter} onClose={() => setShowContact(false)} />
      )}
    </div>
  );
}