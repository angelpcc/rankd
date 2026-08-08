import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, Organization, Opportunity } from '@/lib/supabase';
import DashboardNav from './DashboardNav';
import DashSideNav, { type DashNavGroup } from './DashSideNav';
import DashMobileNav from './DashMobileNav';
import PageBreadcrumb from '@/components/base/PageBreadcrumb';
import OrgOpportunities from './OrgOpportunities';
import OrgApplicants from './OrgApplicants';
import OrgFighterSearch from './OrgFighterSearch';
import GymGallery from './GymGallery';
import PromoterEvents from './PromoterEvents';
import GymCoaches from './GymCoaches';
import MessagesPanel from './messages/MessagesPanel';
import VerificationPanel from './VerificationPanel';
import ProfileCompletionBanner from './ProfileCompletionBanner';
import { useOrgCompletion } from '@/hooks/useProfileCompletion';

interface Props { profile: Profile; }

const orgTypeLabelKeys: Record<string, string> = {
  promoter: 'dash_org_type_promoter',
  manager: 'dash_org_type_manager',
  brand: 'dash_org_type_brand',
  gym: 'dash_org_type_gym',
  organizer: 'dash_org_type_organizer',
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

type ActiveTab = 'overview' | 'opportunities' | 'applicants' | 'fighters' | 'gallery' | 'events' | 'coaches' | 'messages' | 'verification' | 'profile';

export default function OrgDashboard({ profile }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [org, setOrg] = useState<Organization | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [events, setEvents] = useState<{ id: string; title: string; event_date: string | null; location: string | null; image_url: string | null }[]>([]);
  const [ticketsByEvent, setTicketsByEvent] = useState<Record<string, number>>({});
  const [ticketsSold, setTicketsSold] = useState(0);
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

    // Eventos reales de la promotora + reservas de entradas.
    // (Antes el panel mostraba un nº de eventos tecleado a mano en el perfil,
    //  mientras la plataforma ya sabe los que tiene de verdad.)
    const { data: evs } = await supabase
      .from('organization_events')
      .select('id, title, event_date, location, image_url')
      .eq('org_profile_id', profile.id)
      .order('event_date', { ascending: true });
    const evList = evs || [];
    setEvents(evList);

    if (evList.length > 0) {
      const { data: orders } = await supabase
        .from('ticket_orders')
        .select('event_id, quantity')
        .in('event_id', evList.map((e) => e.id));
      if (orders) {
        const byEvent: Record<string, number> = {};
        let total = 0;
        orders.forEach((o) => { byEvent[o.event_id] = (byEvent[o.event_id] || 0) + (o.quantity || 0); total += o.quantity || 0; });
        setTicketsByEvent(byEvent);
        setTicketsSold(total);
      }
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

      // supabase no lanza excepción: hay que mirar el error o diríamos
      // "guardado" aunque el guardado hubiera fallado.
      if (org) {
        const { error } = await supabase.from('organizations').update(orgData).eq('id', org.id);
        if (error) { showToast(t('dash_org_save_error'), 'error'); return; }
      } else {
        const { data, error } = await supabase.from('organizations').insert(orgData).select().maybeSingle();
        if (error) { showToast(t('dash_org_save_error'), 'error'); return; }
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
  const typeLabel = t(orgTypeLabelKeys[profile.user_type] || 'dash_org_type_organizer');
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
    ...(isGym ? [{ id: 'coaches' as ActiveTab, label: t('cl_coaches_tab'), icon: 'ri-whistle-line' }] : []),
    ...(isPromoter ? [{ id: 'events' as ActiveTab, label: t('dash_org_tab_events'), icon: 'ri-calendar-event-line' }] : []),
    { id: 'messages', label: t('dash_org_tab_messages'), icon: 'ri-message-3-line', badge: unreadMessages || undefined },
    { id: 'verification', label: t('dash_org_tab_verification'), icon: 'ri-verified-badge-line' },
    { id: 'profile', label: t('dash_org_tab_profile'), icon: 'ri-building-line' },
  ];

  // Barra lateral de escritorio agrupada en acordeón (R15-B1): Resumen suelto
  // arriba y el resto por categorías relacionadas.
  const navGroups: DashNavGroup[] = [
    {
      key: 'actividad', label: t('dash_grp_activity'), icon: 'ri-megaphone-line',
      items: [
        { id: 'opportunities', label: t('dash_org_tab_opportunities'), icon: 'ri-megaphone-line', badge: openOpps.length || undefined },
        ...(isPromoter ? [{ id: 'events', label: t('dash_org_tab_events'), icon: 'ri-calendar-event-line' }] : []),
      ],
    },
    {
      key: 'talento', label: t('dash_grp_talent'), icon: 'ri-group-line',
      items: [
        { id: 'applicants', label: t('dash_org_tab_applicants'), icon: 'ri-user-received-line', badge: totalApplicants || undefined },
        { id: 'fighters', label: t('dash_org_tab_fighters'), icon: 'ri-search-line' },
      ],
    },
    ...(isGym ? [{
      key: 'gimnasio', label: t('dash_grp_gym'), icon: 'ri-building-4-line',
      items: [
        { id: 'gallery', label: t('dash_org_tab_gallery'), icon: 'ri-image-2-line' },
        { id: 'coaches', label: t('cl_coaches_tab'), icon: 'ri-whistle-line' },
      ],
    }] : []),
    {
      key: 'cuenta', label: t('dash_grp_account'), icon: 'ri-settings-3-line',
      items: [
        { id: 'messages', label: t('dash_org_tab_messages'), icon: 'ri-message-3-line', badge: unreadMessages || undefined },
        { id: 'verification', label: t('dash_org_tab_verification'), icon: 'ri-verified-badge-line' },
        { id: 'profile', label: t('dash_org_tab_profile'), icon: 'ri-building-line' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#070707] text-white">
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
        <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 fixed bottom-0 left-0 z-30 overflow-y-auto" style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }}>
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

          {/* Nav agrupada en acordeón (R15-B1) */}
          <DashSideNav
            topItem={{ id: 'overview', label: t('dash_org_tab_overview'), icon: 'ri-dashboard-line' }}
            groups={navGroups}
            activeId={activeTab}
            onSelect={(id) => setActiveTab(id as ActiveTab)}
          />

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

        {/* ── MOBILE TABS ── (R16: barra con botón "Más" para no esconder secciones) */}
        <DashMobileNav tabs={tabs} activeId={activeTab} onSelect={(id) => setActiveTab(id as ActiveTab)} />

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 lg:ml-56 px-4 md:px-6 lg:px-8 py-8 pb-24 lg:pb-8 max-w-full overflow-x-hidden">

          {/* Migas de pan: en qué sección del panel estoy y cómo volver (bloque 4). */}
          {activeTab !== 'overview' && (
            <PageBreadcrumb
              root={t('dash_here_root')}
              section={tabs.find((tb) => tb.id === activeTab)?.label}
              onRoot={() => setActiveTab('overview')}
            />
          )}

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl">
              {/* Hero cinematográfico: identidad de la organización de un vistazo */}
              <div className="rk-card relative overflow-hidden anim-fade-up" style={{ padding: 0, transform: 'none' }}>
                <div className="rk-glow-red" style={{ width: 340, height: 340, top: -160, right: -80, borderRadius: '50%' }} />
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(115deg, rgba(225,6,0,0.10) 0%, transparent 42%)' }} />
                <div className="relative flex items-center gap-4 sm:gap-5 p-5 sm:p-7">
                  <div className={`w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-2xl border-2 flex-shrink-0 ${typeBg}`} style={{ fontSize: 40 }}>
                    <i className={typeIcon}></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="rk-eyebrow">{typeLabel}</p>
                    <h1 className="rk-h2 truncate" style={{ fontSize: 'clamp(1.7rem,5vw,2.6rem)', color: '#fff', margin: '2px 0 0', lineHeight: 0.95 }}>
                      {(orgName || profile.full_name || typeLabel).toUpperCase()}
                    </h1>
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${isPublic ? 'text-green-400 bg-green-500/10 border-green-500/25' : 'text-amber-400 bg-amber-500/10 border-amber-500/25'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isPublic ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
                        {isPublic ? t('dash_org_visible_short') : t('dash_org_hidden_short')}
                      </span>
                      {org?.verified && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C9A84C] bg-[#C9A84C]/12 border border-[#C9A84C]/30 px-2.5 py-1 rounded-full">
                          <i className="ri-verified-badge-line"></i> {t('dash_org_verified')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
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
                    // Dato REAL (contado de organization_events), no el número
                    // que el usuario teclea en su perfil.
                    label: t('dash_org_events_published'),
                    value: events.length,
                    icon: 'ri-calendar-event-line',
                    color: 'text-emerald-400',
                    bg: 'bg-emerald-500/10 border-emerald-500/20',
                    action: () => setActiveTab(isPromoter ? 'events' : 'profile'),
                  },
                ].map((kpi) => (
                  <button
                    key={kpi.label}
                    onClick={kpi.action}
                    className="rk-card p-5 text-left cursor-pointer"
                  >
                    <div className={`w-9 h-9 flex items-center justify-center rounded-xl border mb-3 ${kpi.bg} ${kpi.color}`}>
                      <i className={`${kpi.icon} text-lg`}></i>
                    </div>
                    <p className={kpi.color} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1 }}>{kpi.value}</p>
                    <p className="text-[11px] text-zinc-400 mt-1.5 uppercase tracking-wider leading-tight">{kpi.label}</p>
                  </button>
                ))}
              </div>

              {/* Próximos eventos + reservas de entradas (datos reales) */}
              {(isPromoter || events.length > 0) && (
                <div className="rk-card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] gap-3">
                    <div className="min-w-0">
                      <h2 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('dash_org_upcoming_events')}</h2>
                      {ticketsSold > 0 && (
                        <p className="text-xs text-zinc-400 mt-0.5">{ticketsSold === 1 ? t('dash_org_tickets_total_one', { n: ticketsSold }) : t('dash_org_tickets_total_many', { n: ticketsSold })}</p>
                      )}
                    </div>
                    {isPromoter && (
                      <button onClick={() => setActiveTab('events')} className="text-xs text-red-400 hover:text-red-300 cursor-pointer whitespace-nowrap flex items-center gap-1 flex-shrink-0">
                        {t('dash_org_manage')} <i className="ri-arrow-right-line"></i>
                      </button>
                    )}
                  </div>
                  {(() => {
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const upcoming = events.filter((e) => !e.event_date || new Date(e.event_date + 'T12:00:00') >= today).slice(0, 4);
                    if (events.length === 0) {
                      return (
                        <div className="text-center py-10 px-6">
                          <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25">
                            <i className="ri-calendar-event-line text-2xl text-red-400"></i>
                          </div>
                          <p className="text-sm text-zinc-300 font-medium">{t('dash_org_no_events_title')}</p>
                          <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">{t('dash_org_no_events_desc')}</p>
                          {isPromoter && (
                            <button onClick={() => setActiveTab('events')} className="rk-btn rk-btn-primary mt-4" style={{ fontSize: '0.8rem', padding: '0.6rem 1.3rem' }}>{t('dash_org_create_first_event')}</button>
                          )}
                        </div>
                      );
                    }
                    if (upcoming.length === 0) {
                      return (
                        <div className="text-center py-9 px-6">
                          <p className="text-sm text-zinc-300">{t('dash_org_all_past_title')}</p>
                          <p className="text-xs text-zinc-500 mt-1">{t('dash_org_all_past_desc')}</p>
                        </div>
                      );
                    }
                    return (
                      <div className="divide-y divide-white/[0.06]">
                        {upcoming.map((ev) => {
                          const sold = ticketsByEvent[ev.id] || 0;
                          const d = ev.event_date ? new Date(ev.event_date + 'T12:00:00') : null;
                          const days = d ? Math.ceil((d.getTime() - today.getTime()) / 86400000) : null;
                          return (
                            <div key={ev.id} className="flex items-center gap-3 px-5 py-3.5">
                              {ev.image_url ? (
                                <img src={ev.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center flex-shrink-0"><i className="ri-sword-line text-zinc-500 text-sm"></i></div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium truncate">{ev.title}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {d && <span className="text-xs text-zinc-500">{d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>}
                                  {days !== null && days >= 0 && <span className="text-xs text-zinc-600">· {days === 0 ? t('dash_org_ev_today') : days === 1 ? t('dash_org_ev_in_days_one') : t('dash_org_ev_in_days', { n: days })}</span>}
                                  {ev.location && <span className="text-xs text-zinc-600 truncate">· {ev.location}</span>}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, lineHeight: 1 }} className={sold > 0 ? 'text-[#C9A84C]' : 'text-zinc-600'}>{sold}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('dash_org_tickets_label')}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Recent opportunities */}
              <div className="rk-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                  <h2 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('dash_org_recent_opps')}</h2>
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
                  <div className="divide-y divide-white/[0.06]">
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
                    className="rk-card p-4 text-left cursor-pointer group"
                  >
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400 mb-3 group-hover:bg-red-600/20 transition-colors">
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
                <h2 className="rk-h3 text-white">{t('dash_org_applicants_title')}</h2>
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

          {/* ── COACHES TAB (gym only) ── */}
          {activeTab === 'coaches' && isGym && (
            <div className="max-w-5xl">
              <GymCoaches profile={profile} showToast={showToast} />
            </div>
          )}

          {/* ── MESSAGES TAB ── */}
          {activeTab === 'messages' && (
            <div className="max-w-6xl">
              <div className="mb-5">
                <h2 className="rk-h3 text-white">{t('dash_org_messages_title')}</h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_org_messages_desc')}</p>
              </div>
              <MessagesPanel currentUserId={profile.id} />
            </div>
          )}

          {/* ── VERIFICATION TAB ── */}
          {activeTab === 'verification' && (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h2 className="rk-h3 text-white flex items-center gap-2">
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
                <h2 className="rk-h3 text-white">{t('dash_org_profile_title')}</h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_org_profile_desc')}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Org info */}
                <div className="rk-card p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-white">{t('dash_org_info_title')}</h3>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_name_label')}</label>
                    <input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                      placeholder="..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_contact_label')}</label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                      placeholder="..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_desc_label')}</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none"
                      placeholder="..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_bio_label')}</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none"
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
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        placeholder="2010"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_location_label')}</label>
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        placeholder="Madrid, España"
                      />
                    </div>
                  </div>
                </div>

                {/* Stats & Social */}
                <div className="space-y-5">
                  <div className="rk-card p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white">{t('dash_org_stats_title')}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_org_events_label')}</label>
                        <input
                          type="number"
                          min="0"
                          value={eventsOrganized}
                          onChange={(e) => setEventsOrganized(e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
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
                          className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rk-card p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white">{t('dash_org_contact_social')}</h3>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-global-line mr-1"></i>{t('dash_org_website_label')}</label>
                      <input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-instagram-line mr-1"></i>Instagram</label>
                      <input
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        placeholder="@..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-twitter-x-line mr-1"></i>Twitter / X</label>
                      <input
                        value={twitter}
                        onChange={(e) => setTwitter(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                        placeholder="@..."
                      />
                    </div>
                  </div>

                  {/* Verification status */}
                  <div className="rk-card p-5">
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
                    className="rk-btn rk-btn-primary w-full disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ fontSize: '1rem' }}
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