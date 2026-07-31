import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, OrgEvent, Profile } from '@/lib/supabase';
import { useSEO } from '@/hooks/useSEO';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';
import Reveal from '@/components/base/Reveal';

interface EventWithOrg extends OrgEvent {
  org?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'user_type' | 'verified'> | null;
  hasTickets?: boolean;
}

type TimeFilter = 'upcoming' | 'past' | 'all';

function dateBadge(d: string | null): { label: string; badge: string; cls: string; days: number } | null {
  if (!d) return null;
  const date = new Date(d + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const label = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  if (diffDays < 0) return { label, badge: 'Finalizado', cls: 'text-zinc-500 bg-white/[0.04] border-white/10', days: diffDays };
  if (diffDays === 0) return { label, badge: 'Hoy', cls: 'text-red-400 bg-red-500/12 border-red-500/30', days: diffDays };
  if (diffDays <= 7) return { label, badge: 'Esta semana', cls: 'text-red-400 bg-red-500/12 border-red-500/30', days: diffDays };
  if (diffDays <= 30) return { label, badge: 'Este mes', cls: 'text-orange-400 bg-orange-500/12 border-orange-500/30', days: diffDays };
  return { label, badge: 'Próximo', cls: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/30', days: diffDays };
}

/** Cuenta atrás en palabras para el evento más cercano. */
function countdown(days: number): string {
  if (days === 0) return 'Es hoy';
  if (days === 1) return 'Mañana';
  if (days <= 7) return `En ${days} días`;
  if (days <= 14) return 'La semana que viene';
  return `En ${Math.round(days / 7)} semanas`;
}

/** La ciudad suele venir como "Sala X, Madrid": nos quedamos con lo último. */
function cityOf(location: string | null): string | null {
  if (!location) return null;
  const parts = location.split(',').map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || null;
}

function Skeletons() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-[#0c0c0c] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="aspect-[16/10] rk-skeleton" />
          <div className="p-4 space-y-2.5">
            <div className="h-5 w-4/5 rounded rk-skeleton" />
            <div className="h-3 w-1/2 rounded rk-skeleton" />
            <div className="h-3 w-1/3 rounded rk-skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EventosPage() {
  useSEO({
    title: 'Eventos y veladas de combate | RANKD',
    description: 'Galas de boxeo, veladas de MMA, kickboxing y muay thai. Descubre los próximos eventos de deportes de combate y consigue tus entradas en RANKD.',
  });

  const navigate = useNavigate();
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventWithOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimeFilter>('upcoming');
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('all');

  const canPublish = profile?.user_type === 'promoter' || profile?.user_type === 'gym';

  useEffect(() => {
    const load = async () => {
      const { data: evsRaw } = await supabase
        .from('organization_events')
        .select('*')
        .order('event_date', { ascending: true });

      // Los borradores no salen en la cartelera pública. Se filtra en cliente
      // para no romper si la columna `status` aún no existe (degradación).
      const evs = (evsRaw || []).filter((e) => e.status !== 'draft');

      if (evs.length === 0) { setEvents([]); setLoading(false); return; }

      const orgIds = Array.from(new Set(evs.map((e) => e.org_profile_id).filter(Boolean)));
      const [{ data: profiles }, { data: tickets }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url, user_type, verified').in('id', orgIds),
        // Solo para marcar qué eventos tienen entradas: no hace falta traerlas enteras.
        supabase.from('event_tickets').select('event_id').eq('is_active', true),
      ]);
      const pmap = new Map((profiles || []).map((p) => [p.id, p]));
      const withTickets = new Set((tickets || []).map((t) => t.event_id));

      setEvents(evs.map((e) => ({
        ...e,
        org: pmap.get(e.org_profile_id) || null,
        hasTickets: withTickets.has(e.id),
      })));
      setLoading(false);
    };
    load();
  }, []);

  const { upcoming, past } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const up: EventWithOrg[] = [];
    const pa: EventWithOrg[] = [];
    events.forEach((e) => {
      const d = e.event_date ? new Date(e.event_date + 'T12:00:00') : null;
      if (!d || d >= today) up.push(e); else pa.push(e);
    });
    pa.reverse(); // pasados: más reciente primero
    return { upcoming: up, past: pa };
  }, [events]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => { const c = cityOf(e.location); if (c) set.add(c); });
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [events]);

  const base = filter === 'upcoming' ? upcoming : filter === 'past' ? past : [...upcoming, ...past];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return base.filter((e) => {
      if (city !== 'all' && cityOf(e.location) !== city) return false;
      if (!q) return true;
      return (e.title || '').toLowerCase().includes(q)
        || (e.location || '').toLowerCase().includes(q)
        || (e.org?.full_name || '').toLowerCase().includes(q);
    });
  }, [base, query, city]);

  // El más próximo con fecha: se destaca arriba cuando estás en "Próximos".
  const next = filter === 'upcoming' && !query && city === 'all'
    ? upcoming.find((e) => !!e.event_date)
    : undefined;
  const nextBadge = next ? dateBadge(next.event_date) : null;
  const grid = next ? shown.filter((e) => e.id !== next.id) : shown;

  const isFiltering = !!query.trim() || city !== 'all';

  return (
    <div className="min-h-screen bg-[#070707]">
      <Navbar />

      {/* Hero */}
      <div className="relative overflow-hidden rk-grid-bg" style={{ background: '#050505', paddingTop: 'calc(60px + env(safe-area-inset-top,0px))' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 74% 40%, rgba(225,6,0,0.16) 0%, transparent 56%)' }} />
        <div className="rk-topline" />
        <span aria-hidden="true" className="pointer-events-none select-none absolute -right-6 bottom-0 hidden md:block" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(120px,16vw,240px)', lineHeight: 0.7, color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.04)' }}>FIGHT</span>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-14 md:py-20">
          <div className="flex items-center gap-3 mb-4">
            <span className="rk-index">LA CARTELERA</span>
            <span style={{ flex: '0 0 34px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
            <span className="rk-eyebrow">Eventos</span>
          </div>
          <h1 className="rk-h1" style={{ color: '#fff', margin: 0 }}>
            PRÓXIMAS <span className="rk-red-glow">VELADAS</span>
          </h1>
          <div className="rk-rule" style={{ width: 88, margin: '20px 0' }} />
          <p className="rk-body max-w-xl" style={{ margin: 0 }}>
            Galas de boxeo, veladas de MMA y kickboxing. Descubre los próximos eventos de deportes de combate y consigue tu entrada.
          </p>
          {!loading && events.length > 0 && (
            <div className="flex items-center gap-x-5 gap-y-2 mt-6 flex-wrap text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
              <span className="text-zinc-400"><span className="text-white font-bold">{upcoming.length}</span> por venir</span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-400"><span className="text-white font-bold">{cities.length}</span> {cities.length === 1 ? 'ciudad' : 'ciudades'}</span>
              {events.some((e) => e.hasTickets) && (
                <>
                  <span className="text-zinc-700">|</span>
                  <span className="text-zinc-400"><span className="text-white font-bold">{events.filter((e) => e.hasTickets).length}</span> con entradas a la venta</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8">
        {/* Filtros + búsqueda */}
        <div className="flex flex-col lg:flex-row gap-3 mb-6">
          <div className="flex gap-2 overflow-x-auto rk-noscroll">
            {([['upcoming', 'Próximos', upcoming.length], ['past', 'Finalizados', past.length], ['all', 'Todos', events.length]] as const).map(([val, label, count]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all cursor-pointer border ${filter === val ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'}`}>
                {label}<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === val ? 'bg-white/20' : 'bg-white/[0.06] text-zinc-500'}`}>{count}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-1 lg:justify-end">
            {cities.length > 1 && (
              <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filtrar por ciudad"
                className="bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer transition-colors">
                <option value="all">Todas las ciudades</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <div className="relative flex-1 lg:flex-none lg:w-64">
              <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar velada, sala o promotora..." aria-label="Buscar eventos"
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-red-500 transition-colors" />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer">
                  <i className="ri-close-circle-fill text-sm"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <Skeletons />
        ) : shown.length === 0 ? (
          <div className="rk-card text-center" style={{ padding: '64px 24px', transform: 'none' }}>
            <div className="w-20 h-20 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
              <i className={`text-4xl text-red-400 ${isFiltering ? 'ri-search-eye-line' : 'ri-calendar-event-line'}`}></i>
            </div>
            <h2 className="rk-h3 text-white">
              {isFiltering ? 'SIN RESULTADOS' : filter === 'past' ? 'AÚN NO HAY EVENTOS PASADOS' : 'NO HAY EVENTOS ANUNCIADOS'}
            </h2>
            <p className="text-sm text-zinc-400 mt-2 max-w-sm mx-auto">
              {isFiltering
                ? 'Prueba con otra palabra o quita el filtro de ciudad.'
                : 'Las promotoras y gimnasios publican aquí sus galas y veladas. Vuelve pronto: el cartel se llena rápido.'}
            </p>
            {isFiltering ? (
              <button onClick={() => { setQuery(''); setCity('all'); }}
                className="mt-5 text-sm font-bold text-red-400 hover:text-red-300 cursor-pointer">Ver todos los eventos</button>
            ) : canPublish ? (
              <button onClick={() => navigate('/dashboard')} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.9rem', padding: '0.8rem 1.8rem' }}>
                PUBLICAR MI EVENTO
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {/* ── Destacado: la velada más cercana ── */}
            {next && nextBadge && (
              <Reveal>
                <article onClick={() => navigate(`/evento/${next.id}`)}
                  className="group grid md:grid-cols-[1.2fr_1fr] mb-6 bg-[#0c0c0c] border border-white/[0.08] rounded-3xl overflow-hidden hover:border-red-500/45 transition-all cursor-pointer"
                  style={{ boxShadow: '0 24px 70px rgba(0,0,0,0.5)' }}>
                  <div className="relative h-52 md:h-[300px] bg-gradient-to-br from-zinc-900 to-black overflow-hidden">
                    {next.image_url ? (
                      <img src={next.image_url} alt={next.title} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center rk-grid-bg"><i className="ri-sword-line text-6xl text-white/10"></i></div>
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(12,12,12,0.85) 0%, transparent 55%)' }} />
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-600 to-transparent" />
                    <span className="absolute top-4 left-4 text-[11px] font-black tracking-wider uppercase text-white bg-red-600 px-3 py-1 rounded-full shadow-lg shadow-red-600/40">
                      La próxima
                    </span>
                  </div>
                  <div className="p-6 sm:p-8 flex flex-col justify-center">
                    <p className="rk-eyebrow" style={{ color: '#E10600' }}>{countdown(nextBadge.days)}</p>
                    <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl text-white leading-[0.95] mt-2 group-hover:text-red-300 transition-colors">
                      {next.title}
                    </h2>
                    <div className="flex flex-col gap-1.5 mt-4 text-sm text-zinc-400">
                      <span className="flex items-center gap-2"><i className="ri-calendar-line text-zinc-600"></i>{nextBadge.label}</span>
                      {next.location && <span className="flex items-center gap-2"><i className="ri-map-pin-line text-zinc-600"></i>{next.location}</span>}
                      {next.org?.full_name && <span className="flex items-center gap-2"><i className="ri-trophy-line text-zinc-600"></i>{next.org.full_name}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-6 flex-wrap">
                      <span className="rk-btn rk-btn-primary" style={{ fontSize: '0.85rem', padding: '0.7rem 1.5rem' }}>VER LA VELADA</span>
                      {next.hasTickets && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg">
                          <i className="ri-ticket-2-line"></i> Entradas a la venta
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              </Reveal>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {grid.map((ev, i) => {
                const badge = dateBadge(ev.event_date);
                const isPast = badge?.badge === 'Finalizado';
                return (
                  <Reveal key={ev.id} delay={Math.min(i, 6) * 50}>
                    <article
                      onClick={() => navigate(`/evento/${ev.id}`)}
                      className={`group bg-[#0c0c0c] border border-white/[0.08] rounded-2xl overflow-hidden hover:border-red-500/40 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-red-600/15 transition-all duration-300 cursor-pointer h-full flex flex-col ${isPast ? 'opacity-70 hover:opacity-100' : ''}`}
                    >
                      {/* Poster */}
                      <div className="relative aspect-[16/10] bg-gradient-to-br from-zinc-900 to-black overflow-hidden">
                        {ev.image_url ? (
                          <img src={ev.image_url} alt={ev.title} loading="lazy" className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center rk-grid-bg">
                            <i className="ri-sword-line text-5xl text-white/10"></i>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] via-transparent to-transparent" />
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-600 to-transparent" />
                        {badge && (
                          <span className={`absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-sm ${badge.cls}`}>{badge.badge}</span>
                        )}
                        {ev.hasTickets && !isPast && (
                          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-400/40 backdrop-blur-sm px-2 py-1 rounded-full">
                            <i className="ri-ticket-2-line"></i> Entradas
                          </span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-4 flex-1 flex flex-col">
                        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.01em' }} className="text-xl text-white leading-tight group-hover:text-red-300 transition-colors line-clamp-2">{ev.title}</h3>
                        {badge && <p className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5"><i className="ri-calendar-line text-zinc-500"></i>{badge.label}</p>}
                        {ev.location && <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5"><i className="ri-map-pin-line"></i>{ev.location}</p>}
                        <div className="flex items-center gap-2 mt-auto pt-3">
                          {ev.org?.avatar_url ? (
                            <img src={ev.org.avatar_url} alt="" className="w-6 h-6 rounded-lg object-cover border border-white/10" />
                          ) : (
                            <div className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center"><i className="ri-trophy-line text-[10px] text-zinc-500"></i></div>
                          )}
                          <span className="text-xs text-zinc-400 truncate flex-1">{ev.org?.full_name || 'Promotora'}</span>
                          <span className="text-xs font-bold text-red-400 flex items-center gap-1 group-hover:gap-1.5 transition-all">Ver <i className="ri-arrow-right-line"></i></span>
                        </div>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>

            {/* Llamada para promotoras: su sitio natural es el final de la cartelera */}
            {canPublish && (
              <div className="rk-card mt-8 p-6 flex items-center gap-5 flex-wrap sm:flex-nowrap" style={{ transform: 'none' }}>
                <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400">
                  <i className="ri-add-circle-line text-2xl"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">¿Organizas una velada?</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Publícala aquí con su cartel, su ficha y sus entradas. Aparece en esta misma cartelera.</p>
                </div>
                <button onClick={() => navigate('/dashboard')} className="rk-btn rk-btn-primary w-full sm:w-auto flex-shrink-0" style={{ fontSize: '0.82rem', padding: '0.7rem 1.4rem' }}>
                  PUBLICAR EVENTO
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .rk-skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.035) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.035) 75%);
          background-size: 200% 100%;
          animation: rankd-shimmer 1.6s linear infinite;
        }
        .rk-noscroll::-webkit-scrollbar { display: none; }
        .rk-noscroll { scrollbar-width: none; }
        @media (prefers-reduced-motion: reduce) { .rk-skeleton { animation: none; } }
      `}</style>

      <Footer />
    </div>
  );
}
