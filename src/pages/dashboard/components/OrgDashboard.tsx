import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, Organization, Opportunity } from '@/lib/supabase';
import DashboardNav from './DashboardNav';
import OrgOpportunities from './OrgOpportunities';
import OrgApplicants from './OrgApplicants';
import OrgFighterSearch from './OrgFighterSearch';
import GymGallery from './GymGallery';
import PromoterEvents from './PromoterEvents';
import MessagesPanel from './messages/MessagesPanel';
import VerificationPanel from './VerificationPanel';
import ProfileCompletionBanner from './ProfileCompletionBanner';
import { useOrgCompletion } from '@/hooks/useProfileCompletion';

interface Props { profile: Profile; }

const orgTypeLabels: Record<string, string> = {
  promoter: 'Promotora',
  manager: 'Manager',
  brand: 'Marca',
  gym: 'Gimnasio / Club',
  organizer: 'Organizador',
};
const orgTypeIcons: Record<string, string> = {
  promoter: 'ri-trophy-line',
  manager: 'ri-user-star-line',
  brand: 'ri-store-2-line',
  gym: 'ri-building-4-line',
  organizer: 'ri-calendar-event-line',
};
const orgTypeBg: Record<string, string> = {
  promoter: 'bg-red-500/10 border-red-500/20 text-red-400',
  manager: 'bg-zinc-700 border-zinc-600 text-zinc-300',
  brand: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  gym: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  organizer: 'bg-zinc-700 border-zinc-600 text-zinc-300',
};

type ActiveTab = 'overview' | 'opportunities' | 'applicants' | 'fighters' | 'gallery' | 'events' | 'messages' | 'verification' | 'profile';

