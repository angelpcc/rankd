import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';
import { useSEO } from '@/hooks/useSEO';

interface NewsItem {
  title: string;
  link: string;
  description: string;
  image: string | null;
  pubDate: string;
  source: string;
  category: string;
  lang?: string;
}

const CATEGORY_STYLE: Record<string, { grad: string; icon: string; accent: string }> = {
  'Boxeo': { grad: 'linear-gradient(135deg, #1a0505 0%, #2d0a0a 100%)', icon: 'ri-boxing-line', accent: '#E10600' },
  'MMA': { grad: 'linear-gradient(135deg, #0a0f1a 0%, #1a1420 100%)', icon: 'ri-sword-line', accent: '#38bdf8' },
  'default': { grad: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)', icon: 'ri-fire-line', accent: '#C9A84C' },
};

function catStyle(cat: string) {
  return CATEGORY_STYLE[cat] || CATEGORY_STYLE.default;
}

function timeAgo(dateStr: string, t: TFunction, locale: string): string {
  const d = new Date(dateStr).getTime();
  if (!d) return '';
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('news_ago_now');
  if (mins < 60) return t('news_ago_min', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('news_ago_hour', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('news_ago_day', { n: days });
  return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

// "Caliente" = publicado en las últimas 3 horas. Se marca en la tarjeta.
function isHot(dateStr: string): boolean {
  const d = new Date(dateStr).getTime();
  return !!d && Date.now() - d < 3 * 60 * 60 * 1000;
}

/** Marcador cuando la noticia no trae foto: sigue pareciendo RANKD, no un hueco. */
function Placeholder({ category, big }: { category: string; big?: boolean }) {
  const st = catStyle(category);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: st.grad }}>
      <i className={st.icon} style={{ fontSize: big ? 56 : 34, color: 'rgba(225,6,0,0.42)' }}></i>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: big ? 26 : 16, letterSpacing: big ? 6 : 4, color: 'rgba(255,255,255,0.13)' }}>RANKD</span>
    </div>
  );
}

/** Imagen con degradado a fondo y caída elegante al marcador si el medio la borra. */
function NewsImage({ item, big }: { item: NewsItem; big?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!item.image || failed) return <Placeholder category={item.category} big={big} />;
  return (
    <img
      src={item.image}
      alt=""
      loading="lazy"
      className="w-full h-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.07]"
      onError={() => setFailed(true)}
    />
  );
}

