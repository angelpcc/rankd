import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';
import BrandDirectoryCard from './components/BrandDirectoryCard';
import { useBrands } from '@/hooks/useBrands';
import { useSEO } from '@/hooks/useSEO';
import { useAuth } from '@/hooks/useAuth';

const PRODUCT_CATEGORIES = [
  'Guantes', 'Vendas', 'Bucales', 'Ropa', 'Protecciones',
  'Equipamiento de gimnasio', 'Nutrición', 'Otros',
];

const SERVICE_CATEGORIES = [
  'Patrocinio', 'Management', 'Nutrición',
  'Fisioterapia', 'Equipamiento para eventos', 'Otros',
];

const DISCIPLINES = [
  'Boxeo', 'MMA', 'Kickboxing', 'Muay Thai', 'BJJ', 'Wrestling',
];

type TypeFilter = 'all' | 'product' | 'service' | 'both';

// Señal real de "busca patrocinar ahora": ofrece un servicio de patrocinio
// (categoría 'Patrocinio' es una de las de servicio) o su categoría lo dice.
function isSeekingSponsor(b: { category: string | null; services: { category: string | null; title: string }[] }): boolean {
  if ((b.category || '').toLowerCase().includes('patrocin')) return true;
  return b.services.some((s) => (s.category || '').toLowerCase().includes('patrocin') || /patrocin|sponsor/i.test(s.title));
}