export default function OrgDashboard({ profile }: Props) {
  const { t } = useTranslation();
  const [org, setOrg] = useState<Organization | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
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


  // Profile fields
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [website, setWebsite] = useState(profile.website || '');
  const [instagram, setInstagram] = useState(profile.instagram || '');
  const [twitter, setTwitter] = useState(profile.twitter || '');
  const [orgName, setOrgName] = useState('');
  const [description, setDescription] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [eventsOrganized, setEventsOrganized] = useState('0');
  const [fightersManaged, setFightersManaged] = useState('0');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    const [{ data: orgData }, { data: opps }] = await Promise.all([
      supabase.from('organizations').select('*').eq('profile_id', profile.id).maybeSingle(),
      supabase.from('opportunities').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }),
    ]);

    if (orgData) {
      setOrg(orgData);
      setOrgName(orgData.org_name || '');
      setDescription(orgData.description || '');
      setFoundedYear(orgData.founded_year?.toString() || '');
      setEventsOrganized(orgData.events_organized?.toString() || '0');
      setFightersManaged(orgData.fighters_managed?.toString() || '0');
      setIsPublic((orgData as Organization & { is_public?: boolean }).is_public ?? false);
    }

    const oppList = opps || [];
    setOpportunities(oppList);

    if (oppList.length > 0) {
      const ids = oppList.map((o) => o.id);
      const { count } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .in('opportunity_id', ids);
      setTotalApplicants(count || 0);
    }

    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Validation before publishing
  const canPublish = (): { ok: boolean; reason?: string } => {
    if (!orgName.trim()) return { ok: false, reason: t('dash_org_validation_name') };
    if (!location.trim()) return { ok: false, reason: t('dash_org_validation_location') };
    return { ok: true };
  };

  const publishOrg = async () => {
    if (!org) return;
    if (!isPublic) {
      const check = canPublish();
      if (!check.ok) {
        showToast(check.reason || t('dash_org_validation_incomplete'), 'error');
        setActiveTab('profile');
        return;
      }
    }
    setPublishing(true);
    try {
      const newState = !isPublic;
      const { error } = await supabase
        .from('organizations')
        .update({ is_public: newState, updated_at: new Date().toISOString() })
        .eq('id', org.id);
      if (error) throw error;
      setIsPublic(newState);
      showToast(t('dash_org_published_ok'));
    } catch {
      showToast(t('dash_visibility_error'), 'error');
    } finally {
      setPublishing(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await supabase.from('profiles').update({
        full_name: fullName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        instagram: instagram.trim(),
        twitter: twitter.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);

      const orgData = {
        profile_id: profile.id,
        org_name: orgName.trim() || fullName.trim(),
        org_type: profile.user_type,
        description: description.trim(),
        founded_year: foundedYear ? parseInt(foundedYear, 10) : null,
        events_organized: parseInt(eventsOrganized, 10) || 0,
        fighters_managed: parseInt(fightersManaged, 10) || 0,
        updated_at: new Date().toISOString(),
      };

      if (org) {
        await supabase.from('organizations').update(orgData).eq('id', org.id);
      } else {
        const { data } = await supabase.from('organizations').insert(orgData).select().maybeSingle();
        setOrg(data);
      }
      showToast(t('dash_org_saved_ok'));
    } catch {
      showToast(t('dash_org_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Hooks must be before any early return
  const orgCompletion = useOrgCompletion(profile, orgName, description);
  const typeLabel = orgTypeLabels[profile.user_type] || profile.user_type;
  const typeIcon = orgTypeIcons[profile.user_type] || 'ri-building-line';
  const typeBg = orgTypeBg[profile.user_type] || 'bg-zinc-700 border-zinc-600 text-zinc-300';
  const openOpps = opportunities.filter((o) => o.status === 'open');

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isGym = profile.user_type === 'gym';
  const isPromoter = profile.user_type === 'promoter';

  const tabs: { id: ActiveTab; label: string; icon: string; badge?: number }[] = [
    { id: 'overview', label: t('dash_org_tab_overview'), icon: 'ri-dashboard-line' },
    { id: 'opportunities', label: t('dash_org_tab_opportunities'), icon: 'ri-megaphone-line', badge: openOpps.length || undefined },
    { id: 'applicants', label: t('dash_org_tab_applicants'), icon: 'ri-user-received-line', badge: totalApplicants || undefined },
    { id: 'fighters', label: t('dash_org_tab_fighters'), icon: 'ri-search-line' },
    ...(isGym ? [{ id: 'gallery' as ActiveTab, label: t('dash_org_tab_gallery'), icon: 'ri-image-2-line' }] : []),
    ...(isPromoter ? [{ id: 'events' as ActiveTab, label: t('dash_org_tab_events'), icon: 'ri-calendar-event-line' }] : []),
    { id: 'messages', label: t('dash_org_tab_messages'), icon: 'ri-message-3-line', badge: unreadMessages || undefined },
    { id: 'verification', label: t('dash_org_tab_verification'), icon: 'ri-verified-badge-line' },
    { id: 'profile', label: t('dash_org_tab_profile'), icon: 'ri-building-line' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashboardNav profile={profile} />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 text-white text-sm px-5 py-3 rounded-xl flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          <i className={toast.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'}></i>
          {toast.msg}
        </div>
      )}

      <div className="pt-16 flex min-h-screen">
        {/* ── SIDEBAR ── */}
        <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 fixed top-16 bottom-0 left-0 z-30 overflow-y-auto">
          {/* Org identity */}
          <div className="p-5 border-b border-zinc-800">
            <div className={`w-12 h-12 flex items-center justify-center rounded-xl border text-xl mb-3 ${typeBg}`}>
              <i className={typeIcon}></i>
            </div>
            <p className="text-sm font-semibold text-white truncate">{orgName || profile.full_name || t('dash_org_tab_profile')}</p>
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border mt-1 ${typeBg}`}>
              {typeLabel}
            </span>
            {org?.verified && (
              <div className="flex items-center gap-1 text-xs text-green-400 mt-2">
                <i className="ri-verified-badge-line"></i> {t('dash_org_verified')}
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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

          {/* Quick action */}
          <div className="p-3 border-t border-zinc-800">
            <button
              onClick={() => setActiveTab('opportunities')}
              className="w-full flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i>
              {t('dash_org_new_opp')}
            </button>
          </div>
        </aside>

        {/* ── MOBILE TABS ── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-800 flex">
          {tabs.slice(0, 4).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors cursor-pointer relative ${activeTab === tab.id ? 'text-red-400' : 'text-zinc-500'}`}
            >
              <i className={`${tab.icon} text-lg`}></i>
              <span className="hidden sm:block">{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute top-1.5 right-1/4 w-4 h-4 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 lg:ml-56 px-4 md:px-6 lg:px-8 py-8 pb-24 lg:pb-8 max-w-full overflow-x-hidden">

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl">
              {/* Welcome */}
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {t('dash_org_welcome')} {profile.full_name?.split(' ')[0] || typeLabel}
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  {t('dash_org_panel')} · {typeLabel}
                </p>
              </div>

              {/* Visibility banner */}
              {org && !isPublic && (
                <div className="rounded-2xl overflow-hidden border-2 border-amber-500/50">
                  <div className="bg-amber-500/15 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-amber-500/25 text-amber-400 flex-shrink-0">
                        <i className="ri-eye-off-line text-xl"></i>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-amber-300">{t('dash_org_private_title')}</p>
                        <p className="text-xs text-amber-400/80 mt-0.5">{t('dash_org_private_desc')}</p>
                      </div>
                    </div>
                    <button
                      onClick={publishOrg}
                      disabled={publishing}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-900 text-sm font-bold px-5 py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex-shrink-0 w-full sm:w-auto justify-center"
                    >
                      {publishing ? <><div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div> {t('dash_org_saving')}</> : <><i className="ri-eye-line text-base"></i> {t('dash_org_private_cta')}</>}
                    </button>
                  </div>
                </div>
              )}
              {org && isPublic && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/20 text-green-400 flex-shrink-0">
                      <i className="ri-eye-line"></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-300">{t('dash_org_visible_title')}</p>
                      <p className="text-xs text-green-400/70">{t('dash_org_visible_desc')}</p>
                    </div>
                  </div>
                  <button
                    onClick={publishOrg}
                    disabled={publishing}
                    className="text-xs text-zinc-400 hover:text-red-400 cursor-pointer whitespace-nowrap transition-colors disabled:opacity-60"
                  >
                    {publishing ? t('dash_org_saving') : t('dash_org_hide')}
                  </button>
                </div>
              )}

              {/* Profile completion banner */}
              <ProfileCompletionBanner
                completion={orgCompletion}
                onComplete={() => setActiveTab('profile')}
                userType={profile.user_type}
              />

              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: t('dash_org_active_opps'),
                    value: openOpps.length,
                    icon: 'ri-megaphone-line',
                    color: 'text-red-400',
                    bg: 'bg-red-500/10 border-red-500/20',
                    action: () => setActiveTab('opportunities'),
                  },
                  {
                    label: t('dash_org_total_applicants'),
                    value: totalApplicants,
                    icon: 'ri-user-received-line',
                    color: 'text-orange-400',
                    bg: 'bg-orange-500/10 border-orange-500/20',
                    action: () => setActiveTab('applicants'),
                  },
                  {
                    label: t('dash_org_total_opps'),
                    value: opportunities.length,
                    icon: 'ri-file-list-3-line',
                    color: 'text-zinc-300',
                    bg: 'bg-zinc-800 border-zinc-700',
                    action: () => setActiveTab('opportunities'),
                  },
                  {
                    label: profile.user_type === 'manager' ? t('dash_org_fighters_label') : profile.user_type === 'gym' ? t('dash_org_athletes_label') : t('dash_org_collab_label'),
                    value: parseInt(fightersManaged, 10) || 0,
                    icon: 'ri-group-line',
                    color: 'text-emerald-400',
                    bg: 'bg-emerald-500/10 border-emerald-500/20',
                    action: () => setActiveTab('fighters'),
                  },
                ].map((kpi) => (
                  <button
                    key={kpi.label}
                    onClick={kpi.action}
                    className={`${kpi.bg} border rounded-2xl p-5 text-left hover:opacity-80 transition-opacity cursor-pointer`}
                  >
                    <div className={`w-8 h-8 flex items-center justify-center mb-3 ${kpi.color}`}>
                      <i className={`${kpi.icon} text-xl`}></i>
                    </div>
                    <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-xs text-zinc-400 mt-1 leading-tight">{kpi.label}</p>
                  </button>
                ))}
              </div>

              {/* Recent opportunities */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                  <h2 className="text-sm font-semibold text-white">{t('dash_org_recent_opps')}</h2>
                  <button
                    onClick={() => setActiveTab('opportunities')}
                    className="text-xs text-red-400 hover:text-red-300 cursor-pointer whitespace-nowrap flex items-center gap-1"
                  >
                    {t('dash_org_view_all')} <i className="ri-arrow-right-line"></i>
                  </button>
                </div>
                {opportunities.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-zinc-500 text-sm">{t('dash_org_no_opps')}</p>
                    <button
                      onClick={() => setActiveTab('opportunities')}
                      className="mt-3 text-xs text-red-400 hover:text-red-300 cursor-pointer whitespace-nowrap"
                    >
                      {t('dash_org_create_first')}
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800">
                    {opportunities.slice(0, 5).map((opp) => (
                      <div key={opp.id} className="flex items-center gap-4 px-5 py-3.5">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${opp.status === 'open' ? 'bg-green-400' : 'bg-zinc-600'}`}></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{opp.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-zinc-500 capitalize">{opp.type}</span>
                            {opp.location && <span className="text-xs text-zinc-600">· {opp.location}</span>}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${opp.status === 'open' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                          {opp.status === 'open' ? t('dash_org_open') : t('dash_org_closed')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: t('dash_org_quick_publish'), icon: 'ri-add-circle-line', desc: t('dash_org_quick_publish_desc'), action: () => setActiveTab('opportunities') },
                  { label: t('dash_org_quick_applicants'), icon: 'ri-user-received-line', desc: `${totalApplicants} ${t('dash_org_total_applicants').toLowerCase()}`, action: () => setActiveTab('applicants') },
                  { label: t('dash_org_quick_fighters'), icon: 'ri-search-line', desc: t('dash_org_quick_fighters_desc'), action: () => setActiveTab('fighters') },
                  ...(isGym ? [{ label: t('dash_org_quick_gallery'), icon: 'ri-image-2-line', desc: t('dash_org_quick_gallery_desc'), action: () => setActiveTab('gallery') }] : []),
                  ...(isPromoter ? [{ label: t('dash_org_quick_events'), icon: 'ri-calendar-event-line', desc: t('dash_org_quick_events_desc'), action: () => setActiveTab('events') }] : []),
                ].map((qa) => (
                  <button
                    key={qa.label}
                    onClick={qa.action}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:border-zinc-600 transition-colors cursor-pointer group"
                  >
                    <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-800 text-red-400 mb-3 group-hover:bg-red-600/20 transition-colors">
                      <i className={`${qa.icon} text-lg`}></i>
                    </div>
                    <p className="text-sm font-semibold text-white">{qa.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{qa.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── OPPORTUNITIES TAB ── */}
          {activeTab === 'opportunities' && (
            <div className="max-w-4xl">
              <OrgOpportunities profile={profile} showToast={showToast} onDataChange={loadData} />
            </div>
          )}

          {/* ── APPLICANTS TAB ── */}
          {activeTab === 'applicants' && (
            <div className="max-w-5xl">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-white">{t('dash_org_applicants_title')}</h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_org_applicants_desc')}</p>
              </div>
              <OrgApplicants opportunities={opportunities} showToast={showToast} onOpenMessages={() => setActiveTab('messages')} />
            </div>
          )}

          {/* ── FIGHTERS TAB ── */}
          {activeTab === 'fighters' && (
            <div className="max-w-5xl">
              <OrgFighterSearch showToast={showToast} onOpenMessages={() => setActiveTab('messages')} />
            </div>
          )}

          {/* ── GALLERY TAB (gym only) ── */}
          {activeTab === 'gallery' && isGym && (
            <div className="max-w-5xl">
              <GymGallery profile={profile} showToast={showToast} />
            </div>
          )}

          {/* ── EVENTS TAB (promoter only) ── */}
          {activeTab === 'events' && isPromoter && (
            <div className="max-w-5xl">
              <PromoterEvents profile={profile} showToast={showToast} />
            </div>
          )}

          {/* ── MESSAGES TAB ── */}
          {activeTab === 'messages' && (
            <div className="max-w-6xl">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-white">{t('dash_org_messages_title')}</h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_org_messages_desc')}</p>
              </div>
              <MessagesPanel currentUserId={profile.id} />
            </div>
          )}

          {/* ── VERIFICATION TAB ── */}
          {activeTab === 'verification' && (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {t('dash_org_verification_title')}
                  {profile.verified && <i className="ri-verified-badge-fill text-red-400"></i>}
                </h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_org_verification_desc')}</p>
              </div>
              <VerificationPanel profile={profile} showToast={showToast} onUpdate={loadData} />
            </div>
          )}

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profile' && (
            <div className="max-w-4xl">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white">{t('dash_org_profile_title')}</h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_org_profile_desc')}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Org info */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-white">{t('dash_org_info_title')}</h3>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_name_label')}</label>
                    <input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                      placeholder="..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_contact_label')}</label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                      placeholder="..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_desc_label')}</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none"
                      placeholder="..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_bio_label')}</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none"
                      placeholder="..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_founded_label')}</label>
                      <input
                        type="number"
                        value={foundedYear}
                        onChange={(e) => setFoundedYear(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        placeholder="2010"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_location_label')}</label>
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        placeholder="Madrid, España"
                      />
                    </div>
                  </div>
                </div>

                {/* Stats & Social */}
                <div className="space-y-5">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white">{t('dash_org_stats_title')}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_events_label')}</label>
                        <input
                          type="number"
                          min="0"
                          value={eventsOrganized}
                          onChange={(e) => setEventsOrganized(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">
                          {profile.user_type === 'manager' ? t('dash_org_fighters_label') : profile.user_type === 'gym' ? t('dash_org_athletes_label') : t('dash_org_collab_label')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={fightersManaged}
                          onChange={(e) => setFightersManaged(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white">{t('dash_org_contact_social')}</h3>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-global-line mr-1"></i>{t('dash_org_website_label')}</label>
                      <input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-instagram-line mr-1"></i>Instagram</label>
                      <input
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        placeholder="@..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-twitter-x-line mr-1"></i>Twitter / X</label>
                      <input
                        value={twitter}
                        onChange={(e) => setTwitter(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        placeholder="@..."
                      />
                    </div>
                  </div>

                  {/* Verification status */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{t('dash_org_verification_status')}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{t('dash_org_verification_contact')}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${org?.verified ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                        {org?.verified ? t('dash_org_verified') : t('dash_org_pending')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {saving
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('dash_saving')}</>
                      : <><i className="ri-save-line"></i> {t('dash_org_save_profile')}</>
                    }
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}