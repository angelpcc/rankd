import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Organization, Profile } from '@/lib/supabase';
import { useSEO } from '@/hooks/useSEO';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';
import Reveal from '@/components/base/Reveal';

interface OrgRow {
  org: Organization;
  profile: Profile | null;
  upcomingEvents: number;
  rating?: { avg: number; n: number };
}

type TypeFilter = 'all' | 'promoter' | 'gym' | 'manager';

const TYPE_TILES: { value: Exclude<TypeFilter, 'all'>; labelKey: string; icon: string; descKey: string }[] = [
  { value: 'promoter', labelKey: 'prm_tile_promoter', icon: 'ri-trophy-line', descKey: 'prm_tile_promoter_desc' },
  { value: 'gym', labelKey: 'prm_tile_gym', icon: 'ri-building-4-line', descKey: 'prm_tile_gym_desc' },
  { value: 'manager', labelKey: 'prm_tile_manager', icon: 'ri-user-star-line', descKey: 'prm_tile_manager_desc' },
];

const typeLabelKey: Record<string, string> = {
  promoter: 'prm_type_promoter', gym: 'prm_type_gym', manager: 'prm_type_manager', organizer: 'prm_type_organizer', brand: 'prm_type_brand',
};
const typeCls: Record<string, string> = {
  promoter: 'bg-red-600/15 border-red-500/30 text-red-400',
  gym: 'bg-emerald-500/12 border-emerald-500/30 text-emerald-400',
  manager: 'bg-sky-500/12 border-sky-500/30 text-sky-400',
  organizer: 'bg-white/[0.06] border-white/15 text-zinc-300',
};

