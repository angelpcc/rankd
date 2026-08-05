import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, OrgEvent, Profile } from '@/lib/supabase';
import { useSEO } from '@/hooks/useSEO';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';
// La venta interna (EventTickets) queda desconectada de la interfaz: de
// momento cada promotora vende en su propia web y aquí solo enlazamos.
import ExternalTickets from './components/ExternalTickets';
import EventCard from './components/EventCard';

function formatLongDate(d: string | null, locale: string): string | null {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function EventoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [event, setEvent] = useState<OrgEvent | null>(null);
  const [org, setOrg] = useState<Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'user_type' | 'verified' | 'location'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useSEO({
    title: event ? `${event.title} | RANKD` : 'Evento | RANKD',
    description: event?.description || 'Evento de deportes de combate en RANKD.',
  });

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: ev } = await supabase.from('organization_events').select('*').eq('id', id).maybeSingle();
      if (!ev) { setNotFound(true); setLoading(false); return; }
      setEvent(ev);
      if (ev.org_profile_id) {
        const { data: p } = await supabase.from('profiles').select('id, full_name, avatar_url, user_type, verified, location').eq('id', ev.org_profile_id).maybeSingle();
        setOrg(p);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const longDate = formatLongDate(event?.event_date ?? null, locale);
  const isPast = event?.event_date ? new Date(event.event_date + 'T23:59:59') < new Date() : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070707]">
        <Navbar />
        <div className="flex items-center justify-center" style={{ minHeight: '70vh' }}>
          <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen bg-[#070707]">
        <Navbar />
        <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: '70vh' }}>
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 mb-5">
            <i className="ri-calendar-close-line text-2xl text-red-400"></i>
          </div>
          <h1 className="rk-h3 text-white">{t('ev_nf_title')}</h1>
          <p className="text-sm text-zinc-400 mt-2">{t('ev_nf_desc')}</p>
          <button onClick={() => navigate('/eventos')} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem' }}>{t('ev_nf_cta')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707]">
      <Navbar />

      {/* Hero con cartel */}
      <div className="relative overflow-hidden" style={{ background: '#050505', paddingTop: 'calc(60px + env(safe-area-inset-top,0px))' }}>
        {event.image_url && (
          <div className="absolute inset-0">
            <img src={event.image_url} alt="" className="w-full h-full object-cover object-center opacity-25 blur-sm scale-110" />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #070707 8%, rgba(7,7,7,0.85) 45%, rgba(7,7,7,0.7))' }} />
        <div className="rk-topline" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 md:px-10 pt-6 pb-10">
          <button onClick={() => navigate('/eventos')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer mb-6">
            <i className="ri-arrow-left-line"></i> {t('ev_back_all')}
          </button>
          <div className="grid md:grid-cols-[300px_1fr] gap-6 md:gap-8 items-start">
            {/* Cartel */}
            <div className="rk-img-wrap rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 aspect-[3/4] w-full max-w-[300px] mx-auto md:mx-0">
              {event.image_url ? (
                <img src={event.image_url} alt={event.title} className="w-full h-full object-cover object-top" />
              ) : (
                <div className="w-full h-full flex items-center justify-center rk-grid-bg"><i className="ri-sword-line text-6xl text-white/10"></i></div>
              )}
            </div>
            {/* Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {isPast ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border text-zinc-500 bg-white/[0.04] border-white/10">{t('ev_badge_past')}</span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border text-red-400 bg-red-500/12 border-red-500/30 uppercase tracking-wider">{t('ev_badge_upcoming')}</span>
                )}
              </div>
              <h1 className="rk-h1" style={{ color: '#fff', margin: 0, fontSize: 'clamp(2.2rem,6vw,4rem)' }}>{event.title}</h1>
              <div className="rk-rule" style={{ width: 70, margin: '18px 0' }} />
              <div className="space-y-2.5">
                {longDate && (
                  <p className="flex items-center gap-3 text-sm text-zinc-300 capitalize">
                    <i className="ri-calendar-event-line text-red-400 text-lg"></i>{longDate}
                  </p>
                )}
                {event.location && (
                  <p className="flex items-center gap-3 text-sm text-zinc-300">
                    <i className="ri-map-pin-2-line text-red-400 text-lg"></i>{event.location}
                  </p>
                )}
                {org && (
                  <div className="flex items-center gap-3 pt-1">
                    {org.avatar_url ? (
                      <img src={org.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/10" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center"><i className="ri-trophy-line text-xs text-zinc-500"></i></div>
                    )}
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('ev_organizes')}</p>
                      <p className="text-sm text-white font-semibold leading-tight">{org.full_name || t('ev_promoter')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-8 grid md:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Descripción */}
        <div className="space-y-6 min-w-0">
          {event.description ? (
            <div className="rk-card" style={{ padding: '24px 26px' }}>
              <h2 className="rk-h3 text-white mb-3" style={{ fontSize: '1.1rem' }}>{t('ev_about')}</h2>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{event.description}</p>
            </div>
          ) : (
            <div className="rk-card" style={{ padding: '24px 26px' }}>
              <p className="text-sm text-zinc-400">{t('ev_no_desc')}</p>
            </div>
          )}

          {/* Cartelera de combates (si la promotora la ha publicado) */}
          <EventCard eventId={event.id} />
        </div>

        {/* Entradas */}
        <div className="md:sticky md:top-20">
          <ExternalTickets event={event} isPast={isPast} />
        </div>
      </div>

      <Footer />
    </div>
  );
}
