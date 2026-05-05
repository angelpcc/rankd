import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Opportunity, OpportunityType, Profile } from '@/lib/supabase';
import ApplyModal from '@/pages/opportunities/components/ApplyModal';
import OpportunityCard from '@/pages/opportunities/components/OpportunityCard';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const typeOptions: { value: OpportunityType; label: string }[] = [
  { value: 'combate', label: 'Combate' },
  { value: 'sparring', label: 'Sparring' },
  { value: 'campamento', label: 'Campamento' },
  { value: 'entrenamiento', label: 'Entrenamiento' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'patrocinio', label: 'Patrocinio' },
  { value: 'scouting', label: 'Scouting' },
];

const disciplines = [
  { value: '', label: 'Todas' },
  { value: 'boxing', label: 'Boxeo' },
  { value: 'mma', label: 'MMA' },
  { value: 'kickboxing', label: 'Kickboxing' },
  { value: 'muay_thai', label: 'Muay Thai' },
  { value: 'wrestling', label: 'Wrestling' },
  { value: 'bjj', label: 'BJJ' },
];

const weightClasses = [
  '', 'Minimosca', 'Mosca', 'Gallo', 'Pluma', 'Ligero', 'Superligero',
  'Welter', 'Superwelter', 'Medio', 'Supermedio', 'Semipesado', 'Crucero', 'Pesado',
];

const expLevels = [
  { value: '', label: 'Cualquier nivel' },
  { value: 'amateur', label: 'Amateur' },
  { value: 'semi_pro', label: 'Semi-Pro' },
  { value: 'professional', label: 'Profesional' },
];