export default function PromotorasPage() {
  const { t } = useTranslation();
  useSEO({
    title: 'Promotoras y gimnasios | RANKD',
    description: 'Directorio de promotoras, gimnasios y managers de deportes de combate. Encuentra quién organiza veladas cerca de ti y dónde entrenar.',
  });

  const navigate = useNavigate();
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [location, setLocation] = useState('');
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyWithEvents, setOnlyWithEvents] = useState(false);
  const [sortBy, setSortBy] = useState<'events' | 'name' | 'recent'>('events');

  useEffect(() => {
    const load = async () => {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (!orgs || orgs.length === 0) { setRows([]); setLoading(false); return; }

      const ids = orgs.map((o) => o.profile_id).filter(Boolean);
      const [{ data: profiles }, { data: events }, { data: ratings }] = await Promise.all([
        supabase.from('profiles').select('*').in('id', ids),
        supabase.from('organization_events').select('org_profile_id, event_date').in('org_profile_id', ids),
        supabase.from('org_rating_summary').select('org_profile_id, avg_rating, review_count').in('org_profile_id', ids),
      ]);
      const pmap = new Map((profiles || []).map((p) => [p.id, p]));
      const rmap = new Map((ratings || []).map((r) => [r.org_profile_id, { avg: Number(r.avg_rating) || 0, n: r.review_count || 0 }]));
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const evCount = new Map<string, number>();
      (events || []).forEach((e) => {
        const d = e.event_date ? new Date(e.event_date + 'T12:00:00') : null;
        if (!d || d >= today) evCount.set(e.org_profile_id, (evCount.get(e.org_profile_id) || 0) + 1);
      });

      setRows(orgs
        .filter((o) => o.org_type !== 'brand') // las marcas tienen su propio directorio
        .map((o) => ({ org: o, profile: pmap.get(o.profile_id) || null, upcomingEvents: evCount.get(o.profile_id) || 0, rating: rmap.get(o.profile_id) })));
      setLoading(false);
    };
    load();
  }, []);

  const locations = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.profile?.location) s.add(r.profile.location); });
    return Array.from(s).sort();
  }, [rows]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => { const t = r.org.org_type || 'organizer'; m[t] = (m[t] || 0) + 1; });
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows.filter((r) => {
      if (typeFilter !== 'all' && (r.org.org_type || 'organizer') !== typeFilter) return false;
      if (onlyVerified && !r.org.verified) return false;
      if (onlyWithEvents && r.upcomingEvents === 0) return false;
      if (location && r.profile?.location !== location) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${r.org.org_name || ''} ${r.org.description || ''} ${r.profile?.location || ''} ${r.profile?.full_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sortBy === 'events') return b.upcomingEvents - a.upcomingEvents;
      if (sortBy === 'name') return (a.org.org_name || '').localeCompare(b.org.org_name || '');
      return 0;
    });
    return out;
  }, [rows, typeFilter, onlyVerified, onlyWithEvents, location, search, sortBy]);

  const activeFilters = [typeFilter !== 'all', !!location, onlyVerified, onlyWithEvents].filter(Boolean).length;
  const clearAll = () => { setTypeFilter('all'); setLocation(''); setOnlyVerified(false); setOnlyWithEvents(false); setSearch(''); };

  return (
    <div className="min-h-screen bg-[#070707]">
      <Navbar />

      {/* Hero */}
      <div className="relative overflow-hidden rk-grid-bg" style={{ background: '#050505', paddingTop: 'calc(60px + env(safe-area-inset-top,0px))' }}>
        {/* Foto de fondo (Unsplash, licencia libre, uso comercial) + oscurecido para legibilidad */}
        <img src="/images/evento.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ opacity: 0.19, objectPosition: 'center 55%' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(5,5,5,0.83) 0%, rgba(5,5,5,0.6) 45%, rgba(5,5,5,0.96) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 74% 42%, rgba(225,6,0,0.15) 0%, transparent 56%)' }} />
        <div className="rk-topline" />
        <span aria-hidden="true" className="pointer-events-none select-none absolute -right-6 bottom-0 hidden md:block" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(110px,15vw,220px)', lineHeight: 0.7, color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.04)' }}>CLUBS</span>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-14 md:py-20">
          <div className="flex items-center gap-3 mb-4">
            <span className="rk-index">{t('prm_index')}</span>
            <span style={{ flex: '0 0 30px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
            <span className="rk-eyebrow">{t('prm_eyebrow')}</span>
          </div>
          <h1 className="rk-h1" style={{ color: '#fff', margin: 0 }}>
            {t('prm_title')} <span className="rk-red-glow">{t('prm_title_2')}</span>
          </h1>
          <div className="rk-rule" style={{ width: 88, margin: '20px 0' }} />
          <p className="rk-body max-w-xl" style={{ margin: 0 }}>
            {t('prm_hero_sub')}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8">
        {/* Explorar por tipo */}
        {!loading && rows.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <span className="rk-eyebrow">{t('prm_explore')}</span>
              <span style={{ flex: '0 0 28px', height: 1, background: 'rgba(255,255,255,0.14)' }} />
              <span className="text-xs text-zinc-500">{t('prm_type')}</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {TYPE_TILES.map((tile) => {
                const count = typeCounts[tile.value] || 0;
                const active = typeFilter === tile.value;
                return (
                  <button key={tile.value} onClick={() => setTypeFilter(active ? 'all' : tile.value)}
                    className={`group relative rounded-2xl border p-3.5 text-left transition-all cursor-pointer overflow-hidden ${active ? 'border-red-500/50 bg-red-600/[0.1]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'}`}>
                    <div className="absolute -right-2 -top-3 opacity-[0.06] group-hover:opacity-10 transition-opacity" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 58, lineHeight: 1 }}>{count}</div>
                    <i className={`${tile.icon} text-xl ${active ? 'text-red-400' : 'text-zinc-400 group-hover:text-white'} transition-colors`}></i>
                    <p className="text-sm font-bold text-white mt-2 leading-tight">{t(tile.labelKey)}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{count} · {t(tile.descKey)}</p>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
          <div className="relative flex-1">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"></i>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-11 pr-4 py-2.5 focus:outline-none focus:border-red-500"
              placeholder={t('prm_search_ph')} />
          </div>
          <select value={location} onChange={(e) => setLocation(e.target.value)}
            className="bg-white/[0.04] border border-white/10 text-zinc-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer sm:min-w-[180px]">
            <option value="">{t('prm_all_locations')}</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white/[0.04] border border-white/10 text-zinc-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer sm:min-w-[170px]">
            <option value="events">{t('prm_sort_events')}</option>
            <option value="name">{t('prm_sort_name')}</option>
            <option value="recent">{t('prm_sort_recent')}</option>
          </select>
        </div>

        {/* Atajos */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setOnlyWithEvents((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${onlyWithEvents ? 'bg-red-600/15 border-red-500/35 text-red-300' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'}`}>
            <i className="ri-calendar-event-line"></i>{t('prm_with_events')}
          </button>
          <button onClick={() => setOnlyVerified((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${onlyVerified ? 'bg-green-500/15 border-green-500/35 text-green-300' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'}`}>
            <i className="ri-verified-badge-line"></i>{t('prm_only_verified')}
          </button>
          {activeFilters > 0 && (
            <button onClick={clearAll} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer">
              <i className="ri-close-line"></i>{t('prm_clear')}
            </button>
          )}
          <span className="ml-auto self-center text-xs text-zinc-500">{loading ? t('prm_loading') : t('prm_count', { shown: filtered.length, total: rows.length })}</span>
        </div>

        {/* Resultados */}
        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : rows.length === 0 ? (
          <div className="rk-card text-center" style={{ padding: '64px 24px' }}>
            <div className="w-20 h-20 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
              <i className="ri-trophy-line text-4xl text-red-400"></i>
            </div>
            <h2 className="rk-h3 text-white">{t('prm_empty_title')}</h2>
            <p className="text-sm text-zinc-400 mt-2 max-w-sm mx-auto">{t('prm_empty_desc')}</p>
            <button onClick={() => navigate('/auth')} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem' }}>{t('prm_empty_cta')}</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rk-card text-center" style={{ padding: '56px 24px' }}>
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
              <i className="ri-filter-off-line text-3xl text-zinc-500"></i>
            </div>
            <h2 className="rk-h3 text-white">{t('prm_no_match_title')}</h2>
            <p className="text-sm text-zinc-400 mt-2">{t('prm_no_match_desc')}</p>
            <button onClick={clearAll} className="rk-btn rk-btn-ghost mt-5" style={{ fontSize: '0.8rem', padding: '0.6rem 1.3rem' }}>{t('prm_clear_filters')}</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r, i) => {
              const orgType = r.org.org_type || 'organizer';
              return (
                <Reveal key={r.org.id} delay={Math.min(i, 6) * 50}>
                  <article onClick={() => r.profile && navigate(`/promotora/${r.profile.id}`)} className="rk-card h-full flex flex-col cursor-pointer" style={{ padding: 18 }}>
                    <div className="flex items-start gap-3">
                      {r.profile?.avatar_url || r.org.logo_url ? (
                        <img src={r.org.logo_url || r.profile?.avatar_url || ''} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center flex-shrink-0">
                          <i className={`${TYPE_TILES.find((x) => x.value === orgType)?.icon || 'ri-building-line'} text-zinc-400`}></i>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-white truncate">{r.org.org_name || t('prm_org_fallback')}</h3>
                          {r.org.verified && <i className="ri-verified-badge-fill text-green-400 text-sm" title={t('prm_verified')}></i>}
                        </div>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${typeCls[orgType] || typeCls.organizer}`}>{t(typeLabelKey[orgType] || 'prm_type_organizer')}</span>
                      </div>
                    </div>

                    {r.org.description && <p className="text-xs text-zinc-400 mt-3 leading-relaxed line-clamp-2">{r.org.description}</p>}

                    {/* Datos de un vistazo */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-zinc-500">
                      {r.rating && r.rating.n > 0 && <span className="flex items-center gap-1 text-[#C9A84C]"><i className="ri-star-fill"></i>{r.rating.avg.toFixed(1)} ({r.rating.n})</span>}
                      {r.profile?.location && <span className="flex items-center gap-1"><i className="ri-map-pin-line"></i>{r.profile.location}</span>}
                      {r.org.founded_year && <span className="flex items-center gap-1"><i className="ri-time-line"></i>{t('prm_since')} {r.org.founded_year}</span>}
                      {r.org.fighters_managed > 0 && <span className="flex items-center gap-1"><i className="ri-group-line"></i>{r.org.fighters_managed}</span>}
                    </div>

                    <div className="mt-auto pt-3.5">
                      {r.upcomingEvents > 0 ? (
                        <button onClick={(e) => { e.stopPropagation(); navigate('/eventos'); }} className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600/12 border border-red-500/30 text-red-300 hover:bg-red-600/20 text-xs font-bold py-2.5 transition-colors cursor-pointer">
                          <i className="ri-calendar-event-line"></i>{r.upcomingEvents === 1 ? t('prm_event_one', { n: r.upcomingEvents }) : t('prm_event_many', { n: r.upcomingEvents })}
                        </button>
                      ) : (
                        <div className="w-full text-center text-[11px] text-zinc-600 py-2.5 border border-white/[0.06] rounded-xl">{t('prm_no_events')}</div>
                      )}
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
