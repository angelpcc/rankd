import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, OrgEvent, Profile } from '@/lib/supabase';
import { useSEO } from '@/hooks/useSEO';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';
import Reveal from '@/components/base/Reveal';

interface EventWithOrg extends OrgEvent {
  org?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'user_type' | 'verified'> | null;
}

type TimeFilter = 'upcoming' | 'past' | 'all';

function dateBadge(d: string | null): { label: string; badge: string; cls: string } | null {
  if (!d) return null;
  const date = new Date(d + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const label = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  if (diffDays < 0) return { label, badge: 'Finalizado', cls: 'text-zinc-500 bg-white/[0.04] border-white/10' };
  if (diffDays === 0) return { label, badge: 'Hoy', cls: 'text-red-400 bg-red-500/12 border-red-500/30' };
  if (diffDays <= 7) return { label, badge: 'Esta semana', cls: 'text-red-400 bg-red-500/12 border-red-500/30' };
  if (diffDays <= 30) return { label, badge: 'Este mes', cls: 'text-orange-400 bg-orange-500/12 border-orange-500/30' };
  return { label, badge: 'Próximo', cls: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/30' };
}

export default function EventosPage() {
  useSEO({
    title: 'Eventos y veladas de combate | RANKD',
    description: 'Galas de boxeo, veladas de MMA, kickboxing y muay thai. Descubre los próximos eventos de deportes de combate y consigue tus entradas en RANKD.',
  });

  const navigate = useNavigate();
  const [events, setEvents] = useState<EventWithOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimeFilter>('upcoming');

  useEffect(() => {
    const load = async () => {
      const { data: evs } = await supabase
        .from('organization_events')
        .select('*')
        .order('event_date', { ascending: true });

      if (!evs || evs.length === 0) { setEvents([]); setLoading(false); return; }

      const orgIds = Array.from(new Set(evs.map((e) => e.org_profile_id).filter(Boolean)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, user_type, verified')
        .in('id', orgIds);
      const pmap = new Map((profiles || []).map((p) => [p.id, p]));

      setEvents(evs.map((e) => ({ ...e, org: pmap.get(e.org_profile_id) || null })));
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

  const shown = filter === 'upcoming' ? upcoming : filter === 'past' ? past : [...upcoming, ...past];

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
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8">
        {/* Filtros */}
        <div className="flex gap-2 mb-6">
          {([['upcoming', 'Próximos', upcoming.length], ['past', 'Finalizados', past.length], ['all', 'Todos', events.length]] as const).map(([val, label, count]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all cursor-pointer border ${filter === val ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'}`}>
              {label}<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === val ? 'bg-white/20' : 'bg-white/[0.06] text-zinc-500'}`}>{count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : shown.length === 0 ? (
          <div className="rk-card text-center" style={{ padding: '64px 24px' }}>
            <div className="w-20 h-20 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
              <i className="ri-calendar-event-line text-4xl text-red-400"></i>
            </div>
            <h2 className="rk-h3 text-white">{filter === 'past' ? 'AÚN NO HAY EVENTOS PASADOS' : 'NO HAY EVENTOS ANUNCIADOS'}</h2>
            <p className="text-sm text-zinc-400 mt-2 max-w-sm mx-auto">Las promotoras y gimnasios publican aquí sus galas y veladas. Vuelve pronto: el cartel se llena rápido.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {shown.map((ev, i) => {
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
                        <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" />
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
        )}
      </div>

      <Footer />
    </div>
  );
}
