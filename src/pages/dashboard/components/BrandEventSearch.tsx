import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Opportunity, Profile } from '@/lib/supabase';

interface OppWithPublisher extends Opportunity {
  publisher?: Profile;
}

interface Props {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const typeConfig: Record<string, { label: string; color: string; icon: string }> = {
  combate:       { label: 'Combate',       color: 'bg-red-500/15 text-red-400 border-red-500/25',            icon: 'ri-boxing-line' },
  contrato:      { label: 'Contrato',      color: 'bg-zinc-700 text-zinc-300 border-zinc-600',               icon: 'ri-file-text-line' },
  patrocinio:    { label: 'Patrocinio',    color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',   icon: 'ri-hand-coin-line' },
  sparring:      { label: 'Sparring',      color: 'bg-orange-500/15 text-orange-400 border-orange-500/25',   icon: 'ri-user-shared-line' },
  campamento:    { label: 'Campamento',    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',icon: 'ri-tent-line' },
  entrenamiento: { label: 'Entrenamiento', color: 'bg-sky-500/15 text-sky-400 border-sky-500/25',            icon: 'ri-run-line' },
  scouting:      { label: 'Scouting',      color: 'bg-violet-500/15 text-violet-400 border-violet-500/25',   icon: 'ri-eye-line' },
};

const publisherTypeLabels: Record<string, string> = {
  promoter: 'Promotora', manager: 'Manager', gym: 'Gimnasio', brand: 'Marca', fighter: 'Peleador',
};

export default function BrandEventSearch({ showToast }: Props) {
  const navigate = useNavigate();
  const [opps, setOpps] = useState<OppWithPublisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [selectedOpp, setSelectedOpp] = useState<OppWithPublisher | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('opportunities')
        .select('*, publisher:profiles(id, full_name, avatar_url, user_type, location, instagram, twitter, website)')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      setOpps((data as OppWithPublisher[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return opps.filter((o) => {
      if (filterType && o.type !== filterType) return false;
      if (filterDiscipline && o.discipline !== filterDiscipline) return false;
      if (search) {
        const q = search.toLowerCase();
        const title = o.title.toLowerCase();
        const loc = (o.location || '').toLowerCase();
        const pub = (o.publisher?.full_name || '').toLowerCase();
        if (!title.includes(q) && !loc.includes(q) && !pub.includes(q)) return false;
      }
      return true;
    });
  }, [opps, search, filterType, filterDiscipline]);

  const disciplines = [
    { value: 'boxing', label: 'Boxeo' }, { value: 'mma', label: 'MMA' },
    { value: 'kickboxing', label: 'Kickboxing' }, { value: 'muay_thai', label: 'Muay Thai' },
    { value: 'wrestling', label: 'Wrestling' }, { value: 'bjj', label: 'BJJ' },
  ];

  const typeOptions = Object.entries(typeConfig).map(([value, cfg]) => ({ value, label: cfg.label }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Eventos y Promotores</h2>
        <p className="text-zinc-400 text-sm mt-0.5">
          Descubre eventos activos y promotoras donde tu marca puede aparecer
        </p>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="relative">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, ubicación, promotora..."
            className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-yellow-500 placeholder-zinc-500"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-yellow-500 cursor-pointer">
            <option value="">Tipo de oportunidad</option>
            {typeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterDiscipline} onChange={(e) => setFilterDiscipline(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-yellow-500 cursor-pointer">
            <option value="">Disciplina</option>
            {disciplines.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          {(search || filterType || filterDiscipline) && (
            <button onClick={() => { setSearch(''); setFilterType(''); setFilterDiscipline(''); }}
              className="flex items-center justify-center gap-1.5 text-xs rounded-xl px-3 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer whitespace-nowrap">
              <i className="ri-filter-off-line"></i> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Stats pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-zinc-500">{filtered.length} oportunidades activas</span>
        {Object.entries(typeConfig).map(([type, cfg]) => {
          const count = filtered.filter((o) => o.type === type).length;
          if (count === 0) return null;
          return (
            <button key={type} onClick={() => setFilterType(filterType === type ? '' : type)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer whitespace-nowrap ${filterType === type ? cfg.color : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
              <i className={cfg.icon}></i>{cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 text-zinc-600"><i className="ri-calendar-event-line text-4xl"></i></div>
          <p className="text-zinc-400 text-sm">No hay eventos activos con estos filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((opp) => {
            const cfg = typeConfig[opp.type] || typeConfig.combate;
            const pub = opp.publisher;
            const pubInitials = (pub?.full_name || 'O').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

            return (
              <div key={opp.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition-all">
                {/* Header */}
                <div className="p-5 pb-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
                      <i className={cfg.icon}></i>{cfg.label}
                    </span>
                    {opp.event_date && (
                      <span className="text-xs text-zinc-500 flex items-center gap-1 flex-shrink-0">
                        <i className="ri-calendar-line"></i>
                        {new Date(opp.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white leading-snug mb-2">{opp.title}</h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    {opp.location && (
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <i className="ri-map-pin-line"></i>{opp.location}
                      </span>
                    )}
                    {opp.discipline && (
                      <span className="text-xs text-zinc-500 capitalize">{opp.discipline.replace('_', ' ')}</span>
                    )}
                    {opp.weight_class && <span className="text-xs text-zinc-500">{opp.weight_class}</span>}
                    {opp.experience_level && (
                      <span className="text-xs text-zinc-500 capitalize">{opp.experience_level.replace('_', ' ')}</span>
                    )}
                  </div>
                  {opp.description && (
                    <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed line-clamp-2">{opp.description}</p>
                  )}
                </div>

                {/* Publisher */}
                {pub && (
                  <div className="px-5 py-3 border-t border-zinc-800 flex items-center gap-3">
                    {pub.avatar_url ? (
                      <img src={pub.avatar_url} alt={pub.full_name || ''} className="w-8 h-8 rounded-lg object-cover object-top flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold flex-shrink-0">
                        {pubInitials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-300 truncate">{pub.full_name || 'Organización'}</p>
                      <p className="text-xs text-zinc-500">{publisherTypeLabels[pub.user_type] || pub.user_type}</p>
                    </div>
                    {pub.location && (
                      <span className="text-xs text-zinc-600 flex items-center gap-1 flex-shrink-0">
                        <i className="ri-map-pin-line"></i>{pub.location}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="px-5 pb-4 pt-3 flex gap-2">
                  <button onClick={() => setSelectedOpp(opp)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-information-line"></i> Detalles
                  </button>
                  <button onClick={() => showToast('Interés registrado. El organizador recibirá tu solicitud.')}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-hand-coin-line"></i> Patrocinar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                {(() => { const cfg = typeConfig[selectedOpp.type] || typeConfig.combate; return (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
                    <i className={cfg.icon}></i>{cfg.label}
                  </span>
                ); })()}
              </div>
              <button onClick={() => setSelectedOpp(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>

            <h3 className="text-lg font-bold text-white mb-4">{selectedOpp.title}</h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Ubicación', value: selectedOpp.location, icon: 'ri-map-pin-line' },
                { label: 'Fecha', value: selectedOpp.event_date ? new Date(selectedOpp.event_date).toLocaleDateString('es-ES') : null, icon: 'ri-calendar-line' },
                { label: 'Disciplina', value: selectedOpp.discipline?.replace('_', ' '), icon: 'ri-boxing-line' },
                { label: 'Nivel', value: selectedOpp.experience_level?.replace('_', ' '), icon: 'ri-bar-chart-line' },
              ].filter((i) => i.value).map((item) => (
                <div key={item.label} className="bg-zinc-800 rounded-xl p-3">
                  <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1"><i className={item.icon}></i>{item.label}</p>
                  <p className="text-sm text-white font-medium capitalize">{item.value}</p>
                </div>
              ))}
            </div>

            {selectedOpp.description && (
              <div className="bg-zinc-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-zinc-500 mb-2">Descripción</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{selectedOpp.description}</p>
              </div>
            )}

            {selectedOpp.publisher && (
              <div className="bg-zinc-800 rounded-xl p-4 mb-5">
                <p className="text-xs text-zinc-500 mb-2">Publicado por</p>
                <div className="flex items-center gap-3">
                  {selectedOpp.publisher.avatar_url ? (
                    <img src={selectedOpp.publisher.avatar_url} alt="" className="w-10 h-10 rounded-lg object-cover object-top" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-300 text-sm font-bold">
                      {(selectedOpp.publisher.full_name || 'O')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedOpp.publisher.full_name}</p>
                    <p className="text-xs text-zinc-400">{publisherTypeLabels[selectedOpp.publisher.user_type] || selectedOpp.publisher.user_type}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => { showToast('Interés registrado. El organizador recibirá tu solicitud.'); setSelectedOpp(null); }}
              className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap text-sm"
            >
              <i className="ri-hand-coin-line"></i>
              Mostrar interés de patrocinio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
