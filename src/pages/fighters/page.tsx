import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, Fighter } from '@/lib/supabase';
import FighterCard from './components/FighterCard';
import FightersFilters, { Filters } from './components/FightersFilters';

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

export default function FightersDirectoryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState<FighterWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sortBy, setSortBy] = useState('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

  // Extract unique locations from data
  const locations = useMemo(() => {
    const locs = new Set<string>();
    data.forEach(({ profile, fighter }) => {
      if (profile.location) locs.add(profile.location);
      if (fighter.nationality) locs.add(fighter.nationality);
    });
    return Array.from(locs).sort();
  }, [data]);

  const filtered = useMemo(() => {
    let result = data.filter(({ fighter, profile }) => {
      if (filters.discipline && fighter.discipline !== filters.discipline) return false;
      if (filters.weightClass && fighter.weight_class !== filters.weightClass) return false;
      if (filters.expLevel && fighter.experience_level !== filters.expLevel) return false;
      if (filters.available && !fighter.is_available) return false;

      // Location filter — match against profile.location or fighter.nationality
      if (filters.location) {
        const loc = filters.location.toLowerCase();
        const profileLoc = (profile.location || '').toLowerCase();
        const nat = (fighter.nationality || '').toLowerCase();
        if (!profileLoc.includes(loc) && !nat.includes(loc)) return false;
      }

      // Social / popularity filter
      const socialCount = getSocialCount(profile);
      if (filters.hasSocial && socialCount === 0) return false;
      if (filters.popularity === 'high' && socialCount < 3) return false;
      if (filters.popularity === 'medium' && (socialCount < 1 || socialCount >= 3)) return false;
      if (filters.popularity === 'none' && socialCount > 0) return false;

      // Search
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
      // recent: already ordered by created_at from DB
      return 0;
    });

    return result;
  }, [data, filters, sortBy]);

  const disciplineLabels: Record<string, string> = {
    boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
    muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
  };
  const expLabels: Record<string, string> = {
    amateur: 'Amateur', semi_pro: 'Semi-Pro', professional: 'Profesional',
  };

  const activeFilterCount = [
    filters.discipline, filters.weightClass, filters.expLevel, filters.location, filters.popularity,
    filters.available ? 'x' : '', filters.hasSocial ? 'x' : '',
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar */}
      <div className="fixed top-0 left-0 w-full z-40 bg-white border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-0 cursor-pointer">
            <span className="font-unbounded font-black tracking-tighter leading-none text-[18px] text-zinc-900" style={{ letterSpacing: '-0.04em' }}>RAN</span>
            <span className="font-unbounded font-black tracking-tighter leading-none text-[18px] text-[#E10600]" style={{ letterSpacing: '-0.04em' }}>KD</span>
          </a>
          <nav className="hidden md:flex items-center gap-6">
            <a href="/" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer">{t('fighters_dir_home')}</a>
            <a href="/fighters" className="text-sm font-semibold text-red-600 cursor-pointer">{t('nav_directory')}</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => navigate('/auth')} className="hidden sm:block text-sm text-zinc-600 hover:text-zinc-900 cursor-pointer whitespace-nowrap transition-colors">
              {t('fighters_dir_login')}
            </button>
            <button onClick={() => navigate('/auth')} className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl cursor-pointer whitespace-nowrap transition-colors">
              {t('fighters_dir_join')}
            </button>
          </div>
        </div>
      </div>

      <div className="pt-16">
        {/* Hero */}
        <div className="relative bg-zinc-950 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: 'url(https://readdy.ai/api/search-image?query=professional%20combat%20sports%20fighters%20silhouettes%20dramatic%20arena%20lighting%20dark%20atmospheric%20boxing%20MMA%20kickboxing%20multiple%20athletes%20training%20gym&width=1400&height=400&seq=fdir1&orientation=landscape)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-zinc-950/60" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-8 sm:py-12 md:py-16">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <span className="text-xs font-bold bg-red-600 text-white px-3 py-1 rounded-full uppercase tracking-wider">{t('nav_directory')}</span>
                {data.length > 0 && (
                  <span className="text-xs text-zinc-400">{data.length} {t('fighters_dir_registered')}</span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white leading-tight">
                {t('fighters_dir_discover')}<br />
                <strong className="text-red-500">{t('fighters_dir_champion')}</strong>
              </h1>
              <p className="text-zinc-400 text-sm md:text-base mt-3 sm:mt-4 leading-relaxed max-w-lg">
                {t('fighters_dir_desc')}
              </p>
            </div>
          </div>
        </div>

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
              {/* Results header */}
              <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2 sm:gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-800">
                    {loading ? t('fighters_dir_loading') : (
                      filtered.length === 0 ? t('fighters_dir_no_results') :
                      `${filtered.length} ${filtered.length === 1 ? t('fighters_dir_count_single') : t('fighters_dir_count_plural')}`
                    )}
                  </p>
                  {/* Active filter chips */}
                  {activeFilterCount > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {filters.discipline && (
                        <span className="flex items-center gap-1 text-xs bg-red-50 border border-red-100 text-red-600 px-2.5 py-1 rounded-full">
                          {disciplineLabels[filters.discipline] || filters.discipline}
                          <button onClick={() => setFilters((f) => ({ ...f, discipline: '' }))} className="cursor-pointer hover:text-red-800 ml-0.5"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.weightClass && (
                        <span className="flex items-center gap-1 text-xs bg-zinc-100 border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full">
                          {filters.weightClass}
                          <button onClick={() => setFilters((f) => ({ ...f, weightClass: '' }))} className="cursor-pointer hover:text-zinc-800 ml-0.5"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.expLevel && (
                        <span className="flex items-center gap-1 text-xs bg-zinc-100 border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full">
                          {expLabels[filters.expLevel] || filters.expLevel}
                          <button onClick={() => setFilters((f) => ({ ...f, expLevel: '' }))} className="cursor-pointer hover:text-zinc-800 ml-0.5"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.location && (
                        <span className="flex items-center gap-1 text-xs bg-zinc-100 border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full">
                          <i className="ri-map-pin-line text-xs"></i>{filters.location}
                          <button onClick={() => setFilters((f) => ({ ...f, location: '' }))} className="cursor-pointer hover:text-zinc-800 ml-0.5"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.available && (
                        <span className="flex items-center gap-1 text-xs bg-green-50 border border-green-100 text-green-600 px-2.5 py-1 rounded-full">
                          {t('fighters_dir_available')}
                          <button onClick={() => setFilters((f) => ({ ...f, available: false }))} className="cursor-pointer hover:text-green-800 ml-0.5"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.hasSocial && (
                        <span className="flex items-center gap-1 text-xs bg-pink-50 border border-pink-100 text-pink-600 px-2.5 py-1 rounded-full">
                          {t('fighters_dir_with_social')}
                          <button onClick={() => setFilters((f) => ({ ...f, hasSocial: false }))} className="cursor-pointer hover:text-pink-800 ml-0.5"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                      {filters.popularity && (
                        <span className="flex items-center gap-1 text-xs bg-orange-50 border border-orange-100 text-orange-600 px-2.5 py-1 rounded-full">
                          <i className="ri-star-line text-xs"></i>
                          {filters.popularity === 'high' ? t('fighters_dir_high_pop') : filters.popularity === 'medium' ? t('fighters_dir_med_pop') : t('fighters_dir_no_social')}
                          <button onClick={() => setFilters((f) => ({ ...f, popularity: '' }))} className="cursor-pointer hover:text-orange-800 ml-0.5"><i className="ri-close-line text-xs"></i></button>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700'}`}
                  >
                    <i className="ri-grid-line text-sm"></i>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700'}`}
                  >
                    <i className="ri-list-check-2 text-sm"></i>
                  </button>
                </div>
              </div>

              {/* Content */}
              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : data.length === 0 ? (
                <div className="text-center py-24">
                  <div className="w-20 h-20 flex items-center justify-center mx-auto mb-5 rounded-full bg-zinc-100">
                    <i className="ri-user-search-line text-4xl text-zinc-400"></i>
                  </div>
                  <h2 className="text-xl font-bold text-zinc-800 mb-2">{t('fighters_dir_empty_title')}</h2>
                  <p className="text-sm text-zinc-500 mb-6">{t('fighters_dir_empty_desc')}</p>
                  <button onClick={() => navigate('/auth')} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-6 py-3 rounded-xl cursor-pointer whitespace-nowrap transition-colors">
                    {t('fighters_dir_empty_btn')}
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-24">
                  <div className="w-20 h-20 flex items-center justify-center mx-auto mb-5 rounded-full bg-zinc-100">
                    <i className="ri-filter-off-line text-4xl text-zinc-400"></i>
                  </div>
                  <h2 className="text-xl font-bold text-zinc-800 mb-2">{t('fighters_dir_no_filter_title')}</h2>
                  <p className="text-sm text-zinc-500 mb-4">{t('fighters_dir_no_filter_desc')}</p>
                  <button
                    onClick={() => setFilters(defaultFilters)}
                    className="text-sm bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl cursor-pointer whitespace-nowrap transition-colors"
                  >
                    {t('fighters_dir_clear_filters')}
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filtered.map(({ fighter, profile }) => (
                    <FighterCard key={fighter.id} fighter={fighter} profile={profile} />
                  ))}
                </div>
              ) : (
                /* List view */
                <div className="space-y-3">
                  {filtered.map(({ fighter, profile }) => {
                    const initials = (profile.full_name || 'F').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                    const socialCount = getSocialCount(profile);
                    return (
                      <article
                        key={fighter.id}
                        onClick={() => navigate(`/fighter/${fighter.id}`)}
                        className="bg-white border border-zinc-100 rounded-xl p-4 flex items-center gap-4 hover:border-red-200 hover:shadow-sm transition-all cursor-pointer group"
                      >
                        {/* Avatar */}
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt={profile.full_name || ''} className="w-14 h-14 rounded-xl object-cover object-top flex-shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                            {initials}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-zinc-800 group-hover:text-red-600 transition-colors truncate">
                              {profile.full_name || 'Peleador'}
                            </h3>
                            {fighter.nickname && (
                              <span className="text-xs text-red-400 italic hidden sm:inline">&ldquo;{fighter.nickname}&rdquo;</span>
                            )}
                            {fighter.is_available && (
                              <span className="flex items-center gap-1 text-xs bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                Disponible
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {fighter.discipline && (
                              <span className="text-xs text-zinc-500">{disciplineLabels[fighter.discipline] || fighter.discipline}</span>
                            )}
                            {fighter.weight_class && (
                              <span className="text-xs text-zinc-400">{fighter.weight_class}</span>
                            )}
                            {(fighter.nationality || profile.location) && (
                              <span className="flex items-center gap-1 text-xs text-zinc-400">
                                <i className="ri-map-pin-line"></i>
                                {fighter.nationality || profile.location}
                              </span>
                            )}
                            {fighter.gym && (
                              <span className="flex items-center gap-1 text-xs text-zinc-400 hidden sm:flex">
                                <i className="ri-building-4-line"></i>
                                {fighter.gym}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Record */}
                        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                          <div className="text-center">
                            <p className="text-base font-black text-green-600">{fighter.wins}</p>
                            <p className="text-xs text-zinc-400">V</p>
                          </div>
                          <div className="text-center">
                            <p className="text-base font-black text-red-500">{fighter.losses}</p>
                            <p className="text-xs text-zinc-400">D</p>
                          </div>
                          <div className="text-center">
                            <p className="text-base font-black text-orange-500">{fighter.kos}</p>
                            <p className="text-xs text-zinc-400">KO</p>
                          </div>
                        </div>

                        {/* Social badges */}
                        {socialCount > 0 && (
                          <div className="hidden md:flex items-center gap-1 flex-shrink-0">
                            {profile.instagram && <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-pink-500/20 to-orange-400/20 text-pink-500 text-xs"><i className="ri-instagram-line"></i></span>}
                            {profile.tiktok && <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 text-xs"><i className="ri-tiktok-line"></i></span>}
                            {profile.youtube && <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 text-xs"><i className="ri-youtube-line"></i></span>}
                            {profile.twitter && <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 text-xs"><i className="ri-twitter-x-line"></i></span>}
                          </div>
                        )}

                        <i className="ri-arrow-right-line text-zinc-300 group-hover:text-red-500 transition-colors flex-shrink-0"></i>
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
