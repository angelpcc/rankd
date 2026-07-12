import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, Opportunity } from '@/lib/supabase';
import DashboardNav from './DashboardNav';
import OrgOpportunities from './OrgOpportunities';
import BrandTalentSearch from './BrandTalentSearch';
import BrandEventSearch from './BrandEventSearch';
import BrandProducts from './BrandProducts';
import BrandServices from './BrandServices';
import MessagesPanel from './messages/MessagesPanel';
import VerificationPanel from './VerificationPanel';

interface Props { profile: Profile; }

type ActiveTab = 'overview' | 'talent' | 'events' | 'sponsorships' | 'products' | 'services' | 'messages' | 'verification' | 'profile';

const industries = [
  'Equipamiento deportivo', 'Nutrición / Suplementos', 'Ropa deportiva',
  'Tecnología', 'Bebidas', 'Seguros', 'Finanzas', 'Medios / Streaming', 'Otro',
];
const budgetRanges = ['< 1.000€', '1.000€ – 5.000€', '5.000€ – 20.000€', '20.000€ – 50.000€', '> 50.000€'];
const disciplineOptions = ['Boxeo', 'MMA', 'Kickboxing', 'Muay Thai', 'Wrestling', 'BJJ'];

export default function BrandDashboard({ profile }: Props) {
  const { t } = useTranslation();
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandStatus, setBrandStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isPublic, setIsPublic] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Stats
  const [myOpps, setMyOpps] = useState<Opportunity[]>([]);
  const [brandType, setBrandType] = useState<'product' | 'service' | 'both'>('product');

  // Profile fields
  const [brandName, setBrandName] = useState('');
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [website, setWebsite] = useState(profile.website || '');
  const [instagram, setInstagram] = useState(profile.instagram || '');
  const [twitter, setTwitter] = useState(profile.twitter || '');
  const [description, setDescription] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [industry, setIndustry] = useState('');
  const [budget, setBudget] = useState('');
  const [targetDisciplines, setTargetDisciplines] = useState<string[]>([]);
  const [sponsorshipsCount, setSponsorshipsCount] = useState('0');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    const [{ data: orgData }, { data: opps }, { data: brandData }] = await Promise.all([
      supabase.from('organizations').select('*').eq('profile_id', profile.id).maybeSingle(),
      supabase.from('opportunities').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('brands').select('id, type, status').eq('user_id', profile.id).maybeSingle(),
    ]);
    if (orgData) {
      setBrandName(orgData.org_name || '');
      setDescription(orgData.description || '');
      setFoundedYear(orgData.founded_year?.toString() || '');
      setSponsorshipsCount(orgData.fighters_managed?.toString() || '0');
    }
    if (brandData) {
      if (brandData.type) setBrandType(brandData.type as 'product' | 'service' | 'both');
      if (brandData.id) setBrandId(brandData.id);
      if (brandData.status) setBrandStatus(brandData.status as 'pending' | 'approved' | 'rejected');
      setIsPublic(brandData.is_public ?? false);
    }
    setMyOpps(opps || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleDiscipline = (d: string) =>
    setTargetDisciplines((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  // Validation before publishing
  const canPublish = (): { ok: boolean; reason?: string } => {
    if (!brandName.trim()) return { ok: false, reason: t('dash_brand_validation_name') };
    if (!description.trim()) return { ok: false, reason: t('dash_brand_validation_desc') };
    return { ok: true };
  };

  const publishBrand = async () => {
    if (!isPublic) {
      const check = canPublish();
      if (!check.ok) {
        showToast(check.reason || t('dash_brand_validation_incomplete'), 'error');
        setActiveTab('profile');
        return;
      }
    }
    setPublishing(true);
    try {
      const newPublic = !isPublic;
      if (brandId) {
        const { error } = await supabase
          .from('brands')
          .update({ is_public: newPublic, updated_at: new Date().toISOString() })
          .eq('id', brandId);
        if (error) throw error;
      } else {
        // Brand doesn't exist yet — create it first
        const { data: newBrand, error } = await supabase
          .from('brands')
          .insert({
            user_id: profile.id,
            name: brandName.trim() || profile.full_name || 'Mi Marca',
            email: '',
            description: description.trim() || '',
            is_public: true,
            status: 'approved',
            type: brandType,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (newBrand) setBrandId(newBrand.id);
      }
      setIsPublic(newPublic);
      showToast(newPublic ? t('dash_brand_published_ok') : t('dash_brand_hidden_ok'));
    } catch {
      showToast(t('dash_brand_visibility_error'), 'error');
    } finally {
      setPublishing(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await supabase.from('profiles').update({
        full_name: fullName.trim(), bio: bio.trim(), location: location.trim(),
        website: website.trim(), instagram: instagram.trim(), twitter: twitter.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);

      const orgPayload = {
        profile_id: profile.id,
        org_name: brandName.trim() || fullName.trim(),
        org_type: 'brand',
        description: description.trim() || null,
        founded_year: foundedYear ? parseInt(foundedYear, 10) : null,
        fighters_managed: parseInt(sponsorshipsCount, 10) || 0,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase.from('organizations').select('id').eq('profile_id', profile.id).maybeSingle();
      if (existing) {
        await supabase.from('organizations').update(orgPayload).eq('id', existing.id);
      } else {
        await supabase.from('organizations').insert(orgPayload);
      }
      showToast(t('dash_brand_saved_ok'));
    } catch {
      showToast(t('dash_brand_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const openOpps = myOpps.filter((o) => o.status === 'open');

  const tabs: { id: ActiveTab; label: string; icon: string; badge?: number }[] = [
    { id: 'overview',      label: t('dash_brand_tab_overview'),      icon: 'ri-dashboard-line' },
    ...(brandType === 'product' || brandType === 'both'
      ? [{ id: 'products' as ActiveTab, label: t('dash_brand_tab_products'), icon: 'ri-shopping-bag-line' }]
      : []
    ),
    ...(brandType === 'service' || brandType === 'both'
      ? [{ id: 'services' as ActiveTab, label: t('dash_brand_tab_services'), icon: 'ri-service-line' }]
      : []
    ),
    { id: 'talent',        label: t('dash_brand_tab_talent'),        icon: 'ri-user-star-line' },
    { id: 'events',        label: t('dash_brand_tab_events'),        icon: 'ri-calendar-event-line' },
    { id: 'sponsorships',  label: t('dash_brand_tab_sponsorships'),  icon: 'ri-hand-coin-line', badge: openOpps.length || undefined },
    { id: 'messages',      label: t('dash_brand_tab_messages'),      icon: 'ri-message-3-line', badge: unreadMessages || undefined },
    { id: 'verification',  label: t('dash_brand_tab_verification'),  icon: 'ri-vip-crown-line' },
    { id: 'profile',       label: t('dash_brand_tab_profile'),       icon: 'ri-store-2-line' },
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
          {/* Brand identity */}
          <div className="p-5 border-b border-zinc-800">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xl mb-3">
              <i className="ri-store-2-line"></i>
            </div>
            <p className="text-sm font-semibold text-white truncate">{brandName || profile.full_name || t('dash_brand_tab_profile')}</p>
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border mt-1 bg-yellow-500/10 border-yellow-500/20 text-yellow-400">
              {t('dash_brand_label')}
            </span>
            {location && (
              <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                <i className="ri-map-pin-line"></i>{location}
              </p>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${activeTab === tab.id ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
              >
                <i className={`${tab.icon} text-base flex-shrink-0`}></i>
                <span className="flex-1">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === tab.id ? 'bg-yellow-500/30 text-yellow-300' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Quick action */}
          <div className="p-3 border-t border-zinc-800">
            <button
              onClick={() => setActiveTab('talent')}
              className="w-full flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 text-xs font-bold px-3 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-search-line"></i>
              {t('dash_brand_search_athletes')}
            </button>
          </div>
        </aside>

        {/* ── MOBILE BOTTOM NAV ── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-800 flex">
          {tabs.slice(0, 5).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors cursor-pointer relative ${activeTab === tab.id ? 'text-yellow-400' : 'text-zinc-500'}`}
            >
              <i className={`${tab.icon} text-lg`}></i>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute top-1.5 right-1/4 w-4 h-4 bg-yellow-500 text-zinc-900 text-xs rounded-full flex items-center justify-center font-bold">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 lg:ml-56 px-4 md:px-6 lg:px-8 py-8 pb-24 lg:pb-8 max-w-full overflow-x-hidden">

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-5xl">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {t('dash_brand_welcome')} {brandName || profile.full_name?.split(' ')[0] || t('dash_brand_tab_profile')}
                </h1>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_brand_panel')}</p>
              </div>

              {/* Visibility banner */}
              {!isPublic && (
                <div className="rounded-2xl overflow-hidden border-2 border-amber-500/50">
                  <div className="bg-amber-500/15 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-amber-500/25 text-amber-400 flex-shrink-0">
                        <i className="ri-eye-off-line text-xl"></i>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-amber-300">{t('dash_brand_private_title')}</p>
                        <p className="text-xs text-amber-400/80 mt-0.5">{t('dash_brand_private_desc')}</p>
                      </div>
                    </div>
                    <button
                      onClick={publishBrand}
                      disabled={publishing}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-900 text-sm font-bold px-5 py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex-shrink-0 w-full sm:w-auto justify-center"
                    >
                      {publishing ? <><div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div> {t('dash_saving')}</> : <><i className="ri-eye-line text-base"></i> {t('dash_brand_private_cta')}</>}
                    </button>
                  </div>
                </div>
              )}
              {isPublic && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/20 text-green-400 flex-shrink-0">
                      <i className="ri-eye-line"></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-300">{t('dash_brand_visible_title')}</p>
                      <p className="text-xs text-green-400/70">{t('dash_brand_visible_desc')}</p>
                    </div>
                  </div>
                  <button
                    onClick={publishBrand}
                    disabled={publishing}
                    className="text-xs text-zinc-400 hover:text-red-400 cursor-pointer whitespace-nowrap transition-colors disabled:opacity-60"
                  >
                    {publishing ? t('dash_brand_saving') : t('dash_brand_hide')}
                  </button>
                </div>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: t('dash_brand_sponsorships'), value: parseInt(sponsorshipsCount, 10) || 0, icon: 'ri-hand-coin-line', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', action: () => setActiveTab('sponsorships') },
                  { label: t('dash_brand_opps_published'), value: openOpps.length, icon: 'ri-megaphone-line', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', action: () => setActiveTab('sponsorships') },
                  { label: t('dash_brand_disciplines'), value: targetDisciplines.length || '—', icon: 'ri-boxing-line', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', action: () => setActiveTab('talent') },
                  { label: t('dash_brand_status'), value: t('dash_brand_active'), icon: 'ri-checkbox-circle-line', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', action: () => {} },
                ].map((kpi) => (
                  <button key={kpi.label} onClick={kpi.action}
                    className={`${kpi.bg} border rounded-2xl p-5 text-left hover:opacity-80 transition-opacity cursor-pointer`}>
                    <div className={`w-8 h-8 flex items-center justify-center mb-3 ${kpi.color}`}>
                      <i className={`${kpi.icon} text-xl`}></i>
                    </div>
                    <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-xs text-zinc-400 mt-1 leading-tight">{kpi.label}</p>
                  </button>
                ))}
              </div>

              {/* Hero banner */}
              <div className="relative rounded-2xl overflow-hidden">
                <img
                  src="https://readdy.ai/api/search-image?query=professional%20combat%20sports%20athlete%20champion%20fighter%20dramatic%20studio%20lighting%20dark%20background%20powerful%20athletic%20pose%20brand%20sponsorship%20marketing%20campaign%20high%20contrast%20cinematic%20photography&width=1200&height=320&seq=brand-hero-01&orientation=landscape"
                  alt="Brand hero"
                  className="w-full h-44 object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/60 to-transparent flex items-center px-8">
                  <div>
                    <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wider mb-2">{t('dash_brand_discover')}</p>
                    <h2 className="text-xl font-black text-white mb-3">{t('dash_brand_discover_title')}</h2>
                    <button onClick={() => setActiveTab('talent')}
                      className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 text-sm font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-user-star-line"></i>
                      {t('dash_brand_explore_athletes')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {[
                  brandType === 'both'
                    ? { label: t('dash_brand_products_services'), icon: 'ri-store-3-line', desc: t('dash_brand_products_services_desc'), action: () => setActiveTab('products'), accent: 'text-emerald-400', bg: 'hover:border-emerald-500/30' }
                    : brandType === 'product'
                    ? { label: t('dash_brand_products_label'), icon: 'ri-shopping-bag-line', desc: t('dash_brand_products_desc'), action: () => setActiveTab('products'), accent: 'text-yellow-400', bg: 'hover:border-yellow-500/30' }
                    : { label: t('dash_brand_services_label'), icon: 'ri-service-line', desc: t('dash_brand_services_desc'), action: () => setActiveTab('services'), accent: 'text-amber-400', bg: 'hover:border-amber-500/30' },
                  { label: t('dash_brand_talent_label'), icon: 'ri-user-star-line', desc: t('dash_brand_talent_desc'), action: () => setActiveTab('talent'), accent: 'text-orange-400', bg: 'hover:border-orange-500/30' },
                  { label: t('dash_brand_events_label'), icon: 'ri-calendar-event-line', desc: t('dash_brand_events_desc'), action: () => setActiveTab('events'), accent: 'text-sky-400', bg: 'hover:border-sky-500/30' },
                  { label: t('dash_brand_create_opp'), icon: 'ri-add-circle-line', desc: t('dash_brand_create_opp_desc'), action: () => setActiveTab('sponsorships'), accent: 'text-red-400', bg: 'hover:border-red-500/30' },
                ].map((qa) => (
                  <button key={qa.label} onClick={qa.action}
                    className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-left transition-colors cursor-pointer group ${qa.bg}`}>
                    <div className={`w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-800 mb-3 ${qa.accent} group-hover:bg-zinc-700 transition-colors`}>
                      <i className={`${qa.icon} text-lg`}></i>
                    </div>
                    <p className="text-sm font-semibold text-white">{qa.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{qa.desc}</p>
                  </button>
                ))}
              </div>

              {/* Recent sponsorships */}
              {myOpps.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                    <h2 className="text-sm font-semibold text-white">{t('dash_brand_recent_opps')}</h2>
                    <button onClick={() => setActiveTab('sponsorships')}
                      className="text-xs text-yellow-400 hover:text-yellow-300 cursor-pointer whitespace-nowrap flex items-center gap-1">
                      {t('dash_brand_view_all')} <i className="ri-arrow-right-line"></i>
                    </button>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {myOpps.slice(0, 4).map((opp) => (
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
                          {opp.status === 'open' ? t('dash_brand_opp_active') : t('dash_brand_opp_closed')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <i className="ri-lightbulb-line text-yellow-400"></i>
                  {t('dash_brand_tips_title')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { icon: 'ri-fire-line', titleKey: 'dash_brand_tip1_title', descKey: 'dash_brand_tip1_desc' },
                    { icon: 'ri-instagram-line', titleKey: 'dash_brand_tip2_title', descKey: 'dash_brand_tip2_desc' },
                    { icon: 'ri-hand-coin-line', titleKey: 'dash_brand_tip3_title', descKey: 'dash_brand_tip3_desc' },
                  ].map((tip) => (
                    <div key={tip.titleKey} className="bg-zinc-800 rounded-xl p-4">
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400 mb-2">
                        <i className={`${tip.icon} text-base`}></i>
                      </div>
                      <p className="text-xs font-semibold text-white mb-1">{t(tip.titleKey)}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">{t(tip.descKey)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PRODUCTS ── */}
          {activeTab === 'products' && (
            <div className="max-w-5xl">
              <BrandProducts profile={profile} showToast={showToast} />
            </div>
          )}

          {/* ── SERVICES ── */}
          {activeTab === 'services' && (
            <div className="max-w-5xl">
              <BrandServices profile={profile} showToast={showToast} />
            </div>
          )}

          {/* ── TALENT ── */}
          {activeTab === 'talent' && (
            <div className="max-w-6xl">
              <BrandTalentSearch showToast={showToast} onOpenMessages={() => setActiveTab('messages')} />
            </div>
          )}

          {/* ── EVENTS ── */}
          {activeTab === 'events' && (
            <div className="max-w-5xl">
              <BrandEventSearch showToast={showToast} />
            </div>
          )}

          {/* ── SPONSORSHIPS ── */}
          {activeTab === 'sponsorships' && (
            <div className="max-w-4xl">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-white">{t('dash_brand_sponsorships_title')}</h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_brand_sponsorships_desc')}</p>
              </div>
              <OrgOpportunities profile={profile} showToast={showToast} onDataChange={loadData} />
            </div>
          )}

          {/* ── MESSAGES ── */}
          {activeTab === 'messages' && (
            <div className="max-w-6xl">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-white">{t('dash_brand_messages_title')}</h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_brand_messages_desc')}</p>
              </div>
              <MessagesPanel currentUserId={profile.id} />
            </div>
          )}

          {/* ── VERIFICATION / PREMIUM ── */}
          {activeTab === 'verification' && (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {t('dash_brand_verification_title')}
                  {profile.verified && <i className="ri-vip-crown-fill text-yellow-400"></i>}
                </h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_brand_verification_desc')}</p>
              </div>
              <VerificationPanel profile={profile} showToast={showToast} onUpdate={loadData} />
            </div>
          )}

          {/* ── PROFILE ── */}
          {activeTab === 'profile' && (
            <div className="max-w-4xl">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white">{t('dash_brand_profile_title')}</h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_brand_profile_desc')}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Brand info */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-white">{t('dash_brand_info_title')}</h3>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_name_label')}</label>
                    <input value={brandName} onChange={(e) => setBrandName(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500"
                      placeholder="..." />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_contact_label')}</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500"
                      placeholder="..." />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_sector_label')}</label>
                    <select value={industry} onChange={(e) => setIndustry(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500 cursor-pointer">
                      <option value="">{t('dash_brand_sector_ph')}</option>
                      {industries.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_founded_label')}</label>
                      <input type="number" value={foundedYear} onChange={(e) => setFoundedYear(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500"
                        placeholder="2015" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_location_label')}</label>
                      <input value={location} onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500"
                        placeholder="Madrid, España" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_desc_label')}</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500 resize-none"
                      placeholder={t('dash_brand_desc_ph')} />
                  </div>
                </div>

                {/* Preferences + Social */}
                <div className="space-y-5">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white">{t('dash_brand_prefs_title')}</h3>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-2">{t('dash_brand_disciplines_label')}</label>
                      <div className="flex flex-wrap gap-2">
                        {disciplineOptions.map((d) => (
                          <button key={d} type="button" onClick={() => toggleDiscipline(d)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all cursor-pointer whitespace-nowrap ${targetDisciplines.includes(d) ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_budget_label')}</label>
                      <select value={budget} onChange={(e) => setBudget(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500 cursor-pointer">
                        <option value="">{t('dash_brand_budget_ph')}</option>
                        {budgetRanges.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_active_sponsorships')}</label>
                      <input type="number" min="0" value={sponsorshipsCount} onChange={(e) => setSponsorshipsCount(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500"
                        placeholder="0" />
                    </div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white">{t('dash_brand_contact_social')}</h3>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-global-line mr-1"></i>{t('dash_brand_website_label')}</label>
                      <input value={website} onChange={(e) => setWebsite(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500"
                        placeholder="https://..." />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-instagram-line mr-1"></i>Instagram</label>
                      <input value={instagram} onChange={(e) => setInstagram(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500"
                        placeholder="@..." />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-twitter-x-line mr-1"></i>Twitter / X</label>
                      <input value={twitter} onChange={(e) => setTwitter(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500"
                        placeholder="@..." />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <button onClick={saveProfile} disabled={saving}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2">
                    {saving
                      ? <><div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div> {t('dash_saving')}</>
                      : <><i className="ri-save-line"></i> {t('dash_brand_save_profile')}</>
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