import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Opportunity } from '@/lib/supabase';
import { MOCK_OPPORTUNITIES } from '@/mocks/data';

const typeConfig: Record<string, { accent: string; bg: string; border: string; bar: string; icon: string }> = {
  combate:      { accent: '#E10600', bg: 'rgba(225,6,0,0.08)',     border: 'rgba(225,6,0,0.2)',       bar: '#E10600',    icon: 'ri-boxing-line' },
  contrato:     { accent: '#ffffff', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)',   bar: '#ffffff',    icon: 'ri-file-text-line' },
  patrocinio:   { accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',     bar: '#f59e0b',    icon: 'ri-hand-coin-line' },
  campamento:   { accent: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)',     bar: '#10b981',    icon: 'ri-tent-line' },
  sparring:     { accent: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)',     bar: '#f97316',    icon: 'ri-user-shared-line' },
  entrenamiento:{ accent: '#38bdf8', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)',     bar: '#38bdf8',    icon: 'ri-run-line' },
  scouting:     { accent: '#a78bfa', bg: 'rgba(167,139,250,0.08)',border: 'rgba(167,139,250,0.2)',    bar: '#a78bfa',    icon: 'ri-eye-line' },
};

const typeLabels: Record<string, string> = {
  combate: 'opp_type_combate', contrato: 'opp_type_contrato', patrocinio: 'opp_type_patrocinio',
  campamento: 'opp_type_campamento', sparring: 'opp_type_sparring',
  entrenamiento: 'opp_type_entrenamiento', scouting: 'opp_type_scouting',
};

export default function Opportunities() {
  const [active, setActive] = useState('Todos');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('opportunities').select('*').eq('status', 'open')
          .order('created_at', { ascending: false }).limit(12);
        setOpportunities(error || !data || data.length === 0 ? MOCK_OPPORTUNITIES : data);
        setLoading(false);
      } catch {
        setOpportunities(MOCK_OPPORTUNITIES);
        setLoading(false);
      }
    };
    load();
  }, []);

  const filterKeys = [
    { key: 'Todos', labelKey: 'opp_filter_all' },
    { key: 'combate', labelKey: 'opp_filter_fight' },
    { key: 'contrato', labelKey: 'opp_filter_contract' },
    { key: 'patrocinio', labelKey: 'opp_filter_sponsorship' },
  ];

  // R12-T13: tira visual del abanico de conexiones del ecosistema (no solo
  // combates): personas y organizaciones que se encuentran en RANKD.
  const CONNECTION_KINDS = [
    { icon: 'ri-boxing-line', labelKey: 'opp_kind_fights' },
    { icon: 'ri-hand-coin-line', labelKey: 'opp_kind_sponsors' },
    { icon: 'ri-user-star-line', labelKey: 'opp_kind_managers' },
    { icon: 'ri-medal-line', labelKey: 'opp_kind_ambassadors' },
    { icon: 'ri-team-line', labelKey: 'opp_kind_collabs' },
    { icon: 'ri-home-gear-line', labelKey: 'opp_kind_gyms' },
    { icon: 'ri-user-follow-line', labelKey: 'opp_kind_coaches' },
  ];

  const filtered = active === 'Todos' ? opportunities.slice(0, 6) : opportunities.filter((o) => o.type === active).slice(0, 6);

  const formatDate = (d: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    const diffDays = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    if (diffDays <= 7) return `${diffDays}d restantes`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <section id="opportunities" className="py-24 md:py-32 bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E10600] border-t-transparent rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  return (
    <section id="opportunities" className="py-24 md:py-32 bg-[#0d0d0d] relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.04) 0%, transparent 65%)' }} />

      <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-14">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-6 h-px bg-[#E10600]" />
              <span className="text-[#E10600] text-xs font-semibold tracking-[0.2em] uppercase font-inter">{t('opp_eyebrow')}</span>
            </div>
            <h2 className="font-unbounded font-black text-white leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
              {t('opp_headline_1')}<br />
              <span className="font-light text-white/50">{t('opp_headline_2')}</span>
            </h2>
          </div>
          <p className="text-white/62 text-base leading-relaxed max-w-md lg:text-right font-inter">{t('opp_subtext')}</p>
        </div>

        {/* Abanico de conexiones — deja claro que no es solo una bolsa de combates */}
        <div className="flex flex-wrap items-center gap-2.5 mb-10">
          <span className="text-white/40 text-xs font-semibold uppercase tracking-[0.15em] font-inter mr-1">{t('opp_kinds_intro')}</span>
          {CONNECTION_KINDS.map((k) => (
            <span key={k.labelKey}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/72 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1.5 font-inter">
              <i className={`${k.icon} text-sm text-[#E10600]`} />{t(k.labelKey)}
            </span>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-10">
          {filterKeys.map((f) => (
            <button key={f.key} onClick={() => setActive(f.key)}
              className="px-5 py-2.5 rounded-full text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap font-inter"
              style={{
                background: active === f.key ? '#E10600' : 'transparent',
                color: active === f.key ? 'white' : 'rgba(255,255,255,0.6)',
                borderColor: active === f.key ? '#E10600' : 'rgba(255,255,255,0.1)',
                boxShadow: active === f.key ? '0 0 20px rgba(225,6,0,0.25)' : 'none',
              }}>
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {/* Cards */}
        {opportunities.length === 0 ? (
          <div className="rounded-2xl flex flex-col items-center justify-center py-20 px-6 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl mb-5"
              style={{ background: 'rgba(225,6,0,0.08)', border: '1px solid rgba(225,6,0,0.15)' }}>
              <i className="ri-boxing-line text-2xl text-[#E10600]" />
            </div>
            <h3 className="font-unbounded font-bold text-white text-sm mb-3">{t('opp_home_empty_title')}</h3>
            <p className="text-white/55 text-sm font-inter leading-relaxed max-w-sm mb-8">{t('opp_home_empty_desc')}</p>
            <button onClick={() => navigate('/auth')}
              className="inline-flex items-center gap-2 bg-[#E10600] text-white font-semibold text-sm px-6 py-3 rounded-full hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap font-inter">
              <i className="ri-add-line" /> {t('opp_home_publish_btn')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/55 text-sm font-inter">{t('opp_home_no_type')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((opp) => {
              const cfg = typeConfig[opp.type] || typeConfig.combate;
              const label = t(typeLabels[opp.type] || 'opp_type_combate');
              const isUrgent = opp.event_date
                ? Math.ceil((new Date(opp.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 7
                : false;

              return (
                <div key={opp.id}
                  className="rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1 relative flex flex-col"
                  style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)' }}
                  onClick={() => navigate('/opportunities')}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
                >
                  {/* Barra de color tipo */}
                  <div className="h-[2px] w-full flex-shrink-0" style={{ background: cfg.bar }} />

                  <div className="p-6 flex flex-col flex-1">
                    {/* Urgente badge */}
                    {isUrgent && (
                      <div className="absolute top-5 right-5 bg-[#E10600] text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse font-inter">
                        {t('label_urgent')}
                      </div>
                    )}

                    {/* Tipo */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        <i className={`${cfg.icon} text-base`} style={{ color: cfg.accent }} />
                      </div>
                      <span className="text-xs font-bold px-3 py-1 rounded-full font-inter"
                        style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.accent }}>
                        {label}
                      </span>
                    </div>

                    {/* Título */}
                    <h3 className="text-white font-unbounded font-bold text-sm leading-snug mb-2 group-hover:text-[#E10600] transition-colors">
                      {opp.title}
                    </h3>
                    {opp.description && (
                      <p className="text-white/55 text-sm mb-5 font-inter line-clamp-2 leading-relaxed">{opp.description}</p>
                    )}

                    {/* Detalles */}
                    <div className="space-y-2 mb-6 flex-1">
                      {opp.location && (
                        <div className="flex items-center gap-2 text-sm text-white/62 font-inter">
                          <i className="ri-map-pin-line text-white/50 text-xs w-4" />
                          {opp.location}
                        </div>
                      )}
                      {opp.event_date && (
                        <div className="flex items-center gap-2 text-sm font-inter"
                          style={{ color: isUrgent ? '#E10600' : 'rgba(255,255,255,0.6)' }}>
                          <i className="ri-calendar-line text-xs w-4" style={{ color: isUrgent ? '#E10600' : 'rgba(255,255,255,0.45)' }} />
                          {formatDate(opp.event_date)}
                        </div>
                      )}
                      {opp.weight_class && (
                        <div className="flex items-center gap-2 text-sm text-white/62 font-inter">
                          <i className="ri-scales-line text-white/50 text-xs w-4" />
                          {opp.weight_class}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-white/50 text-xs font-inter">{t('label_compensation')}</span>
                      <div className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = '#E10600'; el.style.borderColor = '#E10600'; }}
                        onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                        <i className="ri-arrow-right-up-line text-white text-xs" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        {opportunities.length > 0 && (
          <div className="mt-14 text-center">
            <button onClick={() => navigate('/opportunities')}
              className="inline-flex items-center gap-3 bg-[#E10600] text-white font-semibold px-8 py-4 rounded-full hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap font-inter"
              style={{ boxShadow: '0 0 30px rgba(225,6,0,0.25)' }}>
              {t('btn_view_all_opportunities')} <i className="ri-arrow-right-line" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}