const typeConfig: Record<string, { color: string; icon: string }> = {
  combate:       { color: 'bg-red-500/10 text-red-400 border-red-500/30',            icon: 'ri-boxing-line' },
  contrato:      { color: 'bg-zinc-700 text-zinc-300 border-zinc-600',               icon: 'ri-file-text-line' },
  patrocinio:    { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',   icon: 'ri-hand-coin-line' },
  sparring:      { color: 'bg-orange-500/10 text-orange-400 border-orange-500/30',   icon: 'ri-user-shared-line' },
  campamento:    { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',icon: 'ri-tent-line' },
  entrenamiento: { color: 'bg-sky-500/10 text-sky-400 border-sky-500/30',            icon: 'ri-run-line' },
  scouting:      { color: 'bg-violet-500/10 text-violet-400 border-violet-500/30',   icon: 'ri-eye-line' },
};

const emptyForm = {
  title: '',
  type: 'sparring' as OpportunityType,
  discipline: '',
  weight_class: '',
  experience_level: '',
  location: '',
  event_date: '',
  description: '',
};

type SubTab = 'explore' | 'mine';

export default function FighterOpportunities({ profile, showToast }: Props) {
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState<SubTab>('explore');

  // ── EXPLORE state ──
  const [opportunities, setOpportunities] = useState<(Opportunity & { publisher?: Profile })[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [loadingExplore, setLoadingExplore] = useState(true);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [filterType, setFilterType] = useState('');

  // ── MY OPPORTUNITIES state ──
  const [myOpps, setMyOpps] = useState<Opportunity[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [applicationsCount, setApplicationsCount] = useState<Record<string, number>>({});

  // ── Load explore ──
  useEffect(() => {
    const load = async () => {
      const [{ data: opps }, { data: apps }] = await Promise.all([
        supabase
          .from('opportunities')
          .select('*, publisher:profiles(id, full_name, avatar_url, user_type, location)')
          .eq('status', 'open')
          .neq('profile_id', profile.id)
          .order('created_at', { ascending: false }),
        supabase.from('applications').select('opportunity_id').eq('fighter_profile_id', profile.id),
      ]);
      setOpportunities((opps as (Opportunity & { publisher?: Profile })[]) || []);
      if (apps) setAppliedIds(new Set(apps.map((a) => a.opportunity_id)));
      setLoadingExplore(false);
    };
    load();
  }, [profile.id]);

  // ── Load mine ──
  const loadMyOpps = useCallback(async () => {
    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });
    const opps = data || [];
    setMyOpps(opps);
    setLoadingMine(false);

    if (opps.length > 0) {
      const ids = opps.map((o) => o.id);
      const { data: apps } = await supabase
        .from('applications')
        .select('opportunity_id')
        .in('opportunity_id', ids);
      if (apps) {
        const counts: Record<string, number> = {};
        apps.forEach((a) => {
          counts[a.opportunity_id] = (counts[a.opportunity_id] || 0) + 1;
        });
        setApplicationsCount(counts);
      }
    }
  }, [profile.id]);

  useEffect(() => {
    loadMyOpps();
  }, [loadMyOpps]);

  // ── Apply ──
  const handleApply = async (message: string) => {
    if (!selectedOpp) return;
    const { error } = await supabase.from('applications').insert({
      opportunity_id: selectedOpp.id,
      fighter_profile_id: profile.id,
      message: message.trim() || null,
    });
    if (error) {
      showToast('Error al postularse. Inténtalo de nuevo.', 'error');
    } else {
      setAppliedIds((prev) => new Set([...prev, selectedOpp.id]));
      showToast('¡Postulación enviada correctamente!');
    }
    setSelectedOpp(null);
  };

  // ── My opps form ──
  const setField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (opp: Opportunity) => {
    setForm({
      title: opp.title,
      type: opp.type,
      discipline: opp.discipline || '',
      weight_class: opp.weight_class || '',
      experience_level: opp.experience_level || '',
      location: opp.location || '',
      event_date: opp.event_date || '',
      description: opp.description || '',
    });
    setEditingId(opp.id);
    setShowForm(true);
  };

  const saveOpportunity = async () => {
    if (!form.title.trim()) {
      showToast('El título es obligatorio', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      profile_id: profile.id,
      title: form.title.trim(),
      type: form.type,
      discipline: form.discipline || null,
      weight_class: form.weight_class || null,
      experience_level: form.experience_level || null,
      location: form.location.trim() || null,
      event_date: form.event_date || null,
      description: form.description.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('opportunities').update(payload).eq('id', editingId);
      if (error) { showToast('Error al actualizar', 'error'); setSaving(false); return; }
      showToast('Oportunidad actualizada');
    } else {
      const { error } = await supabase.from('opportunities').insert({ ...payload, status: 'open' });
      if (error) { showToast('Error al publicar', 'error'); setSaving(false); return; }
      showToast('Oportunidad publicada');
    }

    setSaving(false);
    setShowForm(false);
    loadMyOpps();
  };

  const toggleStatus = async (opp: Opportunity) => {
    const newStatus = opp.status === 'open' ? 'closed' : 'open';
    await supabase.from('opportunities').update({ status: newStatus }).eq('id', opp.id);
    setMyOpps((prev) => prev.map((o) => (o.id === opp.id ? { ...o, status: newStatus } : o)));
    showToast(newStatus === 'open' ? 'Oportunidad abierta' : 'Oportunidad cerrada');
  };

  const deleteOpportunity = async (id: string) => {
    await supabase.from('opportunities').delete().eq('id', id);
    setMyOpps((prev) => prev.filter((o) => o.id !== id));
    showToast('Oportunidad eliminada');
  };

  const filteredExplore = filterType
    ? opportunities.filter((o) => o.type === filterType)
    : opportunities;

  const exploreTypeOptions = [
    { value: '', label: 'Todos' },
    ...typeOptions,
  ];

  return (
    <div className="space-y-5">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setSubTab('explore')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${subTab === 'explore' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          <i className="ri-search-line"></i>
          Explorar
        </button>
        <button
          onClick={() => setSubTab('mine')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${subTab === 'mine' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          <i className="ri-megaphone-line"></i>
          Mis publicaciones
          {myOpps.length > 0 && (
            <span className="bg-zinc-700 text-zinc-300 text-xs px-1.5 py-0.5 rounded-full">{myOpps.length}</span>
          )}
        </button>
      </div>

      {/* ── EXPLORE TAB ── */}
      {subTab === 'explore' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Oportunidades disponibles</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {filteredExplore.length} oportunidad{filteredExplore.length !== 1 ? 'es' : ''} activa{filteredExplore.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => navigate('/opportunities')}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 cursor-pointer whitespace-nowrap"
            >
              Ver todos los peleadores <i className="ri-external-link-line"></i>
            </button>
          </div>

          {/* Type filter pills */}
          <div className="flex gap-2 flex-wrap">
            {exploreTypeOptions.map((t) => (
              <button
                key={t.value}
                onClick={() => setFilterType(t.value)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all cursor-pointer whitespace-nowrap ${filterType === t.value ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loadingExplore ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredExplore.length === 0 ? (
            <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
              <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 text-zinc-600">
                <i className="ri-search-line text-4xl"></i>
              </div>
              <p className="text-zinc-400 text-sm">No hay oportunidades disponibles ahora mismo.</p>
              <p className="text-zinc-500 text-xs mt-1">Vuelve pronto, se publican nuevas cada día.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredExplore.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  publisher={(opp as Opportunity & { publisher?: Profile }).publisher}
                  isApplied={appliedIds.has(opp.id)}
                  canApply={true}
                  onApply={() => setSelectedOpp(opp)}
                />
              ))}
            </div>
          )}

          {selectedOpp && (
            <ApplyModal
              opportunity={selectedOpp}
              onClose={() => setSelectedOpp(null)}
              onSubmit={handleApply}
            />
          )}
        </>
      )}

      {/* ── MY OPPORTUNITIES TAB ── */}
      {subTab === 'mine' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Mis Oportunidades</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Publica lo que buscas: sparring, campamento, rivales...
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i> Nueva publicación
            </button>
          </div>

          {/* Info banner */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center text-red-400 flex-shrink-0">
              <i className="ri-lightbulb-line text-lg"></i>
            </div>
            <div>
              <p className="text-sm text-zinc-300 font-medium">¿Qué puedes publicar?</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Busca sparring, compañeros de campamento, rivales para preparación, o anuncia que estás disponible para combates y contratos. Cualquier peleador o promotora puede ver y responder tu publicación.
              </p>
            </div>
          </div>

          {/* Form */}
          {showForm && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  {editingId ? 'Editar publicación' : 'Nueva publicación'}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white transition-colors cursor-pointer"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Título *</label>
                <input
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 placeholder-zinc-600"
                  placeholder="Ej: Busco sparring peso welter para campamento en Madrid"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Tipo *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setField('type', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    {typeOptions.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Disciplina</label>
                  <select
                    value={form.discipline}
                    onChange={(e) => setField('discipline', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    {disciplines.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Categoría de peso</label>
                  <select
                    value={form.weight_class}
                    onChange={(e) => setField('weight_class', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="">Cualquier categoría</option>
                    {weightClasses.filter(Boolean).map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Nivel requerido</label>
                  <select
                    value={form.experience_level}
                    onChange={(e) => setField('experience_level', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    {expLevels.map((lvl) => (
                      <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Ubicación</label>
                  <input
                    value={form.location}
                    onChange={(e) => setField('location', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 placeholder-zinc-600"
                    placeholder="Madrid, España"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Fecha del evento</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setField('event_date', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={4}
                  maxLength={500}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none placeholder-zinc-600"
                  placeholder="Describe lo que buscas: nivel, condiciones, qué ofreces..."
                />
                <p className="text-xs text-zinc-500 text-right mt-1">{form.description.length}/500</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:border-zinc-500 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveOpportunity}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <i className="ri-check-line"></i>
                      {editingId ? 'Actualizar' : 'Publicar'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {loadingMine ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : myOpps.length === 0 && !showForm ? (
            <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
              <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 text-zinc-600">
                <i className="ri-megaphone-line text-4xl"></i>
              </div>
              <p className="text-zinc-400 text-sm">No has publicado nada aún.</p>
              <p className="text-zinc-500 text-xs mt-1">Publica lo que buscas y que te encuentren.</p>
              <button
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line"></i> Crear primera publicación
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myOpps.map((opp) => {
                const cfg = typeConfig[opp.type] || typeConfig.combate;
                const appCount = applicationsCount[opp.id] || 0;
                return (
                  <div
                    key={opp.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          <i className={cfg.icon}></i>
                          {typeOptions.find((t) => t.value === opp.type)?.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${opp.status === 'open' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                          {opp.status === 'open' ? 'Abierta' : 'Cerrada'}
                        </span>
                        {appCount > 0 && (
                          <span className="text-xs bg-red-600/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                            {appCount} respuesta{appCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{opp.title}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {opp.location && (
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <i className="ri-map-pin-line"></i>{opp.location}
                          </span>
                        )}
                        {opp.event_date && (
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <i className="ri-calendar-line"></i>
                            {new Date(opp.event_date).toLocaleDateString('es-ES')}
                          </span>
                        )}
                        {opp.discipline && (
                          <span className="text-xs text-zinc-500 capitalize">{opp.discipline.replace('_', ' ')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEdit(opp)}
                        title="Editar"
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer"
                      >
                        <i className="ri-edit-line text-sm"></i>
                      </button>
                      <button
                        onClick={() => toggleStatus(opp)}
                        title={opp.status === 'open' ? 'Cerrar' : 'Abrir'}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${opp.status === 'open' ? 'border-zinc-700 text-zinc-400 hover:text-yellow-400 hover:border-yellow-500/50' : 'border-green-500/30 text-green-400 hover:border-green-500'}`}
                      >
                        <i className={opp.status === 'open' ? 'ri-pause-line text-sm' : 'ri-play-line text-sm'}></i>
                      </button>
                      <button
                        onClick={() => deleteOpportunity(opp.id)}
                        title="Eliminar"
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/50 transition-colors cursor-pointer"
                      >
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
