import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Opportunity, Profile } from '@/lib/supabase';
import { isPastEvent } from '@/lib/opportunityDate';
import { useAuth } from '@/hooks/useAuth';
import { useSEO } from '@/hooks/useSEO';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';
import OpportunityCard from './components/OpportunityCard';
import OpportunitiesFilters from './components/OpportunitiesFilters';
import ApplyModal from './components/ApplyModal';
import { isSponsorshipType } from './components/OpportunityCard';

export default function OpportunitiesPage() {
  useSEO({
    title: 'Oportunidades de Combate | RANKD',
    description: 'Combates, sparrings, contratos y patrocinios para peleadores. Postúlate a oportunidades reales de promotoras y marcas del deporte de contacto.',
  });

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [opportunities, setOpportunities] = useState<(Opportunity & { publisher?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [filterType, setFilterType] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterWeight, setFilterWeight] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [search, setSearch] = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('opportunities')
        .select('*, publisher:profiles(id, full_name, avatar_url, user_type, location)')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      setOpportunities((data as (Opportunity & { publisher?: Profile })[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadApplied = async () => {
      const { data } = await supabase
        .from('applications')
        .select('opportunity_id')
        .eq('fighter_profile_id', user.id);
      if (data) setAppliedIds(new Set(data.map((a) => a.opportunity_id)));
    };
    loadApplied();
  }, [user]);

  const filtered = opportunities.filter((o) => {
    // Ocultar oportunidades cuyo evento ya pasó (bloque 3).
    if (isPastEvent(o.event_date)) return false;
    if (filterType && o.type !== filterType) return false;
    if (filterDiscipline && o.discipline !== filterDiscipline) return false;
    if (filterWeight && o.weight_class !== filterWeight) return false;
    if (filterLocation && !o.location?.toLowerCase().includes(filterLocation.toLowerCase())) return false;
    if (search && !o.title.toLowerCase().includes(search.toLowerCase()) && !o.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleApply = async (message: string) => {
    if (!user || !selectedOpp) return;
    const { error } = await supabase.from('applications').insert({
      opportunity_id: selectedOpp.id,
      fighter_profile_id: user.id,
      message: message.trim() || null,
    });
    if (error) {
      showToast(t('opp_toast_error'), 'error');
    } else {
      setAppliedIds((prev) => new Set([...prev, selectedOpp.id]));
      showToast(t('opp_toast_sent'));
    }
    setSelectedOpp(null);
  };

  const typeLabels: Record<string, string> = {
    combate: t('opp_type_combate'), contrato: t('opp_type_contrato'), patrocinio: t('opp_type_patrocinio'),
    sparring: t('opp_type_sparring'), campamento: t('opp_type_campamento'), entrenamiento: t('opp_type_entrenamiento'), scouting: t('opp_type_scouting'),
  };

  // "Sin resultados" y "todavía no hay nada publicado" son cosas distintas
  // y merecen mensajes distintos.
  const hasFilters = !!(filterType || filterDiscipline || filterWeight || filterLocation || search);

  return (
    <div className="min-h-screen bg-[#070707]">
      <Navbar />

      {/* Hero cinematográfico */}
      <div className="relative bg-zinc-950 pt-24 sm:pt-28 pb-10 sm:pb-16 px-4 overflow-hidden">
        {/* BG decorativo */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(225,6,0,0.10) 0%, transparent 55%)' }} />
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #E10600 0%, rgba(225,6,0,0.4) 50%, transparent 100%)' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-[2px] bg-[#E10600]" />
                <span className="text-[#E10600] text-xs font-bold tracking-[0.25em] uppercase">{t('opp_eyebrow')}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">{t('opp_page_title')}</h1>
              <p className="text-zinc-300 mt-2 sm:mt-3 text-sm sm:text-base max-w-xl leading-relaxed">{t('opp_page_desc')}</p>
            </div>
            <div className="flex items-center gap-3">
              {profile && profile.user_type !== 'fighter' && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap shadow-lg shadow-red-600/30"
                >
                  <i className="ri-add-line"></i> {t('opp_page_publish')}
                </button>
              )}
              {!user && (
                <button
                  onClick={() => navigate('/auth')}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap shadow-lg shadow-red-600/30"
                >
                  <i className="ri-login-box-line"></i>
                  <span className="hidden sm:inline">{t('opp_page_join')}</span>
                  <span className="sm:hidden">{t('opp_page_join_short')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 sm:gap-6 mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-zinc-800 overflow-x-auto">
            <div className="text-center flex-shrink-0">
              <p className="text-2xl sm:text-3xl font-black text-white">{opportunities.length}</p>
              <p className="text-xs text-zinc-400 mt-0.5 uppercase tracking-wider">{t('opp_page_active')}</p>
            </div>
            {(['combate','sparring','contrato','patrocinio'] as const).map((tt) => (
              <div key={tt} className="text-center flex-shrink-0">
                <p className="text-lg sm:text-xl font-bold text-red-400">{opportunities.filter(o => o.type === tt).length}</p>
                <p className="text-xs text-zinc-400 mt-0.5 capitalize">{typeLabels[tt]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-4 md:px-6 py-6 sm:py-8">
        {/* Search + Filters */}
        <div className="mb-6">
          <div className="relative mb-4">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm"></i>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('opp_page_search_placeholder')}
              className="w-full bg-white/[0.03] border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-red-400"
            />
          </div>
          <OpportunitiesFilters
            filterType={filterType} setFilterType={setFilterType}
            filterDiscipline={filterDiscipline} setFilterDiscipline={setFilterDiscipline}
            filterWeight={filterWeight} setFilterWeight={setFilterWeight}
            filterLocation={filterLocation} setFilterLocation={setFilterLocation}
          />
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-zinc-300 font-medium">
            {loading ? t('opp_page_loading') : `${filtered.length} ${filtered.length !== 1 ? t('opp_page_count_plural') : t('opp_page_count')}`}
          </p>
          {hasFilters && (
            <button
              onClick={() => { setFilterType(''); setFilterDiscipline(''); setFilterWeight(''); setFilterLocation(''); setSearch(''); }}
              className="text-xs text-red-500 hover:text-red-400 cursor-pointer flex items-center gap-1 font-medium"
            >
              <i className="ri-close-line"></i> {t('opp_page_clear')}
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 space-y-3">
                <div className="h-5 w-24 rounded-full opp-skeleton" />
                <div className="h-5 w-full rounded opp-skeleton" />
                <div className="h-5 w-3/5 rounded opp-skeleton" />
                <div className="h-3 w-full rounded opp-skeleton mt-4" />
                <div className="h-3 w-4/5 rounded opp-skeleton" />
                <div className="h-10 w-full rounded-xl opp-skeleton mt-5" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rk-card" style={{ transform: 'none' }}>
            <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
              <i className={`text-3xl text-zinc-500 ${hasFilters ? 'ri-search-eye-line' : 'ri-megaphone-line'}`}></i>
            </div>
            {hasFilters ? (
              <>
                <p className="text-zinc-200 text-base font-semibold">{t('opp_page_empty_title')}</p>
                <p className="text-zinc-500 text-sm mt-1">{t('opp_page_empty_desc')}</p>
                <button
                  onClick={() => { setFilterType(''); setFilterDiscipline(''); setFilterWeight(''); setFilterLocation(''); setSearch(''); }}
                  className="mt-5 text-sm font-bold text-red-400 hover:text-red-300 cursor-pointer"
                >
                  {t('opp_see_all')}
                </button>
              </>
            ) : (
              <>
                <p className="text-zinc-200 text-base font-semibold">{t('opp_none_title')}</p>
                <p className="text-zinc-500 text-sm mt-1.5 max-w-sm mx-auto leading-relaxed">
                  {t('opp_none_desc')}
                </p>
                {profile && profile.user_type !== 'fighter' ? (
                  <button onClick={() => navigate('/dashboard')} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem', padding: '0.75rem 1.6rem' }}>
                    {t('opp_publish_first')}
                  </button>
                ) : (
                  <button onClick={() => navigate('/fighters')} className="mt-5 text-sm font-bold text-red-400 hover:text-red-300 cursor-pointer">
                    {t('opp_explore_dir')}
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filtered.map((opp) => {
              const isSponsorship = isSponsorshipType(opp.type);
              const canApplyToThis = !!user && profile?.user_type === 'fighter' && !isSponsorship;
              return (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  publisher={(opp as Opportunity & { publisher?: Profile }).publisher}
                  isApplied={appliedIds.has(opp.id)}
                  canApply={canApplyToThis}
                  userType={profile?.user_type ?? null}
                  onApply={() => {
                    if (!user) { navigate('/auth'); return; }
                    if (isSponsorship && profile?.user_type === 'fighter') return;
                    setSelectedOpp(opp);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {selectedOpp && (
        <ApplyModal
          opportunity={selectedOpp}
          onClose={() => setSelectedOpp(null)}
          onSubmit={handleApply}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 text-white text-sm px-5 py-3 rounded-xl flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          <i className={toast.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'}></i>
          {toast.msg}
        </div>
      )}

      <style>{`
        .opp-skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.035) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.035) 75%);
          background-size: 200% 100%;
          animation: rankd-shimmer 1.6s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) { .opp-skeleton { animation: none; } }
      `}</style>

      <Footer />
    </div>
  );
}