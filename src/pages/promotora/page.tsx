import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, Organization, OrgEvent } from '@/lib/supabase';
import { useSEO } from '@/hooks/useSEO';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';
import ReviewsPanel from '@/components/feature/ReviewsPanel';

const typeKey: Record<string, string> = { promoter: 'Promotora', gym: 'Gimnasio', manager: 'Manager', organizer: 'Organizador' };

export default function PromotoraPublicPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [rating, setRating] = useState<{ avg: number; n: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useSEO({ title: org ? `${org.org_name} | RANKD` : 'RANKD', description: org?.description || 'Perfil en RANKD.' });

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (!prof || prof.user_type === 'brand' || prof.user_type === 'fighter') { setNotFound(true); setLoading(false); return; }
      setProfile(prof);
      const [{ data: o }, { data: evs }, { data: rat }] = await Promise.all([
        supabase.from('organizations').select('*').eq('profile_id', id).maybeSingle(),
        supabase.from('organization_events').select('*').eq('org_profile_id', id).order('event_date', { ascending: true }),
        supabase.from('org_rating_summary').select('avg_rating, review_count').eq('org_profile_id', id).maybeSingle(),
      ]);
      setOrg(o);
      setEvents(((evs || []) as OrgEvent[]).filter((e) => e.status !== 'draft'));
      if (rat) setRating({ avg: Number(rat.avg_rating) || 0, n: rat.review_count || 0 });
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-[#070707]"><Navbar /><div className="flex items-center justify-center" style={{ minHeight: '70vh' }}><div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div></div>;
  }
  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#070707]"><Navbar />
        <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: '70vh' }}>
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 mb-5"><i className="ri-building-line text-2xl text-red-400" /></div>
          <h1 className="rk-h3 text-white">{t('pp_not_found')}</h1>
          <p className="text-sm text-zinc-400 mt-2">{t('pp_not_found_desc')}</p>
          <button onClick={() => navigate('/promotoras')} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem' }}>{t('pp_back')}</button>
        </div>
      </div>
    );
  }

  const name = org?.org_name || profile.full_name || '—';
  const tLabel = typeKey[profile.user_type] || profile.user_type;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = events.filter((e) => !e.event_date || new Date(e.event_date + 'T12:00:00') >= today);
  const past = events.filter((e) => e.event_date && new Date(e.event_date + 'T12:00:00') < today);

  const EventCardMini = ({ e }: { e: OrgEvent }) => (
    <button onClick={() => navigate(`/evento/${e.id}`)} className="rk-card text-left flex items-center gap-3 cursor-pointer" style={{ padding: 12 }}>
      {e.image_url ? <img src={e.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-white/10 flex-shrink-0" />
        : <div className="w-12 h-12 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center flex-shrink-0"><i className="ri-sword-line text-zinc-500" /></div>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{e.title}</p>
        <p className="text-xs text-zinc-500">{e.event_date ? new Date(e.event_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}{e.location ? ` · ${e.location}` : ''}</p>
      </div>
      <i className="ri-arrow-right-line text-zinc-600" />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#070707]">
      <Navbar />
      <div className="relative overflow-hidden rk-grid-bg" style={{ background: '#050505', paddingTop: 'calc(60px + env(safe-area-inset-top,0px))' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 80% 30%, rgba(225,6,0,0.14) 0%, transparent 58%)' }} />
        <div className="rk-topline" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 md:px-10 pt-6 pb-8">
          <button onClick={() => navigate('/promotoras')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer mb-6"><i className="ri-arrow-left-line" />{t('pp_back')}</button>
          <div className="flex items-start gap-4 flex-wrap">
            {org?.logo_url || profile.avatar_url ? (
              <img src={org?.logo_url || profile.avatar_url || ''} alt="" className="w-20 h-20 rounded-2xl object-cover border border-white/10 flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center flex-shrink-0"><i className="ri-building-4-line text-3xl text-zinc-500" /></div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="rk-h2" style={{ color: '#fff', margin: 0, fontSize: 'clamp(1.8rem,5vw,2.8rem)' }}>{name}</h1>
                {(org?.verified || profile.verified) && <i className="ri-verified-badge-fill text-green-400 text-xl" title={t('pp_verified')} />}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border text-red-400 bg-red-500/12 border-red-500/30">{tLabel}</span>
                {profile.location && <span className="text-xs text-zinc-400 flex items-center gap-1"><i className="ri-map-pin-line" />{profile.location}</span>}
                {org?.founded_year && <span className="text-xs text-zinc-500 flex items-center gap-1"><i className="ri-time-line" />{t('pp_since')} {org.founded_year}</span>}
                {rating && rating.n > 0 && (
                  <span className="text-xs text-[#C9A84C] flex items-center gap-1"><i className="ri-star-fill" />{rating.avg.toFixed(1)} ({rating.n})</span>
                )}
              </div>
              {profile.website && (
                <a href={profile.website} target="_blank" rel="nofollow noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl transition-colors cursor-pointer">
                  <i className="ri-external-link-line" />{t('pp_visit_web')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8 space-y-8">
        {org?.description && (
          <div className="rk-card" style={{ padding: '20px 22px' }}>
            <h2 className="rk-h3 text-white mb-2" style={{ fontSize: '1rem' }}>{t('pp_about')}</h2>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{org.description}</p>
          </div>
        )}

        <div>
          <h2 className="rk-h3 text-white mb-3" style={{ fontSize: '1.1rem' }}>{t('pp_events')}</h2>
          {events.length === 0 ? (
            <p className="text-sm text-zinc-500">{t('pp_no_events')}</p>
          ) : (
            <div className="space-y-4">
              {upcoming.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-600 mb-2">{t('pp_upcoming_events')}</p>
                  <div className="space-y-2">{upcoming.map((e) => <EventCardMini key={e.id} e={e} />)}</div>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-600 mb-2">{t('pp_past_events')}</p>
                  <div className="space-y-2 opacity-70">{past.slice(0, 6).map((e) => <EventCardMini key={e.id} e={e} />)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <ReviewsPanel orgId={profile.id} />
      </div>
      <Footer />
    </div>
  );
}