export default function BrandsPage() {
  const { profile: currentProfile } = useAuth();
  const isHobby = currentProfile?.athlete_mode === 'hobby';

  useSEO({
    title: isHobby ? 'Tienda de material y marcas | RANKD' : 'Marcas y Patrocinadores | RANKD',
    description: isHobby
      ? 'Descubre marcas de guantes, protecciones, ropa y nutrición para tu entrenamiento. Todo lo que necesitas en un solo sitio.'
      : 'Marcas de equipamiento y servicios para deportes de combate. Guantes, nutrición, patrocinio y más, conectadas con peleadores y promotoras.',
  });

  const { t } = useTranslation();
  const { brands, loading } = useBrands();
  const [ratings, setRatings] = useState<Map<string, { avg: number; n: number }>>(new Map());

  useEffect(() => {
    const ids = brands.map((b) => b.user_id).filter(Boolean) as string[];
    if (ids.length === 0) return;
    supabase.from('org_rating_summary').select('org_profile_id, avg_rating, review_count').in('org_profile_id', ids)
      .then(({ data }) => setRatings(new Map((data || []).map((r) => [r.org_profile_id, { avg: Number(r.avg_rating) || 0, n: r.review_count || 0 }]))));
  }, [brands]);

  const SORT_OPTIONS = [
    { value: 'recent', label: t('brands_sort_recent') },
    { value: 'items', label: t('brands_sort_items') },
    { value: 'name', label: t('brands_sort_name') },
  ];

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [showFilters, setShowFilters] = useState(false);

  const handleTypeChange = (type: TypeFilter) => {
    setTypeFilter(type);
    setCategoryFilter('');
  };

  const filtered = useMemo(() => {
    let result = [...brands];
    if (typeFilter === 'product') result = result.filter((b) => b.type === 'product' || b.type === 'both');
    else if (typeFilter === 'service') result = result.filter((b) => b.type === 'service' || b.type === 'both');
    else if (typeFilter === 'both') result = result.filter((b) => b.type === 'both');

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((b) =>
        b.name.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q) ||
        b.products.some((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)) ||
        b.services.some((s) => s.title.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))
      );
    }

    if (categoryFilter) {
      result = result.filter((b) =>
        b.category === categoryFilter ||
        b.products.some((p) => p.category === categoryFilter) ||
        b.services.some((s) => s.category === categoryFilter)
      );
    }

    if (disciplineFilter) {
      const disc = disciplineFilter.toLowerCase();
      result = result.filter((b) =>
        b.category?.toLowerCase().includes(disc) ||
        b.description?.toLowerCase().includes(disc) ||
        b.products.some((p) => p.description?.toLowerCase().includes(disc) || p.category?.toLowerCase().includes(disc)) ||
        b.services.some((s) => s.description?.toLowerCase().includes(disc) || s.category?.toLowerCase().includes(disc))
      );
    }

    if (sortBy === 'items') {
      result.sort((a, b) => (b.products.length + b.services.length) - (a.products.length + a.services.length));
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [brands, search, typeFilter, categoryFilter, disciplineFilter, sortBy]);

  const activeFilterCount = [categoryFilter, disciplineFilter].filter(Boolean).length;

  // "Buscan patrocinar ahora": destacadas arriba y SEPARADAS del resto. Solo en
  // la vista por defecto (sin búsqueda ni filtros); con filtros, grid único.
  const defaultView = !search.trim() && !categoryFilter && !disciplineFilter && typeFilter === 'all';
  const sponsorSeekers = useMemo(
    () => (defaultView ? filtered.filter(isSeekingSponsor) : []),
    [filtered, defaultView],
  );
  const sponsorIds = useMemo(() => new Set(sponsorSeekers.map((b) => b.id)), [sponsorSeekers]);
  const mainList = sponsorSeekers.length > 0 ? filtered.filter((b) => !sponsorIds.has(b.id)) : filtered;
  const totalProducts = brands.reduce((acc, b) => acc + b.products.length, 0);
  const totalServices = brands.reduce((acc, b) => acc + b.services.length, 0);
  const productBrands = brands.filter((b) => b.type === 'product' || b.type === 'both').length;
  const serviceBrands = brands.filter((b) => b.type === 'service' || b.type === 'both').length;
  const bothBrands = brands.filter((b) => b.type === 'both').length;

  const activeCategoryOptions =
    typeFilter === 'service' ? SERVICE_CATEGORIES
    : typeFilter === 'product' ? PRODUCT_CATEGORIES
    : [...PRODUCT_CATEGORIES, ...SERVICE_CATEGORIES.filter((c) => !PRODUCT_CATEGORIES.includes(c))];

  return (
    <div className="min-h-screen bg-[#070707]">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative pt-24 pb-16 bg-[#0B0B0B] overflow-hidden rk-grid-bg">
        {/* Foto de fondo (Unsplash, licencia libre, uso comercial) + oscurecido para legibilidad */}
        <img src="/images/marca.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ opacity: 0.16, objectPosition: 'center 40%' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(11,11,11,0.85) 0%, rgba(11,11,11,0.62) 45%, rgba(11,11,11,0.97) 100%)' }} />
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 74% 45%, rgba(225,6,0,0.16) 0%, transparent 55%)' }} />
          <div className="absolute top-0 right-0 w-1/2 h-full" style={{ background: 'radial-gradient(ellipse at 100% 0%, rgba(201,168,76,0.07) 0%, transparent 60%)' }} />
          <div className="absolute inset-0" style={{ maskImage: 'linear-gradient(to bottom, black, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)' }} />
        </div>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #E10600 0%, rgba(225,6,0,0.4) 50%, transparent 100%)' }} />

        <div className="relative max-w-7xl mx-auto px-6 md:px-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-[2px] bg-[#E10600]"></div>
            <span className="text-[#E10600] text-xs font-bold tracking-[0.25em] uppercase font-inter">{isHobby ? t('br_shop_eyebrow') : t('fd_directory')}</span>
          </div>
          <h1 className="font-unbounded font-black text-white leading-tight mb-3" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)' }}>
            {isHobby ? t('br_shop_title') : t('brands_page_title')}
          </h1>
          <p className="text-white/70 text-sm md:text-base max-w-xl font-inter leading-relaxed mb-8">
            {isHobby
              ? t('br_shop_desc')
              : t('brands_page_desc')}
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-6">
            {[
              { icon: 'ri-store-2-line', value: brands.length, label: t('brands_stat_registered') },
              { icon: 'ri-shopping-bag-line', value: totalProducts, label: t('brands_stat_products') },
              { icon: 'ri-service-line', value: totalServices, label: t('brands_stat_services') },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 border border-white/10">
                  <i className={`${stat.icon} text-[#E10600] text-sm`}></i>
                </div>
                <div>
                  <span className="text-white font-bold text-lg font-unbounded">{stat.value}</span>
                  <span className="text-white/60 text-xs font-inter ml-1.5">{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TYPE TABS + SEARCH BAR ── */}
      <div className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-10 pt-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
            {([
              { value: 'all' as TypeFilter, label: t('brands_filter_all'), icon: 'ri-apps-line', count: brands.length },
              { value: 'product' as TypeFilter, label: t('brands_filter_products'), icon: 'ri-shopping-bag-line', count: productBrands },
              { value: 'service' as TypeFilter, label: t('brands_filter_services'), icon: 'ri-service-line', count: serviceBrands },
              { value: 'both' as TypeFilter, label: t('brands_filter_both'), icon: 'ri-store-3-line', count: bothBrands },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleTypeChange(opt.value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap font-inter ${typeFilter === opt.value ? 'bg-white text-[#0B0B0B] shadow-sm' : 'text-zinc-400 hover:text-white'}`}
              >
                <i className={opt.icon}></i>
                {opt.label}
                {opt.count > 0 && (
                  <span className="text-[10px] text-gray-500 font-normal">({opt.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-10 py-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={typeFilter === 'service' ? t('brands_search_services') : t('brands_search_products')}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#E10600] transition-colors font-inter"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer">
                  <i className="ri-close-line text-sm"></i>
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#E10600] cursor-pointer font-inter min-w-[160px]"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors cursor-pointer whitespace-nowrap font-inter ${showFilters || activeFilterCount > 0 ? 'bg-[#E10600] text-white border-[#E10600]' : 'bg-white/[0.04] text-zinc-200 border-white/10 hover:border-white/30'}`}
            >
              <i className="ri-filter-3-line"></i>
              {t('brands_btn_filters')}
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/30 text-xs font-bold">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <p className="text-xs text-zinc-400 font-inter mb-2 font-semibold uppercase tracking-wide">
                  {typeFilter === 'service' ? t('brands_service_type_label') : t('brands_cat_label')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCategoryFilter('')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap font-inter ${!categoryFilter ? 'bg-red-600 text-white border-red-600' : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-white/30'}`}
                  >
                    {t('brands_cat_all')}
                  </button>
                  {activeCategoryOptions.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategoryFilter(c === categoryFilter ? '' : c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap font-inter ${categoryFilter === c ? 'bg-[#E10600] text-white border-[#E10600]' : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-white/30'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:w-64">
                <p className="text-xs text-zinc-400 font-inter mb-2 font-semibold uppercase tracking-wide">{t('brands_disc_label')}</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setDisciplineFilter('')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap font-inter ${!disciplineFilter ? 'bg-red-600 text-white border-red-600' : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-white/30'}`}
                  >
                    {t('brands_disc_all')}
                  </button>
                  {DISCIPLINES.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDisciplineFilter(d === disciplineFilter ? '' : d)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap font-inter ${disciplineFilter === d ? 'bg-[#E10600] text-white border-[#E10600]' : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-white/30'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="flex items-end">
                  <button
                    onClick={() => { setCategoryFilter(''); setDisciplineFilter(''); }}
                    className="text-xs text-[#E10600] hover:text-red-700 cursor-pointer whitespace-nowrap font-inter flex items-center gap-1 font-semibold"
                  >
                    <i className="ri-close-line"></i>
                    {t('brands_clear_btn')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-14">

        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-[#E10600] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-zinc-400 text-sm font-inter">{t('brands_loading')}</p>
            </div>
          </div>
        )}

        {!loading && brands.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
            <div className="w-24 h-24 flex items-center justify-center rounded-3xl bg-white/[0.05] border border-white/10 mb-8">
              <i className="ri-store-2-line text-5xl text-gray-400"></i>
            </div>
            <h2 className="font-unbounded font-bold text-white text-xl mb-3">
              {t('brands_empty_registered')}
            </h2>
            <p className="text-zinc-400 text-sm font-inter leading-relaxed max-w-md">
              {t('brands_empty_registered_desc')}
            </p>
          </div>
        )}

        {!loading && brands.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-white/[0.05] border border-white/10 mb-6">
              <i className="ri-filter-off-line text-3xl text-gray-400"></i>
            </div>
            <h3 className="font-unbounded font-bold text-white text-base mb-2">{t('brands_no_results_title')}</h3>
            <p className="text-zinc-400 text-sm font-inter mb-6">{t('brands_no_results_desc')}</p>
            <button
              onClick={() => { setSearch(''); setCategoryFilter(''); setDisciplineFilter(''); handleTypeChange('all'); }}
              className="flex items-center gap-2 bg-[#E10600] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap font-inter hover:bg-red-700"
            >
              <i className="ri-close-line"></i>
              {t('brands_btn_filters')}
            </button>
          </div>
        )}

        {!loading && brands.length > 0 && (
          <div className="flex items-center justify-between mb-8">
            <p className="text-sm font-semibold text-white font-inter">
              {filtered.length === 0
                ? t('brands_no_results_title')
                : `${filtered.length} ${filtered.length === 1 ? t('brands_results_singular') : t('brands_results_plural')}`
              }
            </p>
            {(search || categoryFilter || disciplineFilter) && (
              <button
                onClick={() => { setSearch(''); setCategoryFilter(''); setDisciplineFilter(''); }}
                className="text-xs text-zinc-400 hover:text-white cursor-pointer font-inter flex items-center gap-1 font-medium"
              >
                <i className="ri-close-line"></i>
                {t('brands_clear_search')}
              </button>
            )}
          </div>
        )}

        {/* ── BUSCAN PATROCINAR AHORA — destacadas y separadas ── */}
        {!loading && sponsorSeekers.length > 0 && (
          <section className="mb-12">
            <div className="relative overflow-hidden rounded-2xl border border-red-500/25 mb-4 p-4 sm:p-5" style={{ background: 'linear-gradient(150deg, var(--s-1) 0%, #0d0d0d 100%)' }}>
              <div className="absolute inset-0 rk-grid-bg pointer-events-none" style={{ opacity: 0.35 }} />
              <div className="rk-glow-red" style={{ inset: '-50% 30% auto -10%', height: '160%' }} />
              <i className="ri-hand-coin-line" style={{ position: 'absolute', right: -14, bottom: -30, fontSize: 130, color: 'rgba(255,255,255,0.05)', lineHeight: 1, pointerEvents: 'none' }} />
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-600/15 border border-red-500/30 text-red-400">
                  <i className="ri-hand-coin-line text-lg" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">{t('brands_sponsor_now')}</p>
                  <p className="text-sm text-zinc-300 mt-0.5">{t('brands_sponsor_now_desc', { n: sponsorSeekers.length })}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sponsorSeekers.map((brand) => (
                <BrandDirectoryCard key={brand.id} brand={brand} seekingSponsor rating={brand.user_id ? ratings.get(brand.user_id) : undefined} />
              ))}
            </div>
          </section>
        )}

        {!loading && mainList.length > 0 && (
          <>
            {sponsorSeekers.length > 0 && (
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('brands_all_brands')}</h3>
                <span className="text-xs text-zinc-500">{mainList.length}</span>
                <span className="flex-1 h-px bg-white/[0.07]" />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {mainList.map((brand) => (
                <BrandDirectoryCard key={brand.id} brand={brand} seekingSponsor={isSeekingSponsor(brand)} rating={brand.user_id ? ratings.get(brand.user_id) : undefined} />
              ))}
            </div>
          </>
        )}

        {/* CTA strip */}
        {!loading && (
          <div className="mt-16 bg-gradient-to-br from-[#0B0B0B] to-zinc-900 rounded-2xl p-8 md:p-10 relative overflow-hidden border border-zinc-800">
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 90% 50%, rgba(225,6,0,0.12) 0%, transparent 55%)' }} />
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-[2px] bg-[#E10600]"></div>
                  <span className="text-[#E10600] text-xs font-bold tracking-[0.25em] uppercase font-inter">{t('brands_cta_eyebrow')}</span>
                </div>
                <h3 className="font-unbounded font-bold text-white text-lg md:text-xl leading-tight mb-2">
                  {t('brands_cta_publish')}
                </h3>
                <p className="text-white/70 text-sm font-inter leading-relaxed max-w-md">
                  {t('brands_empty_registered_desc')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <a
                  href="/auth"
                  className="inline-flex items-center justify-center gap-2 bg-[#E10600] text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap font-inter shadow-lg shadow-red-600/30"
                >
                  <i className="ri-user-add-line"></i>
                  {t('brands_create_account')}
                </a>
                <a
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 border border-white/25 text-white font-semibold text-sm px-6 py-3 rounded-xl hover:border-white/50 hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap font-inter"
                >
                  {t('brands_go_dashboard')}
                  <i className="ri-arrow-right-line"></i>
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}