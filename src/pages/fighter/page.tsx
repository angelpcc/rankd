import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, Fighter, FighterVideo, FighterAchievement } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { isMissingTable } from '@/lib/dbState';
import FighterProfileHero from './components/FighterProfileHero';
import FighterProfileBody, { type FightHistoryRow } from './components/FighterProfileBody';
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
  const [history, setHistory] = useState<FightHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

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

      const [{ data: vids }, { data: achs }, { data: bouts, error: boutsErr }] = await Promise.all([
        supabase.from('fighter_videos').select('*').eq('fighter_id', fighterData.id).order('created_at', { ascending: false }),
        supabase.from('fighter_achievements').select('*').eq('fighter_id', fighterData.id).order('year', { ascending: false }),
        // Historial de combates: eventos donde participó como A o B, con datos del evento.
        // Solo combates con result != null (ya se pelearon). Degrada con isMissingTable.
        supabase.from('event_bouts')
          .select('id, fighter_a_profile_id, fighter_a_name, fighter_b_profile_id, fighter_b_name, result, rounds, weight_class, is_main, event:organization_events(id, title, event_date, location)')
          .or(`fighter_a_profile_id.eq.${profileData.id},fighter_b_profile_id.eq.${profileData.id}`)
          .not('result', 'is', null),
      ]);
      setVideos(vids || []);
      setAchievements(achs || []);

      if (isMissingTable(boutsErr) || !bouts) {
        setHistory([]);
      } else {
        const rows = (bouts as unknown as Array<{
          id: string;
          fighter_a_profile_id: string | null; fighter_a_name: string | null;
          fighter_b_profile_id: string | null; fighter_b_name: string | null;
          result: 'a' | 'b' | 'draw' | null; rounds: number | null; weight_class: string | null; is_main: boolean;
          event: { id: string; title: string; event_date: string | null; location: string | null } | null;
        }>).map((b) => {
          const meIsA = b.fighter_a_profile_id === profileData!.id;
          const opponent = (meIsA ? b.fighter_b_name : b.fighter_a_name) || '—';
          const opponentId = meIsA ? b.fighter_b_profile_id : b.fighter_a_profile_id;
          const outcome: 'win' | 'loss' | 'draw' =
            b.result === 'draw' ? 'draw'
            : (b.result === 'a' && meIsA) || (b.result === 'b' && !meIsA) ? 'win' : 'loss';
          return {
            id: b.id, opponent, opponentId,
            outcome, rounds: b.rounds, weightClass: b.weight_class, isMain: b.is_main,
            eventTitle: b.event?.title || null,
            eventDate: b.event?.event_date || null,
            eventLocation: b.event?.location || null,
            eventId: b.event?.id || null,
          };
        }).sort((x, y) => (y.eventDate || '').localeCompare(x.eventDate || ''));
        setHistory(rows);
      }
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

  const handleMessageClick = async () => {
    if (!user) { navigate('/auth'); return; }
    if (currentUserProfile?.user_type === 'fighter' || !profile) return;
    if (startingChat) return;
    setStartingChat(true);
    try {
      const otherId = profile.id;
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(
          `and(participant_1.eq.${user.id},participant_2.eq.${otherId}),and(participant_1.eq.${otherId},participant_2.eq.${user.id})`
        )
        .maybeSingle();
      if (!existing) {
        await supabase.from('conversations').insert({
          participant_1: user.id,
          participant_2: otherId,
          last_message: null,
          last_message_at: new Date().toISOString(),
        });
      }
      navigate('/dashboard?tab=messages');
    } catch {
      setStartingChat(false);
    }
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
      <div className="min-h-screen bg-[#070707] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 flex items-center justify-center rounded-full bg-zinc-100">
          <i className="ri-user-unfollow-line text-3xl text-zinc-400"></i>
        </div>
        <h1 className="text-xl font-bold text-white">Peleador no encontrado</h1>
        <p className="text-sm text-zinc-500">Este perfil no existe o no está disponible.</p>
        <button onClick={() => navigate('/fighters')} className="mt-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer whitespace-nowrap transition-colors">
          {t('nav_directory')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707]">
      {/* Top bar */}
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 h-12 sm:h-14 flex items-center justify-between">
          <button onClick={() => navigate('/fighters')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
            <i className="ri-arrow-left-line"></i>
            {t('nav_directory')}
          </button>
          <a href="/" className="flex items-center gap-0 cursor-pointer py-2">
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
          onMessage={handleMessageClick}
          canMessage={canContact && !!user}
          startingChat={startingChat}
        />
        <FighterProfileBody
          profile={profile}
          fighter={fighter}
          videos={videos}
          achievements={achievements}
          history={history}
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