/** Esqueletos de carga: la página ya tiene su forma antes de que lleguen los datos. */
function Skeletons() {
  return (
    <>
      <div className="mb-6 rounded-3xl overflow-hidden border border-white/[0.06] grid md:grid-cols-[1.15fr_1fr]">
        <div className="h-56 md:h-[320px] rk-skeleton" />
        <div className="p-7 space-y-3">
          <div className="h-3 w-28 rounded rk-skeleton" />
          <div className="h-6 w-full rounded rk-skeleton" />
          <div className="h-6 w-4/5 rounded rk-skeleton" />
          <div className="h-3 w-full rounded rk-skeleton mt-4" />
          <div className="h-3 w-2/3 rounded rk-skeleton" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden border border-white/[0.06]">
            <div className="h-40 rk-skeleton" />
            <div className="p-4 space-y-2.5">
              <div className="h-2.5 w-24 rounded rk-skeleton" />
              <div className="h-4 w-full rounded rk-skeleton" />
              <div className="h-4 w-3/4 rounded rk-skeleton" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const PAGE_SIZE = 12;

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [cat, setCat] = useState<'all' | 'Boxeo' | 'MMA' | 'es'>('all');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  useSEO({
    title: 'Noticias de Boxeo y MMA | RANKD',
    description: 'Últimas noticias del boxeo, MMA y deportes de contacto. Titulares de los mejores medios, reunidos y actualizados al momento en RANKD.',
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(false);
    try {
      const res = await fetch('/api/news');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: NewsItem[] = data.items || [];
      setItems(list);
      setUpdatedAt(data.updatedAt || new Date().toISOString());
      if (list.length === 0) setError(true);
    } catch {
      setError(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Al cambiar de filtro volvemos al primer bloque: si no, el "ver más" queda descolocado.
  useEffect(() => { setVisible(PAGE_SIZE); }, [cat, query]);

  const counts = useMemo(() => ({
    all: items.length,
    Boxeo: items.filter((i) => i.category === 'Boxeo').length,
    MMA: items.filter((i) => i.category === 'MMA').length,
    es: items.filter((i) => i.lang === 'es').length,
  }), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (cat === 'es' && it.lang !== 'es') return false;
      if (cat !== 'all' && cat !== 'es' && it.category !== cat) return false;
      if (q && !it.title.toLowerCase().includes(q) && !it.source.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, cat, query]);

  const sources = useMemo(() => [...new Set(items.map((i) => i.source))], [items]);

  // Pirámide de jerarquía: 1 portada grande → 2 destacadas medianas → resto en
  // rejilla. Da sensación de periódico vivo en vez de una lista plana.
  const featured = filtered[0];
  const highlights = filtered.slice(1, 3);
  const rest = filtered.slice(3, 3 + visible);
  const hasMore = filtered.length > 3 + visible;

  const FILTERS: { id: typeof cat; label: string; icon: string; n: number }[] = [
    { id: 'all', label: t('news_f_all'), icon: 'ri-flashlight-line', n: counts.all },
    { id: 'Boxeo', label: t('news_f_boxing'), icon: 'ri-boxing-line', n: counts.Boxeo },
    { id: 'MMA', label: 'MMA', icon: 'ri-sword-line', n: counts.MMA },
    { id: 'es', label: t('news_f_spanish'), icon: 'ri-translate-2', n: counts.es },
  ].filter((f) => f.id === 'all' || f.n > 0) as { id: typeof cat; label: string; icon: string; n: number }[];

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />

      {/* ══════ CABECERA ══════ */}
      <section className="relative pb-7 overflow-hidden" style={{ paddingTop: 'calc(7rem + env(safe-area-inset-top, 0px))' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(225,6,0,0.11) 0%, transparent 55%)' }} />
        <div className="absolute inset-0 rk-grid-bg pointer-events-none opacity-40" />
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #E10600 50%, transparent)' }} />
        <div className="relative max-w-6xl mx-auto px-5">
          <div className="inline-flex items-center gap-2.5 mb-4 px-4 py-1.5 rounded-full border border-[#E10600]/40 bg-[#E10600]/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse"></span>
            <span className="text-[#E10600] text-xs font-bold tracking-[0.25em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{t('news_live')}</span>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(40px, 8vw, 78px)', lineHeight: 0.9, color: 'white', letterSpacing: 1 }}>
            {t('news_title_pre')} <span style={{ color: '#E10600', textShadow: '0 0 45px rgba(225,6,0,0.5)' }}>{t('news_title_hl')}</span>
          </h1>
          <p className="mt-3 text-base sm:text-lg max-w-xl" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'rgba(255,255,255,0.65)' }}>
            {t('news_sub')}
          </p>

          {/* Ficha técnica: qué estás viendo exactamente */}
          {!loading && !error && (
            <div className="flex items-center gap-x-5 gap-y-2 mt-5 flex-wrap text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
              <span className="text-zinc-400"><span className="text-white font-bold">{items.length}</span> {t('news_headlines')}</span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-400"><span className="text-white font-bold">{sources.length}</span> {t('news_outlets')}</span>
              {updatedAt && <><span className="text-zinc-700">|</span><span className="text-zinc-400">{t('news_updated', { time: timeAgo(updatedAt, t, locale) })}</span></>}
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`}></i>
                {refreshing ? t('news_refreshing') : t('news_refresh')}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ══════ FILTROS (pegados arriba al hacer scroll) ══════ */}
      {!loading && !error && items.length > 0 && (
        <div className="sticky top-[60px] z-30 bg-[#050505]/92 backdrop-blur-xl border-y border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-3">
            <div className="flex gap-1.5 overflow-x-auto flex-1 rk-noscroll">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setCat(f.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    cat === f.id
                      ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/25'
                      : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'
                  }`}
                >
                  <i className={f.icon}></i>{f.label}
                  <span className={`text-[10px] ${cat === f.id ? 'text-white/70' : 'text-zinc-600'}`}>{f.n}</span>
                </button>
              ))}
            </div>
            <div className="relative w-36 sm:w-64 flex-shrink-0">
              <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('news_search_ph')}
                aria-label={t('news_search_aria')}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:border-red-500/60 transition-colors"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label={t('news_clear_aria')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer">
                  <i className="ri-close-circle-fill text-sm"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════ CONTENIDO ══════ */}
      <section className="max-w-6xl mx-auto px-5 pt-7 pb-16">
        {loading ? (
          <Skeletons />
        ) : error ? (
          <div className="text-center py-20 rk-card">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800">
              <i className="ri-wifi-off-line text-3xl text-zinc-600"></i>
            </div>
            <p className="text-zinc-300 font-medium">{t('news_err_title')}</p>
            <p className="text-zinc-600 text-sm mt-1 max-w-sm mx-auto">{t('news_err_desc')}</p>
            <button onClick={() => load(true)} disabled={refreshing}
              className="mt-6 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-6 py-3 rounded-xl cursor-pointer transition-colors disabled:opacity-60">
              <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`}></i> {t('news_retry')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rk-card">
            <i className="ri-search-eye-line text-4xl text-zinc-700"></i>
            <p className="text-zinc-300 font-medium mt-3">{t('news_empty_title', { q: query })}</p>
            <p className="text-zinc-600 text-sm mt-1">{t('news_empty_desc')}</p>
            <button onClick={() => { setQuery(''); setCat('all'); }}
              className="mt-5 text-sm font-bold text-red-400 hover:text-red-300 cursor-pointer">
              {t('news_empty_all')}
            </button>
          </div>
        ) : (
          <>
            {/* ── Destacada ── */}
            {featured && (
              <a href={featured.link} target="_blank" rel="noopener noreferrer"
                className="group block mb-6 rounded-3xl overflow-hidden border border-white/[0.07] hover:border-red-500/45 transition-all anim-fade-up"
                style={{ boxShadow: '0 24px 70px rgba(0,0,0,0.5)' }}>
                <div className="grid md:grid-cols-[1.15fr_1fr]">
                  <div className="relative h-56 md:h-[340px] bg-zinc-950 overflow-hidden">
                    <NewsImage item={featured} big />
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(5,5,5,0.75) 0%, transparent 55%)' }} />
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span className="text-[11px] font-black tracking-wider uppercase text-white bg-red-600 px-3 py-1 rounded-full shadow-lg shadow-red-600/40">
                        {t('news_featured')}
                      </span>
                      <span className="text-[11px] font-bold text-white/90 bg-black/55 backdrop-blur px-2.5 py-1 rounded-full">{featured.category}</span>
                      {featured.lang === 'es' && <span className="text-[11px] font-bold text-white/90 bg-black/55 backdrop-blur px-2.5 py-1 rounded-full">ES</span>}
                    </div>
                  </div>
                  <div className="p-6 sm:p-8 flex flex-col justify-center" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 100%)' }}>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
                      <span className="font-bold text-zinc-400 uppercase tracking-wider">{featured.source}</span>
                      <span>·</span>
                      <span>{timeAgo(featured.pubDate, t, locale)}</span>
                      {isHot(featured.pubDate) && (
                        <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-black text-red-400 bg-red-600/12 border border-red-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <i className="ri-fire-fill"></i> {t('news_recent')}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-[26px] font-bold text-white leading-[1.15] group-hover:text-red-400 transition-colors" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {featured.title}
                    </h2>
                    {featured.description && <p className="text-sm text-zinc-400 mt-3.5 leading-relaxed line-clamp-4">{featured.description}</p>}
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-red-400 mt-5 group-hover:gap-3 transition-all">
                      {t('news_read_in', { source: featured.source })} <i className="ri-arrow-right-line"></i>
                    </span>
                  </div>
                </div>
              </a>
            )}

            {/* ── Destacadas medianas (nivel intermedio) ── */}
            {highlights.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {highlights.map((item, i) => (
                  <a key={item.link} href={item.link} target="_blank" rel="noopener noreferrer"
                    className="group flex bg-white/[0.025] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-red-500/45 hover:-translate-y-1 transition-all duration-300 anim-fade-up"
                    style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="relative w-[40%] min-w-[130px] bg-zinc-950 overflow-hidden">
                      <NewsImage item={item} />
                      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to right, transparent 55%, rgba(5,5,5,0.35))' }} />
                      {isHot(item.pubDate) && (
                        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 text-[10px] font-black text-white bg-red-600 px-2 py-0.5 rounded-full shadow-lg shadow-red-600/40 uppercase tracking-wider">
                          <i className="ri-fire-fill"></i> {t('news_recent')}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-1.5">
                        <span className="font-bold text-zinc-400 uppercase tracking-wide truncate">{item.source}</span>
                        <span>·</span><span className="whitespace-nowrap">{timeAgo(item.pubDate, t, locale)}</span>
                        <span className="text-zinc-700">·</span><span className="text-zinc-500 truncate">{item.category}</span>
                      </div>
                      <h3 className="font-bold text-white leading-snug group-hover:text-red-400 transition-colors line-clamp-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19 }}>
                        {item.title}
                      </h3>
                      {item.description && <p className="text-xs text-zinc-500 mt-2 leading-relaxed line-clamp-2 hidden sm:block">{item.description}</p>}
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* ── Resto en rejilla ── */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((item, i) => (
                <a key={item.link} href={item.link} target="_blank" rel="noopener noreferrer"
                  className={`group flex flex-col bg-white/[0.025] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-red-500/45 hover:-translate-y-1.5 transition-all duration-300 anim-fade-up anim-d${Math.min((i % 6) + 1, 6)}`}>
                  <div className="relative h-40 bg-zinc-950 overflow-hidden">
                    <NewsImage item={item} />
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(5,5,5,0.55) 0%, transparent 60%)' }} />
                    <span className="absolute top-3 left-3 text-[10px] font-bold text-white bg-black/60 backdrop-blur px-2 py-0.5 rounded-full">{item.category}</span>
                    {isHot(item.pubDate) && (
                      <span className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-600/40" title={t('news_hot_title')}>
                        <i className="ri-fire-fill text-white text-xs"></i>
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-2">
                      <span className="font-bold text-zinc-400 uppercase tracking-wide truncate">{item.source}</span>
                      <span>·</span><span className="whitespace-nowrap">{timeAgo(item.pubDate, t, locale)}</span>
                    </div>
                    <h3 className="font-bold text-white leading-snug group-hover:text-red-400 transition-colors flex-1 line-clamp-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16 }}>
                      {item.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 mt-3 group-hover:gap-2 transition-all">
                      {t('news_read')} <i className="ri-arrow-right-line"></i>
                    </span>
                  </div>
                </a>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <button onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/12 hover:border-red-500/45 hover:text-white text-zinc-300 text-sm font-bold px-7 py-3.5 rounded-xl cursor-pointer transition-all">
                  {t('news_more')} <i className="ri-arrow-down-line"></i>
                </button>
              </div>
            )}

            {/* Fuentes: transparencia sobre de dónde sale cada titular */}
            {sources.length > 0 && (
              <div className="mt-12 pt-8 border-t border-white/[0.06]">
                <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-600 mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {t('news_sources_title')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sources.map((s) => (
                    <button key={s} onClick={() => setQuery(s)}
                      className="text-xs text-zinc-400 hover:text-white bg-white/[0.03] border border-white/[0.08] hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-600 mt-5 leading-relaxed max-w-2xl">
                  {t('news_sources_note')}
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <style>{`
        .rk-skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.035) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.035) 75%);
          background-size: 200% 100%;
          animation: rankd-shimmer 1.6s linear infinite;
        }
        .rk-noscroll::-webkit-scrollbar { display: none; }
        .rk-noscroll { scrollbar-width: none; }
        .line-clamp-4 {
          display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-3 {
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-2 {
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @media (prefers-reduced-motion: reduce) { .rk-skeleton { animation: none; } }
      `}</style>

      <Footer />
    </div>
  );
}
