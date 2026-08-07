import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, Opportunity } from '@/lib/supabase';
import DashboardNav from './DashboardNav';
import DashSideNav, { type DashNavGroup } from './DashSideNav';
import DashMobileNav from './DashMobileNav';
import PageBreadcrumb from '@/components/base/PageBreadcrumb';
import OrgOpportunities from './OrgOpportunities';
import BrandTalentSearch from './BrandTalentSearch';
import BrandEventSearch from './BrandEventSearch';
import BrandProducts from './BrandProducts';
import BrandServices from './BrandServices';
import BrandMetrics from './BrandMetrics';
import MessagesPanel from './messages/MessagesPanel';
import VerificationPanel from './VerificationPanel';

interface Props { profile: Profile; }

type ActiveTab = 'overview' | 'talent' | 'events' | 'sponsorships' | 'products' | 'services' | 'metrics' | 'messages' | 'verification' | 'profile';

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
      supabase.from('brands').select('id, type, status, is_public').eq('user_id', profile.id).maybeSingle(),
    ]);
    if (orgData) {
      setBrandName(orgData.org_name || '');
      setDescription(orgData.description || '');
      setFoundedYear(orgData.founded_year?.toString() || '');
      setSponsorshipsCount(orgData.fighters_managed?.toString() || '0');
      // Campos que antes se perdían al recargar (ver migración 0007).
      // Si la migración aún no está aplicada, sencillamente llegan undefined.
      const extra = orgData as typeof orgData & { industry?: string; sponsorship_budget?: string; target_disciplines?: string[] };
      if (extra.industry) setIndustry(extra.industry);
      if (extra.sponsorship_budget) setBudget(extra.sponsorship_budget);
      if (Array.isArray(extra.target_disciplines)) setTargetDisciplines(extra.target_disciplines);
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

      const basePayload = {
        profile_id: profile.id,
        org_name: brandName.trim() || fullName.trim(),
        org_type: 'brand',
        description: description.trim() || null,
        founded_year: foundedYear ? parseInt(foundedYear, 10) : null,
        fighters_managed: parseInt(sponsorshipsCount, 10) || 0,
        updated_at: new Date().toISOString(),
      };
      // Campos añadidos por la migración 0007. Si aún no está aplicada,
      // reintentamos sin ellos para no romper el guardado.
      const fullPayload = {
        ...basePayload,
        industry: industry || null,
        sponsorship_budget: budget || null,
        target_disciplines: targetDisciplines,
      };

      const { data: existing } = await supabase.from('organizations').select('id').eq('profile_id', profile.id).maybeSingle();
      const write = (payload: Record<string, unknown>) => existing
        ? supabase.from('organizations').update(payload).eq('id', existing.id)
        : supabase.from('organizations').insert(payload);

      let { error } = await write(fullPayload);
      if (error && /column|schema cache/i.test(error.message || '')) {
        ({ error } = await write(basePayload)); // migración 0007 sin aplicar
      }
      // supabase no lanza: hay que mirar el error o diríamos "guardado" en falso
      if (error) { showToast(t('dash_brand_save_error'), 'error'); return; }
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
        <div className="w-10 h-10 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin"></div>
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
    { id: 'metrics',       label: t('dash_brand_tab_metrics'),       icon: 'ri-line-chart-line' },
    { id: 'talent',        label: t('dash_brand_tab_talent'),        icon: 'ri-user-star-line' },
    { id: 'events',        label: t('dash_brand_tab_events'),        icon: 'ri-calendar-event-line' },
    { id: 'sponsorships',  label: t('dash_brand_tab_sponsorships'),  icon: 'ri-hand-coin-line', badge: openOpps.length || undefined },
    { id: 'messages',      label: t('dash_brand_tab_messages'),      icon: 'ri-message-3-line', badge: unreadMessages || undefined },
    { id: 'verification',  label: t('dash_brand_tab_verification'),  icon: 'ri-vip-crown-line' },
    { id: 'profile',       label: t('dash_brand_tab_profile'),       icon: 'ri-store-2-line' },
  ];

  // R13-T3: la barra lateral se agrupa en las dos funciones de una marca para
  // que no se mezclen "esto es para vender" (Escaparate) y "esto es para
  // patrocinar" (Patrocinio). Cada grupo solo muestra las pestañas que existen.
  // Barra lateral en acordeón (R15-B1): grupos plegables por función, para que
  // no se mezclen "vender" (Escaparate) y "patrocinar" (Patrocinio).
  const tabById = new Map(tabs.map((tb) => [tb.id, tb]));
  const resolve = (ids: ActiveTab[]) => ids
    .map((id) => tabById.get(id))
    .filter(Boolean)
    .map((tb) => ({ id: tb!.id, label: tb!.label, icon: tb!.icon, badge: tb!.badge }));
  const navGroups: DashNavGroup[] = [
    { key: 'storefront', label: t('dash_brand_group_storefront'), icon: 'ri-store-3-line', items: resolve(['products', 'services', 'metrics']) },
    { key: 'sponsor', label: t('dash_brand_group_sponsor'), icon: 'ri-hand-coin-line', items: resolve(['talent', 'events', 'sponsorships']) },
    { key: 'general', label: t('dash_brand_group_general'), icon: 'ri-settings-3-line', items: resolve(['messages', 'verification', 'profile']) },
  ].filter((g) => g.items.length > 0);

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
          {/* Brand identity */}
          <div className="p-5 border-b border-zinc-800">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/28 text-[#C9A84C] text-xl mb-3">
              <i className="ri-store-2-line"></i>
            </div>
            <p className="text-sm font-semibold text-white truncate">{brandName || profile.full_name || t('dash_brand_tab_profile')}</p>
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border mt-1 bg-[#C9A84C]/12 border-[#C9A84C]/28 text-[#C9A84C]">
              {t('dash_brand_label')}
            </span>
            {location && (
              <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                <i className="ri-map-pin-line"></i>{location}
              </p>
            )}
          </div>

          {/* Nav agrupada en acordeón (R15-B1) */}
          <DashSideNav
            accent="gold"
            topItem={{ id: 'overview', label: t('dash_brand_tab_overview'), icon: 'ri-dashboard-line' }}
            groups={navGroups}
            activeId={activeTab}
            onSelect={(id) => setActiveTab(id as ActiveTab)}
          />

          {/* Quick action */}
          <div className="p-3 border-t border-zinc-800">
            <button
              onClick={() => setActiveTab('talent')}
              className="w-full flex items-center gap-2 bg-[#C9A84C] hover:bg-[#dcc06a] text-zinc-950 text-xs font-bold px-3 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-search-line"></i>
              {t('dash_brand_search_athletes')}
            </button>
          </div>
        </aside>

        {/* ── MOBILE BOTTOM NAV ── (R16: barra con botón "Más" para no esconder secciones) */}
        <DashMobileNav tabs={tabs} activeId={activeTab} onSelect={(id) => setActiveTab(id as ActiveTab)} accent="gold" />

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 lg:ml-56 px-4 md:px-6 lg:px-8 py-8 pb-24 lg:pb-8 max-w-full overflow-x-hidden">

          {/* Migas de pan: en qué sección del panel estoy y cómo volver (bloque 4). */}
          {activeTab !== 'overview' && (
            <PageBreadcrumb
              root={t('dash_here_root')}
              section={tabs.find((tb) => tb.id === activeTab)?.label}
              onRoot={() => setActiveTab('overview')}
              accent="gold"
            />
          )}

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-5xl">
              <div>
                <p className="rk-eyebrow">{t('dash_brand_label')}</p>
                <h1 className="rk-h2" style={{ fontSize: 'clamp(1.9rem,4.5vw,2.6rem)', color: '#fff', margin: '4px 0 0' }}>
                  {t('dash_brand_welcome')} <span style={{ color: '#C9A84C', textShadow: '0 0 50px rgba(201,168,76,0.45)' }}>{brandName || profile.full_name?.split(' ')[0] || t('dash_brand_tab_profile')}</span>
                </h1>
                <p className="text-zinc-400 text-sm mt-1.5">{t('dash_brand_panel')}</p>
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
                  { label: t('dash_brand_sponsorships'), value: parseInt(sponsorshipsCount, 10) || 0, icon: 'ri-hand-coin-line', color: 'text-[#C9A84C]', bg: 'bg-[#C9A84C]/12 border-[#C9A84C]/28', action: () => setActiveTab('sponsorships') },
                  { label: t('dash_brand_opps_published'), value: openOpps.length, icon: 'ri-megaphone-line', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', action: () => setActiveTab('sponsorships') },
                  { label: t('dash_brand_total_opps'), value: myOpps.length, icon: 'ri-file-list-3-line', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', action: () => setActiveTab('sponsorships') },
                  { label: t('dash_brand_status'), value: isPublic ? t('dash_brand_active') : t('dash_brand_hidden_status'), icon: isPublic ? 'ri-checkbox-circle-line' : 'ri-eye-off-line', color: isPublic ? 'text-green-400' : 'text-zinc-400', bg: isPublic ? 'bg-green-500/10 border-green-500/20' : 'bg-white/[0.05] border-white/10', action: () => setActiveTab('profile') },
                ].map((kpi) => (
                  <button key={kpi.label} onClick={kpi.action}
                    className="rk-card p-5 text-left cursor-pointer">
                    <div className={`w-9 h-9 flex items-center justify-center rounded-xl border mb-3 ${kpi.bg} ${kpi.color}`}>
                      <i className={`${kpi.icon} text-lg`}></i>
                    </div>
                    <p className={kpi.color} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1 }}>{kpi.value}</p>
                    <p className="text-[11px] text-zinc-400 mt-1.5 uppercase tracking-wider leading-tight">{kpi.label}</p>
                  </button>
                ))}
              </div>

              {/* Hero banner — tratamiento cinematográfico sin imágenes de relleno */}
              <div className="relative rounded-2xl overflow-hidden rk-grid-bg border border-white/[0.08]" style={{ background: '#080808' }}>
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 88% 30%, rgba(201,168,76,0.16) 0%, transparent 58%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 8% 100%, rgba(225,6,0,0.10) 0%, transparent 55%)' }} />
                <span aria-hidden="true" className="pointer-events-none select-none absolute right-4 -bottom-3 hidden sm:block" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 96, lineHeight: 0.8, color: 'transparent', WebkitTextStroke: '1px rgba(201,168,76,0.14)' }}>RANKD</span>
                <div className="relative flex items-center px-6 sm:px-8 py-8">
                  <div>
                    <p className="rk-eyebrow mb-2">{t('dash_brand_discover')}</p>
                    <h2 className="rk-h3 text-white mb-3" style={{ fontSize: 'clamp(1.3rem,2.6vw,1.9rem)', maxWidth: 460 }}>{t('dash_brand_discover_title')}</h2>
                    <button onClick={() => setActiveTab('talent')}
                      className="rk-btn rk-btn-gold flex items-center gap-2" style={{ fontSize: '0.85rem', padding: '0.7rem 1.4rem' }}>
                      <i className="ri-user-star-line"></i>
                      {t('dash_brand_explore_athletes')}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Las dos funciones de una marca, bien diferenciadas ── */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Función 1 · Vender producto */}
                <div className="rk-card p-5 flex flex-col" style={{ borderColor: 'rgba(201,168,76,0.2)' }}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/35 text-[#C9A84C]"><i className="ri-store-3-line text-lg"></i></div>
                    <div>
                      <p className="rk-eyebrow" style={{ fontSize: '0.6rem' }}>{t('dash_brand_fn1_eyebrow')}</p>
                      <h3 className="rk-h3 text-white" style={{ fontSize: '1.05rem' }}>{t('dash_brand_fn1_title')}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-4">{t('dash_brand_fn1_desc')}</p>
                  <div className="space-y-2 mt-auto">
                    {(brandType === 'product' || brandType === 'both') && (
                      <button onClick={() => setActiveTab('products')} className="w-full flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#C9A84C]/40 px-3.5 py-2.5 text-left transition-colors cursor-pointer group">
                        <i className="ri-shopping-bag-line text-[#C9A84C]"></i>
                        <span className="text-sm text-white flex-1">{t('dash_brand_fn1_products')}</span>
                        <i className="ri-arrow-right-line text-zinc-600 group-hover:text-[#C9A84C] transition-colors"></i>
                      </button>
                    )}
                    {(brandType === 'service' || brandType === 'both') && (
                      <button onClick={() => setActiveTab('services')} className="w-full flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#C9A84C]/40 px-3.5 py-2.5 text-left transition-colors cursor-pointer group">
                        <i className="ri-service-line text-[#C9A84C]"></i>
                        <span className="text-sm text-white flex-1">{t('dash_brand_fn1_services')}</span>
                        <i className="ri-arrow-right-line text-zinc-600 group-hover:text-[#C9A84C] transition-colors"></i>
                      </button>
                    )}
                    <a href="/brands" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#C9A84C]/40 px-3.5 py-2.5 text-left transition-colors cursor-pointer group">
                      <i className="ri-external-link-line text-zinc-400"></i>
                      <span className="text-sm text-white flex-1">{t('dash_brand_fn1_public')}</span>
                      <i className="ri-arrow-right-line text-zinc-600 group-hover:text-[#C9A84C] transition-colors"></i>
                    </a>
                  </div>
                </div>

                {/* Función 2 · Patrocinar y darse a conocer */}
                <div className="rk-card p-5 flex flex-col" style={{ borderColor: 'rgba(225,6,0,0.22)' }}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/30 text-red-400"><i className="ri-hand-coin-line text-lg"></i></div>
                    <div>
                      <p className="rk-eyebrow" style={{ fontSize: '0.6rem' }}>{t('dash_brand_fn2_eyebrow')}</p>
                      <h3 className="rk-h3 text-white" style={{ fontSize: '1.05rem' }}>{t('dash_brand_fn2_title')}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-4">{t('dash_brand_fn2_desc')}</p>
                  <div className="space-y-2 mt-auto">
                    <button onClick={() => setActiveTab('talent')} className="w-full flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-red-500/40 px-3.5 py-2.5 text-left transition-colors cursor-pointer group">
                      <i className="ri-user-star-line text-red-400"></i>
                      <span className="text-sm text-white flex-1">{t('dash_brand_fn2_search')}</span>
                      <i className="ri-arrow-right-line text-zinc-600 group-hover:text-red-400 transition-colors"></i>
                    </button>
                    <button onClick={() => setActiveTab('sponsorships')} className="w-full flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-red-500/40 px-3.5 py-2.5 text-left transition-colors cursor-pointer group">
                      <i className="ri-megaphone-line text-red-400"></i>
                      <span className="text-sm text-white flex-1">{t('dash_brand_fn2_publish')}</span>
                      <i className="ri-arrow-right-line text-zinc-600 group-hover:text-red-400 transition-colors"></i>
                    </button>
                    <button onClick={() => setActiveTab('events')} className="w-full flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-red-500/40 px-3.5 py-2.5 text-left transition-colors cursor-pointer group">
                      <i className="ri-calendar-event-line text-red-400"></i>
                      <span className="text-sm text-white flex-1">{t('dash_brand_fn2_events')}</span>
                      <i className="ri-arrow-right-line text-zinc-600 group-hover:text-red-400 transition-colors"></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent sponsorships */}
              {myOpps.length > 0 && (
                <div className="rk-card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                    <h2 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('dash_brand_recent_opps')}</h2>
                    <button onClick={() => setActiveTab('sponsorships')}
                      className="text-xs text-[#C9A84C] hover:text-[#dcc06a] cursor-pointer whitespace-nowrap flex items-center gap-1">
                      {t('dash_brand_view_all')} <i className="ri-arrow-right-line"></i>
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.06]">
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
              <div className="rk-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <i className="ri-lightbulb-line text-[#C9A84C]"></i>
                  {t('dash_brand_tips_title')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { icon: 'ri-fire-line', titleKey: 'dash_brand_tip1_title', descKey: 'dash_brand_tip1_desc' },
                    { icon: 'ri-instagram-line', titleKey: 'dash_brand_tip2_title', descKey: 'dash_brand_tip2_desc' },
                    { icon: 'ri-hand-coin-line', titleKey: 'dash_brand_tip3_title', descKey: 'dash_brand_tip3_desc' },
                  ].map((tip) => (
                    <div key={tip.titleKey} className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4">
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#C9A84C]/12 text-[#C9A84C] mb-2">
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

          {/* ── METRICS ── */}
          {activeTab === 'metrics' && (
            <div className="max-w-5xl">
              <BrandMetrics profile={profile} />
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
                <h2 className="rk-h3 text-white">{t('dash_brand_sponsorships_title')}</h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_brand_sponsorships_desc')}</p>
              </div>
              <OrgOpportunities profile={profile} showToast={showToast} onDataChange={loadData} />
            </div>
          )}

          {/* ── MESSAGES ── */}
          {activeTab === 'messages' && (
            <div className="max-w-6xl">
              <div className="mb-5">
                <h2 className="rk-h3 text-white">{t('dash_brand_messages_title')}</h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_brand_messages_desc')}</p>
              </div>
              <MessagesPanel currentUserId={profile.id} />
            </div>
          )}

          {/* ── VERIFICATION / PREMIUM ── */}
          {activeTab === 'verification' && (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h2 className="rk-h3 text-white flex items-center gap-2">
                  {t('dash_brand_verification_title')}
                  {profile.verified && <i className="ri-vip-crown-fill text-[#C9A84C]"></i>}
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
                <h2 className="rk-h3 text-white">{t('dash_brand_profile_title')}</h2>
                <p className="text-zinc-400 text-sm mt-1">{t('dash_brand_profile_desc')}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Brand info */}
                <div className="rk-card p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-white">{t('dash_brand_info_title')}</h3>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_name_label')}</label>
                    <input value={brandName} onChange={(e) => setBrandName(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]"
                      placeholder="..." />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_contact_label')}</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]"
                      placeholder="..." />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_sector_label')}</label>
                    <select value={industry} onChange={(e) => setIndustry(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C] cursor-pointer">
                      <option value="">{t('dash_brand_sector_ph')}</option>
                      {industries.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_founded_label')}</label>
                      <input type="number" value={foundedYear} onChange={(e) => setFoundedYear(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]"
                        placeholder="2015" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_location_label')}</label>
                      <input value={location} onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]"
                        placeholder="Madrid, España" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_desc_label')}</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C] resize-none"
                      placeholder={t('dash_brand_desc_ph')} />
                  </div>
                </div>

                {/* Preferences + Social */}
                <div className="space-y-5">
                  <div className="rk-card p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white">{t('dash_brand_prefs_title')}</h3>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-2">{t('dash_brand_disciplines_label')}</label>
                      <div className="flex flex-wrap gap-2">
                        {disciplineOptions.map((d) => (
                          <button key={d} type="button" onClick={() => toggleDiscipline(d)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all cursor-pointer whitespace-nowrap ${targetDisciplines.includes(d) ? 'bg-[#C9A84C]/20 border-[#C9A84C]/45 text-[#C9A84C]' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_budget_label')}</label>
                      <select value={budget} onChange={(e) => setBudget(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C] cursor-pointer">
                        <option value="">{t('dash_brand_budget_ph')}</option>
                        {budgetRanges.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_brand_active_sponsorships')}</label>
                      <input type="number" min="0" value={sponsorshipsCount} onChange={(e) => setSponsorshipsCount(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]"
                        placeholder="0" />
                    </div>
                  </div>

                  <div className="rk-card p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white">{t('dash_brand_contact_social')}</h3>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-global-line mr-1"></i>{t('dash_brand_website_label')}</label>
                      <input value={website} onChange={(e) => setWebsite(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]"
                        placeholder="https://..." />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-instagram-line mr-1"></i>Instagram</label>
                      <input value={instagram} onChange={(e) => setInstagram(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]"
                        placeholder="@..." />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5"><i className="ri-twitter-x-line mr-1"></i>Twitter / X</label>
                      <input value={twitter} onChange={(e) => setTwitter(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]"
                        placeholder="@..." />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <button onClick={saveProfile} disabled={saving}
                    className="rk-btn rk-btn-gold w-full disabled:opacity-60 flex items-center justify-center gap-2" style={{ fontSize: '1rem' }}>
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