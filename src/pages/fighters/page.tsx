import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, Fighter } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useSEO } from '@/hooks/useSEO';
import FighterCard from './components/FighterCard';
import FightersFilters, { Filters } from './components/FightersFilters';
import FeaturedFighters from './components/FeaturedFighters';

interface FighterWithProfile {
  fighter: Fighter;
  profile: Profile;
}

const defaultFilters: Filters = {
  discipline: '',
  weightClass: '',
  expLevel: '',
  available: false,
  hasSocial: false,
  location: '',
  popularity: '',
  search: '',
};

function getSocialCount(profile: Profile): number {
  return [profile.instagram, profile.tiktok, profile.youtube, profile.twitter].filter(Boolean).length;
}

// Detectar país por IP usando api gratuita
async function detectCountryByIP(): Promise<string> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const json = await res.json();
    return json.country_name || '';
  } catch {
    return '';
  }
}

// Normalizar valores incorrectos de nationality (texto libre → país correcto)
const NORMALIZE_COUNTRY: Record<string, string> = {
  'peruano': 'Perú', 'peruana': 'Perú', 'peru': 'Perú',
  'chileno': 'Chile', 'chilena': 'Chile',
  'venezolano': 'Venezuela', 'venezolana': 'Venezuela', 'venezuela': 'Venezuela',
  'colombiano': 'Colombia', 'colombiana': 'Colombia',
  'argentino': 'Argentina', 'argentina': 'Argentina',
  'español': 'España', 'española': 'España', 'espana': 'España', 'spain': 'España',
  'mexicano': 'México', 'mexicana': 'México', 'mexico': 'México',
  'ecuatoriano': 'Ecuador', 'ecuatoriana': 'Ecuador',
  'boliviano': 'Bolivia', 'boliviana': 'Bolivia',
  'uruguayo': 'Uruguay', 'uruguaya': 'Uruguay',
  'paraguayo': 'Paraguay', 'paraguaya': 'Paraguay',
  'cubano': 'Cuba', 'cubana': 'Cuba',
  'dominicano': 'República Dominicana', 'dominicana': 'República Dominicana',
  'guatemalteco': 'Guatemala', 'guatemalteca': 'Guatemala',
  'hondureño': 'Honduras', 'hondureña': 'Honduras',
  'salvadoreño': 'El Salvador', 'salvadoreña': 'El Salvador',
  'nicaragüense': 'Nicaragua',
  'costarricense': 'Costa Rica',
  'panameño': 'Panamá', 'panameña': 'Panamá',
  'brasileño': 'Brasil', 'brasileña': 'Brasil', 'brasil': 'Brasil',
  'ucraniano': 'Ucrania', 'ucrania': 'Ucrania',
  'portugués': 'Portugal', 'portuguesa': 'Portugal',
  'francés': 'Francia', 'francesa': 'Francia',
  'alemán': 'Alemania', 'alemana': 'Alemania',
  'italiano': 'Italia', 'italiana': 'Italia',
  'inglés': 'Reino Unido', 'inglesa': 'Reino Unido', 'british': 'Reino Unido',
  'marroquí': 'Marruecos', 'marruecos': 'Marruecos',
};

function normalizeCountry(raw: string): string {
  if (!raw) return '';
  const key = raw.trim().toLowerCase();
  return NORMALIZE_COUNTRY[key] || raw.trim();
}

// Mapeo de nombres de país en inglés a español
const COUNTRY_MAP: Record<string, string> = {
  'Spain': 'España',
  'Mexico': 'México',
  'Argentina': 'Argentina',
  'Colombia': 'Colombia',
  'Chile': 'Chile',
  'Peru': 'Perú',
  'Venezuela': 'Venezuela',
  'Ecuador': 'Ecuador',
  'Bolivia': 'Bolivia',
  'Uruguay': 'Uruguay',
  'Paraguay': 'Paraguay',
  'Cuba': 'Cuba',
  'Dominican Republic': 'República Dominicana',
  'Puerto Rico': 'Puerto Rico',
  'Guatemala': 'Guatemala',
  'Honduras': 'Honduras',
  'El Salvador': 'El Salvador',
  'Nicaragua': 'Nicaragua',
  'Costa Rica': 'Costa Rica',
  'Panama': 'Panamá',
  'Brazil': 'Brasil',
  'United States': 'Estados Unidos',
  'United Kingdom': 'Reino Unido',
  'France': 'Francia',
  'Germany': 'Alemania',
  'Italy': 'Italia',
  'Portugal': 'Portugal',
  'Netherlands': 'Países Bajos',
  'Belgium': 'Bélgica',
  'Switzerland': 'Suiza',
  'Austria': 'Austria',
  'Poland': 'Polonia',
  'Romania': 'Rumanía',
  'Ukraine': 'Ucrania',
  'Russia': 'Rusia',
  'Morocco': 'Marruecos',
  'Algeria': 'Argelia',
  'Senegal': 'Senegal',
  'Nigeria': 'Nigeria',
  'Philippines': 'Filipinas',
  'Japan': 'Japón',
  'South Korea': 'Corea del Sur',
  'Thailand': 'Tailandia',
  'Australia': 'Australia',
};

