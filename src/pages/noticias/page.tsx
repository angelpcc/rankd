import { useState, useEffect } from 'react';
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
}

const CATEGORY_STYLE: Record<string, { grad: string; icon: string }> = {
  'Boxeo': { grad: 'linear-gradient(135deg, #1a0505 0%, #2d0a0a 100%)', icon: 'ri-boxing-line' },
  'MMA': { grad: 'linear-gradient(135deg, #0a0f1a 0%, #1a1420 100%)', icon: 'ri-sword-line' },
  'default': { grad: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)', icon: 'ri-fire-line' },
};

function catStyle(cat: string) {
  return CATEGORY_STYLE[cat] || CATEGORY_STYLE.default;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr).getTime();
  if (!d) return '';
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useSEO({
    title: 'Noticias de Boxeo y MMA | RANKD',
    description: 'Últimas noticias del boxeo, MMA y deportes de contacto. Mantente al día con RANKD.',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) throw new Error();
        const data = await res.json();
        setItems(data.items || []);
        if (!data.items || data.items.length === 0) setError(true);
      } catch {
        setError(true);
      }
      setLoading(false);
    };
    load();
  }, []);

  const featured = items[0];
  const rest = items.slice(1);

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />

      <section className="relative pt-28 sm:pt-32 pb-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(225,6,0,0.1) 0%, transparent 55%)' }} />
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #E10600 50%, transparent)' }} />
        <div className="relative max-w-6xl mx-auto px-5">
          <div className="inline-flex items-center gap-2.5 mb-4 px-4 py-1.5 rounded-full border border-[#E10600]/40 bg-[#E10600]/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse"></span>
            <span className="text-[#E10600] text-xs font-bold tracking-[0.25em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>En directo</span>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(40px, 8vw, 78px)', lineHeight: 0.9, color: 'white', letterSpacing: 1 }}>
            NOTICIAS DEL <span style={{ color: '#E10600', textShadow: '0 0 45px rgba(225,6,0,0.5)' }}>COMBATE</span>
          </h1>
          <p className="mt-3 text-base sm:text-lg max-w-xl" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'rgba(255,255,255,0.65)' }}>
            Boxeo, MMA y deportes de contacto. Lo último, actualizado al momento.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-zinc-500 text-sm">Cargando las últimas noticias...</p>
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800">
              <i className="ri-newspaper-line text-3xl text-zinc-600"></i>
            </div>
            <p className="text-zinc-400 font-medium">No hay noticias disponibles ahora mismo</p>
            <p className="text-zinc-600 text-sm mt-1">Vuelve a intentarlo en unos minutos</p>
          </div>
        ) : (
          <>
            {/* Destacada */}
            {featured && (
              <a href={featured.link} target="_blank" rel="noopener noreferrer"
                className="group block mb-6 rounded-3xl overflow-hidden border border-zinc-800 hover:border-red-500/40 transition-all anim-fade-up">
                <div className="grid md:grid-cols-2">
                  <div className="relative h-56 md:h-auto bg-zinc-900 overflow-hidden">
                    {featured.image ? (
                      <img src={featured.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background: catStyle(featured.category).grad }}>
                        <i className={`${catStyle(featured.category).icon} text-6xl`} style={{ color: 'rgba(225,6,0,0.5)' }}></i>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 6, color: 'rgba(255,255,255,0.15)' }}>RANKD</span>
                      </div>
                    )}
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span className="text-xs font-bold text-white bg-red-600 px-2.5 py-1 rounded-full">{featured.category}</span>
                    </div>
                  </div>
                  <div className="p-6 sm:p-8 flex flex-col justify-center bg-gradient-to-br from-zinc-900/80 to-zinc-950">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
                      <span>{featured.source}</span><span>·</span><span>{timeAgo(featured.pubDate)}</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight group-hover:text-red-400 transition-colors" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {featured.title}
                    </h2>
                    {featured.description && <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{featured.description}</p>}
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-red-400 mt-4 group-hover:gap-2 transition-all">
                      Leer noticia <i className="ri-arrow-right-line"></i>
                    </span>
                  </div>
                </div>
              </a>
            )}

            {/* Resto en grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((item, i) => (
                <a key={item.link} href={item.link} target="_blank" rel="noopener noreferrer"
                  className={`group flex flex-col bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden hover:border-red-500/40 hover:-translate-y-1 transition-all anim-fade-up anim-d${Math.min((i % 6) + 1, 6)}`}>
                  <div className="relative h-40 bg-zinc-900 overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { const el = e.currentTarget as HTMLImageElement; el.style.display = 'none'; const sib = el.nextElementSibling as HTMLElement; if (sib) sib.style.display = 'flex'; }} />
                    ) : null}
                    <div className={`w-full h-full flex-col items-center justify-center gap-2 ${item.image ? 'hidden' : 'flex'}`} style={{ background: catStyle(item.category).grad }}>
                      <i className={`${catStyle(item.category).icon} text-4xl`} style={{ color: 'rgba(225,6,0,0.45)' }}></i>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 4, color: 'rgba(255,255,255,0.12)' }}>RANKD</span>
                    </div>
                    <span className="absolute top-3 left-3 text-[10px] font-bold text-white bg-black/60 backdrop-blur px-2 py-0.5 rounded-full">{item.category}</span>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-2">
                      <span>{item.source}</span><span>·</span><span>{timeAgo(item.pubDate)}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white leading-snug group-hover:text-red-400 transition-colors flex-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px' }}>
                      {item.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 mt-3 group-hover:gap-2 transition-all">
                      Leer <i className="ri-arrow-right-line"></i>
                    </span>
                  </div>
                </a>
              ))}
            </div>

            <p className="text-center text-xs text-zinc-600 mt-10">
              Noticias de fuentes externas. Al hacer clic accedes al medio original.
            </p>
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}