export default function FightersDirectoryPage() {
  useSEO({
    title: 'Directorio de Peleadores | RANKD',
    description: 'Descubre peleadores de boxeo, MMA, kickboxing y muay thai. Filtra por país, disciplina y categoría de peso. Encuentra al próximo campeón en RANKD.',
  });

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile: userProfile } = useAuth();
  const [data, setData] = useState<FighterWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sortBy, setSortBy] = useState('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [userCountry, setUserCountry] = useState<string>('');

  // Detectar país del usuario
  useEffect(() => {
    const detectCountry = async () => {
      // Si el usuario está logueado y tiene country guardado, usarlo directamente
      if ((userProfile as any)?.country) {
        const country = (userProfile as any).country;
        setUserCountry(country);
        setFilters(f => ({ ...f, location: country }));
        return;
      }
      // Si no, detectar por IP
      const ipCountry = await detectCountryByIP();
      const mapped = COUNTRY_MAP[ipCountry] || ipCountry;
      if (mapped) {
        setUserCountry(mapped);
        setFilters(f => ({ ...f, location: mapped }));
      }
    };

    detectCountry();
  }, [userProfile]);

  useEffect(() => {
    const load = async () => {
      const { data: fighters } = await supabase
        .from('fighters')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (!fighters || fighters.length === 0) { setLoading(false); return; }

      const profileIds = fighters.map((f) => f.profile_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', profileIds);

      if (!profiles) { setLoading(false); return; }

      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      const combined: FighterWithProfile[] = fighters
        .map((f) => ({ fighter: f, profile: profileMap.get(f.profile_id) as Profile }))
        .filter((item) => item.profile);

      setData(combined);
      setLoading(false);
    };
    load();
  }, []);

  const locations = useMemo(() => {
    const locs = new Set<string>();
    data.forEach(({ profile, fighter }) => {
      const country = (profile as any).country || normalizeCountry(fighter.nationality || '');
      if (country) locs.add(country);
    });
    return Array.from(locs).sort();
  }, [data]);

  const filtered = useMemo(() => {
    let result = data.filter(({ fighter, profile }) => {
      if (filters.discipline && fighter.discipline !== filters.discipline) return false;
      if (filters.weightClass && fighter.weight_class !== filters.weightClass) return false;
      if (filters.expLevel && fighter.experience_level !== filters.expLevel) return false;
      if (filters.available && !fighter.is_available) return false;

      if (filters.location) {
        const loc = filters.location.toLowerCase();
        const country = ((profile as any).country || normalizeCountry(fighter.nationality || '')).toLowerCase();
        if (!country.includes(loc)) return false;
      }

      const socialCount = getSocialCount(profile);
      if (filters.hasSocial && socialCount === 0) return false;
      if (filters.popularity === 'high' && socialCount < 3) return false;
      if (filters.popularity === 'medium' && (socialCount < 1 || socialCount >= 3)) return false;
      if (filters.popularity === 'none' && socialCount > 0) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const name = (profile.full_name || '').toLowerCase();
        const nick = (fighter.nickname || '').toLowerCase();
        const gym = (fighter.gym || '').toLowerCase();
        const nat = (fighter.nationality || '').toLowerCase();
        const loc = (profile.location || '').toLowerCase();
        if (!name.includes(q) && !nick.includes(q) && !gym.includes(q) && !nat.includes(q) && !loc.includes(q)) return false;
      }

      return true;
    });

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'wins') return b.fighter.wins - a.fighter.wins;
      if (sortBy === 'social') return getSocialCount(b.profile) - getSocialCount(a.profile);
      if (sortBy === 'available') {
        if (a.fighter.is_available && !b.fighter.is_available) return -1;
        if (!a.fighter.is_available && b.fighter.is_available) return 1;
        return 0;
      }
      return 0;
    });

    return result;
  }, [data, filters, sortBy, userCountry]);

  const disciplineLabels: Record<string, string> = {
    boxing: t('disc_boxing'), mma: t('disc_mma'), kickboxing: t('disc_kickboxing'),
    muay_thai: t('disc_muay_thai'), wrestling: t('disc_wrestling'), bjj: t('disc_bjj'), other: t('disc_other'),
  };
  const expLabels: Record<string, string> = {
    amateur: t('exp_amateur'), semi_pro: t('exp_semipro'), professional: t('exp_professional'),
  };

  const activeFilterCount = [
    filters.discipline, filters.weightClass, filters.expLevel, filters.location, filters.popularity,
    filters.available ? 'x' : '', filters.hasSocial ? 'x' : '',
  ].filter(Boolean).length;

  // Explorar por disciplina: entradas visuales con recuento real
  const DISCIPLINE_TILES = [
    { value: 'boxing', label: t('disc_boxing'), icon: 'ri-boxing-line' },
    { value: 'mma', label: t('disc_mma'), icon: 'ri-sword-line' },
    { value: 'kickboxing', label: t('disc_kickboxing'), icon: 'ri-run-line' },
    { value: 'muay_thai', label: t('disc_muay_thai'), icon: 'ri-boxing-fill' },
    { value: 'bjj', label: t('disc_bjj'), icon: 'ri-shirt-line' },
    { value: 'wrestling', label: t('disc_wrestling'), icon: 'ri-shake-hands-line' },
  ];
  const disciplineCounts = useMemo(() => {
    const m: Record<string, number> = {};
    data.forEach(({ fighter }) => { if (fighter.discipline) m[fighter.discipline] = (m[fighter.discipline] || 0) + 1; });
    return m;
  }, [data]);
  const availableCount = useMemo(() => data.filter((d) => d.fighter.is_available).length, [data]);

  return (
    <div className="min-h-screen bg-[#070707]">
      {/* Top bar */}
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 rk-safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-0 cursor-pointer py-2">
            <span className="font-unbounded font-black tracking-tighter leading-none text-[18px] text-white" style={{ letterSpacing: '-0.04em' }}>RAN</span>
            <span className="font-unbounded font-black tracking-tighter leading-none text-[18px] text-[#E10600]" style={{ letterSpacing: '-0.04em' }}>KD</span>
          </a>
          <nav className="hidden md:flex items-center gap-6">
            <a href="/" className="text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer">{t('fighters_dir_home')}</a>
            <a href="/fighters" className="text-sm font-semibold text-red-500 cursor-pointer">{t('nav_directory')}</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {userProfile ? (
              <button onClick={() => navigate('/dashboard')} className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl cursor-pointer whitespace-nowrap transition-colors">
                Mi perfil
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/auth')} className="hidden sm:block text-sm text-zinc-300 hover:text-white cursor-pointer whitespace-nowrap transition-colors">
                  {t('fighters_dir_login')}
                </button>
                <button onClick={() => navigate('/auth')} className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl cursor-pointer whitespace-nowrap transition-colors shadow-lg shadow-red-600/30">
                  {t('fighters_dir_join')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="pt-16">
        {/* Hero */}
        <div className="relative bg-[#050505] overflow-hidden rk-grid-bg">
          {/* Foto de fondo (Unsplash, licencia libre, uso comercial) + oscurecido para legibilidad */}
          <img src="/images/guantes.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ opacity: 0.2, objectPosition: 'center 35%' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(5,5,5,0.8) 0%, rgba(5,5,5,0.55) 45%, rgba(5,5,5,0.97) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 72% 45%, rgba(225,6,0,0.16) 0%, transparent 55%)' }} />
          <div className="absolute top-0 right-0 w-1/2 h-full" style={{ background: 'radial-gradient(ellipse at 100% 0%, rgba(201,168,76,0.06) 0%, transparent 60%)' }} />
          <div className="absolute inset-0" style={{ maskImage: 'linear-gradient(to bottom, black, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)' }} />
          <div className="rk-topline" />
          <span aria-hidden="true" className="pointer-events-none select-none absolute -right-6 bottom-0 hidden md:block" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(120px,16vw,260px)', lineHeight: 0.7, color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.04)' }}>RANKD</span>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-24">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="rk-index">{t('fd_roster')}</span>
                <span style={{ flex: '0 0 34px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
                <span className="rk-eyebrow">{t('fd_directory')}</span>
                {data.length > 0 && (
                  <span className="text-xs text-zinc-400">· {data.length} {t('fighters_dir_registered')}</span>
                )}
              </div>
              <h1 className="rk-h1" style={{ color: '#fff', margin: 0 }}>
                {t('fighters_dir_discover')}<br />
                <span className="rk-red-glow">{t('fighters_dir_champion')}</span>
              </h1>
              <div className="rk-rule" style={{ width: 88, margin: '20px 0' }} />
              <p className="rk-body max-w-lg" style={{ margin: 0 }}>
                {t('fighters_dir_desc')}
              </p>
            </div>
          </div>
        </div>

        {/* Destacados — zona a seguir, distinta del grid (regla: nada de scroll plano).
            Se oculta si el usuario filtra o busca (el país autodetectado NO cuenta:
            es un valor por defecto, no una elección). */}
        {!loading && data.length > 0 && !filters.search && sortBy === 'recent'
          && !filters.discipline && !filters.weightClass && !filters.expLevel
          && !filters.available && !filters.hasSocial && !filters.popularity && (
          <FeaturedFighters items={data} />
        )}

        {/* Búsqueda sticky — siempre visible al scrollear (D.1) */}
        {!loading && data.length > 0 && (
          <div
            className="sticky z-30 bg-[#070707]/95 backdrop-blur border-b border-white/[0.06]"
            style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"></i>
                  <input
                    value={filters.search}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                    placeholder={t('fighters_dir_search_ph')}
                    style={{ fontSize: 16, minHeight: 44 }}
                    className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl pl-10 pr-10 focus:outline-none focus:border-red-500 placeholder-zinc-500"
                  />
                  {filters.search && (
                    <button
                      onClick={() => setFilters((f) => ({ ...f, search: '' }))}
                      aria-label={t('mc_clear') || 'Limpiar'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white cursor-pointer"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  )}
                </div>
                {/* Botón "Filtros" solo en móvil: en desktop el sidebar ya se ve */}
                <button
                  onClick={() => setFiltersOpen(true)}
                  style={{ minHeight: 44 }}
                  className="lg:hidden flex-shrink-0 flex items-center gap-1.5 px-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-semibold text-zinc-300 hover:text-white cursor-pointer relative"
                >
                  <i className="ri-equalizer-line"></i>
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Explorar por disciplina — entrada visual, no lista plana */}
        {!loading && data.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 pt-7">
            <div className="flex items-center gap-3 mb-3">
              <span className="rk-eyebrow">{t('fd_explore_by')}</span>
              <span style={{ flex: '0 0 28px', height: 1, background: 'rgba(255,255,255,0.14)' }} />
              <span className="text-xs text-zinc-500">{t('fd_discipline')}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {DISCIPLINE_TILES.map((d) => {
                const count = disciplineCounts[d.value] || 0;
                const active = filters.discipline === d.value;
                return (
                  <button key={d.value} onClick={() => setFilters((f) => ({ ...f, discipline: active ? '' : d.value }))}
                    className={`group relative rounded-2xl border p-3.5 text-left transition-all cursor-pointer overflow-hidden ${active ? 'border-red-500/50 bg-red-600/[0.1]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'}`}>
                    <div className="absolute -right-2 -top-3 opacity-[0.06] group-hover:opacity-10 transition-opacity" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 60, lineHeight: 1 }}>{count}</div>
                    <i className={`${d.icon} text-xl ${active ? 'text-red-400' : 'text-zinc-400 group-hover:text-white'} transition-colors`}></i>
                    <p className="text-sm font-bold text-white mt-2 leading-tight">{d.label}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{count} {count === 1 ? t('fd_fighter_one') : t('fd_fighter_other')}</p>
                  </button>
                );
              })}
            </div>
            {/* Atajos rápidos */}
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => setFilters((f) => ({ ...f, available: !f.available }))}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${filters.available ? 'bg-green-500/15 border-green-500/35 text-green-300' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>{t('fd_available_now')} · {availableCount}
              </button>
              <button onClick={() => setSortBy('wins')}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${sortBy === 'wins' ? 'bg-red-600/15 border-red-500/35 text-red-300' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'}`}>
                <i className="ri-trophy-line"></i>{t('fd_most_wins')}
              </button>
              <button onClick={() => setSortBy('social')}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${sortBy === 'social' ? 'bg-[#C9A84C]/15 border-[#C9A84C]/35 text-[#C9A84C]' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'}`}>
                <i className="ri-global-line"></i>{t('fd_most_social')}
              </button>
              {(filters.discipline || filters.available || sortBy !== 'recent') && (
                <button onClick={() => { setFilters(defaultFilters); setSortBy('recent'); }}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer">
                  <i className="ri-close-line"></i>{t('fd_clear')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-8">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Sidebar filters */}
            <FightersFilters
              filters={filters}
              onChange={setFilters}
              total={data.length}
              filtered={filtered.length}
              locations={locations}
              sortBy={sortBy}
              onSortChange={setSortBy}
              isOpen={filtersOpen}
              onToggle={() => setFiltersOpen((v) => !v)}
            />

            {/* Results */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2 sm:gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {loading ? t('fighters_dir_loading') : (
                      filtered.length === 0 ? t('fighters_dir_no_results') :
                      `${filtered.length} ${filtered.length === 1 ? t('fighters_dir_count_single') : t('fighters_dir_count_plural')}`
                    )}
                  </p>
                  {activeFilterCount > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {filters.discipline && (
                        <span className="flex items-center gap-1 text-xs bg-red-600/15 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-full">
                          {disciplineLabels[filters.discipline] || filters.discipline}
                          <button onClick={() => setFilters((f) => ({ ...f, discipline: '' }))} className="cursor-pointer hover:text-white -mr-1 p-1.5 inline-flex items-center justify-center"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.weightClass && (
                        <span className="flex items-center gap-1 text-xs bg-white/[0.06] border border-white/12 text-zinc-300 px-2.5 py-1 rounded-full">
                          {filters.weightClass}
                          <button onClick={() => setFilters((f) => ({ ...f, weightClass: '' }))} className="cursor-pointer hover:text-white -mr-1 p-1.5 inline-flex items-center justify-center"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.expLevel && (
                        <span className="flex items-center gap-1 text-xs bg-white/[0.06] border border-white/12 text-zinc-300 px-2.5 py-1 rounded-full">
                          {expLabels[filters.expLevel] || filters.expLevel}
                          <button onClick={() => setFilters((f) => ({ ...f, expLevel: '' }))} className="cursor-pointer hover:text-white -mr-1 p-1.5 inline-flex items-center justify-center"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.location && (
                        <span className="flex items-center gap-1 text-xs bg-white/[0.06] border border-white/12 text-zinc-300 px-2.5 py-1 rounded-full">
                          <i className="ri-map-pin-line text-xs"></i>{filters.location}
                          <button onClick={() => setFilters((f) => ({ ...f, location: '' }))} className="cursor-pointer hover:text-white -mr-1 p-1.5 inline-flex items-center justify-center"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.available && (
                        <span className="flex items-center gap-1 text-xs bg-green-500/12 border border-green-500/30 text-green-400 px-2.5 py-1 rounded-full">
                          {t('fighters_dir_available')}
                          <button onClick={() => setFilters((f) => ({ ...f, available: false }))} className="cursor-pointer hover:text-white -mr-1 p-1.5 inline-flex items-center justify-center"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.hasSocial && (
                        <span className="flex items-center gap-1 text-xs bg-pink-500/12 border border-pink-500/30 text-pink-400 px-2.5 py-1 rounded-full">
                          {t('fighters_dir_with_social')}
                          <button onClick={() => setFilters((f) => ({ ...f, hasSocial: false }))} className="cursor-pointer hover:text-white -mr-1 p-1.5 inline-flex items-center justify-center"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.popularity && (
                        <span className="flex items-center gap-1 text-xs bg-orange-500/12 border border-orange-500/30 text-orange-400 px-2.5 py-1 rounded-full">
                          <i className="ri-star-line text-xs"></i>
                          {filters.popularity === 'high' ? t('fighters_dir_high_pop') : filters.popularity === 'medium' ? t('fighters_dir_med_pop') : t('fighters_dir_no_social')}
                          <button onClick={() => setFilters((f) => ({ ...f, popularity: '' }))} className="cursor-pointer hover:text-white -mr-1 p-1.5 inline-flex items-center justify-center"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}
                  >
                    <i className="ri-grid-line text-sm"></i>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}
                  >
                    <i className="ri-list-check-2 text-sm"></i>
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : data.length === 0 ? (
                <div className="text-center py-24 rk-card">
                  <div className="w-20 h-20 flex items-center justify-center mx-auto mb-5 rounded-2xl bg-red-600/10 border border-red-500/25">
                    <i className="ri-user-search-line text-4xl text-red-400"></i>
                  </div>
                  <h2 className="rk-h3 text-white mb-2">{t('fighters_dir_empty_title')}</h2>
                  <p className="text-sm text-zinc-400 mb-6 max-w-sm mx-auto">{t('fighters_dir_empty_desc')}</p>
                  <button onClick={() => navigate('/auth')} className="rk-btn rk-btn-primary" style={{ fontSize: '0.9rem' }}>
                    {t('fighters_dir_empty_btn')}
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-24 rk-card">
                  <div className="w-20 h-20 flex items-center justify-center mx-auto mb-5 rounded-2xl bg-white/[0.04] border border-white/10">
                    <i className="ri-filter-off-line text-4xl text-zinc-500"></i>
                  </div>
                  <h2 className="rk-h3 text-white mb-2">{t('fighters_dir_no_filter_title')}</h2>
                  <p className="text-sm text-zinc-400 mb-4 max-w-sm mx-auto">{t('fighters_dir_no_filter_desc')}</p>
                  <button
                    onClick={() => setFilters(defaultFilters)}
                    className="rk-btn rk-btn-ghost" style={{ fontSize: '0.85rem', padding: '0.7rem 1.4rem' }}
                  >
                    {t('fighters_dir_clear_filters')}
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filtered.map(({ fighter, profile }, i) => (
                    <div key={fighter.id} className="anim-fade-up" style={{ animationDelay: `${Math.min(i * 0.06, 0.5)}s` }}>
                      <FighterCard fighter={fighter} profile={profile} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(({ fighter, profile }) => {
                    const initials = (profile.full_name || 'F').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                    const socialCount = getSocialCount(profile);
                    return (
                      <article
                        key={fighter.id}
                        onClick={() => navigate(`/fighter/${fighter.id}`)}
                        className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex items-center gap-4 hover:border-red-500/40 hover:bg-white/[0.05] transition-all cursor-pointer group"
                      >
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt={profile.full_name || ''} className="w-14 h-14 rounded-xl object-cover object-top flex-shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white flex-shrink-0" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>
                            {initials}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors truncate">
                              {profile.full_name || t('fd_fighter_fallback')}
                            </h3>
                            {fighter.nickname && (
                              <span className="text-xs text-red-400 italic hidden sm:inline">&ldquo;{fighter.nickname}&rdquo;</span>
                            )}
                            {fighter.is_available && (
                              <span className="flex items-center gap-1 text-xs bg-green-500/12 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                Disponible
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {fighter.discipline && <span className="text-xs text-zinc-400">{disciplineLabels[fighter.discipline] || fighter.discipline}</span>}
                            {fighter.weight_class && <span className="text-xs text-zinc-500">{fighter.weight_class}</span>}
                            {(fighter.nationality || profile.location) && (
                              <span className="flex items-center gap-1 text-xs text-zinc-500">
                                <i className="ri-map-pin-line"></i>
                                {fighter.nationality || profile.location}
                              </span>
                            )}
                            {fighter.gym && <span className="flex items-center gap-1 text-xs text-zinc-500 hidden sm:flex"><i className="ri-building-4-line"></i>{fighter.gym}</span>}
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-3 flex-shrink-0" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                          <div className="text-center"><p className="text-lg text-green-400 leading-none">{fighter.wins}</p><p className="text-[10px] text-zinc-500 mt-0.5">V</p></div>
                          <div className="text-center"><p className="text-lg text-red-400 leading-none">{fighter.losses}</p><p className="text-[10px] text-zinc-500 mt-0.5">D</p></div>
                          <div className="text-center"><p className="text-lg text-orange-400 leading-none">{fighter.kos}</p><p className="text-[10px] text-zinc-500 mt-0.5">KO</p></div>
                        </div>
                        {socialCount > 0 && (
                          <div className="hidden md:flex items-center gap-1 flex-shrink-0">
                            {profile.instagram && <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-pink-500/15 text-pink-400 text-xs"><i className="ri-instagram-line"></i></span>}
                            {profile.tiktok && <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300 text-xs"><i className="ri-tiktok-line"></i></span>}
                            {profile.youtube && <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/15 text-red-400 text-xs"><i className="ri-youtube-line"></i></span>}
                            {profile.twitter && <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300 text-xs"><i className="ri-twitter-x-line"></i></span>}
                          </div>
                        )}
                        <i className="ri-arrow-right-line text-zinc-600 group-hover:text-red-400 transition-colors flex-shrink-0"></i>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}